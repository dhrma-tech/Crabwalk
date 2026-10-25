<script lang="ts">
	import { untrack } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { msg } from '#lib/msg.ts';
	import { toast } from '#lib/toast.svelte.ts';
	import Page from '#lib/components/Page.svelte';
	import Button from '#lib/components/Button.svelte';
	import PhotoUpload from '#lib/components/listing/PhotoUpload.svelte';
	import type { PageProps } from './$types';

	// Facts only: photos, prices, menu, timings, contact (BACKEND §4 [LOCKED]). Ratings are read-only.
	let { data }: PageProps = $props();
	const init = untrack(() => data); // form starts from the loaded values
	const days = [1, 2, 3, 4, 5, 6, 0];
	const hh = (t: string | null | undefined) => (t ? t.slice(0, 5) : '');

	let priceMin = $state(String(init.stay?.price_min ?? ''));
	let priceMax = $state(String(init.stay?.price_max ?? ''));
	let priceTwo = $state(String(init.eatery?.price_for_two ?? ''));
	let menu = $state(((init.eatery?.menu as { items?: string[] } | null)?.items ?? []).join('\n'));
	let phone = $state(init.stay?.phone ?? init.eatery?.phone ?? '');
	let whatsapp = $state(init.stay?.whatsapp ?? init.eatery?.whatsapp ?? '');
	let hours = $state(
		days.map((d) => {
			const r = init.eatery?.eatery_hours.find((x) => x.weekday === d);
			return {
				weekday: d,
				opens: hh(r?.opens),
				closes: hh(r?.closes),
				closed: !!r && !r.opens && !r.hours_unknown
			};
		})
	);
	let busy = $state(false);
	const num = (s: string) => (s === '' ? null : Number(s));

	async function save(e: SubmitEvent) {
		e.preventDefault();
		busy = true;
		const body =
			data.type === 'stay'
				? { type: 'stay', price_min: num(priceMin), price_max: num(priceMax), phone, whatsapp }
				: {
						type: 'eatery',
						price_for_two: num(priceTwo),
						menu: menu
							.split('\n')
							.map((s) => s.trim())
							.filter(Boolean),
						phone,
						whatsapp,
						hours: hours
							.filter((h) => h.closed || (h.opens && h.closes))
							.map((h) => ({
								weekday: h.weekday,
								opens: h.closed ? null : h.opens,
								closes: h.closed ? null : h.closes,
								hours_unknown: false
							}))
					};
		const res = await fetch(`/api/owner/listing/${data.id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		});
		busy = false;
		toast(res.ok ? m.owner_saved() : m.send_failed());
	}
	const input = 'h-11 w-full border-b border-text bg-bg type-body text-text';
	const label = 'flex flex-col gap-1.5 type-small text-text-2';
</script>

<Page title={data.name ?? m.owner_edit()} back>
	<form onsubmit={save} class="mx-auto flex max-w-[680px] flex-col gap-5" data-testid="owner-form">
		<p class="bg-asagi p-3 type-small text-text">{m.owner_ratings_readonly()}</p>
		<PhotoUpload type={data.type as 'stay' | 'eatery'} id={data.id} />
		{#if data.type === 'stay'}
			<div class="grid grid-cols-2 gap-3">
				<label class={label}
					>{m.field_price_min()}<input
						class={input}
						type="number"
						min="0"
						bind:value={priceMin}
						name="price_min"
					/></label
				>
				<label class={label}
					>{m.field_price_max()}<input
						class={input}
						type="number"
						min="0"
						bind:value={priceMax}
						name="price_max"
					/></label
				>
			</div>
		{:else}
			<label class={label}
				>{m.field_price_two()}<input
					class={input}
					type="number"
					min="0"
					bind:value={priceTwo}
					name="price_for_two"
				/></label
			>
			<label class={label}
				>{m.menu()}<span class="type-small">{m.owner_menu_hint()}</span>
				<textarea
					rows="6"
					class="border border-text bg-transparent p-3 type-body text-text"
					bind:value={menu}
					name="menu"></textarea>
			</label>
			<fieldset class="flex flex-col gap-2">
				<legend class="mb-2 type-h3">{m.field_hours()}</legend>
				{#each hours as h (h.weekday)}
					<div
						class="grid grid-cols-[2.5rem_minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-2 type-small"
					>
						<span>{msg(`wd_${h.weekday}`)}</span>
						<input
							type="time"
							class="h-11 w-full min-w-0 border-b border-text bg-bg px-1"
							bind:value={h.opens}
							disabled={h.closed}
							aria-label={`${msg(`wd_${h.weekday}`)} opens`}
						/>
						<input
							type="time"
							class="h-11 w-full min-w-0 border-b border-text bg-bg px-1"
							bind:value={h.closes}
							disabled={h.closed}
							aria-label={`${msg(`wd_${h.weekday}`)} closes`}
						/>
						<label class="flex min-h-11 items-center gap-1"
							><input type="checkbox" bind:checked={h.closed} />{m.closed()}</label
						>
					</div>
				{/each}
			</fieldset>
		{/if}
		<div class="grid grid-cols-2 gap-3">
			<label class={label}
				>{m.field_phone()}<input class={input} type="tel" bind:value={phone} name="phone" /></label
			>
			<label class={label}
				>{m.field_whatsapp()}<input
					class={input}
					type="tel"
					bind:value={whatsapp}
					name="whatsapp"
				/></label
			>
		</div>
		<Button type="submit" loading={busy}>{m.owner_save()}</Button>
	</form>
</Page>
