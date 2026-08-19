import { Body, Controller, Headers, HttpCode, Post } from '@nestjs/common';
import { EvolutionWebhookIngestService, type EvolutionWebhookPayload } from '../application/evolution-webhook-ingest.service';

/**
 * Evolution API webhook endpoint. No TenantGuard: the instance name in the
 * payload resolves to the tenant. Mounted under /v1; NGINX exposes via /backend/*.
 */
@Controller('webhooks/evolution')
export class EvolutionWebhookController {
  constructor(private readonly ingest: EvolutionWebhookIngestService) {}

  @Post()
  @HttpCode(200)
  async inbound(
    @Headers('x-evolution-secret') signature: string | undefined,
    @Body() payload: EvolutionWebhookPayload,
  ): Promise<{ received: true }> {
    return this.ingest.ingest(signature, payload);
  }
}
