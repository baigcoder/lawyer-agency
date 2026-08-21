import { Module, type DynamicModule } from '@nestjs/common';
import { AppointmentsModule } from '../appointments/appointments.module';
import { AiModule } from '../ai/ai.module';
import { FirmProfileModule } from '../firm-profile/firm-profile.module';
import { RagModule } from '../rag/rag.module';
import { WhatsappPortsModule } from '../whatsapp/whatsapp-ports.module';
import { VoiceModule } from '../voice/voice.module';
import { VoiceCallService } from './application/voice-call.service';
import { VoiceReceptionistService } from './application/voice-receptionist.service';
import { VoiceSessionRunner } from './application/voice-session.runner';
import { CallSpeechService } from './application/call-speech.service';
import { CallMediaLoop } from './application/call-media.loop';
import { WavoipCallService } from './application/wavoip-call.service';
import { VoiceCallProcessor } from './interface/voice-call.processor';

@Module({})
export class VoiceCallsModule {
  static register(role: 'api' | 'worker' | 'voice'): DynamicModule {
    return {
      module: VoiceCallsModule,
      imports: [
        WhatsappPortsModule,
        AppointmentsModule,
        FirmProfileModule,
        RagModule,
        // api role: LLM + detector providers without WhatsApp media workers.
        AiModule.register('api'),
        VoiceModule.register('api'),
      ],
      providers: [
        VoiceCallService,
        VoiceReceptionistService,
        VoiceSessionRunner,
        CallSpeechService,
        CallMediaLoop,
        WavoipCallService,
        ...(role === 'voice' ? [VoiceCallProcessor] : []),
      ],
      exports: [VoiceCallService, VoiceSessionRunner],
    };
  }
}
