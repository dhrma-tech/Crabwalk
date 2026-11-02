import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseCsv, records } from './csv.ts';
import { COLUMNS, hoursOf, reason, rowSchema } from './schema.ts';

describe('csv', () => {
	it('reads quoted commas, newlines, doubled quotes, CRLF and a BOM', () => {
		const text = '﻿a,b,c\r\n1,"two, 2","say ""hi""\nthen go"\r\n\r\n';
		expect(parseCsv(text)).toEqual([
			['a', 'b', 'c'],
			['1', 'two, 2', 'say "hi"\nthen go']
		]);
		expect(records(text)).toEqual([{ line: 2, data: { a: '1', b: 'two, 2', c: 'say "hi"\nthen go' } }]);
	});

	it('the template is exactly the expected header', () => {
		const t = readFileSync(join(import.meta.dirname, 'template.csv'), 'utf8');
		expect(parseCsv(t)).toEqual([[...COLUMNS]]);
	});
});

describe('row schema', () => {
	const schema = rowSchema({
		categories: ['beach', 'fort'],
		talukas: new Map([['ratnagiri', '00000000-0000-0000-0000-000000000001']])
	});
	const good: Record<string, string> = {
		...Object.fromEntries(COLUMNS.map((c) => [c, ''])),
		slug: 'bhatye-beach',
		name_en: 'Bhatye Beach',
		category: 'beach',
		taluka: 'Ratnagiri',
		lat: '16.97',
		lng: '73.29',
		opens: '9:00',
		closes: '18:00',
		closed_days: 'Tue, wed',
		is_tide_dependent: 'Yes',
		source_urls: 'https://example.org/a; https://example.org/b'
	};

	it('accepts a full row and normalises it', () => {
		const r = schema.parse(good);
		expect(r.taluka).toBe('00000000-0000-0000-0000-000000000001');
		expect(r.opens).toBe('09:00');
		expect(r.is_tide_dependent).toBe(true);
		expect(r.is_hidden_gem).toBe(false);
		expect(r.monsoon_status).toBe('open');
		expect(r.source_urls).toEqual(['https://example.org/a', 'https://example.org/b']);
		expect(r.name_mr).toBeNull();
		const h = hoursOf(r);
		expect(h).toHaveLength(7);
		expect(h.find((x) => x.weekday === 2)).toEqual({ weekday: 2, opens: null, closes: null });
		expect(h.find((x) => x.weekday === 1)).toEqual({ weekday: 1, opens: '09:00', closes: '18:00' });
	});

	it('no times → no hours rows', () => {
		expect(hoursOf(schema.parse({ ...good, opens: '', closes: '', closed_days: '' }))).toEqual([]);
	});

	it.each([
		[{ slug: 'Bhatye Beach' }, 'slug'],
		[{ category: 'mall' }, 'category: unknown category'],
		[{ taluka: 'Mumbai' }, 'taluka: unknown taluka'],
		[{ lat: '' }, 'lat: required'],
		[{ lng: 'east' }, 'lng'],
		[{ closes: '' }, 'closes: give both opens and closes'],
		[{ closed_days: 'someday' }, 'closed_days'],
		[{ is_hidden_gem: 'maybe' }, 'is_hidden_gem: yes or no'],
		[{ monsoon_status: 'wet' }, 'monsoon_status'],
		[{ source_urls: '' }, 'source_urls'],
		[{ source_urls: 'http://example.org' }, 'source_urls'],
		[{ entry_fee_inr: '20.5' }, 'entry_fee_inr: whole number']
	])('rejects %o', (patch, why) => {
		const p = schema.safeParse({ ...good, ...patch });
		expect(p.success).toBe(false);
		if (!p.success) expect(reason(p.error)).toContain(why);
	});
});
