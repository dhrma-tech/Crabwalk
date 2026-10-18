// DECISIONS P9-2: OSRM maneuvers → compact turn cues on the simplified route line, e.g. "14L,52SR,80O2".
// Code = vertex index (in the stored, simplified shape) + direction. Decoded by apps/web/src/lib/nav/turns.ts.
// Straight-on / name changes / depart / arrive are dropped; no street names are stored.
export type Maneuver = { type: string; modifier?: string; location: [number, number]; exit?: number };

const MOD: Record<string, string> = {
	left: 'L', right: 'R', 'slight left': 'SL', 'slight right': 'SR', 'sharp left': 'HL', 'sharp right': 'HR', uturn: 'U'
};

export function encodeTurns(line: [number, number][], maneuvers: Maneuver[]): string | null {
	const lat0 = ((line[0]?.[1] ?? 0) * Math.PI) / 180;
	const d2 = (a: [number, number], b: [number, number]) =>
		((a[0] - b[0]) * Math.cos(lat0)) ** 2 + (a[1] - b[1]) ** 2;
	const out: string[] = [];
	let from = 0;
	for (const m of maneuvers) {
		if (m.type === 'depart' || m.type === 'arrive' || m.type === 'new name') continue;
		const round = m.type === 'roundabout' || m.type === 'rotary' || m.type === 'roundabout turn';
		const code = round ? `O${m.exit ?? ''}` : MOD[m.modifier ?? ''];
		if (!code) continue; // straight / unknown
		// Nearest vertex at or after the previous cue keeps cues in route order.
		let best = from;
		for (let i = from; i < line.length; i++) if (d2(line[i]!, m.location) < d2(line[best]!, m.location)) best = i;
		out.push(`${best}${code}`);
		from = best;
	}
	return out.length ? out.join(',') : null;
}
