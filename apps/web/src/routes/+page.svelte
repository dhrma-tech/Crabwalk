<script lang="ts">
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';
	import { getLocale } from '#lib/paraglide/runtime.js';
	import { msg } from '#lib/msg.ts';
	import Page from '#lib/components/Page.svelte';
	import MiniVerdict from '#lib/components/rating/MiniVerdict.svelte';
	import PlaceCard from '#lib/components/PlaceCard.svelte';
	import StatusBadge from '#lib/components/StatusBadge.svelte';
	import EmptyState from '#lib/components/EmptyState.svelte';
	import Button from '#lib/components/Button.svelte';
	import SearchBox from '#lib/components/SearchBox.svelte';
	import NoPhoto from '#lib/components/NoPhoto.svelte';
	import ItineraryList from '#lib/components/plan/ItineraryList.svelte';
	import CategoryIcon, {
		categoryIcons,
		categoryTone,
		type Category
	} from '#lib/components/CategoryIcon.svelte';
	import type { PageProps } from './$types';

	// Layout order LOCKED (FRONTEND §7.1): search → season strip → categories → hidden gems → itineraries
	// → Taste Konkan → near me. Suna 2a/5a: on laptops the search sits in the top bar, and season +
	// categories share a row under the heading.
	let { data }: PageProps = $props();
	const lang = getLocale();

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
					.slice(0, 6)
			: []
	);
	const seasonDots = ['var(--yama-s)', 'var(--asagi-s)', 'var(--fuji-s)', 'var(--wakaba-s)'];
</script>

