import React, { useEffect, useRef } from 'react';
import { Box } from '@mantine/core';
import 'maplibre-gl/dist/maplibre-gl.css';
import { loadMaplibregl } from '../../core/map/loadMaplibre';
import { MAP_ATTRIBUTION_CONTROL_OPTIONS, resolveMapStyleUrl, transformMapGlyphsStyle } from '../../core/map/mapBasemap';

interface PoiMarker {
  id: number;
  latitude: number;
  longitude: number;
  name: string;
}

interface SponsorPOIMapEditorProps {
  pois: PoiMarker[];
  height?: number;
  onSelect?: (id: number) => void;
}

const SOURCE = 'sponsor-pois';

export const SponsorPOIMapEditor: React.FC<SponsorPOIMapEditorProps> = ({
  pois,
  height = 360,
  onSelect,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;

    loadMaplibregl().then((ml) => {
      if (cancelled || !containerRef.current) return;
      const center: [number, number] = pois.length
        ? [pois[0].longitude, pois[0].latitude]
        : [21.01, 52.23];

      const map = new ml.Map({
        container: containerRef.current,
        style: resolveMapStyleUrl(),
        center,
        zoom: pois.length ? 12 : 10,
        transformStyle: transformMapGlyphsStyle,
        attributionControl: MAP_ATTRIBUTION_CONTROL_OPTIONS,
      });
      mapRef.current = map;

      map.on('load', () => {
        map.addSource(SOURCE, {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: pois.map((p) => ({
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [p.longitude, p.latitude] },
              properties: { id: p.id, name: p.name },
            })),
          },
        });
        map.addLayer({
          id: 'poi-circles',
          type: 'circle',
          source: SOURCE,
          paint: {
            'circle-radius': 8,
            'circle-color': '#6366f1',
            'circle-stroke-width': 2,
            'circle-stroke-color': '#fff',
          },
        });
        if (onSelect) {
          map.on('click', 'poi-circles', (e: any) => {
            const f = e.features?.[0];
            if (f?.properties?.id != null) onSelect(Number(f.properties.id));
          });
          map.getCanvas().style.cursor = 'pointer';
        }
      });
    });

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [pois, onSelect]);

  return (
    <Box
      ref={containerRef}
      style={{ height, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)' }}
    />
  );
};
