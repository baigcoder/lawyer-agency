import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { Env } from '../../../config/env';
import type { ObjectStorage } from '../application/ports';

/**
 * Dev object-storage stand-in: writes tenant-scoped files under
 * MEDIA_STORAGE_PATH. NOT for production — replace with Supabase/S3 adapter.
 */
@Injectable()
export class FilesystemObjectStorage implements ObjectStorage {
  private readonly logger = new Logger(FilesystemObjectStorage.name);
  private readonly basePath: string;

  constructor(config: ConfigService<Env, true>) {
    this.basePath = config.get('MEDIA_STORAGE_PATH', { infer: true });
  }

  async put(path: string, buffer: Buffer): Promise<{ path: string }> {
    const fullPath = join(this.basePath, path);
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, buffer);
    this.logger.debug({ path, bytes: buffer.length }, 'stored media object');
    return { path };
  }

  async get(path: string): Promise<Buffer> {
    return readFile(join(this.basePath, path));
  }

  getUrl(path: string): string {
    return `file://${join(this.basePath, path)}`;
  }
}
