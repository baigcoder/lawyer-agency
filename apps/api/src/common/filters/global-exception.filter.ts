import {
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import type { Response } from 'express';
import { RequestContextStore } from '../context/request-context';
import { DomainError } from '../errors/domain-error';

/**
 * Last line of defense: consistent error shape, correlation id on every
 * error response (ADR-005), and no internal detail leakage for 5xx (OWASP).
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    const correlationId = RequestContextStore.correlationId() ?? null;

    const isHttp = exception instanceof HttpException;
    // DomainError carries its own HTTP mapping — the filter stays
    // module-agnostic (common never imports module code).
    const isDomain = exception instanceof DomainError;
    const status = isHttp
      ? exception.getStatus()
      : isDomain
        ? exception.httpStatus
        : HttpStatus.INTERNAL_SERVER_ERROR;
    const message = isHttp || isDomain ? exception.message : 'Internal server error';

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        { err: exception, correlationId },
        'unhandled exception',
      );
      // Only 5xx are bugs worth paging on; 4xx are the client's mistake.
      // Tags are identifiers only (D-005) — never request bodies.
      Sentry.withScope((scope) => {
        if (correlationId) scope.setTag('correlation_id', correlationId);
        const tenantId = RequestContextStore.tenantId();
        if (tenantId) scope.setTag('tenant_id', tenantId);
        Sentry.captureException(exception);
      });
    }

    // Preserve structured 4xx bodies (e.g. zod issue lists) — clients need
    // them; 5xx stays opaque.
    const detail =
      isHttp && status < HttpStatus.INTERNAL_SERVER_ERROR
        ? exception.getResponse()
        : null;
    res.status(status).json({
      statusCode: status,
      message,
      ...(typeof detail === 'object' && detail !== null ? detail : {}),
      correlationId,
    });
  }
}
