import { Inject, Injectable, Logger } from '@nestjs/common';
import { UnitOfWork } from '../../../common/prisma/unit-of-work';
import { DOMAIN_EVENTS } from '../../../common/events/domain-events';
import { OutboxWriter } from '../../../common/events/outbox-writer';
import { SendService } from '../../whatsapp/application/send.service';
import { OBJECT_STORAGE, type ObjectStorage } from '../../whatsapp/application/ports';
import { parseAiSettings } from '../../firm-profile/application/ai-settings.dto';
import { TEXT_TO_SPEECH, type TextToSpeechPort } from './text-to-speech.port';
import type { Language } from '../../ai/domain/types';

export interface VoiceReplyParams {
  tenantId: string;
  conversationId: string;
  toWaPhone: string;
  responseText: string;
  language: Language;
  inboundContentType: string;
}

@Injectable()
export class VoiceReplyService {
  private readonly logger = new Logger(VoiceReplyService.name);

  constructor(
    private readonly uow: UnitOfWork,
    private readonly send: SendService,
    private readonly outbox: OutboxWriter,
    @Inject(TEXT_TO_SPEECH) private readonly tts: TextToSpeechPort,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
  ) {}

  async sendAiReply(params: VoiceReplyParams): Promise<void> {
    const settings = await this.uow.withTenant(params.tenantId, async (tx) => {
      const tenant = await tx.tenant.findUnique({ where: { id: params.tenantId }, select: { settings: true } });
      return parseAiSettings(asRecord(tenant?.settings));
    });

    const useVoice = this.shouldUseVoice(settings, params.inboundContentType);
    if (useVoice) {
      try {
        const synthesized = await this.tts.synthesize({
          text: params.responseText,
          voiceGender: settings.aiVoiceGender,
          voiceId: settings.aiVoiceId || undefined,
          language: params.language === 'UR' ? 'ur' : 'en',
        });
        const audioPath = `tenants/${params.tenantId}/outbound/${Date.now()}.mp3`;
        try {
          await this.storage.put(audioPath, synthesized.audioBuffer);
        } catch (error) {
          this.logger.warn(
            { conversationId: params.conversationId, error: error instanceof Error ? error.message : String(error) },
            'outbound audio storage failed — sending voice note anyway',
          );
        }

        await this.send.send(params.tenantId, {
          kind: 'audio',
          conversationId: params.conversationId,
          toWaPhone: params.toWaPhone,
          senderType: 'AI',
          body: params.responseText,
          audioBuffer: synthesized.audioBuffer,
          mimeType: synthesized.mimeType,
          audioPath,
        });

        await this.uow.withTenant(params.tenantId, async (tx) => {
          await this.outbox.append(tx, params.tenantId, DOMAIN_EVENTS.AiReplySent, {
            conversationId: params.conversationId,
          });
        });
        return;
      } catch (error) {
        this.logger.warn({ error, conversationId: params.conversationId }, 'voice reply failed — falling back to text');
      }
    }

    await this.send.send(params.tenantId, {
      kind: 'text',
      conversationId: params.conversationId,
      toWaPhone: params.toWaPhone,
      senderType: 'AI',
      body: params.responseText,
    });

    await this.uow.withTenant(params.tenantId, async (tx) => {
      await this.outbox.append(tx, params.tenantId, DOMAIN_EVENTS.AiReplySent, {
        conversationId: params.conversationId,
      });
    });
  }

  private shouldUseVoice(
    settings: ReturnType<typeof parseAiSettings>,
    inboundContentType: string,
  ): boolean {
    if (!settings.aiVoiceEnabled) return false;
    if (settings.aiVoiceReplyMode === 'text_only') return false;
    if (settings.aiVoiceReplyMode === 'voice_only') return true;
    return inboundContentType === 'AUDIO';
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
