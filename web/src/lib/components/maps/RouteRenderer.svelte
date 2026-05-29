<script lang="ts">
	import { onDestroy } from 'svelte';
	import type { Map as MapLibreMap } from 'maplibre-gl';

	interface Props {
		map?: MapLibreMap;
		coordinates?: [number, number][];
		layerId?: string;
		sourceId?: string;
		color?: string;
		width?: number;
	}

	let {
		map,
		coordinates = [],
		layerId = 'route-layer',
		sourceId = 'route-source',
		color = '#F5E6CC',
		width = 4
	}: Props = $props();

	function buildGeoJSON(coords: [number, number][]): GeoJSON.Feature<GeoJSON.LineString> {
		return {
			type: 'Feature',
			properties: {},
			geometry: {
				type: 'LineString',
				coordinates: coords.map(([lng, lat]) => [lng, lat])
			}
		};
	}

	function buildMarkersGeoJSON(coords: [number, number][]): GeoJSON.FeatureCollection {
		return {
			type: 'FeatureCollection',
			features: [
				{ type: 'Feature', properties: { type: 'start' }, geometry: { type: 'Point', coordinates: coords[0] } },
				{ type: 'Feature', properties: { type: 'end' }, geometry: { type: 'Point', coordinates: coords[coords.length - 1] } }
			]
		};
	}

	$: if (map && coordinates.length > 0) {
		const geojson = buildGeoJSON(coordinates);

		if (!map.getSource(sourceId)) {
			map.addSource(sourceId, { type: 'geojson', data: geojson });
			map.addLayer({
				id: layerId,
				type: 'line',
				source: sourceId,
				paint: {
					'line-color': color,
					'line-width': width,
					'line-opacity': 0.9
				},
				layout: {
					'line-cap': 'round',
					'line-join': 'round'
				}
			});

			// Markers source and layer
			const markersSourceId = `${sourceId}-markers`;
			const markersLayerId = `${layerId}-markers`;
			if (!map.getSource(markersSourceId)) {
				const markersGeojson = buildMarkersGeoJSON(coordinates);
				map.addSource(markersSourceId, { type: 'geojson', data: markersGeojson });
				map.addLayer({
					id: markersLayerId,
					type: 'circle',
					source: markersSourceId,
					paint: {
						'circle-radius': 6,
						'circle-color': [
							'match',
							['get', 'type'],
							'start', '#4ADE80',
							'end', '#F87171',
							'#F5E6CC'
						],
						'circle-stroke-width': 2,
						'circle-stroke-color': '#1A1A2E'
					}
				});
			}

			// Fit bounds to route
			const bounds = new maplibregl.LngLatBounds();
			coordinates.forEach(([lng, lat]) => bounds.extend([lng, lat]));
			map.fitBounds(bounds, { padding: 50, duration: 500 });
		} else {
			const source = map.getSource(sourceId) as maplibregl.GeoJSONSource | undefined;
			source?.setData(geojson);

			// Update markers
			const markersSourceId = `${sourceId}-markers`;
			const markersSource = map.getSource(markersSourceId) as maplibregl.GeoJSONSource | undefined;
			markersSource?.setData(buildMarkersGeoJSON(coordinates));
		}
	}

	onDestroy(() => {
		if (map) {
			if (map.getLayer(layerId)) map.removeLayer(layerId);
			if (map.getSource(sourceId)) map.removeSource(sourceId);
			const markersLayerId = `${layerId}-markers`;
			const markersSourceId = `${sourceId}-markers`;
			if (map.getLayer(markersLayerId)) map.removeLayer(markersLayerId);
			if (map.getSource(markersSourceId)) map.removeSource(markersSourceId);
		}
	});
</script>

<!-- Logical component, no visual output -->
