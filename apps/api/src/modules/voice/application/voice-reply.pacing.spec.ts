import { describe, expect, it, vi } from 'vitest';
import { VoiceReplyService, ttsProvider } from './voice-reply.service';

function build(pacing: boolean, settings: Record<string, unknown> = { aiVoiceReplyMode: 'text_only' }) {
  const events: string[] = [];
  const tx = {
    tenant: { findUnique: vi.fn(async () => ({ settings })) },
  };
  const uow = { withTenant: vi.fn(async (_t: string, fn: (inner: unknown) => Promise<unknown>) => fn(tx)) };
  const send = {
    send: vi.fn(async (_tenant: string, request: { kind: string; body: string }) => {
      events.push(`send:${request.kind}:${request.body.slice(0, 12)}`);
      return { wamid: 'out' };
    }),
  };
  const outbox = { append: vi.fn(async () => events.push('event:AiReplySent')) };
  const presence = {
    markRead: vi.fn(async (_t: string, _p: string, ids: string[]) => events.push(`read:${ids.join(',')}`)),
    showActivity: vi.fn(async (_t: string, _p: string, activity: string) => events.push(`presence:${activity}`)),
  };
  const config = { get: () => pacing };
  const service = new VoiceReplyService(
    uow as never,
    send as never,
    outbox as never,
    { synthesize: vi.fn() } as never,
    { put: vi.fn(async () => undefined) } as never,
    { logSpeech: vi.fn() } as never,
    presence as never,
    config as never,
  );
  return { service, events, send, presence };
}

const long = [
  'Shukriya Ahmed sahab. Main aap ki baat samajh gaya aur aap ki pareshani bhi.',
  'Ayesha Khan sahiba aap ka maamla dekhengi. Woh aaj raat 10 baje se pehle aap ko call karengi aur kal ki peshi ki tayyari karengi.',
  'Tab tak baraye meharbani FIR ki copy aur shanakhti card yahan bhej dein, taa ke file tayyar rahe.',
].join('\n\n');

describe('VoiceReplyService human pacing', () => {
  it('reads, types, and sends a long reply as short messages', async () => {
    const { service, events } = build(true);
    await service.sendAiReply({
      tenantId: 't1',
      conversationId: 'c1',
      toWaPhone: '923001234567',
      responseText: long,
      language: 'ROMAN_URDU',
      inboundContentType: 'TEXT',
      readWamids: ['w1', 'w2'],
      turnStartedAt: Date.now(),
    });
    expect(events).toEqual([
      'read:w1,w2',
      'presence:composing',
      'send:text:Shukriya Ahm',
      'presence:composing',
      'send:text:Ayesha Khan ',
      'presence:composing',
      'send:text:Tab tak bara',
      'event:AiReplySent',
    ]);
  });

  it('sends one plain message with no presence when pacing is off', async () => {
    const { service, events, presence } = build(false);
    await service.sendAiReply({
      tenantId: 't1',
      conversationId: 'c1',
      toWaPhone: '923001234567',
      responseText: long,
      language: 'ROMAN_URDU',
      inboundContentType: 'TEXT',
      readWamids: ['w1'],
    });
    expect(presence.markRead).not.toHaveBeenCalled();
    expect(presence.showActivity).not.toHaveBeenCalled();
    expect(events).toEqual(['send:text:Shukriya Ahm', 'event:AiReplySent']);
  });
});

describe('ttsProvider', () => {
  it('labels usage by the engine that spoke', () => {
    expect(ttsProvider('groq/canopylabs/orpheus-v1-english')).toBe('groq');
    expect(ttsProvider('gemini-3.1-flash-tts-preview')).toBe('google');
    expect(ttsProvider('eleven_turbo_v2_5')).toBe('elevenlabs');
    expect(ttsProvider('espeak-ng')).toBe('local');
  });
});
