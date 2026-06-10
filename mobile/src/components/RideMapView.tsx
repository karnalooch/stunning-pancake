import React from 'react';
import { StyleSheet } from 'react-native';
import { MapView } from '@maplibre/maplibre-react-native';

const STYLE_URL = 'https://demotiles.maplibre.org/style.json';

interface RideMapViewProps {
  center?: [number, number];
}

export const RideMapView: React.FC<RideMapViewProps> = ({
  center = [21.01, 52.23],
}) => (
  <MapView
    style={StyleSheet.absoluteFill}
    mapStyle={STYLE_URL}
    logoEnabled={false}
    attributionEnabled
    zoomEnabled
    scrollEnabled
    pitchEnabled={false}
    rotateEnabled={false}
    defaultSettings={{
      centerCoordinate: center,
      zoomLevel: 13,
    }}
  />
);
