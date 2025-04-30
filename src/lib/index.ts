// place files you want to import through the `$lib` alias in this folder.

export class Data {
	parents: Record<string, { data: { [key: string]: string }; children: string[]; address: number }>;
	children: Record<string, { data: { [key: string]: string }; parents: string[]; address: number }>;
	cars: { parents: string[]; address: number; capacity: number }[];
	addresses: { x: number; y: number; name: string }[];

	constructor() {
		this.parents = {};
		this.children = {};
		this.cars = [];
		this.addresses = [];
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

				parent_names.push(name);
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

				child_names.push(name);
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
			if (row[passenger_capacity_idx] !== '') {
				const capacity = Number.parseInt(row[passenger_capacity_idx]);
				d.cars.push({
					parents: parent_names,
					address: i,
					capacity
				});
			}

			// process addresses
			if (row[address_idx] === '') logThrow(`!Address for row ${i + 2} is blank!`);
			d.addresses.push({
				x: NaN,
				y: NaN,
				name: row[address_idx]
			});
		}

		console.log(d);
		return d;
	}
}

// thanks copilot
export function areaOfBounds(bounds: [[number, number], [number, number]]): number {
	const [southWest, northEast] = bounds;

	// Convert latitude and longitude from degrees to radians
	const toRadians = (deg: number) => (deg * Math.PI) / 180;

	const lat1 = toRadians(southWest[0]);
	const lon1 = toRadians(southWest[1]);
	const lat2 = toRadians(northEast[0]);
	const lon2 = toRadians(northEast[1]);

	// Earth's radius in meters
	const R = 6371000;

	// Calculate the differences
	const dLat = lat2 - lat1;
	const dLon = lon2 - lon1;

	// Calculate the area using the Haversine formula approximation
	const a =
		Math.sin(dLat / 2) * Math.sin(dLat / 2) +
		Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

	// Approximate the width and height of the bounding box in meters
	const width = R * c * Math.abs(Math.cos((lat1 + lat2) / 2));
	const height = R * c;

	// Calculate the area of the bounding box
	return width * height;
}
