<script lang="ts">
	import { Button } from 'flowbite-svelte';
	import type { LatLngTuple } from 'leaflet';

	let L: typeof import('leaflet');
	let map: L.Map | undefined;
	let initialView: LatLngTuple = [40.716, -74.467];

	async function createMap(container: HTMLElement) {
	    L = await import("leaflet");
		map = L.map(container, { preferCanvas: true }).setView(initialView, 11);
		// var searchControl = L.es/ri.Geocoding.geosearch().addTo(map);

		L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
			attribution: `&copy;<a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>`,
			subdomains: 'abcd',
		}).addTo(map);
	}

	function mapAction(container: HTMLElement) {
		createMap(container).then();

		return {
			destroy: () => {
				map?.remove();
				map = undefined;
			}
		};
	}
</script>

<svelte:window
	on:resize={() => {
		if (map) map.invalidateSize();
	}}
/>

<div class="flex flex-row">
	<div class="basis-96">hihi</div>
	<main class="h-[100vh] grow" use:mapAction></main>
</div>
