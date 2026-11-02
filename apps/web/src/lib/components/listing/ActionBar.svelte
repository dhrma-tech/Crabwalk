<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import Navigation from '@lucide/svelte/icons/navigation';
	import CalendarPlus from '@lucide/svelte/icons/calendar-plus';
	import Heart from '@lucide/svelte/icons/heart';
	import Share2 from '@lucide/svelte/icons/share-2';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import X from '@lucide/svelte/icons/x';
	import { m } from '#lib/paraglide/messages.js';
	import { formatDate } from '#lib/format.ts';
	import { loginHref } from '#lib/login.ts';
	import { toast } from '#lib/toast.svelte.ts';
	import { isSaved, loadSaved, toggleSaved, type SavedKind } from '#lib/saved.svelte.ts';
	import Button from '../Button.svelte';
	import IconButton from '../IconButton.svelte';
	import Skeleton from '../Skeleton.svelte';

	// Listing action bar (DECISIONS T-4 / T-47; Report 1 §3.9, Report 2 §9.2): Directions · Add to trip (primary) ·
	// Save · Share. Phones: a glass bar pinned above the bottom nav, with an in-flow spacer so it never covers the
	// page. Laptops: a sticky card at the top of the right column. Add to trip: pick a trip, then a day (skipped for
	// 1-day trips); the server adds the stop and re-times the trip, then the plan opens.
	let {
		type,
		slug,
		name,
		coords
	}: { type: SavedKind; slug: string; name: string; coords: [number, number] | null } = $props();

	type Trip = { id: string; title: string; days: number; start_date: string | null };
	let dialog = $state<HTMLDialogElement>();
	let trips = $state<Trip[] | null>(null);
	let chosen = $state<Trip | null>(null);
	let busy = $state(false);
	const saved = $derived(isSaved(type, slug));
	onMount(() => void loadSaved());

	const icon =
		'inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-surface-2 text-text no-underline transition-[transform,background-color] duration-(--dur-press) ease-brand hover:bg-surface-3 active:scale-[.97]';

	async function openAdd() {
		chosen = null;
		trips = null;
		dialog?.showModal();
		const r = await fetch('/api/trips').catch(() => null);
		if (r?.status === 401) return void (location.href = loginHref(location));
		if (!r?.ok) {
			dialog?.close();
			return toast(m.send_failed());
		}
		trips = (await r.json()) as Trip[];
	}

	async function add(t: Trip, day: number) {
		busy = true;
		const r = await fetch(`/api/trips/${t.id}/add`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ type, slug, day })
		}).catch(() => null);
		busy = false;
		if (!r?.ok) return toast(m.send_failed());
		dialog?.close();
		await goto(resolve('/plan/[id]', { id: t.id }));
	}

	async function share() {
		const url = location.href;
		try {
			if (navigator.share) return await navigator.share({ title: name, url });
		} catch (e) {
			if ((e as Error).name === 'AbortError') return;
		}
		try {
			await navigator.clipboard.writeText(url);
			toast(m.link_copied());
		} catch {
			toast(m.send_failed());
		}
	}
</script>

<div class="order-[99] h-(--actions-h) lg:hidden" aria-hidden="true"></div>
<div
	role="toolbar"
	aria-label={m.actions_label()}
	class="fixed inset-x-0 bottom-(--nav-h) max-lg:glass z-bar flex items-center gap-2 border-t border-border px-4 py-2 lg:sticky lg:top-[calc(var(--bar-h)+1rem)] lg:bottom-auto lg:z-auto lg:rounded-lg lg:border-0 lg:bg-surface lg:p-3 lg:shadow-e1 print:hidden"
	data-testid="action-bar"
>
	{#if coords}
		<a
			href="{resolve('/navigate')}?to={coords[1]},{coords[0]}&name={encodeURIComponent(name)}"
			class={icon}
			aria-label={m.action_directions()}><Navigation size={20} aria-hidden="true" /></a
		>
	{/if}
	<Button class="min-w-0 flex-1" onclick={openAdd}>
		{#snippet icon()}<CalendarPlus size={20} aria-hidden="true" />{/snippet}
		{m.action_add_trip()}
	</Button>
	<IconButton
		label={saved ? m.saved() : m.save()}
		aria-pressed={saved}
		class="size-12 bg-surface-2 shadow-none hover:bg-surface-3"
		onclick={() => toggleSaved(type, slug)}
	>
		<Heart
			size={20}
			fill={saved ? 'currentColor' : 'none'}
			aria-hidden="true"
			class={saved ? 'text-kokum' : undefined}
		/>
	</IconButton>
	<IconButton
		label={m.action_share()}
		class="size-12 bg-surface-2 shadow-none hover:bg-surface-3"
		onclick={share}><Share2 size={20} aria-hidden="true" /></IconButton
	>
</div>

<dialog
	bind:this={dialog}
	aria-labelledby="add-trip-title"
	class="mx-auto mt-auto mb-0 w-full max-w-none rounded-t-xl bg-surface p-5 pb-[calc(--spacing(5)+env(safe-area-inset-bottom))] text-text shadow-e3 backdrop:bg-(--scrim) lg:m-auto lg:max-w-105 lg:rounded-xl lg:pb-5"
	data-testid="add-trip"
>
	<div class="flex flex-col gap-4">
		<div class="flex items-center justify-between gap-2">
			<h2 id="add-trip-title" class="type-h2">
				{chosen ? m.add_trip_day() : m.add_trip_pick()}
			</h2>
			<IconButton label={m.close()} onclick={() => dialog?.close()}
				><X size={20} aria-hidden="true" /></IconButton
			>
		</div>
		{#if trips === null}
			<div class="flex flex-col gap-2" aria-busy="true">
				<Skeleton class="h-14 w-full rounded-md" />
				<Skeleton class="h-14 w-full rounded-md" />
			</div>
		{:else if chosen}
			{@const t = chosen}
			<ul class="divide-y divide-border overflow-hidden rounded-lg bg-surface-2">
				{#each Array.from({ length: t.days }, (_, i) => i + 1) as d (d)}
					<li>
						<button
							type="button"
							class="row-link flex min-h-14 w-full items-center gap-3 px-4 text-left type-body-strong disabled:text-muted"
							disabled={busy}
							onclick={() => add(t, d)}
							><span class="flex-1">{m.plan_day_n({ n: d })}</span><ChevronRight
								size={18}
								class="text-text-2"
								aria-hidden="true"
							/></button
						>
					</li>
				{/each}
			</ul>
		{:else if trips.length}
			<ul class="divide-y divide-border overflow-hidden rounded-lg bg-surface-2">
				{#each trips as t (t.id)}
					<li>
						<button
							type="button"
							class="row-link flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left disabled:text-muted"
							disabled={busy}
							onclick={() => (t.days === 1 ? add(t, 1) : (chosen = t))}
							><span class="flex min-w-0 flex-1 flex-col"
								><span class="type-body-strong break-words">{t.title}</span><span
									class="type-small text-text-2"
									>{m.plan_n_days({ n: t.days })}{t.start_date
										? ` · ${formatDate(t.start_date)}`
										: ''}</span
								></span
							><ChevronRight size={18} class="shrink-0 text-text-2" aria-hidden="true" /></button
						>
					</li>
				{/each}
			</ul>
		{:else}
			<p class="type-body text-text-2">{m.add_trip_none()}</p>
		{/if}
		<Button variant="outline" href={resolve('/plan/new')}>{m.plan_new()}</Button>
	</div>
</dialog>
