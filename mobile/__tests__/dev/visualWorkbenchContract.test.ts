import fs from 'fs';
import path from 'path';
const SRC = path.resolve(__dirname, '../../src');
function source(relative: string): string { return fs.readFileSync(path.join(SRC, relative), 'utf8'); }

describe('repo-native visual workbench contract', () => {
  test('workbench renders the four composition planes with stable proof ids', () => {
    const gallery = source('dev/VisualDesignGalleryScreen.tsx');
    for (const token of ['visual-workbench-data-plane', 'visual-workbench-guidance', 'visual-workbench-ride-controls', 'visual-workbench-truth-states', 'visual-workbench-brand-plane', 'workbench-toggle-brand', 'workbench-asset-off']) expect(gallery).toContain(token);
    expect(gallery).toContain('DATA_FIELD_REGISTRY[field].format(resolveFieldValue(field, fixture.metrics))');
    for (const component of ['<RideNavigationHint', '<RideStatusBar', '<RideActionBar', '<EdgeStateBanner']) expect(gallery).toContain(component);
    expect(gallery).toContain('APPROVED_ASSETS.homeHeroDay');
  });
  test('fixture values are repository-owned and deterministic', () => {
    const fixtures = source('dev/visualWorkbenchFixtures.ts');
    const status = source('components/ride/RideStatusBar.tsx');
    expect(fixtures).toContain("clock: '10:24'");
    expect(fixtures).toContain('batteryPct: 78');
    expect(fixtures).not.toContain('Math.random');
    expect(status).toContain('clockText ?? clock');
    // Accept equivalent return syntax; rendered timer behavior has its own regression.
    expect(status).toMatch(/if\s*\(clockText !== undefined\)\s*return(?: undefined)?;/);
    expect(status).toContain('clearInterval(id)');
  });
  test('screen fixture index stays dev/vision-only and uses product chrome', () => {
    const shell = source('bootstrap/NavigationShell.tsx');
    const gallery = source('screens/VisionGalleryScreen.tsx');
    expect(shell).toContain('(isVisionFixtures() || __DEV__)');
    expect(shell).toContain('<VisionGalleryScreen');
    expect(gallery).toContain('<VisualDesignGalleryScreen');
    expect(gallery).toContain('visual-workbench-screen-fixtures');
    expect(gallery).toContain('<PrimaryButton');
    expect(gallery).not.toContain('ArcadeButton');
    expect(gallery).not.toContain('PixelText');
  });
  test('asset-off state is explicit rather than replacing functional UI', () => {
    const gallery = source('dev/VisualDesignGalleryScreen.tsx');
    expect(gallery).toContain('brandEnabled');
    expect(gallery).toContain('Asset-off PASS target');
    expect(gallery).toContain('Hierarchia, metryki, guidance i kontrolki');
  });
});
