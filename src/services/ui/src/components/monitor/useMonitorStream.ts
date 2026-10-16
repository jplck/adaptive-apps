import { useEffect, useRef, useState } from 'react';
import { ApiError, streamAgentSpans } from '../../api/client';
import { appendMonitorRecord, MonitorRecord, parseMonitorRecord } from './model';

export type ConnectionStatus = 'connecting' | 'live' | 'reconnecting' | 'error';

export function useMonitorStream(name: string, paused: boolean) {
  const [records, setRecords] = useState<MonitorRecord[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const pausedRef = useRef(paused);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    setRecords([]);
    setStatus('connecting');

    if (!name) {
      setStatus('error');
      return undefined;
    }

    const controller = new AbortController();
    let retry: ReturnType<typeof setTimeout> | undefined;
    const receive = (event: { data: string }): void => {
      if (controller.signal.aborted) return;
      let parsed: unknown;
      try {
        parsed = JSON.parse(event.data);
      } catch {
        setStatus('error');
        return;
      }

      if (pausedRef.current) return;

      const record = parseMonitorRecord(parsed);
      if (!record) {
        setStatus('error');
        return;
      }
      setRecords((current) => appendMonitorRecord(current, record));
    };

    const connect = async (): Promise<void> => {
      try {
        await streamAgentSpans(name, {
          signal: controller.signal,
          onOpen: () => setStatus('live'),
          onEvent: receive,
        });
      } catch (error) {
        if (controller.signal.aborted) return;
        if (error instanceof ApiError && error.status < 500) {
          setStatus('error');
          return;
        }
      }
      if (!controller.signal.aborted) {
        setStatus('reconnecting');
        retry = setTimeout(() => void connect(), 3000);
      }
    };
    void connect();
    return () => {
      controller.abort();
      clearTimeout(retry);
    };
  }, [name]);

  return { records, setRecords, status };
}
