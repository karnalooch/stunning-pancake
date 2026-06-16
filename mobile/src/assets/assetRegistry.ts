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

/**
 * Optional vision-parity assets (phase D). Entries are auto-wired by
 * `scripts/wire_vision_assets.py` and stay undefined until the PNG exists in
 * both `assets/generated` and `mobile/assets/generated`.
 */
export const OPTIONAL_VISION_ASSETS = {
  crests: {
    // AUTO-WIRE:REG_CREST:START
    gdansk: require('../../assets/generated/icons/crest_gdansk.png'),
    katowice: require('../../assets/generated/icons/crest_katowice.png'),
    lublin: require('../../assets/generated/icons/crest_lublin.png'),
    siedlce: require('../../assets/generated/icons/crest_siedlce.png'),
    warszawa: require('../../assets/generated/icons/crest_warszawa.png'),
    // AUTO-WIRE:REG_CREST:END
  },
  departments: {
    // AUTO-WIRE:REG_DEPT:START
    it: require('../../assets/generated/icons/dept_it.png'),
    marketing: require('../../assets/generated/icons/dept_marketing.png'),
    hr: require('../../assets/generated/icons/dept_hr.png'),
    sales: require('../../assets/generated/icons/dept_sales.png'),
    // AUTO-WIRE:REG_DEPT:END
  },
  achievements: {
    // AUTO-WIRE:REG_ACHIEVEMENT:START
    ach_100km: require('../../assets/generated/icons/ach_100km.png'),
    ach_10rides: require('../../assets/generated/icons/ach_10rides.png'),
    ach_500m: require('../../assets/generated/icons/ach_500m.png'),
    ach_kom: require('../../assets/generated/icons/ach_kom.png'),
    ach_5h: require('../../assets/generated/icons/ach_5h.png'),
    ach_endurance: require('../../assets/generated/icons/ach_endurance.png'),
    ach_1000kcal: require('../../assets/generated/icons/ach_1000kcal.png'),
    ach_7days: require('../../assets/generated/icons/ach_7days.png'),
    ach_explorer: require('../../assets/generated/icons/ach_explorer.png'),
    ach_passion: require('../../assets/generated/icons/ach_passion.png'),
    // AUTO-WIRE:REG_ACHIEVEMENT:END
  },
  banners: {
    // AUTO-WIRE:REG_BANNERS:START
    city_lublin: require('../../assets/generated/environment/banner_city_lublin.png'),
    finish_meta: require('../../assets/generated/environment/finish_meta.png'),
    avatar_frame: require('../../assets/generated/icons/avatar_frame.png'),
    frame_ornate: require('../../assets/generated/textures/frame_ornate.png'),
    sky_sunset: require('../../assets/generated/environment/sky_sunset.png'),
    sky_night: require('../../assets/generated/environment/sky_night.png'),
    // AUTO-WIRE:REG_BANNERS:END
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
