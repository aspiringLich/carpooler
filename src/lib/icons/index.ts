import L from 'leaflet';
import markerBlue from './marker-blue.png';
import markerError from './marker-error.png';
import markerGreen from './marker-green.png';

const makeMarker = (url: string) =>
	L.icon({
		iconUrl: url,
		iconSize: [40, 40],
		iconAnchor: [20, 38]
	});

export const icons = {
	markerBlue: makeMarker(markerBlue),
	markerError: makeMarker(markerError),
	markerGreen: makeMarker(markerGreen)
};
export type Icons = typeof icons;
