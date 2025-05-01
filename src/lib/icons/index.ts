import L from 'leaflet';
import markerBlue from './marker-blue.png';
import markerError from './marker-error.png';
import markerGreen from './marker-green.png';
import markerGreenHollow from './marker-green-hollow.png';
import markerBlueHollow from './marker-blue-hollow.png';
import type { Data } from '$lib';

const makeMarker = (url: string) =>
	L.icon({
		iconUrl: url,
		iconSize: [40, 40],
		iconAnchor: [20, 38]
	});
const makeMarkerBig = (url: string) =>
	L.icon({
		iconUrl: url,
		iconSize: [60, 60],
		iconAnchor: [30, 56]
	});

export const icons = {
	markerBlue: makeMarker(markerBlue),
	markerError: makeMarker(markerError),
	markerGreen: makeMarker(markerGreen),
	markerBlueHollow: makeMarker(markerBlueHollow),
	markerGreenHollow: makeMarker(markerGreenHollow),
	big: {
		markerBlue: makeMarkerBig(markerBlue),
		markerError: makeMarkerBig(markerError),
		markerGreen: makeMarkerBig(markerGreen),
		markerBlueHollow: makeMarkerBig(markerBlueHollow),
		markerGreenHollow: makeMarkerBig(markerGreenHollow)
	},

	getIcon: (d: Data, address: number, big?: boolean) => {
		const a = d.addresses[address];
		const i = big ? icons.big : icons;
        if (a.car !== undefined) return i.markerBlueHollow;
        else if (a) return i.markerBlue;
        else return i.markerError;
	}
};
export type Icons = typeof icons;
