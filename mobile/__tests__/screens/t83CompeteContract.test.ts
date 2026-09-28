import fs from 'fs';
import path from 'path';

const SRC = path.resolve(__dirname, '../../src');
const read = (relative: string) => fs.readFileSync(path.join(SRC, relative), 'utf8');

describe('Product UX v2 Club truth contract', () => {
  test('Club uses product chrome instead of routine game chrome', () => {
    const club = read('screens/CityHubScreen.tsx');

    expect(club).toContain('<ProductCard');
    expect(club).toContain('<Metric');
    expect(club).toContain('<PrimaryButton');
    expect(club).toContain('PRODUCT_TYPOGRAPHY');
    expect(club).toContain('getSemanticColors');

    expect(club).not.toContain('SceneBackground');
    expect(club).not.toContain('LevelXpBar');
    expect(club).not.toContain('OrnateFrame');
    expect(club).not.toContain('LaurelHeader');
    expect(club).not.toContain('VersusBar');
    expect(club).not.toContain('SpeechBubble');
    expect(club).not.toContain('FONTS.display');
    expect(club).not.toContain('showMoo');
    expect(club).not.toContain('t.compete.moo');
  });

  test('live failure is distinct from truthful empty Club sections', () => {
    const club = read('screens/CityHubScreen.tsx');

    expect(club).toContain('setLoadError(true)');
    expect(club).toContain('club-load-error');
    expect(club).toContain('club-retry');
    expect(club).toContain('club-city-of-week-empty');
    expect(club).toContain('club-city-wars-empty');
    expect(club).toContain('club-quests-empty');

    expect(club).not.toContain("city_of_week?.name ?? '—'");
    expect(club).not.toContain('const leftScore');
    expect(club).not.toContain('const rightScore');
  });

  test('fresh cache remains visible but is explicitly marked as cached', () => {
    const club = read('screens/CityHubScreen.tsx');

    expect(club).toContain('OfflineCacheService.getCityHub()');
    expect(club).toContain('OfflineCacheService.setCityHub(summary)');
    expect(club).toContain('usingCached');
    expect(club).toContain('club-cached-state');
    expect(club).toContain('t.compete.cachedOfflineTitle');
    expect(club).toContain('t.compete.refreshingCached');
  });

  test('Club vision fixtures stay behind the existing vision-only switch', () => {
    const club = read('screens/CityHubScreen.tsx');

    expect(club).toContain('getVisionCityHubFixture(fixturesEnabled)');
    expect(club).toContain('fixturesEnabled ? fixtureSummary : cityHubLive');
    expect(club).not.toContain('leaderboardLive');
  });

  test('Club owns leaderboard navigation and routes challenge rides through Start Ride', () => {
    const club = read('screens/CityHubScreen.tsx');

    expect(club).toContain('onOpenStartRide');
    expect(club).toContain('onOpenLeaderboard');
    expect(club).toContain('club-open-global-leaderboard');
    expect(club).toContain('club-challenge-start-');
    expect(club).not.toContain('onStartQuest');
    expect(club).not.toContain('compete-');
  });

});
