import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import type { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import type { Request, Response } from 'express';
import type { ActorType } from '../../../generated/prisma/client';
import { RequestContextStore } from '../../../common/context/request-context';
import { AuditService } from '../application/audit.service';

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Global interceptor that appends an audit row for every successful
 * mutating request (FR-AUD-01). Read-only traffic (GET) is not audited —
 * the volume is high and it carries no privileged action.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly audit: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();

    if (!MUTATING.has(req.method)) return next.handle();

    const tenantId = RequestContextStore.tenantId();
    const userId = RequestContextStore.userId();
    const principal = req.principal;

    return next.handle().pipe(
      tap((responseData) => {
        if (!tenantId) return;
        const action = deriveAction(req.method, req.path);

        const entityType = guessEntityType(req.path);
        const entityId = extractEntityId(responseData);

        const entry = {
          actorType: 'USER' as ActorType,
          actorId: userId ?? principal?.userId ?? null,
          action,
          entityType,
          entityId,
          metadata: {
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            userAgent: req.headers['user-agent']?.slice(0, 200) ?? null,
          },
          ip: req.ip ?? null,
          userAgent: req.headers['user-agent']?.slice(0, 200) ?? null,
          correlationId: RequestContextStore.correlationId() ?? null,
        };

        // Fire-and-forget: the audit must not break the response path. A
        // failure here is logged by pino but does not surface to the client.
        void this.audit.record(tenantId, entry).catch(() => {
          // Swallowed — pino context captures any error via the global filter
          // if this re-throws inside the response tap it would 500 the call.
        });
      }),
    );
  }
}

function deriveAction(method: string, path: string): string {
  // /v1/cases/:id/status  ->  cases.status
  const stripped = path.replace(/^\/v1\//, '').replace(/^\//, '');
  const segments = stripped.split('/').filter(Boolean);
  const resource = segments[0] ?? 'unknown';
  if (segments.length === 1) {
    return method === 'POST' ? `${resource}.create` : `${resource}.update`;
  }
  const tail = segments.filter((s) => !isUuidLike(s));
  return tail.length > 1 ? `${resource}.${tail.slice(1).join('.')}` : `${resource}.update`;
}

function guessEntityType(path: string): string | null {
  const segments = path.replace(/^\/v1\//, '').split('/').filter(Boolean);
  return segments[0] ?? null;
}

function extractEntityId(data: unknown): string | null {
  if (data && typeof data === 'object' && 'id' in data) {
    const id = (data as { id: unknown }).id;
    return typeof id === 'string' ? id : null;
  }
  return null;
}

function isUuidLike(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s) || /^[0-9a-f-]{36}$/i.test(s);
}