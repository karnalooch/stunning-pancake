import React, { useEffect, useMemo, useRef } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import {
  Camera,
  GeoJSONSource,
  Layer,
  Map,
  type CameraRef,
  type StyleSpecification,
} from '@maplibre/maplibre-react-native';
import {
  DEFAULT_RIDE_MAP_ZOOM,
  RIDE_ROUTE_CASING_COLOR,
  RIDE_ROUTE_COLOR,
  resolveRideMapStyle,
} from '../map/mapStyle';
import { APPROVED_ASSETS } from '../assets/approvedAssets';

export interface RideMapViewProps {
  /** [longitude, latitude] — when provided, map centers on rider position. */
  userCoordinate?: [number, number] | null;
  zoomLevel?: number;
  cyclistState?: 'idle' | 'cruise' | 'attack' | 'victory';
  /** Optional route polyline for turn-by-turn phase 1. */
  routeCoordinates?: [number, number][];
  /** Hide the rider marker for historical route inspection. */
  showRiderMarker?: boolean;
}

const FALLBACK_CENTER: [number, number] = [21.01, 52.23];

export const RideMapView: React.FC<RideMapViewProps> = ({
  userCoordinate,
  zoomLevel = DEFAULT_RIDE_MAP_ZOOM,
  cyclistState = 'cruise',
  routeCoordinates = [],
  showRiderMarker = true,
}) => {
  const cameraRef = useRef<CameraRef>(null);
  const center = userCoordinate ?? FALLBACK_CENTER;
  const mapStyle = useMemo<string | StyleSpecification>(
    () => resolveRideMapStyle() as string | StyleSpecification,
    [],
  );
  const routeGeoJson = useMemo(() => {
    if (!routeCoordinates.length) return null;
    return {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: routeCoordinates,
          },
        },
      ],
    } as unknown as GeoJSON.FeatureCollection;
  }, [routeCoordinates]);

  useEffect(() => {
    cameraRef.current?.easeTo?.({
      center,
      zoom: zoomLevel,
      duration: userCoordinate ? 300 : 0,
    });
  }, [center, zoomLevel, userCoordinate]);

  return (
    <View style={styles.wrap}>
      <Map
        style={StyleSheet.absoluteFill}
        mapStyle={mapStyle}
        logo={false}
        attribution
        touchZoom
        dragPan
        touchPitch={false}
        touchRotate={false}
      >
        <Camera
          ref={cameraRef}
          initialViewState={{ center, zoom: zoomLevel }}
        />
        {routeGeoJson ? (
          <GeoJSONSource id="ride-route" data={routeGeoJson}>
            <Layer
              id="ride-route-casing"
              type="line"
              source="ride-route"
              style={{
                lineColor: RIDE_ROUTE_CASING_COLOR,
                lineWidth: 8,
                lineOpacity: 0.92,
              }}
            />
            <Layer
              id="ride-route-line"
              type="line"
              source="ride-route"
              style={{
                lineColor: RIDE_ROUTE_COLOR,
                lineWidth: 4.5,
                lineOpacity: 1,
              }}
            />
          </GeoJSONSource>
        ) : null}
      </Map>
      {userCoordinate && showRiderMarker && (
        <View style={styles.markerWrap} pointerEvents="none">
          <View style={styles.markerOffset}>
            <Image
              source={APPROVED_ASSETS.rideMarkerRider}
              resizeMode="contain"
              style={[styles.riderMarker, { opacity: cyclistState === 'attack' ? 1 : 0.96 }]}
              testID="ride-marker-rider-v1"
            />
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  markerWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  markerOffset: { marginBottom: 24 },
  riderMarker: { width: 44, height: 44 },
});
