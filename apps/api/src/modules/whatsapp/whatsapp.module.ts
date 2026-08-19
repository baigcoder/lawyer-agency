import { Module, type DynamicModule } from '@nestjs/common';
import { MessagesModule } from '../messages/messages.module';
import { DocumentsModule } from '../documents/documents.module';
import { EvolutionConnectionService } from './application/evolution-connection.service';
import { EvolutionWebhookIngestService } from './application/evolution-webhook-ingest.service';
import { EvolutionQrStore } from './application/evolution-qr.store';
import { EvolutionWebhookController } from './interface/evolution-webhooks.controller';
import { EvolutionConnectionController } from './interface/evolution-connection.controller';
import { WhatsappPortsModule } from './whatsapp-ports.module';
import { WhatsappUpgradeModule } from './whatsapp-upgrade.module';

/**
 * WhatsApp — now backed by Evolution API: a single instance per tenant handles
 * both Baileys (free/QR) and Cloud API (official/Meta) transports.
 * SendService lives in WhatsappPortsModule (shared, no Payments dep).
 * Upgrade flow lives in WhatsappUpgradeModule (imports Payments only).
 */
@Module({})
export class WhatsappModule {
  static register(role: 'api' | 'worker'): DynamicModule {
    return {
      module: WhatsappModule,
      imports: [MessagesModule, DocumentsModule.register(role), WhatsappPortsModule, WhatsappUpgradeModule.register(role)],
      controllers: [
        EvolutionWebhookController,
        EvolutionConnectionController,
      ],
      providers: [
        EvolutionWebhookIngestService,
        EvolutionQrStore,
        EvolutionConnectionService,
      ],
      exports: [EvolutionConnectionService, WhatsappPortsModule, WhatsappUpgradeModule.register(role)],
    };
  }
}
