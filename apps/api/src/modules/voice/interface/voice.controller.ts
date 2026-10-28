import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthGuard } from '../../../common/auth/auth.guard';
import { PermissionGuard } from '../../../common/auth/permission.guard';
import { RequirePermission } from '../../../common/auth/require-permission.decorator';
import { ZodValidationPipe } from '../../../common/pipes/zod-validation.pipe';
import { VoicePreviewService, voicePreviewInputSchema, type VoicePreviewInput } from '../application/voice-preview.service';

@Controller('voice')
@UseGuards(AuthGuard, PermissionGuard)
export class VoiceController {
  constructor(private readonly preview: VoicePreviewService) {}

  @Get('voices')
  @RequirePermission('firm-profile:read')
  listVoices() {
    return this.preview.listVoices();
  }

  @Post('preview')
  // Every preview is a paid TTS call.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @RequirePermission('firm-profile:read')
  previewVoice(@Body(new ZodValidationPipe(voicePreviewInputSchema)) body: VoicePreviewInput) {
    return this.preview.preview(body);
  }
}
