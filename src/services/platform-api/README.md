# Agent diagnostics API

Go `net/http` projects retained native agent ConfigMaps and current
StatefulSet, PVC and Gateway/policy readiness for the UI. It has no lifecycle
CRD client, controller loop, identity provisioning, runtime writer, model
inventory or inference proxy.

`GET /v1/agents` and `GET /v1/agents/{name}` expose current operational
records. Guardrails are read-only retained policy views. Monitor streams bounded native Jaeger/Loki records through
authenticated fetch, without forwarding browser tokens to stores.
Inventory operations share fresh namespace resource lists within one request,
with a second ConfigMap list verifying captures and identity ownership.
Complete inventory needs nine Kubernetes LISTs, independent of retained release
count; exact selection qualifies only the selected and requested-active runtimes.
Agent-list responses include release summaries, avoiding per-row UI requests.
No inventory cache persists across requests or Monitor polling operations.
`GET/PATCH /v1/connectivity-fault` reads/patches only the exact existing demo
NetworkPolicy; no workload or identity mutation is authorized.

Envoy validates human JWT issuer/audience, authorized party and `agent.invoke`.
The Service is isolated to authorized native ingress, not exposed directly.
Run with `K8S_NAMESPACE` and fixed `TRACE_QUERY_ENDPOINT`/`LOG_QUERY_ENDPOINT`.
`/healthz` is process-only. `just lint`, `test`, `build` run package checks.

See [native Radius agents](../../../docs/agents/native-radius.md) for deployment,
retention, outage semantics and live qualification gaps.
