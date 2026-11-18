<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Spring } from 'svelte/motion';
	import { m } from '#lib/paraglide/messages.js';
	import { reducedMotion } from '#lib/motion.ts';

	export type Snap = 'peek' | 'half' | 'full';

	// Report 2 §8: surface sheet, 28 px top corners, e3, 36×4 handle; peek (132 px) → half → full. Drag the
	// handle, or tap it to cycle (keyboard too). Sits above the phone nav and left of the docked Crabby.
	// `column` (plan workspace, P11): from `lg` up it is a plain full-height scrolling column instead.
	// Brief section 4.5 (T1-03): the sheet is laid out once at full height inside a clipping frame (top bar →
	// phone nav) and moved with `transform` only; the visible height is `--sheet-h`. Drag sets it directly;
	// release springs (`snappy`) to the nearest snap, or to the next one when flicked faster than 0.5 px/ms.
	let {
		snap = $bindable<Snap>('peek'),
		column = false,
		children
	}: { snap?: Snap; column?: boolean; children: Snippet } = $props();

	const order: Snap[] = ['peek', 'half', 'full'];
	let innerHeight = $state(800);
	let fullH = $state(0);
	const heightOf = (s: Snap) =>
		s === 'peek' ? 132 : s === 'half' ? innerHeight * 0.5 : fullH || innerHeight * 0.85;

	const h = new Spring(heightOf(snap), { stiffness: 0.25, damping: 0.7 });
	let drag = $state.raw<{
		startY: number;
		startH: number;
		moved: boolean;
		y: number;
		t: number;
		v: number;
	} | null>(null);
	let placed = false;
	$effect(() => {
		const target = heightOf(snap);
		if (drag) return;
		h.set(target, { instant: !placed || reducedMotion.current });
		placed = true;
	});

	function down(e: PointerEvent) {
		drag = {
			startY: e.clientY,
			startH: h.current,
			moved: false,
			y: e.clientY,
			t: e.timeStamp,
			v: 0
		};
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
	}
	function move(e: PointerEvent) {
		if (!drag) return;
		const dy = drag.startY - e.clientY;
		if (Math.abs(dy) > 4) drag.moved = true;
		if (e.timeStamp > drag.t) drag.v = (drag.y - e.clientY) / (e.timeStamp - drag.t); // up = positive
		drag.y = e.clientY;
		drag.t = e.timeStamp;
		h.set(Math.max(80, Math.min(heightOf('full'), drag.startH + dy)), { instant: true });
	}
	function up(e: PointerEvent) {
		if (!drag) return;
		const at = h.current;
		const v = e.timeStamp - drag.t > 100 ? 0 : drag.v; // held still before letting go
		if (!drag.moved) snap = order[(order.indexOf(snap) + 1) % order.length];
		else if (Math.abs(v) > 0.5)
			snap =
				(v > 0
					? order.find((s) => heightOf(s) > at + 1)
					: order.findLast((s) => heightOf(s) < at - 1)) ?? (v > 0 ? 'full' : 'peek');
		else
			snap = order.reduce((best, s) =>
				Math.abs(heightOf(s) - at) < Math.abs(heightOf(best) - at) ? s : best
			);
		drag = null;
	}
	// Keyboard (Enter / Space) fires a click with no pointer events: cycle like a tap.
	function key(e: MouseEvent) {
		if (e.detail === 0) snap = order[(order.indexOf(snap) + 1) % order.length];
	}
</script>

<svelte:window bind:innerHeight />

<div
	bind:clientHeight={fullH}
	class={[
		'pointer-events-none fixed inset-x-0 top-(--bar-h) bottom-(--nav-h) z-panel overflow-hidden lg:bottom-0 lg:[:root:has([data-dock])_&]:right-(--dock-w)',
		column &&
			'lg:pointer-events-auto lg:static lg:z-auto lg:h-full lg:w-140 lg:shrink-0 lg:overflow-visible print:static print:overflow-visible'
	]}
>
	<section
		class={[
			'pointer-events-auto flex h-full flex-col rounded-t-xl bg-surface shadow-e3 [transform:translateY(calc(100%-var(--sheet-h)))]',
			column &&
				'lg:rounded-none lg:bg-bg lg:shadow-none lg:[transform:none] print:h-auto print:[transform:none] print:shadow-none'
		]}
		style:--sheet-h="{h.current}px"
	>
		<button
			type="button"
			class={[
				'flex h-11 w-full shrink-0 touch-none items-center justify-center rounded-t-xl',
				column && 'lg:hidden print:hidden'
			]}
			aria-label={m.sheet_handle()}
			aria-expanded={snap !== 'peek'}
			onpointerdown={down}
			onpointermove={move}
			onpointerup={up}
			onpointercancel={up}
			onclick={key}
		>
			<span class="h-1 w-9 rounded-full bg-border-strong" aria-hidden="true"></span>
		</button>
		<div
			class={[
				'min-h-0 flex-1 px-5 pb-4 lg:px-8 print:overflow-visible',
				snap === 'full' && !drag ? 'overflow-y-auto' : 'overflow-hidden',
				column && 'lg:overflow-y-auto'
			]}
		>
			{@render children()}
		</div>
	</section>
</div>
