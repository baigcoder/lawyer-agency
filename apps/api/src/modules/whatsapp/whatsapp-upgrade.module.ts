import { Module, type DynamicModule } from '@nestjs/common';
import { PaymentsModule } from '../payments/payments.module';
import { WhatsappUpgradeService } from './application/whatsapp-upgrade.service';
import { WhatsappUpgradeEventHandler } from './application/whatsapp-upgrade-event.handler';

/**
 * Official WhatsApp upgrade flow — isolated from WhatsappModule to avoid a
 * circular dependency with PaymentsModule (upgrade needs PaymentsService;
 * Payments worker needs SendService from WhatsappPortsModule only).
 */
@Module({})
export class WhatsappUpgradeModule {
  static register(role: 'api' | 'worker'): DynamicModule {
    return {
      module: WhatsappUpgradeModule,
      imports: [PaymentsModule.register(role)],
      providers: [WhatsappUpgradeService, WhatsappUpgradeEventHandler],
      exports: [WhatsappUpgradeService, WhatsappUpgradeEventHandler],
    };
  }
}
