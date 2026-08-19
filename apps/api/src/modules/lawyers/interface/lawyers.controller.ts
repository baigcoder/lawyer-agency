import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { TenantId } from '../../../common/auth/tenant-id.decorator';
import { AuthGuard } from '../../../common/auth/auth.guard';
import { PermissionGuard } from '../../../common/auth/permission.guard';
import { RequirePermission } from '../../../common/auth/require-permission.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { LawyersService } from '../application/lawyers.service';
import {
  createLawyerSchema,
  setAvailabilitySchema,
  updateLawyerSchema,
  type CreateLawyerInput,
  type SetAvailabilityInput,
  type UpdateLawyerInput,
} from '../application/dto';

@Controller('lawyers')
@UseGuards(AuthGuard, PermissionGuard)
@RequirePermission('lawyers:read')
export class LawyersController {
  constructor(private readonly lawyers: LawyersService) {}

  @Get()
  list(@TenantId() tenantId: string) {
    return this.lawyers.list(tenantId);
  }

  @Get(':id')
  async getById(@TenantId() tenantId: string, @Param('id', ParseUUIDPipe) id: string) {
    const found = await this.lawyers.getById(tenantId, id);
    if (!found) throw new NotFoundException('lawyer not found');
    return found;
  }

  @Post()
  @RequirePermission('lawyers:write')
  create(@TenantId() tenantId: string, @Body(new ZodValidationPipe(createLawyerSchema)) body: CreateLawyerInput) {
    return this.lawyers.create(tenantId, body);
  }

  @Put(':id')
  @RequirePermission('lawyers:write')
  update(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateLawyerSchema)) body: UpdateLawyerInput,
  ) {
    return this.lawyers.update(tenantId, id, body);
  }

  @Put(':id/availability')
  @RequirePermission('lawyers:write')
  setAvailability(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(setAvailabilitySchema)) body: SetAvailabilityInput,
  ) {
    return this.lawyers.setAvailability(tenantId, id, body);
  }
}