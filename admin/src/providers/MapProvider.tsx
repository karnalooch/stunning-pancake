import maplibregl from 'maplibre-gl';
import { createContext, useContext, useRef, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

interface MapContextValue {
  map: maplibregl.Map | null;
  isReady: boolean;
}

const MapContext = createContext<MapContextValue>({ map: null, isReady: false });

/** Hook to access the shared MapLibre instance from any child component. */
export const useMap = () => useContext(MapContext);

interface MapProviderProps {
  containerRef: React.RefObject<HTMLDivElement>;
  children: ReactNode;
}

/**
 * MapProvider initialises a single MapLibre GL instance and shares it
 * via context so all child views can add layers without prop-drilling.
 */
export const MapProvider = ({ containerRef, children }: MapProviderProps) => {
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;

    mapRef.current = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          'raster-tiles': {
            type: 'raster',
            tiles: [
              'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
              'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
            ],
            tileSize: 256,
            attribution: '&copy; CartoDB',
          },
        },
        layers: [{ id: 'base-tiles', type: 'raster', source: 'raster-tiles' }],
      },
      center: [22.2875, 52.1686], // Siedlce
      zoom: 13,
      attributionControl: false,
    });

    mapRef.current.on('load', () => {
      mapRef.current?.resize();
      mapRef.current?.addControl(new maplibregl.NavigationControl(), 'top-right');
      setIsReady(true);
    });

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
      setIsReady(false);
    };
  }, [containerRef]);

  return (
    <MapContext.Provider value={{ map: mapRef.current, isReady }}>
      {children}
    </MapContext.Provider>
  );
};
