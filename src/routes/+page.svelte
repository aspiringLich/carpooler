<script lang="ts">
	import { Data, distanceBetweenPoints } from '$lib';
	import { Button, Modal, Label, Input, Card } from 'flowbite-svelte';
	import {
		InfoCircleOutline,
		ArrowLeftOutline,
		ArrowRightOutline,
		ArrowDownOutline,
		ArrowUpOutline
	} from 'flowbite-svelte-icons';
	import type { LatLngTuple } from 'leaflet';
	import Papa from 'papaparse';
	import type { Icons } from '$lib/icons';
	import { local_store } from '$lib/local_store';
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	import type { GeoSearchControl } from 'leaflet-geosearch';
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	import { derived, type Writable } from 'svelte/store';

	let L: typeof import('leaflet');
	let icons: Icons;
	let map: L.Map | undefined;
	let initialView: LatLngTuple = [40.716, -74.467];
	let markers: Record<string, L.Marker> = {};

	async function createMap(container: HTMLElement) {
		L = await import('leaflet');
		icons = (await import('$lib/icons')).icons;
		const { GeoSearchControl, EsriProvider } = await import('leaflet-geosearch');

		map = L.map(container, { preferCanvas: true }).setView(initialView, 11);

		L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
			attribution: `&copy;<a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>,
		        &copy;<a href="https://carto.com/attributions" target="_blank">CARTO</a>`,
			subdomains: 'abcd'
		}).addTo(map);
		map.addControl(
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			new (GeoSearchControl as any)({
				style: 'bar',
				provider: new EsriProvider(),
				showMarker: false
			})
		);
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
	let welcome_modal = $state(true);
	let spreadsheet_id = local_store('spreadsheet_id', '');
	let allocation: Writable<string[][]> = local_store('allocation', []);
	let total_allocated: Set<string> = $state(new Set());

	let first = false;
	spreadsheet_id.subscribe(() => {
		if (!first) {
			first = true;
		} else {
			allocation.set([]);
			total_allocated = new Set();
		}
	});

	let update = $state(0);

	let valid_spreadsheet_id = $derived($spreadsheet_id.length == 44);

	let data: Data | undefined = $state();
	let log = $state('');

	function onDataFetch(data: Data) {
		if ($allocation.length !== data.cars.length) {
			if ($allocation.length !== 0) {
				log += 'number of cars changed... resetting car allocation data\n';
				$allocation = [];
			} else {
				log += 'Generating car allocation data\n';
			}

			// initialize and assign children to their respective cars
			for (let i = 0; i < data.cars.length; i++) {
				const address = data.addresses[data.cars[i].address];
				let children = address.children.splice(0, address.children.length);
				$allocation.push(children);
				children.forEach((child) => total_allocated.add(child));
			}
			allocation.update((prev) => {
				return prev;
			});
		} else {
			log += 'Reusing locally saved car allocation data\n';
			$allocation.forEach((children) => {
				children.forEach((child) => total_allocated.add(child));
			});
		}

		let i = 0;
		data.addresses.map((a) => {
			if (map) {
				markers[i] = L.marker([a.lat, a.lng], {
					title: a.name,
					icon: icons.getIcon(data as Data, total_allocated, i, i++ == data?.cars[0].address)
				}).addTo(map);
			} else throw 'Map not initialized';
		});
	}

	$effect(() => {
		if (!valid_spreadsheet_id) return;
		log = '';
		Object.values(markers).forEach((marker) => marker.remove());
		markers = {};

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

							onDataFetch(data!);
							// HACK to force svelte to update
							selectedCar = 1;
							selectedCar = 0;
						})
						.catch((e) => {
							console.error(e);
							log += `${e}\n`;
						});
				} catch (e) {
					console.error(e);
				}
				selectedCar = 0;
			},
			error: () => {
				log += '!Error fetching google sheet\n';
			}
		});
	});

	function updateIcon(address: number | undefined, big?: boolean) {
		if (data && address !== undefined && markers?.[address]) {
			markers[address].setIcon(icons.getIcon(data, total_allocated, address, big ?? false));
		}
	}

	let selectedCar = $state(0);
	let prevCar = 0;
	let closestChildren: { distance: number; address: number; name: string }[] = $state([]);
	$effect(() => {
		if (!data) return;

		let s = selectedCar; // svelte doesnt detect selectedCar if we just index with it >:(
		let address = data.cars[selectedCar + s - s].address;

		let { lat: lat0, lng: lng0 } = data.addresses[address];
		if (lat0 !== undefined && lng0 !== undefined) {
			let cc = [];
			for (const [name, d] of Object.entries(data.children)) {
				let { lat, lng } = data.addresses[d.address];

				cc.push({
					distance: distanceBetweenPoints(lat0, lng0, lat, lng),
					address: d.address,
					name
				});
			}
			closestChildren = cc.sort((a, b) => a.distance - b.distance);
		}

		updateIcon(address, true);
		const prevAddress = data.cars[prevCar].address;
		updateIcon(prevAddress, false);
		prevCar = selectedCar;
	});

	function mouseenter(address: number) {
		markers[address]?.setOpacity(0.3);
	}

	function mouseleave(address: number) {
		markers[address]?.setOpacity(1.0);
	}

	function addchild(child: string) {
		if (data && $allocation[selectedCar].length < data.cars[selectedCar].capacity) {
			allocation.update((prev) => {
				prev[selectedCar].push(child);
				return prev;
			});
			total_allocated.add(child);
			update++;

			const address = data.children[child].address;
			markers[address]?.setIcon(icons.getIcon(data, total_allocated, address));
		}
	}

	function removechild(child: string) {
		if (!data) return;
		let idx = $allocation[selectedCar].indexOf(child);
		if (idx != -1)
			allocation.update((prev) => {
				prev[selectedCar].splice(idx, 1);
				return prev;
			});

		total_allocated.delete(child);
		update++;

		const address = data.children[child].address;
		markers[address]?.setIcon(icons.getIcon(data, total_allocated, address));
	}

	function distanceFormat(distance: number): string {
		if (distance < 100) {
			return distance.toFixed(0) + 'm';
		}
		return (distance / 1000).toFixed(2) + 'km';
	}
