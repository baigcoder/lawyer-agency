import { z } from 'zod';

/** Mirrors the backend document-requests read shape (Documents module). */
export const documentRequestSchema = z.object({
  id: z.uuid(),
  caseId: z.uuid(),
  clientId: z.uuid(),
  description: z.string(),
  status: z.enum(['PENDING', 'FULFILLED', 'CANCELLED']),
  fulfilledDocumentId: z.string().uuid().nullable(),
  createdAt: z.string(),
  fulfilledAt: z.string().nullable(),
  clientName: z.string().nullable().optional(),
  caseReference: z.string().nullable().optional(),
});

export const documentRequestListSchema = z.array(documentRequestSchema);
export type DocumentRequestDto = z.infer<typeof documentRequestSchema>;

export const createDocumentRequestSchema = z.object({
  caseId: z.uuid(),
  clientId: z.uuid(),
  description: z.string().min(3).max(500),
});
