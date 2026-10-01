import fs from 'fs';
import path from 'path';
const SRC = path.resolve(__dirname, '../../src');
const read = (relative: string) => fs.readFileSync(path.join(SRC, relative), 'utf8');

describe('Product UX v2 Club truth contract', () => {
  test('Club uses semantic Roadbook sections instead of routine game chrome', () => {
    const club = read('screens/CityHubScreen.tsx');
    for (const marker of ['<RoadbookPage', '<RoadbookSection', '<Metric', '<PrimaryButton']) expect(club).toContain(marker);
    const surface = read('components/roadbook/Surface.tsx');
    expect(surface).toContain('PRODUCT_TYPOGRAPHY');
    expect(surface).toContain('getSemanticColors');
    for (const retired of ['SceneBackground', 'LevelXpBar', 'OrnateFrame', 'LaurelHeader', 'VersusBar', 'SpeechBubble', 'FONTS.display', 'showMoo', 't.compete.moo']) expect(club).not.toContain(retired);
  });
  test('live failure is distinct from truthful empty Club sections', () => {
    const club = read('screens/CityHubScreen.tsx');
    for (const marker of ['setLoadError(true)', 'club-load-error', 'club-retry', 'club-city-of-week-empty', 'club-city-wars-empty', 'club-quests-empty']) expect(club).toContain(marker);
    expect(club).not.toContain("city_of_week?.name ?? '—'");
    expect(club).not.toContain('const leftScore');
    expect(club).not.toContain('const rightScore');
  });
  test('fresh cache remains visible but is explicitly marked as cached', () => {
    const club = read('screens/CityHubScreen.tsx');
    for (const marker of ['OfflineCacheService.getCityHub()', 'OfflineCacheService.setCityHub(summary)', 'usingCached', 'club-cached-state', 't.compete.cachedOfflineTitle', 't.compete.refreshingCached']) expect(club).toContain(marker);
  });
  test('Club vision fixtures stay behind the existing vision-only switch', () => {
    const club = read('screens/CityHubScreen.tsx');
    expect(club).toContain('getVisionCityHubFixture(fixturesEnabled)');
    expect(club).toContain('fixturesEnabled ? fixtureSummary : cityHubLive');
    expect(club).not.toContain('leaderboardLive');
  });
  test('Club owns leaderboard navigation and routes challenge rides through Start Ride', () => {
    const club = read('screens/CityHubScreen.tsx');
    for (const marker of ['onOpenStartRide', 'onOpenLeaderboard', 'club-open-global-leaderboard', 'club-challenge-start-']) expect(club).toContain(marker);
    expect(club).not.toContain('onStartQuest');
    expect(club).not.toContain('compete-');
  });
});