</script>

<svelte:window
	on:resize={() => {
		if (map) map.invalidateSize();
	}}
/>
<!-- INFO MODAL google sheet -->
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
			<p>
				You can replace <code>[X], [Y]</code> with identifiers for each parent/child column group,
				and <code>[INFO]</code> with additional information columns you would like to be displayed.
			</p>
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
<!-- INFO MODAL main page -->
<Modal class="prose prose-p:my-2" bind:open={$info_modal} autoclose outsideclose>
	<p>
		The <b>Blue Markers</b> represent addresses which have residents that have not been allocated to
		a car.
	</p>
	<p>
		The <b>Green Markers</b> represent addresses in which all residents have been allocated to a car.
	</p>
	<p>The <b>Hollow Markers</b> represent addresses that have cars.</p>
</Modal>
<!-- INFO MODAL main page -->
<Modal class="prose prose-p:my-2" bind:open={welcome_modal} autoclose outsideclose>
	<h1>Carpooler</h1>
	<p>
		This is a project created by me (<a href="https://github.com/aspiringLich" target="_blank"
			>Brandon Li</a
		>) for the Ridge High School forensics team to help with assigning carpooling. If there are any
		issues or concerns, please contact me at
		<a href="mailto:brandonli@bcli.dev" target="_blank">brandonli@bcli.dev</a>.
	</p>
	<p>
		To see an example google sheet, please use the google sheet ID <code
			>1hvBg67mKg6UhAgddJsF5Ty9dre1akhqy2_KtmUtAiW4</code
		>
	</p>
</Modal>

<div
	class="
    grid max-h-screen grid-flow-col grid-cols-[16rem_1fr] grid-rows-[auto_auto_auto_1fr]
    lg:grid-cols-[24rem_1fr]"
