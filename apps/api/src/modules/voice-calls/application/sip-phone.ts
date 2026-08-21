/** Digits-only phone identity used to match a Wavoip SIP INVITE to a WhatsApp caller. */
export function phoneDigits(value: string | undefined | null): string {
  if (!value) return '';
  const user = value.includes('@') ? (value.split('@')[0] ?? value) : value;
  return user.replace(/\D/g, '');
}

/**
 * WhatsApp JIDs and SIP From/PAI often differ by a leading country code or `+`.
 * Treat as the same caller when one digit string is a suffix of the other.
 */
export function phonesMatch(left: string, right: string): boolean {
  const a = phoneDigits(left);
  const b = phoneDigits(right);
  if (a.length < 7 || b.length < 7) return false;
  return a === b || a.endsWith(b) || b.endsWith(a);
}

function aorUri(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value !== 'object' || value === null) return '';
  const uri = 'uri' in value ? value.uri : undefined;
  const name = 'name' in value ? value.name : undefined;
  if (typeof uri === 'string') return uri;
  if (typeof name === 'string') return name;
  return '';
}

function collectHeaderValues(raw: unknown): unknown[] {
  if (raw === undefined || raw === null) return [];
  return Array.isArray(raw) ? raw : [raw];
}

/** Caller digits from SIP From URI / display name and optional P-Asserted-Identity. */
export function callerDigitsFromSip(input: {
  fromUri?: string | undefined;
  fromName?: string | undefined;
  assertedIdentity?: unknown;
}): string {
  const candidates = [
    phoneDigits(input.fromUri),
    phoneDigits(input.fromName),
    ...collectHeaderValues(input.assertedIdentity).map((item) => phoneDigits(aorUri(item))),
  ];
  return candidates.find((digits) => digits.length >= 7) ?? candidates.find((digits) => digits.length > 0) ?? '';
}
