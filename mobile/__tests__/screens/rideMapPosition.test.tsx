// TEST_FIXTURE: Native widgets and map style configuration are local fixtures; RideMapView and coordinate validation are real.
// TEST_RUNTIME_NOTE: These mounted component tests verify data sent to the map boundary, not native rendering, GPS capture or device acceptance.
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { RideMapView, type RideMapViewProps } from '../../src/components/RideMapView';

jest.mock('react-native', () => ({ View: 'View', Text: 'Text' }));
jest.mock('react-native-unistyles', () => {
  const { grandPrixTheme } = jest.requireActual('../../src/theme/grandPrix');
  return { useUnistyles: () => ({ theme: grandPrixTheme }),
    StyleSheet: { create: (factory: unknown) => typeof factory === 'function' ? factory(grandPrixTheme) : factory } };
});
jest.mock('@maplibre/maplibre-react-native', () => ({
  Map: 'Map', Camera: 'Camera', GeoJSONSource: 'GeoJSONSource', Layer: 'Layer',
}));
jest.mock('../../src/map/mapStyle', () => ({
  DEFAULT_RIDE_MAP_ZOOM: 14, RIDE_ROUTE_COLOR: '#000000', RIDE_ROUTE_CASING_COLOR: '#ffffff',
  resolveRideMapStyle: () => ({ version: 8, sources: {}, layers: [] }),
}));
jest.mock('../../src/components/product', () => ({ PrimaryButton: 'PrimaryButton' }));
jest.mock('../../src/i18n/useI18n', () => ({ useI18n: () => ({ locale: 'pl' }) }));

let tree: TestRenderer.ReactTestRenderer | undefined;
afterEach(() => { act(() => tree?.unmount()); tree = undefined; });
const hosts = (type: string, id?: string) => tree!.root.findAll((node) =>
  typeof node.type === 'string' && node.type === type && (id === undefined || node.props.id === id));
const host = (type: string, id?: string) => {
  const nodes = hosts(type, id);
  const node = nodes[0];
  if (nodes.length !== 1 || !node) throw new Error(`expected one ${type} ${id ?? ''}, found ${nodes.length}`);
  return node;
};
const render = (props: RideMapViewProps) => {
  act(() => { tree = TestRenderer.create(<RideMapView {...props} />); });
};
const expectPosition = (coordinates: [number, number]) => {
  expect(host('GeoJSONSource', 'ride-position').props.data).toEqual({
    type: 'FeatureCollection', features: [{ type: 'Feature', properties: {},
      geometry: { type: 'Point', coordinates } }],
  });
  expect(host('Layer', 'ride-position-dot').props).toEqual(expect.objectContaining({
    source: 'ride-position', type: 'circle',
  }));
};
const route: [number, number][] = [[21, 52], [21.2, 52.3]];

describe('RideMapView geographic position boundary', () => {
  test('publishes the current rider coordinate and updates the same geographic source when it moves', () => {
    render({ userCoordinate: [21, 52], routeCoordinates: route });
    expectPosition([21, 52]);
    const map = host('Map');
    const source = host('GeoJSONSource', 'ride-position');
    act(() => tree!.update(<RideMapView userCoordinate={[21.1, 52.2]} routeCoordinates={route} />));
    expectPosition([21.1, 52.2]);
    expect(host('Map')).toBe(map);
    expect(host('GeoJSONSource', 'ride-position')).toBe(source);
    expect(host('GeoJSONSource', 'ride-route').props.data.features[0].geometry)
      .toEqual({ type: 'LineString', coordinates: route });
  });

  test('treats zero longitude and latitude as a real position rather than no fix', () => {
    render({ userCoordinate: [0, 0] });
    expectPosition([0, 0]);
    expect(host('Camera').props.initialViewState.center).toEqual([0, 0]);
  });

  test.each<[string, RideMapViewProps['userCoordinate']]>([
    ['missing', undefined], ['null', null], ['longitude out of range', [181, 52]],
    ['latitude out of range', [21, 91]], ['NaN', [NaN, 52]], ['infinite', [21, Infinity]],
  ])('does not turn a %s rider fix into a route-origin marker', (_name, userCoordinate) => {
    render({ userCoordinate, routeCoordinates: route });
    expect(hosts('GeoJSONSource', 'ride-position')).toHaveLength(0);
    expect(hosts('Layer', 'ride-position-dot')).toHaveLength(0);
    expect(hosts('GeoJSONSource', 'ride-route')).toHaveLength(1);
    expect(host('Camera').props.initialViewState.center).toEqual(route[0]);
  });

  test('explicitly hiding the marker preserves the route and can be reversed', () => {
    render({ userCoordinate: [21, 52], showRiderMarker: false, routeCoordinates: route });
    expect(hosts('GeoJSONSource', 'ride-position')).toHaveLength(0);
    expect(hosts('GeoJSONSource', 'ride-route')).toHaveLength(1);
    act(() => tree!.update(<RideMapView userCoordinate={[21, 52]} showRiderMarker routeCoordinates={route} />));
    expectPosition([21, 52]);
  });

  test('losing a valid fix removes the previous position until a new fix arrives', () => {
    render({ userCoordinate: [21, 52], routeCoordinates: route });
    expectPosition([21, 52]);
    act(() => tree!.update(<RideMapView userCoordinate={null} routeCoordinates={route} />));
    expect(hosts('GeoJSONSource', 'ride-position')).toHaveLength(0);
    act(() => tree!.update(<RideMapView userCoordinate={[21.3, 52.4]} routeCoordinates={route} />));
    expectPosition([21.3, 52.4]);
  });

  test('map loading failure and retry do not replace the rider fix with a fabricated coordinate', () => {
    render({ userCoordinate: [21, 52] });
    const previousMap = host('Map');
    act(() => previousMap.props.onDidFailLoadingMap());
    expectPosition([21, 52]);
    const retry = tree!.root.find((node) => typeof node.type === 'string' && node.props.testID === 'ride-map-retry');
    act(() => retry.props.onPress());
    expect(host('Map')).not.toBe(previousMap);
    expectPosition([21, 52]);
    act(() => host('Map').props.onDidFinishRenderingMapFully());
    expect(tree!.root.findAll((node) => typeof node.type === 'string' && node.props.testID === 'ride-map-loading')).toHaveLength(0);
    expectPosition([21, 52]);
  });
});
