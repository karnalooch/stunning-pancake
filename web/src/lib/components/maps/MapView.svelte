<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import maplibregl from 'maplibre-gl';
	import type { Map as MapLibreMap, MapOptions } from 'maplibre-gl';
	import 'maplibre-gl/dist/maplibre-gl.css';

	interface Props {
		center?: [number, number];
		zoom?: number;
		style?: string;
		class?: string;
	}

	let {
		center = [20, 52],
		zoom = 6,
		style = 'https://demotiles.maplibre.org/style.json',
		class: className = ''
	}: Props = $props();

	let mapContainer: HTMLDivElement;
	let map: MapLibreMap | undefined;
	let loading = $state(true);

	export { map };

	onMount(() => {
		map = new maplibregl.Map({
			container: mapContainer,
			style,
			center,
			zoom,
			attributionControl: true
		});

		map.addControl(new maplibregl.NavigationControl(), 'top-right');
		map.addControl(new maplibregl.ScaleControl({ maxWidth: 80, unit: 'metric' }), 'bottom-left');

		map.on('load', () => {
			loading = false;
		});

		return () => {
			map?.remove();
			map = undefined;
		};
	});

	$: if (map && center) {
		map.flyTo({ center, essential: true });
	}

	$: if (map && zoom !== undefined) {
		map.setZoom(zoom);
	}
</script>

<div class="relative h-full w-full {className}">
	{#if loading}
		<div class="absolute inset-0 flex items-center justify-center bg-[#2D2418]">
			<div class="text-[#B0A090]">Loading map...</div>
		</div>
	{/if}
	<div bind:this={mapContainer} class="h-full w-full" />
</div>
