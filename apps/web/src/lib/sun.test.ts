import { expect, it } from 'vitest';
import { isNight, sunTimes } from './sun.ts';

it('Ratnagiri, 20 Oct 2026: sunrise ≈ 06:35 IST, sunset ≈ 18:15 IST (within ~10 min)', () => {
	const t = sunTimes(new Date('2026-10-20T06:00:00Z'), 73.31, 16.99)!;
	const ist = (d: Date) => (d.getUTCHours() * 60 + d.getUTCMinutes() + 330) % 1440;
	expect(Math.abs(ist(t.sunrise) - (6 * 60 + 35))).toBeLessThan(10);
	expect(Math.abs(ist(t.sunset) - (18 * 60 + 15))).toBeLessThan(10);
	expect(isNight(new Date('2026-10-20T15:30:00Z'), 73.31, 16.99)).toBe(true); // 21:00 IST
	expect(isNight(new Date('2026-10-20T06:30:00Z'), 73.31, 16.99)).toBe(false); // 12:00 IST
});
