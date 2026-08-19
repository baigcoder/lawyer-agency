import { Inject, Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { randomUUID } from 'crypto';
import { CryptoService } from '../../../common/crypto/crypto.service';
import { PILOT_SEND_JOB, QUEUES } from '../../../common/queue/queue.constants';
import { WindowClosedError } from '../../../common/messaging/window-policy';
import { MetaApiError, TenantCredentialsMissingError } from '../domain/errors';
import type { DbTx } from '../../../common/persistence/db-tx';
import {
  META_CLOUD_API,
  PILOT_SESSION_REPOSITORY,
  WHATSAPP_ACCOUNT_REPOSITORY,
  type MetaCloudApi,
  type OutboundSender,
  type PilotSessionRepository,
  type WhatsappAccountRepository,
} from './ports';

/**
 * Outbound sender seam (D-092): pilot-first, Meta fallback.
 *
 * A send goes through the pilot bridge when the tenant has a PAIRED pilot
 * session whose allowlist includes the recipient; the bridge lives in the
 * worker role, so the API role enqueues a WHATSAPP_PILOT job. Otherwise the
 * official Meta Cloud API path is used (existing behaviour, D-003 window /
 * template policy stays in SendService).
 */
@Injectable()
export class ChainedOutboundSender implements OutboundSender {
  constructor(
    private readonly crypto: CryptoService,
    @Inject(WHATSAPP_ACCOUNT_REPOSITORY) private readonly accounts: WhatsappAccountRepository,
    @Inject(PILOT_SESSION_REPOSITORY) private readonly pilots: PilotSessionRepository,
    @Inject(META_CLOUD_API) private readonly meta: MetaCloudApi,
    @InjectQueue(QUEUES.WHATSAPP_PILOT) private readonly pilotQueue: Queue,
  ) {}

  async postMessage(params: {
    tenantId: string;
    toWaPhone: string;
    body: Record<string, unknown>;
    tx: DbTx;
  }): Promise<{ wamid: string }> {
    const viaPilot = await this.tryPilot(params.tx, params.tenantId, params.toWaPhone, params.body);
    if (viaPilot) return viaPilot;

    const account = await this.accounts.findByTenant(params.tx, params.tenantId);
    if (!account || !account.accessTokenEnc) throw new TenantCredentialsMissingError(params.tenantId);
    const accessToken = this.crypto.decrypt(account.accessTokenEnc);

    try {
      return await this.meta.postMessage({
        accessToken,
        phoneNumberId: account.phoneNumberId,
        body: { messaging_product: 'whatsapp', to: params.toWaPhone, ...params.body },
      });
    } catch (error) {
      if (error instanceof MetaApiError && error.metaCode === 131047) {
        throw new WindowClosedError();
      }
      throw error;
    }
  }

  /** Returns a send result when the pilot bridge takes this send; null otherwise. */
  private async tryPilot(
    tx: DbTx,
    tenantId: string,
    toWaPhone: string,
    body: Record<string, unknown>,
  ): Promise<{ wamid: string } | null> {
    // The pilot bridge can only deliver plain text (A1) — templates and any
    // other type must fall through to the Meta path, which can actually send
    // them, instead of being dropped by the bridge after a fake success.
    if (body['type'] !== 'text') return null;
    const session = await this.pilots.findByTenant(tx, tenantId);
    if (!session || session.status !== 'PAIRED' || session.expiresAt <= new Date()) return null;
    if (!session.allowlist.some((entry) => entry.number === toWaPhone)) return null;

    const jobId = `pilot-send-${tenantId}-${randomUUID()}`;
    await this.pilotQueue.add(
      PILOT_SEND_JOB,
      { tenantId, toWaPhone, body },
      { jobId, attempts: 3, backoff: { type: 'exponential', delay: 2000 }, removeOnComplete: { age: 3600, count: 5000 } },
    );
    return { wamid: `pilot-${jobId}` };
  }
}
