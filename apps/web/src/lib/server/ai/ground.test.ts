import { describe, expect, it } from 'vitest';
import { ground, type Explanation } from './ground.ts';

const results = [
	{
		tool: 'search_places',
		result: [
			{ slug: 'jaigad-fort', name: 'Jaigad Fort', category: 'fort' },
			{ slug: 'ganpatipule-beach', name: 'Ganpatipule Beach', category: 'beach' }
		]
	},
	{
		tool: 'get_place',
		result: {
			found: true,
			slug: 'jaigad-fort',
			name: 'Jaigad Fort',
			hours_today: '09:00–17:30',
			entry_fee_inr: 25,
			rating: 'Worth it (62% of 40 votes)',
			last_verified: '2026-10-20'
		}
	},
	{
		tool: 'search_stays',
		result: [{ slug: 'sea-breeze', name: 'Sea Breeze Homestay', price_min: 1800, km: 3.5 }]
	}
];
const devanagari = [
	{
		tool: 'get_place',
		result: {
			slug: 'jaigad-fort',
			name: 'जयगड किल्ला',
			hours_today: '09:00–17:30',
			entry_fee_inr: 25
		}
	}
];
const reply = (text: string, more: Partial<Explanation> = {}) =>
	JSON.stringify({
		text,
		cites: [
			{ kind: 'place', slug: 'jaigad-fort' },
			{ kind: 'stay', slug: 'sea-breeze' }
		],
		facts: [{ value: '09:00–17:30', tool: 1 }],
		confidence: 'answered',
		...more
	});
const errors = (raw: string, r: unknown = results) => {
	const g = ground(raw, r);
	return g.ok ? [] : g.errors;
};

describe('ground (T2-03, AI Spec 5.4)', () => {
	it('a reply that quotes only tool values passes (en, hi, mr)', () => {
		expect(
			errors(
				reply(
					'Jaigad Fort is open 9 am to 5:30 pm today (09:00–17:30), entry ₹25, 62% say Worth it (checked 2026-10-20). Sea Breeze Homestay is 3.5 km away from Rs. 1,800.'
				)
			)
		).toEqual([]);
		const one = { cites: [{ kind: 'place' as const, slug: 'jaigad-fort' }], facts: [] };
		expect(
			errors(reply('जयगड किल्ला आज ०९:०० से १७:३० तक खुला है। प्रवेश शुल्क ₹२५।', one), devanagari)
		).toEqual([]);
		expect(
			errors(reply('जयगड किल्ला आज ९:०० ते १७:३० उघडा आहे. प्रवेश शुल्क ₹ २५.', one), devanagari)
		).toEqual([]);
	});

	it('a fabricated time fails', () => {
		expect(errors(reply('Jaigad Fort opens at 10:30 today.'))).toEqual([
			'time "10:30" is not in the tool results'
		]);
		expect(errors(reply('Jaigad Fort closes at 6 pm.'))[0]).toMatch(/^time "6 pm"/);
	});
	it('a fabricated price fails', () => {
		expect(errors(reply('Entry to Jaigad Fort is ₹50.'))).toEqual([
			'price "50" is not in the tool results'
		]);
	});
	it('a fabricated distance fails', () => {
		expect(errors(reply('Sea Breeze Homestay is 7 km from Jaigad Fort.'))).toEqual([
			'distance "7" is not in the tool results'
		]);
	});
	it('a fabricated place fails, and a named listing must be cited', () => {
		expect(
			errors(reply('Try Murud Beach.', { cites: [{ kind: 'place', slug: 'murud-beach' }] }))
		).toEqual(['cite "murud-beach" is not in the tool results']);
		expect(errors(reply('Ganpatipule Beach is lovely.'))).toEqual([
			'"Ganpatipule Beach" is mentioned, so cite slug "ganpatipule-beach"'
		]);
	});
	it('no links, emails or phone numbers; unknown claims nothing', () => {
		expect(errors(reply('See https://x.test or mail a@b.in or call 9822012345.'))).toEqual([
			'no links in the text',
			'no email addresses in the text',
			'no long numbers in the text'
		]);
		expect(errors(reply("I don't know.", { confidence: 'unknown' }))).toEqual([
			'confidence "unknown" must have no cites and no facts'
		]);
		expect(errors(reply("I don't know.", { confidence: 'unknown', cites: [], facts: [] }))).toEqual(
			[]
		);
	});
	it('broken JSON and schema violations are errors for the retry', () => {
		expect(errors('{"text": "hi"')).toEqual(['the reply was not valid JSON']);
		expect(errors(JSON.stringify({ text: 'hi', cites: [], facts: [] }))[0]).toMatch(/^confidence/);
		expect(errors(reply('x', { cites: [{ kind: 'place', slug: 'Bad Slug' }] }))[0]).toMatch(
			/^cites\.0\.slug/
		);
	});
});
