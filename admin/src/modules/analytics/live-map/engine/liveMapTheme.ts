/** White-label Live Map palette — clusters, hubs, rider accents. */

export type LiveMapTheme = {
    clusterStops: Array<[number, string]>;
    hubAccent: string;
    bikeColor: string;
    runColor: string;
    h3Fill: string;
    h3Stroke: string;
};

const DEFAULT_THEME: LiveMapTheme = {
    clusterStops: [
        [2, '#06b6d4'],
        [12, '#6366f1'],
        [35, '#a855f7'],
        [70, '#ec4899'],
        [120, '#e11d48'],
    ],
    hubAccent: '#6366f1',
    bikeColor: '#7c3aed',
    runColor: '#10b981',
    h3Fill: '#6366f1',
    h3Stroke: 'rgba(255,255,255,0.35)',
};

function clamp(n: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, n));
}

function parseHex(hex: string): { r: number; g: number; b: number } | null {
    const h = hex.replace('#', '').trim();
    if (h.length !== 6) return null;
    const n = parseInt(h, 16);
    if (!Number.isFinite(n)) return null;
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToHex(r: number, g: number, b: number): string {
    const to = (v: number) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0');
    return `#${to(r)}${to(g)}${to(b)}`;
}

function mix(a: string, b: string, t: number): string {
    const c1 = parseHex(a);
    const c2 = parseHex(b);
    if (!c1 || !c2) return a;
    const w = clamp(t, 0, 1);
    return rgbToHex(
        c1.r + (c2.r - c1.r) * w,
        c1.g + (c2.g - c1.g) * w,
        c1.b + (c2.b - c1.b) * w,
    );
}

function lighten(hex: string, amount: number): string {
    return mix(hex, '#ffffff', amount);
}

function darken(hex: string, amount: number): string {
    return mix(hex, '#000000', amount);
}

export function defaultLiveMapTheme(): LiveMapTheme {
    return { ...DEFAULT_THEME, clusterStops: [...DEFAULT_THEME.clusterStops] };
}

export type BrandingInput = {
    primary_color?: string;
    secondary_color?: string;
    map_theme?: Record<string, unknown>;
};

export function resolveLiveMapTheme(branding?: BrandingInput | null): LiveMapTheme {
    if (!branding) return defaultLiveMapTheme();

    const primary = branding.primary_color || '#06b6d4';
    const secondary = branding.secondary_color || '#92fe9d';
    const overrides = branding.map_theme || {};

    const clusterFromBrand: Array<[number, string]> = [
        [2, lighten(primary, 0.15)],
        [12, primary],
        [35, mix(primary, secondary, 0.45)],
        [70, darken(secondary, 0.1)],
        [120, darken(primary, 0.25)],
    ];

    const customStops = overrides.cluster_stops;
    let clusterStops = clusterFromBrand;
    if (Array.isArray(customStops) && customStops.length >= 2) {
        clusterStops = customStops
            .filter((s): s is [number, string] => Array.isArray(s) && s.length === 2)
            .map(([n, c]) => [Number(n), String(c)]);
    }

    return {
        clusterStops,
        hubAccent: typeof overrides.hub_accent === 'string' ? overrides.hub_accent : primary,
        bikeColor: typeof overrides.bike_color === 'string' ? overrides.bike_color : darken(primary, 0.05),
        runColor: typeof overrides.run_color === 'string' ? overrides.run_color : secondary,
        h3Fill: typeof overrides.h3_fill === 'string' ? overrides.h3_fill : mix(primary, secondary, 0.35),
        h3Stroke: typeof overrides.h3_stroke === 'string' ? overrides.h3_stroke : 'rgba(255,255,255,0.35)',
    };
}

/** Match expression for bike / run accent colors (circles, direction chevrons). */
export function activityKindColorExpression(theme: LiveMapTheme): unknown[] {
    return ['match', ['get', 'kind'], 'run', theme.runColor, 'bike', theme.bikeColor, theme.hubAccent];
}

/** Step expression — matches MapLibre official cluster example (reliable vs linear interpolate). */
export function clusterColorExpression(theme: LiveMapTheme): unknown[] {
    const stops: unknown[] = ['step', ['get', 'point_count'], theme.clusterStops[0]?.[1] ?? '#6366f1'];
    for (const [n, color] of theme.clusterStops) {
        stops.push(n, color);
    }
    return stops;
}

/** Step-based cluster radii — MapLibre official pattern. */
export function clusterRadiusExpression(): unknown[] {
    return [
        'step',
        ['get', 'point_count'],
        22,
        8, 28,
        25, 36,
        50, 44,
        100, 52,
    ];
}