>
	<div class="m-2 my-1 flex items-stretch">
		<Button class="grow rounded-r-none" color="alternative" on:click={() => ($import_modal = true)}>
			Import from Google Sheet
		</Button>
		<Button class="rounded-l-none p-2!" on:click={() => ($info_modal = true)}>
			<InfoCircleOutline />
		</Button>
	</div>
	<div class="m-2 my-1 flex items-center justify-around">
		<Button
			class="p-2"
			color="alternative"
			on:click={() => (selectedCar -= +(selectedCar > 0))}
			disabled={selectedCar <= 0}
		>
			<ArrowLeftOutline />
		</Button>
		<p class="grow text-center">Car {selectedCar + 1}</p>
		<Button
			class="p-2"
			color="alternative"
			on:click={() => (selectedCar += data ? +(selectedCar < data.cars.length - 1) : 0)}
			disabled={selectedCar >= (data ? data.cars.length - 1 : Infinity)}
		>
			<ArrowRightOutline />
		</Button>
	</div>
	<div class="m-2 my-1">
		<Card class="h-56 overflow-y-scroll shadow-none">
			<p class="text-lg text-neutral-700">
				{data?.addresses[data?.cars[selectedCar]?.address || 0].name}
			</p>
			<!-- SHOW PARENTS -->
			{#if data?.cars[selectedCar]?.parents}
				{#each data?.cars[selectedCar].parents as parent (parent)}
					{@const p = data?.parents[parent]}
					<p class="mt-2 text-lg text-neutral-700">{parent}</p>
					<ul>
						{#each Object.entries(p?.data || {}) as [key, value] (key)}
							<li class="text-neutral-600"><b>{key}:</b> {value}</li>
						{/each}
					</ul>
				{/each}
			{/if}
		</Card>
	</div>
	<div class="flex-pass px-2">
		{#key update}
			{#if $allocation[selectedCar] && data?.cars[selectedCar] && $allocation}
				{@const car = data.cars[selectedCar]}
				<!-- CAPACITY -->
				<p class="text-lg"><b>Seats:</b> {$allocation[selectedCar].length} / {car.capacity}</p>
				<!-- SHOW ALLOCATED SEATS -->
				{#each $allocation[selectedCar] as child (child)}
					{@const address = data.children[child].address}
					<Card
						class="my-1 flex flex-row bg-neutral-100 p-0! shadow-none"
						on:mouseenter={() => mouseenter(address)}
						on:mouseleave={() => mouseleave(address)}
					>
						<div class="min-w-0 grow p-2">
							<h3 class="min-w-0 font-bold text-nowrap text-ellipsis text-neutral-800">
								{child}
							</h3>
							<p class="min-w-0 overflow-hidden text-nowrap text-ellipsis text-neutral-800">
								{data.addresses[address].name}
							</p>
						</div>
						<Button class="basis-0 px-2 " color="alternative" on:click={() => removechild(child)}>
							<ArrowDownOutline />
						</Button>
					</Card>
				{/each}

				<!-- SHOW CLOSEST CHILDREN -->
				{#each closestChildren as child (child)}
					{#if total_allocated && !total_allocated.has(child.name)}
						<Card
							class="my-1 flex flex-row p-0! shadow-none"
							on:mouseenter={() => mouseenter(child.address)}
							on:mouseleave={() => mouseleave(child.address)}
						>
							<div class="grid min-w-0 grow grid-cols-[1fr_auto] p-2">
								<h3 class="min-w-0 font-bold text-nowrap text-ellipsis text-neutral-800">
									{child.name}
								</h3>
								<span>
									{distanceFormat(child.distance)}
								</span>
								<p
									class="col-span-2 min-w-0 overflow-hidden text-nowrap text-ellipsis text-neutral-800"
								>
									{data.addresses[child.address].name}
								</p>
							</div>
							<Button
								class="basis-0 px-2 "
								color="alternative"
								on:click={() => addchild(child.name)}
								disabled={$allocation[selectedCar].length >= car.capacity}
							>
								<ArrowUpOutline />
							</Button>
						</Card>
					{/if}
				{/each}
			{/if}
		{/key}
	</div>
	<main class="row-span-5 h-[100vh] grow" use:mapAction></main>
</div>
