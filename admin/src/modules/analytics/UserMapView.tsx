import React, { useEffect, useRef, useState } from 'react';
import { Box, Text, Badge, Group, Skeleton } from '@mantine/core';
import { apiClient } from '../../api/client';
import { useAuth } from '../../core/auth/useAuth';

interface UserPosition {
    deviceId: string;
    name: string;
    type: string;
    lat: number;
    lng: number;
    speed: number;
    course: number;
    lastUpdate: string;
}

export const UserMapView: React.FC = () => {
    const mapContainer = useRef<HTMLDivElement>(null);
    const map = useRef<any>(null);
    const [positions, setPositions] = useState<UserPosition[]>([]);
    const [loading, setLoading] = useState(true);
    const [mapReady, setMapReady] = useState(false);
    const { user } = useAuth();

    // Fetch positions
    useEffect(() => {
        const fetchPositions = async () => {
            try {
                const { data } = await apiClient.get('/activities/telemetry/live/');
                if (Array.isArray(data)) setPositions(data);
            } catch (err) {
                console.error('Failed to fetch positions:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchPositions();
        const interval = setInterval(fetchPositions, 15000);
        return () => clearInterval(interval);
    }, []);

    // Initialize map
    useEffect(() => {
        let cancelled = false;
        if (!mapContainer.current || map.current) return;

        import('maplibre-gl').then((maplibregl) => {
            if (cancelled || !mapContainer.current) return;

            try {
                map.current = new maplibregl.default.Map({
                    container: mapContainer.current,
                    style: {
                        version: 8,
                        sources: {
                            osm: {
                                type: 'raster',
                                tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
                                tileSize: 256,
                                attribution: '&copy; OpenStreetMap contributors',
                            },
                        },
                        layers: [
                            { id: 'osm', type: 'raster', source: 'osm' },
                        ],
                    },
                    center: [21.0122, 52.2297],
                    zoom: 6,
                });

                map.current.on('load', () => {
                    if (!cancelled) setMapReady(true);
                });
            } catch (err) {
                console.warn('MapLibre init failed:', err);
            }
        });

        return () => {
            cancelled = true;
            if (map.current) {
                try { map.current.remove(); } catch { }
            }
            map.current = null;
        };
    }, []);

    // Update markers when positions change
    useEffect(() => {
        if (!map.current || !mapReady) return;

        // Simple marker rendering using canvas approach
        // In production, use maplibregl.Marker or a proper clustering solution
        positions.forEach((pos) => {
            if (!pos.lat || !pos.lng) return;
            try {
                if (map.current) {
                    map.current.flyTo({ center: [pos.lng, pos.lat], duration: 2000, zoom: 10 });
                }
            } catch { }
        });
    }, [positions, mapReady]);

    const onlineCount = positions.length;

    return (
        <Box style={{ position: 'relative', width: '100%', minHeight: 400, borderRadius: 14, overflow: 'hidden' }}>
            <Group style={{ position: 'absolute', top: 12, left: 12, zIndex: 10 }} gap="xs">
                <Badge variant="filled" color="green" radius="sm" size="md">
                    ● {onlineCount} online
                </Badge>
                <Badge variant="light" color="gray" radius="sm" size="md">
                    {user?.tenantId ? 'Tenant' : 'Global'} view
                </Badge>
            </Group>

            {loading && (
                <Skeleton height={400} radius="md" />
            )}

            <div
                ref={mapContainer}
                style={{ width: '100%', height: 400, borderRadius: 14 }}
            />

            {!mapReady && !loading && (
                <Box style={{
                    position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'var(--surface-secondary)', borderRadius: 14,
                }}>
                    <Text size="sm" c="dimmed">Loading map...</Text>
                </Box>
            )}
        </Box>
    );
};
