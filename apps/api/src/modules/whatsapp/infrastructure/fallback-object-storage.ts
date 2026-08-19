import { Injectable, Logger } from '@nestjs/common';
import type { ObjectStorage } from '../application/ports';

/**
 * Tries cloud storage first; falls back to local filesystem when the bucket is
 * missing or misconfigured (common in local dev with Supabase keys but no bucket).
 */
@Injectable()
export class FallbackObjectStorage implements ObjectStorage {
  private readonly logger = new Logger(FallbackObjectStorage.name);

  constructor(
    private readonly primary: ObjectStorage | null,
    private readonly fallback: ObjectStorage,
  ) {}

  async put(path: string, buffer: Buffer): Promise<{ path: string }> {
    if (this.primary) {
      try {
        await this.primary.put(path, buffer);
      } catch (error) {
        this.logger.warn(
          { path, reason: error instanceof Error ? error.message.slice(0, 200) : String(error) },
          'primary object storage failed — using filesystem fallback',
        );
      }
    }
    // Always write the local copy so api+worker can stream inbox media from a
    // shared volume when the cloud bucket is missing or unreachable.
    return this.fallback.put(path, buffer);
  }

  async get(path: string): Promise<Buffer> {
    try {
      return await this.fallback.get(path);
    } catch {
      if (!this.primary) throw new Error(`media object not found: ${path}`);
    }
    return this.primary.get(path);
  }

  getUrl(path: string): string {
    if (this.primary) {
      try {
        return this.primary.getUrl(path);
      } catch {
        // fall through
      }
    }
    return this.fallback.getUrl(path);
  }
}
