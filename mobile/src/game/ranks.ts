export type RideRank = 'S' | 'A' | 'B' | 'C';

const RANK_NAMES: Record<RideRank, string> = {
  S: 'Legendary',
  A: 'Epic',
  B: 'Solid',
  C: 'Rookie',
};

export function computeRideRank(distanceKm: number, elevationM: number): RideRank {
  if (distanceKm >= 30 || elevationM >= 500) return 'S';
  if (distanceKm >= 15) return 'A';
  if (distanceKm >= 5) return 'B';
  return 'C';
}

export function rankDisplayName(rank: RideRank): string {
  return RANK_NAMES[rank];
}

export function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function estimateXpGain(distanceKm: number, durationMinutes: number): number {
  return Math.round(distanceKm * 10 + durationMinutes * 2);
}
