import { Module, type DynamicModule } from '@nestjs/common';
import { WhatsappModule } from '../whatsapp/whatsapp.module';
import { WhatsappPortsModule } from '../whatsapp/whatsapp-ports.module';
import { DocumentsModule } from '../documents/documents.module';
import { PaymentsModule } from '../payments/payments.module';
import { SPEECH_TO_TEXT } from './application/speech-to-text.port';
import { TEXT_TO_SPEECH } from './application/text-to-speech.port';
import { CompositeSttClient } from './infrastructure/composite-stt.client';
import { ElevenLabsSttClient } from './infrastructure/elevenlabs-stt.client';
import { OpenAiWhisperClient } from './infrastructure/openai-whisper.client';
import { ElevenLabsTtsClient } from './infrastructure/elevenlabs-tts.client';
import { WhatsappMediaProcessor } from './application/whatsapp-media.processor';
import { VoiceReplyService } from './application/voice-reply.service';
import { VoicePreviewService } from './application/voice-preview.service';
import { VoiceController } from './interface/voice.controller';

@Module({})
export class VoiceModule {
  static register(role: 'api' | 'worker'): DynamicModule {
    return {
      module: VoiceModule,
      imports: [
        WhatsappPortsModule,
        WhatsappModule.register(role),
        DocumentsModule.register(role),
        PaymentsModule.register(role),
      ],
      controllers: role === 'api' ? [VoiceController] : [],
      providers: [
        OpenAiWhisperClient,
        ElevenLabsSttClient,
        { provide: SPEECH_TO_TEXT, useClass: CompositeSttClient },
        { provide: TEXT_TO_SPEECH, useClass: ElevenLabsTtsClient },
        VoiceReplyService,
        ...(role === 'api' ? [VoicePreviewService] : []),
        ...(role === 'worker' ? [WhatsappMediaProcessor] : []),
      ],
      exports: [VoiceReplyService, SPEECH_TO_TEXT, TEXT_TO_SPEECH],
    };
  }
}
