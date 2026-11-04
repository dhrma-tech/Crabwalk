<script lang="ts">
	import Square from '@lucide/svelte/icons/square';
	import { m } from '#lib/paraglide/messages.js';
	import { driver, stopDriving } from '#lib/drive.svelte.ts';
	import Crabby from '../Crabby.svelte';

	// What Crabby is doing on its own (P12 §3, 10.11): a ring on the element it taps and a status line with Stop,
	// above the phone nav. Pointer-transparent ring; the line is announced politely.
</script>

{#if driver.ring}
	<div
		class="pointer-events-none fixed z-overlay rounded-lg ring-4 ring-kokum/70 motion-safe:animate-pulse"
		style:left="{driver.ring.x - 4}px"
		style:top="{driver.ring.y - 4}px"
		style:width="{driver.ring.w + 8}px"
		style:height="{driver.ring.h + 8}px"
		aria-hidden="true"
	></div>
{/if}
<div aria-live="polite" class="contents">
	{#if driver.status}
		<div
			class="fixed inset-x-4 bottom-[calc(var(--nav-h)+16px)] z-overlay mx-auto flex max-w-md items-center gap-2 rounded-full bg-surface py-1.5 pr-1.5 pl-3 shadow-e3 lg:bottom-6"
			data-testid="crabby-driving"
		>
			<Crabby size={26} walking />
			<p class="min-w-0 flex-1 truncate type-small text-text" role="status">
				{m.drive_status({ what: driver.status })}
			</p>
			<button
				type="button"
				class="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-surface-2 px-3.5 type-label text-text hover:bg-surface-3"
				onclick={stopDriving}><Square size={14} aria-hidden="true" />{m.drive_stop()}</button
			>
		</div>
	{/if}
</div>
