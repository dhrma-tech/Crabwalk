import { track } from './track.ts';

// Hardening T1-11: Core Web Vitals from the browser's own PerformanceObserver (no library), sent once per page
// load when the page is hidden: LCP (ms), INP (worst interaction, ms) and CLS (×1000, an integer).
export function watchVitals() {
	if (typeof PerformanceObserver === 'undefined') return;
	const v = { LCP: 0, INP: 0, CLS: 0 };
	const watch = (type: string, fn: (e: PerformanceEntry) => void, opts: object = {}) => {
		try {
			new PerformanceObserver((l) => l.getEntries().forEach(fn)).observe({
				type,
				buffered: true,
				...opts
			});
		} catch {
			// entry type not supported here
		}
	};
	watch('largest-contentful-paint', (e) => (v.LCP = e.startTime));
	watch('layout-shift', (e) => {
		const s = e as PerformanceEntry & { value: number; hadRecentInput: boolean };
		if (!s.hadRecentInput) v.CLS += s.value;
	});
	watch(
		'event',
		(e) => {
			if ((e as PerformanceEntry & { interactionId?: number }).interactionId)
				v.INP = Math.max(v.INP, e.duration);
		},
		{ durationThreshold: 40 }
	);
	let sent = false;
	addEventListener('visibilitychange', () => {
		if (sent || document.visibilityState !== 'hidden') return;
		sent = true;
		track('web_vital', {
			lcp: Math.round(v.LCP),
			inp: Math.round(v.INP),
			cls: Math.round(v.CLS * 1000)
		});
	});
}
