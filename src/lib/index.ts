// place files you want to import through the `$lib` alias in this folder.

type Address = {
	lat: number;
	lng: number;
	name: string;
	err: null;
	car?: number;
	children: string[];
	parents: string[];
};

export class Data {
	parents: Record<string, { data: { [key: string]: string }; children: string[]; address: number }>;
	children: Record<string, { data: { [key: string]: string }; parents: string[]; address: number }>;
	cars: { parents: string[]; address: number; capacity: number }[];
	addresses: Address[];
    child_names: Set<string>;
    parent_names: Set<string>;

	constructor() {
		this.parents = {};
		this.children = {};
		this.cars = [];
		this.addresses = [];
		this.child_names = new Set<string>();
		this.parent_names = new Set<string>();
	}

	static fromSheetData(data: string[][], addToLog: (add: string) => void): Data | undefined {
		const d = new Data();

		// == SCAN HEADER INDECES (pass 1)
		const headers = data[0] as string[];

		const logThrow = (s: string) => {
			addToLog(s);
			addToLog('!Aborting...');
			throw s;
		};

		// check for duplicates
		const seenHeaders = new Set<string>();
		for (const header of headers) {
			const h = header.trim().split(' ').join(' ');
			if (seenHeaders.has(h)) {
				logThrow(`!Duplicate header found: ${header}`);
			}
			seenHeaders.add(h);
		}

		const columns = new Set<number>();
		for (let i = 0; i < headers.length; i++) columns.add(i);
		const rmvCol = (i: number) => {
			if (columns.delete(i)) return i;
			else {
				console.log(data);
				logThrow('!This is a bug! Same columns triggered twice, check logs\n');
				throw 0;
			}
		};

		const parent_idx: { [key: string]: number } = {};
		const child_idx: { [key: string]: number } = {};
		let passenger_capacity_idx = -1;
		let address_idx = -1;

		for (let i = 0; i < headers.length; i++) {
			const split = headers[i].trim().split(' ');
			if (split.length == 2 && split[0] == 'Parent') {
				parent_idx[split[1]] = rmvCol(i);
			} else if (split.length == 2 && split[0] == 'Passenger' && split[1] == 'Capacity') {
				passenger_capacity_idx = rmvCol(i);
			} else if (split.length == 2 && split[0] == 'Child') {
				child_idx[split[1]] = rmvCol(i);
			} else if (split.length == 1 && split[0] == 'Address') {
				address_idx = rmvCol(i);
			}
		}
		addToLog(`Found ${Object.keys(parent_idx).length} parents groups per row`);
		addToLog(`Found ${Object.keys(child_idx).length} child groups per row`);

		if (passenger_capacity_idx == -1) logThrow('!No Passenger Capacity column set');
		if (address_idx == -1) logThrow('!No Address column set');

		const parent_data_idx: { [key: string]: [string, number][] } = {};
		const child_data_idx: { [key: string]: [string, number][] } = {};
		for (let i = 0; i < headers.length; i++) {
			const split = headers[i].trim().split(' ');
			if (split.length >= 3 && split[0] == 'Parent') {
				if (parent_idx[split[1]] === undefined)
					logThrow(`!Unknown parent column: Parent ${split[1]} referenced in column ${i + 1}`);
				if (parent_data_idx[split[1]] === undefined) parent_data_idx[split[1]] = [];

				parent_data_idx[split[1]].push([split.splice(2).join(' '), rmvCol(i)]);
			} else if (split.length >= 3 && split[0] == 'Child') {
				if (child_idx[split[1]] === undefined)
					logThrow(`!Unknown child column: Child ${split[1]} referenced in column ${i + 1}`);
				if (child_data_idx[split[1]] === undefined) child_data_idx[split[1]] = [];

				child_data_idx[split[1]].push([split.splice(2).join(' '), rmvCol(i)]);
			}
		}

		for (let i = 0; i < data.length - 1; i++) {
			const row = data[i + 1];

			// process parents
			const parent_names: string[] = [];
			for (const [p, idx] of Object.entries(parent_idx)) {
				const name = row[idx];
				const data_idx = parent_data_idx[p];

				if (name === '') continue;

				if (d.parent_names.has(name)) {
					addToLog(`}WARN: Parent ${name} duplicated! Skipping repeat occurrence...`);
					continue;
				}
				parent_names.push(name);
				d.parent_names.add(name);
				
				d.parents[name] = {
					data: {},
					address: i,
					children: []
				};
				for (const [datapt, idx] of data_idx) {
					d.parents[name].data[datapt] = row[idx];
				}
			}
			// process children
			const child_names: string[] = [];
			for (const [c, idx] of Object.entries(child_idx)) {
				const name = row[idx];
				const data_idx = child_data_idx[c];

				if (name === '') continue;
				
				if (d.child_names.has(name)) {
					addToLog(`}WARN: Child ${name} duplicated! Skipping repeat occurrence...`);
					continue;
				}
				child_names.push(name);
				d.child_names.add(name);

				d.children[name] = {
					data: {},
					address: i,
					parents: parent_names
				};
				for (const [datapt, idx] of data_idx) {
					d.children[name].data[datapt] = row[idx];
				}
			}
			// add children to parents
			for (const pname of parent_names) d.parents[pname].children = child_names;

			// process cars
			const car = row[passenger_capacity_idx] !== '';
			if (car) {
				const capacity = Number.parseInt(row[passenger_capacity_idx]);
				d.cars.push({
					parents: parent_names,
					address: i,
					capacity,
				});
			}

			// process addresses
			if (row[address_idx] === '') logThrow(`!Address for row ${i + 2} is blank!`);
			d.addresses.push({
				lat: NaN,
				lng: NaN,
				name: row[address_idx],
				err: null,
				car: car ? i : undefined,
				children: child_names,
				parents: parent_names
			});
		}

		console.log(d);
		return d;
	}

