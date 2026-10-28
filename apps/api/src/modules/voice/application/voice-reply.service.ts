import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../../config/env';
import { UnitOfWork } from '../../../common/prisma/unit-of-work';
import { DOMAIN_EVENTS } from '../../../common/events/domain-events';
import { OutboxWriter } from '../../../common/events/outbox-writer';
import { SendService } from '../../whatsapp/application/send.service';
import { HumanPresenceService } from '../../whatsapp/application/human-presence.service';
import { OBJECT_STORAGE, type ObjectStorage } from '../../whatsapp/application/ports';
import { parseAiSettings } from '../../firm-profile/application/ai-settings.dto';
import { TEXT_TO_SPEECH, type SynthesizeResult, type TextToSpeechPort } from './text-to-speech.port';
import { AI_USAGE, type AiUsagePort } from '../../ai/application/ai-usage.port';
import { ttsCostMicros } from './speech-pricing';
import { toWhatsappVoiceNote } from './whatsapp-ptt';
import { BETWEEN_BUBBLES_MS, recordingMs, splitIntoBubbles, typingMs } from './human-pacing';

export interface VoiceReplyParams {
  tenantId: string;
  conversationId: string;
  toWaPhone: string;
  responseText: string;
  language: string;
  inboundContentType: string;
  /** The client messages this reply answers — given blue ticks before replying. */
  readWamids?: string[] | undefined;
  /** When the turn began, so time spent thinking counts towards "typing…". */
  turnStartedAt?: number | undefined;
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
    private readonly presence: HumanPresenceService,
    config: ConfigService<Env, true>,
  ) {
    this.humanPacing = config.get('AI_HUMAN_PACING', { infer: true });
  }

  /** Read receipts, "typing…"/"recording…" and short bubbles (human-pacing.ts). */
  private readonly humanPacing: boolean;

  async sendAiReply(params: VoiceReplyParams): Promise<void> {
    const settings = await this.uow.withTenant(params.tenantId, async (tx) => {
      const tenant = await tx.tenant.findUnique({ where: { id: params.tenantId }, select: { settings: true } });
      return parseAiSettings(asRecord(tenant?.settings));
    });

    const elapsed = () => (params.turnStartedAt ? Date.now() - params.turnStartedAt : 0);
    if (this.humanPacing && params.readWamids?.length) {
      await this.presence.markRead(params.tenantId, params.toWaPhone, params.readWamids);
    }

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

        if (this.humanPacing) {
          // ~13 spoken characters a second is a fair estimate across EN/UR.
          const seconds = params.responseText.length / 13;
          await this.presence.showActivity(params.tenantId, params.toWaPhone, 'recording', recordingMs(seconds, elapsed()));
        }
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

    // People send a long answer as a few short messages, each after "typing…".
    const bubbles = this.humanPacing ? splitIntoBubbles(params.responseText) : [params.responseText];
    for (const [index, bubble] of bubbles.entries()) {
      if (this.humanPacing) {
        if (index > 0) await sleep(BETWEEN_BUBBLES_MS);
        const ms = typingMs(bubble.length, index === 0 ? elapsed() : 0);
        await this.presence.showActivity(params.tenantId, params.toWaPhone, 'composing', ms);
      }
      await this.send.send(params.tenantId, {
        kind: 'text',
        conversationId: params.conversationId,
        toWaPhone: params.toWaPhone,
        senderType: 'AI',
        body: bubble,
      });
    }

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
        provider: ttsProvider(result.model),
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Provider label for usage logs, from the engine that actually spoke. */
export function ttsProvider(model: string): string {
  if (model.startsWith('espeak')) return 'local';
  if (model.startsWith('groq/')) return 'groq';
  if (model.startsWith('gemini')) return 'google';
  return 'elevenlabs';
}
