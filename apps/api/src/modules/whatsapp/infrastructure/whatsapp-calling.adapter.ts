import { Inject, Injectable, Logger } from '@nestjs/common';
import { CryptoService } from '../../../common/crypto/crypto.service';
import { UnitOfWork } from '../../../common/prisma/unit-of-work';
import {
  META_CLOUD_API,
  WHATSAPP_ACCOUNT_REPOSITORY,
  type MetaCloudApi,
  type WhatsappAccountRepository,
  type WhatsappCallActionInput,
  type WhatsappCallingPort,
} from '../application/ports';
import { EvolutionApiClient } from './evolution-api.client';

/**
 * Cloud Calling signaling (D-124). Tries Evolution first; falls back to Graph
 * `/PHONE_NUMBER_ID/calls` when the tenant has an official WABA token.
 */
@Injectable()
export class WhatsappCallingAdapter implements WhatsappCallingPort {
  private readonly logger = new Logger(WhatsappCallingAdapter.name);

  constructor(
    private readonly evolution: EvolutionApiClient,
    @Inject(META_CLOUD_API) private readonly meta: MetaCloudApi,
    @Inject(WHATSAPP_ACCOUNT_REPOSITORY) private readonly accounts: WhatsappAccountRepository,
    private readonly crypto: CryptoService,
    private readonly uow: UnitOfWork,
  ) {}

  async sendCallAction(input: WhatsappCallActionInput): Promise<void> {
    const session =
      input.sdpAnswer && (input.action === 'pre_accept' || input.action === 'accept')
        ? { sdp_type: 'answer', sdp: input.sdpAnswer }
        : undefined;
    const graphBody: Record<string, unknown> = {
      messaging_product: 'whatsapp',
      call_id: input.providerCallId,
      action: input.action,
      ...(session ? { session } : {}),
    };

    try {
      await this.evolution.sendCallAction(
        input.instanceName,
        input.action,
        input.providerCallId,
        input.sdpAnswer,
      );
      return;
    } catch (error) {
      this.logger.warn(
        { instance: input.instanceName, action: input.action, err: error instanceof Error ? error.message : 'unknown' },
        'evolution call action failed — trying Graph',
      );
    }

    const account = await this.uow.withTenant(input.tenantId, (tx) => this.accounts.findByTenant(tx, input.tenantId));
    if (!account?.accessTokenEnc) {
      throw new Error('no Evolution or Graph credentials for WhatsApp calling');
    }
    await this.meta.postCall({
      accessToken: this.crypto.decrypt(account.accessTokenEnc),
      phoneNumberId: account.phoneNumberId,
      body: graphBody,
    });
  }
}
