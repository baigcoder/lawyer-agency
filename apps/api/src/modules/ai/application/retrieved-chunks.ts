import type { RetrievedChunk } from '../../rag/application/retriever.port';

const MAX_CHUNKS = 4;
/** Reciprocal Rank Fusion damping constant — 60 is the published default. */
const RRF_K = 60;

/**
 * Picks the chunks the agent sees.
 *
 * Two retrievers feed this, and their scores are not comparable:
 *   - the curated Pakistan keyword matcher scores 0.4 + 0.1 per keyword hit,
 *     so a precise two-keyword match on "khula" is 0.6;
 *   - vector search returns cosine similarity, which for multilingual-e5 sits
 *     between 0.78 and 0.86 for relevant *and* irrelevant text alike (measured:
 *     "order a pizza" scored 0.803 against the legal knowledge base).
 * Sorting the merged list by raw score let every fuzzy vector match outrank
 * every precise keyword hit, so turning real embeddings on would have pushed
 * the most reliable matches out of the agent's context.
 *
 * The lists are fused by rank instead (Reciprocal Rank Fusion). It is
 * scale-free: neither retriever can drown the other, and a chunk both of them
 * found rises to the top.
 *
 * Duplicates are collapsed before fusing. The Pakistan pack is seeded twice
 * (EN and UR tags over identical text) and also served from memory by the
 * keyword matcher, so one article could otherwise take three of four slots —
 * and, counted once per copy, would outvote a firm's own single-copy article.
 *
 * There is deliberately no absolute score floor any more: with e5 the on- and
 * off-topic score ranges overlap completely, so a threshold cannot separate
 * them. Off-topic messages are stopped before retrieval (`isCasualOffTopic`,
 * the router's OFF_TOPIC) and agents only use context that is relevant.
 */
export function selectRelevantChunks(chunks: readonly RetrievedChunk[]): RetrievedChunk[] {
  const usable = chunks.filter((chunk) => Number.isFinite(chunk.score) && chunk.score > 0);

  const lists = [usable.filter(isCuratedMatch), usable.filter((chunk) => !isCuratedMatch(chunk))].map((list) =>
    dedupe([...list].sort((a, b) => b.score - a.score)),
  );

  const fused = new Map<string, { chunk: RetrievedChunk; rrf: number }>();
  for (const list of lists) {
    list.forEach((chunk, rank) => {
      const key = contentKey(chunk);
      const contribution = 1 / (RRF_K + rank + 1);
      const entry = fused.get(key);
      if (entry) entry.rrf += contribution;
      else fused.set(key, { chunk, rrf: contribution });
    });
  }

  return [...fused.values()]
    .sort((a, b) => b.rrf - a.rrf)
    .slice(0, MAX_CHUNKS)
    .map((entry) => entry.chunk);
}

/** Chunks from the in-memory curated keyword matcher, not a retriever. */
function isCuratedMatch(chunk: RetrievedChunk): boolean {
  return chunk.chunkId.startsWith('pakistan:');
}

/** Same text, same chunk — regardless of which retriever or language tag served it. */
export function contentKey(chunk: RetrievedChunk): string {
  return chunk.content.toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 400);
}

/** Keeps the first (best-ranked) copy of each distinct text in an ordered list. */
function dedupe(list: RetrievedChunk[]): RetrievedChunk[] {
  const seen = new Set<string>();
  return list.filter((chunk) => {
    const key = contentKey(chunk);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
