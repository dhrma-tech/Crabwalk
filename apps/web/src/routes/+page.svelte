<script lang="ts">
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';
	import { msg } from '#lib/msg.ts';
	import { VIBES } from '#lib/vocab.ts';
	import Page from '#lib/components/Page.svelte';
	import MiniVerdict from '#lib/components/rating/MiniVerdict.svelte';
	import PlaceCard from '#lib/components/PlaceCard.svelte';
	import HeroCard from '#lib/components/HeroCard.svelte';
	import Carousel from '#lib/components/Carousel.svelte';
	import StatusBadge from '#lib/components/StatusBadge.svelte';
	import EmptyState from '#lib/components/EmptyState.svelte';
	import CoastBand from '#lib/components/CoastBand.svelte';
	import Illustration from '#lib/components/Illustration.svelte';
	import Button from '#lib/components/Button.svelte';
	import SearchBox from '#lib/components/SearchBox.svelte';
	import TodayStrip from '#lib/components/TodayStrip.svelte';
	import NoPhoto from '#lib/components/NoPhoto.svelte';
	import ItineraryList from '#lib/components/plan/ItineraryList.svelte';
	import ScrollProgress from '#lib/components/ScrollProgress.svelte';
	import CategoryIcon, { categoryIcons, type Category } from '#lib/components/CategoryIcon.svelte';
	import StayCard from '#lib/components/StayCard.svelte';
	import Utensils from '@lucide/svelte/icons/utensils';
	import CloudRain from '@lucide/svelte/icons/cloud-rain';
	import { getLocale } from '#lib/paraglide/runtime.js';
	import { formatINR } from '#lib/format.ts';
	import type { PageProps } from './$types';

	// Layout order (FRONTEND §7.1, changed by the user 2026-11-11): search → season strip → categories → places
	// → stays → food → hidden gems → itineraries → Taste Konkan → near me. Tideline (Report 2 §9.1): a hero block (greeting, search, "Today on the coast"),
	// on laptops split 7/5 with the first photographed gem. Categories (photo tiles), gems, itineraries, dishes and
	// near me are sideways scroll rows on every screen (user, 2026-11-03).
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
	const locale = getLocale();
	const nameOf = (n: { en: string; hi: string | null; mr: string | null }) =>
		(locale === 'hi' ? n.hi : locale === 'mr' ? n.mr : null) || n.en;
	// T1-10 (UX-07): a home row shows only once it has at least three items; until then it is left out.
	const full = (n: number) => n >= 3;
	const featured = $derived(data.gems.find((g) => g.photo));
	const categoryName = $derived(data.category ? msg(`cat_${data.category}`) : null);
</script>

