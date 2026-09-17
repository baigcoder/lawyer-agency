import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ResourceLockService } from './resource-lock.service';

/**
 * Global so any module can serialise work on a shared resource without a new
 * import edge — the same shape as QueueModule, which also wraps a Redis
 * connection every role needs.
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [ResourceLockService],
  exports: [ResourceLockService],
})
export class LocksModule {}
