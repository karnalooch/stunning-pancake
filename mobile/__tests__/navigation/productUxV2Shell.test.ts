import fs from 'fs';
import path from 'path';
const read = (file: string) => fs.readFileSync(path.resolve(__dirname, '../../src', file), 'utf8');

describe('Roadbook four-destination shell architecture', () => {
  test('only Ride, Discover, Club and You are tabs', () => {
    const shell = read('bootstrap/NavigationShell.tsx');
    const tabs = [...shell.matchAll(/<Tab.Screen name="([^"]+)"/g)].map((match) => match[1]);
    expect(tabs).toEqual(['Today', 'Discover', 'Club', 'You']);
    expect(shell).toContain('ProductTabBar'); expect(shell).not.toContain('GameTabBar');
    expect(shell).toContain('<Stack.Screen name="StartRide"');
    expect(shell).toContain('<Stack.Screen name="Tracking"');
    expect(shell).not.toContain("screen: 'Tracking'"); expect(shell).not.toContain("screen: 'StartRide'");
  });
  test('preparation retains its command, diagnostics and active-session return', () => {
    const shell = read('bootstrap/NavigationShell.tsx'); const start = read('screens/StartRideScreen.tsx');
    expect(shell).toContain('createRideStartCommand'); expect(shell).toContain('onStartRide={handleStartRide}');
    expect(shell).toContain("navigate('GpsDiagnostics')"); expect(shell).toContain('isRecording ? <ActiveRideHUDScreen');
    for (const marker of ['start-ride-primary', 'ACTIVITY_SPORT_OPTIONS', 'GpsRecoveryBanner', 'start-ride-gps-diagnostics']) expect(start).toContain(marker);
    expect(read('screens/RideDashboardScreen.tsx')).not.toContain('ACTIVITY_SPORT_OPTIONS');
  });
  test('Discover stays map-first and Club/You retain secondary destinations', () => {
    const shell = read('bootstrap/NavigationShell.tsx');
    expect(shell).toContain('<ExploreMapScreen'); expect(shell).not.toContain('ExploreHubScreen');
    for (const route of ['Marketplace', 'Clubs', 'Segments', 'GlobalLeaderboard', 'TrainingLog', 'Settings', 'PerformanceTrends', 'ActivityDetail']) {
      expect(shell).toContain(`navigate('${route}'`);
    }
    expect(read('screens/CityHubScreen.tsx')).not.toContain('onStartQuest');
  });
  test('public paths are retained, behavior exercised in roadbookLinking.test.ts', () => {
    const paths = read('navigation/routeContract.ts');
    for (const marker of ["today: 'ride'", "discover: 'explore'", "startRide: 'ride/start'", "tracking: 'ride/live'", "club: 'compete'", "you: 'profile'"]) expect(paths).toContain(marker);
  });
});
