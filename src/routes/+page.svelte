<script lang="ts">
	import { Button, Modal, Label, Input } from 'flowbite-svelte';
	import type { LatLngTuple } from 'leaflet';
	import Papa from 'papaparse';

	let L: typeof import('leaflet');
	let map: L.Map | undefined;
	let initialView: LatLngTuple = [40.716, -74.467];

	async function createMap(container: HTMLElement) {
		L = await import('leaflet');
		map = L.map(container, { preferCanvas: true }).setView(initialView, 11);
		// var searchControl = L.es/ri.Geocoding.geosearch().addTo(map);

		L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
			attribution: `&copy;<a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>`,
			subdomains: 'abcd'
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

	let import_modal = $state(false);
	let spreadsheet_id = $state('');
	let valid_spreadsheet_id = $derived(spreadsheet_id.length == 44);

	$effect(() => {
		if (!valid_spreadsheet_id) return;

		Papa.parse(`https://docs.google.com/spreadsheets/d/${spreadsheet_id}/export?format=csv`, {
			download: true,
			header: false,
			complete: console.log
		});
	});
</script>

<svelte:window
	on:resize={() => {
		if (map) map.invalidateSize();
	}}
/>
<Modal class="prose prose-p:my-2" bind:open={import_modal} autoclose outsideclose>
	<p class="text-center">
		<code
			>https://docs.google.com/spreadsheets/d/<b class="hi"
				>abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGH</b
			>/edit?gid=0#gid=0</code
		>
	</p>
	<Label for="spreadsheet-id">
		Spreadsheet ID <b class="dem">(the 44 characters in the middle of the URL):</b>
	</Label>
	<Input id="spreadsheet-id" bind:value={spreadsheet_id}></Input>

	<div class="flex flex-row items-stretch gap-4">
		<div class="min-w-64 basis-64">
			<p class="mb-0!">Expects the following columns:</p>
			<ul class="mt-0!">
				<li><code>Parent [X]</code></li>
				<li><code>Parent [X] [INFO]</code></li>
				<li><code>Passenger Capacity</code></li>
				<li><code>Child [X]</code></li>
				<li><code>Child [X] Sex</code></li>
				<li><code>Address</code></li>
			</ul>
		</div>
		<pre class="grow"><code
				>{#if !valid_spreadsheet_id}<span class="text-red-400"
						>Waiting for valid Spreadsheet ID...</span
					>{:else}<span class="text-green-400">Valid Spreadsheet ID detected</span>{/if}<br /></code
			></pre>
	</div>
</Modal>

<div class="flex flex-row">
	<div class="basis-64 p-4 lg:basis-96">
		<div class="flex items-stretch">
			<Button class="grow rounded-r-none" color="alternative" on:click={() => (import_modal = true)}
				>Import from Google Sheet</Button
			>
			<!-- <Button class="rounded-l-none p-2!" on:click={() => (info_modal = true)}>
				<InfoCircleOutline />
			</Button> -->
		</div>
		<!-- <div class="flex flex-col gap-2">
			<Button>Button</Button>
			<Button>Button</Button>
		</div> -->
	</div>
	<main class="h-[100vh] grow" use:mapAction></main>
</div>
