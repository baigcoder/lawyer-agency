/**
 * Signals that a job could not run *yet* and should be re-queued after a short
 * delay — not that it failed.
 *
 * The dispatcher turns this into a BullMQ delayed move, so it does not consume
 * a retry attempt and does not land in the failed set. Use it for contention
 * (a lock held elsewhere), never for a genuine error.
 */
export class RetryLaterError extends Error {
  readonly retryLater = true;

  constructor(
    message: string,
    /** How long to wait before the job becomes eligible again. */
    readonly delayMs = 1_500,
  ) {
    super(message);
    this.name = 'RetryLaterError';
  }
}

export function isRetryLater(error: unknown): error is RetryLaterError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'retryLater' in error &&
    (error as { retryLater?: unknown }).retryLater === true
  );
}
