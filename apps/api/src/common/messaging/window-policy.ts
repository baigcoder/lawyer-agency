import { DomainError } from '../errors/domain-error';

/**
 * The 24-hour session window (D-003), as a pure policy function.
 * WhatsApp allows free-form sends only within 24h of the client's last
 * inbound message; anything later must be an approved template. The send
 * path BLOCKS out-of-window free-form sends rather than letting Meta reject
 * them — a designed-in failure would look like a bug every time it fires.
 */

export type SendMode = 'FREEFORM' | 'TEMPLATE_REQUIRED';

export class WindowClosedError extends DomainError {
  readonly httpStatus = 422;
  constructor() {
    super('24h session window is closed — an approved template is required (D-003)');
    this.name = 'WindowClosedError';
  }
}

export function resolveSendMode(sessionWindowExpiresAt: Date | null, now: Date): SendMode {
  if (sessionWindowExpiresAt === null) return 'TEMPLATE_REQUIRED';
  return sessionWindowExpiresAt.getTime() > now.getTime() ? 'FREEFORM' : 'TEMPLATE_REQUIRED';
}

/** The window opens/rolls from the client's last inbound message. */
export function rollSessionWindow(lastInboundAt: Date): Date {
  return new Date(lastInboundAt.getTime() + 24 * 60 * 60 * 1000);
}
