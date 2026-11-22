<script lang="ts">
	import '#lib/journal/journal.css';
	import Crabby, { CRABBY_STATES, type CrabbyState } from '#lib/components/Crabby.svelte';

	// Hidden character sheet (brief §6): every state, the small marks and the onboarding props, for review.
	// Not linked anywhere; noindex.
	const NOTES: Record<CrabbyState, string> = {
		idle: 'Breathing, blinks every 3–6 s',
		wave: 'Big claw wave',
		scuttle: 'Sideways walk, alternating legs',
		point: 'Big claw points',
		think: 'Small claw taps, eyes up',
		celebrate: 'Hop and claw clack',
		sleep: 'Eyes droop (offline)'
	};
</script>

<svelte:head>
	<title>Crabby · character sheet</title>
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<main class="journal sheet" id="main">
	<header class="j-wrap">
		<p class="j-caps">Character sheet</p>
		<h1 class="j-h2">Crabby, the Konkan fiddler crab</h1>
		<p class="j-lead">
			One oversized claw, tall eye stalks, laterite shell. Move the pointer: the eyes follow.
		</p>
	</header>

	<section class="j-wrap grid" aria-label="States">
		{#each CRABBY_STATES as s (s)}
			<figure>
				<Crabby state={s} size={200} loop />
				<figcaption><code>{s}</code><span>{NOTES[s]}</span></figcaption>
			</figure>
		{/each}
		<figure>
			<Crabby state="point" size={200} flip />
			<figcaption><code>point · flip</code><span>Mirrored, points left</span></figcaption>
		</figure>
	</section>

	<section class="j-wrap grid" aria-label="Onboarding props">
		{#each ['baby', 'gem', 'leaf'] as const as h (h)}
			<figure>
				<Crabby state="idle" size={200} hold={h} />
				<figcaption><code>hold="{h}"</code></figcaption>
			</figure>
		{/each}
		<figure>
			<Crabby state="scuttle" size={200} speed={2.2} />
			<figcaption><code>scuttle · speed 2.2</code><span>Packed pace</span></figcaption>
		</figure>
	</section>

	<section class="j-wrap marks" aria-label="Small sizes">
		{#each [20, 24, 32, 36, 48, 64] as size (size)}
			<div><Crabby {size} /><small>{size}</small></div>
		{/each}
		{#each [20, 30, 36] as size (size)}
			<div class="dark"><Crabby {size} tone="white" /><small>{size} white</small></div>
		{/each}
		<div><Crabby size={24} walking /><small>24 walking</small></div>
	</section>
</main>

<style>
	.sheet {
		min-height: 100dvh;
		padding-block: 48px 120px;
	}
	header {
		display: grid;
		gap: 12px;
	}
	.grid {
		margin-top: 40px;
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
		gap: 20px;
	}
	figure {
		display: grid;
		justify-items: center;
		gap: 8px;
		padding: 20px 12px 16px;
		background: var(--white);
		border: 1.5px solid var(--line);
		border-radius: 20px;
	}
	figcaption {
		display: grid;
		justify-items: center;
		font-size: 14px;
		color: var(--muted);
	}
	code {
		font-weight: 600;
		color: var(--navy);
	}
	.marks {
		margin-top: 40px;
		display: flex;
		flex-wrap: wrap;
		gap: 16px;
		align-items: end;
	}
	.marks div {
		display: grid;
		justify-items: center;
		gap: 6px;
		padding: 12px;
		border-radius: 14px;
		background: var(--white);
	}
	.marks .dark {
		background: #0270ae;
		color: #fff;
	}
</style>
