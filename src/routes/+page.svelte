<script lang="ts">
	import { Data } from '$lib';
	import { Button, Modal, Label, Input } from 'flowbite-svelte';
	import { InfoCircleOutline } from 'flowbite-svelte-icons';
	import type { LatLngTuple } from 'leaflet';
	import Papa from 'papaparse';
	import type { Icons } from '$lib/icons';
	import { local_store } from '$lib/local_store';

	let L: typeof import('leaflet');
	let icons: Icons;
	let map: L.Map | undefined;
	let initialView: LatLngTuple = [40.716, -74.467];
	let markers: Record<string, L.Marker> = {};

	async function createMap(container: HTMLElement) {
		L = await import('leaflet');
		icons = (await import('$lib/icons')).icons;

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

	let import_modal = local_store('import_modal', false);
	let info_modal = local_store('info_modal', false);
	let spreadsheet_id = local_store('spreadsheet_id', '');
	let valid_spreadsheet_id = $derived($spreadsheet_id.length == 44);

	let data: Data | undefined;

	let log = $state('');
	$effect(() => {
		if (!valid_spreadsheet_id) return;
		log = '';

		Papa.parse(`https://docs.google.com/spreadsheets/d/${$spreadsheet_id}/export?format=csv`, {
			download: true,
			header: false,
			complete: (sheet) => {
				log += 'Successfully fetched google sheet\n';
				console.log(sheet);
				const sheet_data = sheet.data as string[][];
				log += `${sheet_data[0].length} cols, ${sheet_data.length} rows\n`;

				try {
					const add_to_log = (s: string) => (log += s + '\n');
					data = Data.fromSheetData(sheet_data, add_to_log);

					data
						?.fetchAddresses(add_to_log)
						.then(() => {
							if (data?.addresses.find((a) => a.err))
								log += '!Addresses fetched with some errors!\n';
							else log += 'Addresses fetched successfully!\n';

							let i = 0;
							data?.addresses.map((a) => {
								if (map) {
									markers[i++] = L.marker([a.y, a.x], {
										title: a.name,
										icon: a.car === undefined ? icons.markerBlue : icons.markerBlueHollow
									}).addTo(map);
								} else throw 'Map not initialized';
							});
						})
						.catch((e) => {
							console.error(e);
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
<Modal class="prose prose-p:my-2" bind:open={$import_modal} autoclose outsideclose>
	<p class="text-center">
		<code
			>https://docs.google.com/spreadsheets/d/<b class="hi"
				>abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGH</b
			>/edit?gid=0#gid=0</code
		>
	</p>
	<Label for="spreadsheet-id" class="mt-6 mb-2">
		Spreadsheet ID <b class="dem">(the 44 characters in the middle of the URL):</b>
	</Label>
	<Input id="spreadsheet-id" bind:value={$spreadsheet_id}></Input>

	<div class="flex flex-row items-stretch gap-4">
		<div class="min-w-64 basis-64">
			<p class="mb-0!">Expects the following columns:</p>
			<ul class="mt-0!">
				<li class="my-0!"><code>Parent [X]</code></li>
				<li class="my-0!"><code>Parent [X] [INFO]</code></li>
				<li class="my-0!"><code>Passenger Capacity</code></li>
				<li class="my-0!"><code>Child [Y]</code></li>
				<li class="my-0!"><code>Child [Y] [INFO]</code></li>
				<li class="my-0!"><code>Address</code></li>
			</ul>
		</div>
		<pre class="flex flex-col overflow-auto"><code class="shrink basis-0"
				>{#if !valid_spreadsheet_id}<span class="text-red-400"
						>Waiting for valid Spreadsheet ID...</span
					>{:else}<span class="text-lime-400">Valid Spreadsheet ID detected</span>{/if}<br
				/>{#each log.split('\n') as line, i (i)}{#if line[0] == '!'}<span class="text-red-400"
							>{line.slice(1)}</span
						>{:else if line[0] == '}'}<span class="text-amber-400">{line.slice(1)}</span
						>{:else}{line}{/if}<br />{/each}</code
			></pre>
	</div>
</Modal>

<Modal class="prose prose-p:my-2" bind:open={$info_modal} autoclose outsideclose>
    <p>The <b>Blue Markers</b> represent addresses which have residents that have not been allocated to a car.</p>
    <p>The <b>Green Markers</b> represent addresses in which all residents have been allocated to a car.</p>
    <p>The <b>Hollow Markers</b> represent addresses that have cars.</p>
</Modal>

<div class="flex flex-row">
	<div class="basis-64 p-4 lg:basis-96">
		<div class="flex items-stretch">
			<Button
				class="grow rounded-r-none"
				color="alternative"
				on:click={() => ($import_modal = true)}
			>
				Import from Google Sheet
			</Button>
			<Button class="rounded-l-none p-2!" on:click={() => ($info_modal = true)}>
				<InfoCircleOutline />
			</Button>
		</div>
		<!-- <div class="flex flex-col gap-2">
			<Button>Button</Button>
			<Button>Button</Button>
		</div> -->
	</div>
	<main class="h-[100vh] grow" use:mapAction></main>
</div>
