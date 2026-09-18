import { describe, expect, it } from 'vitest';
import { contentKey, selectRelevantChunks } from './retrieved-chunks';
import type { RetrievedChunk } from '../../rag/application/retriever.port';

const vector = (id: string, content: string, score: number, title = id): RetrievedChunk => ({
  chunkId: id,
  content,
  score,
  source: 'knowledge_base',
  title,
});
const curated = (id: string, content: string, score: number, title = id): RetrievedChunk => ({
  chunkId: `pakistan:${id}`,
  content,
  score,
  source: 'knowledge_base',
  title,
});

describe('selectRelevantChunks', () => {
  it('does not let fuzzy vector scores drown a precise keyword hit', () => {
    // Real e5 scores cluster at 0.78–0.86 even for unrelated text; a curated
    // two-keyword hit scores 0.6. Sorting by raw score always lost the hit.
    const picked = selectRelevantChunks([
      vector('v1', 'fees text', 0.84),
      vector('v2', 'courts text', 0.83),
      vector('v3', 'cheque text', 0.82),
      vector('v4', 'cyber text', 0.81),
      vector('v5', 'labour text', 0.8),
      curated('khula', 'khula text', 0.6),
    ]);
    expect(picked.map((c) => c.content)).toContain('khula text');
  });

  it('ranks a chunk both retrievers found above either alone', () => {
    const picked = selectRelevantChunks([
      vector('v1', 'fees text', 0.9),
      vector('v2', 'khula text', 0.8),
      curated('khula', 'khula text', 0.6),
    ]);
    expect(picked[0]?.content).toBe('khula text');
  });

  it('collapses the EN copy, UR copy and in-memory copy of one article', () => {
    // The Pakistan pack is seeded twice and also served by the keyword
    // matcher, so one article could otherwise take three of four slots.
    const picked = selectRelevantChunks([
      vector('kb-en', 'Bail stages text', 0.85),
      vector('kb-ur', 'Bail stages text', 0.85),
      curated('bail', 'Bail stages text', 0.7),
      vector('other', 'FIR text', 0.8),
    ]);
    expect(picked.filter((c) => c.content === 'Bail stages text')).toHaveLength(1);
    expect(picked).toHaveLength(2);
  });

  it('fills the slots with distinct articles', () => {
    const picked = selectRelevantChunks([
      vector('a-en', 'A', 0.9),
      vector('a-ur', 'A', 0.9),
      vector('b-en', 'B', 0.85),
      vector('b-ur', 'B', 0.85),
      vector('c', 'C', 0.8),
      vector('d', 'D', 0.79),
      vector('e', 'E', 0.78),
    ]);
    expect(picked.map((c) => c.content)).toEqual(['A', 'B', 'C', 'D']);
  });

  it('caps the agent context at four chunks', () => {
    const many = Array.from({ length: 9 }, (_, i) => vector(`v${i}`, `text ${i}`, 0.9 - i * 0.01));
    expect(selectRelevantChunks(many)).toHaveLength(4);
  });

  it('drops unusable scores — the old zero-vector rows produced NaN', () => {
    const picked = selectRelevantChunks([vector('nan', 'nan text', Number.NaN), vector('zero', 'zero text', 0), vector('ok', 'ok text', 0.5)]);
    expect(picked.map((c) => c.content)).toEqual(['ok text']);
  });

  it('returns nothing for nothing', () => {
    expect(selectRelevantChunks([])).toEqual([]);
  });
});

describe('contentKey', () => {
  it('treats whitespace and case differences as the same text', () => {
    expect(contentKey(vector('a', 'Bail  stages\ntext', 1))).toBe(contentKey(vector('b', 'bail stages text', 1)));
  });
});
