import { describe, expect, it } from 'vitest';
import { QUICK_REPLY_STARTER_PACK } from './quick-reply-starter-pack';

describe('quick reply starter pack', () => {
  it('pairs every English reply with an Urdu one', () => {
    const en = QUICK_REPLY_STARTER_PACK.filter((r) => r.language === 'en');
    const ur = QUICK_REPLY_STARTER_PACK.filter((r) => r.language === 'ur');
    expect(en).toHaveLength(8);
    expect(ur).toHaveLength(8);
  });

  it('has unique titles per language, so re-adding the pack skips existing rows', () => {
    const keys = QUICK_REPLY_STARTER_PACK.map((r) => `${r.language}:${r.title}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('only uses lowercase {placeholders} the inbox can recognise', () => {
    for (const reply of QUICK_REPLY_STARTER_PACK) {
      const braces = reply.body.match(/\{[^}]*\}/g) ?? [];
      for (const token of braces) expect(token).toMatch(/^\{[a-z_]+\}$/);
    }
  });
});
