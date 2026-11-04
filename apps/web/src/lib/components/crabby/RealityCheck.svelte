<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import type { RealityCheck } from '#lib/server/ai/reel.ts';

	// Reel to trip (P12 step L, 10.6): what a reel doesn't tell you — from our data only, never the model's words.
	let { place: p }: { place: RealityCheck } = $props();
	const MONSOON = { open: m.monsoon_open, risky: m.monsoon_risky, closed: m.monsoon_closed };
</script>

<div class="flex flex-col gap-1.5 rounded-md bg-surface-2 p-3" data-testid="reality-check">
	<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- place route built by our server -->
	<a href={p.href} class="type-h3">{p.name}</a>
	<ul class="flex flex-col gap-1 type-small">
		<li>
			<strong class="type-label">{m.reel_today()}:</strong>
			{p.hours === 'closed' ? m.reel_closed_today() : (p.hours ?? m.reel_hours_unknown())}
		</li>
		<li class={p.monsoon === 'open' ? '' : 'text-kokum-ink'}>
			{MONSOON[p.monsoon]()}{p.monsoon_reason && p.monsoon !== 'open'
				? ` — ${p.monsoon_reason}`
				: ''}
		</li>
		{#if p.tide}<li>{m.tide_dependent()}</li>{/if}
		{#if p.safety}<li><strong class="type-label">{m.place_safety()}:</strong> {p.safety}</li>{/if}
		<li>
			<strong class="type-label">{m.reel_verdict()}:</strong>
			{p.verdict ?? m.reel_no_verdict()}
		</li>
		{#if p.best_time}<li>
				<strong class="type-label">{m.fact_best_time()}:</strong>
				{p.best_time}
			</li>{/if}
	</ul>
</div>
