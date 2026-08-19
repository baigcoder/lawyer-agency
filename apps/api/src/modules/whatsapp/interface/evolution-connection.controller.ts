import { Body, Controller, Delete, Get, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../../common/auth/auth.guard';
import { PermissionGuard } from '../../../common/auth/permission.guard';
import { RequirePermission } from '../../../common/auth/require-permission.decorator';
import { TenantId } from '../../../common/auth/tenant-id.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { z } from 'zod';
import { MessagesService } from '../../messages/application/messages.service';
import { EvolutionConnectionService } from '../application/evolution-connection.service';

const connectSchema = z.object({
  connectionType: z.enum(['baileys', 'cloud_api']).default('baileys'),
});

type ConnectInput = z.infer<typeof connectSchema>;

const testInboundSchema = z.object({
  fromWaPhone: z.string().trim().min(7).max(15),
  body: z.string().trim().min(1).max(500),
});

type TestInboundInput = z.infer<typeof testInboundSchema>;

/**
 * WhatsApp requires E.164 numbers. Pakistani users habitually type local
 * format (0300…); normalize to international form before the number is stored
 * or used as a JID (a leading-zero JID like 0300…@s.whatsapp.net is invalid).
 */
function normalizeWaPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('0') && digits.length >= 10) {
    return `92${digits.slice(1)}`;
  }
  return digits;
}

@Controller('whatsapp/connection')
@UseGuards(AuthGuard, PermissionGuard)
export class EvolutionConnectionController {
  constructor(
    private readonly connection: EvolutionConnectionService,
    private readonly messages: MessagesService,
  ) {}

  @Get()
  @RequirePermission('whatsapp:read')
  getStatus(@TenantId() tenantId: string, @Query('refreshQr') refreshQr: string | undefined) {
    return this.connection.getStatus(tenantId, { refreshQr: refreshQr === '1' || refreshQr === 'true' });
  }

  @Post()
  @RequirePermission('whatsapp:manage')
  connect(
    @TenantId() tenantId: string,
    @Body(new ZodValidationPipe(connectSchema)) body: ConnectInput,
  ) {
    return this.connection.connect(tenantId, body.connectionType);
  }

  @Delete()
  @RequirePermission('whatsapp:manage')
  disconnect(@TenantId() tenantId: string) {
    return this.connection.disconnect(tenantId);
  }

  @Post('test-inbound')
  @RequirePermission('whatsapp:manage')
  async testInbound(
    @TenantId() tenantId: string,
    @Body(new ZodValidationPipe(testInboundSchema)) body: TestInboundInput,
  ): Promise<{ conversationId: string; messageId: string }> {
    const result = await this.messages.recordInbound(tenantId, {
      wamid: `test-${Date.now()}`,
      fromWaPhone: normalizeWaPhone(body.fromWaPhone),
      fromDisplayName: null,
      contentType: 'TEXT',
      body: body.body,
      mediaId: null,
      payload: { source: 'test-inbound' },
      sentAt: new Date(),
    });
    return { conversationId: result.conversationId, messageId: result.messageId };
  }
}
