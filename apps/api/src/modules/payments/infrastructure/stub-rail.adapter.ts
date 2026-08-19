import { Injectable, Logger } from '@nestjs/common';
import type { PaymentRail, RailInitiateResult, RailRequest, RailWebhookPayload } from '../application/ports';

/**
 * Development stand-in for electronic payment rails (JazzCash, Easypaisa,
 * local/international cards). Simulates a redirect flow and parses a simple
 * webhook payload shape so the payment lifecycle can be tested end-to-end
 * without live provider credentials.
 *
 * Production adapters implement PaymentRail and talk to the real providers.
 */
@Injectable()
export class StubRailAdapter implements PaymentRail {
  readonly method = 'STUB_ELECTRONIC';
  private readonly logger = new Logger(StubRailAdapter.name);

  async initiate(request: RailRequest): Promise<RailInitiateResult> {
    const providerTxnId = `stub-${request.paymentId}`;
    this.logger.log({ paymentId: request.paymentId, amount: request.amountCents }, 'Stub rail initiated');
    return {
      providerTxnId,
      redirectUrl: `${request.returnUrl}?providerTxnId=${providerTxnId}&status=pending`,
      completed: false,
    };
  }

  parseWebhook(payload: unknown): RailWebhookPayload | null {
    if (typeof payload !== 'object' || payload === null) return null;
    const p = payload as Record<string, unknown>;
    if (typeof p.providerTxnId !== 'string') return null;
    const status = p.status === 'SUCCESS' ? 'SUCCESS' : p.status === 'FAILURE' ? 'FAILURE' : 'PENDING';
    return {
      providerTxnId: p.providerTxnId,
      status,
      paidAt: typeof p.paidAt === 'string' ? p.paidAt : undefined,
      amountCents: typeof p.amountCents === 'number' ? p.amountCents : undefined,
      metadata: typeof p.metadata === 'object' && p.metadata !== null ? (p.metadata as Record<string, unknown>) : undefined,
    };
  }
}
