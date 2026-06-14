import React, { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Camera,
  GeoJSONSource,
  Layer,
  Map,
  type CameraRef,
  type StyleSpecification,
} from '@maplibre/maplibre-react-native';
import { DEFAULT_RIDE_MAP_ZOOM, resolveRideMapStyle } from '../map/mapStyle';
import { CyclistSprite } from './sprites/CyclistSprite';
import { useImmersiveTheme } from '../hooks/useImmersiveTheme';

export interface RideMapViewProps {
  /** [longitude, latitude] — when provided, map centers on rider position. */
  userCoordinate?: [number, number] | null;
  zoomLevel?: number;
  cyclistState?: 'idle' | 'cruise' | 'attack' | 'victory';
  /** Optional route polyline for turn-by-turn phase 1. */
  routeCoordinates?: [number, number][];
}

const FALLBACK_CENTER: [number, number] = [21.01, 52.23];

export const RideMapView: React.FC<RideMapViewProps> = ({
  userCoordinate,
  zoomLevel = DEFAULT_RIDE_MAP_ZOOM,
  cyclistState = 'cruise',
  routeCoordinates = [],
}) => {
  const { enabled: immersiveEnabled } = useImmersiveTheme();
  const cameraRef = useRef<CameraRef>(null);
  const center = userCoordinate ?? FALLBACK_CENTER;
  const mapStyle = useMemo<string | StyleSpecification>(
    () => resolveRideMapStyle(immersiveEnabled) as string | StyleSpecification,
    [immersiveEnabled],
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
              id="ride-route-line"
              type="line"
              source="ride-route"
              style={{
                lineColor: '#D4A373',
                lineWidth: 4,
                lineOpacity: 0.95,
              }}
            />
          </GeoJSONSource>
        ) : null}
      </Map>
      {userCoordinate && (
        <View style={styles.markerWrap} pointerEvents="none">
          <View style={styles.markerOffset}>
            <CyclistSprite size={44} state={cyclistState} />
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
});
