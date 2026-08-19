/** Merge newly extracted intake fields onto known ones. Empty values never wipe facts. */
export function mergeIntakeFields(
  existing: Record<string, unknown>,
  incoming: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!incoming) return { ...existing };
  const merged = { ...existing };
  for (const [key, value] of Object.entries(incoming)) {
    if (value === undefined || value === null) continue;
    if (typeof value === 'string' && value.trim() === '') continue;
    merged[key] = value;
  }
  return merged;
}
