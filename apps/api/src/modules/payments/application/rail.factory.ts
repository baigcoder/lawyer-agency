import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../../config/env';
import type { PaymentMethod } from '../../../generated/prisma/enums';
import { RailUnavailableError } from '../domain/errors';
import { PAYMENT_RAILS, type PaymentRail } from './ports';

const ELECTRONIC_METHODS: readonly PaymentMethod[] = [
  'JAZZCASH',
  'EASYPAISA',
  'CARD_LOCAL',
  'CARD_INTL',
];

/**
 * Rail factory (D-096) — the single place method→rail resolution happens.
 *
 * Legal gate: electronic rails only initiate after the operator has signed
 * the merchant agreements, signalled by PAYMENTS_ELECTRONIC_ENABLED=true.
 * Fail-closed — when unset (default), every electronic method raises
 * RailUnavailableError with a pointer to manual rails, and no provider call
 * is ever attempted.
 *
 * v1 registers the stub rail for every electronic method once the gate is
 * open (dev/testing). Production per-provider adapters (JAZZCASH_*, EASYPAISA_*,
 * card gateways) slot in here: each declares the env credentials it requires
 * and the factory refuses the method when they are absent.
 */
@Injectable()
export class RailFactory {
  constructor(
    private readonly config: ConfigService<Env, true>,
    @Inject(PAYMENT_RAILS) private readonly rails: PaymentRail[],
  ) {}

  railForMethod(method: PaymentMethod): PaymentRail {
    if (!ELECTRONIC_METHODS.includes(method)) {
      throw new RailUnavailableError(method, 'not an electronic rail method');
    }
    if (this.config.get('PAYMENTS_ELECTRONIC_ENABLED', { infer: true }) !== 'true') {
      throw new RailUnavailableError(
        method,
        'payments legal gate is closed (PAYMENTS_ELECTRONIC_ENABLED is not set)',
      );
    }
    // v1: the stub rail serves every electronic method behind the open gate.
    // The map below becomes per-method once real adapters land.
    const rail = this.rails.find((r) => r.method === 'STUB_ELECTRONIC');
    if (!rail) {
      throw new RailUnavailableError(method, 'no rail adapter registered');
    }
    return rail;
  }

  webhookRailFor(): PaymentRail | null {
    // Webhook reconciliation must never be gated (settling an in-flight
    // payment is not a new initiation): the stub rail parses every shape it
    // understands, real adapters parse their own callbacks.
    return this.rails.find((r) => r.method === 'STUB_ELECTRONIC') ?? null;
  }
}
