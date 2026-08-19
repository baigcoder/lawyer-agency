import { Inject, Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job, Queue } from 'bullmq';
import { UnitOfWork } from '../../../common/prisma/unit-of-work';
import { HEARING_REMINDER_JOB, QUEUES } from '../../../common/queue/queue.constants';
import { SendService } from '../../whatsapp/application/send.service';
import { WindowClosedError } from '../../../common/messaging/window-policy';
import { NotificationsService } from '../../notifications/application/notifications.service';

/**
 * Sends dashboard + WhatsApp reminders 24h before court hearings (D-111).
 */
@Processor(QUEUES.NOTIFICATIONS, { concurrency: 1 })
@Injectable()
export class HearingReminderMonitor extends WorkerHost implements OnApplicationBootstrap {
  private readonly logger = new Logger(HearingReminderMonitor.name);

  constructor(
    private readonly uow: UnitOfWork,
    private readonly send: SendService,
    private readonly notifications: NotificationsService,
    @InjectQueue(QUEUES.NOTIFICATIONS) private readonly queue: Queue,
  ) {
    super();
  }

  async process(job: Job): Promise<{ reminded: number }> {
    if (job.name !== HEARING_REMINDER_JOB) return { reminded: 0 };

    const now = new Date();
    const windowStart = new Date(now.getTime() + 23 * 60 * 60 * 1000);
    const windowEnd = new Date(now.getTime() + 25 * 60 * 60 * 1000);
    let reminded = 0;

    const due = await this.uow.withPlatform(async (tx) =>
      tx.$queryRaw<
        Array<{ id: string; tenantId: string; caseId: string; courtName: string; hearingAt: Date; location: string | null }>
      >`
        SELECT id, "tenantId", "caseId", "courtName", "hearingAt", location
        FROM app.court_hearings
        WHERE "reminderSentAt" IS NULL
          AND "hearingAt" >= ${windowStart}
          AND "hearingAt" <= ${windowEnd}
      `,
    );

    for (const hearing of due) {
      await this.remind(hearing);
      reminded += 1;
    }

    if (reminded > 0) {
      this.logger.log({ reminded }, 'hearing reminders sent');
    }
    return { reminded };
  }

  private async remind(hearing: {
    id: string;
    tenantId: string;
    caseId: string;
    courtName: string;
    hearingAt: Date;
    location: string | null;
  }): Promise<void> {
    const ctx = await this.uow.withTenant(hearing.tenantId, async (tx) => {
      const caseRow = await tx.case.findFirst({
        where: { id: hearing.caseId },
        include: { client: true },
      });
      const conversation = caseRow
        ? await tx.conversation.findFirst({
            where: { caseId: hearing.caseId },
            orderBy: { updatedAt: 'desc' },
          })
        : null;
      const users = await tx.user.findMany({
        where: { tenantId: hearing.tenantId, status: 'ACTIVE' },
        select: { id: true },
      });
      return { caseRow, conversation, userIds: users.map((u) => u.id) };
    });

    const when = hearing.hearingAt.toLocaleString('en-PK', { timeZone: 'Asia/Karachi' });
    const location = hearing.location ? ` at ${hearing.location}` : '';

    await this.notifications.createForUsers(
      hearing.tenantId,
      ctx.userIds,
      'hearing.reminder',
      {
        hearingId: hearing.id,
        caseId: hearing.caseId,
        courtName: hearing.courtName,
        hearingAt: hearing.hearingAt.toISOString(),
      },
    );

    if (ctx.conversation && ctx.caseRow) {
      const body = `Reminder: Your court hearing for case ${ctx.caseRow.reference} is tomorrow (${when}) at ${hearing.courtName}${location}.`;
      try {
        await this.send.send(hearing.tenantId, {
          kind: 'text',
          conversationId: ctx.conversation.id,
          toWaPhone: ctx.caseRow.client.waPhone,
          senderType: 'SYSTEM',
          body,
        });
      } catch (error) {
        if (!(error instanceof WindowClosedError)) throw error;
      }
    }

    await this.uow.withTenant(hearing.tenantId, async (tx) => {
      await tx.courtHearing.update({
        where: { id: hearing.id },
        data: { reminderSentAt: new Date() },
      });
    });
  }

  async onApplicationBootstrap(): Promise<void> {
    await this.queue.upsertJobScheduler(HEARING_REMINDER_JOB, { every: 15 * 60_000 }, {
      name: HEARING_REMINDER_JOB,
      data: {},
    });
  }
}
