import { Injectable } from '@nestjs/common';
import { UnitOfWork } from '../../../common/prisma/unit-of-work';

export interface DashboardMetrics {
  newLeads7d: number;
  aiContainmentRate: number | null;
  escalations7d: number;
  casesOpened7d: number;
  casesClosed7d: number;
  feesCollectedCents30d: number;
  /** Mean minutes from escalation created → acknowledged in the last 7 days. */
  avgEscalationAckMinutes7d: number | null;
}

export interface DailySeriesPoint {
  date: string; // YYYY-MM-DD
  newConversations: number;
  aiHandled: number;
  humanHandled: number;
  escalations: number;
  casesOpened: number;
  casesClosed: number;
  paymentsCents: number;
}

const SUCCESSFUL_PAYMENT_STATUSES = ['SUCCEEDED', 'RECORDED_MANUAL'] as const;
const HUMAN_SENDER_TYPES = ['LAWYER', 'STAFF'] as const;

/**
 * Analytics read service. Dashboard and daily series query tenant-scoped
 * operational tables for live, accurate metrics (D-113). Event projections in
 * `analytics_daily` remain for async enrichment but are not the dashboard read path.
 */
@Injectable()
export class AnalyticsService {
  constructor(private readonly uow: UnitOfWork) {}

  async dashboard(tenantId: string): Promise<DashboardMetrics> {
    const now = new Date();
    const sevenDaysAgo = this.startOfDay(this.addDays(now, -7));
    const thirtyDaysAgo = this.startOfDay(this.addDays(now, -30));
    const endExclusive = this.addDays(this.startOfDay(now), 1);
    const window7 = { gte: sevenDaysAgo, lt: endExclusive };
    const window30 = { gte: thirtyDaysAgo, lt: endExclusive };

    return this.uow.withTenant(tenantId, async (tx) => {
      const [
        newLeads7d,
        escalations7d,
        casesOpened7d,
        casesClosed7d,
        aiOutbound7d,
        humanOutbound7d,
        payments30d,
        acknowledged7d,
      ] = await Promise.all([
        tx.conversation.count({ where: { createdAt: window7 } }),
        tx.escalation.count({ where: { createdAt: window7 } }),
        tx.case.count({ where: { openedAt: window7 } }),
        tx.case.count({ where: { closedAt: window7 } }),
        tx.message.count({
          where: { direction: 'OUTBOUND', senderType: 'AI', createdAt: window7 },
        }),
        tx.message.count({
          where: {
            direction: 'OUTBOUND',
            senderType: { in: [...HUMAN_SENDER_TYPES] },
            createdAt: window7,
          },
        }),
        tx.payment.aggregate({
          where: {
            status: { in: [...SUCCESSFUL_PAYMENT_STATUSES] },
            paidAt: window30,
          },
          _sum: { amountCents: true },
        }),
        tx.escalation.findMany({
          where: { acknowledgedAt: window7 },
          select: { createdAt: true, acknowledgedAt: true },
        }),
      ]);

      const totalHandled = aiOutbound7d + humanOutbound7d;
      const ackMinutes = acknowledged7d
        .filter((row): row is { createdAt: Date; acknowledgedAt: Date } => row.acknowledgedAt !== null)
        .map((row) => (row.acknowledgedAt.getTime() - row.createdAt.getTime()) / 60_000);
      const avgEscalationAckMinutes7d =
        ackMinutes.length > 0
          ? Math.round(ackMinutes.reduce((sum, n) => sum + n, 0) / ackMinutes.length)
          : null;

      return {
        newLeads7d,
        aiContainmentRate: totalHandled > 0 ? aiOutbound7d / totalHandled : null,
        escalations7d,
        casesOpened7d,
        casesClosed7d,
        feesCollectedCents30d: payments30d._sum.amountCents ?? 0,
        avgEscalationAckMinutes7d,
      };
    });
  }

