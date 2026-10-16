import {
  Badge,
  Button,
  Text,
  ToggleButton,
} from '@fluentui/react-components';
import { Fragment, useEffect, useMemo, useState } from 'react';
import {
  a365Operation,
  formatAttributesLine,
  formatDuration,
  formatTime,
  isLog,
  logResult,
  logSummary,
  MonitorRecord,
  SpanEvent,
  summarizeAttributes,
  tracePrefix,
} from './monitor/model';
import { RecordDetails } from './monitor/RecordDetails';
import { useMonitorStream } from './monitor/useMonitorStream';

export {
  a365Operation,
  appendMonitorRecord,
  formatAttributesLine,
  summarizeAttributes,
} from './monitor/model';
export type { A365Operation, SpanEvent } from './monitor/model';

export type MonitorPanelProps = {
  name: string;
  visible: boolean;
};

function connectionLabel(status: 'connecting' | 'live' | 'reconnecting' | 'error'): string {
  return status[0].toUpperCase() + status.slice(1);
}

function connectionColor(status: 'connecting' | 'live' | 'reconnecting' | 'error'): 'subtle' | 'success' | 'warning' | 'danger' {
  switch (status) {
    case 'live': return 'success';
    case 'reconnecting': return 'warning';
    case 'error': return 'danger';
    case 'connecting': return 'subtle';
  }
}

function spanStatusColor(status: SpanEvent['status']): 'subtle' | 'success' | 'danger' {
  switch (status) {
    case 'ok': return 'success';
    case 'error': return 'danger';
    case 'unset': return 'subtle';
  }
}

export function MonitorPanel({ name, visible }: MonitorPanelProps): JSX.Element {
  const [paused, setPaused] = useState(false);
  const [traceFilter, setTraceFilter] = useState<string | null>(null);
  const [a365Only, setA365Only] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<MonitorRecord | null>(null);
  const [detailsWidth, setDetailsWidth] = useState(560);
  const { records, setRecords, status } = useMonitorStream(name, paused);
  useEffect(() => {
    setTraceFilter(null);
    setA365Only(false);
    setSelectedRecord(null);
  }, [name]);

  const displayedRecords = useMemo(() => {
    let list = records;
    if (traceFilter) {
      list = list.filter(
        (record) => record.name === 'identity.reconciliation' || record.trace_id === traceFilter,
      );
    }
    if (a365Only) {
      list = list.filter((record) => isLog(record) || a365Operation(record) !== null);
    }
    return list;
  }, [records, traceFilter, a365Only]);

  const a365Count = useMemo(
    () => records.filter((record) => !isLog(record) && a365Operation(record) !== null).length,
    [records],
  );

  const clear = (): void => {
    setRecords([]);
    setTraceFilter(null);
    setA365Only(false);
    setSelectedRecord(null);
  };

  return (
    <section className="monitor-panel" aria-label="Agent monitor" data-visible={visible}>
      <div className="monitor-header">
        <Text weight="semibold">Telemetry (live)</Text>
        <Badge appearance="tint" color={connectionColor(status)}>
          {connectionLabel(status)}
        </Badge>
        <ToggleButton checked={paused} onClick={() => setPaused((current) => !current)}>
          Pause
        </ToggleButton>
        <ToggleButton
          checked={a365Only}
          onClick={() => setA365Only((current) => !current)}
          title="Filter spans to Agent-365 operations; keep logs visible"
        >
          A365 only ({a365Count})
        </ToggleButton>
        <Button onClick={clear}>Clear</Button>
        <Text className="muted-text">{records.length} records</Text>
        <Text className="muted-text">Best-effort live telemetry</Text>
        {traceFilter ? (
          <Button appearance="transparent" onClick={() => setTraceFilter(null)}>
            Trace {tracePrefix(traceFilter)} ×
          </Button>
        ) : null}
      </div>

      {traceFilter &&
      !records.some(
        (record) =>
          !isLog(record) &&
          record.trace_id === traceFilter &&
          a365Operation(record) === 'invoke_agent',
      ) ? (
        <Text className="muted-text" role="status">
          No agent invocation span in the retained telemetry for this trace. It may still be
          running, missing instrumentation, or outside the live buffer. A trace ID is not a
          conversation ID.
        </Text>
      ) : null}

      <div className="monitor-table-wrap">
        <table className="monitor-table" aria-label="Monitor telemetry">
          <thead>
            <tr>
              <th scope="col">Time</th>
              <th scope="col">Event / source</th>
              <th scope="col" className="monitor-duration">
                Duration
              </th>
              <th scope="col">Status</th>
              <th scope="col">Trace</th>
              <th scope="col">Summary</th>
            </tr>
          </thead>
          <tbody>
            {displayedRecords.length > 0 ? (
              displayedRecords.map((record) => {
                const log = isLog(record);
                const summary = log ? logSummary(record) : summarizeAttributes(record.attributes);
                const attributesLine = formatAttributesLine(record.attributes);
                const a365Op = log ? null : a365Operation(record);
                const result = log
                  ? logResult(record)
                  : { label: record.status, color: spanStatusColor(record.status) };
                const openDetails = (): void => setSelectedRecord(record);
                return (
                  <Fragment key={log ? record.log_id : `${record.trace_id}-${record.span_id}`}>
                    <tr
                      className="monitor-row"
                      data-record-type={log ? 'log' : 'span'}
                      data-a365={a365Op ? 'true' : undefined}
                      tabIndex={0}
                      onClick={openDetails}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          openDetails();
                        }
                      }}
                    >
                      <td className="monitor-mono">
                        {formatTime(log ? record.time_iso : record.start_time_iso)}
                      </td>
                      <td>
                        <span className="monitor-name-cell">
                          {a365Op ? (
                            <Badge
                              appearance="filled"
                              color="brand"
                              size="small"
                              className="monitor-a365-mark"
                              title={`Agent-365 span (gen_ai.operation.name=${a365Op})`}
                            >
                              A365 · {a365Op}
                            </Badge>
                          ) : null}
                          <span title={record.name}>{record.name}</span>
                        </span>
                        <div className="muted-text">
                          {log ? 'Log' : 'Span'} · {record.service}
                        </div>
                      </td>
                      <td className="monitor-duration monitor-mono">
                        {log ? '—' : formatDuration(record.duration_ms)}
                      </td>
                      <td>
                        <Badge appearance="tint" color={result.color}>
                          {result.label}
                        </Badge>
                      </td>
                      <td>
                        {record.trace_id && !/^0+$/.test(record.trace_id) ? (
                          <button
                            type="button"
                            className="monitor-trace monitor-mono"
                            onClick={(event) => {
                              event.stopPropagation();
                              setTraceFilter(record.trace_id);
                            }}
                          >
                            {tracePrefix(record.trace_id)}
                          </button>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="monitor-summary" title={summary}>
                        {summary || '—'}
                      </td>
                    </tr>
                    <tr className="monitor-attributes-row" onClick={openDetails}>
                      <td colSpan={6}>
                        <div
                          className="monitor-attributes-line monitor-mono"
                          title={attributesLine}
                        >
                          {attributesLine || '—'}
                        </div>
                      </td>
                    </tr>
                  </Fragment>
                );
              })
            ) : (
              <tr>
                <td colSpan={6} className="monitor-empty">
                  No telemetry yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <RecordDetails
        record={selectedRecord}
        width={detailsWidth}
        setWidth={setDetailsWidth}
        onClose={() => setSelectedRecord(null)}
      />
    </section>
  );
}
