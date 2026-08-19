import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env';
import { CryptoService } from './crypto.service';

const KEY = 'a'.repeat(64);
// Minimal typed stub: CryptoService reads exactly one key at construction.
const config = { get: () => KEY } as ConfigService<Env, true>;

describe('CryptoService (D-024)', () => {
  const crypto = new CryptoService(config);

  it('roundtrips AES-256-GCM with random nonces (same plaintext, different ciphertext)', () => {
    const a = crypto.encrypt('waba-access-token-123');
    const b = crypto.encrypt('waba-access-token-123');
    expect(a).not.toBe(b);
    expect(crypto.decrypt(a)).toBe('waba-access-token-123');
    expect(crypto.decrypt(b)).toBe('waba-access-token-123');
  });

  it('rejects tampered ciphertext (GCM auth tag)', () => {
    const packed = Buffer.from(crypto.encrypt('secret'), 'base64url');
    packed[20] = packed[20]! ^ 0xff;
    expect(() => crypto.decrypt(packed.toString('base64url'))).toThrow();
  });

  it('verifies x-hub-signature-256 (valid, tampered, malformed)', () => {
    const payload = Buffer.from('{"object":"whatsapp_business_account"}');
    const good = `sha256=${createHmac('sha256', 'app-secret').update(payload).digest('hex')}`;

    expect(crypto.verifyHmacSha256('app-secret', payload, good)).toBe(true);
    expect(crypto.verifyHmacSha256('wrong-secret', payload, good)).toBe(false);
    expect(crypto.verifyHmacSha256('app-secret', Buffer.from('tampered'), good)).toBe(false);
    expect(crypto.verifyHmacSha256('app-secret', payload, 'sha256=zzzz')).toBe(false);
    expect(crypto.verifyHmacSha256('app-secret', payload, 'no-prefix')).toBe(false);
  });
});
