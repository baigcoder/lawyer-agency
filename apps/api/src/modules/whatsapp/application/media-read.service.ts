import { Inject, Injectable, Logger } from '@nestjs/common';
import { UnitOfWork } from '../../../common/prisma/unit-of-work';
import { EvolutionApiClient } from '../infrastructure/evolution-api.client';
import {
  OBJECT_STORAGE,
  WHATSAPP_CONNECTION_REPOSITORY,
  type ObjectStorage,
  type WhatsappConnectionRepository,
} from './ports';

export interface MediaRestoreHint {
  wamid?: string | null;
  fromMe?: boolean;
  waPhone?: string | null;
}

/**
 * Reads stored WhatsApp media for the inbox. If the object is missing (common
 * when Supabase's bucket is unset and the worker disk was replaced), re-downloads
 * from Evolution and writes it back to object storage.
 */
@Injectable()
export class MediaReadService {
  private readonly logger = new Logger(MediaReadService.name);

  constructor(
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
    @Inject(WHATSAPP_CONNECTION_REPOSITORY) private readonly connections: WhatsappConnectionRepository,
    private readonly evolution: EvolutionApiClient,
    private readonly uow: UnitOfWork,
  ) {}

  async getBuffer(
    tenantId: string,
    mediaPath: string,
    payload: Record<string, unknown>,
    hint: MediaRestoreHint = {},
  ): Promise<Buffer> {
    try {
      return await this.storage.get(mediaPath);
    } catch (error) {
      this.logger.warn(
        { tenantId, mediaPath, reason: error instanceof Error ? error.message : String(error) },
        'stored media missing — re-downloading from Evolution',
      );
    }

    const connection = await this.uow.withTenant(tenantId, async (tx) => {
      return this.connections.findByTenant(tx, tenantId);
    });
    if (!connection) {
      throw new Error('no whatsapp connection to restore media');
    }

    const attempts = restoreAttempts(payload, hint);
    let lastError: unknown;
    for (const message of attempts) {
      try {
        const downloaded = await this.evolution.getBase64FromMediaMessage({
          instanceName: connection.instanceName,
          message,
        });
        await this.storage.put(mediaPath, downloaded.buffer);
        return downloaded.buffer;
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError instanceof Error ? lastError : new Error('media file not found');
  }
}

export function restoreAttempts(
  payload: Record<string, unknown>,
  hint: MediaRestoreHint,
): Array<Record<string, unknown>> {
  const attempts: Array<Record<string, unknown>> = [];
  if (payload['key'] != null) {
    attempts.push({ key: payload['key'], message: payload['message'] });
  }
  const wamid = hint.wamid?.trim();
  if (wamid && wamid !== 'evolution-unknown') {
    const digits = (hint.waPhone ?? '').replace(/\D/g, '');
    attempts.push({
      key: {
        id: wamid,
        fromMe: hint.fromMe === true,
        ...(digits.length >= 7 ? { remoteJid: `${digits}@s.whatsapp.net` } : {}),
      },
    });
  }
  return attempts;
}
