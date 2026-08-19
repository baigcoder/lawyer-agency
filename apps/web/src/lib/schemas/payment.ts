import { z } from 'zod';

export const paymentMethodSchema = z.enum([
  'JAZZCASH',
  'EASYPAISA',
  'CARD_LOCAL',
  'CARD_INTL',
  'BANK_TRANSFER',
  'CASH',
  'OTHER_MANUAL',
]);

export const paymentStatusSchema = z.enum([
  'REQUESTED',
  'PENDING',
  'SUCCEEDED',
  'FAILED',
  'REFUNDED',
  'RECORDED_MANUAL',
  'CANCELLED',
]);

export const paymentSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().uuid(),
  caseId: z.string().uuid().nullable(),
  clientId: z.string().uuid(),
  amountCents: z.number().int(),
  currency: z.string(),
  method: paymentMethodSchema,
  status: paymentStatusSchema,
  providerTxnId: z.string().nullable(),
  description: z.string().nullable(),
  requestedAt: z.coerce.date(),
  paidAt: z.coerce.date().nullable(),
  recordedBy: z.string().uuid().nullable(),
  metadata: z.record(z.string(), z.unknown()),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  recordedByUser: z.object({ id: z.string().uuid(), name: z.string() }).nullable(),
  case: z.object({ reference: z.string(), matterType: z.string().optional() }).nullable(),
  client: z
    .object({
      id: z.string().uuid(),
      name: z.string().nullable(),
      waPhone: z.string(),
    })
    .nullable()
    .optional(),
});

export const paymentListSchema = z.array(paymentSchema);

export type PaymentDto = z.infer<typeof paymentSchema>;
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;
export type PaymentStatus = z.infer<typeof paymentStatusSchema>;
