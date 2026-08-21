import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import type { Env } from '../../../config/env';
import { MetaApiError } from '../domain/errors';
import type { MediaDownloadResult, MetaCloudApi, MetaTemplate, SendResult } from '../application/ports';

const sendResponseSchema = z.object({
  messages: z.array(z.object({ id: z.string() })).min(1),
});

const metaErrorSchema = z.looseObject({
  error: z.looseObject({ code: z.number().optional(), message: z.string().optional() }),
});

const templateListSchema = z.looseObject({
  data: z
    .array(
      z.looseObject({
        id: z.string(),
        name: z.string(),
        language: z.string(),
        category: z.string(),
        status: z.string(),
        components: z.array(z.unknown()).default([]),
        rejection_reason: z.string().optional(),
      }),
    )
    .default([]),
});

const mediaMetadataSchema = z.looseObject({
  url: z.string().url(),
  mime_type: z.string().optional(),
  file_sha_256: z.string().optional(),
  messaging_product: z.string().optional(),
});

function guessExtension(mimeType: string | undefined): string {
  const map: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'audio/mpeg': '.mp3',
    'audio/ogg': '.ogg',
    'audio/amr': '.amr',
    'video/mp4': '.mp4',
    'application/pdf': '.pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  };
  return map[mimeType ?? ''] ?? '';
}

/**
 * Direct Cloud API adapter (D-002 — no BSP in the message path). One place
 * knows Graph API wire shapes, timeouts, and error codes. Metrics hooks land
 * with OTel instrumentation (Phase 16); the call sites are already here.
 */
@Injectable()
export class MetaCloudApiClient implements MetaCloudApi {
  private readonly logger = new Logger(MetaCloudApiClient.name);
  private readonly baseUrl: string;

  constructor(config: ConfigService<Env, true>) {
    this.baseUrl = config.get('META_GRAPH_BASE_URL', { infer: true });
  }

  async postMessage(params: {
    accessToken: string;
    phoneNumberId: string;
    body: Record<string, unknown>;
  }): Promise<SendResult> {
    const response = await this.call('POST', `/${params.phoneNumberId}/messages`, params.accessToken, params.body);
    const parsed = sendResponseSchema.safeParse(response);
    if (!parsed.success) throw new MetaApiError(null, 'malformed send response');
    const first = parsed.data.messages[0];
    if (!first) throw new MetaApiError(null, 'empty send response');
    return { wamid: first.id };
  }

  async listTemplates(params: { accessToken: string; wabaId: string }): Promise<MetaTemplate[]> {
    const query = encodeURIComponent('name,language,category,components,status,id,rejection_reason');
    const response = await this.call('GET', `/${params.wabaId}/message_templates?fields=${query}`, params.accessToken);
    const parsed = templateListSchema.safeParse(response);
    if (!parsed.success) {
      this.logger.warn('malformed template list response');
      throw new MetaApiError(null, 'malformed template list response');
    }
    return parsed.data.data.map((t) => ({
      metaTemplateId: t.id,
      name: t.name,
      language: t.language,
      category: t.category,
      status: t.status,
      components: t.components as Record<string, unknown>[],
      rejectionReason: t.rejection_reason ?? null,
    }));
  }

  async downloadMedia(params: { accessToken: string; mediaId: string }): Promise<MediaDownloadResult> {
    const meta = await this.call('GET', `/${params.mediaId}`, params.accessToken);
    const parsed = mediaMetadataSchema.safeParse(meta);
    if (!parsed.success) throw new MetaApiError(null, 'malformed media metadata response');

    const url = parsed.data.url;
    let response: Response;
    try {
      response = await fetch(url, {
        headers: { authorization: `Bearer ${params.accessToken}` },
        signal: AbortSignal.timeout(30_000),
      });
    } catch (error) {
      throw new MetaApiError(null, error instanceof Error ? error.message : 'media download network failure');
    }
    if (!response.ok) {
      throw new MetaApiError(null, `media download HTTP ${response.status}`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get('content-type') ?? parsed.data.mime_type ?? 'application/octet-stream';
    const filename = `media-${params.mediaId}${guessExtension(contentType)}`;
    return { buffer, mimeType: contentType, filename };
  }

  async postCall(params: {
    accessToken: string;
    phoneNumberId: string;
    body: Record<string, unknown>;
  }): Promise<void> {
    await this.call('POST', `/${params.phoneNumberId}/calls`, params.accessToken, params.body);
  }

  private async call(
    method: 'GET' | 'POST',
    path: string,
    accessToken: string,
    body?: Record<string, unknown>,
  ): Promise<unknown> {
    const url = `${this.baseUrl}${path}`;
    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers: {
          authorization: `Bearer ${accessToken}`,
          ...(body ? { 'content-type': 'application/json' } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(10_000),
      });
    } catch (error) {
      throw new MetaApiError(null, error instanceof Error ? error.message : 'network failure');
    }

    if (!response.ok) {
      const parsed = metaErrorSchema.safeParse(await response.json().catch(() => null));
      const code = parsed.success ? (parsed.data.error.code ?? null) : null;
      const message = parsed.success ? (parsed.data.error.message ?? 'unknown') : 'unknown';
      this.logger.warn({ status: response.status, metaCode: code, url: path }, 'meta api call failed');
      throw new MetaApiError(code, `HTTP ${response.status}: ${message}`);
    }

    return response.json();
  }
}
