import { createSubscriber, MediaQuery } from 'svelte/reactivity';

// Motion preferences (hardening T1-01, brief section 4.1–4.2). Every script-driven duration goes through `dur()`.

type Nav = Navigator & {
	connection?: EventTarget & { saveData?: boolean };
	deviceMemory?: number;
};
const nav = () => (typeof navigator === 'undefined' ? undefined : (navigator as Nav));

export const reducedMotion = new MediaQuery('(prefers-reduced-motion: reduce)', false);

const onConnection = createSubscriber((update) => {
	const c = nav()?.connection;
	c?.addEventListener('change', update);
	return () => c?.removeEventListener('change', update);
});

/** The viewer asked to save data (Chromium `Save-Data`); reactive to connection changes. */
export const dataSaver = {
	get current() {
		onConnection();
		return !!nav()?.connection?.saveData;
	}
};

/** Small phones: ≤ 2 GB memory or ≤ 4 cores. Unknown values count as capable. */
export const lowEnd = () => {
	const n = nav();
	return (n?.deviceMemory ?? 8) <= 2 || (n?.hardwareConcurrency ?? 8) <= 4;
};

/** Duration in ms, or 0 when the viewer prefers reduced motion. */
export const dur = (ms: number) => (reducedMotion.current ? 0 : ms);
