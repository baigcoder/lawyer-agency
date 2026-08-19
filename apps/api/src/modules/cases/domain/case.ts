import { DomainError } from '../../../common/errors/domain-error';

/**
 * Cases domain — pure TypeScript. No NestJS, no Prisma, no vendor imports
 * (enforced by the eslint boundary rule). Values mirror the DB enums; a unit
 * test asserts parity so the two can never silently drift.
 */

export const CASE_STATUSES = [
  'LEAD',
  'CONSULTATION',
  'ENGAGED',
  'IN_COURT',
  'CLOSED',
  'ARCHIVED',
] as const;
export type CaseStatus = (typeof CASE_STATUSES)[number];

export const CASE_URGENCIES = ['LOW', 'NORMAL', 'HIGH', 'CRITICAL'] as const;
export type CaseUrgency = (typeof CASE_URGENCIES)[number];

/** FR-CSE-04 v1 workflow: linear matter lifecycle. Per-practice-area
 *  customization is P1 — the map is the single place it will change. */
export const CASE_TRANSITIONS: Readonly<Record<CaseStatus, readonly CaseStatus[]>> = {
  LEAD: ['CONSULTATION', 'CLOSED', 'ARCHIVED'],
  CONSULTATION: ['ENGAGED', 'CLOSED'],
  ENGAGED: ['IN_COURT', 'CLOSED'],
  IN_COURT: ['CLOSED'],
  CLOSED: ['ARCHIVED'],
  ARCHIVED: [],
};

export class CaseNotFoundError extends DomainError {
  readonly httpStatus = 404;
  constructor(caseId: string) {
    super(`Case not found: ${caseId}`);
    this.name = 'CaseNotFoundError';
  }
}

export class InvalidCaseTransitionError extends DomainError {
  readonly httpStatus = 409;
  constructor(from: CaseStatus, to: CaseStatus) {
    super(`Invalid case status transition: ${from} → ${to}`);
    this.name = 'InvalidCaseTransitionError';
  }
}

export class DuplicateReferenceError extends DomainError {
  readonly httpStatus = 409;
  constructor(reference: string) {
    super(`Case reference already exists: ${reference}`);
    this.name = 'DuplicateReferenceError';
  }
}

export function assertCaseTransition(from: CaseStatus, to: CaseStatus): void {
  if (!CASE_TRANSITIONS[from].includes(to)) {
    throw new InvalidCaseTransitionError(from, to);
  }
}

export interface CaseEntity {
  id: string;
  tenantId: string;
  clientId: string;
  reference: string;
  matterType: string;
  status: CaseStatus;
  urgency: CaseUrgency;
  summary: string | null;
  intakeData: Record<string, unknown>;
  openedAt: Date;
  closedAt: Date | null;
}

export interface NewCase {
  tenantId: string;
  clientId: string;
  reference: string;
  matterType: string;
  urgency: CaseUrgency;
  summary: string | null;
  intakeData: Record<string, unknown>;
}
