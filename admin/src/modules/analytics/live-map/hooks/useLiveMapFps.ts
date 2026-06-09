import { useEffect, useRef, useState, type RefObject } from 'react';
import {
    LiveMapFpsMonitor,
    type PerformanceDegradeLevel,
} from '../engine/liveMapPerformance';
import { setMicroRiderDegrade } from '../engine/liveMapLayers';
import type { LiveMapTheme } from '../engine/liveMapTheme';

type MapHost = {
    on: (event: string, handler: () => void) => void;
    off?: (event: string, handler: () => void) => void;
};

export function useLiveMapFps(
    mapRef: RefObject<MapHost | null>,
    mapReady: boolean,
    themeRef: RefObject<LiveMapTheme>,
): { fps: number; degradeLevel: PerformanceDegradeLevel } {
    const monitorRef = useRef(new LiveMapFpsMonitor());
    const [fps, setFps] = useState(0);
    const [degradeLevel, setDegradeLevel] = useState<PerformanceDegradeLevel>('none');
    const degradeLevelRef = useRef<PerformanceDegradeLevel>('none');

    useEffect(() => {
        const map = mapRef.current;
        if (!mapReady || !map) return;

        const monitor = monitorRef.current;
        monitor.bindMap(map);

        const id = window.setInterval(() => {
            setFps(monitor.last.fps);
            const next = monitor.evaluateDegrade();
            if (next != null && next !== degradeLevelRef.current) {
                degradeLevelRef.current = next;
                setDegradeLevel(next);
                setMicroRiderDegrade(
                    map as Parameters<typeof setMicroRiderDegrade>[0],
                    next,
                    themeRef.current,
                );
            }
        }, 1000);

        return () => {
            window.clearInterval(id);
            monitor.unbindMap();
        };
    }, [mapReady, mapRef, themeRef]);

    return { fps, degradeLevel };
}
