import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DEFS, TABLE, TYPES, allFields, photoFileName } from './fields.ts';
import {
	check,
	codePattern,
	completeness,
	missingRequired,
	normPhone,
	normalize,
	recheckFrom,
	validate,
	validateRows
} from './validate.ts';

// Column names of a table's Row type in db.types.ts (generated from the schema).
function columns(table: string) {
	const src = readFileSync(new URL('../db.types.ts', import.meta.url), 'utf8');
	const at = src.indexOf(`"${table}": {`);
	const row = src.slice(src.indexOf('Row: {', at), src.indexOf('}', src.indexOf('Row: {', at)));
	return [...row.matchAll(/"(\w+)"\??:/g)].map((m) => m[1]!);
}
// Columns the editor sets itself or shows read-only (workflow, system, owner claim).
const SYSTEM = new Set([
	'id',
	'created_at',
	'updated_at',
	'status',
	'archived_at',
	'archived_status',
	'last_edited_by',
	'last_edited_at',
	'owner_id',
	'claimed_at',
	'location' // edited as `gps`
]);

describe('admin field definitions', () => {
	for (const t of TYPES)
		it(`cover every ${TABLE[t]} column`, () => {
			const keys = new Set(allFields(t).map((f) => f.key.split('.')[0]));
			const missing = columns(TABLE[t]).filter((c) => !SYSTEM.has(c) && !keys.has(c));
			expect(missing).toEqual([]);
		});

	it('has unique keys per type', () => {
		for (const t of TYPES) {
			const keys = allFields(t).map((f) => f.key);
			expect(new Set(keys).size).toBe(keys.length);
		}
	});

	it('marks owner phone, internal notes and source notes private', () => {
		for (const t of TYPES)
			for (const f of allFields(t))
				expect(f.private ?? false, f.key).toBe(f.key.startsWith('private.'));
	});

	it('names photos like the forms', () => {
		const p = DEFS.place.slots;
		expect(photoFileName('RTN-P-001', p[0]!, 0)).toBe('RTN-P-001_hero.jpg');
		expect(photoFileName('RTN-P-001', p[2]!, 1)).toBe('RTN-P-001_gallery02.jpg');
		expect(photoFileName('RTN-S-007', DEFS.stay.slots[1]!, 0)).toBe('RTN-S-007_room01.jpg');
		expect(photoFileName('DISH-001', DEFS.dish.slots[0]!, 0)).toBe('DISH-001_01.jpg');
		expect(photoFileName(null, p[0]!, 0)).toBeNull();
	});
});

