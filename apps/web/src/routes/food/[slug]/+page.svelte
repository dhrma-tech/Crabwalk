<script lang="ts">
	import MapPin from '@lucide/svelte/icons/map-pin';
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';
	import { getLocale } from '#lib/paraglide/runtime.js';
	import { msg } from '#lib/msg.ts';
	import { formatINR, menuLine } from '#lib/format.ts';
	import Page from '#lib/components/Page.svelte';
	import Button from '#lib/components/Button.svelte';
	import StatusBadge from '#lib/components/StatusBadge.svelte';
	import NoPhoto from '#lib/components/NoPhoto.svelte';
	import Hero from '#lib/components/listing/Hero.svelte';
	import Hours from '#lib/components/listing/Hours.svelte';
	import Contact from '#lib/components/listing/Contact.svelte';
	import ReportProblem from '#lib/components/listing/ReportProblem.svelte';
	import VerdictGauge from '#lib/components/rating/VerdictGauge.svelte';
	import VerdictVote from '#lib/components/rating/VerdictVote.svelte';
	import SubScores from '#lib/components/rating/SubScores.svelte';
	import Reviews from '#lib/components/rating/Reviews.svelte';
	import type { PageProps } from './$types';

	// FRONTEND §7.6 detail (LOCKED on phones): signature dishes → menu → sub-scores → food-app buttons. Tideline
	// (Report 2 §9.5): the Place skeleton (T-25) with dishes as round photo chips, the menu in two columns with dot
	// leaders, and brand-neutral outline buttons per food app. Laptops: story 7/12, verdict + order 5/12.
	let { data }: PageProps = $props();
	const e = $derived(data.eatery);
	const lang = getLocale();
	const primary = $derived(e.names[lang] || e.names.en);
	const secondary = $derived(lang === 'en' ? e.names.mr : e.names.en);
	const appName = (a: string) => a[0].toUpperCase() + a.slice(1);
	const dietLabel = { veg: m.diet_veg, non_veg: m.diet_nonveg, jain: m.diet_jain };
</script>

<Page
	title={primary}
	back
	overlay
	heading={false}
	description={e.description}
	image={e.photos[0]?.src}
>
	<Hero photo={e.photos[0] ?? null} kind="eatery" immersive />

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
					<p class="mt-1 type-small text-text-2">
						{[
							e.authenticity ? msg(`auth_${e.authenticity}`) : null,
							e.priceForTwo != null ? m.price_for_two({ price: formatINR(e.priceForTwo) }) : null,
							...e.diet.map((d) => dietLabel[d]())
						]
							.filter(Boolean)
							.join(' · ')}
					</p>
				</div>
				{#if e.verified}<div><StatusBadge kind="verified" /></div>{/if}
				{#if e.coords}
					<div>
						<Button variant="secondary" href={`${resolve('/map')}?focus=eatery/${e.slug}`}>
							{#snippet icon()}<MapPin size={20} aria-hidden="true" />{/snippet}
							{m.map_see_on_map()}
						</Button>
					</div>
				{/if}
			</header>

			{#if e.description}<p class="order-5 max-w-170 type-lead whitespace-pre-line lg:order-none">
					{e.description}
				</p>{/if}

			{#if e.dishes.length}
				<section class="order-6 flex flex-col gap-3 lg:order-none">
					<h2 class="type-h2">{m.signature_dishes()}</h2>
					<ul class="flex flex-wrap gap-2" data-clip-check>
						{#each e.dishes as d (d.slug)}
							<li>
								<a
									href={resolve('/taste-konkan/[dish]', { dish: d.slug })}
									class="flex min-h-12 items-center gap-2.5 rounded-full bg-surface-2 py-1 pr-4 pl-1 type-body text-text no-underline transition-colors duration-200 hover:bg-surface-3"
								>
									<span class="size-10 shrink-0 overflow-hidden rounded-full">
										{#if d.photo}<img
												src={d.photo.src}
												srcset={d.photo.srcset}
												sizes="40px"
												alt=""
												loading="lazy"
												class="h-full w-full object-cover"
											/>{:else}<NoPhoto kind="dish" label={false} />{/if}
									</span>
									{d.name}
								</a>
							</li>
						{/each}
					</ul>
				</section>
			{/if}

			{#if e.menu.length}
				<section class="order-7 flex flex-col gap-3 lg:order-none">
					<h2 class="type-h2">{m.menu()}</h2>
					<ul class="gap-8 rounded-lg bg-surface p-4 shadow-e1 sm:columns-2" data-clip-check>
						{#each e.menu.map(menuLine) as item, i (i)}
							<li class="flex break-inside-avoid items-baseline gap-2 py-1.5 type-body">
								<span>{item.name}</span>
								{#if item.price}
									<span
										class="min-w-4 flex-1 border-b-2 border-dotted border-border-strong"
										aria-hidden="true"
									></span>
									<span class="shrink-0 type-body-strong tabular-nums">{item.price}</span>
								{/if}
							</li>
						{/each}
					</ul>
				</section>
			{/if}

			<section class="order-9 flex flex-col gap-3 lg:order-none">
				<h2 class="type-h2">{m.hours()}</h2>
				<Hours rows={e.hours} />
			</section>

			<div class="order-11 lg:order-none">
				<Reviews reviews={data.ratings.reviews} summaries={data.ratings.summaries} />
			</div>

			<footer class="order-12 flex flex-col items-start gap-3 lg:order-none">
				{#if e.lastVerified}<StatusBadge kind="last-verified" date={e.lastVerified} />{/if}
				{#if !e.claimed}<a
						href={resolve('/owner/claim/[type]/[id]', { type: 'eatery', id: e.id })}
						class="inline-flex min-h-11 items-center type-small">{m.claim_cta()}</a
					>{/if}
				<ReportProblem entityType="eatery" entityId={e.id} />
			</footer>
		</div>

		<div class="contents lg:col-span-5 lg:flex lg:flex-col lg:gap-6">
			<div class="order-2 lg:order-none">
				<VerdictGauge type="eatery" all={data.ratings.all} groups={data.ratings.groups} />
			</div>
			<div class="order-3 lg:order-none">
				<SubScores dims={data.dims} subs={data.ratings.subs} />
			</div>
			<div class="order-4 lg:order-none">
				<VerdictVote
					type="eatery"
					id={e.id}
					dims={data.dims}
					mine={data.ratings.mine}
					signedIn={data.ratings.signedIn}
				/>
			</div>

			{#if e.apps.length}
				<!-- Brand-neutral: outline buttons with the app's name, no logos (Report 2 §9.5). -->
				<section class="order-8 flex flex-wrap gap-2 lg:order-none">
					{#each e.apps as a (a.app)}<Button variant="outline" href={a.link}
							>{m.order_on({ app: appName(a.app) })}</Button
						>{/each}
				</section>
			{/if}

			<div class="order-10 lg:order-none">
				<Contact phone={e.phone} whatsapp={e.whatsapp} />
			</div>
		</div>
	</article>
</Page>
