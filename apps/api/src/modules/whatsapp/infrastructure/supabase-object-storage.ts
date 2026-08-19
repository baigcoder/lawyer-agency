import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Env } from '../../../config/env';
import type { ObjectStorage } from '../application/ports';

@Injectable()
export class SupabaseObjectStorage implements ObjectStorage {
  private readonly logger = new Logger(SupabaseObjectStorage.name);
  private readonly client: SupabaseClient;
  private readonly bucket: string;

  constructor(config: ConfigService<Env, true>) {
    const url = config.get('SUPABASE_URL', { infer: true });
    const key = config.get('SUPABASE_SERVICE_ROLE_KEY', { infer: true });
    this.bucket = config.get('SUPABASE_STORAGE_BUCKET', { infer: true });
    if (!url || !key) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for SupabaseObjectStorage');
    }
    this.client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      realtime: false as never,
    });
  }

  async put(path: string, buffer: Buffer): Promise<{ path: string }> {
    const { data, error } = await this.client.storage.from(this.bucket).upload(path, buffer, {
      upsert: true,
      contentType: this.guessContentType(path),
    });
    if (error) {
      this.logger.error({ path, error: error.message }, 'supabase upload failed');
      throw new Error(`Failed to upload object: ${error.message}`);
    }
    return { path: data?.path ?? path };
  }

  async get(path: string): Promise<Buffer> {
    const { data, error } = await this.client.storage.from(this.bucket).download(path);
    if (error || !data) {
      this.logger.error({ path, error: error?.message }, 'supabase download failed');
      throw new Error(`Failed to download object: ${error?.message ?? 'empty response'}`);
    }
    return Buffer.from(await data.arrayBuffer());
  }

  async getSignedUrl(path: string, expiresInSeconds = 3600): Promise<string> {
    const { data, error } = await this.client.storage.from(this.bucket).createSignedUrl(path, expiresInSeconds);
    if (error) {
      this.logger.error({ path, error: error.message }, 'supabase signed url failed');
      throw new Error(`Failed to create signed URL: ${error.message}`);
    }
    return data.signedUrl;
  }

  getUrl(path: string): string {
    const { data } = this.client.storage.from(this.bucket).getPublicUrl(path);
    return data.publicUrl;
  }

  private guessContentType(path: string): string {
    const ext = path.split('.').pop()?.toLowerCase();
    const map: Record<string, string> = {
      pdf: 'application/pdf',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
      gif: 'image/gif',
      mp3: 'audio/mpeg',
      ogg: 'audio/ogg',
      opus: 'audio/ogg',
      webm: 'audio/webm',
      m4a: 'audio/mp4',
      wav: 'audio/wav',
      mp4: 'video/mp4',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      doc: 'application/msword',
      txt: 'text/plain',
    };
    return map[ext ?? ''] ?? 'application/octet-stream';
  }
}
