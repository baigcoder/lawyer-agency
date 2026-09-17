import { describe, expect, it, vi } from 'vitest';
import { AiEventHandler } from './ai-event.handler';
import { isRetryLater } from '../../../common/errors/retry-later.error';
import { conversationLockKey } from '../../../common/locks/resource-lock.service';
import type { AiOrchestratorService } from './ai-orchestrator.service';
import type { ResourceLockService } from '../../../common/locks/resource-lock.service';

function makeHandler(acquired: boolean) {
  const process = vi.fn(async () => undefined);
  const orchestrator = { process } as unknown as AiOrchestratorService;
  const keys: string[] = [];
  const locks = {
    withLock: vi.fn(async (key: string, _lease: number, fn: () => Promise<unknown>) => {
      keys.push(key);
      if (!acquired) return { acquired: false as const };
      return { acquired: true as const, result: await fn() };
    }),
  } as unknown as ResourceLockService;
  return { handler: new AiEventHandler(orchestrator, locks), process, locks, keys };
}

const job = {
  tenantId: 't1',
  type: 'message.inbound.received',
  occurredAt: new Date(),
  payload: { conversationId: 'conv-1', messageId: 'msg-1' },
};

describe('conversationLockKey', () => {
  it('is tenant-scoped so conversation ids cannot collide across tenants', () => {
    expect(conversationLockKey('t1', 'c1')).not.toBe(conversationLockKey('t2', 'c1'));
    expect(conversationLockKey('t1', 'c1')).toContain('t1');
  });
});

describe('AiEventHandler', () => {
  it('runs the turn while holding the conversation lock', async () => {
    const { handler, process, keys } = makeHandler(true);
    await handler.handle(job);
    expect(process).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 't1', conversationId: 'conv-1', messageId: 'msg-1' }),
    );
    expect(keys[0]).toBe(conversationLockKey('t1', 'conv-1'));
  });

  it('defers instead of answering a conversation that is already being answered', async () => {
    const { handler, process } = makeHandler(false);
    // Two rapid messages from one client used to produce two concurrent turns,
    // two replies, and a race on the escalation row.
    const error = await handler.handle(job).then(() => null, (e: unknown) => e);
    expect(isRetryLater(error)).toBe(true);
    expect(process).not.toHaveBeenCalled();
  });

  it('marks the deferral as retry-later, not as a failure', async () => {
    const { handler } = makeHandler(false);
    const error = await handler.handle(job).catch((e: unknown) => e);
    expect(isRetryLater(error)).toBe(true);
    expect((error as { delayMs: number }).delayMs).toBeGreaterThan(0);
  });
});
