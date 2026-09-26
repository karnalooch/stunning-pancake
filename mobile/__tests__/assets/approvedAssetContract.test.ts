import fs from 'fs';
import path from 'path';

const MOBILE_ROOT = path.resolve(__dirname, '../..');
const SRC = path.join(MOBILE_ROOT, 'src');
const ASSET_DIR = path.join(MOBILE_ROOT, 'assets/approved/v1');
const POLICY = path.resolve(MOBILE_ROOT, '../assets/ASSET_GOVERNANCE_V1.json');

const read = (relative: string) => fs.readFileSync(path.join(SRC, relative), 'utf8');

describe('Mobile UI Assets v1 production contract', () => {
  test('approved production art contains no SVG files', () => {
    const svgFiles = fs.readdirSync(ASSET_DIR).filter((file) => file.toLowerCase().endsWith('.svg'));
    expect(svgFiles).toEqual([]);
  });

  test('approved registry exposes raster art only', () => {
    const registry = read('assets/approvedAssets.ts');
    expect(registry).toContain('rider_canonical_v1.jpg');
    expect(registry).toContain('home_hero_day_v1.jpg');
    expect(registry).toContain('ride_marker_rider_v1.png');
    expect(registry).toContain('summary_finish_v1.jpg');
    expect(registry).not.toContain('.svg');
  });

  test('Home wires governed raster hero and Place Badge', () => {
    const home = read('screens/RideDashboardScreen.tsx');
    expect(home).toContain('APPROVED_ASSETS.homeHeroDay');
    expect(home).toContain('home-hero-day-v1');
    expect(home).toContain('PlaceBadge');
    expect(home).not.toContain('assets/generated');
    expect(home).not.toContain('.svg');
  });

  test('Welcome uses the explicit approved hero bridge instead of ungoverned art', () => {
    const auth = read('bootstrap/AuthScreen.tsx');
    const policy = JSON.parse(fs.readFileSync(POLICY, 'utf8')) as {
      screenAssetCoverage?: Record<string, { temporaryApprovedFallback?: string[] }>;
    };

    expect(auth).toContain('APPROVED_ASSETS.homeHeroDay');
    expect(auth).toContain('auth-welcome-hero-approved');
    expect(auth).not.toContain('assets/generated');
    expect(policy.screenAssetCoverage?.auth_welcome?.temporaryApprovedFallback).toContain(
      'home_hero_day_v1',
    );
  });

  test('canonical rider is raster-backed where rider artwork is needed', () => {
    const cyclist = read('components/sprites/CyclistSprite.tsx');
    const share = read('components/game/ShareResultCard.tsx');
    expect(cyclist).toContain('APPROVED_ASSETS.riderCanonical');
    expect(share).toContain('APPROVED_ASSETS.riderCanonical');
    expect(cyclist).not.toContain('.svg');
    expect(share).not.toContain('.svg');
  });

  test('Active Ride uses PNG marker and native action shapes without scenic art', () => {
    const map = read('components/RideMapView.tsx');
    const actions = read('components/ride/RideActionBar.tsx');
    const active = read('screens/ActiveRideHUDScreen.tsx');

    expect(map).toContain('APPROVED_ASSETS.rideMarkerRider');
    expect(actions).toContain('ride-action-icon-pause-v1');
    expect(actions).toContain('ride-action-icon-resume-v1');
    expect(actions).toContain('ride-action-icon-stop-v1');
    expect(actions).not.toContain('.svg');
    expect(active).not.toContain('SceneBackground');
  });

  test('Summary raster art remains durable-success only', () => {
    const summary = read('screens/RideSummaryScreen.tsx');
    const durableStart = summary.indexOf('{durableSuccess ? (');
    const fallbackStart = summary.indexOf(') : (', durableStart);
    const finishArt = summary.indexOf('APPROVED_ASSETS.summaryFinish', durableStart);

    expect(durableStart).toBeGreaterThan(-1);
    expect(fallbackStart).toBeGreaterThan(durableStart);
    expect(finishArt).toBeGreaterThan(durableStart);
    expect(finishArt).toBeLessThan(fallbackStart);
    expect(summary).not.toContain('AchievementCoreSetV1');
    expect(summary).not.toContain('FinishCelebration');
    expect(summary).not.toContain('SceneBackground');
    expect(summary).not.toContain('ParticleSystem');
    expect(summary).not.toContain('.svg');
  });

  test('Place Badge is deterministic and does not imitate a crest', () => {
    const badge = read('components/product/PlaceBadge.tsx');
    expect(badge).not.toContain('Math.random');
    expect(badge).toContain('place-badge-v1');
    expect(badge).toContain('initialsFor');
  });

  test('wired production targets are governance-approved with immutable digests', () => {
    const policy = JSON.parse(fs.readFileSync(POLICY, 'utf8')) as {
      productionTargets: Array<{ id: string; status: string; provenance?: { sha256?: string } }>;
    };
    const required = [
      'rider_canonical_v1',
      'home_hero_day_v1',
      'place_badge_v1',
      'ride_marker_rider_v1',
      'ride_action_icons_v1',
      'summary_finish_v1',
    ];

    for (const id of required) {
      const target = policy.productionTargets.find((item) => item.id === id);
      expect(target?.status).toBe('approved');
      expect(target?.provenance?.sha256).toMatch(/^[0-9a-f]{64}$/);
    }
  });
});
