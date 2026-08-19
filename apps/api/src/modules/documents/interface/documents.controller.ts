import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { z } from 'zod';
import { AuthGuard } from '../../../common/auth/auth.guard';
import { TenantId } from '../../../common/auth/tenant-id.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { DocumentsService } from '../application/documents.service';
import { DocumentRoleGuard } from './document-role.guard';
import { UnitOfWork } from '../../../common/prisma/unit-of-work';

const uploadSchema = z.object({
  clientId: z.string().uuid().optional(),
  caseId: z.string().uuid().optional(),
  description: z.string().max(500).optional(),
  docType: z.enum(['CNIC', 'FIR', 'COURT_NOTICE', 'AFFIDAVIT', 'CONTRACT', 'EVIDENCE_PHOTO', 'PAYMENT_PROOF', 'RECEIPT', 'OTHER']).default('OTHER'),
}).refine((data) => data.clientId || data.caseId, {
  message: 'Either clientId or caseId is required',
  path: ['clientId'],
});

type UploadInput = z.infer<typeof uploadSchema>;

const pinSchema = z.object({ isPinned: z.boolean() });

type PinInput = z.infer<typeof pinSchema>;

@Controller('documents')
@UseGuards(AuthGuard, DocumentRoleGuard)
export class DocumentsController {
  constructor(
    private readonly documents: DocumentsService,
    private readonly uow: UnitOfWork,
  ) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @TenantId() tenantId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body(new ZodValidationPipe(uploadSchema)) body: UploadInput,
  ) {
    if (!file) throw new Error('File is required');
    const clientId = body.clientId ?? await this.resolveClientId(tenantId, body.caseId);
    if (!clientId) throw new Error('Could not resolve client for document');
    return this.documents.upload({
      tenantId,
      clientId,
      caseId: body.caseId ?? undefined,
      filename: file.originalname,
      description: body.description ?? undefined,
      docType: body.docType,
      buffer: file.buffer,
      mimeType: file.mimetype,
    });
  }

  private async resolveClientId(tenantId: string, caseId: string | undefined): Promise<string | undefined> {
    if (!caseId) return undefined;
    return this.uow.withTenant(tenantId, async (tx) => {
      const c = await tx.case.findUnique({ where: { id: caseId }, select: { clientId: true } });
      return c?.clientId;
    });
  }

  @Get('clients/list')
  listClients(@TenantId() tenantId: string) {
    return this.documents.listClients(tenantId);
  }

  @Get('client/:clientId')
  listForClient(@TenantId() tenantId: string, @Param('clientId', ParseUUIDPipe) clientId: string) {
    return this.documents.listForClient(tenantId, clientId);
  }

  @Get('case/:caseId')
  listForCase(@TenantId() tenantId: string, @Param('caseId', ParseUUIDPipe) caseId: string) {
    return this.documents.listForCase(tenantId, caseId);
  }

  @Put(':id/pin')
  togglePin(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(pinSchema)) body: PinInput,
  ) {
    return this.documents.togglePin(tenantId, id, body.isPinned);
  }
}
