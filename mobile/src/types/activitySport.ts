/** Canonical activity types supported by 4VELO (Tier 0). */
export type ActivitySportType = 'RUN' | 'BIKE' | 'WALK';

export const ACTIVITY_SPORT_OPTIONS: { type: ActivitySportType; labelPl: string; labelEn: string }[] = [
  { type: 'BIKE', labelPl: 'Rower', labelEn: 'Cycling' },
  { type: 'RUN', labelPl: 'Bieg', labelEn: 'Running' },
  { type: 'WALK', labelPl: 'Nordic walking', labelEn: 'Nordic walking' },
];
