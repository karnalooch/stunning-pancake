import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { Camera, GeoJSONSource, Layer, Map, type CameraRef, type StyleSpecification } from '@maplibre/maplibre-react-native';
import { DEFAULT_RIDE_MAP_ZOOM, RIDE_ROUTE_CASING_COLOR, RIDE_ROUTE_COLOR, resolveRideMapStyle } from '../map/mapStyle';
import { buildRouteGeometry, isMapCoordinate } from '../map/routeGeometry';
import { getSemanticColors } from '../theme/semantic';
import { PRODUCT_TYPOGRAPHY } from '../theme/typography';
import { useI18n } from '../i18n/useI18n';
import { getAppCopy } from './roadbook/appCopy';
import { PrimaryButton } from './product';

export interface RideMapViewProps {
  userCoordinate?: [number, number] | null;
  zoomLevel?: number;
  /** Compatibility input only. The position marker is geographic, not character art. */
  cyclistState?: 'idle' | 'cruise' | 'attack' | 'victory';
  routeCoordinates?: [number, number][];
  showRiderMarker?: boolean;
}
const OVERVIEW_CENTER: [number, number] = [0, 20];
export const RideMapView: React.FC<RideMapViewProps> = ({
  userCoordinate, zoomLevel = DEFAULT_RIDE_MAP_ZOOM, routeCoordinates = [], showRiderMarker = true,
}) => {
  const cameraRef = useRef<CameraRef>(null);
  const { theme } = useUnistyles();
  const { locale } = useI18n();
  const c = getSemanticColors(theme.colors);
  const copy = getAppCopy(locale);
  const [generation, setGeneration] = useState(0);
  const [availability, setAvailability] = useState<'loading' | 'ready' | 'error'>('loading');
  const position = isMapCoordinate(userCoordinate) ? userCoordinate : null;
  const routeOrigin = routeCoordinates.find(isMapCoordinate);
  const longitude = position?.[0] ?? routeOrigin?.[0] ?? OVERVIEW_CENTER[0];
  const latitude = position?.[1] ?? routeOrigin?.[1] ?? OVERVIEW_CENTER[1];
  const center = useMemo<[number, number]>(() => [longitude, latitude], [longitude, latitude]);
  const zoom = position || routeOrigin ? zoomLevel : 2;
  const mapStyle = useMemo(() => resolveRideMapStyle() as string | StyleSpecification, []);
  const routeGeoJson = useMemo<GeoJSON.FeatureCollection | null>(() => {
    const geometry = buildRouteGeometry(routeCoordinates);
    return geometry ? { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry }] } : null;
  }, [routeCoordinates]);
  const positionGeoJson: GeoJSON.FeatureCollection = {
    type: 'FeatureCollection', features: position ? [{ type: 'Feature', properties: {},
      geometry: { type: 'Point', coordinates: position } }] : [],
  };
  useEffect(() => {
    cameraRef.current?.easeTo?.({ center, zoom, duration: 0 });
  }, [center, zoom, generation]);
  return <View style={styles.wrap} testID="ride-map-surface">
    <Map key={generation} style={styles.map} mapStyle={mapStyle} logo={false} attribution touchZoom dragPan
      touchPitch={false} touchRotate={false}
      onDidFinishRenderingMapFully={() => setAvailability('ready')}
      onDidFailLoadingMap={() => setAvailability('error')}>
      <Camera ref={cameraRef} initialViewState={{ center, zoom }} />
      {routeGeoJson ? <GeoJSONSource id="ride-route" data={routeGeoJson}>
        <Layer id="ride-route-casing" type="line" source="ride-route"
          style={{ lineColor: RIDE_ROUTE_CASING_COLOR, lineWidth: 8, lineOpacity: 0.92 }} />
        <Layer id="ride-route-line" type="line" source="ride-route"
          style={{ lineColor: RIDE_ROUTE_COLOR, lineWidth: 4.5, lineOpacity: 1 }} />
      </GeoJSONSource> : null}
      {position && showRiderMarker ? <GeoJSONSource id="ride-position" data={positionGeoJson}>
        <Layer id="ride-position-dot" source="ride-position" type="circle"
          style={{ circleColor: c.action.primary, circleRadius: 8, circleStrokeColor: c.text.onAction, circleStrokeWidth: 3 }} />
      </GeoJSONSource> : null}
    </Map>
    {availability !== 'ready' ? <View style={styles.notice} testID={`ride-map-${availability}`}>
      <Text style={styles.body}>{availability === 'error' ? copy.mapError : copy.mapLoading}</Text>
      {availability === 'error' ? <PrimaryButton label={copy.mapRetry} variant="secondary" testID="ride-map-retry"
        onPress={() => { setAvailability('loading'); setGeneration((value) => value + 1); }} /> : null}
    </View> : null}
    {!position && !routeOrigin ? <View style={styles.overview} pointerEvents="none">
      <Text style={styles.body}>{copy.mapOverview}</Text>
    </View> : null}
  </View>;
};
const styles = StyleSheet.create((theme) => {
  const c = getSemanticColors(theme.colors);
  return {
    wrap: { flex: 1, minHeight: 180, backgroundColor: c.surface.raised }, map: { flex: 1 },
    notice: { position: 'absolute', top: 8, left: 8, right: 8, padding: 12, gap: 10, backgroundColor: c.surface.default },
    overview: { position: 'absolute', left: 8, right: 8, bottom: 48, padding: 8, backgroundColor: c.surface.default },
    body: { ...PRODUCT_TYPOGRAPHY.metricLabel, color: c.text.primary },
  };
});
