import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { TenantId } from '../../../common/auth/tenant-id.decorator';
import { AuthGuard, type RequestPrincipal } from '../../../common/auth/auth.guard';
import { CurrentUser } from '../../../common/auth/current-user.decorator';
import { PermissionGuard } from '../../../common/auth/permission.guard';
import { RequirePermission } from '../../../common/auth/require-permission.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { LawyerProfileService } from '../application/lawyer-profile.service';
import {
  createCaseHighlightSchema,
  lawyerProfileSchema,
  updateCaseHighlightSchema,
  type CreateCaseHighlightInput,
  type LawyerProfileInput,
  type UpdateCaseHighlightInput,
} from '../application/dto';

function requireUserId(user: RequestPrincipal): string {
  if (!user.userId) throw new UnauthorizedException('User context required');
  return user.userId;
}

@Controller('lawyers/me')
@UseGuards(AuthGuard, PermissionGuard)
@RequirePermission('lawyers:read')
export class LawyersMeController {
  constructor(private readonly profiles: LawyerProfileService) {}

  @Get('profile')
  getProfile(@TenantId() tenantId: string, @CurrentUser() user: RequestPrincipal) {
    return this.profiles.getMyProfile(tenantId, requireUserId(user));
  }

  @Put('profile')
  @RequirePermission('lawyers:write')
  updateProfile(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestPrincipal,
    @Body(new ZodValidationPipe(lawyerProfileSchema)) body: LawyerProfileInput,
  ) {
    const permissions = user.permissions ?? [];
    const canCreateLawyer = permissions.includes('*') || permissions.includes('users:manage');
    return this.profiles.updateMyProfile(tenantId, requireUserId(user), body, canCreateLawyer);
  }

  @Get('closed-cases')
  listClosedCases(@TenantId() tenantId: string, @CurrentUser() user: RequestPrincipal) {
    return this.profiles.listClosedCasesForPicker(tenantId, requireUserId(user));
  }

  @Post('case-highlights')
  @RequirePermission('lawyers:write')
  createHighlight(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestPrincipal,
    @Body(new ZodValidationPipe(createCaseHighlightSchema)) body: CreateCaseHighlightInput,
  ) {
    return this.profiles.createCaseHighlight(tenantId, requireUserId(user), body);
  }

  @Put('case-highlights/:id')
  @RequirePermission('lawyers:write')
  updateHighlight(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateCaseHighlightSchema)) body: UpdateCaseHighlightInput,
  ) {
    return this.profiles.updateCaseHighlight(tenantId, requireUserId(user), id, body);
  }

  @Delete('case-highlights/:id')
  @RequirePermission('lawyers:write')
  deleteHighlight(
    @TenantId() tenantId: string,
    @CurrentUser() user: RequestPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.profiles.deleteCaseHighlight(tenantId, requireUserId(user), id);
  }
}
