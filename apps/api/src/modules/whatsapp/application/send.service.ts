import { Inject, Injectable, Logger } from '@nestjs/common';
import { UnitOfWork } from '../../../common/prisma/unit-of-work';
import type { DbTx } from '../../../common/persistence/db-tx';
import { toInputJson } from '../../../common/persistence/json';
import {
  ConversationNotFoundError,
  TemplateNotApprovedError,
} from '../domain/errors';
import { resolveSendMode, WindowClosedError } from '../../../common/messaging/window-policy';
import { estimateMp3DurationSeconds } from '../../../common/messaging/audio-seconds';
import {
  OBJECT_STORAGE,
  OUTBOUND_SENDER,
  WHATSAPP_CONNECTION_REPOSITORY,
  type ObjectStorage,
  type OutboundSender,
  type WhatsappConnectionRepository,
} from './ports';

interface SendBase {
  conversationId: string;
  toWaPhone: string;
  senderType: 'AI' | 'LAWYER' | 'STAFF' | 'SYSTEM';
}

interface FreeformTextSend extends SendBase {
  kind: 'text';
  body: string;
}

interface TemplateSend extends SendBase {
  kind: 'template';
  templateName: string;
  language: string;
  components?: Record<string, unknown>[];
}

interface AudioSend extends SendBase {
  kind: 'audio';
  body: string;
  audioBuffer: Buffer;
  mimeType: string;
  audioPath: string;
}

interface DocumentSend extends SendBase {
  kind: 'document';
  caption: string;
  fileName: string;
  mimeType: string;
  documentBuffer: Buffer;
  documentPath?: string | undefined;
}

export type SendRequest = FreeformTextSend | TemplateSend | AudioSend | DocumentSend;

/**
 * Outbound path. Two rules are enforced here, structurally (D-003):
 *  1. Free-form sends require an open 24h window — WindowClosedError otherwise.
 *  2. Templates must exist and be APPROVED for this tenant's WABA.
 * Meta error 131047 (window) is also mapped to WindowClosedError — defense in
 * depth if our window state and Meta's ever disagree.
 *
 * D-097 carve-out: sends that will route over the pilot bridge (dev-only,
 * Baileys — which imposes no 24h window) skip rule 1, so multi-day pilots
 * don't go mute. Official Meta sends always keep the full policy.
 */
@Injectable()
export class SendService {
  private readonly logger = new Logger(SendService.name);

  constructor(
    private readonly uow: UnitOfWork,
    @Inject(OUTBOUND_SENDER) private readonly sender: OutboundSender,
    @Inject(WHATSAPP_CONNECTION_REPOSITORY) private readonly connections: WhatsappConnectionRepository,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
  ) {}

  async send(tenantId: string, request: SendRequest): Promise<{ wamid: string }> {
    return this.uow.withTenant(tenantId, async (tx) => {
      const conversation = await tx.conversation.findFirst({ where: { id: request.conversationId } });
      if (!conversation) throw new ConversationNotFoundError(request.conversationId);

      let body: Record<string, unknown>;
      let templateName: string | null = null;
      let contentType: 'TEXT' | 'TEMPLATE' | 'AUDIO' | 'DOCUMENT' = 'TEXT';
      let storedBody: string | null = null;
      let payload: Record<string, unknown> | null = null;

      if (request.kind === 'text') {
        const baileysConnected = await this.baileysConnected(tx, tenantId);
        if (!baileysConnected) {
          const mode = resolveSendMode(conversation.sessionWindowExpiresAt, new Date());
          if (mode === 'TEMPLATE_REQUIRED') throw new WindowClosedError();
        }
        body = { type: 'text', text: { body: request.body } };
        storedBody = request.body;
      } else if (request.kind === 'audio') {
        const baileysConnected = await this.baileysConnected(tx, tenantId);
        if (!baileysConnected) {
          const mode = resolveSendMode(conversation.sessionWindowExpiresAt, new Date());
          if (mode === 'TEMPLATE_REQUIRED') throw new WindowClosedError();
        }
        body = {
          type: 'audio',
          audio: {
            base64: request.audioBuffer.toString('base64'),
            mimeType: request.mimeType,
          },
        };
        contentType = 'AUDIO';
        storedBody = request.body;
        const mp3Duration = estimateMp3DurationSeconds(request.audioBuffer);
        payload = {
          audioPath: request.audioPath,
          mimeType: request.mimeType,
          ...(mp3Duration ? { durationSeconds: mp3Duration } : {}),
        };
        try {
          await this.storage.put(request.audioPath, request.audioBuffer);
        } catch (error) {
          this.logger.warn(
            { path: request.audioPath, reason: error instanceof Error ? error.message : String(error) },
            'outbound audio storage failed — WhatsApp send continues; inbox restore may be needed',
          );
        }
      } else if (request.kind === 'document') {
        const baileysConnected = await this.baileysConnected(tx, tenantId);
        if (!baileysConnected) {
          const mode = resolveSendMode(conversation.sessionWindowExpiresAt, new Date());
          if (mode === 'TEMPLATE_REQUIRED') throw new WindowClosedError();
        }
        body = {
          type: 'document',
          document: {
            base64: request.documentBuffer.toString('base64'),
            mimeType: request.mimeType,
            fileName: request.fileName,
            caption: request.caption,
          },
        };
        contentType = 'DOCUMENT';
        storedBody = request.caption;
        payload = {
          mimeType: request.mimeType,
          mediaFilename: request.fileName,
          ...(request.documentPath ? { mediaPath: request.documentPath } : {}),
        };
      } else {
        const template = await tx.whatsappTemplate.findFirst({
          where: { name: request.templateName, language: request.language },
        });
        if (!template || template.status !== 'APPROVED') {
          throw new TemplateNotApprovedError(request.templateName);
        }
        templateName = request.templateName;
        contentType = 'TEMPLATE';
        body = {
          type: 'template',
          template: {
            name: request.templateName,
            language: { code: request.language },
            ...(request.components ? { components: request.components } : {}),
          },
        };
      }

      const result = await this.sender.postMessage({
        tenantId,
        toWaPhone: request.toWaPhone,
        body,
        tx,
      });

      await tx.message.create({
        data: {
          tenantId,
          conversationId: conversation.id,
          direction: 'OUTBOUND',
          senderType: request.senderType,
          wamid: result.wamid,
          contentType,
          body: storedBody,
          templateName,
          ...(payload ? { payload: toInputJson(payload) } : {}),
          deliveryStatus: 'SENT',
        },
      });
      await tx.conversation.update({
        where: { id: conversation.id },
        data: { lastOutboundAt: new Date() },
      });

      return result;
    });
  }

  /**
   * Baileys connections (Evolution or legacy pilot) do not enforce Meta's 24h
   * window, so free-form text can be sent any time. Official Cloud API routes
   * keep the window policy.
   */
  private async baileysConnected(tx: DbTx, tenantId: string): Promise<boolean> {
    const connection = await this.connections.findByTenant(tx, tenantId);
    return connection?.status === 'connected' && connection.connectionType === 'baileys';
  }
}
