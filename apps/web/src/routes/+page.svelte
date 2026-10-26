<script lang="ts">
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';
	import { msg } from '#lib/msg.ts';
	import Page from '#lib/components/Page.svelte';
	import MiniVerdict from '#lib/components/rating/MiniVerdict.svelte';
	import PlaceCard from '#lib/components/PlaceCard.svelte';
	import HeroCard from '#lib/components/HeroCard.svelte';
	import Carousel from '#lib/components/Carousel.svelte';
	import StatusBadge from '#lib/components/StatusBadge.svelte';
	import EmptyState from '#lib/components/EmptyState.svelte';
	import Button from '#lib/components/Button.svelte';
	import SearchBox from '#lib/components/SearchBox.svelte';
	import TodayStrip from '#lib/components/TodayStrip.svelte';
	import NoPhoto from '#lib/components/NoPhoto.svelte';
	import ItineraryList from '#lib/components/plan/ItineraryList.svelte';
	import CategoryIcon, {
		categoryIcons,
		categoryFamily,
		familyTint,
		type Category
	} from '#lib/components/CategoryIcon.svelte';
	import type { PageProps } from './$types';

	// Layout order LOCKED (FRONTEND §7.1): search → season strip → categories → hidden gems → itineraries
	// → Taste Konkan → near me. Tideline (Report 2 §9.1): a hero block (greeting, search, "Today on the coast"),
	// on laptops split 7/5 with the first photographed gem; gems 4-up, itineraries 3-up, dishes 6-up.
	let { data }: PageProps = $props();

	let here = $state<{ lon: number; lat: number } | null>(null);
	let locError = $state(false);
	function nearMe() {
		navigator.geolocation.getCurrentPosition(
			(p) => (here = { lon: p.coords.longitude, lat: p.coords.latitude }),
			() => (locError = true),
			{ timeout: 10000, maximumAge: 300000 }
		);
	}
	const km = (c: [number, number] | null) =>
		here && c
			? Math.hypot(
					(c[0] - here.lon) * 111.32 * Math.cos((here.lat * Math.PI) / 180),
					(c[1] - here.lat) * 110.57
				)
			: null;
	const near = $derived(
		here
			? [...data.places]
					.map((p) => ({ ...p, km: km(p.coords) }))
					.sort((a, b) => (a.km ?? 1e9) - (b.km ?? 1e9))
					.slice(0, 8)
			: []
	);
	const featured = $derived(data.gems.find((g) => g.photo));
	const categoryName = $derived(data.category ? msg(`cat_${data.category}`) : null);
</script>

