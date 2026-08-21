import { Module } from '@nestjs/common';
import { CryptoModule } from '../../common/crypto/crypto.module';
import { AuditModule } from '../audit/audit.module';
import { AiLlmModule } from '../ai/ai-llm.module';
import { RagModule } from '../rag/rag.module';
import { FirmProfileService } from './application/firm-profile.service';
import { FirmProfileController } from './interface/firm-profile.controller';
import { FirmProvisioningService } from './application/firm-provisioning.service';
import { FirmProvisioningController } from './interface/firm-provisioning.controller';
import { PaymentDetailsService } from './application/payment-details.service';

@Module({
  imports: [CryptoModule, AuditModule, AiLlmModule, RagModule],
  controllers: [FirmProfileController, FirmProvisioningController],
  providers: [FirmProfileService, FirmProvisioningService, PaymentDetailsService],
  exports: [FirmProfileService, PaymentDetailsService],
})
export class FirmProfileModule {}
