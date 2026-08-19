let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  if (!audioContext) audioContext = new Ctx();
  return audioContext;
}

/** Browsers block audio until a user gesture; call this on first click/key. */
export function unlockInboxSound(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') void ctx.resume();
}

/** Short two-tone chime for a newly arrived WhatsApp message. */
export function playInboxSound(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  void ctx.resume();

  const now = ctx.currentTime;
  const notes = [
    { freq: 880, start: 0 },
    { freq: 1174.7, start: 0.11 },
  ];

  for (const note of notes) {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = note.freq;
    const start = now + note.start;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.14, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(start);
    oscillator.stop(start + 0.18);
  }
}
