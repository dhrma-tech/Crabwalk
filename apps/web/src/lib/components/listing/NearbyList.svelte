<script lang="ts">
	import BedDouble from '@lucide/svelte/icons/bed-double';
	import UtensilsCrossed from '@lucide/svelte/icons/utensils-crossed';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';
	import { getLocale } from '#lib/paraglide/runtime.js';
	import { msg } from '#lib/msg.ts';
	import { formatNumber } from '#lib/format.ts';
	import { utilityIcons, type UtilityType } from '#lib/map/icons.ts';
	import InsetList from '../InsetList.svelte';

	// Stays/food and services near a point (`nearby()` in listings.ts), as inset lists with icons (Report 2 §9.2).
	// Used on the place page and the station/bus landing.
	type Named = { name_en: string | null; name_hi: string | null; name_mr: string | null };
	let {
		listings,
		utilities
	}: {
		listings: (Named & { id: string; kind: string; slug: string; km: number })[];
		utilities: { id: string; type: string; name: string | null; km: number }[];
	} = $props();

	const lang = getLocale();
	const pinName = (x: Named & { slug: string }) =>
		(lang === 'hi' ? x.name_hi : lang === 'mr' ? x.name_mr : null) || x.name_en || x.slug;
	const hrefFor = (kind: string, slug: string) =>
		kind === 'stay' ? resolve('/stays/[slug]', { slug }) : resolve('/food/[slug]', { slug });
	const tile =
		'flex size-10 shrink-0 items-center justify-center rounded-md bg-surface-2 text-text-2';
</script>

{#if listings.length}
	<h3 class="type-label text-text-2">{m.nearby_listings()}</h3>
	<InsetList>
		{#each listings as x (x.id)}
			{@const Icon = x.kind === 'stay' ? BedDouble : UtensilsCrossed}
			<a
				href={hrefFor(x.kind, x.slug)}
				class="row-link flex min-h-14 items-center gap-3 px-4 py-2.5 text-text no-underline"
			>
				<span class={tile}><Icon size={20} aria-hidden="true" /></span>
				<span class="min-w-0 flex-1 type-body">{pinName(x)}</span>
				<span class="type-small text-text-2">{m.km_away({ km: formatNumber(x.km) })}</span>
				<ChevronRight size={20} aria-hidden="true" class="text-text-2" />
			</a>
		{/each}
	</InsetList>
{/if}
{#if utilities.length}
	<h3 class={['type-label text-text-2', listings.length && 'mt-2']}>{m.nearby_services()}</h3>
	<InsetList>
		{#each utilities as u (u.id)}
			{@const Icon = utilityIcons[u.type as UtilityType]}
			<div class="flex min-h-14 items-center gap-3 px-4 py-2.5">
				<span class={tile}
					>{#if Icon}<Icon size={20} aria-hidden="true" />{/if}</span
				>
				<span class="min-w-0 flex-1 type-body"
					>{msg(`util_${u.type}`)}{u.name ? ` · ${u.name}` : ''}</span
				>
				<span class="type-small text-text-2">{m.km_away({ km: formatNumber(u.km) })}</span>
			</div>
		{/each}
	</InsetList>
{/if}
