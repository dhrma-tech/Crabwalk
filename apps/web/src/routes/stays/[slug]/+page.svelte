<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import Minus from '@lucide/svelte/icons/minus';
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';
	import { getLocale } from '#lib/paraglide/runtime.js';
	import { msg } from '#lib/msg.ts';
	import Page from '#lib/components/Page.svelte';
	import StatusBadge from '#lib/components/StatusBadge.svelte';
	import TagList from '#lib/components/TagList.svelte';
	import Hero from '#lib/components/listing/Hero.svelte';
	import PriceTable from '#lib/components/listing/PriceTable.svelte';
	import PriceTip from '#lib/components/crabby/PriceTip.svelte';
	import Contact from '#lib/components/listing/Contact.svelte';
	import ReportProblem from '#lib/components/listing/ReportProblem.svelte';
	import VerdictGauge from '#lib/components/rating/VerdictGauge.svelte';
	import VerdictVote from '#lib/components/rating/VerdictVote.svelte';
	import SubScores from '#lib/components/rating/SubScores.svelte';
	import Reviews from '#lib/components/rating/Reviews.svelte';
	import type { PageProps } from './$types';

	// FRONTEND §7.5 detail: photos → (verdict + sub-scores, P5) → amenities → network → food → price compare.
	let { data }: PageProps = $props();
	const s = $derived(data.stay);
	const lang = getLocale();
	const primary = $derived(s.names[lang] || s.names.en);
	const secondary = $derived(lang === 'en' ? s.names.mr : s.names.en);
	const amenityKeys = ['ac', 'hot_water', 'wifi', 'parking', 'power_backup'];
	const foodKeys = ['veg', 'non_veg', 'malvani', 'jain', 'homemade_included'];
</script>

<Page title={primary} back>
	<article class="mx-auto flex max-w-[680px] flex-col gap-6">
		<Hero photo={s.photos[0] ?? null} tone="asagi" />
		<header class="flex flex-col gap-2">
			<h2 class="type-display">{primary}</h2>
			{#if secondary && secondary !== primary}<p
					class="type-h3 text-text-2"
					lang={lang === 'en' ? 'mr' : 'en'}
				>
					{secondary}
				</p>{/if}
			<TagList tags={s.vibes.map((v) => msg(`vibe_${v}`))} max={9} />
			<div class="flex flex-wrap gap-1.5">
				{#if s.verified}<StatusBadge kind="verified" />{/if}
				{#if s.style}<span class="bg-bg px-2.5 py-1 type-tiny text-text-2"
						>{msg(`service_${s.style}`)}</span
					>{/if}
			</div>
		</header>

		<VerdictGauge type="stay" all={data.ratings.all} groups={data.ratings.groups} />
		<SubScores dims={data.dims} subs={data.ratings.subs} />
		<VerdictVote
			type="stay"
			id={s.id}
			dims={data.dims}
			mine={data.ratings.mine}
			signedIn={data.ratings.signedIn}
		/>
		{#if s.description}<p class="type-body whitespace-pre-line">{s.description}</p>{/if}

		<section class="flex flex-col gap-3">
			<h2 class="type-h2">{m.amenities()}</h2>
			<ul class="grid grid-cols-2 gap-2">
				{#each amenityKeys as a (a)}
					<li class="flex items-center gap-2 type-body">
						{#if s.amenities[a]}<Check size={20} class="text-ok" aria-hidden="true" />{:else}<Minus
								size={20}
								class="text-text-2"
								aria-hidden="true"
							/>{/if}
						<span class={!s.amenities[a] ? 'text-text-2 line-through' : ''}
							>{msg(`amenity_${a}`)}</span
						>
					</li>
				{/each}
			</ul>
		</section>

		{#if Object.keys(s.network).length}
			<section class="flex flex-col gap-3">
				<h2 class="type-h2">{m.network_title()}</h2>
				<ul class="flex flex-col gap-1">
					{#each Object.entries(s.network) as [op, level] (op)}
						<li class="flex justify-between type-body">
							<span>{op}</span><span class="text-text-2">{msg(`network_${level}`)}</span>
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		{#if foodKeys.some((k) => s.food[k])}
			<section class="flex flex-col gap-2">
				<h2 class="type-h2">{m.food_at_stay()}</h2>
				<p class="type-body">
					{foodKeys
						.filter((k) => s.food[k])
						.map((k) => msg(`food_${k}`))
						.join(' · ')}
				</p>
			</section>
		{/if}

		<section class="flex flex-col gap-3">
			<h2 class="type-h2">{m.prices_title()}</h2>
			<PriceTable rows={data.prices} />
			{#if data.prices.filter((r) => r.price).length >= 2}<PriceTip slug={data.stay.slug} />{/if}
			<Contact phone={s.phone} whatsapp={s.whatsapp} />
		</section>

		<Reviews reviews={data.ratings.reviews} summaries={data.ratings.summaries} />

		<footer class="flex flex-col gap-3 border-t border-border pt-4">
			{#if s.lastVerified}<StatusBadge kind="last-verified" date={s.lastVerified} />{/if}
			{#if !s.claimed}<a
					href={resolve('/owner/claim/[type]/[id]', { type: 'stay', id: s.id })}
					class="type-small">{m.claim_cta()}</a
				>{/if}
			<ReportProblem entityType="stay" entityId={s.id} />
		</footer>
	</article>
</Page>
