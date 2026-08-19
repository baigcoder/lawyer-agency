import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../../config/env';
import { EvolutionApiError } from '../domain/errors';

export interface EvolutionInstance {
  instanceName: string;
  connectionType: 'baileys' | 'cloud_api';
  status: 'disconnected' | 'connecting' | 'connected';
  phoneNumber: string | undefined;
  displayName: string | undefined;
  qrCode: string | undefined;
}

export interface EvolutionSendTextInput {
  instanceName: string;
  to: string;
  text: string;
}

export interface EvolutionSendMediaInput {
  instanceName: string;
  to: string;
  media: string; // URL or base64
  caption: string | undefined;
  mediaType: 'image' | 'document' | 'video' | 'audio' | undefined;
  mimeType?: string | undefined;
  fileName?: string | undefined;
}

@Injectable()
export class EvolutionApiClient {
  private readonly logger = new Logger(EvolutionApiClient.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(config: ConfigService<Env, true>) {
    this.baseUrl = config.get('EVOLUTION_API_BASE_URL', { infer: true });
    this.apiKey = config.get('EVOLUTION_API_KEY', { infer: true });
  }

  async createInstance(instanceName: string, connectionType: 'baileys' | 'cloud_api'): Promise<void> {
    const integration = connectionType === 'cloud_api' ? 'WHATSAPP-CLOUD' : 'WHATSAPP-BAILEYS';
    await this.call('POST', '/instance/create', {
      instanceName,
      token: this.apiKey,
      integration,
      rejectCall: false,
      msgCall: '',
      groupsIgnore: false,
      alwaysOnline: true,
      readMessages: false,
      readStatus: false,
      syncFullHistory: false,
    });
  }

  async setInstanceSettings(instanceName: string): Promise<void> {
    await this.call('POST', `/settings/set/${instanceName}`, {
      rejectCall: false,
      msgCall: '',
      groupsIgnore: false,
      alwaysOnline: true,
      readMessages: false,
      readStatus: false,
      syncFullHistory: false,
    });
  }

  async deleteInstance(instanceName: string): Promise<void> {
    await this.call('DELETE', `/instance/delete/${instanceName}`);
  }

  async logoutInstance(instanceName: string): Promise<void> {
    await this.call('DELETE', `/instance/logout/${instanceName}`);
  }

  /** Logout then delete — clears zombie Baileys sessions before a fresh QR handshake. */
  async resetInstance(instanceName: string): Promise<void> {
    await this.logoutInstance(instanceName).catch(() => {});
    await this.deleteInstance(instanceName).catch(() => {});
  }

  async getConnectionState(instanceName: string): Promise<EvolutionInstance> {
    const stateRaw = await this.call('GET', `/instance/connectionState/${instanceName}`, undefined, {
      notFoundOk: true,
    });
    if (!stateRaw) {
      return {
        instanceName,
        connectionType: 'baileys',
        status: 'disconnected',
        phoneNumber: undefined,
        displayName: undefined,
        qrCode: undefined,
      };
    }

    let live = this.mapConnectionState(instanceName, stateRaw);

    const raw = await this.call('GET', '/instance/fetchInstances').catch(() => []);
    const instances = Array.isArray(raw) ? raw : [];
    const match = instances
      .map((r) => asRecord(r))
      .find((r) => String(r?.name ?? '') === instanceName);

    if (match) {
      live.phoneNumber =
        live.phoneNumber ??
        asString(match.number ?? match.phoneNumber) ??
        phoneFromOwnerJid(match.ownerJid);
      live.displayName = live.displayName ?? asString(match.profileName);
      live.qrCode = live.qrCode ?? asString(match.base64 ?? match.qrcode);

      const loggedOut =
        match.disconnectionReasonCode !== undefined && match.disconnectionReasonCode !== null;
      if (loggedOut && live.status !== 'connecting' && live.status !== 'connected') {
        live.status = 'disconnected';
      }
    }

    return live;
  }

  async connectInstance(instanceName: string): Promise<EvolutionInstance> {
    // Evolution v2: GET (v1 used POST). Returns the pairing QR as `base64`.
    const response = await this.call('GET', `/instance/connect/${instanceName}`);
    return this.mapConnectionState(instanceName, response);
  }

  async sendText(input: EvolutionSendTextInput): Promise<{ wamid: string }> {
    const normalized = this.normalizeNumber(input.to);
    const response = await this.call(
      'POST',
      `/message/sendText/${input.instanceName}`,
      {
        number: normalized,
        text: input.text,
      },
      { timeoutMs: 90_000 },
    );
    return { wamid: this.extractMessageId(response) };
  }

  async sendMedia(input: EvolutionSendMediaInput): Promise<{ wamid: string }> {
    const audioFileName =
      input.mediaType === 'audio'
        ? input.mimeType?.includes('mpeg') || input.mimeType?.includes('mp3')
          ? 'voice.mp3'
          : 'voice.ogg'
        : undefined;
    const response = await this.call(
      'POST',
      `/message/sendMedia/${input.instanceName}`,
      {
        number: this.normalizeNumber(input.to),
        mediatype: input.mediaType ?? 'document',
        media: input.media,
        caption: input.caption,
        fileName: input.fileName ?? (input.mediaType === 'document' ? 'document.pdf' : audioFileName),
        ...(input.mimeType ? { mimetype: input.mimeType } : {}),
      },
      { timeoutMs: 90_000 },
    );
    return { wamid: this.extractMessageId(response) };
  }

  async getBase64FromMediaMessage(input: {
    instanceName: string;
    message: Record<string, unknown>;
  }): Promise<{ buffer: Buffer; mimeType: string }> {
    const response = await this.call(
      'POST',
      `/chat/getBase64FromMediaMessage/${input.instanceName}`,
      { message: input.message, convertToMp4: false },
      { timeoutMs: 90_000 },
    );
    const data = asRecord(response) ?? {};
    const base64 = typeof data.base64 === 'string' ? data.base64 : null;
    const mimeType = typeof data.mimetype === 'string' ? data.mimetype : 'audio/ogg';
    if (!base64) {
      throw new EvolutionApiError('getBase64FromMediaMessage returned no base64 payload');
    }
    return { buffer: Buffer.from(base64, 'base64'), mimeType };
  }

  async setWebhook(instanceName: string, webhookUrl: string, secret: string): Promise<void> {
    // Evolution API v2 shape: the whole config lives under a `webhook` object
    // and event names are UPPER_SNAKE_CASE.
    await this.call('POST', `/webhook/set/${instanceName}`, {
      webhook: {
        url: webhookUrl,
        enabled: true,
        by_events: false,
        events: ['MESSAGES_UPSERT', 'CONNECTION_UPDATE', 'QRCODE_UPDATED', 'STATUS_INSTANCE'],
        headers: {
          'x-evolution-secret': secret,
        },
      },
    });
  }

  private mapConnectionState(instanceName: string, raw: unknown): EvolutionInstance {
    const data = asRecord(raw) ?? {};
    const instanceState = asRecord(data.instance)?.state;
    const state = String(data.state ?? instanceState ?? data.connectionStatus ?? 'disconnected').toLowerCase();
    const qrCode = asString(data.base64 ?? data.qrcode ?? data.code);
    let status: EvolutionInstance['status'] =
      state === 'open' || state === 'connected'
        ? 'connected'
        : state === 'connecting'
          ? 'connecting'
          : 'disconnected';
    // Evolution connect responses carry a QR payload without an explicit state.
    if (qrCode && status === 'disconnected') {
      status = 'connecting';
    }
    return {
      instanceName,
      connectionType: 'baileys', // resolved from our DB record later
      status,
      phoneNumber: asString(data.phoneNumber) ?? phoneFromOwnerJid(data.ownerJid),
      displayName: asString(data.profileName),
      qrCode,
    };
  }

  private extractMessageId(raw: unknown): string {
    const data = asRecord(raw) ?? {};
    const key = asRecord(data.key);
    const messages = Array.isArray(data.messages) ? data.messages : [];
    const firstMessage = asRecord(messages[0]);
    const message = asRecord(data.message);
    const id = key?.id ?? data.messageId ?? data.id ?? firstMessage?.id ?? message?.id ?? 'evolution-unknown';
    return String(id);
  }

  private normalizeNumber(number: string): string {
    return number.replace(/^\+/, '');
  }

  private async call(
    method: 'GET' | 'POST' | 'DELETE',
    path: string,
    body?: Record<string, unknown>,
    options?: { notFoundOk?: boolean; timeoutMs?: number },
  ): Promise<unknown> {
    const url = `${this.baseUrl}${path}`;
    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers: {
          apikey: this.apiKey,
          'content-type': 'application/json',
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(options?.timeoutMs ?? 15_000),
      });
    } catch (error) {
      throw new EvolutionApiError(error instanceof Error ? error.message : 'network failure');
    }

    if (!response.ok) {
      if (options?.notFoundOk && response.status === 404) {
        return null;
      }
      const text = await response.text().catch(() => 'unknown');
      this.logger.warn({ status: response.status, url: path, body: text.slice(0, 200) }, 'evolution api call failed');
      throw new EvolutionApiError(`HTTP ${response.status}: ${text.slice(0, 200)}`);
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      return response.json();
    }
    return { raw: await response.text() };
  }
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function phoneFromOwnerJid(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const phone = value.split('@')[0]?.replace(/\D/g, '');
  return phone && phone.length >= 7 ? phone : undefined;
}
