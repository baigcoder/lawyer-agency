import { Injectable, type NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { RequestContextStore } from '../context/request-context';

const SAFE_ID = /^[\w-]{1,128}$/;

/**
 * Establishes the correlation id for every inbound request: trusts the
 * client-supplied header only if it matches a strict charset (it flows into
 * logs and downstream headers — no arbitrary bytes), otherwise mints one.
 */
@Injectable()
export class CorrelationMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const incoming = req.headers['x-correlation-id'];
    const correlationId =
      typeof incoming === 'string' && SAFE_ID.test(incoming) ? incoming : randomUUID();

    // Write back so downstream middleware (pino-http genReqId) sees one value.
    req.headers['x-correlation-id'] = correlationId;
    res.setHeader('x-correlation-id', correlationId);

    RequestContextStore.run({ correlationId }, () => next());
  }
}
