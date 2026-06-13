import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { MapView } from '@maplibre/maplibre-react-native';
import { DEFAULT_RIDE_MAP_ZOOM, resolveRideMapStyleUrl } from '../map/mapStyle';
import { CyclistSprite } from './sprites/CyclistSprite';

export interface RideMapViewProps {
  /** [longitude, latitude] — when provided, map centers on rider position. */
  userCoordinate?: [number, number] | null;
  zoomLevel?: number;
  cyclistState?: 'idle' | 'cruise' | 'attack' | 'victory';
}

const FALLBACK_CENTER: [number, number] = [21.01, 52.23];

export const RideMapView: React.FC<RideMapViewProps> = ({
  userCoordinate,
  zoomLevel = DEFAULT_RIDE_MAP_ZOOM,
  cyclistState = 'cruise',
}) => {
  const center = userCoordinate ?? FALLBACK_CENTER;
  const mapKey = useMemo(
    () => `${center[0].toFixed(4)}:${center[1].toFixed(4)}:${zoomLevel}`,
    [center, zoomLevel],
  );

  return (
    <View style={styles.wrap}>
      <MapView
        key={mapKey}
        style={StyleSheet.absoluteFill}
        mapStyle={resolveRideMapStyleUrl()}
        logoEnabled={false}
        attributionEnabled
        zoomEnabled
        scrollEnabled
        pitchEnabled={false}
        rotateEnabled={false}
        defaultSettings={{
          centerCoordinate: center,
          zoomLevel,
        }}
      />
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
