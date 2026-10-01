import fs from 'fs';
import path from 'path';

const MOBILE_ROOT = path.resolve(__dirname, '../..');
const SRC = path.join(MOBILE_ROOT, 'src');
const ASSET_DIR = path.join(MOBILE_ROOT, 'assets/approved/v1');
const POLICY = path.resolve(MOBILE_ROOT, '../assets/ASSET_GOVERNANCE_V1.json');
const read = (relative: string) => fs.readFileSync(path.join(SRC, relative), 'utf8');

// PRODUCT_UX_V2 October amendment retires mandatory legacy illustrations, not provenance.
describe('Governed assets and Roadbook asset independence', () => {
  test('approved production art contains no SVG files', () => {
    expect(fs.readdirSync(ASSET_DIR).filter((file) => file.toLowerCase().endsWith('.svg'))).toEqual([]);
  });
  test('retained approved registry exposes raster art only', () => {
    const registry = read('assets/approvedAssets.ts');
    for (const asset of ['rider_canonical_v1.jpg', 'home_hero_day_v1.jpg', 'ride_marker_rider_v1.png', 'summary_finish_v1.jpg']) expect(registry).toContain(asset);
    expect(registry).not.toContain('.svg');
  });
  test('Roadbook Ride entry works without mandatory legacy hero artwork', () => {
    const home = read('screens/RideDashboardScreen.tsx');
    expect(home).toContain('<RoadbookPage');
    expect(home).toContain('home-open-start-ride');
    expect(home).toContain('home-go-to-ride');
    expect(home).not.toContain('APPROVED_ASSETS.homeHeroDay');
    expect(home).not.toContain('assets/generated');
    expect(home).not.toContain('.svg');
  });
  test('Welcome retains both entry actions without requiring scenic artwork', () => {
    const auth = read('bootstrap/AuthScreen.tsx');
    expect(auth).toContain('auth-welcome-register');
    expect(auth).toContain('auth-welcome-login');
    expect(auth).not.toContain('APPROVED_ASSETS.homeHeroDay');
    expect(auth).not.toContain('assets/generated');
    expect(auth).not.toContain('SceneBackground');
  });
  test('canonical rider is raster-backed where rider artwork is retained', () => {
    const cyclist = read('components/sprites/CyclistSprite.tsx');
    const share = read('components/game/ShareResultCard.tsx');
    expect(cyclist).toContain('APPROVED_ASSETS.riderCanonical');
    expect(share).toContain('APPROVED_ASSETS.riderCanonical');
    expect(cyclist).not.toContain('.svg');
    expect(share).not.toContain('.svg');
  });
  test('Active Ride uses a geographic marker and native action shapes without scenic art', () => {
    const map = read('components/RideMapView.tsx');
    const actions = read('components/ride/RideActionBar.tsx');
    // Coordinate updates and invalid/missing fixes are covered by mounted
    // rideMapPosition tests; this contract protects asset independence only.
    expect(map).toContain('<GeoJSONSource id="ride-position"');
    expect(map).toContain('source="ride-position" type="circle"');
    expect(map).not.toContain('APPROVED_ASSETS.rideMarkerRider');
    expect(map).not.toContain('CyclistSprite');
    for (const action of ['pause', 'resume', 'stop']) expect(actions).toContain(`ride-action-icon-${action}-v1`);
    expect(actions).not.toContain('.svg');
    expect(read('screens/ActiveRideHUDScreen.tsx')).not.toContain('SceneBackground');
  });
  test('Summary uses explicit finish truth rather than celebratory art as evidence', () => {
    const summary = read('screens/RideSummaryScreen.tsx');
    expect(summary).toContain('isDurableRideSuccess(finishState)');
    expect(summary).toContain('ride-summary-${finishState.kind}');
    expect(summary).toContain('durableSuccess && onShare');
    for (const retired of ['APPROVED_ASSETS.summaryFinish', 'AchievementCoreSetV1', 'FinishCelebration', 'SceneBackground', 'ParticleSystem', '.svg']) expect(summary).not.toContain(retired);
  });
  test('retained Place Badge is deterministic and does not imitate a crest', () => {
    const badge = read('components/product/PlaceBadge.tsx');
    expect(badge).not.toContain('Math.random');
    expect(badge).toContain('place-badge-v1');
    expect(badge).toContain('initialsFor');
  });
  test('retained production targets stay governance-approved with immutable digests', () => {
    const policy = JSON.parse(fs.readFileSync(POLICY, 'utf8')) as {
      productionTargets: Array<{ id: string; status: string; provenance?: { sha256?: string } }>;
    };
    for (const id of ['rider_canonical_v1', 'home_hero_day_v1', 'place_badge_v1', 'ride_marker_rider_v1', 'ride_action_icons_v1', 'summary_finish_v1']) {
      const target = policy.productionTargets.find((item) => item.id === id);
      expect(target?.status).toBe('approved');
      expect(target?.provenance?.sha256).toMatch(/^[0-9a-f]{64}$/);
    }
  });
});
