import {
  Badge,
  Button,
  DrawerBody,
  DrawerHeader,
  DrawerHeaderTitle,
  OverlayDrawer,
  Text,
} from '@fluentui/react-components';
import type { Dispatch, SetStateAction } from 'react';
import {
  a365Operation,
  formatDuration,
  formatTime,
  isLog,
  logResult,
  MonitorRecord,
} from './model';

export function RecordDetails({
  record,
  width,
  setWidth,
  onClose,
}: {
  record: MonitorRecord | null;
  width: number;
  setWidth: Dispatch<SetStateAction<number>>;
  onClose: () => void;
}): JSX.Element {
  const maxWidth = Math.max(280, window.innerWidth - 32);
  const operation = record && !isLog(record) ? a365Operation(record) : null;
  const resize = (nextWidth: number): void => {
    setWidth(Math.max(280, Math.min(maxWidth, nextWidth)));
  };

  return (
    <OverlayDrawer
      className="monitor-drawer"
      style={{ width, maxWidth: 'calc(100vw - 32px)' }}
      open={Boolean(record)}
      position="end"
      onOpenChange={(_, data) => {
        if (!data.open) onClose();
      }}
    >
      {record ? (
        <>
          <div
            className="monitor-resize-handle"
            role="separator"
            aria-label="Resize telemetry details"
            aria-orientation="vertical"
            aria-valuemin={280}
            aria-valuemax={maxWidth}
            aria-valuenow={Math.min(width, maxWidth)}
            tabIndex={0}
            onPointerDown={(event) => {
              if (event.button === 0) {
                event.currentTarget.setPointerCapture(event.pointerId);
                event.preventDefault();
              }
            }}
            onPointerMove={(event) => {
              if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                resize(window.innerWidth - event.clientX);
              }
            }}
            onPointerUp={(event) => {
              if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                event.currentTarget.releasePointerCapture(event.pointerId);
              }
            }}
            onKeyDown={(event) => {
              const widths: Record<string, number> = {
                ArrowLeft: Math.min(width, maxWidth) + 40,
                ArrowRight: Math.min(width, maxWidth) - 40,
                Home: 280,
                End: maxWidth,
              };
              if (event.key in widths) {
                event.preventDefault();
                resize(widths[event.key]);
              }
            }}
          />
          <DrawerHeader>
            <DrawerHeaderTitle
              action={
                <Button appearance="subtle" aria-label="Close telemetry details" onClick={onClose}>
                  ×
                </Button>
              }
            >
              {isLog(record) ? 'Log details' : 'Span details'}
            </DrawerHeaderTitle>
          </DrawerHeader>
          <DrawerBody>
            <div className="monitor-detail">
              <Text as="h3" size={500} weight="semibold">{record.name}</Text>
              {operation ? (
                <Badge
                  appearance="filled"
                  color="brand"
                  size="medium"
                  className="monitor-a365-mark"
                >
                  Agent-365 · {operation}
                </Badge>
              ) : null}
              <dl className="monitor-detail-list">
                <dt>Trace ID</dt>
                <dd className="monitor-mono">{record.trace_id || '—'}</dd>
                <dt>Span ID</dt>
                <dd className="monitor-mono">{record.span_id || '—'}</dd>
                <dt>Service</dt>
                <dd>{record.service}</dd>
                {isLog(record) ? (
                  <>
                    <dt>Log ID</dt>
                    <dd className="monitor-mono">{record.log_id}</dd>
                    <dt>Time</dt>
                    <dd>{record.time_iso}</dd>
                    <dt>Severity</dt>
                    <dd>{record.severity}</dd>
                    <dt>Result</dt>
                    <dd>{logResult(record).label}</dd>
                  </>
                ) : (
                  <>
                    <dt>Parent span</dt>
                    <dd className="monitor-mono">{record.parent_span_id ?? '—'}</dd>
                    <dt>Kind</dt>
                    <dd>{record.kind}</dd>
                    <dt>Duration</dt>
                    <dd>{formatDuration(record.duration_ms)}</dd>
                    <dt>Status</dt>
                    <dd>{record.status_message ?? record.status}</dd>
                  </>
                )}
              </dl>

              <Text weight="semibold">Attributes</Text>
              <pre className="json-block">{JSON.stringify(record.attributes, null, 2)}</pre>

              {!isLog(record) ? (
                <>
                  <Text weight="semibold">Events</Text>
                  {record.events.length > 0 ? (
                    <ul className="monitor-event-list">
                      {record.events.map((spanEvent, index) => (
                        <li key={`${spanEvent.time_iso}-${spanEvent.name}-${index}`}>
                          <Text weight="semibold">
                            <span className="monitor-mono">{formatTime(spanEvent.time_iso)}</span>{' '}
                            {spanEvent.name}
                          </Text>
                          <pre className="json-block">
                            {JSON.stringify(spanEvent.attributes, null, 2)}
                          </pre>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <Text className="muted-text">No events.</Text>
                  )}
                </>
              ) : null}
            </div>
          </DrawerBody>
        </>
      ) : null}
    </OverlayDrawer>
  );
}
