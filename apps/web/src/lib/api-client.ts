import { z } from 'zod';
import { clerkEnabled, env } from './env';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly correlationId: string | null,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions<T> {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  token?: string | null;
  /** Runtime-validate the response at the boundary — the same standard the
   *  backend applies to inbound requests. */
  schema?: z.ZodType<T>;
}

/**
 * Typed API client. Every request carries a correlation id (ADR-005) and —
 * when Clerk is enabled — a session JWT. Responses are unwrapped from the
 * backend's error shape, preserving the correlation id for support lookups.
 */
export async function apiRequest<T>(path: string, options: RequestOptions<T> = {}): Promise<T> {
  const { method = 'GET', body, token, schema } = options;
  const correlationId = crypto.randomUUID();

  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'x-correlation-id': correlationId,
  };
  if (token) headers['authorization'] = `Bearer ${token}`;
  // Dev seam only (D-037): backend TenantGuard accepts this in development.
  if (!clerkEnabled && env.NEXT_PUBLIC_DEV_TENANT_ID) {
    headers['x-tenant-id'] = env.NEXT_PUBLIC_DEV_TENANT_ID;
  }

  let response: Response;
  try {
    response = await fetch(`${env.NEXT_PUBLIC_API_BASE}${path}`, {
      method,
      headers,
      // Avoid Express ETag 304 responses — empty bodies break JSON + zod parsing.
      cache: 'no-store',
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw new ApiError(0, 'Network error — API unreachable', correlationId);
  }

  if (response.status === 204 || response.status === 304) {
    throw new ApiError(response.status, 'Empty API response — retry the request', correlationId);
  }

  if (!response.ok) {
    const errorBody: unknown = await response.json().catch(() => null);
    const message =
      typeof errorBody === 'object' && errorBody !== null && 'message' in errorBody
        ? String((errorBody as { message: unknown }).message)
        : `Request failed (${response.status})`;
    const echoed =
      typeof errorBody === 'object' && errorBody !== null && 'correlationId' in errorBody
        ? String((errorBody as { correlationId: unknown }).correlationId)
        : null;
    throw new ApiError(response.status, message, echoed ?? correlationId);
  }

  const data: unknown = await response.json();
  return schema ? schema.parse(data) : (data as T);
}

function authHeaders(token?: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    'x-correlation-id': crypto.randomUUID(),
  };
  if (token) headers['authorization'] = `Bearer ${token}`;
  if (!clerkEnabled && env.NEXT_PUBLIC_DEV_TENANT_ID) {
    headers['x-tenant-id'] = env.NEXT_PUBLIC_DEV_TENANT_ID;
  }
  return headers;
}

/** Binary GET for inbox media (voice notes, images). Does not parse JSON. */
export async function apiRequestBlob(
  path: string,
  options: { token?: string | null } = {},
): Promise<{ blob: Blob; mimeType: string }> {
  const correlationId = crypto.randomUUID();
  const headers = authHeaders(options.token);
  headers['x-correlation-id'] = correlationId;

  let response: Response;
  try {
    response = await fetch(`${env.NEXT_PUBLIC_API_BASE}${path}`, {
      method: 'GET',
      headers,
      cache: 'no-store',
    });
  } catch {
    throw new ApiError(0, 'Network error — API unreachable', correlationId);
  }

  if (!response.ok) {
    throw new ApiError(response.status, `Request failed (${response.status})`, correlationId);
  }

  const blob = await response.blob();
  const mimeType = response.headers.get('content-type') ?? blob.type ?? 'application/octet-stream';
  return { blob, mimeType };
}