describe('admin validation (forms)', () => {
	const ctx = { type: 'place' as const, regionPrefix: 'RTN' };

	it('IDs: <REGION>-P/S/F-### and DISH-###, region from data', () => {
		expect(codePattern(ctx).test('RTN-P-014')).toBe(true);
		expect(codePattern(ctx).test('RTN-S-014')).toBe(false);
		expect(codePattern(ctx).test('RTN-P-14')).toBe(false);
		expect(codePattern({ type: 'stay', regionPrefix: 'SND' }).test('SND-S-001')).toBe(true);
		expect(codePattern({ type: 'eatery', regionPrefix: 'RTN' }).test('RTN-F-099')).toBe(true);
		expect(codePattern({ type: 'dish' }).test('DISH-001')).toBe(true);
		expect(codePattern({ type: 'dish' }).test('DISH-1')).toBe(false);
	});

	it('GPS: real coordinates, at most 6 decimals', () => {
		const g = { kind: 'gps' as const };
		expect(check(g, { lat: 17.144512, lng: 73.266871 }, ctx)).toBeNull();
		expect(check(g, { lat: 17.1445123, lng: 73.266871 }, ctx)).toMatch(/6 digits/);
		expect(check(g, { lat: 97, lng: 73 }, ctx)).toMatch(/real/);
		expect(check(g, { lat: 17 }, ctx)).toMatch(/both/);
	});

	it('phones: 10 digits after cleaning what people type', () => {
		expect(normPhone('+91 98765 43210')).toBe('9876543210');
		expect(normPhone('09876543210')).toBe('9876543210');
		expect(normPhone('+91 2352 222333')).toBe('2352222333');
		expect(check({ kind: 'phone' }, normalize('phone', '+91 98765 43210'), ctx)).toBeNull();
		expect(check({ kind: 'phone' }, normalize('phone', '98765'), ctx)).toMatch(/10 digits/);
	});

	it('money is whole rupees, distance one decimal', () => {
		expect(check({ kind: 'money' }, 1800, ctx)).toBeNull();
		expect(check({ kind: 'money' }, 1800.5, ctx)).toMatch(/Whole rupees/);
		expect(check({ kind: 'money' }, -1, ctx)).toMatch(/At least/);
		expect(check({ kind: 'km' }, 3.5, ctx)).toBeNull();
		expect(check({ kind: 'km' }, 3.55, ctx)).toMatch(/One decimal/);
	});

	it('enums, months, multi-select limits, times and dates', () => {
		expect(check({ kind: 'enum', options: ['open', 'risky'] }, 'risky', ctx)).toBeNull();
		expect(check({ kind: 'enum', options: ['open', 'risky'] }, 'Risky', ctx)).toMatch(/listed/);
		expect(check({ kind: 'months' }, ['oct', 'nov'], ctx)).toBeNull();
		expect(check({ kind: 'months' }, ['october'], ctx)).toMatch(/listed/);
		const vibes = allFields('stay').find((f) => f.key === 'vibe_tags')!;
		expect(check(vibes, ['family', 'luxury', 'business', 'backpacker'], ctx)).toBeNull();
		expect(check(vibes, ['family', 'luxury', 'business', 'backpacker', 'beachfront'], ctx)).toMatch(
			/Max 4/
		);
		expect(check({ kind: 'time' }, '18:30', ctx)).toBeNull();
		expect(check({ kind: 'time' }, '6:30', ctx)).toMatch(/24-hour/);
		expect(check({ kind: 'date' }, '2026-10-20', ctx)).toBeNull();
		expect(check({ kind: 'date' }, '2026-02-30', ctx)).toMatch(/YYYY-MM-DD/);
	});

	it('Unknown stays null: tri-state accepts null and never turns it into false', () => {
		expect(check({ kind: 'tri' }, null, ctx)).toBeNull();
		expect(normalize('tri', null)).toBeNull();
		expect(normalize('text', '   ')).toBeNull();
		expect(check({ kind: 'tri' }, 'no', ctx)).toMatch(/Unknown/);
	});

	it('cross-field rules', () => {
		const e = validate({ type: 'stay', regionPrefix: 'RTN' }, { price_min: 2000, price_max: 1500 });
		expect(e.price_max).toMatch(/below lowest/);
		expect(
			validate(ctx, { verification_method: 'desk', source_urls: [] }).source_urls
		).toBeTruthy();
	});

	it('rows need what their table needs, max 4 signature dishes', () => {
		expect(
			validateRows('place', { hours: [{ weekday: null, opens: '06:00' }] })['hours.0.weekday']
		).toBeTruthy();
		const links = Array.from({ length: 5 }, (_, i) => ({
			dish_id: `00000000-0000-4000-8000-00000000000${i}`,
			is_signature: true
		}));
		expect(validateRows('eatery', { links }).links).toMatch(/Max 4/);
	});

	it('completeness counts required fields, photo slots and required rows', () => {
		const none = missingRequired('dish', {}, {}, {});
		expect(none.map((m) => m.key)).toEqual(
			expect.arrayContaining(['code', 'tr.en.name', 'private.source_notes', 'photos.dish', 'links'])
		);
		expect(completeness('dish', {}, none)).toBe(0);
		// Safety notes are required only for the risky categories.
		const beach = missingRequired('place', { category: 'beach' }, {}, {}).map((m) => m.key);
		const temple = missingRequired('place', { category: 'temple' }, {}, {}).map((m) => m.key);
		expect(beach).toContain('tr.en.safety_text');
		expect(temple).not.toContain('tr.en.safety_text');
	});

	it('next check: visit date + 1 month (places), + 3 months (stays, eateries)', () => {
		expect(recheckFrom('2026-10-20', 1)).toBe('2026-11-20');
		expect(recheckFrom('2026-10-20', 3)).toBe('2027-01-20');
		expect(recheckFrom('2026-01-31', 1)).toBe('2026-02-28');
		expect(DEFS.place.recheckMonths).toBe(1);
		expect(DEFS.stay.recheckMonths).toBe(3);
		expect(DEFS.eatery.recheckMonths).toBe(3);
	});
});
