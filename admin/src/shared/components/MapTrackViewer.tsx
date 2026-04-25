import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';

interface MapTrackViewerProps {
  routePath: any;      // Raw GPS Data (GeoJSON LineString)
  validatedPath?: any;  // BRouter Validated Data (Optional)
  isVerified?: boolean;
}

/**
 * High-Fidelity Map Renderer for Anti-Cheat Verification.
 * Supports 'Glow' effects and dual-track comparison.
 */
export const MapTrackViewer = ({ routePath, validatedPath, isVerified }: MapTrackViewerProps) => {
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
      // 1. Render RAW TRACK (GPX) - Red with Glow
      if (routePath) {
        map.addSource('route-raw', { type: 'geojson', data: routePath });
        
        // Outer Glow
        map.addLayer({
          id: 'route-raw-glow',
          type: 'line',
          source: 'route-raw',
          paint: {
            'line-color': '#FF4B4B',
            'line-width': 12,
            'line-blur': 8,
            'line-opacity': 0.3
          }
        });

        // Core Line
        map.addLayer({
          id: 'route-raw-core',
          type: 'line',
          source: 'route-raw',
          paint: {
            'line-color': '#FF4B4B',
            'line-width': 3,
            'line-opacity': 0.9
          }
        });
      }

      // 2. Render VALIDATED TRACK (BRouter) - Electric Blue with Glow
      if (validatedPath) {
        map.addSource('route-valid', { type: 'geojson', data: validatedPath });

        // Outer Glow
        map.addLayer({
          id: 'route-valid-glow',
          type: 'line',
          source: 'route-valid',
          paint: {
            'line-color': '#00D1FF',
            'line-width': 10,
            'line-blur': 6,
            'line-opacity': 0.4
          }
        });

        // Core Line
        map.addLayer({
          id: 'route-valid-core',
          type: 'line',
          source: 'route-valid',
          paint: {
            'line-color': '#00D1FF',
            'line-width': 3,
            'line-opacity': 1
          }
        });
      }

      // 3. Auto-fit bounds
      const allCoords = [
        ...(routePath?.coordinates || []),
        ...(validatedPath?.coordinates || [])
      ];

      if (allCoords.length > 0) {
        const bounds = allCoords.reduce((acc: maplibregl.LngLatBounds, coord: [number, number]) => {
          return acc.extend(coord);
        }, new maplibregl.LngLatBounds(allCoords[0], allCoords[0]));

        map.fitBounds(bounds, { padding: 60 });
      }
    });

    return () => {
      map.remove();
    };
  }, [routePath, validatedPath, isVerified]);

  return (
    <div 
      ref={mapContainer} 
      style={{ 
        width: '100%', 
        height: '100%', 
        borderRadius: 'var(--radius-lg)', 
        border: '1px solid var(--border-glass)',
        boxShadow: 'inset 0 0 40px rgba(0,0,0,0.5)'
      }} 
    />
  );
};
