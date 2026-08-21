import { Module, type DynamicModule } from '@nestjs/common';
import { PaymentsService } from './application/payments.service';
import { RailFactory } from './application/rail.factory';
import { PaymentsController } from './interface/payments.controller';
import { PaymentFeeMessageHandler, createPaymentFeeHandlers } from './application/payment-fee-message.handler';
import { PaymentInstructionService } from './application/payment-instruction.service';
import { PaymentReceiptHandler, createPaymentReceiptHandlers } from './application/payment-receipt.handler';
import { FirmProfileModule } from '../firm-profile/firm-profile.module';
import { WhatsappPortsModule } from '../whatsapp/whatsapp-ports.module';
import { DocumentsModule } from '../documents/documents.module';
import { AppointmentsModule } from '../appointments/appointments.module';
import { StubRailAdapter } from './infrastructure/stub-rail.adapter';
import { PAYMENT_RAILS } from './application/ports';

/**
 * Payments — PaymentPort with JazzCash/Easypaisa/card/intl rails + manual
 * recording (D-008); rail-webhook idempotency via providerTxnId (FR-PAY-02).
 * Owns: payments. Publishes: payment.requested/proof_received/succeeded/failed/refunded.
 * RailFactory (D-096) is the only method→rail resolver and enforces the
 * PAYMENTS_ELECTRONIC_ENABLED legal gate, fail-closed.
 */
@Module({})
export class PaymentsModule {
  static register(role: 'api' | 'worker'): DynamicModule {
    return {
      module: PaymentsModule,
      imports: [
        FirmProfileModule,
        WhatsappPortsModule,
        AppointmentsModule,
        ...(role === 'worker' ? [DocumentsModule.register('worker')] : []),
      ],
      controllers: role === 'api' ? [PaymentsController] : [],
      providers: [
        PaymentsService,
        PaymentInstructionService,
        RailFactory,
        StubRailAdapter,
        {
          provide: PAYMENT_RAILS,
          useFactory: (stub: StubRailAdapter) => [stub],
          inject: [StubRailAdapter],
        },
        ...(role === 'worker' ? [PaymentFeeMessageHandler, PaymentReceiptHandler] : []),
      ],
      exports: [
        PaymentsService,
        PaymentInstructionService,
        ...(role === 'worker' ? [PaymentFeeMessageHandler, PaymentReceiptHandler] : []),
      ],
    };
  }
}

export { createPaymentFeeHandlers, createPaymentReceiptHandlers };
