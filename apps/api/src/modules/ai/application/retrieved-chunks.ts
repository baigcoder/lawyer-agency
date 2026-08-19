import type { RetrievedChunk } from '../../rag/application/retriever.port';

const MIN_SCORE = 0.22;
const MAX_CHUNKS = 4;

/** Drop weak RAG matches so agents do not treat noise as knowledge. */
export function selectRelevantChunks(chunks: readonly RetrievedChunk[]): RetrievedChunk[] {
  return [...chunks]
    .filter((chunk) => Number.isFinite(chunk.score) && chunk.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_CHUNKS);
}
