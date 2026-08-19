import { Module } from '@nestjs/common';
import { LawyersService } from './application/lawyers.service';
import { LawyerProfileService } from './application/lawyer-profile.service';
import { LawyersController } from './interface/lawyers.controller';
import { LawyersMeController } from './interface/lawyers-me.controller';

/**
 * Lawyers — lawyer profiles and weekly availability.
 * Owns: lawyers, lawyer_availability. Publishes: lawyer.created,
 * lawyer.availability.updated. Consumes: Users (via Prisma relation).
 * The whatsappNumber field powers the WhatsApp-template notification channel.
 */
@Module({
  controllers: [LawyersMeController, LawyersController],
  providers: [LawyersService, LawyerProfileService],
  exports: [LawyersService, LawyerProfileService],
})
export class LawyersModule {}