import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

interface MapTrackViewerProps {
  routePath: any; // GeoJSON LineString
  isVerified?: boolean;
}

/**
 * Reusable MapLibre component for viewing a single activity track.
 */
export const MapTrackViewer = ({ routePath, isVerified }: MapTrackViewerProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    if (!mapContainer.current) return;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          'raster-tiles': {
            type: 'raster',
            tiles: ['https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png'],
            tileSize: 256,
          },
        },
        layers: [{ id: 'tiles', type: 'raster', source: 'raster-tiles' }],
      },
      center: [22.2875, 52.1686],
      zoom: 13,
      attributionControl: false,
    });

    mapRef.current = map;

    map.on('load', () => {
      if (routePath) {
        // Add the route source
        map.addSource('route', {
          type: 'geojson',
          data: routePath,
        });

        // Add the route layer
        map.addLayer({
          id: 'route-line',
          type: 'line',
          source: 'route',
          layout: {
            'line-join': 'round',
            'line-cap': 'round',
          },
          paint: {
            'line-color': isVerified ? '#92fe9d' : '#ff4d4d',
            'line-width': 5,
            'line-opacity': 0.8,
          },
        });

        // Zoom to fit the route
        try {
          const coordinates = routePath.coordinates;
          const bounds = coordinates.reduce((acc: maplibregl.LngLatBounds, coord: [number, number]) => {
            return acc.extend(coord);
          }, new maplibregl.LngLatBounds(coordinates[0], coordinates[0]));

          map.fitBounds(bounds, { padding: 40 });
        } catch (e) {
          console.error("Failed to fit bounds", e);
        }
      }
    });

    return () => {
      map.remove();
    };
  }, [routePath, isVerified]);

  return (
    <div 
      ref={mapContainer} 
      style={{ width: '100%', height: '100%', borderRadius: '12px', border: '1px solid var(--border)' }} 
    />
  );
};
