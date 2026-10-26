import { describe, expect, it } from 'vitest';
import {
	conditionKey,
	nearest,
	nextLow,
	pickToday,
	type TideStation,
	type WeatherPoint
} from './today.ts';

const pt = (id: string, lon: number, lat: number): WeatherPoint => ({
	id,
	name: id,
	lon,
	lat,
	temp_c: 29,
	condition: 'Rain',
	observed_at: '2026-10-26T05:00:00Z'
});
const st = (name: string, lon: number, lat: number): TideStation => ({
	name,
	lon,
	lat,
	low: { time: '2026-10-26T10:00:00Z', height_m: 0.6 },
	provider: 'tidecheck'
});

describe('today strip', () => {
	it('nearest picks the closest point', () => {
		expect(nearest([pt('a', 73.0, 17.0), pt('b', 73.3, 16.99)], 73.29, 17.0)?.id).toBe('b');
		expect(nearest([], 73, 17)).toBeUndefined();
	});

	it('nextLow skips past and high extremes, crosses into tomorrow', () => {
		const now = Date.parse('2026-10-26T12:00:00Z');
		const ex = [
			{ type: 'low', time: '2026-10-26T06:00:00Z', height_m: 0.5 },
			{ type: 'high', time: '2026-10-26T13:00:00Z', height_m: 2.1 },
			{ type: 'low', time: '2026-10-27T06:40:00Z', height_m: 0.4 }
		];
		expect(nextLow(ex, now)).toEqual({ time: '2026-10-27T06:40:00Z', height_m: 0.4 });
		expect(nextLow(ex.slice(0, 2), now)).toBeNull();
	});

	it('pickToday uses the region default, then the visitor position', () => {
		const data = {
			points: [pt('north', 73.1, 17.8), pt('south', 73.5, 16.6)],
			stations: [st('N', 73.1, 17.7), st('S', 73.4, 16.6)],
			defaultPoint: { id: 'north', lon: 73.1, lat: 17.8 }
		};
		expect(pickToday(data, null)).toMatchObject({ weather: { id: 'north' }, tide: { name: 'N' } });
		expect(pickToday(data, { lon: 73.45, lat: 16.62 })).toMatchObject({
			weather: { id: 'south' },
			tide: { name: 'S' }
		});
	});

	it('hides stale weather but still shows the tide near the default point', () => {
		const data = {
			points: [],
			stations: [st('N', 73.1, 17.7), st('S', 73.4, 16.6)],
			defaultPoint: { id: 'north', lon: 73.1, lat: 17.8 }
		};
		expect(pickToday(data, null)).toMatchObject({ weather: null, tide: { name: 'N' } });
		expect(pickToday({ ...data, defaultPoint: null }, null)).toEqual({ weather: null, tide: null });
		expect(pickToday(data, { lon: 73.4, lat: 16.6 })).toMatchObject({
			weather: null,
			tide: { name: 'S' }
		});
	});

	it('maps OWM conditions to message keys, unknown → null', () => {
		expect(conditionKey('Thunderstorm')).toBe('wx_storm');
		expect(conditionKey('Fog')).toBe('wx_haze');
		expect(conditionKey('Tornado')).toBeNull();
		expect(conditionKey(null)).toBeNull();
	});
});
