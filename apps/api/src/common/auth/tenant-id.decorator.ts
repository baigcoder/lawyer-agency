import { createParamDecorator } from '@nestjs/common';
import { RequestContextStore } from '../context/request-context';

/**
 * Handler parameter that resolves the current tenant from request context.
 * Throws if no guard established one — a missing tenant is always a bug or
 * an attack, never a default (ADR-002 defense-in-depth).
 */
export const TenantId = createParamDecorator(
  (): string => RequestContextStore.requireTenantId(),
);
