import { Inject, Injectable, Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { DOMAIN_EVENTS } from '../../../common/events/domain-events';
import { OutboxWriter } from '../../../common/events/outbox-writer';
import { toInputJson } from '../../../common/persistence/json';
import { UnitOfWork } from '../../../common/prisma/unit-of-work';
import { QUEUES } from '../../../common/queue/queue.constants';
import type { InboundContentType } from '../../../common/messaging/inbound-message';
import {
  DocumentsService,
  inferInboundDocType,
} from '../../documents/application/documents.service';
import { DocumentRequestsService } from '../../documents/application/document-requests.service';
import { PaymentInstructionService } from '../../payments/application/payment-instruction.service';
import { SendService } from '../../whatsapp/application/send.service';
import { EvolutionApiClient } from '../../whatsapp/infrastructure/evolution-api.client';
import {
  OBJECT_STORAGE,
  WHATSAPP_CONNECTION_REPOSITORY,
  type ObjectStorage,
  type WhatsappConnectionRepository,
} from '../../whatsapp/application/ports';
import { readAudioSeconds } from '../../../common/messaging/audio-seconds';
import { SPEECH_TO_TEXT, type SpeechToTextPort } from './speech-to-text.port';

interface MediaJob {
  tenantId: string;
  messageId: string;
  clientId: string;
  mediaId: string | null;
}

interface MediaContext {
  message: {
    id: string;
    createdAt: Date;
    conversationId: string;
    contentType: InboundContentType;
    body: string | null;
    payload: unknown;
  };
  caseId: string | null;
  instanceName: string;
  aiAutoReplyEnabled: boolean;
  clientLanguages: unknown;
}

function readAiAutoReplyEnabled(settings: unknown): boolean {
  if (typeof settings !== 'object' || settings === null || Array.isArray(settings)) return true;
  const value = (settings as Record<string, unknown>)['aiAutoReplyEnabled'];
  return typeof value === 'boolean' ? value : true;
}

function urduHint(clientLanguages: unknown): 'ur' | undefined {
  if (!Array.isArray(clientLanguages)) return undefined;
  return clientLanguages.includes('UR') || clientLanguages.includes('ROMAN_URDU') ? 'ur' : undefined;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function resolveFilename(
  payload: Record<string, unknown>,
  mimeType: string,
  contentType: InboundContentType,
): string {
  const fromPayload = payload['mediaFilename'];
  if (typeof fromPayload === 'string' && fromPayload.trim().length > 0) {
    return fromPayload.trim();
  }
  const msg = asRecord(payload['message']);
  const docMsg = asRecord(msg['documentMessage']);
  const imgMsg = asRecord(msg['imageMessage']);
  const fromDoc =
    (typeof docMsg['fileName'] === 'string' && docMsg['fileName']) ||
    (typeof docMsg['title'] === 'string' && docMsg['title']) ||
    null;
  if (fromDoc) return fromDoc;
  const fromImg = typeof imgMsg['fileName'] === 'string' ? imgMsg['fileName'] : null;
  if (fromImg) return fromImg;
  if (mimeType.includes('pdf')) return 'document.pdf';
  if (mimeType.includes('jpeg') || mimeType.includes('jpg')) return 'photo.jpg';
  if (mimeType.includes('png')) return 'photo.png';
  if (mimeType.includes('webp')) return 'photo.webp';
  return contentType === 'IMAGE' ? 'photo.jpg' : 'document.bin';
}

function mediaExtension(mimeType: string, contentType: InboundContentType): string {
  if (mimeType.includes('pdf')) return 'pdf';
  if (mimeType.includes('jpeg') || mimeType.includes('jpg')) return 'jpg';
  if (mimeType.includes('png')) return 'png';
  if (mimeType.includes('webp')) return 'webp';
  if (mimeType.includes('ogg') || mimeType.includes('opus')) return 'ogg';
  if (mimeType.includes('webm')) return 'webm';
  if (mimeType.includes('wav')) return 'wav';
  if (mimeType.includes('mpeg') || mimeType.includes('mp3')) return 'mp3';
  if (mimeType.includes('mp4') || mimeType.includes('m4a') || mimeType.includes('aac')) return 'm4a';
  if (contentType === 'AUDIO') return 'ogg';
  if (contentType === 'DOCUMENT') return 'bin';
  return 'jpg';
}

@Processor(QUEUES.WHATSAPP_MEDIA)
@Injectable()
export class WhatsappMediaProcessor extends WorkerHost {
  private readonly logger = new Logger(WhatsappMediaProcessor.name);

  constructor(
    private readonly uow: UnitOfWork,
    private readonly outbox: OutboxWriter,
    private readonly evolution: EvolutionApiClient,
    private readonly documents: DocumentsService,
    private readonly documentRequests: DocumentRequestsService,
    private readonly paymentInstructions: PaymentInstructionService,
    private readonly send: SendService,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage,
    @Inject(SPEECH_TO_TEXT) private readonly stt: SpeechToTextPort,
    @Inject(WHATSAPP_CONNECTION_REPOSITORY) private readonly connections: WhatsappConnectionRepository,
  ) {
    super();
  }

  async process(job: Job<MediaJob>): Promise<void> {
    const { tenantId, messageId, clientId } = job.data;

    const context = await this.uow.withTenant(tenantId, async (tx) => {
      const message = await tx.message.findFirst({ where: { id: messageId } });
      if (!message) return null;

      const tenant = await tx.tenant.findUnique({
        where: { id: tenantId },
        select: { settings: true },
      });
      const settings = asRecord(tenant?.settings);
      const connection = await this.connections.findByTenant(tx, tenantId);
      if (!connection) {
        this.logger.warn({ tenantId, messageId }, 'no whatsapp connection for media job');
        return null;
      }

      const conversation = await tx.conversation.findFirst({
        where: { id: message.conversationId },
        select: { caseId: true },
      });

      return {
        message: {
          id: message.id,
          createdAt: message.createdAt,
          conversationId: message.conversationId,
          contentType: message.contentType as InboundContentType,
          body: message.body,
          payload: message.payload,
        },
        caseId: conversation?.caseId ?? null,
        instanceName: connection.instanceName,
        aiAutoReplyEnabled: readAiAutoReplyEnabled(settings),
        clientLanguages: settings['clientLanguages'],
      } satisfies MediaContext;
    });

    if (!context) return;

    const payload = asRecord(context.message.payload);
    const downloaded = await this.evolution.getBase64FromMediaMessage({
      instanceName: context.instanceName,
      message: {
        key: payload['key'],
        message: payload['message'],
      },
    });

    const mimeType =
      downloaded.mimeType ||
      (typeof payload['mediaMimeType'] === 'string' ? payload['mediaMimeType'] : 'application/octet-stream');

    if (context.message.contentType === 'IMAGE' || context.message.contentType === 'DOCUMENT') {
      await this.storeAsDocument({
        tenantId,
        clientId,
        messageId,
        caseId: context.caseId,
        contentType: context.message.contentType,
        payload,
        buffer: downloaded.buffer,
        mimeType,
        caption: context.message.body,
        aiAutoReplyEnabled: context.aiAutoReplyEnabled,
      });
      return;
    }

    const ext = mediaExtension(mimeType, context.message.contentType);
    const mediaPath = `tenants/${tenantId}/media/${messageId}.${ext}`;
    try {
      await this.storage.put(mediaPath, downloaded.buffer);
    } catch (error) {
      this.logger.warn(
        { tenantId, messageId, error: error instanceof Error ? error.message : String(error) },
        'inbound media storage failed — continuing with transcription',
      );
    }

    let transcript = context.message.body;
    if (context.message.contentType === 'AUDIO') {
      try {
        const result = await this.stt.transcribe({
          audioBuffer: downloaded.buffer,
          mimeType,
          languageHint: urduHint(context.clientLanguages),
        });
        transcript = result.text || '(voice note — no transcript)';
      } catch (error) {
        this.logger.warn({ tenantId, messageId, error }, 'stt failed for inbound audio');
        transcript = '(voice note — transcription unavailable)';
      }
    }

    const durationSeconds = readAudioSeconds(payload);

    await this.uow.withTenant(tenantId, async (tx) => {
      await tx.message.update({
        where: { id_createdAt: { id: context.message.id, createdAt: context.message.createdAt } },
        data: {
          body: transcript,
          payload: toInputJson({
            ...payload,
            mimeType,
            ...(mediaPath ? { mediaPath } : {}),
            ...(durationSeconds ? { durationSeconds } : {}),
          }),
        },
      });

      if (context.aiAutoReplyEnabled) {
        await this.outbox.append(tx, tenantId, DOMAIN_EVENTS.MessageInboundReceived, {
          conversationId: context.message.conversationId,
          messageId: context.message.id,
          clientId,
          contentType: context.message.contentType,
        });
      }
    });
  }

  private async storeAsDocument(input: {
    tenantId: string;
    clientId: string;
    messageId: string;
    caseId: string | null;
    contentType: 'IMAGE' | 'DOCUMENT';
    payload: Record<string, unknown>;
    buffer: Buffer;
    mimeType: string;
    caption: string | null;
    aiAutoReplyEnabled: boolean;
  }): Promise<void> {
    const filename = resolveFilename(input.payload, input.mimeType, input.contentType);
    const pendingPayment =
      input.contentType === 'IMAGE'
        ? await this.paymentInstructions.findOpenForClient(input.tenantId, input.clientId)
        : null;
    const docType =
      pendingPayment && input.contentType === 'IMAGE'
        ? 'PAYMENT_PROOF'
        : inferInboundDocType(input.mimeType, filename, input.contentType);

    let documentRecord;
    try {
      documentRecord = await this.documents.upload({
        tenantId: input.tenantId,
        clientId: input.clientId,
        caseId: input.caseId ?? undefined,
        messageId: input.messageId,
        filename,
        description: input.caption ?? undefined,
        docType,
        buffer: input.buffer,
        mimeType: input.mimeType,
      });
    } catch (error) {
      this.logger.error({ tenantId: input.tenantId, messageId: input.messageId, error }, 'failed to store inbound document');
      throw error;
    }

    let fulfilled: { id: string } | null = null;
    try {
      fulfilled = await this.documentRequests.autoFulfilFromInbound(
        input.tenantId,
        input.clientId,
        input.caseId,
        documentRecord.id,
      );
    } catch (error) {
      this.logger.warn({ tenantId: input.tenantId, documentId: documentRecord.id, error }, 'auto-fulfil document request failed');
    }

    const conversationId = await this.uow.withTenant(input.tenantId, async (tx) => {
      const message = await tx.message.findFirst({ where: { id: input.messageId } });
      if (!message) return null;

      const nextPayload = {
        ...asRecord(message.payload),
        documentId: documentRecord.id,
        mediaPath: documentRecord.storagePath,
        mimeType: input.mimeType,
        mediaFilename: filename,
      };

      const ackBody =
        message.body ??
        (input.contentType === 'IMAGE'
          ? 'Photo received — saved to your client folder.'
          : 'Document received — saved to your client folder.');

      await tx.message.update({
        where: { id_createdAt: { id: message.id, createdAt: message.createdAt } },
        data: {
          body: ackBody,
          payload: toInputJson(nextPayload),
        },
      });

      await this.outbox.append(tx, input.tenantId, DOMAIN_EVENTS.DocumentReceived, {
        documentId: documentRecord.id,
        clientId: input.clientId,
        messageId: input.messageId,
        ...(input.caseId ? { caseId: input.caseId } : {}),
      });

      return message.conversationId;
    });

    if (!conversationId) return;

    if (pendingPayment && input.contentType === 'IMAGE') {
      const attached = await this.paymentInstructions.attachProofIfPending(input.tenantId, {
        clientId: input.clientId,
        documentId: documentRecord.id,
        messageId: input.messageId,
        conversationId,
      });
      if (attached) return;
    }

    if (fulfilled) {
      await this.sendDocumentReceivedAck(input.tenantId, conversationId);
      return;
    }

    if (input.aiAutoReplyEnabled) {
      await this.uow.withTenant(input.tenantId, async (tx) => {
        await this.outbox.append(tx, input.tenantId, DOMAIN_EVENTS.MessageInboundReceived, {
          conversationId,
          messageId: input.messageId,
          clientId: input.clientId,
          contentType: input.contentType,
        });
      });
    }
  }

  private async sendDocumentReceivedAck(tenantId: string, conversationId: string): Promise<void> {
    const toWaPhone = await this.uow.withTenant(tenantId, async (tx) => {
      const conversation = await tx.conversation.findFirst({
        where: { id: conversationId },
        select: { client: { select: { waPhone: true } } },
      });
      return conversation?.client.waPhone ?? null;
    });
    if (!toWaPhone) return;
    try {
      await this.send.send(tenantId, {
        conversationId,
        toWaPhone,
        senderType: 'SYSTEM',
        kind: 'text',
        body: 'Received, thank you.',
      });
    } catch (error) {
      this.logger.warn({ tenantId, conversationId, error }, 'document received WhatsApp ack failed');
    }
  }
}
