<script lang="ts">
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';
	import { getLocale } from '#lib/paraglide/runtime.js';
	import { clock, msg } from '#lib/msg.ts';
	import { formatNumber } from '#lib/format.ts';
	import Page from '#lib/components/Page.svelte';
	import StatusBadge from '#lib/components/StatusBadge.svelte';
	import CategoryIcon from '#lib/components/CategoryIcon.svelte';
	import Hero from '#lib/components/listing/Hero.svelte';
	import Facts from '#lib/components/listing/Facts.svelte';
	import { todayLine } from '#lib/components/listing/Hours.svelte';
	import AudioGuide from '#lib/components/listing/AudioGuide.svelte';
	import ReportProblem from '#lib/components/listing/ReportProblem.svelte';
	import TideToday from '#lib/components/map/TideToday.svelte';
	import VerdictGauge from '#lib/components/rating/VerdictGauge.svelte';
	import VerdictVote from '#lib/components/rating/VerdictVote.svelte';
	import Reviews from '#lib/components/rating/Reviews.svelte';
	import type { PageProps } from './$types';

	// Layout order LOCKED (FRONTEND §7.2).
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
	const hrefFor = (kind: string, slug: string) =>
		kind === 'stay' ? resolve('/stays/[slug]', { slug }) : resolve('/food/[slug]', { slug });
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

