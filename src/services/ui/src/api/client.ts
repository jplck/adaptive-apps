import { authenticatedFetch } from '../auth/oidc';
import { readSseStream, type SseMessage } from './sse';
import { ImpersonationModeSchema, type ImpersonationMode } from './tools';
import { ApiError, parseErrorBody, responseError } from './transport';

export * from './a2a';
export * from './agents';
export * from './guardrails';
export * from './models';
export * from './platform';
export * from './tools';
export { ApiError, requestJson, responseError, sendJson } from './transport';

export type InvokeAgentOptions = {
  signal?: AbortSignal;
  onEvent?: (message: SseMessage) => void;
  impersonation?: ImpersonationMode;
  entraUserToken?: string;
};

function impersonationHeaders(
  mode: ImpersonationMode | undefined,
  entraUserToken?: string,
): Record<string, string> {
  if (mode !== undefined) ImpersonationModeSchema.parse(mode);
  if (entraUserToken !== undefined && mode !== 'endUserOBO') {
    throw new Error('An Entra user assertion is forbidden outside OBO invocation.');
  }
  if (!mode) {
    return {};
  }
  if (mode === 'endUserOBO') {
    if (!entraUserToken?.trim()) throw new Error('OBO requires an Entra user assertion.');
    return { 'X-Impersonation-Mode': mode, 'X-Entra-User-Token': entraUserToken };
  }
  return { 'X-Impersonation-Mode': mode };
}

export async function streamAgentSpans(
  name: string,
  { signal, onOpen, onEvent }: {
    signal: AbortSignal;
    onOpen: () => void;
    onEvent: (message: SseMessage) => void;
  },
): Promise<void> {
  const response = await authenticatedFetch(`/v1/agents/${encodeURIComponent(name)}/spans`, {
    signal,
    headers: { Accept: 'text/event-stream' },
  });
  if (!response.ok) {
    throw new ApiError(response.status, `Monitor stream failed with ${response.status}`, await parseErrorBody(response));
  }
  if (!response.headers.get('content-type')?.includes('text/event-stream')) {
    throw new Error('Expected a Monitor event stream.');
  }
  onOpen();
  await readSseStream(response, onEvent);
}

export async function invokeAgent(
  endpoint: string,
  body: Record<string, unknown>,
  { signal, onEvent, impersonation, entraUserToken }: InvokeAgentOptions = {},
): Promise<void> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
    ...impersonationHeaders(impersonation, entraUserToken),
  };
  const response = await authenticatedFetch(endpoint, {
    method: 'POST',
    signal,
    headers,
    body: JSON.stringify(body),
  }, { invalidateSessionOnUnauthorized: false });

  if (!response.ok) {
    throw await responseError(response, 'Agent invocation');
  }
  if (!response.headers.get('content-type')?.includes('text/event-stream')) {
    throw new Error('Expected a native Responses event stream.');
  }

  await readSseStream(response, (message) => onEvent?.(message));
}
