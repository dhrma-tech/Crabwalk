import { describe, expect, it } from 'vitest';
import { dayLinks, fromShared } from './trips.ts';

const a = { lon: 73.3, lat: 17 };
const b = { lon: 73.31, lat: 17.01 };
const c = { lon: 73.32, lat: 17.02 };

describe('plan day links (SEC-17: shared trips carry no start point)', () => {
	it('with a start point, day 1 starts there and day 2 at the last stop of day 1', () => {
		const [d1, d2] = dayLinks(a, [{ pts: [b] }, { pts: [c] }]);
		expect(d1![0]).toContain('origin=17.00000%2C73.30000');
		expect(d2![0]).toContain('origin=17.01000%2C73.31000');
	});
	it('without one, day 1 starts at its first stop', () => {
		const [d1, d2] = dayLinks(null, [{ pts: [b, c] }, { pts: [a] }]);
		expect(d1![0]).toContain('origin=17.01000%2C73.31000');
		expect(d2![0]).toContain('origin=17.02000%2C73.32000');
		expect(dayLinks(null, [{ pts: [b] }])).toEqual([[]]); // one stop, nothing to route
	});
	it('a shared trip keeps the start label and nothing else of the start point', () => {
		const t = fromShared({
			id: 'x',
			title: 'T',
			days: 1,
			pace: 'balanced',
			start_date: null,
			status: 'draft',
			group_type: 'family',
			start_label: 'Ratnagiri station'
		});
		expect(t.start_point).toEqual({ label: 'Ratnagiri station' });
	});
});
