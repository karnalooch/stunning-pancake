export interface LiveStatus {
    running: boolean;
    elapsed_seconds: number;
    error: string | null;
    stuck?: boolean;
    live_lock_held?: boolean;
    pool_size?: number;
    active_rides?: number;
    async_routing_enabled?: boolean;
    ride_warming?: number;
    ride_routing?: number;
    ride_routed?: number;
    ride_active?: number;
    tick_stale?: boolean;
    worker_recovered_at?: number | null;
    routing_unroutable_total?: number;
    routing_queue_depth?: number;
    routing_backpressure_active?: boolean;
    dispatches_throttled?: boolean;
    max_routing_queue_depth?: number | null;
    total_users: number;
    active_ratio: number;
    cheat_ratio: number;
    tick_seconds: number;
    target_on_map?: number;
    slots_free_on_map?: number;
    starts_budget_last_tick?: number;
    max_pipeline_rides?: number;
    pipeline_capped_last_tick?: boolean;
    currently_riding: number;
    total_completed: number;
    cheaters_caught: number;
    log: [string, string][];
}

export interface BatchStatus {
    running: boolean;
    elapsed_seconds: number;
    error: string | null;
    stuck?: boolean;
    batch_lock_held?: boolean;
    total_users: number;
    users_created: number;
    activities_created: number;
    current_phase: string;
    progress_pct: number;
    log: [string, string][];
}

export interface GarminSimScheduleConfig {
    weekday_rides: number;
    weekday_distance_min: number;
    weekday_distance_max: number;
    weekend_distance_min: number;
    weekend_distance_max: number;
    speed_min: number;
    speed_max: number;
    weekday_start_h_min: number;
    weekday_start_h_max: number;
    weekend_start_h_min: number;
    weekend_start_h_max: number;
    start_radius_km: number;
}

export interface GarminSummaryUser {
    index: number;
    username: string;
    display_name: string;
    first_name: string;
    last_name: string;
    email: string;
    user_id: number;
}

export interface GarminSimStatus {
    running: boolean;
    progress_pct: number;
    phase: string;
    total_rides: number;
    rides_scheduled: number;
    rides_active: number;
    rides_done: number;
    error: string | null;
    log: [string, string][];
    summary: GarminSummaryUser[];
}

export type SimulatorTab = 'mass' | 'garmin';

export const DEFAULT_GARMIN_SCHEDULE: GarminSimScheduleConfig = {
    weekday_rides: 3,
    weekday_distance_min: 60,
    weekday_distance_max: 80,
    weekend_distance_min: 90,
    weekend_distance_max: 120,
    speed_min: 20,
    speed_max: 31,
    weekday_start_h_min: 14,
    weekday_start_h_max: 18,
    weekend_start_h_min: 8,
    weekend_start_h_max: 14,
    start_radius_km: 5,
};
