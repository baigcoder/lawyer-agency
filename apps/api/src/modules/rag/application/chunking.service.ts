/**
 * Simple chunking strategy for RAG (Phase 8). No external tokenizer — uses
 * the ~4 chars/token rule of thumb. Prefers paragraph boundaries; falls back
 * to sentences when paragraphs exceed the target size.
 */

export interface Chunk {
  content: string;
  chunkIndex: number;
  tokenCount: number;
}

export interface ChunkOptions {
  targetTokens?: number;
  overlapTokens?: number;
}

const CHARS_PER_TOKEN = 4;

export function chunkText(text: string, options: ChunkOptions = {}): Chunk[] {
  const target = (options.targetTokens ?? 500) * CHARS_PER_TOKEN;
  const overlap = (options.overlapTokens ?? 100) * CHARS_PER_TOKEN;

  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
  const chunks: Chunk[] = [];
  let current = '';
  let index = 0;

  for (const paragraph of paragraphs) {
    if (current.length + paragraph.length <= target) {
      current = current ? `${current}\n\n${paragraph}` : paragraph;
    } else {
      if (current) pushChunk(chunks, current, index++);
      if (paragraph.length > target) {
        // Paragraph too big: split by sentences.
        const sentences = paragraph.match(/[^.!?]+[.!?]+/g) ?? [paragraph];
        current = '';
        for (const sentence of sentences) {
          if (current.length + sentence.length <= target) {
            current = current ? `${current} ${sentence.trim()}` : sentence.trim();
          } else {
            if (current) pushChunk(chunks, current, index++);
            current = sentence.trim();
          }
        }
      } else {
        current = paragraph;
      }
    }
  }
  if (current) pushChunk(chunks, current, index++);

  // Add overlaps between adjacent chunks for continuity.
  return chunks.map((c, i) => {
    if (i === 0) return c;
    const prev = chunks[i - 1];
    if (!prev) return c;
    const overlapText = prev.content.slice(-overlap).trim();
    if (!overlapText) return c;
    return {
      ...c,
      content: `${overlapText}\n\n${c.content}`,
      tokenCount: estimateTokens(`${overlapText}\n\n${c.content}`),
    };
  });
}

function pushChunk(chunks: Chunk[], content: string, index: number): void {
  chunks.push({ content: content.trim(), chunkIndex: index, tokenCount: estimateTokens(content) });
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}
