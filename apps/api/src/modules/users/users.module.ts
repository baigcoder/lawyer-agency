import { Module } from '@nestjs/common';
import { UsersService } from './application/users.service';
import { UsersController } from './interface/users.controller';

/**
 * Users — firm staff identity, roles, and management.
 * Owns: users, roles, role_permissions.
 * Phase 10: lazy role/user provisioning via AuthService.
 * Phase 11: active-user list for inbox assignment.
 * Phase 16: full CRUD — invite, role change, suspend/reactivate.
 */
@Module({
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}