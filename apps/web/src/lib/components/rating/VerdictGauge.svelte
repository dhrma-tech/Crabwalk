<script lang="ts" module>
	import type { Agg as VerdictAgg } from '#lib/verdict.ts';
	export type Agg = VerdictAgg;
	export type EntityType = 'place' | 'stay' | 'eatery';
	export const GROUP_KEYS = ['all', 'family', 'couple', 'solo', 'friends'] as const;
</script>

<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { Spring, Tween } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';
	import { m } from '#lib/paraglide/messages.js';
	import { msg } from '#lib/msg.ts';
	import { formatNumber } from '#lib/format.ts';
	import { dur, reducedMotion } from '#lib/motion.ts';
	import { withVote } from '#lib/verdict.ts';
	import Segmented from '../Segmented.svelte';
	import HowRatingsWork from './HowRatingsWork.svelte';
	import { live } from './live.svelte.ts';

	// FRONTEND §6.4 [LOCKED]: 4-colour segmented bar + winning label + % + votes; group control below;
	// "New" (< 10 votes) = outline bar + label. Report 2 §8: a card, the winner as a heading, the % at display
	// size, a 12 px pill bar and a label under each band.
	// Brief section 4.6 (T1-05): segments are full-width layers moved and sized with `transform` only, each share a
	// `gentle` spring, so re-balancing causes no layout; the % counts up; first time in view the bar grows left to
	// right. A vote shows at once (`live`) and is replaced by the server's numbers when they arrive.
	let {
		type,
		id,
		all,
		groups,
		mine
	}: {
		type: EntityType;
		id: string;
		all: Agg | null;
		groups: Partial<Record<string, Agg>>;
		mine?: { verdicts: Partial<Record<string, number>>; group: string | null };
	} = $props();
	let group = $state<(typeof GROUP_KEYS)[number]>('all');
	const colours = ['var(--v1)', 'var(--v2)', 'var(--v3)', 'var(--v4)'];
	const ours = $derived(live.id === id);
	const agg = $derived.by(() => {
		const base = group === 'all' ? all : (groups[group] ?? null);
		const p = ours ? live.pending : null;
		return p && (group === 'all' || group === p.group) ? withVote(base, p.prev, p.level) : base;
	});
	const shares = $derived(agg?.total ? agg.counts.map((c) => c / agg.total) : [0, 0, 0, 0]);
	const pct = $derived(Math.round((agg?.winner_pct ?? 0) * 100));
	// Own verdict: for one group that group's; for "All" the group they vote as.
	const verdicts = $derived(
		ours ? { ...mine?.verdicts, ...live.verdicts } : (mine?.verdicts ?? {})
	);
	const you = $derived.by(() => {
		const g = group !== 'all' ? group : (ours && live.group) || mine?.group;
		return g ? verdicts[g] : Object.values(verdicts)[0];
	});

	// Server render shows the final bar; off-screen at hydration it empties and grows when first seen.
	const seg = untrack(() => shares.map((s) => new Spring(s, { stiffness: 0.12, damping: 0.8 })));
	const count = new Tween(
		untrack(() => pct),
		{ duration: 700, easing: cubicOut }
	);
	const offsets = $derived(seg.map((_, i) => seg.slice(0, i).reduce((a, s) => a + s.current, 0)));
	let seen = $state(false);
	let bar = $state<HTMLElement>();
	onMount(() => {
		if (!bar) return void (seen = true);
		let first = true;
		const io = new IntersectionObserver(([e]) => {
			if (first && e?.isIntersecting) seen = true;
			else if (first) {
				for (const s of seg) s.set(0, { instant: true });
				count.set(0, { duration: 0 });
			} else if (e?.isIntersecting) {
				const instant = reducedMotion.current;
				seg.forEach((s, i) => setTimeout(() => s.set(shares[i]!, { instant }), dur(i * 60)));
				count.set(pct, { duration: dur(700) });
				seen = true;
			}
			first = false;
			if (seen) io.disconnect();
		});
		io.observe(bar);
		return () => io.disconnect();
	});
	$effect(() => {
		const [s, p] = [shares, pct];
		if (!seen) return;
		untrack(() => {
			seg.forEach((sp, i) => sp.set(s[i]!, { instant: reducedMotion.current }));
			count.set(p, { duration: dur(700) });
		});
	});
	const maskId = $props.id();
</script>

<section
	class="flex flex-col gap-3 rounded-lg bg-surface p-4 shadow-e1 lg:p-5"
	data-testid="verdict-gauge"
	aria-label={m.verdict_title()}
