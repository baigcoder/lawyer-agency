import { DomainError } from '../../../common/errors/domain-error';

export class InvalidWebhookSignatureError extends DomainError {
  readonly httpStatus = 401;
  constructor() {
    super('Invalid webhook signature');
    this.name = 'InvalidWebhookSignatureError';
  }
}

export class UnknownPhoneNumberError extends DomainError {
  readonly httpStatus = 404;
  constructor(phoneNumberId: string) {
    super(`No tenant route for phone_number_id ${phoneNumberId}`);
    this.name = 'UnknownPhoneNumberError';
  }
}

/** Evolution API transport failure. */
export class EvolutionApiError extends DomainError {
  readonly httpStatus = 502;
  readonly nonRetryable: boolean;
  constructor(message: string, nonRetryable = false) {
    super(`Evolution API error: ${message}`);
    this.name = 'EvolutionApiError';
    this.nonRetryable = nonRetryable;
  }
}

/**
 * Permanent recipient/transport failures (invalid or non-existent WhatsApp
 * number, unknown instance). Retrying cannot succeed and each retry re-runs
 * the full AI pipeline, so mark them non-retryable (D-015 retry budget).
 */
export class NonRetryableSendError extends DomainError {
  readonly httpStatus = 502;
  readonly nonRetryable = true;
  constructor(message: string) {
    super(message);
    this.name = 'NonRetryableSendError';
  }
}

export class TenantCredentialsMissingError extends DomainError {
  readonly httpStatus = 503;
  constructor(tenantId: string) {
    super(`WhatsApp credentials not configured for tenant ${tenantId}`);
    this.name = 'TenantCredentialsMissingError';
  }
}

export class ConversationNotFoundError extends DomainError {
  readonly httpStatus = 404;
  constructor(conversationId: string) {
    super(`Conversation not found: ${conversationId}`);
    this.name = 'ConversationNotFoundError';
  }
}

export class TemplateNotApprovedError extends DomainError {
  readonly httpStatus = 422;
  constructor(templateName: string) {
    super(`Template is not approved for sending: ${templateName}`);
    this.name = 'TemplateNotApprovedError';
  }
}

/** Meta Graph API failure with its error code preserved for mapping. */
export class MetaApiError extends DomainError {
  readonly httpStatus = 502;
  constructor(
    public readonly metaCode: number | null,
    message: string,
  ) {
    super(`Meta API error${metaCode === null ? '' : ` ${metaCode}`}: ${message}`);
    this.name = 'MetaApiError';
  }
}

/** Pilot allowlist exceeded PILOT_MAX_ALLOWLIST (A9) — 422, not a 500. */
export class PilotAllowlistTooLargeError extends DomainError {
  readonly httpStatus = 422;
  constructor(max: number, requested: number) {
    super(`Allowlist of ${requested} exceeds the pilot limit of ${max}`);
    this.name = 'PilotAllowlistTooLargeError';
  }
}

/** Test inbound attempted from a number that is not in the pilot allowlist. */
export class PilotNumberNotAllowlistedError extends DomainError {
  readonly httpStatus = 422;
  constructor() {
    super('Number is not in the pilot allowlist — add it first');
    this.name = 'PilotNumberNotAllowlistedError';
  }
}
