# Wakeel — Error States & Fault Recovery Specification

**Status:** IMPLEMENTED BASELINE & ERROR HANDLING SPECIFICATION  
**Classification:** Fault Diagnosis, Error Boundaries, Correlation IDs, and Network Recovery  
**Source Code References:** `apps/web/src/app/error.tsx`, `apps/web/src/lib/api-client.ts`, `apps/web/src/components/forbidden-state.tsx`  

---

## 1. Global Error Boundary (`apps/web/src/app/error.tsx`)

Every unhandled React runtime error is caught by the Next.js App Router error boundary:
- **Presentation:** Centered alert card with `AlertTriangle` icon tile in `bg-destructive/10 text-destructive`.
- **Primary Message:** Dignified notice: `"An unexpected system error occurred"`.
- **Action Buttons:**
  - `"Try Again"`: Invokes `reset()` to reload the active route tree without forcing a hard page refresh.
  - `"Return to Overview"`: Direct anchor link back to `/dashboard`.
- **Diagnostics:** Underneath the action buttons, a collapsible technical drawer displays the correlation ID and error message for support debugging.

---

## 2. API Error Contract & Correlation IDs (`ApiError`)

When the backend returns a non-200 response or network fails, `apiRequest` raises an `ApiError`:

```typescript
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
```

### Correlation ID Tracing
1. Every outbound browser fetch automatically generates a unique `x-correlation-id: crypto.randomUUID()`.
2. The backend NestJS `CorrelationMiddleware` attaches this ID to `AsyncLocalStorage` and pino request logs.
3. If an error occurs, the API echoes the correlation ID in the JSON error payload: `{ message, statusCode, correlationId }`.
4. Toast notifications and error cards display the correlation ID with a one-click "Copy for support" action.

---

## 3. Specific Error Scenarios & Recovery Workflows

### 3.1 Network Unreachable / API Down (`status === 0`)
- **Cause:** Local backend container down, internet disconnection, or network timeout.
- **UI Feedback:** Persistent banner at the top of the viewport: `"Network disconnected — attempting to reconnect to Wakeel backend..."`.
- **Behavior:** TanStack Query applies exponential backoff retries with circuit breaker capping.

### 3.2 24-Hour WhatsApp Window Closed (Meta Error 131047)
- **Cause:** Advocate attempted to type a manual text reply after 24 hours elapsed since client's last message.
- **UI Feedback:** Toast error + disabled composer with explanatory badge: `"24h session window closed. Please select an approved WhatsApp template to message this client."`
- **Recovery:** Composer opens the template selector drawer.

### 3.3 Access Forbidden / Unauthorized (`status === 403`)
- **Cause:** Logged-in user lacks necessary local RBAC permission (e.g. Staff trying to modify AI settings).
- **UI Feedback:** `<ForbiddenState>` renders with a clear explanation: `"You do not have permission to view this section. Please contact your firm managing partner."`

### 3.4 Rate Limit Reached (`status === 429`)
- **Cause:** Excessive QR pairing requests or test inbound messages.
- **UI Feedback:** Toast alert displaying cooldown timer: `"Too many requests — please wait 60 seconds before retrying."`
