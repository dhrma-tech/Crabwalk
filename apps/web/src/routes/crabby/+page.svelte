<script lang="ts">
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import MapPin from '@lucide/svelte/icons/map-pin';
	import { m } from '#lib/paraglide/messages.js';
	import TopBar from '#lib/components/TopBar.svelte';
	import Button from '#lib/components/Button.svelte';
	import CrabbyChat from '#lib/components/crabby/CrabbyChat.svelte';
	import { ask, crabby } from '#lib/crabby.svelte.ts';
	import Meta from '#lib/components/Meta.svelte';
	import { loginHref } from '#lib/login.ts';
	import type { PageProps } from './$types';

	// FRONTEND §7.13 / §6.7. ?ask= sends a prompt chip picked elsewhere (place page bubble). ?spot=<QR code>
	// (P12, 10.3): Crabby at the place just scanned — its own chips; a static FAQ for visitors not signed in.
	let { data }: PageProps = $props();
	onMount(() => {
		crabby.spot = data.spot?.code ?? null;
		const q = page.url.searchParams.get('ask');
		if (q) ask(q);
		return () => (crabby.spot = null);
	});
	const chips = $derived(
		data.spot
			? [m.spot_chip_now(), m.spot_chip_safe(), m.spot_chip_eat(), m.spot_chip_next()]
			: [m.crabby_chip_plan(), m.crabby_chip_gems(), m.crabby_chip_food()]
	);
</script>

<Meta title={m.nav_crabby()} />
<TopBar title={m.nav_crabby()} />
<main
	id="main"
	class="mx-auto flex h-[calc(100dvh-var(--bar-h)-var(--nav-h)-env(safe-area-inset-top))] w-full max-w-190 flex-col"
>
	<h1 class="sr-only">{m.nav_crabby()}</h1>
	{#if data.spot}
		<!-- eslint-disable svelte/no-navigation-without-resolve -- listing route built server-side -->
		<a
			href={data.spot.href}
			class="mx-6 mt-4 flex items-center gap-3 rounded-lg bg-lagoon-50 px-4 py-3 text-text no-underline"
			data-testid="spot"
		>
			<MapPin size={20} class="shrink-0 text-lagoon-ink" aria-hidden="true" />
			<span class="flex min-w-0 flex-col">
				<span class="type-label text-text-2">{m.spot_at()}</span>
				<span class="truncate type-body-strong">{data.spot.name}</span>
			</span>
		</a>
		<!-- eslint-enable svelte/no-navigation-without-resolve -->
	{/if}
	{#if data.spot && !data.signedIn}
		<!-- Not signed in: this place's facts, then the login prompt (chat needs an account). -->
		<section class="flex flex-col gap-3 overflow-y-auto px-6 py-4" data-testid="spot-faq">
			{#if data.spot.facts.length}
				<ul class="flex flex-col gap-2">
					{#each data.spot.facts as f (f)}
						<li class="rounded-md bg-surface p-3 type-body shadow-e1">{f}</li>
					{/each}
				</ul>
			{/if}
			{#if data.spot.near.length}
				<p class="type-small text-text-2">{m.qr_near_me()}: {data.spot.near.join(' · ')}</p>
			{/if}
			<div class="flex flex-col items-center gap-3 rounded-xl bg-surface-2 p-5 text-center">
				<p class="type-body-strong">{m.spot_signin()}</p>
				<Button href={loginHref(page.url)}>{m.sign_in()}</Button>
			</div>
		</section>
	{:else}
		<CrabbyChat {chips} />
	{/if}
</main>
