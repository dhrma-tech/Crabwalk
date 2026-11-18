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
const { booted, dataSaver, dur, fadeIn, lowEnd } = await import('./motion.ts');

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

	it('fadeIn: a loaded image is left alone; an unloaded one fades in on load; lcp waits for hydration', () => {
		const img = (complete: boolean) =>
			Object.assign(new EventTarget(), { complete, style: { opacity: '' }, animate: vi.fn() });
		const as = (i: ReturnType<typeof img>) => i as unknown as HTMLImageElement;

		const cached = img(true);
		fadeIn()(as(cached));
		expect(cached.style.opacity).toBe('');

		const first = img(false);
		fadeIn(true)(as(first)); // before hydration: the LCP image never starts hidden
		expect(first.style.opacity).toBe('');

		const late = img(false);
		fadeIn()(as(late));
		expect(late.style.opacity).toBe('0');
		late.dispatchEvent(new Event('load'));
		expect(late.style.opacity).toBe('');
		expect(late.animate).toHaveBeenCalledWith(
			{ opacity: [0, 1] },
			expect.objectContaining({ duration: 200 })
		);

		booted();
		const hero = img(false);
		fadeIn(true)(as(hero));
		expect(hero.style.opacity).toBe('0');
	});
});
