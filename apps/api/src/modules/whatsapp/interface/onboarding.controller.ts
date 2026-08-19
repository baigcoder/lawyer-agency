import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { TenantId } from '../../../common/auth/tenant-id.decorator';
import { AuthGuard } from '../../../common/auth/auth.guard';
import { PermissionGuard } from '../../../common/auth/permission.guard';
import { RequirePermission } from '../../../common/auth/require-permission.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { OnboardingService } from '../application/onboarding.service';

const completeSchema = z.object({ code: z.string().min(1, 'Meta authorization code is required') });

/**
 * WhatsApp Embedded Signup onboarding (Phase 6b). Protected by
 * AuthGuard/PermissionGuard (Phase 10, D-017).
 */
@Controller('whatsapp/onboarding')
@UseGuards(AuthGuard, PermissionGuard)
@RequirePermission('whatsapp:manage')
export class WhatsappOnboardingController {
  constructor(private readonly onboarding: OnboardingService) {}

  @Get('start')
  start(@TenantId() tenantId: string) {
    return this.onboarding.start(tenantId);
  }

  @Get('status')
  status(@TenantId() tenantId: string) {
    return this.onboarding.connectionStatus(tenantId);
  }

  @Post('complete')
  complete(
    @TenantId() tenantId: string,
    @Body(new ZodValidationPipe(completeSchema)) body: z.infer<typeof completeSchema>,
  ) {
    return this.onboarding.complete(tenantId, body.code);
  }
}
