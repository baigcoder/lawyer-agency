import { phonesMatch } from './sip-phone';

/** WhatsApp rings ~30s; wait most of that for Wavoip's SIP INVITE. */
export const INVITE_CLAIM_TIMEOUT_MS = 25_000;

type Waiter<T> = {
  phone: string;
  resolve: (dialog: T | null) => void;
  timer: ReturnType<typeof setTimeout>;
};

type Parked<T> = {
  digits: string;
  dialog: T;
  timer: ReturnType<typeof setTimeout>;
};

/**
 * Holds inbound SIP INVITEs until the WhatsApp call job claims them by caller
 * digits, or until the wait expires (missed-call fallback).
 *
 * WhatsApp CALL webhooks often carry a LID while SIP From has the real PN (or
 * the reverse). When only one INVITE is parked/waiting, match it anyway so a
 * single ringing call is not dropped on identity mismatch.
 */
export class InvitePark<T> {
  private parked: Parked<T>[] = [];
  private waiters: Waiter<T>[] = [];

  park(digits: string, dialog: T, idleTimeoutMs: number, onIdle: (dialog: T) => void): void {
    const waiterIdx = this.waiters.findIndex((waiter) => phonesMatch(waiter.phone, digits));
    if (waiterIdx >= 0) {
      const waiter = this.waiters[waiterIdx];
      if (!waiter) return;
      this.waiters.splice(waiterIdx, 1);
      clearTimeout(waiter.timer);
      waiter.resolve(dialog);
      return;
    }
    // Sole waiter + sole inbound ring: LID/PN mismatch must not drop the call.
    if (this.waiters.length === 1 && this.parked.length === 0) {
      const waiter = this.waiters[0];
      if (waiter) {
        this.waiters = [];
        clearTimeout(waiter.timer);
        waiter.resolve(dialog);
        return;
      }
    }
    const entry: Parked<T> = {
      digits,
      dialog,
      timer: setTimeout(() => {
        this.parked = this.parked.filter((item) => item !== entry);
        onIdle(dialog);
      }, idleTimeoutMs),
    };
    this.parked.push(entry);
  }

  claim(phone: string, timeoutMs: number): Promise<T | null> {
    const parkedIdx = this.parked.findIndex((item) => phonesMatch(item.digits, phone));
    if (parkedIdx >= 0) {
      const entry = this.parked[parkedIdx];
      if (!entry) return Promise.resolve(null);
      this.parked.splice(parkedIdx, 1);
      clearTimeout(entry.timer);
      return Promise.resolve(entry.dialog);
    }
    // Sole parked INVITE while one WhatsApp call is connecting.
    if (this.parked.length === 1 && this.waiters.length === 0) {
      const entry = this.parked[0];
      if (entry) {
        this.parked = [];
        clearTimeout(entry.timer);
        return Promise.resolve(entry.dialog);
      }
    }
    return new Promise((resolve) => {
      const waiter: Waiter<T> = {
        phone,
        resolve,
        timer: setTimeout(() => {
          this.waiters = this.waiters.filter((item) => item !== waiter);
          resolve(null);
        }, timeoutMs),
      };
      this.waiters.push(waiter);
    });
  }

  drop(dialog: T): void {
    const entry = this.parked.find((item) => item.dialog === dialog);
    if (!entry) return;
    clearTimeout(entry.timer);
    this.parked = this.parked.filter((item) => item !== entry);
  }

  clear(): void {
    for (const item of this.parked) clearTimeout(item.timer);
    for (const waiter of this.waiters) {
      clearTimeout(waiter.timer);
      waiter.resolve(null);
    }
    this.parked = [];
    this.waiters = [];
  }
}
