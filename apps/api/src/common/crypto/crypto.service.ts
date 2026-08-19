import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Env } from '../../config/env';

/**
 * Column-level encryption (D-024): AES-256-GCM with a random 96-bit nonce
 * per ciphertext. Format: base64url(nonce | ciphertext | authTag).
 * Used for per-tenant secrets (WABA access tokens) so a database dump alone
 * never yields usable credentials. Key comes from env (KMS in Phase 15).
 */
@Injectable()
export class CryptoService {
  private readonly key: Buffer;

  constructor(config: ConfigService<Env, true>) {
    // Presence + format are enforced at boot by env validation; the runtime
    // guard keeps the type honest without a cast.
    const keyHex = config.get<string>('MASTER_ENCRYPTION_KEY');
    if (typeof keyHex !== 'string' || keyHex.length !== 64) {
      throw new Error('MASTER_ENCRYPTION_KEY missing or malformed (env validation should have caught this)');
    }
    this.key = Buffer.from(keyHex, 'hex');
  }

  encrypt(plaintext: string): string {
    const nonce = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, nonce);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([nonce, ciphertext, tag]).toString('base64url');
  }

  decrypt(encoded: string): string {
    const packed = Buffer.from(encoded, 'base64url');
    const nonce = packed.subarray(0, 12);
    const tag = packed.subarray(packed.length - 16);
    const ciphertext = packed.subarray(12, packed.length - 16);
    const decipher = createDecipheriv('aes-256-gcm', this.key, nonce);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  }

  /** Constant-time HMAC-SHA256 check for webhook signatures (x-hub-signature-256). */
  verifyHmacSha256(secret: string, payload: Buffer, signatureHeader: string): boolean {
    const expected = createHmac('sha256', secret).update(payload).digest();
    const prefix = 'sha256=';
    if (!signatureHeader.startsWith(prefix)) return false;
    let received: Buffer;
    try {
      received = Buffer.from(signatureHeader.slice(prefix.length), 'hex');
    } catch {
      return false;
    }
    if (received.length !== expected.length) return false;
    return timingSafeEqual(received, expected);
  }
}
