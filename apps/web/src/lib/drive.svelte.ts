// Runs Crabby's steps in the browser (P12 §3, product plan 10.11), visibly: a status line ("Crabby: opening
// Stays"), a ring on the element Crabby taps, and a Stop button. Navigation goes through goto — the same URL the
// link or filter form produces; on-page actions (the trip workspace's sections) run the function the page's own
// buttons use, registered with onDrive.
import { goto } from '$app/navigation';
import { hrefOf, targetOf, type DriveStep } from './drive.ts';

export const driver = $state({
	/** What Crabby is doing now (status line); empty when idle. */
	status: '',
	/** Ring around the element being tapped, in viewport coordinates. */
	ring: null as { x: number; y: number; w: number; h: number } | null
});

type Handler = (s: DriveStep) => void | Promise<void>;
const handlers = new Map<DriveStep['action'], Handler>();
/** A page offers an on-page action (e.g. the plan workspace's switchTab); returns the unregister function. */
export function onDrive(action: DriveStep['action'], fn: Handler) {
	handlers.set(action, fn);
	return () => {
		if (handlers.get(action) === fn) handlers.delete(action);
	};
}

let run = 0;
const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Run steps one by one; a newer run or Stop cancels the rest. `label` gives the status line text. */
export async function drive(steps: DriveStep[], label: (s: DriveStep) => string) {
	const id = ++run;
	for (const s of steps) {
		if (id !== run) return;
		driver.status = label(s);
		// The top bar and the phone nav both carry nav links; ring the one on screen.
		const el = [...document.querySelectorAll<HTMLElement>(targetOf(s))].find(
			(e) => e.getClientRects().length
		);
		if (el) {
			el.scrollIntoView({ block: 'nearest', behavior: reduced() ? 'auto' : 'smooth' });
			const r = el.getBoundingClientRect();
			driver.ring = { x: r.left, y: r.top, w: r.width, h: r.height };
		}
		await pause(reduced() ? 250 : 700);
		if (id !== run) return;
		driver.ring = null;
		const own = handlers.get(s.action);
		const href = hrefOf(s);
		if (own) await own(s);
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- allowlisted routes from drive.ts
		else if (href) await goto(href);
		await pause(200);
	}
	if (id === run) driver.status = '';
}

/** Stop button: cancel whatever Crabby is still doing. */
export function stopDriving() {
	run++;
	driver.status = '';
	driver.ring = null;
}
