import { z } from 'zod';
import { authenticatedFetch } from '../auth/oidc';

export class ApiError extends Error {
  status: number;
  body: unknown;
  apiCode?: string;
  apiMessage?: string;

  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
    if (body && typeof body === 'object') {
      const obj = body as Record<string, unknown>;
      if (typeof obj.code === 'string') this.apiCode = obj.code;
      if (typeof obj.message === 'string') this.apiMessage = obj.message;
    }
  }
}

export async function parseErrorBody(response: Response): Promise<unknown> {
  try {
    const text = await response.text();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  } catch {
    return null;
  }
}

export async function responseError(response: Response, context: string): Promise<ApiError> {
  const body = await parseErrorBody(response);
  const details = body && typeof body === 'object' ? body as {
    message?: unknown; detail?: unknown; error?: { message?: unknown };
  } : undefined;
  const detail = details?.error?.message ?? details?.message ?? details?.detail ?? body;
  return new ApiError(response.status,
    `${context} failed with ${response.status}${typeof detail === 'string' ? `: ${detail.slice(0, 300)}` : ''}`, body);
}

export async function requestJson<T>(path: string, schema: z.ZodType<T>, init?: RequestInit): Promise<T> {
  const response = await authenticatedFetch(path, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const method = init?.method ?? 'GET';
    throw await responseError(response, `${method} ${path}`);
  }

  return schema.parse(await response.json());
}

export async function sendJson<T>(
  path: string,
  method: string,
  body: unknown,
  schema: z.ZodType<T>,
): Promise<T> {
  return requestJson(path, schema, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
