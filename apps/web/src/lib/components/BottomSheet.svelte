<script lang="ts">
	import type { Snippet } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';

	export type Snap = 'peek' | 'half' | 'full';

	// Report 2 §8: surface sheet, 28 px top corners, e3, 36×4 handle; peek (132 px) → half → full. Drag the
	// handle, or tap it to cycle (keyboard too). Sits above the phone nav and left of the docked Crabby.
	let { snap = $bindable<Snap>('peek'), children }: { snap?: Snap; children: Snippet } = $props();

	const order: Snap[] = ['peek', 'half', 'full'];
	let sheet: HTMLElement;
	let innerHeight = $state(800);
	// Full = up to the top bar: the sheet's bottom edge (above the nav) minus the bar height.
	function fullHeight() {
		if (!sheet) return innerHeight * 0.85;
		const bar = parseFloat(getComputedStyle(sheet).getPropertyValue('--bar-h')) || 56;
		return sheet.getBoundingClientRect().bottom - bar;
	}
	const heightOf = (s: Snap) =>
		s === 'peek' ? 132 : s === 'half' ? innerHeight * 0.5 : fullHeight();

	let drag = $state<{ startY: number; startH: number; moved: boolean } | null>(null);
	let dragH = $state(0);
	const height = $derived(drag ? dragH : heightOf(snap));

	function down(e: PointerEvent) {
		drag = { startY: e.clientY, startH: heightOf(snap), moved: false };
		dragH = drag.startH;
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
	}
	function move(e: PointerEvent) {
		if (!drag) return;
		const dy = drag.startY - e.clientY;
		if (Math.abs(dy) > 4) drag.moved = true;
		dragH = Math.max(80, Math.min(heightOf('full'), drag.startH + dy));
	}
	function up() {
		if (!drag) return;
		if (drag.moved) {
			snap = order.reduce((best, s) =>
				Math.abs(heightOf(s) - dragH) < Math.abs(heightOf(best) - dragH) ? s : best
			);
		} else {
			snap = order[(order.indexOf(snap) + 1) % order.length];
		}
		drag = null;
	}
</script>

<svelte:window bind:innerHeight />

<section
	bind:this={sheet}
	class={[
		'fixed inset-x-0 bottom-(--nav-h) z-panel flex flex-col rounded-t-xl bg-surface shadow-e3 lg:bottom-0 lg:[:root:has([data-dock])_&]:right-(--dock-w)',
		!drag && 'transition-[height] duration-(--dur-sheet) ease-brand'
	]}
	style:height="{height}px"
>
	<button
		type="button"
		class="flex h-11 w-full shrink-0 touch-none items-center justify-center rounded-t-xl"
		aria-label={m.sheet_handle()}
		aria-expanded={snap !== 'peek'}
		onpointerdown={down}
		onpointermove={move}
		onpointerup={up}
		onpointercancel={up}
	>
		<span class="h-1 w-9 rounded-full bg-border-strong" aria-hidden="true"></span>
	</button>
	<div class="min-h-0 flex-1 overflow-y-auto px-5 pb-4 lg:px-8">
		{@render children()}
	</div>
</section>
