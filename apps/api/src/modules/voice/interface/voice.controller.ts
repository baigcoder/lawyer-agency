import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
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
  @RequirePermission('firm-profile:read')
  previewVoice(@Body(new ZodValidationPipe(voicePreviewInputSchema)) body: VoicePreviewInput) {
    return this.preview.preview(body);
  }
}
