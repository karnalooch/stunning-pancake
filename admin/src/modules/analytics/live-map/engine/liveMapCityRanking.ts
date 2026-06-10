import { POLAND_SIM_CITIES, type LiveMapCity } from './liveMapCities';

export type CityRankingRow = {
    city: LiveMapCity;
    total: number;
    bike: number;
    run: number;
    trend: number;
};

export type BuildCityRankingOptions = {
    /** Include cities with zero riders (navigation in macro tier). */
    includeInactive?: boolean;
};

export function buildCityRanking(
    counts: Record<string, number>,
    bikeCounts: Record<string, number>,
    runCounts: Record<string, number>,
    trend: Record<string, number>,
    options?: BuildCityRankingOptions,
): CityRankingRow[] {
    const rows = POLAND_SIM_CITIES.map((city) => ({
        city,
        total: counts[city.slug] ?? 0,
        bike: bikeCounts[city.slug] ?? 0,
        run: runCounts[city.slug] ?? 0,
        trend: trend[city.slug] ?? 0,
    })).sort((a, b) => b.total - a.total || a.city.name.localeCompare(b.city.name, 'pl'));

    if (options?.includeInactive) return rows;
    return rows.filter((r) => r.total > 0);
}
