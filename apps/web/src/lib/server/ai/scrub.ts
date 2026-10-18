// CLAUDE.md §2 / BACKEND §11.3: no phone numbers or location history in any LLM payload.
// Tools never return them; this is the last guard on every outgoing message (incl. user text).
import type { Msg } from './providers.ts';

// Indian mobiles/landlines (+91, 0-prefixed, 10-digit, spaced/dashed) and any 8+ digit run.
const PHONE = /(?:\+?91[\s-]?)?(?:\(?0\d{2,4}\)?[\s-]?)?\d{3,5}[\s-]?\d{3,5}(?:[\s-]?\d{2,4})?/g;
// Coordinate-like decimals (lat/lng with ≥ 3 decimals), alone or as a pair.
const COORD = /-?\d{1,3}\.\d{3,}(?:\s*,\s*-?\d{1,3}\.\d{3,})?/g;

export function scrub(text: string) {
	return text
		.replace(COORD, '[location removed]')
		.replace(PHONE, (m) => (m.replace(/\D/g, '').length >= 8 ? '[number removed]' : m));
}

export const scrubMessages = (msgs: Msg[]) =>
	msgs.map((m) => ({ ...m, content: scrub(m.content) }));
