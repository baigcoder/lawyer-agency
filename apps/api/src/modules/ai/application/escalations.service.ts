import { Injectable, NotFoundException } from '@nestjs/common';
import type { EscalationStatus, EscalationTrigger } from '../../../generated/prisma/client';
import { UnitOfWork } from '../../../common/prisma/unit-of-work';
import { parseHandoffBrief, type HandoffBrief } from './handoff-brief';

export interface EscalationSummary {
  id: string;
  conversationId: string;
  triggerType: EscalationTrigger;
  status: EscalationStatus;
  detectedExcerpt: string | null;
  handoffReason: string | null;
  handoffBrief: HandoffBrief;
  slaDeadline: Date;
  acknowledgedAt: Date | null;
  resolvedAt: Date | null;
  createdAt: Date;
  client: { id: string; name: string | null; waPhone: string };
  assignedTo: { id: string; name: string } | null;
  acknowledgerName: string | null;
  slaBreached: boolean;
}

export interface ListEscalationsQuery {
  status?: EscalationStatus | undefined;
  assigneeUserId?: string | undefined;
  conversationId?: string | undefined;
  limit?: number | undefined;
}

/**
 * Dashboard read/commands for AI-triggered escalations (Phase 7 records,
 * Phase 16 UI). Lists urgent handoffs, supports acknowledge + resolve.
 */
@Injectable()
export class EscalationsService {
  constructor(private readonly uow: UnitOfWork) {}

  async list(tenantId: string, query: ListEscalationsQuery): Promise<EscalationSummary[]> {
    return this.uow.withTenant(tenantId, async (tx) => {
      const rows = await tx.escalation.findMany({
        where: {
          ...(query.status ? { status: query.status } : {}),
          ...(query.conversationId ? { conversationId: query.conversationId } : {}),
          ...(query.assigneeUserId
            ? { conversation: { assignedToId: query.assigneeUserId } }
            : {}),
        },
        include: {
          conversation: {
            include: {
              client: { select: { id: true, name: true, waPhone: true } },
              assignedTo: { select: { id: true, name: true } },
            },
          },
          acknowledger: { include: { user: { select: { name: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        take: query.limit ?? 100,
      });

      const now = Date.now();
      return rows.map((row) => this.toSummary(row, now));
    });
  }

  async acknowledge(tenantId: string, escalationId: string, userId: string | undefined): Promise<EscalationSummary> {
    return this.uow.withTenant(tenantId, async (tx) => {
      const current = await tx.escalation.findFirst({
        where: { id: escalationId },
        include: {
          conversation: {
            include: {
              client: { select: { id: true, name: true, waPhone: true } },
              assignedTo: { select: { id: true, name: true } },
            },
          },
          acknowledger: { include: { user: { select: { name: true } } } },
        },
      });
      if (!current) throw new NotFoundException('escalation not found');
      if (current.status === 'RESOLVED') return this.toSummary(current);

      let lawyerId: string | null = null;
      if (userId) {
        const lawyer = await tx.lawyer.findFirst({ where: { userId }, select: { id: true } });
        lawyerId = lawyer?.id ?? null;
      }

      const updated = await tx.escalation.update({
        where: { id: escalationId },
        data: {
          status: 'ACKNOWLEDGED',
          acknowledgedAt: new Date(),
          ...(lawyerId ? { acknowledgedBy: lawyerId } : {}),
        },
        include: {
          conversation: {
            include: {
              client: { select: { id: true, name: true, waPhone: true } },
              assignedTo: { select: { id: true, name: true } },
            },
          },
          acknowledger: { include: { user: { select: { name: true } } } },
        },
      });

      return this.toSummary(updated);
    });
  }

  async assign(tenantId: string, escalationId: string, assigneeUserId: string | null): Promise<EscalationSummary> {
    return this.uow.withTenant(tenantId, async (tx) => {
      const current = await tx.escalation.findFirst({
        where: { id: escalationId },
        include: {
          conversation: {
            include: {
              client: { select: { id: true, name: true, waPhone: true } },
              assignedTo: { select: { id: true, name: true } },
            },
          },
          acknowledger: { include: { user: { select: { name: true } } } },
        },
      });
      if (!current) throw new NotFoundException('escalation not found');

      if (assigneeUserId) {
        const user = await tx.user.findFirst({ where: { id: assigneeUserId, status: 'ACTIVE' } });
        if (!user) throw new NotFoundException('assignee not found');
      }

      await tx.conversation.update({
        where: { id: current.conversationId },
        data: { assignedToId: assigneeUserId },
      });

      const refreshed = await tx.escalation.findFirst({
        where: { id: escalationId },
        include: {
          conversation: {
            include: {
              client: { select: { id: true, name: true, waPhone: true } },
              assignedTo: { select: { id: true, name: true } },
            },
          },
          acknowledger: { include: { user: { select: { name: true } } } },
        },
      });
      if (!refreshed) throw new NotFoundException('escalation not found');
      return this.toSummary(refreshed);
    });
  }

  async resolve(tenantId: string, escalationId: string): Promise<EscalationSummary> {
    return this.uow.withTenant(tenantId, async (tx) => {
      const current = await tx.escalation.findFirst({ where: { id: escalationId } });
      if (!current) throw new NotFoundException('escalation not found');

      const updated = await tx.escalation.update({
        where: { id: escalationId },
        data: {
          status: 'RESOLVED',
          resolvedAt: new Date(),
        },
        include: {
          conversation: {
            include: {
              client: { select: { id: true, name: true, waPhone: true } },
              assignedTo: { select: { id: true, name: true } },
            },
          },
          acknowledger: { include: { user: { select: { name: true } } } },
        },
      });

      return this.toSummary(updated);
    });
  }

  private toSummary(
    row: {
      id: string;
      conversationId: string;
      triggerType: EscalationTrigger;
      status: EscalationStatus;
      detectedExcerpt: string | null;
      handoffReason?: string | null;
      handoffBrief?: unknown;
      slaDeadline: Date;
      acknowledgedAt: Date | null;
      resolvedAt: Date | null;
      createdAt: Date;
      conversation: {
        client: { id: string; name: string | null; waPhone: string };
        assignedTo: { id: string; name: string } | null;
      };
      acknowledger: { user: { name: string } } | null;
    },
    now = Date.now(),
  ): EscalationSummary {
    return {
      id: row.id,
      conversationId: row.conversationId,
      triggerType: row.triggerType,
      status: row.status,
      detectedExcerpt: row.detectedExcerpt,
      handoffReason: row.handoffReason ?? null,
      handoffBrief: parseHandoffBrief(row.handoffBrief),
      slaDeadline: row.slaDeadline,
      acknowledgedAt: row.acknowledgedAt,
      resolvedAt: row.resolvedAt,
      createdAt: row.createdAt,
      client: row.conversation.client,
      assignedTo: row.conversation.assignedTo,
      acknowledgerName: row.acknowledger?.user.name ?? null,
      slaBreached: row.status === 'OPEN' && row.slaDeadline.getTime() < now,
    };
  }
}
