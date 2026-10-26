<script lang="ts">
	import Clock from '@lucide/svelte/icons/clock';
	import Ticket from '@lucide/svelte/icons/ticket';
	import CalendarDays from '@lucide/svelte/icons/calendar-days';
	import Route from '@lucide/svelte/icons/route';
	import TrainFront from '@lucide/svelte/icons/train-front';
	import Bus from '@lucide/svelte/icons/bus';
	import Check from '@lucide/svelte/icons/check';
	import X from '@lucide/svelte/icons/x';
	import MapPin from '@lucide/svelte/icons/map-pin';
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';
	import { getLocale } from '#lib/paraglide/runtime.js';
	import { clock, msg } from '#lib/msg.ts';
	import { formatNumber } from '#lib/format.ts';
	import Page from '#lib/components/Page.svelte';
	import Button from '#lib/components/Button.svelte';
	import StatusBadge from '#lib/components/StatusBadge.svelte';
	import CategoryIcon, { type Category } from '#lib/components/CategoryIcon.svelte';
	import Hero from '#lib/components/listing/Hero.svelte';
	import NearbyList from '#lib/components/listing/NearbyList.svelte';
	import Facts from '#lib/components/listing/Facts.svelte';
	import { todayLine } from '#lib/components/listing/Hours.svelte';
	import AudioGuide from '#lib/components/listing/AudioGuide.svelte';
	import ReportProblem from '#lib/components/listing/ReportProblem.svelte';
	import TideToday from '#lib/components/map/TideToday.svelte';
	import TideSlider from '#lib/components/map/TideSlider.svelte';
	import VerdictGauge from '#lib/components/rating/VerdictGauge.svelte';
	import VerdictVote from '#lib/components/rating/VerdictVote.svelte';
	import Reviews from '#lib/components/rating/Reviews.svelte';
	import type { PageProps } from './$types';

	// Layout order LOCKED (FRONTEND §7.2) on phones; CSS `order` keeps it while laptops split into a story
	// column (7/12) and a facts column (5/12: verdict, vote, facts, status). Tideline (Report 2 §9.2): an
	// immersive hero under a transparent bar, the content sheet overlapping it by 28 px.
	let { data }: PageProps = $props();
	const p = $derived(data.place);
	const lang = getLocale();
	const primary = $derived(p.names[lang] || p.names.en);
	const secondary = $derived(lang === 'en' ? p.names.mr : p.names.en);
	const apps = $derived(
		Object.entries(p.foodDelivery)
			.filter(([, v]) => v)
			.map(([k]) => k)
	);
	// Story: the first paragraph is the lead (Report 2 §9.2).
	const story = $derived(p.text.story?.split(/\n\s*\n/) ?? []);
	const pinName = (x: {
		name_en: string | null;
		name_hi: string | null;
		name_mr: string | null;
		slug: string;
	}) => (lang === 'hi' ? x.name_hi : lang === 'mr' ? x.name_mr : null) || x.name_en || x.slug;
	const timings = $derived(
		todayLine(
			p.hours,
			lang,
			{
				unknown: m.hours_unknown(),
				closed: m.closed_today(),
				open: (o, c) => m.open_today({ opens: o, closes: c })
			},
			clock
		)
	);
</script>

{#snippet altCard(
	x: {
		slug: string;
		category: string;
		km: number | string;
		name_en: string | null;
		name_hi: string | null;
		name_mr: string | null;
	},
	meta: string
)}
	<li class="w-64 shrink-0 lg:w-auto">
		<a
			href={resolve('/place/[slug]', { slug: x.slug })}
			class="flex h-full items-center gap-3 rounded-lg bg-surface p-3 text-text no-underline shadow-e1 transition-shadow duration-300 ease-brand hover:shadow-e2"
		>
			<CategoryIcon category={x.category as Category} tile />
			<span class="flex min-w-0 flex-col">
				<span class="type-body-strong">{pinName(x)}</span>
				<span class="type-small text-text-2"
					>{meta} · {m.km_away({ km: formatNumber(Number(x.km)) })}</span
				>
			</span>
		</a>
	</li>
{/snippet}

<Page
	title={primary}
	back
	overlay
	heading={false}
	description={p.text.story || p.text.significance}
	image={p.photos[0]?.src}
