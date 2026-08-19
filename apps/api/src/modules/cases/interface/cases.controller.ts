import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { TenantId } from '../../../common/auth/tenant-id.decorator';
import { AuthGuard } from '../../../common/auth/auth.guard';
import { PermissionGuard } from '../../../common/auth/permission.guard';
import { RequirePermission } from '../../../common/auth/require-permission.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { CasesService } from '../application/cases.service';
import { HearingsService } from '../application/hearings.service';
import {
  assignLawyerSchema,
  createCaseSchema,
  transitionStatusSchema,
  type AssignLawyerInput,
  type CreateCaseInput,
  type TransitionStatusInput,
} from '../application/dto';
import { createHearingSchema, updateHearingSchema, type CreateHearingInput, type UpdateHearingInput } from '../application/hearings.dto';

/**
 * REST surface for Cases. Protected by AuthGuard (Clerk JWT in production,
 * x-tenant-id dev seam otherwise) and PermissionGuard (Phase 10, D-017).
 * Every body is zod-validated at the boundary; every handler resolves tenant
 * from context, never input.
 */
@Controller('cases')
@UseGuards(AuthGuard, PermissionGuard)
@RequirePermission('cases:read')
export class CasesController {
  constructor(
    private readonly cases: CasesService,
    private readonly hearings: HearingsService,
  ) {}

  @Post()
  @RequirePermission('cases:write')
  create(
    @TenantId() tenantId: string,
    @Body(new ZodValidationPipe(createCaseSchema)) body: CreateCaseInput,
  ) {
    return this.cases.create(tenantId, body);
  }

  @Get()
  list(@TenantId() tenantId: string, @Query('status') status: string | undefined) {
    return status === 'all' ? this.cases.listAll(tenantId) : this.cases.listOpen(tenantId);
  }

  @Get('hearings/upcoming')
  listUpcomingHearings(@TenantId() tenantId: string, @Query('days') days?: string) {
    const d = days ? Number(days) : 30;
    return this.hearings.listUpcoming(tenantId, Number.isFinite(d) ? d : 30);
  }

  @Put('hearings/:hearingId')
  @RequirePermission('cases:write')
  updateHearing(
    @TenantId() tenantId: string,
    @Param('hearingId', ParseUUIDPipe) hearingId: string,
    @Body(new ZodValidationPipe(updateHearingSchema)) body: UpdateHearingInput,
  ) {
    return this.hearings.update(tenantId, hearingId, body);
  }

  @Delete('hearings/:hearingId')
  @RequirePermission('cases:write')
  deleteHearing(
    @TenantId() tenantId: string,
    @Param('hearingId', ParseUUIDPipe) hearingId: string,
  ) {
    return this.hearings.delete(tenantId, hearingId);
  }

  @Get(':id')
  async getById(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const found = await this.cases.getById(tenantId, id);
    if (!found) throw new NotFoundException('case not found');
    return found;
  }

  @Post(':id/assign')
  @RequirePermission('cases:write')
  assign(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(assignLawyerSchema)) body: AssignLawyerInput,
  ) {
    return this.cases.assignLawyer(tenantId, id, body);
  }

  @Post(':id/status')
  @RequirePermission('cases:write')
  transition(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(transitionStatusSchema)) body: TransitionStatusInput,
  ) {
    return this.cases.transitionStatus(tenantId, id, body.to);
  }

  @Get(':id/hearings')
  listHearings(@TenantId() tenantId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.hearings.listForCase(tenantId, id);
  }

  @Post(':id/hearings')
  @RequirePermission('cases:write')
  createHearing(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(createHearingSchema)) body: CreateHearingInput,
  ) {
    return this.hearings.create(tenantId, id, body);
  }
}
