import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { TenantId } from '../../../common/auth/tenant-id.decorator';
import { AuthGuard } from '../../../common/auth/auth.guard';
import { PermissionGuard } from '../../../common/auth/permission.guard';
import { RequirePermission } from '../../../common/auth/require-permission.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import {
  DocumentRequestsService,
  createDocumentRequestSchema,
  fulfilDocumentRequestSchema,
} from '../application/document-requests.service';

const listQuerySchema = z.object({
  status: z.enum(['PENDING', 'FULFILLED', 'CANCELLED']).optional(),
});

/**
 * Document requests (Phase 5 firm ops). Scoped to a case; fulfilment links an
 * uploaded document. Reuses case permissions — requesting documents is case
 * work, not a separate privilege surface.
 */
@Controller('document-requests')
@UseGuards(AuthGuard, PermissionGuard)
@RequirePermission('cases:read')
export class DocumentRequestsController {
  constructor(private readonly requests: DocumentRequestsService) {}

  @Get()
  list(
    @TenantId() tenantId: string,
    @Query(new ZodValidationPipe(listQuerySchema)) query: z.infer<typeof listQuerySchema>,
  ) {
    return this.requests.list(tenantId, query.status);
  }

  @Post()
  create(
    @TenantId() tenantId: string,
    @Body(new ZodValidationPipe(createDocumentRequestSchema))
    body: z.infer<typeof createDocumentRequestSchema>,
  ) {
    return this.requests.create(tenantId, body);
  }

  @Post(':id/fulfil')
  fulfil(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(fulfilDocumentRequestSchema))
    body: z.infer<typeof fulfilDocumentRequestSchema>,
  ) {
    return this.requests.fulfil(tenantId, id, body.documentId);
  }

  @Post(':id/cancel')
  cancel(@TenantId() tenantId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.requests.cancel(tenantId, id);
  }
}
