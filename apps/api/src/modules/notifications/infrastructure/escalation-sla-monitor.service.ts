import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import type { Queue } from 'bullmq';
import { UnitOfWork } from '../../../common/prisma/unit-of-work';
import { ESCALATION_SLA_MONITOR_JOB, QUEUES } from '../../../common/queue/queue.constants';
import { NotificationsService } from '../application/notifications.service';

/**
 * Periodic SLA monitor for open escalations (Phase 9). Runs on the worker
 * role once per minute, finds escalations whose SLA deadline has passed and
 * that are neither acknowledged nor resolved, and creates dashboard
 * notifications for the firm's active users.
 *
 * Real-time alerting (push/SMS/WhatsApp template) lands in Phase 16.
 */
@Processor(QUEUES.NOTIFICATIONS, { concurrency: 1 })
@Injectable()
@Processor(QUEUES.NOTIFICATIONS, { concurrency: 1 })
export class EscalationSlaMonitor extends WorkerHost implements OnApplicationBootstrap {
  private readonly logger = new Logger(EscalationSlaMonitor.name);

  constructor(
    private readonly uow: UnitOfWork,
    private readonly notifications: NotificationsService,
    @InjectQueue(QUEUES.NOTIFICATIONS) private readonly queue: Queue,
  ) {
    super();
  }

  async process(): Promise<{ notified: number }> {
    const now = new Date();
    let notified = 0;

    // Find all tenants with open, breached escalations.
    const breaches = await this.uow.withPlatform(async (tx) => {
      return tx.$queryRaw<
        Array<{ tenantId: string; escalationId: string; conversationId: string; minutesOverdue: number }>
      >`
        SELECT "tenantId", id as "escalationId", "conversationId",
               EXTRACT(EPOCH FROM (now() - "slaDeadline")) / 60 as "minutesOverdue"
        FROM app.escalations
        WHERE "acknowledgedAt" IS NULL
          AND "resolvedAt" IS NULL
          AND "slaDeadline" < ${now}`;
    });

    for (const breach of breaches) {
      const userIds = await this.activeUserIds(breach.tenantId);
      await this.notifications.createForUsers(
        breach.tenantId,
        userIds,
        'escalation.sla_breached',
        {
          escalationId: breach.escalationId,
          conversationId: breach.conversationId,
          minutesOverdue: Math.round(breach.minutesOverdue),
        },
      );
      notified++;
    }

    if (notified > 0) {
      this.logger.warn({ notified }, 'SLA breach notifications created');
    }
    return { notified };
  }

  async onApplicationBootstrap(): Promise<void> {
    await this.queue.upsertJobScheduler(ESCALATION_SLA_MONITOR_JOB, { every: 60_000 }, {
      name: ESCALATION_SLA_MONITOR_JOB,
      data: {},
    });
  }

  private async activeUserIds(tenantId: string): Promise<string[]> {
    return this.uow.withTenant(tenantId, async (tx) => {
      const users = await tx.user.findMany({
        where: { tenantId, status: { not: 'INVITED' } },
        select: { id: true },
      });
      return users.map((u) => u.id);
    });
  }
}
