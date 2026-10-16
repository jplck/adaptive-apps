import { z } from 'zod';

const AttributesSchema = z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]));
export type SpanAttributes = z.infer<typeof AttributesSchema>;

const MonitorLogSchema = z.object({
  type: z.literal('log'),
  log_id: z.string(),
  name: z.enum(['guardrail.decision', 'identity.reconciliation']),
  trace_id: z.string(),
  span_id: z.string(),
  time_iso: z.string(),
  severity: z.enum(['info', 'warning', 'error']),
  service: z.string(),
  attributes: AttributesSchema,
});
export type MonitorLog = z.infer<typeof MonitorLogSchema>;

const SpanSchema = z.object({
  trace_id: z.string(),
  span_id: z.string(),
  parent_span_id: z.string().nullable(),
  name: z.string(),
  kind: z.enum(['internal', 'server', 'client', 'producer', 'consumer']),
  start_time_iso: z.string(),
  end_time_iso: z.string(),
  duration_ms: z.number(),
  status: z.enum(['unset', 'ok', 'error']),
  status_message: z.string().nullable(),
  service: z.string(),
  attributes: AttributesSchema,
  events: z.array(
    z.object({ time_iso: z.string(), name: z.string(), attributes: AttributesSchema }),
  ),
});
export type SpanEvent = z.infer<typeof SpanSchema>;
export type MonitorRecord = MonitorLog | SpanEvent;

export function isLog(record: MonitorRecord): record is MonitorLog {
  return 'type' in record;
}

export function parseMonitorRecord(value: unknown): MonitorRecord | undefined {
  const result = value && typeof value === 'object' && 'type' in value
    ? MonitorLogSchema.safeParse(value)
    : SpanSchema.safeParse(value);
  return result.success ? result.data : undefined;
}

export type A365Operation = 'invoke_agent' | 'agent_run' | 'chat' | 'execute_tool';

const A365_OPS: ReadonlySet<string> = new Set(['invoke_agent', 'agent_run', 'chat', 'execute_tool']);

export function a365Operation(span: SpanEvent): A365Operation | null {
  const op = span.attributes['gen_ai.operation.name'];
  if (typeof op === 'string' && A365_OPS.has(op)) {
    return op as A365Operation;
  }
  const firstToken = span.name.split(' ', 1)[0];
  return A365_OPS.has(firstToken) ? firstToken as A365Operation : null;
}

export function formatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return iso;
  }

  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  const ms = String(date.getMilliseconds()).padStart(3, '0');
  return `${hh}:${mm}:${ss}.${ms}`;
}

export function formatDuration(durationMs: number): string {
  return `${durationMs.toFixed(3)} ms`;
}

export function tracePrefix(traceId: string): string {
  return traceId.slice(0, 8);
}

export function summarizeAttributes(attrs: SpanAttributes): string {
  const parts: string[] = [];
  if (attrs['gen_ai.request.model']) {
    parts.push(`model=${attrs['gen_ai.request.model']}`);
  }
  if (
    attrs['gen_ai.usage.input_tokens'] !== undefined ||
    attrs['gen_ai.usage.output_tokens'] !== undefined
  ) {
    parts.push(
      `tokens=${attrs['gen_ai.usage.input_tokens'] ?? '?'}→${attrs['gen_ai.usage.output_tokens'] ?? '?'}`,
    );
  }
  if (attrs['http.route']) {
    parts.push(`${attrs['http.request.method'] ?? ''} ${attrs['http.route']}`.trim());
  }
  if (attrs['tool.name']) {
    parts.push(`tool=${attrs['tool.name']}`);
  }
  return parts.join(' · ');
}

export function formatAttributesLine(attrs: SpanAttributes): string {
  return Object.entries(attrs)
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(' ');
}

function areParentChildDuplicates(left: SpanEvent, right: SpanEvent): boolean {
  if (left.trace_id !== right.trace_id || left.name !== right.name) {
    return false;
  }
  return left.parent_span_id === right.span_id || right.parent_span_id === left.span_id;
}

function mergeDuplicateSpans(existing: SpanEvent, incoming: SpanEvent): SpanEvent {
  const incomingIsParent = existing.parent_span_id === incoming.span_id;
  const existingIsParent = incoming.parent_span_id === existing.span_id;
  const displaySpan = incomingIsParent || !existingIsParent ? incoming : existing;
  const detailSpan = displaySpan === incoming ? existing : incoming;

  return {
    ...displaySpan,
    attributes: {
      ...detailSpan.attributes,
      ...displaySpan.attributes,
    },
    events: [...displaySpan.events, ...detailSpan.events],
  };
}

const maxRecords = 200;

export function appendMonitorRecord(
  current: MonitorRecord[],
  incoming: MonitorRecord,
): MonitorRecord[] {
  const timestamp = (record: MonitorRecord) =>
    Date.parse(isLog(record) ? record.time_iso : record.start_time_iso);
  const newestFirst = (records: MonitorRecord[]) =>
    records.sort((left, right) => timestamp(right) - timestamp(left)).slice(0, maxRecords);
  const duplicateIndex = current.findIndex((record) => {
    if (isLog(incoming)) {
      return isLog(record) && record.log_id === incoming.log_id;
    }
    return (
      !isLog(record) &&
      ((record.trace_id === incoming.trace_id && record.span_id === incoming.span_id) ||
        areParentChildDuplicates(record, incoming))
    );
  });
  if (duplicateIndex === -1) {
    return newestFirst([incoming, ...current]);
  }

  const existing = current[duplicateIndex];
  if (isLog(existing) || isLog(incoming) || existing.span_id === incoming.span_id) {
    return current;
  }
  const next = [...current];
  next[duplicateIndex] = mergeDuplicateSpans(existing, incoming);
  return newestFirst(next);
}

export function logResult(record: MonitorLog): { label: string; color: 'danger' | 'success' | 'warning' } {
  const identity = record.name === 'identity.reconciliation';
  const result = String(
    record.attributes[identity ? 'identity.result' : 'guardrail.decision'] ?? 'unknown',
  );
  const blocked = record.attributes['guardrail.enforced'] === true;
  const successful = identity ? result === 'ready' : result === 'allow';
  const failed = identity ? result === 'failed' : blocked;
  return {
    label: identity
      ? result
      : `${blocked ? 'Blocked' : successful ? 'Allowed' : 'Audit only'} · ${result}`,
    color: failed ? 'danger' : successful ? 'success' : 'warning',
  };
}

export function logSummary(record: MonitorLog): string {
  const attrs = record.attributes;
  return record.name === 'identity.reconciliation'
    ? [
        `${attrs['identity.mode'] ?? 'unknown'} / ${attrs['identity.phase'] ?? ''}`,
        `Entra: ${attrs['identity.entra_state'] ?? 'unknown'}`,
        `Keycloak: ${attrs['identity.keycloak_state'] ?? 'unknown'}`,
        attrs['identity.pending_reasons'],
        attrs['error.type'],
      ]
        .filter(Boolean)
        .join(' · ')
    : `${attrs['guardrail.action'] ?? ''} ${attrs['guardrail.resource'] ?? ''} · ${attrs['guardrail.policy'] ?? '—'} / ${attrs['guardrail.rule'] ?? '—'} · version ${attrs['adaptive.agent.version'] || 'unversioned'}`;
}
