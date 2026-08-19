import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { TenantId } from '../../../common/auth/tenant-id.decorator';
import { AuthGuard, type RequestPrincipal } from '../../../common/auth/auth.guard';
import { CurrentUser } from '../../../common/auth/current-user.decorator';
import { PermissionGuard } from '../../../common/auth/permission.guard';
import { RequirePermission } from '../../../common/auth/require-permission.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { UsersService } from '../application/users.service';
import {
  inviteUserSchema,
  listUsersSchema,
  updateUserSchema,
  type InviteUserInput,
  type ListUsersQuery,
  type UpdateUserInput,
} from '../application/dto';

/**
 * User management REST surface. Protected by AuthGuard + PermissionGuard.
 * Firm admins can invite staff, change roles, and suspend/reactivate users.
 */
@Controller('users')
@UseGuards(AuthGuard, PermissionGuard)
@RequirePermission('users:read')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list(@TenantId() tenantId: string, @Query(new ZodValidationPipe(listUsersSchema)) query: ListUsersQuery) {
    return this.users.list(tenantId, query);
  }

  @Get('roles/list')
  listRoles(@TenantId() tenantId: string) {
    return this.users.listRoles(tenantId);
  }

  @Get(':id')
  async getById(@TenantId() tenantId: string, @Param('id', ParseUUIDPipe) id: string) {
    const found = await this.users.getById(tenantId, id);
    if (!found) throw new NotFoundException('user not found');
    return found;
  }

  @Post()
  @RequirePermission('users:write')
  invite(
    @TenantId() tenantId: string,
    @CurrentUser() principal: RequestPrincipal,
    @Body(new ZodValidationPipe(inviteUserSchema)) body: InviteUserInput,
  ) {
    return this.users.invite(tenantId, body, principal.clerkUserId);
  }

  @Post(':id/resend-invite')
  @RequirePermission('users:write')
  resendInvite(
    @TenantId() tenantId: string,
    @CurrentUser() principal: RequestPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.users.resendInvite(tenantId, id, principal.clerkUserId);
  }

  @Patch(':id')
  @RequirePermission('users:write')
  update(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateUserSchema)) body: UpdateUserInput,
  ) {
    return this.users.update(tenantId, id, body);
  }

  @Post(':id/deactivate')
  @RequirePermission('users:write')
  deactivate(@TenantId() tenantId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.users.deactivate(tenantId, id);
  }

  @Post(':id/reactivate')
  @RequirePermission('users:write')
  reactivate(@TenantId() tenantId: string, @Param('id', ParseUUIDPipe) id: string) {
    return this.users.reactivate(tenantId, id);
  }
}