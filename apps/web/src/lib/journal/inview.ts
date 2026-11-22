import { reducedMotion } from '#lib/motion.ts';

// Lazy start for section motion (brief §9): the node gets `data-in` the first time it is about to enter the
// viewport, and `onenter` runs once. Under reduced motion it is marked at once, so CSS shows the final state.
export function inview(
	node: HTMLElement | SVGElement,
	opts: { margin?: string; threshold?: number; onenter?: () => void } = {}
) {
	const enter = () => {
		node.setAttribute('data-in', '');
		opts.onenter?.();
	};
	if (reducedMotion.current || typeof IntersectionObserver === 'undefined') {
		enter();
		return;
	}
	const io = new IntersectionObserver(
		(entries) => {
			if (entries.some((e) => e.isIntersecting)) {
				io.disconnect();
				enter();
			}
		},
		{ rootMargin: opts.margin ?? '0px 0px -15% 0px', threshold: opts.threshold ?? 0 }
	);
	io.observe(node);
	return () => io.disconnect();
}

/** Whether a node is on screen, kept up to date (for pausing loops). */
export function visible(node: Element, cb: (on: boolean) => void) {
	if (typeof IntersectionObserver === 'undefined') return cb(true);
	const io = new IntersectionObserver((e) => cb(e.some((x) => x.isIntersecting)));
	io.observe(node);
	return () => io.disconnect();
}
