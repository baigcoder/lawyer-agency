import { describe, expect, it } from 'vitest';
import { extractJsonObject } from './json-content';

describe('extractJsonObject', () => {
  it('parses a raw JSON object', () => {
    expect(extractJsonObject('{"responseText":"ok"}')).toEqual({ responseText: 'ok' });
  });

  it('parses fenced JSON', () => {
    expect(extractJsonObject('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it('extracts JSON after reasoning prose', () => {
    expect(extractJsonObject('Sure.\n{"responseText":"جی ہاں","extractedFields":{}}')).toEqual({
      responseText: 'جی ہاں',
      extractedFields: {},
    });
  });
});
