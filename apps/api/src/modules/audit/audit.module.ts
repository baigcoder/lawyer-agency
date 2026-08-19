import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuditService } from './application/audit.service';
import { AuditInterceptor } from './infrastructure/audit.interceptor';
import { AuditController } from './interface/audit.controller';

/**
 * Audit — append-only audit_logs (privileges revoked at the DB level, not by
 * convention). A global interceptor records every successful mutating
 * request; break-glass and explicit privileged actions call AuditService
 * directly (FR-AUD-01/03). Leaf module; consumed, never imports domain.
 */
@Module({
  controllers: [AuditController],
  providers: [
    AuditService,
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
  exports: [AuditService],
})
export class AuditModule {}