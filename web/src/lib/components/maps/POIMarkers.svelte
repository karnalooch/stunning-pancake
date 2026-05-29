<script lang="ts">
	import { onDestroy } from 'svelte';
	import type { Map as MapLibreMap, Popup as MapLibrePopup } from 'maplibre-gl';
	import maplibregl from 'maplibre-gl';

	interface Props {
		map?: MapLibreMap;
		data?: GeoJSON.FeatureCollection;
		layerId?: string;
		sourceId?: string;
		color?: string;
		size?: number;
	}

	let {
		map,
		data,
		layerId = 'poi-layer',
		sourceId = 'poi-source',
		color = '#F5E6CC',
		size = 10
	}: Props = $props();

	let popup: MapLibrePopup | null = null;

	$: if (map && data) {
		if (!map.getSource(sourceId)) {
			map.addSource(sourceId, { type: 'geojson', data });

			map.addLayer({
				id: layerId,
				type: 'circle',
				source: sourceId,
				paint: {
					'circle-radius': size,
					'circle-color': color,
					'circle-stroke-width': 2,
					'circle-stroke-color': '#1A1A2E',
					'circle-opacity': 0.9
				}
			});

			// Click handler for popup
			map.on('click', layerId, (e) => {
				const coordinates = e.features?.[0]?.geometry?.coordinates;
				const properties = e.features?.[0]?.properties || {};

				popup = new maplibregl.Popup({ closeButton: false, closeOnClick: true })
					.setLngLat(coordinates)
					.setHTML(
						`<div style="color: #1A1A2E; font-size: 14px; max-width: 200px;">
							<strong>${properties.name || 'Point of Interest'}</strong>
							${properties.description ? `<p style="margin-top: 4px; color: #555;">${properties.description}</p>` : ''}
						</div>`
					)
					.addTo(map);
			});

			// Cursor change on hover
			map.on('mouseenter', layerId, () => map.getCanvas().style.cursor = 'pointer');
			map.on('mouseleave', layerId, () => map.getCanvas().style.cursor = '');
		} else {
			const source = map.getSource(sourceId) as maplibregl.GeoJSONSource | undefined;
			source?.setData(data);
		}
	}

	onDestroy(() => {
		if (popup) popup.remove();
		if (map) {
			if (map.getLayer(layerId)) map.removeLayer(layerId);
			if (map.getSource(sourceId)) map.removeSource(sourceId);
		}
	});
</script>

<!-- Logical component, no visual output -->
