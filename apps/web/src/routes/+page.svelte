<script lang="ts">
	import Search from '@lucide/svelte/icons/search';
	import LocateFixed from '@lucide/svelte/icons/locate-fixed';
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';
	import { getLocale } from '#lib/paraglide/runtime.js';
	import { msg } from '#lib/msg.ts';
	import Page from '#lib/components/Page.svelte';
	import PlaceCard from '#lib/components/PlaceCard.svelte';
	import StatusBadge from '#lib/components/StatusBadge.svelte';
	import EmptyState from '#lib/components/EmptyState.svelte';
	import Button from '#lib/components/Button.svelte';
	import CategoryIcon, { categoryIcons, type Category } from '#lib/components/CategoryIcon.svelte';
	import type { PageProps } from './$types';

	// Layout order LOCKED (FRONTEND §7.1): search → season strip → categories → hidden gems → (itineraries, P7)
	// → Taste Konkan → near me.
	let { data }: PageProps = $props();
	const lang = getLocale();

	let q = $state('');
	let results = $state<{ kind: string; slug: string; name: string }[]>([]);
	let timer: ReturnType<typeof setTimeout>;
	function onSearch() {
		clearTimeout(timer);
		if (q.trim().length < 2) return void (results = []);
		timer = setTimeout(async () => {
			const r = await fetch(`/api/map/search?q=${encodeURIComponent(q.trim())}`);
			results = r.ok ? await r.json() : [];
		}, 300);
	}
	const hrefFor = (kind: string, slug: string) =>
		kind === 'place'
			? resolve('/place/[slug]', { slug })
			: kind === 'stay'
				? resolve('/stays/[slug]', { slug })
				: resolve('/food/[slug]', { slug });

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
</script>

<Page title={data.category ? msg(`cat_${data.category}`) : m.app_name()} back={!!data.category}>
	<div class="flex flex-col gap-8">
		<div class="relative">
			<label
				class="flex h-12 items-center gap-2 rounded-input border border-border bg-surface px-3"
			>
				<Search size={20} aria-hidden="true" class="text-text-2" />
				<span class="sr-only">{m.discover_search()}</span>
				<input
					bind:value={q}
					oninput={onSearch}
					type="search"
					placeholder={m.discover_search()}
					class="h-full min-w-0 flex-1 bg-transparent type-body outline-none"
				/>
			</label>
			{#if results.length}
				<ul
					class="absolute inset-x-0 z-10 mt-1 overflow-hidden rounded-card border border-border bg-raised shadow-float"
				>
					{#each results as r, i (i)}
						<li>
							<a
								href={hrefFor(r.kind, r.slug)}
								class="block px-4 py-3 type-body text-text no-underline">{r.name}</a
							>
						</li>
					{/each}
				</ul>
			{/if}
		</div>

		{#if !data.category && (data.season.seasons.length || data.season.events.length)}
			<section class="flex flex-wrap items-center gap-2" aria-label={m.discover_season()}>
				<span class="type-small text-text-2">{m.discover_season()}</span>
				{#each data.season.seasons as s (s)}
					<span class="rounded-chip bg-mango-100 px-3 py-1 type-tiny text-mango-900"
						>{msg(`season_${s}`)}</span
					>
				{/each}
				{#each data.season.events as e (e.name_en)}
					<span class="rounded-chip bg-sea-50 px-3 py-1 type-tiny text-sea-900"
						>{(lang === 'hi' ? e.name_hi : lang === 'mr' ? e.name_mr : null) || e.name_en}</span
					>
				{/each}
			</section>
		{/if}

		<section class="flex flex-col gap-3">
			<h2 class="type-h2">{m.discover_categories()}</h2>
			<ul class="grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-11">
				{#each Object.keys(categoryIcons) as c (c)}
					<li>
						<a
							href={resolve(`/?category=${c}`)}
							aria-current={data.category === c ? 'page' : undefined}
							class={[
								'flex min-h-11 flex-col items-center gap-1 rounded-card border p-2 text-center type-tiny no-underline',
								data.category === c
									? 'border-sea-500 bg-sea-50 text-sea-900'
									: 'border-border bg-surface text-text'
							]}
						>
							<CategoryIcon category={c as Category} size={24} />{msg(`cat_${c}`)}
						</a>
					</li>
				{/each}
			</ul>
		</section>

		{#if data.category}
			<section class="flex flex-col gap-3">
				{#if data.places.length}
					<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
						{#each data.places as p (p.slug)}
							<PlaceCard
								href={resolve('/place/[slug]', { slug: p.slug })}
								names={p.names}
								photo={p.photo}
								category={p.category}
								categoryLabel={msg(`cat_${p.category}`)}
							/>
						{/each}
					</div>
				{:else}
					<EmptyState title={m.soon_title()} body={m.discover_empty()} />
				{/if}
			</section>
		{:else}
			{#if data.gems.length}
				<section class="flex flex-col gap-3">
					<h2 class="type-h2">{m.discover_hidden_gems()}</h2>
					<div class="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2">
						{#each data.gems as p (p.slug)}
							<div class="w-72 shrink-0 snap-start">
								<PlaceCard
									href={resolve('/place/[slug]', { slug: p.slug })}
									names={p.names}
									photo={p.photo}
									category={p.category}
									categoryLabel={msg(`cat_${p.category}`)}
								>
									{#snippet badges()}<StatusBadge kind="gem" />{/snippet}
								</PlaceCard>
							</div>
						{/each}
					</div>
				</section>
			{/if}

			{#if data.dishes.length}
				<section class="flex flex-col gap-3">
					<div class="flex items-baseline justify-between">
						<h2 class="type-h2">{m.discover_taste()}</h2>
						<a href={resolve('/taste-konkan')} class="type-small">{m.see_all()}</a>
					</div>
					<ul class="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2">
						{#each data.dishes as d (d.slug)}
							<li class="w-36 shrink-0">
								<a
									href={resolve('/taste-konkan/[dish]', { dish: d.slug })}
									class="flex flex-col gap-2 text-text no-underline"
								>
									<div
										class="aspect-square overflow-hidden rounded-card bg-sand-200 bg-cover dark:bg-raised"
										style:background-image={d.photo?.lqip ? `url(${d.photo.lqip})` : undefined}
									>
										{#if d.photo}<img
												src={d.photo.src}
												srcset={d.photo.srcset}
												sizes="144px"
												alt={d.photo.alt}
												loading="lazy"
												class="h-full w-full object-cover"
											/>{/if}
									</div>
									<span class="type-h3">{d.name}</span>
								</a>
							</li>
						{/each}
					</ul>
				</section>
			{/if}

			<section class="flex flex-col gap-3">
				<h2 class="type-h2">{m.discover_near_me()}</h2>
				{#if near.length}
					<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
						{#each near as p (p.slug)}
							<PlaceCard
								href={resolve('/place/[slug]', { slug: p.slug })}
								names={p.names}
								photo={p.photo}
								category={p.category}
								categoryLabel={msg(`cat_${p.category}`)}
								distanceKm={p.km}
							/>
						{/each}
					</div>
				{:else if locError}
					<p class="type-body text-text-2">{m.discover_location_denied()}</p>
				{:else if data.places.length}
					<div>
						<Button variant="secondary" onclick={nearMe}>
							{#snippet icon()}<LocateFixed size={20} aria-hidden="true" />{/snippet}
							{m.discover_near_me_cta()}
						</Button>
					</div>
				{:else}
					<EmptyState title={m.soon_title()} body={m.soon_discover()} />
				{/if}
			</section>
		{/if}
	</div>
</Page>
