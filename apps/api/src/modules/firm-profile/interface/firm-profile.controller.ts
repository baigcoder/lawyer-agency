import { Body, Controller, Get, Post, Put, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { AuthGuard } from '../../../common/auth/auth.guard';
import { PermissionGuard } from '../../../common/auth/permission.guard';
import { RequirePermission } from '../../../common/auth/require-permission.decorator';
import { TenantId } from '../../../common/auth/tenant-id.decorator';
import { CurrentUser } from '../../../common/auth/current-user.decorator';
import type { RequestPrincipal } from '../../../common/auth/auth.guard';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { AuditService } from '../../audit/application/audit.service';
import { firmProfileSchema, type FirmProfileInput } from '../application/dto';
import { aiSettingsSchema, generateIntroInputSchema } from '../application/ai-settings.dto';
import { FirmProfileService } from '../application/firm-profile.service';
import { PaymentDetailsService } from '../application/payment-details.service';
import { paymentDetailsSchema } from '../application/payment-details.dto';
import { GreetingIntroGeneratorService } from '../../ai/application/greeting-intro-generator.service';

const aiAutoReplySchema = z.object({
  aiAutoReplyEnabled: z.boolean(),
});

type AiAutoReplyInput = z.infer<typeof aiAutoReplySchema>;

@Controller('firm-profile')
@UseGuards(AuthGuard, PermissionGuard)
export class FirmProfileController {
  constructor(
    private readonly profile: FirmProfileService,
    private readonly paymentDetails: PaymentDetailsService,
    private readonly audit: AuditService,
    private readonly introGenerator: GreetingIntroGeneratorService,
  ) {}

  @Get()
  @RequirePermission('firm-profile:read')
  get(@TenantId() tenantId: string) { return this.profile.get(tenantId); }

  @Put()
  @RequirePermission('users:manage')
  update(@TenantId() tenantId: string, @Body(new ZodValidationPipe(firmProfileSchema)) body: FirmProfileInput) {
    return this.profile.update(tenantId, body);
  }

  @Get('ai-auto-reply')
  @RequirePermission('firm-profile:read')
  getAiAutoReply(@TenantId() tenantId: string) {
    return this.profile.getAiAutoReply(tenantId);
  }

  @Put('ai-auto-reply')
  @RequirePermission('users:manage')
  setAiAutoReply(
    @TenantId() tenantId: string,
    @Body(new ZodValidationPipe(aiAutoReplySchema)) body: AiAutoReplyInput,
  ) {
    return this.profile.setAiAutoReply(tenantId, body.aiAutoReplyEnabled);
  }

  @Get('ai-settings')
  @RequirePermission('firm-profile:read')
  getAiSettings(@TenantId() tenantId: string) {
    return this.profile.getAiSettings(tenantId);
  }

  @Put('ai-settings')
  @RequirePermission('users:manage')
  setAiSettings(
    @TenantId() tenantId: string,
    @Body(new ZodValidationPipe(aiSettingsSchema)) body: z.infer<typeof aiSettingsSchema>,
  ) {
    return this.profile.setAiSettings(tenantId, body);
  }

  @Post('ai-settings/generate-intro')
  @RequirePermission('users:manage')
  async generateIntro(
    @TenantId() tenantId: string,
    @Body(new ZodValidationPipe(generateIntroInputSchema)) body: { language: 'en' | 'ur' },
  ) {
    const firm = await this.profile.get(tenantId);
    const result = await this.introGenerator.generate(
      tenantId,
      {
        displayName: firm.displayName,
        city: firm.city,
        practiceAreas: firm.practiceAreas,
        firmAbout: firm.firmAbout,
      },
      body.language,
    );
    return {
      language: body.language,
      intro: result.intro,
      source: result.source,
    };
  }

  @Get('payment-details')
  @RequirePermission('firm-profile:read')
  getPaymentDetails(@TenantId() tenantId: string) {
    return this.paymentDetails.get(tenantId);
  }

  @Put('payment-details')
  @RequirePermission('users:manage')
  async setPaymentDetails(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestPrincipal,
    @Body(new ZodValidationPipe(paymentDetailsSchema)) body: z.infer<typeof paymentDetailsSchema>,
  ) {
    const result = await this.paymentDetails.update(tenantId, body);
    await this.audit.record(tenantId, {
      actorType: 'USER',
      actorId: user.userId ?? null,
      action: 'firm.payment_details.updated',
      entityType: 'firm_payment_details',
      entityId: tenantId,
    });
    return result;
  }
}