{#snippet monsoonBadge(state: 'open' | 'risky' | 'closed')}
	<!-- T3-03: in monsoon mode, closed and risky places say so on the card. -->
	{#if data.monsoon && state !== 'open'}<StatusBadge
			kind="monsoon"
			{state}
			label={state === 'closed' ? m.monsoon_closed() : m.monsoon_risky()}
			glass
		/>{/if}
{/snippet}

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
					<div class="relative isolate">
						<CoastBand />
						<p class="type-display-xl">{m.discover_heading()}</p>
					</div>
					<SearchBox id="search" />
					<!-- T1-10 (UX-01): one tap from the hero to stays of a kind; links to the existing stays filter. -->
					<nav aria-labelledby="vibes-title" class="flex flex-col gap-1" data-testid="vibe-row">
						<h2 id="vibes-title" class="type-label text-text-2">{m.discover_vibes()}</h2>
						<ul
							class="-mx-5 flex gap-1 overflow-x-auto px-5 [scrollbar-width:none] lg:mx-0 lg:flex-wrap lg:px-0"
						>
							{#each VIBES as v (v)}
								<li class="shrink-0">
									<!-- eslint-disable svelte/no-navigation-without-resolve -- resolve()d path + a query -->
									<a
										href={`${resolve('/stays')}?vibe=${v}`}
										class="group/press inline-flex min-h-11 items-center no-underline"
										><span
											class="inline-flex min-h-9 items-center rounded-full bg-surface-2 px-3.5 py-1 type-label text-text transition-transform duration-(--dur-press) ease-brand group-hover/press:bg-surface-3 group-active/press:scale-[.97]"
											>{msg(`vibe_${v}`)}</span
										></a
									>
									<!-- eslint-enable svelte/no-navigation-without-resolve -->
								</li>
							{/each}
						</ul>
					</nav>
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
			<div class="laterite-course" aria-hidden="true"></div>
		{/if}

		<section aria-labelledby="cat-title" class="flex scroll-scope flex-col gap-3">
			<h2 id="cat-title" class={data.category ? 'sr-only' : 'type-h2'}>
				{m.discover_categories()}
			</h2>
			<ul
				class="scroll-row -mx-5 flex gap-2 overflow-x-auto px-5 pb-1 lg:mx-0 lg:px-0"
				data-clip-check
			>
				{#each Object.keys(categoryIcons) as c (c)}
					{@const on = data.category === c}
					<li class="shrink-0">
						<a
							href={resolve(`/?category=${c}`)}
							aria-current={on ? 'page' : undefined}
							class={[
								'relative isolate flex h-22 min-w-22 flex-col items-center justify-center gap-2 overflow-hidden rounded-md px-2 type-label text-white no-underline outline-white -outline-offset-2 hover:outline-1',
								on && 'outline-2'
							]}
							><img
								src="/categories/{c}.webp"
								alt=""
								width="240"
								height="240"
								decoding="async"
								class="absolute inset-0 -z-10 size-full object-cover"
							/><span class="absolute inset-0 -z-10 bg-scrim"></span><CategoryIcon
								category={c as Category}
								size={24}
							/>{msg(`cat_${c}`)}</a
						>
					</li>
				{/each}
			</ul>
			<ScrollProgress />
			<!-- T3-03: monsoon mode (default June–September); a plain form, so it works without JS. -->
			<form method="POST" action={resolve('/prefs')} class="flex flex-wrap items-center gap-x-3">
				<input type="hidden" name="monsoon" value={data.monsoon ? 'off' : 'on'} />
				<input
					type="hidden"
					name="return"
					value={data.category ? `/?category=${data.category}` : '/'}
				/>
				<button
					type="submit"
					aria-pressed={data.monsoon}
					data-testid="monsoon-toggle"
					class={[
						'inline-flex min-h-11 items-center gap-2 rounded-full px-4 type-label',
						data.monsoon ? 'bg-text text-bg' : 'bg-surface-2 text-text hover:bg-surface-3'
					]}><CloudRain size={16} aria-hidden="true" />{m.monsoon_mode()}</button
				>
				{#if data.monsoon}<span class="type-small text-text-2">{m.monsoon_mode_hint()}</span>{/if}
			</form>
		</section>

		{#if data.category}
			<section class="flex flex-col gap-3">
				{#if data.places.length}
					<div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
						{#each data.places as p (p.slug)}
							<PlaceCard
								href={resolve('/place/[slug]', { slug: p.slug })}
								slug={p.slug}
								names={p.names}
								photo={p.photo}
								category={p.category}
								categoryLabel={msg(`cat_${p.category}`)}
							>
								{#snippet verdict()}<MiniVerdict type="place" agg={p.agg} />{/snippet}
								{#snippet badges()}{@render monsoonBadge(p.monsoon)}{/snippet}
							</PlaceCard>
						{/each}
					</div>
				{:else}
					<EmptyState title={m.soon_title()} body={m.discover_empty()} art="net">
						{#snippet action()}<Button href={resolve('/')} variant="secondary"
								>{m.discover_all()}</Button
							>{/snippet}
					</EmptyState>
				{/if}
			</section>
		{:else}
			<!-- Places → Stays → Food straight after Explore (user, 2026-11-11), each row its own card style:
			     tall photo tiles · listing cards with price · compact thumbnail cards. -->
			{#if full(data.placeRow.length)}
				<section aria-labelledby="places-title" class="flex scroll-scope flex-col gap-3">
					<div class="flex items-baseline justify-between gap-4">
						<h2 id="places-title" class="type-h2">{m.discover_places()}</h2>
						{@render seeAll(resolve('/map'), m.discover_on_map())}
					</div>
					<ul
						class="scroll-row -mx-5 flex snap-x snap-mandatory scroll-px-5 gap-3 overflow-x-auto px-5 pb-1 lg:mx-0 lg:scroll-px-0 lg:px-0"
						data-clip-check
					>
						{#each data.placeRow as p, i (p.slug)}
							<li class="w-44 shrink-0 snap-start lg:w-52">
								<a
									href={resolve('/place/[slug]', { slug: p.slug })}
									class={[
										'group relative isolate flex h-60 flex-col justify-between overflow-hidden rounded-lg bg-surface-2 bg-cover bg-center p-3 no-underline shadow-e1 transition-shadow duration-300 ease-brand hover:shadow-e2 lg:h-68',
										p.photo ? 'text-white' : 'text-text'
									]}
									style:background-image={p.photo?.lqip ? `url(${p.photo.lqip})` : undefined}
								>
									<div class="absolute inset-0 -z-10">
										{#if p.photo}
											<img
												src={p.photo.src}
												srcset={p.photo.srcset}
												sizes="208px"
												alt={p.photo.alt}
												loading={i < 2 ? 'eager' : 'lazy'}
												fetchpriority={i === 0 ? 'high' : 'auto'}
												class="size-full object-cover transition-transform duration-500 ease-brand group-hover:scale-105"
											/>
											<span
												class="absolute inset-0 bg-linear-to-t from-black/75 via-black/10 to-transparent"
											></span>
										{:else}<NoPhoto category={p.category} label={false} />{/if}
									</div>
									<span
										class={[
											'flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 type-small font-semibold',
											p.photo ? 'bg-black/55 lg:bg-black/35 lg:backdrop-blur-sm' : 'bg-surface'
										]}
										><CategoryIcon category={p.category} size={14} />{msg(
											`cat_${p.category}`
										)}</span
									>
									<span class="flex flex-col items-start gap-1.5"
										>{@render monsoonBadge(p.monsoon)}<span class="type-body-strong text-balance"
											>{nameOf(p.names)}</span
										></span
									>
								</a>
							</li>
						{/each}
					</ul>
					<ScrollProgress />
				</section>
			{/if}

			{#if full(data.stays.length)}
				<section aria-labelledby="stays-title" class="flex flex-col gap-3">
					<div class="flex items-baseline justify-between gap-4">
						<h2 id="stays-title" class="type-h2">{m.stays_title()}</h2>
						{@render seeAll(resolve('/stays'), m.see_all())}
					</div>
					<Carousel label={m.stays_title()}>
						{#each data.stays as s (s.slug)}
							<li>
								<StayCard
									href={resolve('/stays/[slug]', { slug: s.slug })}
									slug={s.slug}
									names={s.names}
									photo={s.photo}
									priceMin={s.priceMin}
									priceMax={s.priceMax}
									priceSource={s.priceSource}
									serviceStyle={s.serviceStyle}
								/>
							</li>
						{/each}
					</Carousel>
				</section>
			{/if}

			{#if full(data.eateries.length)}
				<section aria-labelledby="food-title" class="flex scroll-scope flex-col gap-3">
					<div class="flex items-baseline justify-between gap-4">
						<h2 id="food-title" class="type-h2">{m.food_title()}</h2>
						{@render seeAll(resolve('/food'), m.see_all())}
					</div>
					<ul
						class="scroll-row -mx-5 flex snap-x snap-mandatory scroll-px-5 gap-3 overflow-x-auto px-5 pb-1 lg:mx-0 lg:scroll-px-0 lg:px-0"
						data-clip-check
					>
						{#each data.eateries as e (e.slug)}
							<li class="w-72 shrink-0 snap-start">
								<a
									href={resolve('/food/[slug]', { slug: e.slug })}
									class="flex h-full items-center gap-3 rounded-lg border border-border bg-surface p-2.5 text-text no-underline transition-colors duration-300 ease-brand hover:bg-surface-2"
								>
									<div
										class="size-20 shrink-0 overflow-hidden rounded-md bg-surface-2 bg-cover"
										style:background-image={e.photo?.lqip ? `url(${e.photo.lqip})` : undefined}
									>
										{#if e.photo}<img
												src={e.photo.src}
												srcset={e.photo.srcset}
												sizes="80px"
												alt={e.photo.alt}
												loading="lazy"
												class="size-full object-cover"
											/>{:else}<NoPhoto kind="eatery" label={false} />{/if}
									</div>
									<div class="flex min-w-0 flex-col gap-0.5">
										<span class="line-clamp-2 type-body-strong">{e.name}</span>
										{#if e.signature}<span
												class="flex items-center gap-1 truncate type-small text-alphonso-ink"
												><Utensils
													size={14}
													aria-hidden="true"
													class="shrink-0"
												/>{e.signature}</span
											>{/if}
										<span class="flex flex-wrap items-center gap-x-2.5 type-small text-text-2">
											{#if e.priceForTwo != null}{m.price_for_two({
													price: formatINR(e.priceForTwo)
												})}{/if}
											{#if e.veg}<span class="flex items-center gap-1"
													><span class="size-2 rounded-full bg-ok" aria-hidden="true"
													></span>{m.diet_veg()}</span
												>{/if}
											{#if e.nonVeg}<span class="flex items-center gap-1"
													><span class="size-2 rounded-full bg-danger" aria-hidden="true"
													></span>{m.diet_nonveg()}</span
												>{/if}
										</span>
									</div>
								</a>
							</li>
						{/each}
					</ul>
					<ScrollProgress />
				</section>
			{/if}

			<div class="laterite-course" aria-hidden="true"></div>

			{#if full(data.gems.length)}
				<section aria-labelledby="gems-title" class="flex flex-col gap-3">
					<h2 id="gems-title" class="type-h2">{m.discover_hidden_gems()}</h2>
					<Carousel label={m.discover_hidden_gems()}>
						{#each data.gems as p (p.slug)}
							<li>
								<HeroCard
									href={resolve('/place/[slug]', { slug: p.slug })}
									item={{ type: 'place', slug: p.slug }}
									photo={p.photo}
									names={p.names}
									category={p.category}
									sub={msg(`cat_${p.category}`)}
								>
									{#snippet badges()}<StatusBadge kind="gem" glass />{@render monsoonBadge(
											p.monsoon
										)}{/snippet}
								</HeroCard>
							</li>
						{/each}
					</Carousel>
				</section>
			{/if}

			{#if full(data.itineraries.length)}
				<section aria-labelledby="itin-title" class="flex scroll-scope flex-col gap-3">
					<div class="flex items-baseline justify-between gap-4">
						<h2 id="itin-title" class="type-h2">{m.itin_title()}</h2>
						{@render seeAll(resolve('/itineraries'), m.itin_all())}
					</div>
					<ItineraryList items={data.itineraries} row />
				</section>
			{/if}

			{#if full(data.dishes.length)}
				<section aria-labelledby="taste-title" class="flex scroll-scope flex-col gap-3">
					<div class="flex items-baseline justify-between gap-4">
						<h2 id="taste-title" class="type-h2">{m.discover_taste()}</h2>
						{@render seeAll(resolve('/taste-konkan'), m.see_all())}
					</div>
					<ul
						class="scroll-row -mx-5 flex gap-4 overflow-x-auto px-5 pb-1 lg:mx-0 lg:gap-5 lg:px-0"
						data-clip-check
					>
						{#each data.dishes as d (d.slug)}
							<li class="w-22 shrink-0">
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
					<ScrollProgress />
				</section>
			{/if}

			<section aria-labelledby="near-title" class="flex flex-col gap-3">
				<h2 id="near-title" class="type-h2">{m.discover_near_me()}</h2>
				{#if near.length}
					<Carousel label={m.discover_near_me()}>
						{#each near as p (p.slug)}
							<li>
								<PlaceCard
									href={resolve('/place/[slug]', { slug: p.slug })}
									slug={p.slug}
									names={p.names}
									photo={p.photo}
									category={p.category}
									categoryLabel={msg(`cat_${p.category}`)}
									distanceKm={p.km}
								>
									{#snippet verdict()}<MiniVerdict type="place" agg={p.agg} />{/snippet}
								</PlaceCard>
							</li>
						{/each}
					</Carousel>
				{:else if locError}
					<div class="flex flex-col items-start gap-2" data-testid="near-denied">
						<Illustration name="compass" class="w-32" />
						<p class="type-body text-text-2">{m.discover_location_denied()}</p>
					</div>
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
