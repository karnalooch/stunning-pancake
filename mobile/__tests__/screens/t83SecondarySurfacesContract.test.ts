import fs from 'fs';
import path from 'path';

const SRC = path.resolve(__dirname, '../../src');
const read = (relative: string) => fs.readFileSync(path.join(SRC, relative), 'utf8');
const migratedScreens = [
  'screens/SettingsScreen.tsx', 'screens/GpsDiagnosticsScreen.tsx', 'screens/SegmentsScreen.tsx',
  'screens/MarketplaceScreen.tsx', 'screens/PerformanceTrendsScreen.tsx', 'screens/GlobalLeaderboardScreen.tsx',
];
const forbiddenRoutineChrome = ['FONTS.display', '<PixelText', '<ArcadeButton', '<OrnateFrame', '<LaurelHeader', '<LevelXpBar', '<SceneBackground', "fontFamily: 'VT323'"];

describe('Secondary-surface safety and semantic presentation contract', () => {
  test.each(migratedScreens)('%s does not use routine legacy game chrome', (screen) => {
    const source = read(screen);
    for (const marker of forbiddenRoutineChrome) expect(source).not.toContain(marker);
  });
  test('replacement settings retains real capabilities without the removed legacy presentation host', () => {
    const source = read('screens/SettingsScreen.tsx');
    expect(fs.existsSync(path.join(SRC, 'screens/SettingsSections.tsx'))).toBe(false);
    expect(source).not.toContain('SettingsSections');
    expect(source).toContain('<RoadbookSection');
    expect(source).toContain('<PrimaryButton');
    expect(source).toContain('PRODUCT_TYPOGRAPHY');
    expect(source).toContain('getSemanticColors');
    expect(source).not.toContain("from '../theme/fonts'");
    for (const capability of ['WearableService.getStatus()', 'PrivacyService.getZones()', 'WearableService.sync()', 'RiderPreferencesService.setWeightKg', 'RiderPreferencesService.setMaxHr', 'settings-haptics', 'settings-voice', 'settings-immersive', 'settings-language', 'settings-privacy-error']) expect(source).toContain(capability);
  });
  test('Roadbook settings routes appearance to the shared transactional panel', () => {
    const source = read('screens/SettingsScreen.tsx');
    expect(source).toContain('<AppearanceSettingsPanel');
    expect(source).toContain('settings-appearance');
    expect(source).toContain('visible={appearanceOpen}');
    expect(source).toContain('onClose={() => setAppearanceOpen(false)}');
    expect(source).toContain('PRODUCT_TYPOGRAPHY');
  });
  test('shared edge-state feedback also uses semantic product roles', () => {
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
    for (const fake of ['Riverside Dash', 'Lookout Peak', 'ShadowRider', 'AeroQueen', 'kom:']) expect(source).not.toContain(fake);
  });
  test('Marketplace keeps API failure distinct from a genuine empty offer list', () => {
    const source = read('screens/MarketplaceScreen.tsx');
    expect(source).toContain('setLoadError(true)');
    expect(source).toContain('points === null');
    expect(source).toContain('pools === null');
    expect(source).toContain('pools.length === 0');
    expect(source).not.toContain('setPoints(0);\n        setPools([]);');
  });
  test('Performance Trends preserves truthful cache/error states and readable metrics', () => {
    const source = read('screens/PerformanceTrendsScreen.tsx');
    expect(source).toContain('<ProductCard');
    expect(source).toContain('<Metric');
    expect(source).toContain('usingCached');
    expect(source).toContain('loadError');
    expect(source).toContain('OfflineCacheService.getHistory()');
  });
  test('Global Leaderboard distinguishes cache/error/empty', () => {
    const source = read('screens/GlobalLeaderboardScreen.tsx');
    expect(source).toContain('<ProductCard');
    expect(source).toContain("variant={entry.is_me ? 'selected' : 'default'}");
    expect(source).toContain('usingCached');
    expect(source).toContain('loadError');
    expect(source).toContain('entries.length === 0');
    expect(source).toContain('OfflineCacheService.getCityHub()');
  });
});
