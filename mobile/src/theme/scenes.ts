export type EnvironmentLayerId =
  | 'sky_day'
  | 'sky_sunset'
  | 'sky_night'
  | 'hills_far'
  | 'town_mid'
  | 'road_near';

export type SceneId =
  | 'ride_dashboard'
  | 'active_ride'
  | 'city_hub'
  | 'ride_summary'
  | 'onboarding'
  | 'profile'
  | 'default';

export interface SceneDefinition {
  id: SceneId;
  layers: EnvironmentLayerId[];
  ambient: 'day' | 'sunset' | 'night';
  particles: ('dust' | 'wind' | 'none')[];
}

export const SCENE_REGISTRY: Record<SceneId, SceneDefinition> = {
  ride_dashboard: { id: 'ride_dashboard', layers: ['sky_day', 'hills_far', 'road_near'], ambient: 'day', particles: ['dust'] },
  active_ride: { id: 'active_ride', layers: [], ambient: 'day', particles: ['wind'] },
  city_hub: { id: 'city_hub', layers: ['sky_sunset', 'town_mid'], ambient: 'sunset', particles: ['dust'] },
  ride_summary: { id: 'ride_summary', layers: ['sky_sunset', 'hills_far'], ambient: 'sunset', particles: ['none'] },
  onboarding: { id: 'onboarding', layers: ['sky_sunset', 'town_mid'], ambient: 'sunset', particles: ['none'] },
  profile: { id: 'profile', layers: ['sky_night'], ambient: 'night', particles: ['none'] },
  default: { id: 'default', layers: ['sky_day'], ambient: 'day', particles: ['none'] },
};

export const LAYER_LAYOUT: Record<
  EnvironmentLayerId,
  { heightPercent: number; bottom: number; parallaxSpeed: number }
> = {
  sky_day: { heightPercent: 100, bottom: 0, parallaxSpeed: 0 },
  sky_sunset: { heightPercent: 100, bottom: 0, parallaxSpeed: 0 },
  sky_night: { heightPercent: 100, bottom: 0, parallaxSpeed: 0 },
  hills_far: { heightPercent: 34, bottom: 10, parallaxSpeed: 0.25 },
  town_mid: { heightPercent: 28, bottom: 5, parallaxSpeed: 0.45 },
  road_near: { heightPercent: 12, bottom: 0, parallaxSpeed: 0.8 },
};

export function getScene(id: SceneId): SceneDefinition {
  return SCENE_REGISTRY[id] ?? SCENE_REGISTRY.default;
}
