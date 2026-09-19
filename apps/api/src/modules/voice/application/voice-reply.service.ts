import { Inject, Injectable, Logger } from '@nestjs/common';
import { UnitOfWork } from '../../../common/prisma/unit-of-work';
import { DOMAIN_EVENTS } from '../../../common/events/domain-events';
import { OutboxWriter } from '../../../common/events/outbox-writer';
import { SendService } from '../../whatsapp/application/send.service';
import { OBJECT_STORAGE, type ObjectStorage } from '../../whatsapp/application/ports';
import { parseAiSettings } from '../../firm-profile/application/ai-settings.dto';
import { TEXT_TO_SPEECH, type SynthesizeResult, type TextToSpeechPort } from './text-to-speech.port';
import { AI_USAGE, type AiUsagePort } from '../../ai/application/ai-usage.port';
import { ttsCostMicros } from './speech-pricing';
import { toWhatsappVoiceNote } from './whatsapp-ptt';

export interface VoiceReplyParams {
  tenantId: string;
  conversationId: string;
  toWaPhone: string;
  responseText: string;
  language: string;
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
    @Inject(AI_USAGE) private readonly aiUsage: AiUsagePort,
  ) {}

  async sendAiReply(params: VoiceReplyParams): Promise<void> {
    const settings = await this.uow.withTenant(params.tenantId, async (tx) => {
      const tenant = await tx.tenant.findUnique({ where: { id: params.tenantId }, select: { settings: true } });
      return parseAiSettings(asRecord(tenant?.settings));
    });

    const useVoice = shouldUseVoiceReply(settings, params.inboundContentType);
    if (useVoice) {
      try {
        const startedAt = Date.now();
        const synthesized = await this.tts.synthesize({
          text: params.responseText,
          voiceGender: settings.aiVoiceGender,
          voiceId: settings.aiVoiceId || undefined,
          urduVoiceId: settings.aiVoiceIdUrdu || undefined,
          language: spokenLanguage(params.language, params.responseText),
        });
        // Metered against the same monthly budget as model calls: a per-character
        // bill on long Urdu notes is easily the largest variable cost per tenant.
        await this.recordTtsSpend(params.tenantId, synthesized, Date.now() - startedAt);
        const note = await toWhatsappVoiceNote(synthesized.audioBuffer, synthesized.mimeType);
        const audioPath = `tenants/${params.tenantId}/outbound/${Date.now()}.ogg`;
        const stored = this.storage.put(audioPath, note.buffer).catch((error: unknown) => {
          this.logger.warn(
            { conversationId: params.conversationId, error: error instanceof Error ? error.message : String(error) },
            'outbound audio storage failed — sending voice note anyway',
          );
        });

        await this.send.send(params.tenantId, {
          kind: 'audio',
          conversationId: params.conversationId,
          toWaPhone: params.toWaPhone,
          senderType: 'AI',
          body: params.responseText,
          audioBuffer: note.buffer,
          mimeType: note.mimeType,
          audioPath,
        });
        await stored;

        await this.uow.withTenant(params.tenantId, async (tx) => {
          await this.outbox.append(tx, params.tenantId, DOMAIN_EVENTS.AiReplySent, {
            conversationId: params.conversationId,
          });
        });
        return;
      } catch (error) {
        this.logger.warn(
          { conversationId: params.conversationId, err: error instanceof Error ? error.message : String(error) },
          'voice reply failed — falling back to text',
        );
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

  /**
   * Usage bookkeeping must never fail a reply the client is waiting on, so a
   * write failure is logged and swallowed.
   */
  private async recordTtsSpend(
    tenantId: string,
    result: SynthesizeResult,
    latencyMs: number,
  ): Promise<void> {
    try {
      await this.aiUsage.logSpeech({
        tenantId,
        agent: 'tts:whatsapp-note',
        provider: result.model === 'espeak-ng' ? 'local' : 'elevenlabs',
        model: result.model,
        units: result.charactersUsed,
        costMicros: ttsCostMicros(result.model, result.charactersUsed),
        latencyMs,
        status: 'SUCCESS',
      });
    } catch (error) {
      this.logger.warn(
        { tenantId, err: error instanceof Error ? error.message : String(error) },
        'tts usage not recorded',
      );
    }
  }
}

export function shouldUseVoiceReply(
  settings: ReturnType<typeof parseAiSettings>,
  inboundContentType?: string,
): boolean {
  if (!settings.aiVoiceEnabled) return false;
  if (settings.aiVoiceReplyMode === 'text_only') return false;
  if (settings.aiVoiceReplyMode === 'voice_only') return true;
  return inboundContentType === 'AUDIO';
}

export function spokenLanguage(language: string, text: string): 'ur' | 'en' {
  if (language === 'UR' || /[\u0600-\u06FF]/.test(text)) return 'ur';
  return 'en';
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
