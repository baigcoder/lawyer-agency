import * as Sentry from '@sentry/nestjs';

/**
 * Error tracking (D-016). Imported first in main.ts so Sentry can hook into
 * Node before Nest loads. Reads process.env directly: it runs before
 * ConfigModule validates config. Without SENTRY_DSN nothing is initialised
 * and every Sentry call elsewhere is a no-op.
 *
 * Events may carry T1/T2 data only (D-005): identifiers, statuses, stack
 * traces. Request bodies, query strings, cookies and auth headers can hold
 * client messages, documents or credentials, so they are stripped before an
 * event leaves the process, and console breadcrumbs (which can echo message
 * text) are dropped.
 */
const dsn = process.env['SENTRY_DSN'];

const SAFE_HEADERS = new Set(['user-agent', 'content-type', 'content-length', 'x-correlation-id']);

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env['NODE_ENV'] ?? 'development',
    release: process.env['SENTRY_RELEASE'],
    serverName: process.env['API_ROLE'] ?? 'api',
    // Collect nothing that can hold client content; beforeSend re-checks.
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: { allow: [...SAFE_HEADERS] },
      httpBodies: [],
      urlQueryParams: false,
    },
    // Errors only; tracing stays with OTel.
    tracesSampleRate: 0,
    beforeBreadcrumb: (breadcrumb) => (breadcrumb.category === 'console' ? null : breadcrumb),
    beforeSend: (event) => {
      if (event.request) {
        delete event.request.data;
        delete event.request.cookies;
        delete event.request.query_string;
        const headers = event.request.headers ?? {};
        event.request.headers = Object.fromEntries(
          Object.entries(headers).filter(([name]) => SAFE_HEADERS.has(name.toLowerCase())),
        );
      }
      delete event.user;
      return event;
    },
  });
}
