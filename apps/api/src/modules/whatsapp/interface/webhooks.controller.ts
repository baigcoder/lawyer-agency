import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { RawBodyRequest, Request } from '@nestjs/common';
import { WebhookIngestService } from '../application/webhook-ingest.service';

/**
 * Meta webhook endpoint. Signature is the authentication here — no
 * TenantGuard (tenant is resolved from the payload AFTER HMAC verification).
 * Mounted under the /v1 prefix; NGINX exposes it via /backend/* (D-038).
 */
@Controller('webhooks/whatsapp')
export class WhatsappWebhookController {
  constructor(private readonly ingest: WebhookIngestService) {}

  @Get()
  verify(
    @Query('hub.mode') mode: string | undefined,
    @Query('hub.verify_token') token: string | undefined,
    @Query('hub.challenge') challenge: string | undefined,
  ): string {
    return this.ingest.verifyChallenge(mode, token, challenge);
  }

  @Post()
  @HttpCode(200)
  async inbound(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-hub-signature-256') signature: string | undefined,
    @Body() payload: unknown,
  ): Promise<{ received: true }> {
    await this.ingest.ingest(req.rawBody, signature, payload);
    return { received: true };
  }
}