<Page title={data.category ? msg(`cat_${data.category}`) : m.app_name()} back={!!data.category}>
	<div class="flex flex-col gap-8">
		<SearchBox class="lg:hidden" />
		{#if !data.category}
			<p class="hidden font-display text-[38px] leading-snug lg:block" aria-hidden="true">
				{m.discover_heading()}
			</p>
		{/if}

		<div class="flex flex-col gap-8 lg:grid lg:grid-cols-2 lg:gap-12">
			{#if !data.category && (data.season.seasons.length || data.season.events.length)}
				<section aria-label={m.discover_season()}>
					<h2 class="mb-1.5 type-h2">{m.discover_season()}</h2>
					<ul class="grid grid-cols-2 gap-2">
						{#each data.season.seasons as s, i (s)}
							<li class="flex items-center gap-2.5 border border-border px-3 py-2.5">
								<span
									class="size-2 shrink-0 rounded-full"
									style:background={seasonDots[i % seasonDots.length]}
									aria-hidden="true"
								></span>{msg(`season_${s}`)}
							</li>
						{/each}
						{#each data.season.events as e (e.name_en)}
							<li class="flex items-center gap-2.5 border border-border px-3 py-2.5">
								<span class="size-2 shrink-0 rounded-full bg-fuji-s" aria-hidden="true"></span>
								{(lang === 'hi' ? e.name_hi : lang === 'mr' ? e.name_mr : null) || e.name_en}
							</li>
						{/each}
					</ul>
				</section>
			{/if}

			<section class="flex flex-col gap-2.5">
				<h2 class="type-h2">{m.discover_categories()}</h2>
				<ul class="grid grid-cols-3 gap-2 sm:grid-cols-4">
					{#each Object.keys(categoryIcons) as c (c)}
						{@const on = data.category === c}
						<li>
							<a
								href={resolve(`/?category=${c}`)}
								aria-current={on ? 'page' : undefined}
								class={[
									'flex h-full min-h-20 flex-col justify-between gap-2 border border-border p-3 text-[13px] leading-tight text-text no-underline outline-text -outline-offset-2 hover:outline-1',
									on && 'outline-2 -outline-offset-2 outline-text'
								]}
								style:background="var(--{categoryTone[c as Category]})"
								><CategoryIcon category={c as Category} />{msg(`cat_${c}`)}</a
							>
						</li>
					{/each}
				</ul>
			</section>
		</div>

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
								boxed
							>
								{#snippet verdict()}<MiniVerdict type="place" agg={p.agg} />{/snippet}
							</PlaceCard>
						{/each}
					</div>
				{:else}
					<EmptyState title={m.soon_title()} body={m.discover_empty()} />
				{/if}
			</section>
		{:else}
			{#if data.gems.length}
				<section class="flex flex-col gap-2.5">
					<h2 class="type-h2">{m.discover_hidden_gems()}</h2>
					<div
						class="-mx-6 flex snap-x gap-4 overflow-x-auto px-6 pb-2 lg:mx-0 lg:grid lg:grid-cols-4 lg:gap-5 lg:overflow-visible lg:px-0"
					>
						{#each data.gems as p (p.slug)}
							<div class="w-[210px] shrink-0 snap-start lg:w-auto">
								<PlaceCard
									href={resolve('/place/[slug]', { slug: p.slug })}
									names={p.names}
									photo={p.photo}
									category={p.category}
									categoryLabel={msg(`cat_${p.category}`)}
									boxed
								>
									{#snippet badges()}<StatusBadge kind="gem" />{/snippet}
									{#snippet verdict()}<MiniVerdict type="place" agg={p.agg} />{/snippet}
								</PlaceCard>
							</div>
						{/each}
					</div>
				</section>
			{/if}

			{#if data.itineraries.length}
				<section class="flex flex-col gap-2.5">
					<div class="flex items-baseline justify-between">
						<h2 class="type-h2">{m.itin_title()}</h2>
						<a
							href={resolve('/itineraries')}
							class="inline-flex min-h-11 min-w-11 items-center justify-end type-small text-text"
							>{m.itin_all()}</a
						>
					</div>
					<ItineraryList items={data.itineraries} cards />
				</section>
			{/if}

			{#if data.dishes.length}
				<section class="flex flex-col gap-2.5">
					<div class="flex items-baseline justify-between">
						<h2 class="type-h2">{m.discover_taste()}</h2>
						<a
							href={resolve('/taste-konkan')}
							class="inline-flex min-h-11 min-w-11 items-center justify-end type-small text-text"
							>{m.see_all()}</a
						>
					</div>
					<ul class="-mx-6 flex gap-3 overflow-x-auto px-6 pb-2 lg:mx-0 lg:px-0">
						{#each data.dishes as d (d.slug)}
							<li class="w-36 shrink-0">
								<a
									href={resolve('/taste-konkan/[dish]', { dish: d.slug })}
									class="row-link flex h-full flex-col border border-border text-text no-underline"
								>
									<div
										class="aspect-square overflow-hidden bg-border bg-cover"
										style:background-image={d.photo?.lqip ? `url(${d.photo.lqip})` : undefined}
									>
										{#if d.photo}<img
												src={d.photo.src}
												srcset={d.photo.srcset}
												sizes="144px"
												alt={d.photo.alt}
												loading="lazy"
												class="h-full w-full object-cover"
											/>{:else}<NoPhoto tone="sakura" label={false} />{/if}
									</div>
									<span class="px-3 pt-2 pb-2.5 type-h3">{d.name}</span>
								</a>
							</li>
						{/each}
					</ul>
				</section>
			{/if}

			<section class="flex flex-col gap-2.5">
				<h2 class="type-h2">{m.discover_near_me()}</h2>
				{#if near.length}
					<div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
						{#each near as p (p.slug)}
							<PlaceCard
								href={resolve('/place/[slug]', { slug: p.slug })}
								names={p.names}
								photo={p.photo}
								category={p.category}
								categoryLabel={msg(`cat_${p.category}`)}
								boxed
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
					<EmptyState title={m.soon_title()} body={m.soon_discover()} tone="asagi" />
				{/if}
			</section>
		{/if}
	</div>
</Page>
