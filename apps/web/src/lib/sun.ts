// Sunrise / sunset (NOAA approximation, ±2 min) for the "dark mode after sunset" suggestion during live
// navigation (FRONTEND §12). Pure; works offline.
const rad = Math.PI / 180;

/** UTC times of sunrise and sunset on the date of `when` at lon/lat (null in polar day/night). */
export function sunTimes(when: Date, lon: number, lat: number) {
	const start = Date.UTC(when.getUTCFullYear(), 0, 0);
	const day = Math.floor((when.getTime() - start) / 864e5);
	const g = ((2 * Math.PI) / 365) * (day - 1);
	const eqt =
		229.18 *
		(0.000075 +
			0.001868 * Math.cos(g) -
			0.032077 * Math.sin(g) -
			0.014615 * Math.cos(2 * g) -
			0.040849 * Math.sin(2 * g));
	const decl =
		0.006918 -
		0.399912 * Math.cos(g) +
		0.070257 * Math.sin(g) -
		0.006758 * Math.cos(2 * g) +
		0.000907 * Math.sin(2 * g) -
		0.002697 * Math.cos(3 * g) +
		0.00148 * Math.sin(3 * g);
	const cosH =
		Math.cos(90.833 * rad) / (Math.cos(lat * rad) * Math.cos(decl)) -
		Math.tan(lat * rad) * Math.tan(decl);
	if (cosH < -1 || cosH > 1) return null;
	const ha = Math.acos(cosH) / rad;
	const midnight = Date.UTC(when.getUTCFullYear(), when.getUTCMonth(), when.getUTCDate());
	const at = (min: number) => new Date(midnight + min * 60000);
	return { sunrise: at(720 - 4 * (lon + ha) - eqt), sunset: at(720 - 4 * (lon - ha) - eqt) };
}

export function isNight(when: Date, lon: number, lat: number) {
	const t = sunTimes(when, lon, lat);
	return !!t && (when < t.sunrise || when > t.sunset);
}
