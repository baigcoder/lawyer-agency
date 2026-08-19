import { z } from 'zod';

export const docTypeSchema = z.enum([
  'CNIC',
  'FIR',
  'COURT_NOTICE',
  'AFFIDAVIT',
  'CONTRACT',
  'EVIDENCE_PHOTO',
  'PAYMENT_PROOF',
  'RECEIPT',
  'OTHER',
]);

export const documentSchema = z.object({
  id: z.string().uuid(),
  clientId: z.string().uuid(),
  caseId: z.string().uuid().nullable(),
  filename: z.string(),
  description: z.string().nullable(),
  mimeType: z.string(),
  sizeBytes: z.number(),
  docType: docTypeSchema,
  ocrStatus: z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'SKIPPED']),
  isPinned: z.boolean(),
  createdAt: z.coerce.date(),
});

export type DocumentDto = z.infer<typeof documentSchema>;

export const documentListSchema = z.array(documentSchema);

export const documentUploadSchema = z.object({
  clientId: z.string().uuid(),
  caseId: z.string().uuid().optional(),
  description: z.string().max(500).optional(),
  docType: docTypeSchema.default('OTHER'),
});

export type DocumentUploadInput = z.infer<typeof documentUploadSchema>;
