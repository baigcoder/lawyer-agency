import { Injectable, Logger } from '@nestjs/common';
import type { MediaDownloadResult, MetaCloudApi, MetaTemplate, SendResult } from '../application/ports';

/**
 * Dev-only stub for the Meta Cloud API. Returns fake send results and empty
 * template/media responses so the AI pipeline can be tested end-to-end
 * without real WhatsApp credentials or an unpublished Meta app. Used when
 * NODE_ENV !== 'production' (see WhatsappPortsModule).
 */
@Injectable()
export class DevMockMetaCloudApi implements MetaCloudApi {
  private readonly logger = new Logger(DevMockMetaCloudApi.name);

  async postMessage(params: {
    accessToken: string;
    phoneNumberId: string;
    body: Record<string, unknown>;
  }): Promise<SendResult> {
    const to = params.body['to'] ?? 'unknown';
    this.logger.log({ phoneNumberId: params.phoneNumberId, to }, 'DEV MOCK: postMessage (no real WhatsApp send)');
    return { wamid: `mock-wamid-${Date.now()}` };
  }

  async listTemplates(): Promise<MetaTemplate[]> {
    return [];
  }

  async downloadMedia(): Promise<MediaDownloadResult> {
    return {
      buffer: Buffer.alloc(0),
      mimeType: 'application/octet-stream',
      filename: 'mock-file',
    };
  }
}