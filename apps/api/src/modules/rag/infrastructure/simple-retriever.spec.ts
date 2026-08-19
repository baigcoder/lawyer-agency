import { describe, expect, it } from 'vitest';
import { buildKeywordPatterns } from './simple-retriever';

describe('buildKeywordPatterns', () => {
  it('matches meaningful words without requiring the full question verbatim', () => {
    expect(buildKeywordPatterns('What are requirements for income tax filer documents?')).toEqual([
      '%requirements%',
      '%income%',
      '%tax%',
      '%filer%',
      '%documents%',
    ]);
  });

  it('supports Urdu terms and removes duplicates', () => {
    expect(buildKeywordPatterns('ٹیکس فائلر ٹیکس')).toEqual(['%ٹیکس%', '%فائلر%']);
  });
});
