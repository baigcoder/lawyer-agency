import { Module, type DynamicModule } from '@nestjs/common';
import { MessagesModule } from '../messages/messages.module';
import { DocumentsModule } from '../documents/documents.module';
import { PaymentsModule } from '../payments/payments.module';
import { VoiceModule } from '../voice/voice.module';
import { InboundMessageProcessor } from './interface/inbound.processor';
import { WhatsappPortsModule } from './whatsapp-ports.module';
import { WhatsappWorkerBootstrap } from './whatsapp-worker.bootstrap';

/**
 * Worker-only WhatsApp consumers (D-013). Dynamic register() avoids evaluating
 * PaymentsModule.register('worker') at import time when the API role loads this file.
 */
@Module({})
export class WhatsappWorkerModule {
  static register(): DynamicModule {
    return {
      module: WhatsappWorkerModule,
      imports: [
        MessagesModule,
        DocumentsModule.register('worker'),
        PaymentsModule.register('worker'),
        WhatsappPortsModule,
        VoiceModule.register('worker'),
      ],
      providers: [InboundMessageProcessor, WhatsappWorkerBootstrap],
      exports: [],
    };
  }
}
