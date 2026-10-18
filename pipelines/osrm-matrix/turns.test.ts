import { describe, expect, it } from 'vitest';
import { encodeTurns } from './turns.ts';

describe('encodeTurns (P9-2)', () => {
	const line: [number, number][] = [[73, 17], [73.01, 17], [73.01, 17.01], [73.02, 17.01], [73.02, 17.02]];
	it('maps maneuvers to the nearest simplified vertex, in order, without names', () => {
		const t = encodeTurns(line, [
			{ type: 'depart', location: [73, 17] },
			{ type: 'turn', modifier: 'left', location: [73.0101, 17.0001] },
			{ type: 'new name', modifier: 'straight', location: [73.01, 17.005] },
			{ type: 'turn', modifier: 'slight right', location: [73.01, 17.0099] },
			{ type: 'roundabout', modifier: 'right', exit: 2, location: [73.0201, 17.01] },
			{ type: 'continue', modifier: 'straight', location: [73.02, 17.015] },
			{ type: 'arrive', location: [73.02, 17.02] }
		]);
		expect(t).toBe('1L,2SR,3O2');
	});
	it('null when there is nothing to announce', () => {
		expect(encodeTurns(line, [{ type: 'depart', location: [73, 17] }, { type: 'arrive', location: [73.02, 17.02] }])).toBeNull();
	});
});
