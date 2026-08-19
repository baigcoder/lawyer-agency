import { Injectable } from '@nestjs/common';
import { CryptoService } from '../../../common/crypto/crypto.service';
import { UnitOfWork } from '../../../common/prisma/unit-of-work';
import {
  emptyPaymentDetails,
  paymentDetailsSchema,
  type PaymentDetails,
  type PaymentDetailsInput,
} from './payment-details.dto';

/**
 * Encrypted firm payment receiving details (D-110). Stored AES-256-GCM at rest.
 */
@Injectable()
export class PaymentDetailsService {
  constructor(
    private readonly uow: UnitOfWork,
    private readonly crypto: CryptoService,
  ) {}

  async get(tenantId: string): Promise<PaymentDetails> {
    return this.uow.withTenant(tenantId, async (tx) => {
      const row = await tx.firmPaymentDetails.findUnique({ where: { tenantId } });
      if (!row) return emptyPaymentDetails();
      return this.decrypt(row.detailsEnc);
    });
  }

  async update(tenantId: string, input: PaymentDetailsInput): Promise<PaymentDetails> {
    const parsed = paymentDetailsSchema.parse(input);
    const enc = this.crypto.encrypt(JSON.stringify(parsed));

    return this.uow.withTenant(tenantId, async (tx) => {
      await tx.firmPaymentDetails.upsert({
        where: { tenantId },
        create: { tenantId, detailsEnc: enc },
        update: { detailsEnc: enc },
      });
      return parsed;
    });
  }

  /** Used by payment-fee WhatsApp handler (worker). */
  async getDecrypted(tenantId: string): Promise<PaymentDetails> {
    return this.get(tenantId);
  }

  private decrypt(enc: string): PaymentDetails {
    try {
      const raw = JSON.parse(this.crypto.decrypt(enc)) as unknown;
      const parsed = paymentDetailsSchema.safeParse(raw);
      return parsed.success ? { ...emptyPaymentDetails(), ...parsed.data } : emptyPaymentDetails();
    } catch {
      return emptyPaymentDetails();
    }
  }
}
