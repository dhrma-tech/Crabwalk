<script lang="ts">
	import AirVent from '@lucide/svelte/icons/air-vent';
	import ShowerHead from '@lucide/svelte/icons/shower-head';
	import Wifi from '@lucide/svelte/icons/wifi';
	import SquareParking from '@lucide/svelte/icons/square-parking';
	import BatteryCharging from '@lucide/svelte/icons/battery-charging';
	import MapPin from '@lucide/svelte/icons/map-pin';
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';
	import { getLocale } from '#lib/paraglide/runtime.js';
	import { msg } from '#lib/msg.ts';
	import Page from '#lib/components/Page.svelte';
	import Button from '#lib/components/Button.svelte';
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

	// FRONTEND §7.5 detail (LOCKED on phones): photos → verdict + sub-scores → amenities → network → food → price
	// compare. Tideline (Report 2 §9.5): the Place skeleton (T-25) with an amenities icon grid, signal bars per
	// operator and the price rows; laptops: story column 7/12, verdict + prices 5/12.
	let { data }: PageProps = $props();
	const s = $derived(data.stay);
	const lang = getLocale();
	const primary = $derived(s.names[lang] || s.names.en);
	const secondary = $derived(lang === 'en' ? s.names.mr : s.names.en);
	const amenities = [
		['ac', AirVent],
		['hot_water', ShowerHead],
		['wifi', Wifi],
		['parking', SquareParking],
		['power_backup', BatteryCharging]
	] as const;
	const foodKeys = ['veg', 'non_veg', 'malvani', 'jain', 'homemade_included'];
	// Signal bars out of 3; the word is always shown too (colour/shape is never the only signal).
	const bars = { none: 0, weak: 1, good: 3 } as Record<string, number>;
</script>

<Page
	title={primary}
	back
	overlay
	heading={false}
	description={s.description}
	image={s.photos[0]?.src}
>
	<Hero photo={s.photos[0] ?? null} kind="stay" immersive />

	<article
		class="relative -mx-5 -mt-7 flex flex-col gap-8 rounded-t-xl bg-bg px-5 pt-6 lg:mx-0 lg:mt-8 lg:grid lg:grid-cols-12 lg:items-start lg:gap-x-10 lg:rounded-none lg:px-0 lg:pt-0"
	>
		<div class="contents lg:col-span-7 lg:flex lg:flex-col lg:gap-10">
			<header class="order-1 flex flex-col gap-3 lg:order-none">
				<div>
					<h2 class="type-display">{primary}</h2>
					{#if secondary && secondary !== primary}<p
							class="mt-1 type-small text-text-2"
							lang={lang === 'en' ? 'mr' : 'en'}
						>
							{secondary}
						</p>{/if}
				</div>
				<TagList tags={s.vibes.map((v) => msg(`vibe_${v}`))} max={9} />
				<div class="flex flex-wrap gap-2 empty:hidden">
					{#if s.verified}<StatusBadge kind="verified" />{/if}
					{#if s.style}<span
							class="inline-flex min-h-7 items-center rounded-full bg-surface-2 px-3 type-label text-text-2"
							>{msg(`service_${s.style}`)}</span
						>{/if}
				</div>
				{#if s.coords}
					<div>
						<Button variant="secondary" href={`${resolve('/map')}?focus=stay/${s.slug}`}>
							{#snippet icon()}<MapPin size={20} aria-hidden="true" />{/snippet}
							{m.map_see_on_map()}
						</Button>
					</div>
				{/if}
			</header>

			{#if s.description}<p class="order-5 max-w-170 type-lead whitespace-pre-line lg:order-none">
					{s.description}
				</p>{/if}

			<section class="order-6 flex flex-col gap-3 lg:order-none">
				<h2 class="type-h2">{m.amenities()}</h2>
				<ul class="grid grid-cols-2 gap-2 sm:grid-cols-3" data-clip-check>
					{#each amenities as [a, Icon] (a)}
						{@const has = s.amenities[a]}
						<li
							class={[
								'flex items-center gap-2.5 rounded-md p-3 type-body',
								has ? 'bg-surface-2' : 'border border-dashed border-border-strong text-text-2'
							]}
						>
							<Icon size={20} aria-hidden="true" class={['shrink-0', has && 'text-lagoon']} />
							<!-- No strikethrough: it merges with the Devanagari headline stroke. -->
							<span class="flex flex-col">
								{msg(`amenity_${a}`)}
								{#if !has}<span class="type-small">{m.amenity_missing()}</span>{/if}
							</span>
						</li>
					{/each}
				</ul>
			</section>

			{#if Object.keys(s.network).length}
				<section class="order-7 flex flex-col gap-3 lg:order-none">
					<h2 class="type-h2">{m.network_title()}</h2>
					<ul class="grid gap-2 sm:grid-cols-2">
						{#each Object.entries(s.network) as [op, level] (op)}
							<li class="flex items-center justify-between gap-3 rounded-md bg-surface-2 p-3">
								<span class="type-body-strong">{op}</span>
								<span class="flex items-center gap-2.5 type-small text-text-2">
									<span class="flex h-4 items-end gap-0.5" aria-hidden="true">
										{#each [1, 2, 3] as b (b)}
											<span
												class={[
													'w-1 rounded-full',
													['h-1/3', 'h-2/3', 'h-full'][b - 1],
													b <= (bars[level] ?? 0) ? 'bg-lagoon' : 'bg-border-strong/40'
												]}
											></span>
										{/each}
									</span>
									{msg(`network_${level}`)}
								</span>
							</li>
						{/each}
					</ul>
				</section>
			{/if}

			{#if foodKeys.some((k) => s.food[k])}
				<section class="order-8 flex flex-col gap-2 lg:order-none">
					<h2 class="type-h2">{m.food_at_stay()}</h2>
					<p class="type-body">
						{foodKeys
							.filter((k) => s.food[k])
							.map((k) => msg(`food_${k}`))
							.join(' · ')}
					</p>
				</section>
			{/if}

			<div class="order-10 lg:order-none">
				<Reviews reviews={data.ratings.reviews} summaries={data.ratings.summaries} />
			</div>

			<footer class="order-11 flex flex-col items-start gap-3 lg:order-none">
				{#if s.lastVerified}<StatusBadge kind="last-verified" date={s.lastVerified} />{/if}
				{#if !s.claimed}<a
						href={resolve('/owner/claim/[type]/[id]', { type: 'stay', id: s.id })}
						class="inline-flex min-h-11 items-center type-small">{m.claim_cta()}</a
					>{/if}
				<ReportProblem entityType="stay" entityId={s.id} />
			</footer>
		</div>

		<div class="contents lg:col-span-5 lg:flex lg:flex-col lg:gap-6">
			<div class="order-2 lg:order-none">
				<VerdictGauge type="stay" all={data.ratings.all} groups={data.ratings.groups} />
			</div>
			<div class="order-3 lg:order-none">
				<SubScores dims={data.dims} subs={data.ratings.subs} />
			</div>
			<div class="order-4 lg:order-none">
				<VerdictVote
					type="stay"
					id={s.id}
					dims={data.dims}
					mine={data.ratings.mine}
					signedIn={data.ratings.signedIn}
				/>
			</div>

			<section class="order-9 flex flex-col gap-3 lg:order-none">
				<h2 class="type-h2">{m.prices_title()}</h2>
				<PriceTable rows={data.prices} />
				{#if data.prices.filter((r) => r.price).length >= 2}<PriceTip slug={data.stay.slug} />{/if}
				<Contact phone={s.phone} whatsapp={s.whatsapp} />
			</section>
		</div>
	</article>
</Page>
