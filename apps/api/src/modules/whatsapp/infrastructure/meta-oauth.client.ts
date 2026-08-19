import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import type { Env } from '../../../config/env';
import { MetaApiError } from '../domain/errors';
import type { MetaOAuthClient, OAuthToken, WabaInfo } from '../application/ports';

const tokenResponseSchema = z.looseObject({
  access_token: z.string(),
  expires_in: z.number().optional(),
});

const phoneNumberSchema = z.looseObject({
  id: z.string(),
  display_phone_number: z.string(),
  verified_name: z.string().optional(),
});

const wabaInfoSchema = z.looseObject({
  id: z.string(),
  phone_numbers: z.union([z.array(phoneNumberSchema).min(1), z.looseObject({ data: z.array(phoneNumberSchema).min(1) })]),
});

/**
 * Meta Embedded Signup OAuth adapter (D-002). Exchanges the short-lived code
 * from the frontend SDK for a WABA access token, then resolves the WABA and
 * phone number to complete onboarding. The only place that knows these wire
 * shapes; the rest of the app sees WabaInfo / OAuthToken.
 */
@Injectable()
export class MetaOAuthClientImpl implements MetaOAuthClient {
  private readonly logger = new Logger(MetaOAuthClientImpl.name);
  private readonly baseUrl: string;

  private readonly appId: string | undefined;
  private readonly appSecret: string | undefined;
  private readonly redirectUri: string | undefined;

  constructor(config: ConfigService<Env, true>) {
    this.baseUrl = config.get('META_GRAPH_BASE_URL', { infer: true });
    this.appId = config.get('META_APP_ID', { infer: true });
    this.appSecret = config.get('META_APP_SECRET', { infer: true });
    this.redirectUri = config.get('META_REDIRECT_URI', { infer: true });
  }

  async exchangeCode(code: string): Promise<OAuthToken> {
    if (!this.appId || !this.appSecret) {
      throw new MetaApiError(null, 'META_APP_ID and META_APP_SECRET must be configured for Embedded Signup');
    }
    const url = `${this.baseUrl}/oauth/access_token`;
    const params = new URLSearchParams({
      client_id: this.appId,
      client_secret: this.appSecret,
      code,
      grant_type: 'authorization_code',
    });
    if (this.redirectUri) {
      params.set('redirect_uri', this.redirectUri);
    }
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: params,
        signal: AbortSignal.timeout(10_000),
      });
    } catch (error) {
      throw new MetaApiError(null, error instanceof Error ? error.message : 'oauth network failure');
    }
    const body = await this.parseBody(response);
    const parsed = tokenResponseSchema.safeParse(body);
    if (!response.ok || !parsed.success) {
      this.logger.warn({ status: response.status }, 'oauth code exchange failed');
      throw new MetaApiError(null, `oauth exchange HTTP ${response.status}`);
    }
    return {
      accessToken: parsed.data.access_token,
      expiresAt: parsed.data.expires_in ? new Date(Date.now() + parsed.data.expires_in * 1000) : undefined,
    };
  }

  async getWabaInfo(accessToken: string): Promise<WabaInfo> {
    const url = `${this.baseUrl}/me/whatsapp_business_management?access_token=${encodeURIComponent(accessToken)}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    const body = await this.parseBody(response);
    const parsed = wabaInfoSchema.safeParse(body);
    if (!response.ok || !parsed.success) {
      this.logger.warn({ status: response.status, parseError: parsed.success ? undefined : parsed.error.format() }, 'waba info fetch failed');
      throw new MetaApiError(null, `waba info HTTP ${response.status}`);
    }
    const phoneNumbers = Array.isArray(parsed.data.phone_numbers)
      ? parsed.data.phone_numbers
      : parsed.data.phone_numbers.data;
    const primary = phoneNumbers[0];
    if (!primary) throw new MetaApiError(null, 'no phone numbers on WABA');
    return {
      wabaId: parsed.data.id,
      phoneNumberId: primary.id,
      displayPhoneNumber: primary.display_phone_number,
    };
  }

  private async parseBody(response: Response): Promise<unknown> {
    return response.json().catch(() => null);
  }
}
