import { Injectable } from '@nestjs/common';

/**
 * In-memory QR relay for Evolution pairing. Evolution rotates pairing QRs on
 * its own and pushes each one via the QRCODE_UPDATED webhook; polling
 * /instance/connect instead would restart the Baileys handshake and kill
 * in-flight scans. The ingest service writes; the connection service reads.
 * Single-replica assumption (compose runs one api process).
 */
@Injectable()
export class EvolutionQrStore {
  private readonly qrByInstance = new Map<string, { qr: string | null; updatedAt: number }>();

  set(instanceName: string, qr: string | null): void {
    this.qrByInstance.set(instanceName, { qr, updatedAt: Date.now() });
  }

  get(instanceName: string): string | null {
    return this.qrByInstance.get(instanceName)?.qr ?? null;
  }

  clear(instanceName: string): void {
    this.qrByInstance.delete(instanceName);
  }
}
