import { afterEach, describe, expect, it, vi } from 'vitest';

const reduce = vi.hoisted(() => ({ on: false }));
vi.mock('svelte/reactivity', () => ({
	MediaQuery: class {
		get current() {
			return reduce.on;
		}
	},
	createSubscriber: () => () => {}
}));
const { dataSaver, dur, lowEnd } = await import('./motion.ts');

afterEach(() => {
	reduce.on = false;
	vi.unstubAllGlobals();
});

describe('motion', () => {
	it('dur() passes durations through, or 0 under reduced motion', () => {
		expect(dur(260)).toBe(260);
		reduce.on = true;
		expect(dur(260)).toBe(0);
	});

	it('lowEnd: ≤ 2 GB or ≤ 4 cores; unknown values count as capable', () => {
		vi.stubGlobal('navigator', {});
		expect(lowEnd()).toBe(false);
		vi.stubGlobal('navigator', { deviceMemory: 2, hardwareConcurrency: 8 });
		expect(lowEnd()).toBe(true);
		vi.stubGlobal('navigator', { deviceMemory: 4, hardwareConcurrency: 4 });
		expect(lowEnd()).toBe(true);
		vi.stubGlobal('navigator', { deviceMemory: 4, hardwareConcurrency: 8 });
		expect(lowEnd()).toBe(false);
	});

	it('dataSaver follows navigator.connection.saveData', () => {
		vi.stubGlobal('navigator', {});
		expect(dataSaver.current).toBe(false);
		vi.stubGlobal('navigator', { connection: { saveData: true } });
		expect(dataSaver.current).toBe(true);
	});
});
