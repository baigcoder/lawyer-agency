/**
 * Firm call hours in a named IANA timezone (default Asia/Karachi).
 * Empty start/end means the AI answers around the clock.
 */
export function isWithinCallHours(
  now: Date,
  start: string,
  end: string,
  timeZone: string,
): boolean {
  if (!start || !end) return true;
  const minutes = clockMinutesInZone(now, timeZone);
  const startMin = parseClock(start);
  const endMin = parseClock(end);
  if (startMin === null || endMin === null) return true;
  if (startMin === endMin) return true;
  if (startMin < endMin) return minutes >= startMin && minutes < endMin;
  return minutes >= startMin || minutes < endMin;
}

function parseClock(value: string): number | null {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value.trim());
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

function clockMinutesInZone(now: Date, timeZone: string): number {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(now);
    const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
    const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
    return hour * 60 + minute;
  } catch {
    return now.getUTCHours() * 60 + now.getUTCMinutes();
  }
}
