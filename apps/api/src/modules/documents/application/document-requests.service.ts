import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { z } from 'zod';
import { UnitOfWork } from '../../../common/prisma/unit-of-work';
import { OutboxWriter } from '../../../common/events/outbox-writer';
import { DOMAIN_EVENTS } from '../../../common/events/domain-events';

export const createDocumentRequestSchema = z.object({
  caseId: z.string().uuid(),
  clientId: z.string().uuid(),
  description: z.string().min(3).max(500),
});

export const fulfilDocumentRequestSchema = z.object({
  documentId: z.string().uuid().nullable().default(null),
});

export type CreateDocumentRequestInput = z.infer<typeof createDocumentRequestSchema>;

export interface DocumentRequestDto {
  id: string;
  caseId: string;
  clientId: string;
  description: string;
  status: 'PENDING' | 'FULFILLED' | 'CANCELLED';
  fulfilledDocumentId: string | null;
  createdAt: string;
  fulfilledAt: string | null;
  clientName: string | null;
  caseReference: string | null;
}

/**
 * Document requests (Phase 5 firm ops): staff ask a client for a document
 * against a case; fulfilment links the uploaded document. Pure T1/T2 outbox
 * payloads (D-005) — descriptions stay in the tenant DB, never on the bus.
 */
@Injectable()
export class DocumentRequestsService {
  private readonly logger = new Logger(DocumentRequestsService.name);

  constructor(
    private readonly uow: UnitOfWork,
    private readonly outbox: OutboxWriter,
  ) {}

  async list(tenantId: string, status?: 'PENDING' | 'FULFILLED' | 'CANCELLED'): Promise<DocumentRequestDto[]> {
    return this.uow.withTenant(tenantId, async (tx) => {
      const rows = await tx.documentRequest.findMany({
        where: status ? { tenantId, status } : { tenantId },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });
      const clientIds = [...new Set(rows.map((r) => r.clientId))];
      const caseIds = [...new Set(rows.map((r) => r.caseId))];
      const [clients, cases] = await Promise.all([
        clientIds.length
          ? tx.client.findMany({
              where: { id: { in: clientIds } },
              select: { id: true, name: true },
            })
          : Promise.resolve([]),
        caseIds.length
          ? tx.case.findMany({
              where: { id: { in: caseIds } },
              select: { id: true, reference: true },
            })
          : Promise.resolve([]),
      ]);
      const clientNames = new Map(clients.map((c) => [c.id, c.name]));
      const caseRefs = new Map(cases.map((c) => [c.id, c.reference]));
      return rows.map((row) =>
        toDto(row, clientNames.get(row.clientId) ?? null, caseRefs.get(row.caseId) ?? null),
      );
    });
  }

  async create(tenantId: string, input: CreateDocumentRequestInput): Promise<DocumentRequestDto> {
    return this.uow.withTenant(tenantId, async (tx) => {
      const caseRow = await tx.case.findFirst({ where: { id: input.caseId, tenantId } });
      if (!caseRow) throw new NotFoundException('Case not found');
      const client = await tx.client.findFirst({ where: { id: input.clientId, tenantId } });
      if (!client) throw new NotFoundException('Client not found');

      const created = await tx.documentRequest.create({
        data: {
          tenantId,
          caseId: input.caseId,
          clientId: input.clientId,
          description: input.description,
        },
      });
      await this.outbox.append(tx, tenantId, DOMAIN_EVENTS.DocumentRequested, {
        documentRequestId: created.id,
        caseId: created.caseId,
        clientId: created.clientId,
      });
      this.logger.log({ tenantId, documentRequestId: created.id }, 'document request created');
      return toDto(created);
    });
  }

  async fulfil(tenantId: string, id: string, documentId: string | null): Promise<DocumentRequestDto> {
    return this.uow.withTenant(tenantId, async (tx) => {
      const existing = await tx.documentRequest.findFirst({ where: { id, tenantId } });
      if (!existing) throw new NotFoundException('Document request not found');
      if (existing.status !== 'PENDING') {
        throw new NotFoundException(`Document request is already ${existing.status}`);
      }
      if (documentId) {
        const doc = await tx.document.findFirst({ where: { id: documentId, tenantId } });
        if (!doc) throw new NotFoundException('Document not found');
      }
      const updated = await tx.documentRequest.update({
        where: { id },
        data: { status: 'FULFILLED', fulfilledDocumentId: documentId, fulfilledAt: new Date() },
      });
      await this.outbox.append(tx, tenantId, DOMAIN_EVENTS.DocumentRequestFulfilled, {
        documentRequestId: updated.id,
        caseId: updated.caseId,
        documentId: updated.fulfilledDocumentId,
      });
      return toDto(updated);
    });
  }

  async cancel(tenantId: string, id: string): Promise<DocumentRequestDto> {
    return this.uow.withTenant(tenantId, async (tx) => {
      const existing = await tx.documentRequest.findFirst({ where: { id, tenantId } });
      if (!existing) throw new NotFoundException('Document request not found');
      if (existing.status !== 'PENDING') {
        throw new NotFoundException(`Document request is already ${existing.status}`);
      }
      const updated = await tx.documentRequest.update({
        where: { id },
        data: { status: 'CANCELLED' },
      });
      return toDto(updated);
    });
  }

  /** Link the first matching pending request when a client sends a document on WhatsApp. */
  async autoFulfilFromInbound(
    tenantId: string,
    clientId: string,
    caseId: string | null,
    documentId: string,
  ): Promise<DocumentRequestDto | null> {
    return this.uow.withTenant(tenantId, async (tx) => {
      const pending = await tx.documentRequest.findFirst({
        where: {
          tenantId,
          clientId,
          status: 'PENDING',
          ...(caseId ? { caseId } : {}),
        },
        orderBy: { createdAt: 'asc' },
      });
      if (!pending) return null;

      const doc = await tx.document.findFirst({ where: { id: documentId, tenantId } });
      if (!doc) return null;

      const updated = await tx.documentRequest.update({
        where: { id: pending.id },
        data: { status: 'FULFILLED', fulfilledDocumentId: documentId, fulfilledAt: new Date() },
      });
      await this.outbox.append(tx, tenantId, DOMAIN_EVENTS.DocumentRequestFulfilled, {
        documentRequestId: updated.id,
        caseId: updated.caseId,
        documentId: updated.fulfilledDocumentId,
      });
      this.logger.log({ tenantId, documentRequestId: updated.id, documentId }, 'inbound document auto-fulfilled request');
      return toDto(updated);
    });
  }
}

type DocumentRequestRow = {
  id: string;
  caseId: string;
  clientId: string;
  description: string;
  status: 'PENDING' | 'FULFILLED' | 'CANCELLED';
  fulfilledDocumentId: string | null;
  createdAt: Date;
  fulfilledAt: Date | null;
};

function toDto(
  row: DocumentRequestRow,
  clientName: string | null = null,
  caseReference: string | null = null,
): DocumentRequestDto {
  return {
    id: row.id,
    caseId: row.caseId,
    clientId: row.clientId,
    description: row.description,
    status: row.status,
    fulfilledDocumentId: row.fulfilledDocumentId,
    createdAt: row.createdAt.toISOString(),
    fulfilledAt: row.fulfilledAt ? row.fulfilledAt.toISOString() : null,
    clientName,
    caseReference,
  };
}
