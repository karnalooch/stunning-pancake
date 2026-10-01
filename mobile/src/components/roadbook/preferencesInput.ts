export function parsePreferenceNumber(text: string, min: number, max: number, integer = false): number | null {
  const normalized = text.trim().replace(',', '.');
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) return null;
  const value = Number(normalized);
  return Number.isFinite(value) && value >= min && value <= max && (!integer || Number.isInteger(value)) ? value : null;
}
