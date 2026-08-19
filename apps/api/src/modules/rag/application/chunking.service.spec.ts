import { describe, expect, it } from 'vitest';
import { chunkText, estimateTokens } from './chunking.service';

describe('chunkText', () => {
  it('keeps short text in a single chunk', () => {
    const chunks = chunkText('This is a short entry.', { targetTokens: 500, overlapTokens: 100 });
    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.content).toBe('This is a short entry.');
  });

  it('splits long text into multiple chunks with overlap', () => {
    const paragraph = 'word '.repeat(600).trim();
    const chunks = chunkText(`${paragraph}\n\n${paragraph}`, { targetTokens: 100, overlapTokens: 20 });
    expect(chunks.length).toBeGreaterThan(1);
    // Each chunk should include some overlap from the previous.
    expect(chunks[1]?.content.length).toBeGreaterThan(paragraph.length);
  });

  it('preserves paragraph boundaries when possible', () => {
    const text = 'First paragraph.\n\nSecond paragraph.\n\nThird paragraph.';
    const chunks = chunkText(text, { targetTokens: 500, overlapTokens: 100 });
    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.content).toContain('First paragraph.');
    expect(chunks[0]?.content).toContain('Third paragraph.');
  });
});

describe('estimateTokens', () => {
  it('approximates 4 chars per token', () => {
    expect(estimateTokens('a'.repeat(40))).toBe(10);
  });
});
