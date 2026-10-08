import { getAudioContext } from '@/lib/inbox-alert-sound';

/**
 * Wakeel UI sound cues — synthesised with Web Audio (no files, no payload).
 * Deliberately quiet, short and low in the mix: a chambers, not a casino.
 * Callers must gate on the user's sound preference; browsers additionally
 * block audio until a user gesture.
 */
export type UiSound = 'boot' | 'message' | 'approve' | 'alert' | 'tick';

interface Note {
  freq: number;
  at: number;
  dur: number;
  gain: number;
  type?: OscillatorType;
}

const CUES: Record<UiSound, Note[]> = {
  // Open fifth + octave, slow attack — the doors of the chambers opening.
  boot: [
    { freq: 293.66, at: 0, dur: 1.6, gain: 0.07 },
    { freq: 440, at: 0.12, dur: 1.5, gain: 0.055 },
    { freq: 587.33, at: 0.26, dur: 1.4, gain: 0.045 },
    { freq: 880, at: 0.42, dur: 1.1, gain: 0.02 },
  ],
  // Two soft bells — a client message arrived.
  message: [
    { freq: 880, at: 0, dur: 0.18, gain: 0.1 },
    { freq: 1174.66, at: 0.1, dur: 0.22, gain: 0.08 },
  ],
  // Rising major third — consequential, settled.
  approve: [
    { freq: 523.25, at: 0, dur: 0.22, gain: 0.08 },
    { freq: 659.25, at: 0.09, dur: 0.32, gain: 0.08 },
  ],
  // Low falling minor second, triangle — urgent, never shrill.
  alert: [
    { freq: 466.16, at: 0, dur: 0.26, gain: 0.09, type: 'triangle' },
    { freq: 440, at: 0.16, dur: 0.34, gain: 0.09, type: 'triangle' },
  ],
  tick: [{ freq: 1567.98, at: 0, dur: 0.05, gain: 0.035 }],
};

export function playUiSound(cue: UiSound): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  void ctx.resume();
  const now = ctx.currentTime + 0.01;

  // A gentle low-pass keeps every cue warm rather than digital.
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = cue === 'boot' ? 2200 : 4200;
  filter.connect(ctx.destination);

  for (const note of CUES[cue]) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = note.type ?? 'sine';
    osc.frequency.value = note.freq;
    const start = now + note.at;
    const attack = cue === 'boot' ? 0.18 : 0.015;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(note.gain, start + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + note.dur);
    osc.connect(gain);
    gain.connect(filter);
    osc.start(start);
    osc.stop(start + note.dur + 0.05);
  }
}
