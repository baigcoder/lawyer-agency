import { Inject, Injectable } from '@nestjs/common';
import { randomInt } from 'node:crypto';
import { OutboxWriter } from '../../../common/events/outbox-writer';
import { DOMAIN_EVENTS } from '../../../common/events/domain-events';
import { UnitOfWork } from '../../../common/prisma/unit-of-work';
import {
  CaseNotFoundError,
  DuplicateReferenceError,
  assertCaseTransition,
  type CaseEntity,
  type CaseStatus,
} from '../domain/case';
import type {
  AssignLawyerInput,
  CreateCaseInput,
} from './dto';
import { CASE_REPOSITORY, type CaseRepository } from './ports';

/**
 * Application service — the module's ONLY public surface (Phase 2 §4).
 * Every command runs inside UnitOfWork.withTenant and appends its domain
 * event to the outbox in the same transaction (ADR-003).
 */
@Injectable()
export class CasesService {
  constructor(
    private readonly uow: UnitOfWork,
    @Inject(CASE_REPOSITORY) private readonly cases: CaseRepository,
    private readonly outbox: OutboxWriter,
  ) {}

  async create(tenantId: string, input: CreateCaseInput): Promise<CaseEntity> {
    return this.uow.withTenant(tenantId, async (tx) => {
      // Reference allocation with unique-constraint arbitration: retry once
      // on the (rare) random-suffix collision inside the tenant namespace.
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const reference = allocateReference(input.matterType);
        try {
          const created = await this.cases.create(tx, { tenantId, ...input, reference });
          await this.outbox.append(tx, tenantId, DOMAIN_EVENTS.CaseCreated, {
            caseId: created.id,
            clientId: created.clientId,
            reference: created.reference,
            matterType: created.matterType,
          });
          return created;
        } catch (error) {
          if (error instanceof DuplicateReferenceError && attempt < 2) continue;
          throw error;
        }
      }
      // Unreachable: loop either returns or throws.
      throw new Error('reference allocation exhausted');
    });
  }

  async transitionStatus(
    tenantId: string,
    caseId: string,
    to: CaseStatus,
  ): Promise<CaseEntity> {
    return this.uow.withTenant(tenantId, async (tx) => {
      const current = await this.cases.findById(tx, caseId);
      if (!current) throw new CaseNotFoundError(caseId);

      assertCaseTransition(current.status, to);
      const closedAt = to === 'CLOSED' ? new Date() : null;
      const updated = await this.cases.updateStatus(tx, caseId, to, closedAt);

      await this.outbox.append(tx, tenantId, DOMAIN_EVENTS.CaseStatusChanged, {
        caseId,
        from: current.status,
        to,
      });
      return updated;
    });
  }

  async assignLawyer(
    tenantId: string,
    caseId: string,
    input: AssignLawyerInput,
  ): Promise<void> {
    return this.uow.withTenant(tenantId, async (tx) => {
      const current = await this.cases.findById(tx, caseId);
      if (!current) throw new CaseNotFoundError(caseId);

      await this.cases.assignLawyer(tx, tenantId, caseId, input.lawyerId, input.role);
      await this.outbox.append(tx, tenantId, DOMAIN_EVENTS.CaseAssigned, {
        caseId,
        lawyerId: input.lawyerId,
        role: input.role,
      });
    });
  }

  async getById(tenantId: string, caseId: string): Promise<CaseEntity | null> {
    return this.uow.withTenant(tenantId, (tx) => this.cases.findById(tx, caseId));
  }

  async listOpen(tenantId: string): Promise<CaseEntity[]> {
    return this.uow.withTenant(tenantId, (tx) => this.cases.listOpen(tx));
  }

  async listAll(tenantId: string): Promise<CaseEntity[]> {
    return this.uow.withTenant(tenantId, (tx) => this.cases.listAll(tx));
  }
}

/**
 * Firm-scoped human reference, e.g. "FAM-2026-4821".
 * EXTENSION (Phase 12): per-tenant sequence table for gapless numbering.
 * v1 relies on the DB unique constraint + retry (above) — collision-safe.
 */
function allocateReference(matterType: string): string {
  const prefix = matterType.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || 'GEN';
  const year = new Date().getFullYear();
  const suffix = randomInt(1000, 9999);
  return `${prefix}-${year}-${suffix}`;
}
