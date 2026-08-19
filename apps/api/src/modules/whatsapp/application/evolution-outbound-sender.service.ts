import { Inject, Injectable } from '@nestjs/common';
import { WindowClosedError } from '../../../common/messaging/window-policy';
import {
  EvolutionApiError,
  NonRetryableSendError,
  TenantCredentialsMissingError,
} from '../domain/errors';
import type { DbTx } from '../../../common/persistence/db-tx';
import { WHATSAPP_CONNECTION_REPOSITORY, type OutboundSender, type WhatsappConnectionRepository } from './ports';
import { EvolutionApiClient } from '../infrastructure/evolution-api.client';

/**
 * Single outbound sender backed by Evolution API.
 *
 * All WhatsApp sends (text, media, templates) go through the tenant's
 * Evolution instance. The 24h window policy is still enforced upstream by
 * SendService; Evolution transport failures surface as EvolutionApiError.
 */
@Injectable()
export class EvolutionOutboundSender implements OutboundSender {
  constructor(
    @Inject(WHATSAPP_CONNECTION_REPOSITORY) private readonly connections: WhatsappConnectionRepository,
    private readonly evolution: EvolutionApiClient,
  ) {}

  async postMessage(params: {
    tenantId: string;
    toWaPhone: string;
    body: Record<string, unknown>;
    tx: DbTx;
  }): Promise<{ wamid: string }> {
    const connection = await this.connections.findByTenant(params.tx, params.tenantId);
    if (!connection) {
      throw new TenantCredentialsMissingError(params.tenantId);
    }
    const live = await this.evolution.getConnectionState(connection.instanceName).catch(() => null);
    if (!live || live.status !== 'connected') {
      throw new TenantCredentialsMissingError(params.tenantId);
    }
    if (live.status !== connection.status) {
      await this.connections.upsert(params.tx, params.tenantId, { status: live.status });
    }

    try {
      const bodyType = typeof params.body.type === 'string' ? params.body.type : undefined;
      const textBody = asRecord(params.body.text)?.body;
      const imageBody = asRecord(params.body.image);
      const documentBody = asRecord(params.body.document);
      const audioBody = asRecord(params.body.audio);

      if (bodyType === 'text' && typeof textBody === 'string') {
        return await this.evolution.sendText({
          instanceName: connection.instanceName,
          to: params.toWaPhone,
          text: textBody,
        });
      }

      if (bodyType === 'audio' && typeof audioBody?.base64 === 'string') {
        return await this.evolution.sendMedia({
          instanceName: connection.instanceName,
          to: params.toWaPhone,
          media: audioBody.base64,
          caption: undefined,
          mediaType: 'audio',
          mimeType: typeof audioBody.mimeType === 'string' ? audioBody.mimeType : undefined,
        });
      }

      if (bodyType === 'image' && typeof imageBody?.link === 'string') {
        return await this.evolution.sendMedia({
          instanceName: connection.instanceName,
          to: params.toWaPhone,
          media: imageBody.link,
          caption: typeof imageBody.caption === 'string' ? imageBody.caption : undefined,
          mediaType: 'image',
        });
      }

      if (bodyType === 'document' && documentBody) {
        const media =
          typeof documentBody.base64 === 'string'
            ? documentBody.base64
            : typeof documentBody.link === 'string'
              ? documentBody.link
              : null;
        if (media) {
          return await this.evolution.sendMedia({
            instanceName: connection.instanceName,
            to: params.toWaPhone,
            media,
            caption: typeof documentBody.caption === 'string' ? documentBody.caption : undefined,
            mediaType: 'document',
            mimeType: typeof documentBody.mimeType === 'string' ? documentBody.mimeType : 'application/pdf',
            fileName: typeof documentBody.fileName === 'string' ? documentBody.fileName : 'document.pdf',
          });
        }
      }

      const fallbackText = textBody ?? params.body.body;
      if (typeof fallbackText === 'string') {
        return await this.evolution.sendText({
          instanceName: connection.instanceName,
          to: params.toWaPhone,
          text: fallbackText,
        });
      }

      throw new EvolutionApiError(`unsupported message body type: ${bodyType ?? 'unknown'}`);
    } catch (error) {
      if (error instanceof EvolutionApiError) {
        const status = this.evolutionStatus(error);
        if (status === 400 || status === 404) {
          throw new NonRetryableSendError(error.message);
        }
        if (error.message.includes('window')) {
          throw new WindowClosedError();
        }
      }
      throw error;
    }
  }

  private evolutionStatus(error: EvolutionApiError): number | null {
    const match = /HTTP (\d{3})/.exec(error.message);
    return match ? Number(match[1]) : null;
  }
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}
