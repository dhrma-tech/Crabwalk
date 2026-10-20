import { describe, expect, it } from 'vitest';
import { isPrivatePath } from './seo.ts';

describe('isPrivatePath (robots.txt + X-Robots-Tag)', () => {
	it('covers staff, personal, token and utility pages', () => {
		for (const p of [
			'/admin',
			'/admin/qr',
			'/owner/claim/stay/1',
			'/api/places',
			'/plan/new',
			'/plan/share/x',
			'/trip/live/1',
			'/me',
			'/login',
			'/q/ABC123',
			'/crabby',
			'/navigate'
		])
			expect(isPrivatePath(p), p).toBe(true);
	});

	it('leaves public pages indexable', () => {
		for (const p of [
			'/',
			'/place/ganpatipule',
			'/stays',
			'/food/konkan-tadka',
			'/map',
			'/itineraries',
			'/start',
			'/privacy',
			'/media',
			'/mega-plan'
		])
			expect(isPrivatePath(p), p).toBe(false);
	});
});
