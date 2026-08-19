import { z } from 'zod';

export const dashboardMetricsSchema = z.object({
  newLeads7d: z.number().int(),
  aiContainmentRate: z.number().nullable(),
  escalations7d: z.number().int(),
  casesOpened7d: z.number().int(),
  casesClosed7d: z.number().int(),
  feesCollectedCents30d: z.number().int(),
  avgEscalationAckMinutes7d: z.number().int().nullable().optional(),
});

export type DashboardMetrics = z.infer<typeof dashboardMetricsSchema>;

export const dailySeriesPointSchema = z.object({
  date: z.string(),
  newConversations: z.number().int(),
  aiHandled: z.number().int(),
  humanHandled: z.number().int(),
  escalations: z.number().int(),
  casesOpened: z.number().int(),
  casesClosed: z.number().int(),
  paymentsCents: z.number().int(),
});

export const dailySeriesSchema = z.array(dailySeriesPointSchema);
export type DailySeriesPoint = z.infer<typeof dailySeriesPointSchema>;

export const funnelSchema = z.object({
  conversations: z.number().int(),
  cases: z.number().int(),
  paidClients: z.number().int(),
});

export const revenueByAreaSchema = z.array(
  z.object({
    matterType: z.string(),
    totalCents: z.number().int(),
    paymentCount: z.number().int(),
  }),
);

export const slaBreachesSchema = z.number().int();