<Page title={primary} back>
	<article class="mx-auto flex max-w-[680px] flex-col gap-6">
		<Hero photo={p.photos[0] ?? null} category={p.category} />

		<header class="flex flex-col gap-2">
			<h2 class="type-display">{primary}</h2>
			{#if secondary && secondary !== primary}<p
					class="type-h3 text-text-2"
					lang={lang === 'en' ? 'mr' : 'en'}
				>
					{secondary}
				</p>{/if}
			<p class="flex items-center gap-1.5 type-small text-text-2">
				<CategoryIcon category={p.category} size={20} />{msg(`cat_${p.category}`)}
			</p>
			<div class="flex flex-wrap gap-1.5">
				{#if p.crowdToday}<StatusBadge kind="crowd" level={p.crowdToday} live={false} />{/if}
				{#if p.monsoon !== 'open'}<StatusBadge
						kind="monsoon"
						state={p.monsoon}
						label={p.monsoonReason || msg(`monsoon_${p.monsoon}`)}
					/>{/if}
				{#if p.isGem}<StatusBadge kind="gem" />{/if}
			</div>
		</header>

		{#if p.audio}<AudioGuide path={p.audio.storage_path} transcript={p.audio.transcript} />{/if}

		<VerdictGauge type="place" all={data.ratings.all} groups={data.ratings.groups} />
		<VerdictVote
			type="place"
			id={p.id}
			dims={[]}
			mine={data.ratings.mine}
			signedIn={data.ratings.signedIn}
		/>

		<section class="flex flex-col gap-3">
			<h2 class="type-h2">{m.facts()}</h2>
			<Facts
				rows={[
					{ label: m.fact_timings(), value: timings },
					{ label: m.fact_fee(), value: p.fee },
					{ label: m.fact_best_time(), value: p.bestTime },
					{ label: m.fact_how_to_reach(), value: p.howToReach },
					{ label: m.fact_station(), value: p.station },
					{ label: m.fact_bus(), value: p.bus }
				]}
			/>
		</section>

		{#each [['place_story', p.text.story], ['place_history', p.text.history], ['place_significance', p.text.significance]] as [k, v] (k)}
			{#if v}<section class="flex flex-col gap-2">
					<h2 class="type-h2">{msg(k!)}</h2>
					<p class="type-body whitespace-pre-line">{v}</p>
				</section>{/if}
		{/each}

		{#if p.text.dos || p.text.donts}
			<section class="grid gap-3 sm:grid-cols-2">
				{#if p.text.dos}<div class="rounded-card border border-border bg-surface p-4">
						<h2 class="type-h3">{m.place_dos()}</h2>
						<p class="type-body whitespace-pre-line">{p.text.dos}</p>
					</div>{/if}
				{#if p.text.donts}<div class="rounded-card border border-border bg-surface p-4">
						<h2 class="type-h3">{m.place_donts()}</h2>
						<p class="type-body whitespace-pre-line">{p.text.donts}</p>
					</div>{/if}
			</section>
		{/if}

		<section class="flex flex-col gap-3">
			<h2 class="type-h2">{m.place_status()}</h2>
			<div class="flex flex-wrap gap-1.5">
				<StatusBadge
					kind="monsoon"
					state={p.monsoon}
					label={p.monsoonReason
						? `${msg(`monsoon_${p.monsoon}`)} · ${p.monsoonReason}`
						: msg(`monsoon_${p.monsoon}`)}
				/>
			</div>
			{#if p.tideDependent}<p class="type-body">{m.tide_dependent()}</p>{/if}
			{#if p.tideStation}<TideToday station={p.tideStation} />{/if}
			{#if p.text.safety}<p class="type-body whitespace-pre-line">
					<strong class="type-h3">{m.place_safety()}:</strong>
					{p.text.safety}
				</p>{/if}
		</section>

		{#if data.nearby.listings.length || data.nearby.utilities.length}
			<section class="flex flex-col gap-3">
				<h2 class="type-h2">{m.nearby()}</h2>
				{#if data.nearby.listings.length}
					<h3 class="type-h3">{m.nearby_listings()}</h3>
					<ul
						class="flex flex-col divide-y divide-border rounded-card border border-border bg-surface"
					>
						{#each data.nearby.listings as x (x.id)}
							<li>
								<a
									href={hrefFor(x.kind, x.slug)}
									class="flex justify-between gap-3 px-4 py-3 text-text no-underline"
									><span class="type-body">{pinName(x)}</span><span class="type-small text-text-2"
										>{m.km_away({ km: formatNumber(x.km) })}</span
									></a
								>
							</li>
						{/each}
					</ul>
				{/if}
				{#if data.nearby.utilities.length}
					<h3 class="type-h3">{m.nearby_services()}</h3>
					<ul
						class="flex flex-col divide-y divide-border rounded-card border border-border bg-surface"
					>
						{#each data.nearby.utilities as u (u.id)}
							<li class="flex justify-between gap-3 px-4 py-3">
								<span class="type-body">{msg(`util_${u.type}`)}{u.name ? ` · ${u.name}` : ''}</span
								><span class="type-small text-text-2">{m.km_away({ km: formatNumber(u.km) })}</span>
							</li>
						{/each}
					</ul>
				{/if}
			</section>
		{/if}

		{#if data.lessCrowded.length || data.similar.length}
			<section class="flex flex-col gap-3" data-testid="similar">
				{#if data.lessCrowded.length}
					<h2 class="type-h2">{m.less_crowded_title()}</h2>
					<ul
						class="flex flex-col divide-y divide-border rounded-card border border-border bg-surface"
					>
						{#each data.lessCrowded as x (x.slug)}
							<li>
								<a
									href={resolve('/place/[slug]', { slug: x.slug })}
									class="flex justify-between gap-3 px-4 py-3 text-text no-underline"
									><span class="type-body">{pinName(x)} · {msg(`crowd_${x.level}`)}</span><span
										class="type-small text-text-2"
										>{m.km_away({ km: formatNumber(Number(x.km)) })}</span
									></a
								>
							</li>
						{/each}
					</ul>
				{/if}
				{#if data.similar.length}
					<h2 class="type-h2">{m.similar_title()}</h2>
					<ul
						class="flex flex-col divide-y divide-border rounded-card border border-border bg-surface"
					>
						{#each data.similar as x (x.slug)}
							<li>
								<a
									href={resolve('/place/[slug]', { slug: x.slug })}
									class="flex justify-between gap-3 px-4 py-3 text-text no-underline"
									><span class="type-body">{pinName(x)} · {msg(`cat_${x.category}`)}</span><span
										class="type-small text-text-2"
										>{m.km_away({ km: formatNumber(Number(x.km)) })}</span
									></a
								>
							</li>
						{/each}
					</ul>
				{/if}
			</section>
		{/if}

		<section class="flex flex-col gap-2">
			<h2 class="type-h2">{m.food_delivery()}</h2>
			<p class="type-body">
				{apps.length
					? apps.map((a) => a[0].toUpperCase() + a.slice(1)).join(' · ')
					: m.food_delivery_none()}
			</p>
		</section>

		<Reviews reviews={data.ratings.reviews} summaries={data.ratings.summaries} />

		<footer class="flex flex-col gap-3 border-t border-border pt-4">
			{#if p.lastVerified}<StatusBadge kind="last-verified" date={p.lastVerified} />{/if}
			<ReportProblem entityType="place" entityId={p.id} />
		</footer>
	</article>
</Page>
