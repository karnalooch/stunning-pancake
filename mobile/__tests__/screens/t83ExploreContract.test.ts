import fs from 'fs';
import path from 'path';

const SRC = path.resolve(__dirname, '../../src');
const read = (relative: string) => fs.readFileSync(path.join(SRC, relative), 'utf8');

describe('Discover map-first truth contract', () => {
  test('Discover is map-first and does not route through the legacy Explore hub', () => {
    const shell = read('bootstrap/NavigationShell.tsx');
    const map = read('screens/ExploreMapScreen.tsx');

    expect(shell).toContain('<Tab.Screen name="Discover">');
    expect(shell).toContain('<ExploreMapScreen');
    expect(shell).not.toContain('ExploreHubScreen');
    expect(map).toContain('discover-marketplace');
  });

  test('Explore POI surface keeps error distinct from genuine empty data', () => {
    const map = read('screens/ExploreMapScreen.tsx');

    expect(map).toContain('POIService.getPOIs()');
    expect(map).toContain('setLoadError(true)');
    expect(map).toContain('explore-poi-error');
    expect(map).toContain('explore-poi-empty');
    expect(map).toContain('explore-poi-retry');
    expect(map).not.toContain('.catch(() => setPois([]))');
  });

  test('Explore renders real POI coordinates through the existing MapLibre stack', () => {
    const map = read('screens/ExploreMapScreen.tsx');

    expect(map).toContain('@maplibre/maplibre-react-native');
    expect(map).toContain('<Map');
    expect(map).toContain('<GeoJSONSource');
    expect(map).toContain('<Layer');
    expect(map).toContain('coordinates: [poi.longitude, poi.latitude]');
    expect(map).toContain('resolveRideMapStyle(false)');
    expect(map).not.toContain('SceneBackground');
    expect(map).not.toContain('FONTS.display');
  });

  test('POI service exposes the collection shape instead of untyped data', () => {
    const api = read('services/api.ts');

    expect(api).toContain(".get<POI[] | { results?: POI[] }>(API_PATHS_FULL.activitiesPois)");
  });
});
