import { z } from 'zod';

export const paymentDetailsSchema = z.object({
  jazzcashNumber: z.string().optional(),
  easypaisaNumber: z.string().optional(),
  bankName: z.string().optional(),
  accountTitle: z.string().optional(),
  accountNumber: z.string().optional(),
  iban: z.string().optional(),
});

export type PaymentDetails = z.infer<typeof paymentDetailsSchema>;
