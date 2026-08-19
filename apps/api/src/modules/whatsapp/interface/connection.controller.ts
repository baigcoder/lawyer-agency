import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { TenantId } from '../../../common/auth/tenant-id.decorator';
import { AuthGuard, type RequestPrincipal } from '../../../common/auth/auth.guard';
import { CurrentUser } from '../../../common/auth/current-user.decorator';
import { PermissionGuard } from '../../../common/auth/permission.guard';
import { RequirePermission } from '../../../common/auth/require-permission.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { OnboardingService } from '../application/onboarding.service';
import { WhatsappUpgradeService } from '../application/whatsapp-upgrade.service';

const initiateUpgradeSchema = z.object({
  returnUrl: z.string().url(),
});

const completeUpgradeSchema = z.object({
  paymentId: z.string().uuid(),
});

/**
 * Phase 3 connection surface (D-092): the official Meta connection state
 * machine's operational endpoints — webhook/go-live health, the admin LIVE
 * gate, and disconnect. Same guard stack as onboarding (whatsapp:manage).
 */
@Controller('whatsapp')
@UseGuards(AuthGuard, PermissionGuard)
@RequirePermission('whatsapp:manage')
export class WhatsappConnectionController {
  constructor(
    private readonly onboarding: OnboardingService,
    private readonly upgrade: WhatsappUpgradeService,
  ) {}

  /** Stage + webhook wiring + go-live checklist for ops/dashboard polling. */
  @Get('health')
  health(@TenantId() tenantId: string) {
    return this.onboarding.health(tenantId);
  }

  /** Admin LIVE gate — only from READY_TO_GO_LIVE with approved templates. */
  @Post('go-live')
  goLive(@TenantId() tenantId: string) {
    return this.onboarding.goLive(tenantId);
  }

  /** Stop official sends: clears the stored token, marks DISCONNECTED. */
  @Post('disconnect')
  disconnect(@TenantId() tenantId: string) {
    return this.onboarding.disconnect(tenantId);
  }

  /** Paid-upgrade status for the official WhatsApp Business API. */
  @Get('upgrade/status')
  upgradeStatus(@TenantId() tenantId: string) {
    return this.upgrade.status(tenantId);
  }

  /** Initiate payment to unlock official WhatsApp. */
  @Post('upgrade/initiate')
  initiateUpgrade(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestPrincipal,
    @Body(new ZodValidationPipe(initiateUpgradeSchema)) body: z.infer<typeof initiateUpgradeSchema>,
  ) {
    return this.upgrade.initiate(tenantId, user.userId ?? tenantId, body.returnUrl);
  }

  /** Complete the upgrade after a successful payment (payment return page). */
  @Post('upgrade/complete')
  completeUpgrade(
    @TenantId() tenantId: string,
    @Body(new ZodValidationPipe(completeUpgradeSchema)) body: z.infer<typeof completeUpgradeSchema>,
  ) {
    return this.upgrade.complete(tenantId, body.paymentId);
  }
}
