import type { DbTx } from '../../../common/persistence/db-tx';
import type { CaseEntity, CaseStatus, NewCase } from '../domain/case';

/**
 * Application-owned port (hexagonal): the application declares what it
 * needs; infrastructure satisfies it. Tenant scoping is NOT a parameter —
 * it is ambient: the transaction carries the RLS GUC (ADR-002), and every
 * call happens inside UnitOfWork.withTenant.
 */
export interface CaseRepository {
  create(tx: DbTx, data: NewCase): Promise<CaseEntity>;
  findById(tx: DbTx, id: string): Promise<CaseEntity | null>;
  updateStatus(
    tx: DbTx,
    id: string,
    status: CaseStatus,
    closedAt: Date | null,
  ): Promise<CaseEntity>;
  assignLawyer(
    tx: DbTx,
    tenantId: string,
    caseId: string,
    lawyerId: string,
    role: string,
  ): Promise<void>;
  listOpen(tx: DbTx): Promise<CaseEntity[]>;
  listAll(tx: DbTx): Promise<CaseEntity[]>;
}

export const CASE_REPOSITORY = Symbol('CASE_REPOSITORY');
