# Wakeel — Data Fetching & API Integration

**Status:** IMPLEMENTED BASELINE & SPECIFICATION  
**Classification:** Network Layer, Transport Architecture, and Zod Boundary Validation  
**Source Code References:** `apps/web/src/lib/api-client.ts`, `apps/web/src/proxy.ts`, `apps/web/next.config.ts`  

---

## 1. Network Topology: Same-Origin Rewrites (D-038)

The browser never issues cross-origin requests directly to the API:

```text
Browser Client ──► fetch('/backend/v1/inbox')
                        │
                        ▼ (Next.js Rewrite in next.config.ts)
                   http://localhost:3001/v1/inbox
```

- **Zero CORS:** Completely eliminates CORS configuration from both development and production.
- **Production Parity:** Matches production container packaging where NGINX routes `/backend/*` directly to the backend container.

---

## 2. The Typed API Client (`apiRequest`)

Every network call executes through `apiRequest<T>` (`apps/web/src/lib/api-client.ts`):

```typescript
export async function apiRequest<T>(
  path: string,
  options: RequestOptions<T> = {},
): Promise<T> {
  const { method = 'GET', body, token, schema } = options;
  const correlationId = crypto.randomUUID();

  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'x-correlation-id': correlationId,
  };
  if (token) headers['authorization'] = `Bearer ${token}`;
  if (!clerkEnabled && env.NEXT_PUBLIC_DEV_TENANT_ID) {
    headers['x-tenant-id'] = env.NEXT_PUBLIC_DEV_TENANT_ID;
  }

  const response = await fetch(`${env.NEXT_PUBLIC_API_BASE}${path}`, {
    method,
    headers,
    cache: 'no-store',
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  // Boundary runtime validation:
  const data = await response.json();
  return schema ? schema.parse(data) : (data as T);
}
```

### Key Technical Properties
1. **Correlation ID Injection:** Every request generates a unique `x-correlation-id`, which the backend echoes in logs and error bodies.
2. **Strict Zod Boundary Validation:** Passing `schema` validates backend JSON at runtime, ensuring any API schema drift fails immediately at the boundary.
3. **No-Store Caching:** Requests specify `cache: 'no-store'` to prevent stale Express ETag 304 responses with empty bodies.

---

## 3. Binary Media Fetching (`apiRequestBlob`)

Voice note audio playback (`.ogg` / `.mp3`) and client PDF documents use `apiRequestBlob`:
- Bypasses JSON parsing.
- Streams raw binary data into browser memory as a `Blob`.
- Creates a local object URL (`URL.createObjectURL(blob)`) for the HTML5 audio element.
