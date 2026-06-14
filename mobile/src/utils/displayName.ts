/** Human-readable rider label — never show full e2e email as a headline. */
export function formatRiderDisplayName(
  raw: string | undefined | null,
  fallback = 'RIDER',
): string {
  const s = (raw ?? '').trim();
  if (!s) return fallback;
  if (s.includes('@')) {
    const local = s.split('@')[0] ?? s;
    return local.length > 24 ? `${local.slice(0, 21)}…` : local;
  }
  return s.length > 28 ? `${s.slice(0, 25)}…` : s;
}