{#snippet seeAll(href: string, label: string)}
	<!-- eslint-disable svelte/no-navigation-without-resolve -- callers pass resolve()d hrefs -->
	<a
		{href}
		class="inline-flex min-h-11 min-w-11 items-center justify-end type-small text-lagoon-ink"
		>{label}</a
	>
	<!-- eslint-enable svelte/no-navigation-without-resolve -->
{/snippet}

<Page
	title={categoryName ?? m.app_name()}
	back={!!data.category}
	heading={!!data.category}
	description={categoryName ? m.meta_category({ category: categoryName }) : null}
	canonical={data.category ? `/?category=${data.category}` : undefined}
>
	<div class="flex flex-col gap-10 lg:gap-14">
		{#if !data.category}
			<div class="grid gap-8 lg:grid-cols-12">
				<div class="flex flex-col gap-5 lg:col-span-7 lg:justify-center">
					<p class="type-display-xl">{m.discover_heading()}</p>
					<SearchBox id="search" />
					{#if data.today}<TodayStrip today={data.today} season={data.season} {here} />{/if}
				</div>
				{#if featured}
					<div class="hidden lg:col-span-5 lg:block">
						<HeroCard
							href={resolve('/place/[slug]', { slug: featured.slug })}
							photo={featured.photo}
							names={featured.names}
							category={featured.category}
							sub={msg(`cat_${featured.category}`)}
						>
							{#snippet badges()}<StatusBadge kind="gem" glass />{/snippet}
						</HeroCard>
					</div>
				{/if}
			</div>
		{/if}

		<section aria-labelledby="cat-title" class="flex flex-col gap-3">
			<h2 id="cat-title" class={data.category ? 'sr-only' : 'type-h2'}>
				{m.discover_categories()}
			</h2>
			<ul
				class="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0"
				data-clip-check
			>
				{#each Object.keys(categoryIcons) as c (c)}
					{@const on = data.category === c}
					<li class="shrink-0">
						<a
							href={resolve(`/?category=${c}`)}
							aria-current={on ? 'page' : undefined}
							class={[
								'flex h-22 min-w-18 flex-col items-center justify-center gap-2 rounded-md px-2 type-label text-text no-underline outline-text -outline-offset-2 hover:outline-1',
								familyTint[categoryFamily[c as Category]].bg,
								on && 'outline-2'
							]}><CategoryIcon category={c as Category} size={24} />{msg(`cat_${c}`)}</a
						>
					</li>
				{/each}
			</ul>
		</section>

		{#if data.category}
			<section class="flex flex-col gap-3">
				{#if data.places.length}
					<div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
						{#each data.places as p (p.slug)}
							<PlaceCard
								href={resolve('/place/[slug]', { slug: p.slug })}
								names={p.names}
								photo={p.photo}
								category={p.category}
								categoryLabel={msg(`cat_${p.category}`)}
							>
								{#snippet verdict()}<MiniVerdict type="place" agg={p.agg} />{/snippet}
							</PlaceCard>
						{/each}
					</div>
				{:else}
					<EmptyState title={m.soon_title()} body={m.discover_empty()}>
						{#snippet action()}<Button href={resolve('/')} variant="secondary"
								>{m.discover_all()}</Button
							>{/snippet}
					</EmptyState>
				{/if}
			</section>
		{:else}
			{#if data.gems.length}
				<section aria-labelledby="gems-title" class="flex flex-col gap-3">
					<h2 id="gems-title" class="type-h2">{m.discover_hidden_gems()}</h2>
					<Carousel label={m.discover_hidden_gems()}>
						{#each data.gems as p (p.slug)}
							<li>
								<HeroCard
									href={resolve('/place/[slug]', { slug: p.slug })}
									photo={p.photo}
									names={p.names}
									category={p.category}
									sub={msg(`cat_${p.category}`)}
								>
									{#snippet badges()}<StatusBadge kind="gem" glass />{/snippet}
								</HeroCard>
							</li>
						{/each}
					</Carousel>
				</section>
			{/if}

			{#if data.itineraries.length}
				<section aria-labelledby="itin-title" class="flex flex-col gap-3">
					<div class="flex items-baseline justify-between gap-4">
						<h2 id="itin-title" class="type-h2">{m.itin_title()}</h2>
						{@render seeAll(resolve('/itineraries'), m.itin_all())}
					</div>
					<ItineraryList items={data.itineraries} cards />
				</section>
			{/if}

			{#if data.dishes.length}
				<section aria-labelledby="taste-title" class="flex flex-col gap-3">
					<div class="flex items-baseline justify-between gap-4">
						<h2 id="taste-title" class="type-h2">{m.discover_taste()}</h2>
						{@render seeAll(resolve('/taste-konkan'), m.see_all())}
					</div>
					<ul
						class="-mx-5 flex gap-4 overflow-x-auto px-5 pb-1 lg:mx-0 lg:grid lg:grid-cols-6 lg:gap-5 lg:overflow-visible lg:px-0"
						data-clip-check
					>
						{#each data.dishes as d (d.slug)}
							<li class="w-22 shrink-0 lg:w-auto">
								<a
									href={resolve('/taste-konkan/[dish]', { dish: d.slug })}
									class="group flex flex-col items-center gap-2 text-center text-text no-underline"
								>
									<div
										class="size-22 overflow-hidden rounded-full bg-surface-2 bg-cover shadow-e1 transition-shadow duration-300 ease-brand group-hover:shadow-e2"
										style:background-image={d.photo?.lqip ? `url(${d.photo.lqip})` : undefined}
									>
										{#if d.photo}<img
												src={d.photo.src}
												srcset={d.photo.srcset}
												sizes="88px"
												alt={d.photo.alt}
												loading="lazy"
												class="h-full w-full object-cover"
											/>{:else}<NoPhoto kind="dish" label={false} />{/if}
									</div>
									<span class="type-small font-semibold">{d.name}</span>
								</a>
							</li>
						{/each}
					</ul>
				</section>
			{/if}

			<section aria-labelledby="near-title" class="flex flex-col gap-3">
				<h2 id="near-title" class="type-h2">{m.discover_near_me()}</h2>
				{#if near.length}
					<div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
						{#each near as p (p.slug)}
							<PlaceCard
								href={resolve('/place/[slug]', { slug: p.slug })}
								names={p.names}
								photo={p.photo}
								category={p.category}
								categoryLabel={msg(`cat_${p.category}`)}
								distanceKm={p.km}
							>
								{#snippet verdict()}<MiniVerdict type="place" agg={p.agg} />{/snippet}
							</PlaceCard>
						{/each}
					</div>
				{:else if locError}
					<p class="type-body text-text-2">{m.discover_location_denied()}</p>
				{:else if data.places.length}
					<div>
						<Button variant="secondary" onclick={nearMe}>{m.discover_near_me_cta()}</Button>
					</div>
				{:else}
					<EmptyState title={m.soon_title()} body={m.soon_discover()}>
						{#snippet action()}<Button href={resolve('/map')} variant="secondary"
								>{m.nav_map()}</Button
							>{/snippet}
					</EmptyState>
				{/if}
			</section>
		{/if}
	</div>
</Page>
