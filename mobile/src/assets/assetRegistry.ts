/**
 * assetRegistry.ts — Runtime asset registry (Grand Prix pixel-art pack).
 *
 * Metro bundles images only from STATIC `require()` paths, so every generated
 * asset is enumerated here as a literal require. Consumers import typed groups
 * (`ASSETS.icons.tab_home`, …) instead of building paths at runtime.
 *
 * Catalog metadata (categories, prompt hashes, bundled flags) lives in
 * `manifest.ts`; this module is the wiring layer the UI actually imports.
 *
 * See docs/design/GRAND_PRIX_UI_CONSISTENCY_AUDIT.md §0.3.
 */

export const ASSETS = {
  icons: {
    tab_home: require('../../assets/generated/icons/tab_home.png'),
    tab_history: require('../../assets/generated/icons/tab_history.png'),
    tab_ranking: require('../../assets/generated/icons/tab_ranking.png'),
    tab_rewards: require('../../assets/generated/icons/tab_rewards.png'),
    tab_profile: require('../../assets/generated/icons/tab_profile.png'),
    grade_s: require('../../assets/generated/icons/grade_s.png'),
    grade_a: require('../../assets/generated/icons/grade_a.png'),
    grade_b: require('../../assets/generated/icons/grade_b.png'),
    grade_c: require('../../assets/generated/icons/grade_c.png'),
    grade_d: require('../../assets/generated/icons/grade_d.png'),
    power_speed: require('../../assets/generated/icons/power_speed.png'),
    power_shield: require('../../assets/generated/icons/power_shield.png'),
    power_double_xp: require('../../assets/generated/icons/power_double_xp.png'),
    power_gps: require('../../assets/generated/icons/power_gps.png'),
    currency_xp: require('../../assets/generated/icons/currency_xp.png'),
    currency_coin: require('../../assets/generated/icons/currency_coin.png'),
    currency_energy: require('../../assets/generated/icons/currency_energy.png'),
  },
  sprites: {
    cyclist_sheet: require('../../assets/generated/sprites/cyclist_sheet.png'),
  },
  expressions: {
    cyclist_idle: require('../../assets/generated/expressions/cyclist_idle.png'),
    cyclist_happy: require('../../assets/generated/expressions/cyclist_happy.png'),
    cyclist_tired: require('../../assets/generated/expressions/cyclist_tired.png'),
    cyclist_victory: require('../../assets/generated/expressions/cyclist_victory.png'),
  },
  environment: {
    sky_day: require('../../assets/generated/environment/sky_day.png'),
    hills_far: require('../../assets/generated/environment/hills_far.png'),
    town_mid: require('../../assets/generated/environment/town_mid.png'),
    road_near: require('../../assets/generated/environment/road_near.png'),
  },
  particles: {
    particle_atlas: require('../../assets/generated/particles/particle_atlas.png'),
  },
  textures: {
    parchment_grain: require('../../assets/generated/textures/parchment_grain.png'),
    metal_plate: require('../../assets/generated/textures/metal_plate.png'),
    wood_grain: require('../../assets/generated/textures/wood_grain.png'),
  },
  sounds: {
    sfx_params: require('../../assets/generated/sounds/sfx_params.json'),
  },
} as const;

export type AssetGroup = keyof typeof ASSETS;
export type AssetId<G extends AssetGroup> = keyof (typeof ASSETS)[G];

/** Typed accessor — returns the Metro module ref (number) for an image asset. */
export function getAsset<G extends AssetGroup>(
  group: G,
  id: AssetId<G>,
): (typeof ASSETS)[G][AssetId<G>] {
  return ASSETS[group][id];
}

export type IconId = keyof typeof ASSETS.icons;
export type EnvironmentLayerId = keyof typeof ASSETS.environment;
export type ExpressionId = keyof typeof ASSETS.expressions;
export type TextureId = keyof typeof ASSETS.textures;
