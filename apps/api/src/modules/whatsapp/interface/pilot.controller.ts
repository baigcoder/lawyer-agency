import { Body, Controller, Get, HttpCode, Post, Put, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { TenantId } from '../../../common/auth/tenant-id.decorator';
import { AuthGuard } from '../../../common/auth/auth.guard';
import { PermissionGuard } from '../../../common/auth/permission.guard';
import { RequirePermission } from '../../../common/auth/require-permission.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import {
  PilotApiService,
  pilotAllowlistResponseSchema,
  pilotAllowlistSchema,
  pilotPairResponseSchema,
  pilotQrSchema,
  pilotStatusSchema,
  pilotTestInboundResponseSchema,
  pilotTestInboundSchema,
} from '../application/pilot-api.service';

/**
 * Pilot bridge surface (D-092): pair / QR / status / allowlist / disconnect.
 * Same guard stack as the official onboarding flow (whatsapp:manage).
 */
@Controller('whatsapp/pilot')
@UseGuards(AuthGuard, PermissionGuard)
@RequirePermission('whatsapp:manage')
export class WhatsappPilotController {
  constructor(private readonly pilot: PilotApiService) {}

  @Post('pair')
  @HttpCode(200)
  async pair(@TenantId() tenantId: string): Promise<z.infer<typeof pilotPairResponseSchema>> {
    return this.pilot.pair(tenantId);
  }

  @Get('qr')
  async qr(@TenantId() tenantId: string): Promise<z.infer<typeof pilotQrSchema>> {
    return this.pilot.qr(tenantId);
  }

  @Get('status')
  async status(@TenantId() tenantId: string): Promise<z.infer<typeof pilotStatusSchema>> {
    return this.pilot.status(tenantId);
  }

  @Put('allowlist')
  async allowlist(
    @TenantId() tenantId: string,
    @Body(new ZodValidationPipe(pilotAllowlistSchema)) body: z.infer<typeof pilotAllowlistSchema>,
  ): Promise<z.infer<typeof pilotAllowlistResponseSchema>> {
    return this.pilot.setAllowlist(tenantId, body.entries);
  }

  @Post('disconnect')
  @HttpCode(200)
  async disconnect(@TenantId() tenantId: string): Promise<{ status: 'DISCONNECTED' }> {
    return this.pilot.disconnect(tenantId);
  }

  @Post('test-inbound')
  @HttpCode(200)
  async testInbound(
    @TenantId() tenantId: string,
    @Body(new ZodValidationPipe(pilotTestInboundSchema)) body: z.infer<typeof pilotTestInboundSchema>,
  ): Promise<z.infer<typeof pilotTestInboundResponseSchema>> {
    return this.pilot.testInbound(tenantId, body);
  }
}
