import { Module, type DynamicModule } from '@nestjs/common';
import { MessagesModule } from '../messages/messages.module';
import { UsersModule } from '../users/users.module';
import { CasesModule } from '../cases/cases.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { WhatsappPortsModule } from '../whatsapp/whatsapp-ports.module';
import { AuditModule } from '../audit/audit.module';
import { InboxService } from './application/inbox.service';
import { InboxController } from './interface/inbox.controller';
import { QuickRepliesService } from './application/quick-replies.service';
import { QuickRepliesController } from './interface/quick-replies.controller';

/**
 * Inbox dashboard module (Phase 11, D-018).
 * Read model + handoff commands for conversations. Imports Messages (domain
 * owner), Users (assignee lookup), and WhatsApp (outbound send path).
 */
@Module({})
export class InboxModule {
  static register(role: 'api' | 'worker'): DynamicModule {
    return {
      module: InboxModule,
      imports: [MessagesModule, UsersModule, CasesModule.register(role), WhatsappModule.register(role), WhatsappPortsModule, AuditModule],
      controllers: [InboxController, QuickRepliesController],
      providers: [InboxService, QuickRepliesService],
      exports: [InboxService],
    };
  }
}
