import { describe, expect, it } from 'vitest';
import { selectRelevantChunks } from './retrieved-chunks';

describe('selectRelevantChunks', () => {
  it('drops weak matches and keeps the strongest few', () => {
    const selected = selectRelevantChunks([
      { chunkId: 'a', content: 'fee', score: 0.81, source: 'knowledge_base', title: 'Fees' },
      { chunkId: 'b', content: 'noise', score: 0.05, source: 'knowledge_base', title: 'Other' },
      { chunkId: 'c', content: 'hours', score: 0.4, source: 'knowledge_base', title: 'Hours' },
    ]);
    expect(selected.map((c) => c.chunkId)).toEqual(['a', 'c']);
  });
});
