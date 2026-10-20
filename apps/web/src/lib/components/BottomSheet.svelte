<script lang="ts">
	import type { Snippet } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';

	export type Snap = 'peek' | 'half' | 'full';

	// FRONTEND §6.6: peek (120 px) → half → full. Drag the handle, or tap it to cycle (keyboard too).
	let { snap = $bindable<Snap>('peek'), children }: { snap?: Snap; children: Snippet } = $props();

	const order: Snap[] = ['peek', 'half', 'full'];
	const heightOf = (s: Snap) =>
		s === 'peek' ? 120 : s === 'half' ? innerHeight * 0.5 : innerHeight - 56 - 64;

	let innerHeight = $state(800);
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
	class={[
		'fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-30 flex flex-col overflow-hidden border-t border-text bg-bg lg:bottom-0 lg:[:root:has([data-dock])_&]:right-[340px]',
		!drag && 'transition-[height] duration-300 ease-brand'
	]}
	style:height="{height}px"
>
	<button
		type="button"
		class="flex h-11 w-full shrink-0 touch-none items-center justify-center"
		aria-label={m.sheet_handle()}
		aria-expanded={snap !== 'peek'}
		onpointerdown={down}
		onpointermove={move}
		onpointerup={up}
		onpointercancel={up}
	>
		<span class="h-0.5 w-9 bg-border" aria-hidden="true"></span>
	</button>
	<div class="min-h-0 flex-1 overflow-y-auto px-6 pb-[env(safe-area-inset-bottom)]">
		{@render children()}
	</div>
</section>
