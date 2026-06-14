import type { EnvironmentLayerId } from '../assets/assetRegistry';

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
  /** Bundled environment PNG layers (back → front). */
  layers: EnvironmentLayerId[];
  ambient: 'day' | 'sunset' | 'night';
  particles: ('dust' | 'wind' | 'none')[];
}

export const SCENE_REGISTRY: Record<SceneId, SceneDefinition> = {
  ride_dashboard: {
    id: 'ride_dashboard',
    layers: ['sky_day', 'hills_far', 'town_mid', 'road_near'],
    ambient: 'day',
    particles: ['dust'],
  },
  active_ride: {
    id: 'active_ride',
    layers: ['sky_day', 'road_near'],
    ambient: 'day',
    particles: ['wind'],
  },
  city_hub: {
    id: 'city_hub',
    layers: ['sky_day', 'town_mid'],
    ambient: 'sunset',
    particles: ['dust'],
  },
  ride_summary: {
    id: 'ride_summary',
    layers: ['sky_day', 'hills_far'],
    ambient: 'sunset',
    particles: ['none'],
  },
  onboarding: {
    id: 'onboarding',
    layers: ['sky_day', 'town_mid'],
    ambient: 'day',
    particles: ['none'],
  },
  profile: {
    id: 'profile',
    layers: ['sky_day'],
    ambient: 'day',
    particles: ['none'],
  },
  default: {
    id: 'default',
    layers: ['sky_day'],
    ambient: 'day',
    particles: ['none'],
  },
};

export const LAYER_LAYOUT: Record<
  EnvironmentLayerId,
  { heightPercent: number; bottom: number; parallaxSpeed: number }
> = {
  sky_day: { heightPercent: 100, bottom: 0, parallaxSpeed: 0 },
  hills_far: { heightPercent: 32, bottom: 14, parallaxSpeed: 0.25 },
  town_mid: { heightPercent: 42, bottom: 6, parallaxSpeed: 0.55 },
  road_near: { heightPercent: 14, bottom: 0, parallaxSpeed: 1 },
};

export function getScene(id: SceneId): SceneDefinition {
  return SCENE_REGISTRY[id] ?? SCENE_REGISTRY.default;
}
