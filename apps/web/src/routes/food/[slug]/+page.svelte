<script lang="ts">
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';
	import { getLocale } from '#lib/paraglide/runtime.js';
	import { msg } from '#lib/msg.ts';
	import { formatINR } from '#lib/format.ts';
	import Page from '#lib/components/Page.svelte';
	import Button from '#lib/components/Button.svelte';
	import StatusBadge from '#lib/components/StatusBadge.svelte';
	import Hero from '#lib/components/listing/Hero.svelte';
	import Hours from '#lib/components/listing/Hours.svelte';
	import Contact from '#lib/components/listing/Contact.svelte';
	import ReportProblem from '#lib/components/listing/ReportProblem.svelte';
	import type { PageProps } from './$types';

	// FRONTEND §7.6 detail: signature dishes → menu → (sub-scores, P5) → food-app buttons (deep links).
	let { data }: PageProps = $props();
	const e = $derived(data.eatery);
	const lang = getLocale();
	const primary = $derived(e.names[lang] || e.names.en);
	const secondary = $derived(lang === 'en' ? e.names.mr : e.names.en);
	const appName = (a: string) => a[0].toUpperCase() + a.slice(1);
	const dietLabel = { veg: m.diet_veg, non_veg: m.diet_nonveg, jain: m.diet_jain };
</script>

<Page title={primary} back>
	<article class="mx-auto flex max-w-[680px] flex-col gap-6">
		<Hero photo={e.photos[0] ?? null} />
		<header class="flex flex-col gap-2">
			<h2 class="type-display">{primary}</h2>
			{#if secondary && secondary !== primary}<p
					class="type-h3 text-text-2"
					lang={lang === 'en' ? 'mr' : 'en'}
				>
					{secondary}
				</p>{/if}
			<p class="type-small text-text-2">
				{[
					e.authenticity ? msg(`auth_${e.authenticity}`) : null,
					e.priceForTwo != null ? m.price_for_two({ price: formatINR(e.priceForTwo) }) : null,
					...e.diet.map((d) => dietLabel[d]())
				]
					.filter(Boolean)
					.join(' · ')}
			</p>
			{#if e.verified}<div><StatusBadge kind="verified" /></div>{/if}
		</header>
		{#if e.description}<p class="type-body whitespace-pre-line">{e.description}</p>{/if}

		{#if e.dishes.length}
			<section class="flex flex-col gap-3">
				<h2 class="type-h2">{m.signature_dishes()}</h2>
				<ul class="flex flex-wrap gap-2">
					{#each e.dishes as d (d.slug)}
						<li>
							<a
								href={resolve('/taste-konkan/[dish]', { dish: d.slug })}
								class="inline-flex min-h-11 items-center rounded-chip border border-border bg-surface px-4 type-small text-text no-underline"
								>{d.name}</a
							>
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		{#if e.menu.length}
			<section class="flex flex-col gap-2">
				<h2 class="type-h2">{m.menu()}</h2>
				<ul
					class="flex flex-col divide-y divide-border rounded-card border border-border bg-surface"
				>
					{#each e.menu as item, i (i)}<li class="px-4 py-2 type-body">{item}</li>{/each}
				</ul>
			</section>
		{/if}

		{#if e.apps.length}
			<section class="flex flex-wrap gap-2">
				{#each e.apps as a (a.app)}<Button variant="secondary" href={a.link}
						>{m.order_on({ app: appName(a.app) })}</Button
					>{/each}
			</section>
		{/if}

		<section class="flex flex-col gap-2">
			<h2 class="type-h2">{m.hours()}</h2>
			<Hours rows={e.hours} />
		</section>
		<Contact phone={e.phone} whatsapp={e.whatsapp} />

		<footer class="flex flex-col gap-3 border-t border-border pt-4">
			{#if e.lastVerified}<StatusBadge kind="last-verified" date={e.lastVerified} />{/if}
			{#if !e.claimed}<a
					href={resolve('/owner/claim/[type]/[id]', { type: 'eatery', id: e.id })}
					class="type-small">{m.claim_cta()}</a
				>{/if}
			<ReportProblem entityType="eatery" entityId={e.id} />
		</footer>
	</article>
</Page>
