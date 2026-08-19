import { Injectable } from '@nestjs/common';
import { UnitOfWork } from '../../../common/prisma/unit-of-work';
import type { PromptRecord, PromptRepository } from '../application/ports';

/**
 * Loads active prompts from `platform.prompt_versions`. Falls back to a
 * hard-coded default when no active row exists so the pipeline can run before
 * the prompt registry is populated.
 */
@Injectable()
export class PrismaPromptRepository implements PromptRepository {
  constructor(private readonly uow: UnitOfWork) {}

  async findActive(tenantId: string, agent: string): Promise<PromptRecord | null> {
    return this.uow.withPlatform(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ id: string; version: number; template: string }>>`
        SELECT id, version, template
        FROM platform.prompt_versions
        WHERE agent = ${agent} AND "isActive" = true
        ORDER BY version DESC
        LIMIT 1`;
      const row = rows[0];
      if (!row) return null;
      return { id: row.id, agent, version: row.version, template: row.template };
    });
  }
}

export function renderTemplate(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] ?? '');
}
