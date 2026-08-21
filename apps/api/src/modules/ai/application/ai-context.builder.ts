import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../../generated/prisma/client';
import { parseAiSettings } from '../../firm-profile/application/ai-settings.dto';
import type { RetrievedChunk } from '../../rag/application/retriever.port';
import type { AiRunContext, FirmProfileSnapshot } from './ai-context.types';
import { loadOwnerProfileForAi } from './ai-owner-profile.loader';
import { formatRetrievedContext } from './ai-prompt-variables';

const HISTORY_LIMIT = 18;

@Injectable()
export class AiContextBuilder {
  async build(params: {
    tenantId: string;
    conversationId: string;
    tx: Prisma.TransactionClient;
    retrievedChunks?: RetrievedChunk[];
  }): Promise<AiRunContext> {
    const tenant = await params.tx.tenant.findUnique({
      where: { id: params.tenantId },
      select: { name: true, settings: true },
    });
    if (!tenant) {
      throw new Error('tenant not found');
    }

    const settings = asRecord(tenant.settings);
    const firm = parseFirmProfile(tenant.name, settings);
    const aiSettings = parseAiSettings(settings);
    const ownerProfile = await loadOwnerProfileForAi(params.tx);

    const conversation = await params.tx.conversation.findUnique({
      where: { id: params.conversationId },
      select: { clientId: true, caseId: true },
    });
    if (!conversation) {
      throw new Error('conversation not found');
    }

    const messages = await params.tx.message.findMany({
      where: { conversationId: params.conversationId },
      orderBy: { createdAt: 'desc' },
      take: HISTORY_LIMIT,
      select: { direction: true, senderType: true, body: true, contentType: true, createdAt: true },
    });

    const priorAiOutbound = await params.tx.message.count({
      where: {
        conversationId: params.conversationId,
        direction: 'OUTBOUND',
        senderType: 'AI',
      },
    });

    const intake = await params.tx.intakeSession.findUnique({
      where: { tenantId_conversationId: { tenantId: params.tenantId, conversationId: params.conversationId } },
      select: { extractedFields: true },
    });

    const intakeFields = asRecord(intake?.extractedFields);
    const chunks = params.retrievedChunks ?? [];
    const chronological = [...messages].reverse();
    const conversationHistory = formatHistory(chronological);
    const lastAiReply =
      messages.find(
        (m) => m.direction === 'OUTBOUND' && m.senderType === 'AI' && Boolean(m.body?.trim()),
      )?.body ?? '';

    return {
      firm,
      ownerProfile,
      aiSettings,
      isFirstClientTurn: priorAiOutbound === 0,
      conversationHistory,
      lastAiReply,
      intakeFields,
      clientId: conversation.clientId,
      caseId: conversation.caseId ?? undefined,
      retrievedChunks: chunks,
      retrievedContext: formatRetrievedContext(chunks),
    };
  }
}

function parseFirmProfile(firmName: string, settings: Record<string, unknown>): FirmProfileSnapshot {
  return {
    firmName,
    displayName:
      typeof settings['displayName'] === 'string' && settings['displayName'].trim()
        ? settings['displayName']
        : firmName,
    city: str(settings['city']),
    officeAddress: str(settings['officeAddress']),
    website: str(settings['website']),
    practiceAreas: Array.isArray(settings['practiceAreas'])
      ? settings['practiceAreas'].filter((v): v is string => typeof v === 'string')
      : [],
    clientLanguages: Array.isArray(settings['clientLanguages'])
      ? settings['clientLanguages'].filter(
          (v): v is FirmProfileSnapshot['clientLanguages'][number] =>
            v === 'EN' || v === 'UR' || v === 'ROMAN_URDU',
        )
      : ['EN', 'UR', 'ROMAN_URDU'],
    officeHours: str(settings['officeHours'], 'Mon–Sat, 9:00–18:00 PKT'),
    consultationFeePkr:
      typeof settings['consultationFeePkr'] === 'number' && settings['consultationFeePkr'] >= 0
        ? settings['consultationFeePkr']
        : 0,
    teamSize:
      typeof settings['teamSize'] === 'number' && settings['teamSize'] > 0 ? settings['teamSize'] : 1,
    firmAbout: str(settings['firmAbout']),
    foundingYear:
      typeof settings['foundingYear'] === 'number' && settings['foundingYear'] >= 1900
        ? settings['foundingYear']
        : null,
    differentiators: Array.isArray(settings['differentiators'])
      ? settings['differentiators'].filter((v): v is string => typeof v === 'string')
      : [],
  };
}

function formatHistory(
  messages: Array<{ direction: string; senderType: string; body: string | null; contentType: string }>,
): string {
  if (messages.length === 0) return '';
  return messages
    .map((m) => {
      const role =
        m.direction === 'INBOUND' ? 'Client' : m.senderType === 'AI' ? 'AI' : 'Staff';
      return `${role}: ${historyBody(m.body, m.contentType)}`;
    })
    .join('\n');
}

export function historyBody(body: string | null, contentType: string): string {
  const text = body?.trim();
  if (text) return text;
  return `[${contentType.toLowerCase()} message]`;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value))
    : {};
}

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}
