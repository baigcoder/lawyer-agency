import { describe, expect, it } from 'vitest';
import { buildDynamicReplyRules, isShortGreeting } from './dynamic-reply-rules';

describe('isShortGreeting', () => {
  it('detects common short openers', () => {
    expect(isShortGreeting('Hy')).toBe(true);
    expect(isShortGreeting('Hello')).toBe(true);
    expect(isShortGreeting('Salam')).toBe(true);
    expect(isShortGreeting('Hello, I need help with divorce')).toBe(false);
  });
});

describe('buildDynamicReplyRules', () => {
  it('does not assume a practice area and writes like WhatsApp', () => {
    const rules = buildDynamicReplyRules({
      isFirstClientTurn: true,
      aiGreetingHint: 'Warm assistant for {{displayName}}',
    });
    expect(rules).toContain('Do NOT assume a practice area');
    expect(rules).toContain('{{displayName}}');
    expect(rules).toContain('First reply in this thread');
    expect(rules).toContain('Ask at most ONE question');
    expect(rules).toContain('NEVER say you could not find the answer');
  });
});
