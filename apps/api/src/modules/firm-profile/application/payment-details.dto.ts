import { z } from 'zod';

export const paymentDetailsSchema = z.object({
  jazzcashNumber: z.string().max(20).optional(),
  easypaisaNumber: z.string().max(20).optional(),
  bankName: z.string().max(100).optional(),
  accountTitle: z.string().max(100).optional(),
  accountNumber: z.string().max(40).optional(),
  iban: z.string().max(34).optional(),
});

export type PaymentDetailsInput = z.infer<typeof paymentDetailsSchema>;

export interface PaymentDetails extends PaymentDetailsInput {}

export const emptyPaymentDetails = (): PaymentDetails => ({
  jazzcashNumber: '',
  easypaisaNumber: '',
  bankName: '',
  accountTitle: '',
  accountNumber: '',
  iban: '',
});
