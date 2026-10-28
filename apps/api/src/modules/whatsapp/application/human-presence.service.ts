import { Inject, Injectable, Logger } from '@nestjs/common';
import { UnitOfWork } from '../../../common/prisma/unit-of-work';
import { EvolutionApiClient } from '../infrastructure/evolution-api.client';
import { WHATSAPP_CONNECTION_REPOSITORY, type WhatsappConnectionRepository } from './ports';

/**
 * The small signals a person on WhatsApp gives: blue ticks when they read,
 * "typing…" or "recording audio…" while they answer.
 *
 * Best-effort by design. A Cloud API instance has no presence, an instance may
 * be reconnecting, and none of that may delay or fail the reply itself, so
 * every failure is logged at debug level and swallowed. Nothing here holds a
 * DB transaction across the network wait.
 */
@Injectable()
export class HumanPresenceService {
  private readonly logger = new Logger(HumanPresenceService.name);

  constructor(
    private readonly uow: UnitOfWork,
    @Inject(WHATSAPP_CONNECTION_REPOSITORY) private readonly connections: WhatsappConnectionRepository,
    private readonly evolution: EvolutionApiClient,
  ) {}

  async markRead(tenantId: string, fromWaPhone: string, wamids: string[]): Promise<void> {
    const ids = wamids.filter((id) => id.length > 0);
    if (ids.length === 0) return;
    const instanceName = await this.instanceFor(tenantId);
    if (!instanceName) return;
    try {
      await this.evolution.markMessagesRead({ instanceName, from: fromWaPhone, wamids: ids });
    } catch (error) {
      this.logger.debug({ tenantId, err: errorMessage(error) }, 'mark-read skipped');
    }
  }

  /** Resolves after `ms` (or sooner if presence is unavailable — the caller then waits itself). */
  async showActivity(
    tenantId: string,
    toWaPhone: string,
    activity: 'composing' | 'recording',
    ms: number,
  ): Promise<void> {
    if (ms <= 0) return;
    const started = Date.now();
    const instanceName = await this.instanceFor(tenantId);
    try {
      if (instanceName) {
        await this.evolution.sendPresence({ instanceName, to: toWaPhone, presence: activity, delayMs: ms });
      }
    } catch (error) {
      this.logger.debug({ tenantId, err: errorMessage(error) }, 'presence skipped');
    }
    // Keep the human rhythm even when the indicator could not be shown.
    const remaining = ms - (Date.now() - started);
    if (remaining > 0) await sleep(remaining);
  }

  private async instanceFor(tenantId: string): Promise<string | null> {
    try {
      const connection = await this.uow.withTenant(tenantId, (tx) => this.connections.findByTenant(tx, tenantId));
      return connection?.instanceName ?? null;
    } catch (error) {
      this.logger.debug({ tenantId, err: errorMessage(error) }, 'no whatsapp instance for presence');
      return null;
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
