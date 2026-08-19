/**
 * RAG retrieval port (Phase 7 contract; implementation deepens in Phase 8).
 */

export interface RetrievedChunk {
  chunkId: string;
  content: string;
  score: number;
  source: 'knowledge_base' | 'document';
  kbId?: string;
  documentId?: string;
  title?: string;
}

export interface Retriever {
  search(params: {
    tenantId: string;
    query: string;
    language: string;
    topK?: number;
    clientId?: string | undefined;
    caseId?: string | undefined;
  }): Promise<RetrievedChunk[]>;
}

export const RETRIEVER = Symbol('RETRIEVER');
