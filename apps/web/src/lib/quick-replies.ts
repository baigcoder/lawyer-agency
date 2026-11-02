/** Placeholders the inbox fills from the conversation; any other {name} is left for the lawyer. */
export interface QuickReplyValues {
  client_name?: string | null | undefined;
  firm_name?: string | null | undefined;
  case_ref?: string | null | undefined;
  lawyer_name?: string | null | undefined;
}

const PLACEHOLDER = /\{([a-z_]+)\}/g;

export function fillQuickReply(body: string, values: QuickReplyValues): string {
  return body.replace(PLACEHOLDER, (match, key: string) => {
    const value = values[key as keyof QuickReplyValues];
    return value && value.trim() ? value.trim() : match;
  });
}

/** The next unfilled {placeholder} at or after `from`, wrapping to the start. */
export function nextPlaceholder(text: string, from: number): { start: number; end: number } | null {
  const all = [...text.matchAll(PLACEHOLDER)].map((m) => ({ start: m.index, end: m.index + m[0].length }));
  return all.find((p) => p.start >= from) ?? all[0] ?? null;
}

/** Titles first, then body text; matches in the UI language rank above the other. */
export function matchQuickReplies<T extends { title: string; body: string; language: string }>(
  items: readonly T[],
  query: string,
  language: string,
): T[] {
  const q = query.trim().toLowerCase();
  const score = (item: T) => {
    const title = item.title.toLowerCase();
    const base = !q ? 1 : title.startsWith(q) ? 3 : title.includes(q) ? 2 : item.body.toLowerCase().includes(q) ? 1 : 0;
    return base === 0 ? 0 : base * 2 + (item.language === language ? 1 : 0);
  };
  return items
    .map((item) => ({ item, s: score(item) }))
    .filter(({ s }) => s > 0)
    .sort((a, b) => b.s - a.s || a.item.title.localeCompare(b.item.title))
    .map(({ item }) => item);
}