  /**
   * Daily series for the analytics page. Zero-filled across the whole window
   * (days without activity still render) and oldest-first.
   */
  async daily(tenantId: string, days: number): Promise<DailySeriesPoint[]> {
    const today = this.startOfDay(new Date());
    const from = this.addDays(today, -(days - 1));
    const endExclusive = this.addDays(today, 1);
    const window = { gte: from, lt: endExclusive };

    const buckets = await this.uow.withTenant(tenantId, async (tx) => {
      const [
        conversations,
        aiMessages,
        humanMessages,
        escalations,
        casesOpened,
        casesClosed,
        payments,
      ] = await Promise.all([
        tx.conversation.findMany({
          where: { createdAt: window },
          select: { createdAt: true },
        }),
        tx.message.findMany({
          where: { direction: 'OUTBOUND', senderType: 'AI', createdAt: window },
          select: { createdAt: true },
        }),
        tx.message.findMany({
          where: {
            direction: 'OUTBOUND',
            senderType: { in: [...HUMAN_SENDER_TYPES] },
            createdAt: window,
          },
          select: { createdAt: true },
        }),
        tx.escalation.findMany({
          where: { createdAt: window },
          select: { createdAt: true },
        }),
        tx.case.findMany({
          where: { openedAt: window },
          select: { openedAt: true },
        }),
        tx.case.findMany({
          where: { closedAt: window },
          select: { closedAt: true },
        }),
        tx.payment.findMany({
          where: {
            status: { in: [...SUCCESSFUL_PAYMENT_STATUSES] },
            paidAt: window,
          },
          select: { paidAt: true, amountCents: true },
        }),
      ]);

      return {
        newConversations: this.countByDate(conversations.map((c) => c.createdAt)),
        aiHandled: this.countByDate(aiMessages.map((m) => m.createdAt)),
        humanHandled: this.countByDate(humanMessages.map((m) => m.createdAt)),
        escalations: this.countByDate(escalations.map((e) => e.createdAt)),
        casesOpened: this.countByDate(casesOpened.map((c) => c.openedAt)),
        casesClosed: this.countByDate(
          casesClosed.flatMap((c) => (c.closedAt ? [c.closedAt] : [])),
        ),
        paymentsCents: this.sumCentsByDate(
          payments.flatMap((p) =>
            p.paidAt ? [{ paidAt: p.paidAt, amountCents: p.amountCents }] : [],
          ),
        ),
      };
    });

    const series: DailySeriesPoint[] = [];
    for (let i = 0; i < days; i += 1) {
      const d = this.addDays(from, i).toISOString().slice(0, 10);
      series.push({
        date: d,
        newConversations: buckets.newConversations.get(d) ?? 0,
        aiHandled: buckets.aiHandled.get(d) ?? 0,
        humanHandled: buckets.humanHandled.get(d) ?? 0,
        escalations: buckets.escalations.get(d) ?? 0,
        casesOpened: buckets.casesOpened.get(d) ?? 0,
        casesClosed: buckets.casesClosed.get(d) ?? 0,
        paymentsCents: buckets.paymentsCents.get(d) ?? 0,
      });
    }
    return series;
  }

  /** Conversion funnel: chats → cases → paid (D-113, tenant-scoped operational read). */
  async funnel(tenantId: string): Promise<{ conversations: number; cases: number; paidClients: number }> {
    return this.uow.withTenant(tenantId, async (tx) => {
      const [conversations, cases, paidClients] = await Promise.all([
        tx.conversation.count(),
        tx.case.count({ where: { status: { not: 'ARCHIVED' } } }),
        tx.payment.groupBy({
          by: ['clientId'],
          where: { status: { in: [...SUCCESSFUL_PAYMENT_STATUSES] } },
        }).then((rows) => rows.length),
      ]);
      return { conversations, cases, paidClients };
    });
  }

  /** Revenue grouped by case matter type (D-113). */
  async revenueByPracticeArea(
    tenantId: string,
  ): Promise<Array<{ matterType: string; totalCents: number; paymentCount: number }>> {
    return this.uow.withTenant(tenantId, async (tx) => {
      const payments = await tx.payment.findMany({
        where: { status: { in: [...SUCCESSFUL_PAYMENT_STATUSES] }, caseId: { not: null } },
        include: { case: { select: { matterType: true } } },
      });
      const map = new Map<string, { totalCents: number; paymentCount: number }>();
      for (const p of payments) {
        const key = p.case?.matterType ?? 'Unknown';
        const prev = map.get(key) ?? { totalCents: 0, paymentCount: 0 };
        map.set(key, { totalCents: prev.totalCents + p.amountCents, paymentCount: prev.paymentCount + 1 });
      }
      return [...map.entries()]
        .map(([matterType, v]) => ({ matterType, ...v }))
        .sort((a, b) => b.totalCents - a.totalCents);
    });
  }

  async slaBreaches(tenantId: string): Promise<number> {
    const now = Date.now();
    return this.uow.withTenant(tenantId, async (tx) =>
      tx.escalation.count({
        where: {
          status: 'OPEN',
          slaDeadline: { lt: new Date(now) },
        },
      }),
    );
  }

  private countByDate(dates: Date[]): Map<string, number> {
    const map = new Map<string, number>();
    for (const date of dates) {
      const key = date.toISOString().slice(0, 10);
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }

  private sumCentsByDate(
    payments: Array<{ paidAt: Date; amountCents: number }>,
  ): Map<string, number> {
    const map = new Map<string, number>();
    for (const payment of payments) {
      const key = payment.paidAt.toISOString().slice(0, 10);
      map.set(key, (map.get(key) ?? 0) + payment.amountCents);
    }
    return map;
  }

  private startOfDay(d: Date): Date {
    return new Date(d.toISOString().slice(0, 10));
  }

  private addDays(d: Date, days: number): Date {
    const result = new Date(d);
    result.setDate(result.getDate() + days);
    return result;
  }
}
