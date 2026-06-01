/** Simulator city anchors (mirrors backend simulate_active_cities.CITIES). */
export interface LiveMapCity {
    name: string;
    slug: string;
    lat: number;
    lng: number;
    colors: [string, string];
}

export const POLAND_SIM_CITIES: LiveMapCity[] = [
    { name: 'Warszawa', slug: 'warszawa', lat: 52.2297, lng: 21.0122, colors: ['#DC2626', '#FBBF24'] },
    { name: 'Kraków', slug: 'krakow', lat: 50.0647, lng: 19.9450, colors: ['#2563EB', '#10B981'] },
    { name: 'Wrocław', slug: 'wroclaw', lat: 51.1079, lng: 17.0385, colors: ['#F59E0B', '#EF4444'] },
    { name: 'Poznań', slug: 'poznan', lat: 52.4064, lng: 16.9252, colors: ['#8B5CF6', '#FBBF24'] },
    { name: 'Gdańsk', slug: 'gdansk', lat: 54.3520, lng: 18.6466, colors: ['#06B6D4', '#F59E0B'] },
    { name: 'Łódź', slug: 'lodz', lat: 51.7592, lng: 19.4560, colors: ['#EC4899', '#6366F1'] },
    { name: 'Lublin', slug: 'lublin', lat: 51.2465, lng: 22.5684, colors: ['#10B981', '#F59E0B'] },
    { name: 'Bydgoszcz', slug: 'bydgoszcz', lat: 53.1235, lng: 18.0084, colors: ['#3B82F6', '#EF4444'] },
    { name: 'Katowice', slug: 'katowice', lat: 50.2649, lng: 19.0238, colors: ['#14B8A6', '#F97316'] },
    { name: 'Siedlce', slug: 'siedlce', lat: 52.1676, lng: 22.2900, colors: ['#2563EB', '#10B981'] },
];

/** Lng/lat bounds covering all simulator cities with padding. */
export function polandCitiesBounds(): [[number, number], [number, number]] {
    let minLng = Infinity;
    let maxLng = -Infinity;
    let minLat = Infinity;
    let maxLat = -Infinity;
    for (const c of POLAND_SIM_CITIES) {
        minLng = Math.min(minLng, c.lng);
        maxLng = Math.max(maxLng, c.lng);
        minLat = Math.min(minLat, c.lat);
        maxLat = Math.max(maxLat, c.lat);
    }
    const padLng = 0.45;
    const padLat = 0.35;
    return [
        [minLng - padLng, minLat - padLat],
        [maxLng + padLng, maxLat + padLat],
    ];
}

/** Nearest city slug for a coordinate (for client-side aggregation). */
export function nearestCitySlug(lat: number, lng: number): string {
    let best = POLAND_SIM_CITIES[0].slug;
    let bestD = Infinity;
    for (const c of POLAND_SIM_CITIES) {
        const d = (c.lat - lat) ** 2 + (c.lng - lng) ** 2;
        if (d < bestD) {
            bestD = d;
            best = c.slug;
        }
    }
    return best;
}
