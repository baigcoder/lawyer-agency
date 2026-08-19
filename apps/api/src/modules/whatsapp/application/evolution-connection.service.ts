import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../../config/env';
import { UnitOfWork } from '../../../common/prisma/unit-of-work';
import { EvolutionApiClient, type EvolutionInstance } from '../infrastructure/evolution-api.client';
import {
  WHATSAPP_CONNECTION_REPOSITORY,
  type EvolutionConnectionStatus,
  type EvolutionConnectionType,
  type WhatsappConnectionRepository,
} from './ports';
import { EvolutionQrStore } from './evolution-qr.store';

export interface WhatsappConnectionStatus {
  instanceName: string;
  connectionType: EvolutionConnectionType;
  status: EvolutionConnectionStatus;
  phoneNumber: string | null;
  displayName: string | null;
  qrCode: string | null;
}

/**
 * Tenant-scoped WhatsApp connection lifecycle via Evolution API.
 */
@Injectable()
export class EvolutionConnectionService {
  private readonly logger = new Logger(EvolutionConnectionService.name);
  private readonly webhooksEnsured = new Set<string>();

  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly uow: UnitOfWork,
    private readonly evolution: EvolutionApiClient,
    private readonly qrStore: EvolutionQrStore,
    @Inject(WHATSAPP_CONNECTION_REPOSITORY) private readonly connections: WhatsappConnectionRepository,
  ) {}

  async getStatus(tenantId: string, options?: { refreshQr?: boolean }): Promise<WhatsappConnectionStatus> {
    return this.uow.withTenant(tenantId, async (tx) => {
      const connection = await this.connections.findByTenant(tx, tenantId);
      if (!connection) {
        return {
          instanceName: this.defaultInstanceName(tenantId),
          connectionType: 'baileys',
          status: 'disconnected',
          phoneNumber: null,
          displayName: null,
          qrCode: null,
        };
      }

      // Instance was deleted server-side (or the tenant record is stale):
      // treat as a clean disconnected state so the dashboard shows "Connect"
      // instead of a 502. connect() recreates the instance on demand.
      let live: EvolutionInstance;
      try {
        live = await this.evolution.getConnectionState(connection.instanceName);
      } catch (error) {
        if (error instanceof Error && error.message.includes('HTTP 404')) {
          return {
            instanceName: connection.instanceName,
            connectionType: connection.connectionType,
            status: 'disconnected',
            phoneNumber: null,
            displayName: null,
            qrCode: null,
          };
        }
        throw error;
      }
      await this.connections.upsert(tx, tenantId, {
        status: live.status,
        ...(live.phoneNumber ? { phoneNumber: live.phoneNumber } : {}),
        ...(live.displayName ? { displayName: live.displayName } : {}),
      });

      if (live.status === 'connected') {
        void this.ensureWebhook(connection.instanceName);
      }

      // QR rotations arrive via the QRCODE_UPDATED webhook (Evolution owns
      // the rotation). We only bootstrap the handshake — calling connect on
      // every poll would restart Baileys and kill in-flight scans.
      let qrCode = this.qrStore.get(connection.instanceName);
      if (live.status === 'connecting' && (options?.refreshQr || qrCode === null)) {
        const refreshed = await this.evolution.connectInstance(connection.instanceName);
        qrCode = refreshed.qrCode ?? null;
        if (qrCode) this.qrStore.set(connection.instanceName, qrCode);
      }

      return {
        instanceName: connection.instanceName,
        connectionType: connection.connectionType,
        status: live.status,
        phoneNumber: live.phoneNumber ?? connection.phoneNumber,
        displayName: live.displayName ?? connection.displayName,
        qrCode,
      };
    });
  }

  async connect(
    tenantId: string,
    connectionType: EvolutionConnectionType = 'baileys',
  ): Promise<WhatsappConnectionStatus> {
    return this.uow.withTenant(tenantId, async (tx) => {
      const instanceName = this.defaultInstanceName(tenantId);
      const existing = await this.evolution.getConnectionState(instanceName).catch(() => null);

      if (existing?.status === 'connected') {
        await this.connections.upsert(tx, tenantId, {
          instanceName,
          connectionType,
          status: 'connected',
          phoneNumber: existing.phoneNumber ?? null,
          displayName: existing.displayName ?? null,
        });
        await this.configureWebhook(instanceName);
        await this.evolution.setInstanceSettings(instanceName).catch(() => {});
        return {
          instanceName,
          connectionType,
          status: 'connected',
          phoneNumber: existing.phoneNumber ?? null,
          displayName: existing.displayName ?? null,
          qrCode: null,
        };
      }

      // Stale/logged-out instances must be wiped so Baileys starts a clean QR
      // handshake — reusing a broken session leaves the dashboard stuck on
      // "connecting" and outbound sends fail silently.
      await this.evolution.resetInstance(instanceName);
      this.qrStore.clear(instanceName);

      await this.connections.upsert(tx, tenantId, {
        instanceName,
        connectionType,
        status: 'connecting',
      });

      try {
        await this.evolution.createInstance(instanceName, connectionType);
      } catch (error) {
        const message = error instanceof Error ? error.message : '';
        const alreadyExists =
          message.includes('already exists') ||
          message.includes('already in use') ||
          message.includes('HTTP 409') ||
          message.includes('HTTP 403');
        if (!alreadyExists) {
          throw error;
        }
      }
      await this.configureWebhook(instanceName);
      await this.evolution.setInstanceSettings(instanceName).catch(() => {});

      const live = await this.evolution.connectInstance(instanceName);
      await this.connections.upsert(tx, tenantId, {
        status: live.status,
        phoneNumber: live.phoneNumber ?? null,
        displayName: live.displayName ?? null,
      });
      if (live.qrCode) {
        this.qrStore.set(instanceName, live.qrCode);
      }

      return {
        instanceName,
        connectionType,
        status: live.status,
        phoneNumber: live.phoneNumber ?? null,
        displayName: live.displayName ?? null,
        qrCode: live.qrCode ?? null,
      };
    });
  }

  async disconnect(tenantId: string): Promise<WhatsappConnectionStatus> {
    return this.uow.withTenant(tenantId, async (tx) => {
      const connection = await this.connections.findByTenant(tx, tenantId);
      const instanceName = connection?.instanceName ?? this.defaultInstanceName(tenantId);
      const connectionType = connection?.connectionType ?? 'baileys';

      try {
        await this.evolution.resetInstance(instanceName);
      } catch {
        // Instance may already be gone; local row is still removed below.
      }

      this.qrStore.clear(instanceName);
      if (connection) {
        await this.connections.remove(tx, tenantId);
      }

      return {
        instanceName,
        connectionType,
        status: 'disconnected',
        phoneNumber: null,
        displayName: null,
        qrCode: null,
      };
    });
  }

  private defaultInstanceName(tenantId: string): string {
    return `wakeel-${tenantId}`;
  }

  private async ensureWebhook(instanceName: string): Promise<void> {
    if (this.webhooksEnsured.has(instanceName)) return;
    const configured = await this.configureWebhook(instanceName);
    if (configured) this.webhooksEnsured.add(instanceName);
  }

  private async configureWebhook(instanceName: string): Promise<boolean> {
    const serverUrl = this.config.get('EVOLUTION_SERVER_URL', { infer: true });
    const secret = this.config.get('EVOLUTION_WEBHOOK_SECRET', { infer: true });
    try {
      await this.evolution.setWebhook(
        instanceName,
        `${serverUrl}/v1/webhooks/evolution`,
        secret,
      );
      this.logger.log({ instanceName, url: `${serverUrl}/v1/webhooks/evolution` }, 'evolution webhook configured');
      return true;
    } catch (error) {
      this.logger.warn(
        { instanceName, error: error instanceof Error ? error.message : String(error) },
        'failed to set Evolution webhook — inbound WhatsApp messages will not reach the AI',
      );
      return false;
    }
  }
}
