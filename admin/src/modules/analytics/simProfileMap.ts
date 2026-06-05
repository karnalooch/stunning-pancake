/**
 * SSOT (admin) for live sim profile sliders — keep in sync with backend/activities/sim_profile.py.
 */

export type SimProfileResolved = {
    intensity: number;
    load: number;
    active_ratio: number;
    cheat_ratio: number;
    tick_seconds: number;
    scale_overrides: {
        max_starts_per_live_tick: number;
        brouter_max_calls_per_tick: number;
        brouter_route_attempts: number;
    };
};

export function piecewiseLerp(points: [number, number][], x: number): number {
    const clamped = Math.max(0, Math.min(100, x));
    if (points.length === 0) return 0;
    if (clamped <= points[0][0]) return points[0][1];
    for (let i = 0; i < points.length - 1; i++) {
        const [x0, y0] = points[i];
        const [x1, y1] = points[i + 1];
        if (clamped <= x1) {
            if (x1 === x0) return y1;
            const t = (clamped - x0) / (x1 - x0);
            return y0 + t * (y1 - y0);
        }
    }
    return points[points.length - 1][1];
}

/** Aktywność puli (0–100) → active_ratio + cheat_ratio */
export function mapIntensity(intensity: number): { active_ratio: number; cheat_ratio: number } {
    const i = Math.max(0, Math.min(100, intensity));
    const active_ratio = Math.max(0.08, Math.min(0.5, 0.08 + 0.42 * (i / 100)));
    const cheat_ratio = Math.max(0, Math.min(0.25, 0.12 * (i / 100)));
    return { active_ratio, cheat_ratio };
}

/** Obciążenie systemu (0–100) → tick + scale overrides */
export function mapLoad(load: number): {
    tick_seconds: number;
    max_starts_per_live_tick: number;
    brouter_max_calls_per_tick: number;
    brouter_route_attempts: number;
} {
    const l = Math.max(0, Math.min(100, load));
    const starts = Math.round(piecewiseLerp([[0, 25], [50, 50], [75, 100], [100, 1000]], l));
    const brouter = Math.round(starts * 0.83);
    const attempts = l < 75 ? 4 : 5;
    const tick_seconds = Math.round(piecewiseLerp([[0, 12], [50, 8], [100, 6]], l));
    return {
        tick_seconds,
        max_starts_per_live_tick: starts,
        brouter_max_calls_per_tick: brouter,
        brouter_route_attempts: attempts,
    };
}

export function resolveSimProfile(intensity: number, load: number): SimProfileResolved {
    const i = Math.max(0, Math.min(100, intensity));
    const l = Math.max(0, Math.min(100, load));
    const { active_ratio, cheat_ratio } = mapIntensity(i);
    const loadMapped = mapLoad(l);
    return {
        intensity: i,
        load: l,
        active_ratio,
        cheat_ratio,
        tick_seconds: loadMapped.tick_seconds,
        scale_overrides: {
            max_starts_per_live_tick: loadMapped.max_starts_per_live_tick,
            brouter_max_calls_per_tick: loadMapped.brouter_max_calls_per_tick,
            brouter_route_attempts: loadMapped.brouter_route_attempts,
        },
    };
}
