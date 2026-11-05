import { describe, expect, it } from 'vitest';
import { flagOf, hoursOf, osmKey, placeSchema, reason, softChecks, sourceUrls } from './desk-schema.ts';

const ctx = { categories: ['beach', 'fort'], talukas: new Map([['ratnagiri', 't1']]) };
const blank = { short_story: null, history: null, significance: null, dos: null, donts: null, safety_text: null };
const good = {
	slug: 'bhatye-beach', status: 'ai_draft', name_en: 'Bhatye Beach', name_mr: 'भाट्ये समुद्रकिनारा', name_hi: null,
	category: 'beach', taluka: 'Ratnagiri', lat: null, lng: null, coord_source: null, osm_id: null,
	entry_fee_text: null, entry_fee_inr: null, visit_minutes: null, opens: null, closes: null, closed_days: [],
	best_time: null, how_to_reach: null, nearest_station: null, nearest_bus_stop: null, monsoon_status: 'open',
	monsoon_reason: null, is_tide_dependent: false, seasons: [], wikipedia_url: null, is_hidden_gem: false,
	text: { en: { ...blank, short_story: 'A beach.' }, mr: blank, hi: blank },
	photo: {}, _sources: { _all: ['https://example.org/a'] }, _review: null, _collected_by: 'test'
};
const check = (r: object) => {
	const p = placeSchema(ctx).safeParse(r);
	return p.success ? 'ok' : reason(p.error);
};

describe('place yaml', () => {
	it('accepts a row without a pin and maps the taluka to its id', () => {
		expect(check(good)).toBe('ok');
		expect(placeSchema(ctx).parse(good).taluka).toBe('t1');
	});
	it('refuses what the importer must not guess or set', () => {
		expect(check({ ...good, is_hidden_gem: true })).toMatch(/is_hidden_gem/);
		expect(check({ ...good, lat: 17 })).toMatch(/lng/);
		expect(check({ ...good, monsoon_status: 'risky' })).toMatch(/monsoon_reason/);
		expect(check({ ...good, _sources: {} })).toMatch(/_sources/);
		expect(check({ ...good, _sources: { _all: ['http://example.org'] } })).toMatch(/_sources/);
		expect(check({ ...good, extra_key: 1 })).toMatch(/extra_key/);
		expect(check({ ...good, taluka: 'Atlantis' })).toMatch(/unknown taluka/);
	});
});

describe('helpers', () => {
	it('hours: one pair every day except closed days; none without times', () => {
		const h = hoursOf({ opens: '06:00', closes: '20:00', closed_days: ['tue'] });
		expect(h).toHaveLength(7);
		expect(h[2]).toEqual({ weekday: 2, opens: null, closes: null });
		expect(h[0]).toEqual({ weekday: 0, opens: '06:00', closes: '20:00' });
		expect(hoursOf({ opens: null, closes: null, closed_days: [] })).toEqual([]);
	});
	it('OSM ids: ways negative, nodes positive', () => {
		expect(osmKey('way/991390198')).toBe(-991390198);
		expect(osmKey('node/7226642305')).toBe(7226642305);
	});
	it('flags and soft checks', () => {
		expect(flagOf('batch P-F: LOW TRUST, check')).toBe('LOW TRUST');
		expect(flagOf('CHECK the cave name')).toBe('CHECK');
		expect(flagOf('needs team review')).toBeNull();
		expect(softChecks({ mr: ['Bhatye'], hi: ['भाट्ये'], long: ['Call +91 98200 12345'] })).toEqual([
			'Marathi text without Devanagari',
			'phone number or email inside long text'
		]);
		expect(sourceUrls({ a: ['https://x'], b: ['https://x', 'https://y'] })).toEqual(['https://x', 'https://y']);
	});
});
