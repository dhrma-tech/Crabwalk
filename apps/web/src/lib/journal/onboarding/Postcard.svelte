<script lang="ts">
	import { tr, type Locale } from '../i18n.ts';
	import { OB, type ObState } from '../content/onboarding.ts';
	import InkIcon from '../landing/InkIcon.svelte';
	import Crabby from '#lib/components/Crabby.svelte';

	// The trip postcard (brief §8): it builds up as the visitor answers (name, a stamp per interest, the group,
	// the budget) and flips on the last step to say the coast is ready.
	let { s, lang, flipped = false }: { s: ObState; lang: Locale; flipped?: boolean } = $props();
	const stamps = $derived(
		s.interests.slice(0, 6).map((k) => OB.interestList.find((i) => i.key === k)!)
	);
	const group = $derived(OB.groups.find((g) => g.key === s.group));
	const budget = $derived(OB.budgets.find((b) => b.key === s.budget));
	const name = $derived(s.name.trim());
</script>

<div class={['card', flipped && 'flipped']} role="img" aria-label={tr(OB.done.postcard, lang)}>
	<div class="inner">
		<div class="face front">
			<div class="left">
				<p class="greet">{tr(OB.done.greetings, lang)}</p>
				<svg viewBox="0 0 160 60" class="mini" aria-hidden="true">
					<circle cx="120" cy="22" r="12" fill="#f5efeb" stroke="#b5462b" stroke-width="1" />
					<path d="M0 40 C30 30 60 36 90 30 S140 28 160 32 V60 H0 Z" fill="#8aa7b9" />
					<path d="M0 46 H160 V60 H0 Z" fill="#567c8d" />
					<path
						d="M10 52 q8 -3 16 0 t16 0 t16 0 t16 0 t16 0 t16 0 t16 0 t16 0"
						fill="none"
						stroke="#c8d9e6"
						stroke-width="1.2"
					/>
				</svg>
				<p class="from">{tr(OB.done.from, lang)}</p>
			</div>
			<div class="right">
				<div class="stamps">
					{#each stamps as st (st.key)}
						<span class="stamp" title={tr(st.label, lang)}
							><InkIcon name={st.icon} size={20} stroke={2.6} /></span
						>
					{/each}
					{#if !stamps.length}<span class="stamp empty"></span>{/if}
				</div>
				<span class="postmark" aria-hidden="true">RATNAGIRI · 2026</span>
				<p class="line">
					<span>{tr(OB.done.to, lang)}:</span> <b class:ph={!name}>{name || '______'}</b>
				</p>
				<p class="line">
					{#if group}<InkIcon name={group.icon} size={18} stroke={2.6} />
						<b>{tr(group.label, lang)}</b>{:else}<b class="ph">______</b>{/if}
				</p>
				<p class="line">
					{#if budget}<b>{tr(budget.label, lang)}</b>
						<span>{tr(OB.done.perDay, lang)}</span>{:else}<b class="ph">______</b>{/if}
				</p>
				{#if s.city}<p class="line small">{s.city}</p>{/if}
			</div>
		</div>
		<div class="face back">
			<Crabby size={92} state={flipped ? 'celebrate' : 'idle'} follow={false} />
			<p class="ready">
				{tr(OB.done.ready, lang).replace('{name}', name || tr(OB.done.friend, lang))}
			</p>
		</div>
	</div>
</div>

<style>
	.card {
		width: 100%;
		aspect-ratio: 3 / 2;
		perspective: 1200px;
	}
	.inner {
		position: relative;
		width: 100%;
		height: 100%;
		transform-style: preserve-3d;
		transition: transform 1.1s cubic-bezier(0.3, 1.25, 0.4, 1);
	}
	.flipped .inner {
		transform: rotateY(180deg);
	}
	.face {
		position: absolute;
		inset: 0;
		backface-visibility: hidden;
		border-radius: 12px;
		border: 1.5px solid var(--navy);
		background:
			repeating-linear-gradient(-45deg, transparent 0 6px, rgb(181 70 43 / 0.08) 6px 12px) top /
				100% 6px no-repeat,
			#fbf8f4;
		box-shadow: 5px 5px 0 var(--navy);
		overflow: hidden;
	}
	.front {
		display: grid;
		grid-template-columns: 1fr 1fr;
	}
	.left {
		padding: 14px 12px;
		border-right: 1px dashed var(--haze);
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.greet {
		font-family: var(--j-display);
		font-size: clamp(15px, 2.2vw, 20px);
		line-height: 1.05;
	}
	.mini {
		width: 100%;
		border-radius: 6px;
	}
	.from {
		margin-top: auto;
		font-size: 10px;
		color: var(--muted);
	}
	.right {
		position: relative;
		padding: 12px;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.stamps {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: 4px;
		min-height: 34px;
	}
	.stamp {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 30px;
		height: 34px;
		background: var(--sky);
		border: 1px solid var(--navy);
		outline: 2px dotted #fbf8f4;
		outline-offset: -4px;
		animation: thunk 0.45s var(--j-spring) both;
	}
	.stamp:nth-child(even) {
		rotate: 4deg;
		background: #efe2d6;
	}
	.stamp.empty {
		border-style: dashed;
		background: transparent;
		animation: none;
	}
	.postmark {
		position: absolute;
		top: 30px;
		right: 52px;
		padding: 6px 8px;
		border: 1.5px solid rgb(181 70 43 / 0.55);
		border-radius: 50%;
		color: rgb(181 70 43 / 0.7);
		font-size: 7px;
		font-weight: 600;
		letter-spacing: 0.14em;
		rotate: -14deg;
		pointer-events: none;
	}
	.line {
		display: flex;
		align-items: center;
		gap: 6px;
		padding-bottom: 3px;
		border-bottom: 1px solid var(--line);
		font-size: 12px;
		min-height: 24px;
	}
	.line b {
		font-weight: 600;
	}
	.line .ph {
		color: var(--haze);
	}
	.small {
		font-size: 11px;
		color: var(--muted);
	}
	.back {
		transform: rotateY(180deg);
		display: grid;
		place-items: center;
		align-content: center;
		gap: 4px;
		padding: 16px;
		text-align: center;
		background: radial-gradient(circle at 50% 30%, #f6dcb8, #fbf8f4 70%);
	}
	.ready {
		font-family: var(--j-display);
		font-size: clamp(20px, 3vw, 30px);
		line-height: 1.1;
		text-wrap: balance;
	}
	@keyframes thunk {
		from {
			transform: scale(1.8) rotate(10deg);
			opacity: 0;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.inner {
			transition: none;
		}
	}
</style>
