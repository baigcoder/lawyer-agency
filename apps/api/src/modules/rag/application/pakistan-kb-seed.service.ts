import { Injectable, Logger } from '@nestjs/common';
import { KnowledgeBaseService } from './knowledge-base.service';
import { PAKISTAN_LAWYER_KNOWLEDGE, PAKISTAN_PROCESS_CATEGORY } from './pakistan-lawyer-knowledge';

/**
 * Publishes the shared Pakistan legal-process pack into each tenant KB
 * so dashboard search and RAG citations see the same articles the agent uses.
 */
@Injectable()
export class PakistanKbSeedService {
  private readonly logger = new Logger(PakistanKbSeedService.name);
  private readonly inFlight = new Set<string>();
  private readonly done = new Set<string>();

  constructor(private readonly kb: KnowledgeBaseService) {}

  /** Idempotent. Safe to fire-and-forget on inbound so the client reply is not blocked. */
  ensureForTenantInBackground(tenantId: string): void {
    if (this.done.has(tenantId) || this.inFlight.has(tenantId)) return;
    this.inFlight.add(tenantId);
    void this.ensureForTenant(tenantId)
      .then((created) => {
        this.done.add(tenantId);
        if (created > 0) {
          this.logger.log({ tenantId, created }, 'seeded Pakistan process knowledge base');
        }
      })
      .catch((error: unknown) => {
        this.logger.warn(
          { tenantId, err: error instanceof Error ? error.message : 'seed' },
          'Pakistan process KB seed skipped',
        );
      })
      .finally(() => {
        this.inFlight.delete(tenantId);
      });
  }

  async ensureForTenant(tenantId: string): Promise<number> {
    const existing = await this.kb.list(tenantId);
    const have = new Set(
      existing
        .filter((row) => row.category === PAKISTAN_PROCESS_CATEGORY)
        .map((row) => `${row.language}:${row.title}`),
    );
    let created = 0;
    // Dual EN+UR tags so language-scoped RAG does not drop bilingual articles.
    for (const language of ['EN', 'UR'] as const) {
      for (const article of PAKISTAN_LAWYER_KNOWLEDGE) {
        const key = `${language}:${article.title}`;
        if (have.has(key)) continue;
        const entry = await this.kb.create({
          tenantId,
          title: article.title,
          content: article.content,
          language,
          category: PAKISTAN_PROCESS_CATEGORY,
        });
        await this.kb.publish(tenantId, entry.id);
        have.add(key);
        created += 1;
      }
    }
    return created;
  }
}
