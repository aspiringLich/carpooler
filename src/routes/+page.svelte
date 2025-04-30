<script lang="ts">
	import { areaOfBounds, Data } from '$lib';
	import { Button, Modal, Label, Input } from 'flowbite-svelte';
	import type { LatLngTuple } from 'leaflet';
	import Papa from 'papaparse';
	import type { EsriProvider } from 'leaflet-geosearch';

	let provider: EsriProvider;
	let L: typeof import('leaflet');
	let map: L.Map | undefined;
	let initialView: LatLngTuple = [40.716, -74.467];

	async function createMap(container: HTMLElement) {
		L = await import('leaflet');
		const { EsriProvider } = await import('leaflet-geosearch');

		provider = new EsriProvider();
		map = L.map(container, { preferCanvas: true }).setView(initialView, 11);
		// var searchControl = L.es/ri.Geocoding.geosearch().addTo(map);

		L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
			attribution: `&copy;<a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>,
		        &copy;<a href="https://carto.com/attributions" target="_blank">CARTO</a>`,
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

	let data: Data | undefined;

	let log = $state('');
	$effect(() => {
		if (!valid_spreadsheet_id) return;
		log = '';

		Papa.parse(`https://docs.google.com/spreadsheets/d/${spreadsheet_id}/export?format=csv`, {
			download: true,
			header: false,
			complete: (sheet) => {
				log += 'Successfully fetched google sheet\n';
				console.log(sheet);
				const sheet_data = sheet.data as string[][];
				log += `${sheet_data[0].length} cols, ${sheet_data.length} rows\n`;

				try {
					data = Data.fromSheetData(sheet_data, (s) => (log += s + '\n'));

					let errors = false;
					Promise.all(
						(data as Data).addresses.map((a) =>
							(async () => {
								const res = await provider.search({ query: a.name });
								const bounds = res[0].bounds;
								let area = 0;
								if (bounds) area = areaOfBounds(bounds);

								if (area > 1000000) {
									log += `!Fetched bounds for '${a.name}' too large!\n!└ Using '${res[0].label}'\n`;
									errors = true;
								}

								a.x = res[0].x;
								a.y = res[0].y;
							})()
						)
					)
						.then(() => {
							if (errors) {
								log += '!Addresses fetched with some errors\n';
							} else {
								log += 'Addresses fetched successfully!\n';
							}
						})
						.catch((e) => {
							log += `!Error fetching addresses: ${e}\n`;
						});
				} catch (e) {
					console.error(e);
				}
			},
			error: () => {
				log += '!Error fetching google sheet\n';
			}
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
				<li><code>Child [Y]</code></li>
				<li><code>Child [Y] [INFO]</code></li>
				<li><code>Address</code></li>
			</ul>
		</div>
		<pre class="flex flex-col overflow-auto"><code class="shrink basis-0"
				>{#if !valid_spreadsheet_id}<span class="text-red-400"
						>Waiting for valid Spreadsheet ID...</span
					>{:else}<span class="text-green-400">Valid Spreadsheet ID detected</span>{/if}<br
				/>{#each log.split('\n') as line, i (i)}{#if line[0] == '!'}<span class="text-red-400"
							>{line.slice(1)}</span
						>{:else}{line}{/if}<br />{/each}</code
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
