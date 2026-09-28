import fs from 'fs';
import path from 'path';

const SRC = path.resolve(__dirname, '../../src');
const read = (relative: string) => fs.readFileSync(path.join(SRC, relative), 'utf8');

describe('UX v2 mobile shell contract', () => {
  test('primary tabs are Today, Discover, Start Ride, Club and You in that order', () => {
    const shell = read('bootstrap/NavigationShell.tsx');
    const order = ['Today', 'Discover', 'StartRide', 'Club', 'You'];
    const positions = order.map((name) => shell.indexOf(`<Tab.Screen name="${name}">`));

    expect(positions.every((position) => position >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    expect(shell).not.toContain('<Tab.Screen name="Ride">');
    expect(shell).not.toContain('<Tab.Screen name="Compete">');
    expect(shell).not.toContain('<Tab.Screen name="Explore">');
    expect(shell).not.toContain('<Tab.Screen name="Profile">');
  });

  test('legacy GameTabBar and ExploreHub are not runtime dependencies', () => {
    const shell = read('bootstrap/NavigationShell.tsx');

    expect(shell).toContain("ProductTabBar");
    expect(shell).not.toContain("GameTabBar");
    expect(shell).not.toContain("ExploreHubScreen");
  });

  test('Start Ride uses the existing ride-start contract and Tracking stays hidden', () => {
    const shell = read('bootstrap/NavigationShell.tsx');
    const start = read('screens/StartRideScreen.tsx');

    expect(start).toContain("ACTIVITY_SPORT_OPTIONS");
    expect(start).toContain("onStartRide(selectedSport)");
    expect(shell).toContain('<Tab.Screen name="Tracking" options={{ tabBarButton: () => null }}>');
    expect(shell).toContain("screen: 'Tracking'");
  });

  test('ProductTabBar exposes exactly the five visible UX v2 destinations', () => {
    const tabBar = read('navigation/ProductTabBar.tsx');

    expect(tabBar).toContain("['Today', 'Discover', 'StartRide', 'Club', 'You']");
    expect(tabBar).not.toContain("'Tracking'");
    expect(tabBar).not.toContain("'VT323'");
  });
});
