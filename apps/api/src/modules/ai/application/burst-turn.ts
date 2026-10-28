/**
 * Answering a burst of client messages once.
 *
 * Clients rarely send one tidy message: "Assalam o alaikum", then the story,
 * then a voice note or a photo of the FIR. Answering each as it lands sends
 * three replies, the early ones before the facts arrive — and the escalation
 * check sees only the last fragment ("please help"), not the one that said
 * "police arrested my brother".
 *
 * So every inbound event first looks at the unanswered messages since the
 * last outbound one. Only the newest answers; it waits briefly for the client
 * to finish (and for earlier voice notes / attachments to be processed), then
 * replies to all of them together. A hard cap measured from the oldest
 * pending message keeps a stuck transcription from silencing the thread.
 */

export interface BurstMessage {
  id: string;
  createdAt: Date;
  body: string | null;
  /** Media still being downloaded or transcribed (its event has not fired). */
  processing: boolean;
}

export type BurstPlan =
  | { action: 'skip'; reason: string }
  | { action: 'wait'; delayMs: number; reason: string }
  | { action: 'answer'; messageIds: string[]; clientText: string };

export interface BurstOptions {
  /** Quiet period after the newest message before answering. 0 disables batching. */
  settleMs: number;
  /** Never wait longer than this, measured from the oldest pending message. */
  maxWaitMs: number;
  /** At most this many messages are combined into one turn. */
  maxMessages: number;
}

export const DEFAULT_BURST_OPTIONS: BurstOptions = { settleMs: 4_000, maxWaitMs: 45_000, maxMessages: 12 };

const POLL_MS = 1_500;

export function planBurstTurn(input: {
  pending: BurstMessage[];
  triggerId: string;
  now: number;
  options?: BurstOptions;
}): BurstPlan {
  const options = input.options ?? DEFAULT_BURST_OPTIONS;
  const sorted = [...input.pending]
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id))
    .slice(-options.maxMessages);
  const trigger = sorted.find((m) => m.id === input.triggerId);

  // Not pending (already answered, or outside the window): answer it alone,
  // exactly as before batching existed.
  if (!trigger || options.settleMs <= 0) {
    const body = trigger?.body ?? input.pending.find((m) => m.id === input.triggerId)?.body ?? '';
    return { action: 'answer', messageIds: [input.triggerId], clientText: body };
  }

  const newest = sorted[sorted.length - 1];
  const oldest = sorted[0];
  if (!newest || !oldest) return { action: 'answer', messageIds: [input.triggerId], clientText: trigger.body ?? '' };

  if (newest.id !== trigger.id) {
    return { action: 'skip', reason: 'a newer message in this burst will answer it' };
  }

  const sinceOldest = input.now - oldest.createdAt.getTime();
  if (sinceOldest < options.maxWaitMs) {
    const quietFor = input.now - newest.createdAt.getTime();
    if (quietFor < options.settleMs) {
      const delayMs = Math.min(options.settleMs, Math.max(250, options.settleMs - quietFor + 250));
      return { action: 'wait', delayMs, reason: 'client may still be typing' };
    }
    if (sorted.some((m) => m.processing && m.id !== trigger.id)) {
      return { action: 'wait', delayMs: POLL_MS, reason: 'an earlier voice note or attachment is still processing' };
    }
  }

  const clientText = sorted
    .map((m) => (m.body ?? '').trim())
    .filter((text) => text.length > 0)
    .join('\n');
  return {
    action: 'answer',
    messageIds: sorted.map((m) => m.id),
    clientText: clientText || (trigger.body ?? ''),
  };
}
