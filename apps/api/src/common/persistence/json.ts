import type { Prisma } from '../../generated/prisma/client';

/**
 * JSON columns cross the Prisma boundary only via a roundtrip: the parse
 * proves the value is JSON-shaped instead of asserting it (no unchecked
 * casts). Single containment point for the one cast that remains.
 */
export function toInputJson(value: Record<string, unknown>): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}