>
	<h2 class="type-label text-text-2">{m.verdict_title()}</h2>
	{#if !agg || agg.total === 0}
		<div
			class="h-3 rounded-full border-[1.5px] border-dashed border-border-strong"
			aria-hidden="true"
		></div>
		<p class="type-body text-text-2">{m.verdict_none()}</p>
	{:else if agg.is_new}
		<!-- The dashed outline draws itself once (a mask stroke over `--dur-emph`). -->
		<div class="relative h-3" aria-hidden="true">
			<svg class="absolute inset-[0.75px] overflow-visible" width="100%" height="100%">
				<mask id={maskId}>
					<rect
						class="draw"
						width="100%"
						height="100%"
						rx="5.25"
						fill="none"
						stroke="white"
						stroke-width="3"
						pathLength="1"
					/>
				</mask>
				<rect
					width="100%"
					height="100%"
					rx="5.25"
					fill="none"
					stroke="var(--border-strong)"
					stroke-width="1.5"
					stroke-dasharray="4 3"
					mask="url(#{maskId})"
				/>
			</svg>
		</div>
		<p class="flex flex-wrap items-center gap-2 type-body">
			<span
				class="inline-flex min-h-7 items-center rounded-full border-[1.5px] border-dashed border-border-strong px-2.5 type-label"
				>{m.verdict_new()}</span
			>
			<span class="text-text-2" data-testid="gauge-count"
				>{m.verdict_votes({ n: formatNumber(agg.total) })}</span
			>
		</p>
	{:else}
		{@const winner = msg(`verdict_${type}_${agg.winner_level}`)}
		<div class="flex items-end justify-between gap-3">
			<div class="min-w-0">
				<p class="type-h2" data-testid="gauge-winner">{winner}</p>
				<p class="type-small text-text-2" data-testid="gauge-count">
					{m.verdict_votes({ n: formatNumber(agg.total) })}
				</p>
			</div>
			<p class="shrink-0 type-display tabular-nums" data-testid="gauge-pct">
				<span aria-hidden="true">{Math.round(count.current)}%</span><span class="sr-only"
					>{m.verdict_pct({ pct, label: winner })}</span
				>
			</p>
		</div>
	{/if}
	{#if agg && agg.total && !agg.is_new}
		<div
			bind:this={bar}
			class="relative h-3 overflow-hidden rounded-full"
			role="img"
			aria-label={agg.counts.map((c, i) => `${msg(`verdict_${type}_${i + 1}`)} ${c}`).join(', ')}
		>
			{#each seg as s, i (i)}
				<span
					class="absolute inset-0 origin-left"
					style:background={colours[i]}
					style:transform="translateX({offsets[i]! * 100}%) scaleX({s.current})"
				></span>
			{/each}
			<!-- 2 px gaps between bands, moved the same way. -->
			{#each [1, 2, 3] as b (b)}
				{#if seg[b - 1]!.current > 0.005 && offsets[b]! < 0.995}
					<span class="absolute inset-0" style:transform="translateX({offsets[b]! * 100}%)"
						><span class="absolute inset-y-0 -left-px w-0.5 bg-surface"></span></span
					>
				{/if}
			{/each}
		</div>
		<p class="type-body" data-testid="gauge-caption">
			{msg(`verdict_most_${group}`, { verdict: msg(`verdict_${type}_${agg.winner_level}`) })}
		</p>
		<ul class="flex flex-wrap gap-x-4 gap-y-1 type-small text-text-2">
			{#each agg.counts as c, i (i)}
				<li class="flex items-center gap-1.5">
					<span class="size-2.5 rounded-full" style:background={colours[i]} aria-hidden="true"
					></span>{msg(`verdict_${type}_${i + 1}`)}
					{c}
				</li>
			{/each}
		</ul>
	{/if}
	{#if you}
		<p class="type-small text-text-2" data-testid="gauge-you">
			{m.verdict_you({ verdict: msg(`verdict_${type}_${you}`) })}
		</p>
	{/if}
	<HowRatingsWork />
	<div class="mt-1">
		<Segmented
			bind:value={group}
			label={m.vote_as()}
			options={GROUP_KEYS.map((g) => ({ value: g, label: msg(`group_${g}`) }))}
		/>
	</div>
</section>

<style>
	.draw {
		stroke-dasharray: 1;
		stroke-dashoffset: 1;
		animation: draw var(--dur-emph) var(--ease) forwards;
	}
	@keyframes draw {
		to {
			stroke-dashoffset: 0;
		}
	}
</style>