>
	<Hero photo={p.photos[0] ?? null} category={p.category} immersive />

	<!-- Phones: a sheet over the photo. Laptops: the 7/5 grid under the hero. -->
	<article
		class="relative -mx-5 -mt-7 flex flex-col gap-8 rounded-t-xl bg-bg px-5 pt-6 lg:mx-0 lg:mt-8 lg:grid lg:grid-cols-12 lg:items-start lg:gap-x-10 lg:rounded-none lg:px-0 lg:pt-0"
	>
		<div class="contents lg:col-span-7 lg:flex lg:flex-col lg:gap-10">
			<header class="order-1 flex flex-col gap-3 lg:order-none">
				<div>
					<h2 class="type-display">{primary}</h2>
					<p class="mt-1 type-small text-text-2">
						{#if secondary && secondary !== primary}<span lang={lang === 'en' ? 'mr' : 'en'}
								>{secondary}</span
							>
							·
						{/if}{[msg(`cat_${p.category}`), p.taluka].filter(Boolean).join(' · ')}
					</p>
				</div>
				<div class="flex flex-wrap gap-2 empty:hidden">
					{#if p.isGem}<StatusBadge kind="gem" />{/if}
					{#if p.crowdToday}<StatusBadge kind="crowd" level={p.crowdToday} live={false} />{/if}
					{#if p.monsoon !== 'open'}<StatusBadge
							kind="monsoon"
							state={p.monsoon}
							label={p.monsoonReason || msg(`monsoon_${p.monsoon}`)}
						/>{/if}
				</div>
				{#if p.coords}
					<!-- Place → map hand-off (Report 1 §4.3): the map opens on this pin, sheet at half height. -->
					<div>
						<Button variant="secondary" href={`${resolve('/map')}?focus=place/${p.slug}`}>
							{#snippet icon()}<MapPin size={20} aria-hidden="true" />{/snippet}
							{m.map_see_on_map()}
						</Button>
					</div>
				{/if}
			</header>

			{#if p.audio}<div class="order-2 lg:order-none">
					<AudioGuide path={p.audio.storage_path} transcript={p.audio.transcript} />
				</div>{/if}

			{#if story.length || p.text.history || p.text.significance}
				<div class="order-6 flex max-w-170 flex-col gap-8 lg:order-none">
					{#if story.length}
						<section class="flex flex-col gap-3">
							<h2 class="type-h2">{m.place_story()}</h2>
							{#each story as para, i (i)}
								<p class={[i ? 'type-body' : 'type-lead', 'whitespace-pre-line']}>{para}</p>
							{/each}
						</section>
					{/if}
					{#each [['place_history', p.text.history], ['place_significance', p.text.significance]] as [k, v] (k)}
						{#if v}<section class="flex flex-col gap-3">
								<h2 class="type-h2">{msg(k!)}</h2>
								<p class="type-body whitespace-pre-line text-text-2">{v}</p>
							</section>{/if}
					{/each}
				</div>
			{/if}

			{#if p.text.dos || p.text.donts}
				<section class="order-7 grid gap-3 sm:grid-cols-2 lg:order-none" data-clip-check>
					{#if p.text.dos}<div class="flex flex-col gap-2 rounded-lg bg-ok-50 p-4">
							<h2 class="flex items-center gap-2 type-h3">
								<Check size={20} aria-hidden="true" class="text-ok" />{m.place_dos()}
							</h2>
							<p class="type-body whitespace-pre-line">{p.text.dos}</p>
						</div>{/if}
					{#if p.text.donts}<div class="flex flex-col gap-2 rounded-lg bg-danger-50 p-4">
							<h2 class="flex items-center gap-2 type-h3">
								<X size={20} aria-hidden="true" class="text-danger" />{m.place_donts()}
							</h2>
							<p class="type-body whitespace-pre-line">{p.text.donts}</p>
						</div>{/if}
				</section>
			{/if}

			{#if data.nearby.listings.length || data.nearby.utilities.length}
				<section class="order-9 flex flex-col gap-3 lg:order-none">
					<h2 class="type-h2">{m.nearby()}</h2>
					<NearbyList listings={data.nearby.listings} utilities={data.nearby.utilities} />
				</section>
			{/if}

			{#if data.lessCrowded.length || data.similar.length}
				<div class="order-10 flex flex-col gap-8 lg:order-none" data-testid="similar">
					{#if data.lessCrowded.length}
						<section class="flex flex-col gap-3">
							<h2 class="type-h2">{m.less_crowded_title()}</h2>
							<ul
								class="-mx-5 flex gap-3 overflow-x-auto px-5 pb-1 lg:mx-0 lg:grid lg:grid-cols-2 lg:overflow-visible lg:px-0"
							>
								{#each data.lessCrowded as x (x.slug)}
									{@render altCard(x, msg(`crowd_${x.level}`))}
								{/each}
							</ul>
						</section>
					{/if}
					{#if data.similar.length}
						<section class="flex flex-col gap-3">
							<h2 class="type-h2">{m.similar_title()}</h2>
							<ul
								class="-mx-5 flex gap-3 overflow-x-auto px-5 pb-1 lg:mx-0 lg:grid lg:grid-cols-2 lg:overflow-visible lg:px-0"
							>
								{#each data.similar as x (x.slug)}
									{@render altCard(x, msg(`cat_${x.category}`))}
								{/each}
							</ul>
						</section>
					{/if}
				</div>
			{/if}

			<section class="order-11 flex flex-col gap-2 lg:order-none">
				<h2 class="type-h2">{m.food_delivery()}</h2>
				<p class="type-body text-text-2">
					{apps.length
						? apps.map((a) => a[0].toUpperCase() + a.slice(1)).join(' · ')
						: m.food_delivery_none()}
				</p>
			</section>

			<div class="order-12 lg:order-none">
				<Reviews reviews={data.ratings.reviews} summaries={data.ratings.summaries} />
			</div>

			<footer class="order-13 flex flex-col items-start gap-3 lg:order-none">
				{#if p.lastVerified}<StatusBadge kind="last-verified" date={p.lastVerified} />{/if}
				<ReportProblem entityType="place" entityId={p.id} />
			</footer>
		</div>

		<div class="contents lg:col-span-5 lg:flex lg:flex-col lg:gap-6">
			<div class="order-3 lg:order-none">
				<VerdictGauge type="place" all={data.ratings.all} groups={data.ratings.groups} />
			</div>
			<div class="order-4 lg:order-none">
				<VerdictVote
					type="place"
					id={p.id}
					dims={[]}
					mine={data.ratings.mine}
					signedIn={data.ratings.signedIn}
				/>
			</div>

			<section class="order-5 flex flex-col gap-3 lg:order-none">
				<h2 class="type-h2">{m.facts()}</h2>
				<Facts
					rows={[
						{ label: m.fact_timings(), value: timings, icon: Clock },
						{ label: m.fact_fee(), value: p.fee, icon: Ticket },
						{ label: m.fact_best_time(), value: p.bestTime, icon: CalendarDays },
						{ label: m.fact_how_to_reach(), value: p.howToReach, icon: Route },
						{ label: m.fact_station(), value: p.station, icon: TrainFront },
						{ label: m.fact_bus(), value: p.bus, icon: Bus }
					]}
				/>
			</section>

			<section
				class="order-8 flex flex-col gap-3 rounded-lg bg-surface p-4 shadow-e1 lg:order-none"
				aria-labelledby="status-title"
			>
				<h2 id="status-title" class="type-h2">{m.place_status()}</h2>
				<div>
					<StatusBadge
						kind="monsoon"
						state={p.monsoon}
						label={p.monsoonReason
							? `${msg(`monsoon_${p.monsoon}`)} · ${p.monsoonReason}`
							: msg(`monsoon_${p.monsoon}`)}
					/>
				</div>
				{#if p.tideDependent}<p class="type-small text-text-2">{m.tide_dependent()}</p>{/if}
				{#if p.tideStation}<TideToday station={p.tideStation} />{/if}
				{#if p.tideDependent && p.coords}<TideSlider
						slug={p.slug}
						lon={p.coords[0]}
						lat={p.coords[1]}
					/>{/if}
				{#if p.text.safety}<p class="type-body whitespace-pre-line">
						<strong class="type-body-strong">{m.place_safety()}:</strong>
						{p.text.safety}
					</p>{/if}
			</section>
		</div>
	</article>
</Page>
