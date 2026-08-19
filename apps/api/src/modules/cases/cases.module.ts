import { Module, type DynamicModule } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QUEUES } from '../../common/queue/queue.constants';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CasesService } from './application/cases.service';
import { HearingsService } from './application/hearings.service';
import { CaseAutoCreateHandler } from './application/case-auto-create.handler';
import { CASE_REPOSITORY } from './application/ports';
import { PrismaCaseRepository } from './infrastructure/prisma-case.repository';
import { HearingReminderMonitor } from './infrastructure/hearing-reminder.monitor';
import { CasesController } from './interface/cases.controller';

@Module({})
export class CasesModule {
  static register(role: 'api' | 'worker'): DynamicModule {
    return {
      module: CasesModule,
      imports:
        role === 'worker'
          ? [
              BullModule.registerQueue({ name: QUEUES.NOTIFICATIONS }),
              WhatsappModule.register('worker'),
              NotificationsModule.register('worker'),
            ]
          : [],
      controllers: [CasesController],
      providers: [
        CasesService,
        HearingsService,
        CaseAutoCreateHandler,
        { provide: CASE_REPOSITORY, useClass: PrismaCaseRepository },
        ...(role === 'worker' ? [HearingReminderMonitor] : []),
      ],
      exports: [CasesService, HearingsService, CaseAutoCreateHandler],
    };
  }
}
