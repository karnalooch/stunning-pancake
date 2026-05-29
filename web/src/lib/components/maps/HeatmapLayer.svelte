<script lang="ts">
	import { onDestroy } from 'svelte';
	import type { Map as MapLibreMap } from 'maplibre-gl';

	interface Props {
		map?: MapLibreMap;
		data?: GeoJSON.FeatureCollection;
		layerId?: string;
		sourceId?: string;
		radius?: number;
		weight?: number;
		intensity?: number;
	}

	let {
		map,
		data,
		layerId = 'heatmap-layer',
		sourceId = 'heatmap-source',
		radius = 30,
		weight = 1,
		intensity = 1
	}: Props = $props();

	const sourceConfig = {
		type: 'geojson' as const,
		data: data || { type: 'FeatureCollection' as const, features: [] }
	};

	const layerConfig = {
		id: layerId,
		type: 'heatmap' as const,
		source: sourceId,
		paint: {
			'heatmap-weight': ['interpolate', ['linear'], ['get', 'intensity'], 0, 0, 1, weight],
			'heatmap-intensity': ['literal', intensity],
			'heatmap-color': [
				'interpolate',
				['linear'],
				['heatmap-density'],
				0, 'rgba(33,102,172,0)',
				0.2, 'rgb(103,169,207)',
				0.4, 'rgb(209,229,240)',
				0.6, 'rgb(253,219,199)',
				0.8, 'rgb(239,138,98)',
				1, 'rgb(178,24,43)'
			],
			'heatmap-radius': ['literal', radius],
			'heatmap-opacity': 0.8
		}
	};

	$: if (map && data) {
		if (map.getLayer(layerId)) {
			const source = map.getSource(sourceId) as maplibregl.GeoJSONSource | undefined;
			source?.setData(data);
		}
	}

	$: if (map && !map.getLayer(layerId)) {
		if (!map.getSource(sourceId)) {
			map.addSource(sourceId, sourceConfig);
		}
		map.addLayer(layerConfig);
	}

	onDestroy(() => {
		if (map) {
			if (map.getLayer(layerId)) map.removeLayer(layerId);
			if (map.getSource(sourceId)) map.removeSource(sourceId);
		}
	});
</script>

<!-- This component is purely logical, no visual output -->
