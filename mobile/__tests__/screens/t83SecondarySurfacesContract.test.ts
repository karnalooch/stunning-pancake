import fs from 'fs';
import path from 'path';

const SRC = path.resolve(__dirname, '../../src');
const read = (relative: string) => fs.readFileSync(path.join(SRC, relative), 'utf8');

const migratedScreens = [
  'screens/SettingsScreen.tsx',
  'screens/GpsDiagnosticsScreen.tsx',
  'screens/SegmentsScreen.tsx',
  'screens/MarketplaceScreen.tsx',
  'screens/PerformanceTrendsScreen.tsx',
  'screens/GlobalLeaderboardScreen.tsx',
];

const forbiddenRoutineChrome = [
  'FONTS.display',
  '<PixelText',
  '<ArcadeButton',
  '<OrnateFrame',
  '<LaurelHeader',
  '<LevelXpBar',
  '<SceneBackground',
  "fontFamily: 'VT323'",
];

describe('T83-D Frozen UI secondary-surface contract', () => {
  test.each(migratedScreens)('%s does not use routine legacy game chrome', (screen) => {
    const source = read(screen);

    for (const marker of forbiddenRoutineChrome) {
      expect(source).not.toContain(marker);
    }
  });

  test('Settings uses semantic product UI and modern input typography', () => {
    const source = read('screens/SettingsScreen.tsx');

    expect(source).toContain('<ProductCard');
    expect(source).toContain('<PrimaryButton');
    expect(source).toContain('PRODUCT_TYPOGRAPHY');
    expect(source).toContain('getSemanticColors');
    expect(source).not.toContain("from '../theme/fonts'");
  });

  test('shared edge-state feedback also uses Frozen UI product semantics', () => {
    const source = read('components/ui/EdgeStateBanner.tsx');

    expect(source).toContain('PRODUCT_TYPOGRAPHY');
    expect(source).toContain('getSemanticColors');
    expect(source).not.toContain('FONTS.display');
    expect(source).not.toContain("from '../../theme/fonts'");
  });

  test('GPS diagnostics uses product actions instead of ArcadeButton', () => {
    const source = read('screens/GpsDiagnosticsScreen.tsx');

    expect(source).toContain('<ProductCard');
    expect(source).toContain('<PrimaryButton');
    expect(source).toContain('PRODUCT_TYPOGRAPHY');
    expect(source).toContain('getSemanticColors');
  });

  test('Segments no longer exposes fabricated production segment or KOM data', () => {
    const source = read('screens/SegmentsScreen.tsx');

    expect(source).toContain('<ProductCard');
    expect(source).toContain('<EmptyState');
    expect(source).not.toContain('Riverside Dash');
    expect(source).not.toContain('Lookout Peak');
    expect(source).not.toContain('ShadowRider');
    expect(source).not.toContain('AeroQueen');
    expect(source).not.toContain("kom:");
  });

  test('Marketplace keeps API failure distinct from a genuine empty offer list', () => {
    const source = read('screens/MarketplaceScreen.tsx');

    expect(source).toContain('setLoadError(true)');
    expect(source).toContain('points === null');
    expect(source).toContain('pools === null');
    expect(source).toContain('pools.length === 0');
    expect(source).not.toContain('setPoints(0);\n        setPools([]);');
  });

  test('Performance Trends uses Frozen UI metrics and preserves truthful cache/error states', () => {
    const source = read('screens/PerformanceTrendsScreen.tsx');

    expect(source).toContain('<ProductCard');
    expect(source).toContain('<Metric');
    expect(source).toContain('usingCached');
    expect(source).toContain('loadError');
    expect(source).toContain('OfflineCacheService.getHistory()');
  });

  test('Global Leaderboard uses Frozen UI rows and distinguishes cache/error/empty', () => {
    const source = read('screens/GlobalLeaderboardScreen.tsx');

    expect(source).toContain('<ProductCard');
    expect(source).toContain("variant={entry.is_me ? 'selected' : 'default'}");
    expect(source).toContain('usingCached');
    expect(source).toContain('loadError');
    expect(source).toContain('entries.length === 0');
    expect(source).toContain('OfflineCacheService.getCityHub()');
  });
});
