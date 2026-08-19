import { describe, expect, it } from 'vitest';
import { CaseStatus as PrismaCaseStatus } from '../../../generated/prisma/enums';
import {
  CASE_STATUSES,
  CASE_TRANSITIONS,
  InvalidCaseTransitionError,
  assertCaseTransition,
} from './case';

describe('case status transitions', () => {
  it('allows the happy path LEAD → CONSULTATION → ENGAGED → IN_COURT → CLOSED', () => {
    expect(() => assertCaseTransition('LEAD', 'CONSULTATION')).not.toThrow();
    expect(() => assertCaseTransition('CONSULTATION', 'ENGAGED')).not.toThrow();
    expect(() => assertCaseTransition('ENGAGED', 'IN_COURT')).not.toThrow();
    expect(() => assertCaseTransition('IN_COURT', 'CLOSED')).not.toThrow();
  });

  it('rejects skipping states (LEAD → ENGAGED)', () => {
    expect(() => assertCaseTransition('LEAD', 'ENGAGED')).toThrow(InvalidCaseTransitionError);
  });

  it('ARCHIVED is terminal', () => {
    expect(CASE_TRANSITIONS.ARCHIVED).toHaveLength(0);
    expect(() => assertCaseTransition('ARCHIVED', 'LEAD')).toThrow(InvalidCaseTransitionError);
  });

  it('domain status union stays in parity with the generated Prisma enum', () => {
    // Domain must never drift from the DB enum (values mirror by design).
    expect([...CASE_STATUSES].sort()).toEqual(Object.keys(PrismaCaseStatus).sort());
  });
});
