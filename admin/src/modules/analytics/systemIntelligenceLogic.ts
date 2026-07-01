/** Normalize AI insights API payload to card rows. */
export function normalizeInsightsPayload(data: unknown): Array<{
  title: string;
  desc: string;
  type: string;
  color: string;
}> {
  const items = Array.isArray(data)
    ? data
    : (data as { insights?: unknown })?.insights && Array.isArray((data as { insights: unknown[] }).insights)
      ? (data as { insights: unknown[] }).insights
      : [];

  return items.map((item) => {
    const row = item as Record<string, string>;
    return {
      title: row.title ?? '',
      desc: row.desc ?? '',
      type: row.type ?? '',
      color: row.color ?? 'gray',
    };
  });
}
