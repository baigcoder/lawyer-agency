/**
 * Base class for all domain errors. Carries its HTTP mapping so the global
 * exception filter can translate domain failures without importing module
 * code (common must never depend on modules).
 */
export abstract class DomainError extends Error {
  abstract readonly httpStatus: number;
}
