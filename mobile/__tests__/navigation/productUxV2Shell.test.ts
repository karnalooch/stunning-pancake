import fs from 'fs';
import path from 'path';

const SRC = path.resolve(__dirname, '../../src');
const read = (relative: string) => fs.readFileSync(path.join(SRC, relative), 'utf8');

describe('Product UX v2 main shell contract', () => {
  test('main navigation exposes exactly the five UX v2 product domains', () => {
    const shell = read('bootstrap/NavigationShell.tsx');
    const types = read('navigation/types.ts');
    const bar = read('navigation/ProductTabBar.tsx');

    for (const route of ['Today', 'Discover', 'StartRide', 'Club', 'You']) {
      expect(shell).toContain(`<Tab.Screen name="${route}"`);
      expect(types).toContain(`  ${route}: undefined;`);
      expect(bar).toContain(`'${route}'`);
    }

    for (const legacy of ['Ride', 'Compete', 'Explore', 'Profile']) {
      expect(shell).not.toContain(`<Tab.Screen name="${legacy}"`);
      expect(types).not.toContain(`  ${legacy}: undefined;`);
    }

    expect(shell).toContain('ProductTabBar');
    expect(shell).not.toContain('GameTabBar');
  });

  test('Discover is map-first and keeps Marketplace reachable without ExploreHub', () => {
    const shell = read('bootstrap/NavigationShell.tsx');
    const map = read('screens/ExploreMapScreen.tsx');

    expect(shell).toContain('<Tab.Screen name="Discover">');
    expect(shell).toContain('<ExploreMapScreen');
    expect(shell).not.toContain('ExploreHubScreen');
    expect(map).toContain('discover-marketplace');
    expect(map).toContain('onOpenMarketplace');
  });

  test('Start Ride owns pre-ride setup while Today only navigates into it', () => {
    const shell = read('bootstrap/NavigationShell.tsx');
    const today = read('screens/RideDashboardScreen.tsx');
    const start = read('screens/StartRideScreen.tsx');

    expect(shell).toContain('<Tab.Screen name="StartRide">');
    expect(shell).toContain('<Tab.Screen name="Tracking" options={{ tabBarButton: () => null }}>');
    expect(shell).toContain("onOpenStartRide={() => navRef.current?.navigate('MainTabs', { screen: 'StartRide' })}");

    expect(today).toContain('home-open-start-ride');
    expect(today).not.toContain('ACTIVITY_SPORT_OPTIONS');
    expect(today).not.toContain('onStartRide');

    expect(start).toContain('start-ride-primary');
    expect(start).toContain('ACTIVITY_SPORT_OPTIONS');
    expect(start).toContain('GpsRecoveryBanner');
    expect(start).toContain('start-ride-gps-diagnostics');
    expect(shell).toContain("onOpenGpsWizard={() => navRef.current?.navigate('GpsDiagnostics')}");
  });

  test('Club cannot bypass the canonical Start Ride surface', () => {
    const shell = read('bootstrap/NavigationShell.tsx');

    expect(shell).toContain(
      "onStartQuest={() => navRef.current?.navigate('MainTabs', { screen: 'StartRide' })}",
    );
    expect(shell).not.toContain('onStartQuest={() => void handleStartRide()}');
  });

  test('deep-link compatibility keeps established public paths behind new internal names', () => {
    const routes = read('navigation/routeContract.ts');
    const linking = read('navigation/linking.ts');

    expect(routes).toContain("today: 'ride'");
    expect(routes).toContain("discover: 'explore'");
    expect(routes).toContain("startRide: 'ride/start'");
    expect(routes).toContain("club: 'compete'");
    expect(routes).toContain("you: 'profile'");

    expect(linking).toContain('Today: ROUTE_PATHS.today');
    expect(linking).toContain('Discover: ROUTE_PATHS.discover');
    expect(linking).toContain('StartRide: ROUTE_PATHS.startRide');
    expect(linking).toContain('Club: ROUTE_PATHS.club');
    expect(linking).toContain('You: ROUTE_PATHS.you');
  });
});
