import React, { useMemo } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { MapView } from '@maplibre/maplibre-react-native';
import { DEFAULT_RIDE_MAP_ZOOM, resolveRideMapStyleUrl } from '../map/mapStyle';

export interface RideMapViewProps {
  /** [longitude, latitude] — when provided, map centers on rider position. */
  userCoordinate?: [number, number] | null;
  zoomLevel?: number;
}

const FALLBACK_CENTER: [number, number] = [21.01, 52.23];

export const RideMapView: React.FC<RideMapViewProps> = ({
  userCoordinate,
  zoomLevel = DEFAULT_RIDE_MAP_ZOOM,
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
          <View style={styles.marker}>
            <Text style={styles.markerEmoji}>🚴</Text>
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
  marker: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 3,
    borderColor: '#191d17',
    backgroundColor: '#F5F5DC',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  markerEmoji: { fontSize: 22 },
});
