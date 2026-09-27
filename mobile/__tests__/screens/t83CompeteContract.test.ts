import fs from 'fs';
import path from 'path';

const SRC = path.resolve(__dirname, '../../src');
const read = (relative: string) => fs.readFileSync(path.join(SRC, relative), 'utf8');

describe('T83-C Compete truth contract', () => {
  test('Compete uses Frozen UI product chrome instead of routine game chrome', () => {
    const compete = read('screens/CityHubScreen.tsx');

    expect(compete).toContain('<ProductCard');
    expect(compete).toContain('<Metric');
    expect(compete).toContain('<PrimaryButton');
    expect(compete).toContain('PRODUCT_TYPOGRAPHY');
    expect(compete).toContain('getSemanticColors');

    expect(compete).not.toContain('SceneBackground');
    expect(compete).not.toContain('LevelXpBar');
    expect(compete).not.toContain('OrnateFrame');
    expect(compete).not.toContain('LaurelHeader');
    expect(compete).not.toContain('VersusBar');
    expect(compete).not.toContain('SpeechBubble');
    expect(compete).not.toContain('FONTS.display');
    expect(compete).not.toContain('showMoo');
    expect(compete).not.toContain('t.compete.moo');
  });

  test('live failure is distinct from truthful empty competition sections', () => {
    const compete = read('screens/CityHubScreen.tsx');

    expect(compete).toContain('setLoadError(true)');
    expect(compete).toContain('compete-load-error');
    expect(compete).toContain('compete-retry');
    expect(compete).toContain('compete-city-of-week-empty');
    expect(compete).toContain('compete-city-wars-empty');
    expect(compete).toContain('compete-quests-empty');

    expect(compete).not.toContain("city_of_week?.name ?? '—'");
    expect(compete).not.toContain('const leftScore');
    expect(compete).not.toContain('const rightScore');
  });

  test('fresh cache remains visible but is explicitly marked as cached', () => {
    const compete = read('screens/CityHubScreen.tsx');

    expect(compete).toContain('OfflineCacheService.getCityHub()');
    expect(compete).toContain('OfflineCacheService.setCityHub(summary)');
    expect(compete).toContain('usingCached');
    expect(compete).toContain('compete-cached-state');
    expect(compete).toContain('t.compete.cachedOfflineTitle');
    expect(compete).toContain('t.compete.refreshingCached');
  });

  test('vision fixtures stay behind the existing vision-only switch', () => {
    const compete = read('screens/CityHubScreen.tsx');

    expect(compete).toContain('getVisionCityHubFixture(fixturesEnabled)');
    expect(compete).toContain('fixturesEnabled ? fixtureSummary : cityHubLive');
    expect(compete).not.toContain('leaderboardLive');
  });
});
