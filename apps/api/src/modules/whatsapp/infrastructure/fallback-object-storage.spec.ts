import { describe, expect, it, vi } from 'vitest';
import { FallbackObjectStorage } from './fallback-object-storage';
import type { ObjectStorage } from '../application/ports';

describe('FallbackObjectStorage', () => {
  it('writes through to filesystem even when primary upload succeeds', async () => {
    const primary = {
      put: vi.fn(async () => ({ path: 'cloud/x' })),
      get: vi.fn(async () => Buffer.from('cloud')),
      getUrl: vi.fn(() => 'https://cdn/x'),
    };
    const fallback = {
      put: vi.fn(async () => ({ path: 'local/x' })),
      get: vi.fn(async () => Buffer.from('local')),
      getUrl: vi.fn(() => 'file:///x'),
    };
    const storage = new FallbackObjectStorage(primary as unknown as ObjectStorage, fallback as unknown as ObjectStorage);
    const result = await storage.put('x', Buffer.from('a'));
    expect(result.path).toBe('local/x');
    expect(primary.put).toHaveBeenCalled();
    expect(fallback.put).toHaveBeenCalled();
  });

  it('falls back to filesystem when primary upload fails', async () => {
    const primary = {
      put: vi.fn(async () => {
        throw new Error('Failed to upload object: Bucket not found');
      }),
      get: vi.fn(async () => {
        throw new Error('not found');
      }),
      getUrl: vi.fn(() => 'https://cdn/x'),
    };
    const fallback = {
      put: vi.fn(async () => ({ path: 'local/x' })),
      get: vi.fn(async () => Buffer.from('local')),
      getUrl: vi.fn(() => 'file:///x'),
    };
    const storage = new FallbackObjectStorage(primary as unknown as ObjectStorage, fallback as unknown as ObjectStorage);
    const result = await storage.put('x', Buffer.from('a'));
    expect(result.path).toBe('local/x');
  });

  it('reads local filesystem before primary', async () => {
    const primary = {
      put: vi.fn(),
      get: vi.fn(async () => Buffer.from('cloud')),
      getUrl: vi.fn(() => 'https://cdn/x'),
    };
    const fallback = {
      put: vi.fn(),
      get: vi.fn(async () => Buffer.from('voice')),
      getUrl: vi.fn(() => 'file:///x'),
    };
    const storage = new FallbackObjectStorage(primary as unknown as ObjectStorage, fallback as unknown as ObjectStorage);
    const buf = await storage.get('tenants/t1/media/msg.ogg');
    expect(buf.toString()).toBe('voice');
    expect(primary.get).not.toHaveBeenCalled();
  });
});