	async fetchAddresses(addToLog: (add: string) => void) {
		const { EsriProvider } = await import('leaflet-geosearch');
		const provider = new EsriProvider();

		await Promise.all(
			this.addresses.map((a) =>
				(async () => {
					const res = await provider.search({ query: a.name });
					const bounds = res[0].bounds;
					let area = 0;
					if (bounds) area = areaOfBounds(bounds);

					if (area > 500000) {
						addToLog(
							`}WARN: Fetched bounds for '${a.name}' too large! Possible mismatch.\n} └─(Fetched '${res[0].label}')`
						);
					}
					a.lng = res[0].x;
					a.lat = res[0].y;
				})()
			)
		);
	}
}

const toRadians = (deg: number) => (deg * Math.PI) / 180;
// Earth's radius in meters
const R = 6371000;

// thanks copilot
export function areaOfBounds(bounds: [[number, number], [number, number]]): number {
	const [southWest, northEast] = bounds;

	const lat1 = toRadians(southWest[0]);
	const lon1 = toRadians(southWest[1]);
	const lat2 = toRadians(northEast[0]);
	const lon2 = toRadians(northEast[1]);

	// Calculate the differences
	const ΔLat = lat2 - lat1;
	const ΔLon = lon2 - lon1;

	// Calculate the area using the Haversine formula approximation
	const a =
		Math.sin(ΔLat / 2) * Math.sin(ΔLat / 2) +
		Math.cos(lat1) * Math.cos(lat2) * Math.sin(ΔLon / 2) * Math.sin(ΔLon / 2);

	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

	// Approximate the width and height of the bounding box in meters
	const width = R * c * Math.abs(Math.cos((lat1 + lat2) / 2));
	const height = R * c;

	// Calculate the area of the bounding box
	return width * height;
}

// thanks copilot
export function distanceBetweenPoints(
	lat1: number,
	lon1: number,
	lat2: number,
	lon2: number
): number {
	const φ1 = toRadians(lat1);
	const φ2 = toRadians(lat2);
	const Δφ = toRadians(lat2 - lat1);
	const Δλ = toRadians(lon2 - lon1);

	const a =
		Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
		Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

	return R * c; // Distance in meters
}
