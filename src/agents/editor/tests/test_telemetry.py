"""Verify real framework spans and SDK propagation, without handwritten spans."""

import json
import os
import subprocess
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from queue import Queue
from threading import Thread
from typing import Any

import pytest
from opentelemetry.proto.collector.trace.v1.trace_service_pb2 import ExportTraceServiceRequest


@pytest.mark.parametrize("mode", ["foreground", "streaming", "failure", "streaming-failure"])
def test_native_framework_invocation_and_peer_trace_propagation(mode: str) -> None:
    received: Queue[tuple[str, dict[str, str], bytes]] = Queue()

    class Receiver(BaseHTTPRequestHandler):
        def do_POST(self) -> None:
            body = self.rfile.read(int(self.headers["Content-Length"]))
            received.put((self.path, dict(self.headers), body))
            status = 200
            payload: dict[str, Any] = {}
            if self.path.endswith("/responses"):
                name = self.path.split("/")[2]
                if mode.endswith("failure"):
                    status = 503
                    payload = {"error": {"message": "Unavailable", "type": "server_error"}}
                else:
                    payload = {
                        "id": "resp-" + name,
                        "object": "response",
                        "created_at": 1,
                        "status": "completed",
                        "output": [
                            {
                                "id": "msg-" + name,
                                "type": "message",
                                "role": "assistant",
                                "status": "completed",
                                "content": [
                                    {
                                        "type": "output_text",
                                        "text": name + " result",
                                        "annotations": [],
                                    }
                                ],
                            }
                        ],
                    }
            data = json.dumps(payload).encode()
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def log_message(self, format: str, *args: Any) -> None:
            pass

    with ThreadingHTTPServer(("127.0.0.1", 0), Receiver) as server:
        thread = Thread(target=server.serve_forever, daemon=True)
        thread.start()
        endpoint = f"http://127.0.0.1:{server.server_port}"
        env = {
            key: value
            for key, value in os.environ.items()
            if not key.startswith(("OTEL_", "APPLICATIONINSIGHTS_", "FOUNDRY_", "AZURE_"))
        }
        env.update(
            OTEL_EXPORTER_OTLP_ENDPOINT=endpoint,
            OTEL_EXPORTER_OTLP_TRACES_ENDPOINT=endpoint + "/sidecar/v1/traces",
            OTEL_EXPORTER_OTLP_PROTOCOL="http/protobuf",
            OTEL_EXPORTER_OTLP_TRACES_PROTOCOL="http/protobuf",
            OTEL_INSTRUMENTATION_GENAI_CAPTURE_MESSAGE_CONTENT="false",
        )
        for prefix, name in (("WRITER", "writer"), ("AUDITOR", "auditor")):
            env.update(
                {
                    f"{prefix}_NAME": name,
                    f"{prefix}_RESPONSES_BASE_URL": f"{endpoint}/agents/{name}/",
                }
            )
        try:
            result = subprocess.run(
                [
                    sys.executable,
                    "-c",
                    """
import asyncio, sys
from functools import partial
from agent_framework import Message
from agent_framework_foundry_hosting import ResponsesHostServer
from azure.ai.agentserver.core import configure_observability
from openai import APIStatusError
from opentelemetry import trace
from editor import agent

async def token():
    return "application-token"
agent._keycloak_token = token
editor = agent.Editor(name="editor")
host = ResponsesHostServer(
    editor, history_source="agent",
    configure_observability=partial(
        configure_observability, instrumentation_options={"httpx": {"enabled": True}}
    ),
)
async def run():
    if sys.argv[1].endswith("failure"):
        try:
            if sys.argv[1] == "streaming-failure":
                async for update in editor.run([Message("user", ["Brief"])], stream=True):
                    raise AssertionError("Failed execution yielded a partial result")
            else:
                await editor.run([Message("user", ["Brief"])])
        except APIStatusError:
            return
        raise AssertionError("Peer failure was swallowed")
    if sys.argv[1] == "streaming":
        async def consume(stream):
            updates = [update async for update in stream]
            assert len(updates) == 1
            return await stream.get_final_response()
        stream = editor.run([Message("user", ["Brief"])], stream=True)
        result = await asyncio.create_task(consume(stream))
    else:
        result = await editor.run([Message("user", ["Brief"])])
    assert result.text == "## writer\\n\\nwriter result\\n\\n## auditor\\n\\nauditor result"
asyncio.run(run())
provider = trace.get_tracer_provider()
assert provider.force_flush()
provider.shutdown()
""",
                    mode,
                ],
                env=env,
                capture_output=True,
                text=True,
                timeout=60,
            )
            assert result.returncode == 0, result.stdout + result.stderr
        finally:
            server.shutdown()
            thread.join()

    spans, requests = [], []
    while not received.empty():
        path, headers, body = received.get_nowait()
        if path == "/sidecar/v1/traces":
            for resource in ExportTraceServiceRequest.FromString(body).resource_spans:
                for scope in resource.scope_spans:
                    spans.extend(scope.spans)
        elif path == "/v1/traces":
            pytest.fail("Native host bypassed the configured sidecar trace endpoint")
        elif path.endswith("/responses"):
            requests.append((path, {key.lower(): value for key, value in headers.items()}, body))
    invocations = [span for span in spans if span.name == "invoke_agent editor"]
    assert len(invocations) == 1
    invocation = invocations[0]
    attributes = {attr.key: attr.value.string_value for attr in invocation.attributes}
    assert attributes["gen_ai.operation.name"] == "invoke_agent"
    assert attributes["gen_ai.provider.name"] == "microsoft.agent_framework"
    assert len(requests) == (1 if mode.endswith("failure") else 2)
    http_spans = [span for span in spans if span.name == "POST"]
    assert len(http_spans) == len(requests)
    for span, (_, headers, body) in zip(http_spans, requests, strict=True):
        assert span.trace_id == invocation.trace_id
        assert span.parent_span_id == invocation.span_id
        version, trace_id, parent_id, flags = headers["traceparent"].split("-")
        assert version == "00"
        assert trace_id == span.trace_id.hex()
        assert parent_id == span.span_id.hex()
        assert int(flags, 16) & 1
        assert json.loads(body)["store"] is False
    assert not any(span.name.startswith(("chat ", "execute_tool ")) for span in spans)
    assert (invocation.status.code == 2) == mode.endswith("failure")
