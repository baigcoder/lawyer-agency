export interface RailRequest {
  paymentId: string;
  tenantId: string;
  caseId?: string | undefined;
  clientId: string;
  amountCents: number;
  currency: string;
  description?: string | undefined;
  returnUrl: string;
}

export interface RailInitiateResult {
  /** Provider transaction id used for webhook idempotency. */
  providerTxnId?: string | undefined;
  /** URL to redirect the client to for payment completion. */
  redirectUrl?: string | undefined;
  /** True if the rail completed synchronously (e.g. manual recording). */
  completed: boolean;
  /** Human-readable message for failed synchronous completion. */
  message?: string | undefined;
}

export interface RailWebhookPayload {
  providerTxnId: string;
  status: 'SUCCESS' | 'FAILURE' | 'PENDING';
  paidAt?: string | undefined;
  amountCents?: number | undefined;
  metadata?: Record<string, unknown> | undefined;
}

export interface PaymentRail {
  readonly method: string;
  initiate(request: RailRequest): Promise<RailInitiateResult>;
  parseWebhook(payload: unknown): RailWebhookPayload | null;
}

export const PAYMENT_RAILS = Symbol('PAYMENT_RAILS');
