import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { z } from 'zod';
import type { PaymentMethod, PaymentStatus } from '../../../generated/prisma/client';
import { TenantId } from '../../../common/auth/tenant-id.decorator';
import { AuthGuard, type RequestPrincipal } from '../../../common/auth/auth.guard';
import { CurrentUser } from '../../../common/auth/current-user.decorator';
import { PermissionGuard } from '../../../common/auth/permission.guard';
import { RequirePermission } from '../../../common/auth/require-permission.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { PaymentsService } from '../application/payments.service';

const methodSchema = z.enum([
  'JAZZCASH',
  'EASYPAISA',
  'CARD_LOCAL',
  'CARD_INTL',
  'BANK_TRANSFER',
  'CASH',
  'OTHER_MANUAL',
]);

const createPaymentSchema = z.object({
  caseId: z.string().uuid().optional(),
  clientId: z.string().uuid(),
  amountCents: z.number().int().min(1),
  currency: z.string().length(3).default('PKR'),
  method: methodSchema,
  description: z.string().max(500).optional(),
  returnUrl: z.string().url().optional().default('https://wakeel.local/dashboard/payments'),
});

const recordManualSchema = z.object({
  caseId: z.string().uuid().optional(),
  clientId: z.string().uuid(),
  amountCents: z.number().int().min(1),
  currency: z.string().length(3).default('PKR'),
  method: z.enum(['BANK_TRANSFER', 'CASH', 'OTHER_MANUAL']),
  description: z.string().max(500).optional(),
  paidAt: z.string().datetime(),
});

const webhookSchema = z.object({
  providerTxnId: z.string().min(1),
  status: z.enum(['SUCCESS', 'FAILURE', 'PENDING']),
  paidAt: z.string().datetime().optional(),
  amountCents: z.number().int().min(0).optional(),
});

type CreatePaymentDto = z.infer<typeof createPaymentSchema>;
type RecordManualDto = z.infer<typeof recordManualSchema>;

/**
 * Payment API (Phase 13). Request electronic payments, record manual/offline
 * receipts, reconcile provider webhooks, and list/refund payments.
 */
@Controller('payments')
@UseGuards(AuthGuard, PermissionGuard)
@RequirePermission('payments:read')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post()
  @RequirePermission('payments:write')
  request(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestPrincipal,
    @Body(new ZodValidationPipe(createPaymentSchema)) body: CreatePaymentDto,
  ) {
    return this.payments.requestPayment(tenantId, { ...body, requestedBy: user.userId });
  }

  @Post('manual')
  @RequirePermission('payments:write')
  recordManual(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestPrincipal,
    @Body(new ZodValidationPipe(recordManualSchema)) body: RecordManualDto,
  ) {
    return this.payments.recordManualPayment(tenantId, {
      ...body,
      paidAt: new Date(body.paidAt),
      recordedBy: user.userId ?? '',
    });
  }

  @Post(':id/received')
  @RequirePermission('payments:write')
  confirmReceived(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.payments.confirmReceived(tenantId, id, user.userId ?? '');
  }

  @Post('webhooks/:method')
  // Webhooks are provider-signed, not user-authenticated; the method name is
  // validated and the adapter parses/signature-checks the payload.
  async webhook(
    @TenantId() tenantId: string,
    @Param('method') method: string,
    @Body(new ZodValidationPipe(webhookSchema)) body: unknown,
  ) {
    return this.payments.processWebhook(tenantId, method as PaymentMethod, body);
  }

  @Get()
  list(
    @TenantId() tenantId: string,
    @Query('caseId') caseId?: string,
    @Query('clientId') clientId?: string,
    @Query('status') status?: string,
  ) {
    return this.payments.list(tenantId, {
      ...(caseId ? { caseId } : {}),
      ...(clientId ? { clientId } : {}),
      ...(status ? { status: status as PaymentStatus } : {}),
    });
  }

  @Get(':id')
  get(@TenantId() tenantId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.payments.getById(tenantId, id);
  }

  @Post(':id/refund')
  @RequirePermission('payments:refund')
  refund(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.payments.refund(tenantId, id, user.userId ?? '');
  }
}
