import { DomainError } from '../../../common/errors/domain-error';

/**
 * Raised when an electronic payment method is requested while the payments
 * legal gate is closed (PAYMENTS_ELECTRONIC_ENABLED unset) or the tenant has
 * no rail credentials for that method (D-096). Fail-closed: staff can always
 * fall back to manual rails (BANK_TRANSFER / CASH / OTHER_MANUAL).
 */
export class RailUnavailableError extends DomainError {
  readonly httpStatus = 409;
  constructor(method: string, reason: string) {
    super(
      `Electronic payments via ${method} are unavailable: ${reason}. ` +
        'Record the payment manually (bank transfer, cash, or other) until the rail is enabled.',
    );
    this.name = 'RailUnavailableError';
  }
}
