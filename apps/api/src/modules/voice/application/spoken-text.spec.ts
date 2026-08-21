import { describe, expect, it } from 'vitest';
import { prepareSpokenTtsText } from '../application/spoken-text';

describe('prepareSpokenTtsText', () => {
  it('strips markdown and adds soft pauses between sentences', () => {
    expect(prepareSpokenTtsText('**Hello**\n\nHow can I help?')).toBe('Hello. ... How can I help?');
  });

  it('does not speak slash or dash punctuation', () => {
    expect(prepareSpokenTtsText('میں جواب دے سکتا/سکتی ہوں — عام گپ شپ نہیں۔')).toBe(
      'میں جواب دے سکتا ہوں, عام گپ شپ نہیں۔',
    );
    expect(prepareSpokenTtsText("I'm the assistant — not the lawyer.")).toBe(
      "I'm the assistant, not the lawyer.",
    );
    expect(prepareSpokenTtsText('گی/گا and foo--bar')).not.toMatch(/\/|--|—/);
  });
});
