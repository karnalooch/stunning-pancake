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
  /** Procedural placeholder layers until AI assets land. */
  layers: Array<'sky' | 'hills' | 'town' | 'road'>;
  ambient: 'day' | 'sunset' | 'night';
  particles: Array<'dust' | 'wind' | 'none'>;
}

export const SCENE_REGISTRY: Record<SceneId, SceneDefinition> = {
  ride_dashboard: {
    id: 'ride_dashboard',
    layers: ['sky', 'hills', 'town', 'road'],
    ambient: 'day',
    particles: ['dust'],
  },
  active_ride: {
    id: 'active_ride',
    layers: ['sky', 'road'],
    ambient: 'day',
    particles: ['wind'],
  },
  city_hub: {
    id: 'city_hub',
    layers: ['sky', 'town'],
    ambient: 'sunset',
    particles: ['dust'],
  },
  ride_summary: {
    id: 'ride_summary',
    layers: ['sky', 'hills'],
    ambient: 'sunset',
    particles: ['none'],
  },
  onboarding: {
    id: 'onboarding',
    layers: ['sky', 'town'],
    ambient: 'day',
    particles: ['none'],
  },
  profile: {
    id: 'profile',
    layers: ['sky'],
    ambient: 'day',
    particles: ['none'],
  },
  default: {
    id: 'default',
    layers: ['sky'],
    ambient: 'day',
    particles: ['none'],
  },
};

export function getScene(id: SceneId): SceneDefinition {
  return SCENE_REGISTRY[id] ?? SCENE_REGISTRY.default;
}
