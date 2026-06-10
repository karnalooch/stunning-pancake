/**
 * Live sim launch plan from deployed infra (SSOT: backend/activities/sim_infra_planner.py).
 * No intensity/load profiles — wizard uses direct ratios + server-computed throughput caps.
 */

import type { ScaleOverrides } from '../../api/client';

export type InfraCapacity = {
    max_concurrent_riders: number;
    max_telemetry_per_tick: number;
    max_starts_per_live_tick: number;
    brouter_max_calls_per_tick: number;
    brouter_route_attempts: number;
    routing_dispatch_per_tick: number;
    routing_queue_depth_cap: number | null;
    routing_backlog_boost_cap: number;
    async_routing: boolean;
    tick_seconds: number;
    starts_per_second: number;
};

export type LiveLaunchPlan = {
    pool_pct: number;
    active_ratio: number;
    cheat_ratio: number;
    tick_seconds: number;
    scale_overrides: ScaleOverrides;
    target_on_map: number;
    infra: InfraCapacity;
    estimated_ramp_seconds: number;
    throughput: {
        starts_per_tick: number;
        routes_dispatched_per_tick: number;
        starts_per_second: number;
    };
};

/** Offline fallback when sim-capacity API is unreachable (matches railway.json prod). */
export const DEFAULT_INFRA: InfraCapacity = {
    max_concurrent_riders: 50_000,
    max_telemetry_per_tick: 50_000,
    max_starts_per_live_tick: 400,
    brouter_max_calls_per_tick: 350,
    brouter_route_attempts: 4,
    routing_dispatch_per_tick: 800,
    routing_queue_depth_cap: 3000,
    routing_backlog_boost_cap: 1500,
    async_routing: true,
    tick_seconds: 4,
    starts_per_second: 100,
};

export function fallbackLivePlan(
    targetUsers: number,
    activePercent: number,
    cheatPercent: number,
): LiveLaunchPlan {
    const active_ratio = Math.max(0.05, Math.min(0.5, activePercent / 100));
    const cheat_ratio = Math.max(0, Math.min(0.25, cheatPercent / 100));
    const target_on_map = Math.min(
        DEFAULT_INFRA.max_concurrent_riders,
        Math.max(1, Math.round(targetUsers * active_ratio)),
    );
    const routes = Math.min(
        DEFAULT_INFRA.max_starts_per_live_tick,
        DEFAULT_INFRA.routing_dispatch_per_tick,
    );
    const ramp = Math.ceil(
        target_on_map / (routes / DEFAULT_INFRA.tick_seconds) * 1.35,
    );
    return {
        pool_pct: 1,
        active_ratio,
        cheat_ratio,
        tick_seconds: DEFAULT_INFRA.tick_seconds,
        scale_overrides: {
            max_starts_per_live_tick: DEFAULT_INFRA.max_starts_per_live_tick,
            brouter_max_calls_per_tick: DEFAULT_INFRA.brouter_max_calls_per_tick,
            brouter_route_attempts: DEFAULT_INFRA.brouter_route_attempts,
        },
        target_on_map,
        infra: DEFAULT_INFRA,
        estimated_ramp_seconds: ramp,
        throughput: {
            starts_per_tick: DEFAULT_INFRA.max_starts_per_live_tick,
            routes_dispatched_per_tick: routes,
            starts_per_second: DEFAULT_INFRA.starts_per_second,
        },
    };
}

export function formatRampSeconds(seconds: number): string {
    if (seconds <= 0) return '—';
    if (seconds < 90) return `~${seconds}s`;
    const m = Math.round(seconds / 60);
    return `~${m} min`;
}
