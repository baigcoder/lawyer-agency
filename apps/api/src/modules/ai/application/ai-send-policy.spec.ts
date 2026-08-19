import { describe, expect, it } from 'vitest';
import { shouldSendAiReply } from './ai-send-policy';

describe('shouldSendAiReply', () => {
  it('sends for AI_ACTIVE conversations', () => {
    expect(
      shouldSendAiReply({
        conversationState: 'AI_ACTIVE',
        hasOpenEscalation: false,
        responseText: 'Hello',
      }),
    ).toBe(true);
  });

  it('resumes HUMAN_REQUIRED when there is no open escalation', () => {
    expect(
      shouldSendAiReply({
        conversationState: 'HUMAN_REQUIRED',
        hasOpenEscalation: false,
        responseText: 'Hello',
      }),
    ).toBe(true);
  });

  it('does not send during an open escalation', () => {
    expect(
      shouldSendAiReply({
        conversationState: 'HUMAN_REQUIRED',
        hasOpenEscalation: true,
        responseText: 'Hello',
      }),
    ).toBe(false);
  });

  it('does not send when staff is actively handling or the chat is closed', () => {
    expect(
      shouldSendAiReply({
        conversationState: 'HUMAN_ACTIVE',
        hasOpenEscalation: false,
        responseText: 'Hello',
      }),
    ).toBe(false);
    expect(
      shouldSendAiReply({
        conversationState: 'CLOSED',
        hasOpenEscalation: false,
        responseText: 'Hello',
      }),
    ).toBe(false);
  });

  it('does not send without response text', () => {
    expect(
      shouldSendAiReply({
        conversationState: 'AI_ACTIVE',
        hasOpenEscalation: false,
        responseText: '',
      }),
    ).toBe(false);
  });
});
