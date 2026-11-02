import { describe, expect, it } from 'vitest';
import { creditComplete, licenceUrl, LICENCES } from './photoCredit.ts';
import { creditInput } from './server/photoCredit.ts';

describe('photo credit (T-51)', () => {
	it('links every allowed licence to its Creative Commons deed', () => {
		expect(licenceUrl('CC BY-SA 4.0')).toBe('https://creativecommons.org/licenses/by-sa/4.0/');
		expect(licenceUrl('CC BY 2.0')).toBe('https://creativecommons.org/licenses/by/2.0/');
		for (const l of LICENCES)
			expect(licenceUrl(l)).toMatch(
				/^https:\/\/creativecommons\.org\/licenses\/by(-sa)?\/\d\.\d\/$/
			);
	});

	it('empty = our own photo; all three = a licensed photo', () => {
		expect(creditInput.parse({})).toEqual({ credit: null, licence: null, source_url: null });
		expect(
			creditInput.parse({
				credit: ' A. Photographer ',
				licence: 'CC BY 4.0',
				source_url: 'https://commons.wikimedia.org/wiki/File:X.jpg'
			})
		).toEqual({
			credit: 'A. Photographer',
			licence: 'CC BY 4.0',
			source_url: 'https://commons.wikimedia.org/wiki/File:X.jpg'
		});
	});

	const bad = [
		[{ credit: 'Someone', licence: '', source_url: '' }, 'author only'],
		[{ credit: 'Someone', licence: 'CC BY 4.0', source_url: '' }, 'no source'],
		[
			{ credit: 'Someone', licence: 'CC BY-NC 4.0', source_url: 'https://x.org/p' },
			'non-commercial'
		],
		[
			{ credit: 'Someone', licence: 'All rights reserved', source_url: 'https://x.org/p' },
			'not open'
		],
		[{ credit: 'Someone', licence: 'CC BY 4.0', source_url: 'http://x.org/p' }, 'http source']
	] as const;

	it.each(bad)('the server refuses %o (%s)', (input, why) => {
		expect(creditInput.safeParse(input).success, why).toBe(false);
	});

	it.each(bad)('the field form check refuses %o (%s)', (input, why) => {
		expect(creditComplete(input), why).toBe(false);
	});

	it('the field form check accepts a full credit', () => {
		expect(
			creditComplete({ credit: 'A', licence: 'CC BY-SA 3.0', source_url: 'https://x.org/p' })
		).toBe(true);
	});
});
