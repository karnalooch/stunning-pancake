import type { RideFinishState } from '../../features/ride/model/RideFinishState';
import { getAppCopy } from './appCopy';

export function metricNumber(value: number | null | undefined, digits = 1): string {
  return value != null && Number.isFinite(value) && value >= 0 ? value.toFixed(digits) : '—';
}
export function elapsedLabel(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value) || value < 0) return '—';
  const total = Math.round(value);
  return `${Math.floor(total / 3600)}:${String(Math.floor(total / 60) % 60).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}
/** Share precisely the displayed, confirmed result, never the newest history entry. */
export function buildSummaryShare(state: RideFinishState, locale: string): { title: string; message: string } | null {
  if (state.kind !== 'durable-success') return null;
  const c = getAppCopy(locale);
  return { title: c.shareTitle, message: [c.shareTitle,
    `${c.distance}: ${metricNumber(state.summary.distanceKm)} km`,
    `${c.duration}: ${elapsedLabel(state.summary.elapsedS)}`,
    `${c.elevation}: ${metricNumber(state.summary.elevationGainM, 0)} m`,
  ].join('\n') };
}
