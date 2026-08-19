import type { z } from 'zod';
import type { Language } from '../domain/types';

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AiCallOptions<T extends z.ZodType> {
  tenantId: string;
  agent: string;
  messages: LlmMessage[];
  outputSchema: T;
  /** Model chosen by the router (D-006); adapter falls back to AI_DEFAULT_MODEL when absent. */
  model?: string | null | undefined;
  temperature?: number;
  maxTokens?: number;
  /** Per-call fetch abort. Adapter default is 20s. */
  timeoutMs?: number | undefined;
  promptVersionId?: string | null | undefined;
  correlationId?: string | null | undefined;
}

export interface AiCallResult<T> {
  output: T;
  provider: string;
  model: string;
  latencyMs: number;
  tokensIn: number;
  tokensOut: number;
  costMicros: number;
}

/** Vendor-agnostic LLM client port. */
export interface AiClient {
  readonly provider: string;
  call<T>(options: AiCallOptions<z.ZodType>): Promise<AiCallResult<T>>;
}

export const AI_CLIENT = Symbol('AI_CLIENT');

export interface PromptRecord {
  id: string | null;
  agent: string;
  version: number;
  template: string;
}

/** Loads the active prompt for an agent. */
export interface PromptRepository {
  findActive(tenantId: string, agent: string): Promise<PromptRecord | null>;
}

export const PROMPT_REPOSITORY = Symbol('PROMPT_REPOSITORY');

export interface RetrievedChunk {
  chunkId: string;
  content: string;
  score: number;
  source: 'knowledge_base' | 'document';
  kbId?: string;
  documentId?: string;
  title?: string;
}

/** RAG retrieval port — implemented by the RAG module. */
export interface Retriever {
  search(params: {
    tenantId: string;
    query: string;
    language: Language;
    topK?: number;
    clientId?: string | undefined;
    caseId?: string | undefined;
  }): Promise<RetrievedChunk[]>;
}

export const RETRIEVER = Symbol('RETRIEVER');

export interface ModelChoice {
  provider: string;
  model: string;
  inputCostPer1kTokens: number; // USD
  outputCostPer1kTokens: number; // USD
}

export interface ModelRouter {
  choose(agent: string, tenantId: string, tenantAllowlist: string[]): ModelChoice;
  checkBudget(tenantId: string, estimatedCostMicros: number): Promise<boolean>;
}

export const MODEL_ROUTER = Symbol('MODEL_ROUTER');
