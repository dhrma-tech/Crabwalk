<script lang="ts">
	import { untrack } from 'svelte';
	import { m } from '#lib/paraglide/messages.js';
	import { msg } from '#lib/msg.ts';
	import { toast } from '#lib/toast.svelte.ts';
	import Page from '#lib/components/Page.svelte';
	import Button from '#lib/components/Button.svelte';
	import PhotoUpload from '#lib/components/listing/PhotoUpload.svelte';
	import HostCrabby from '#lib/components/HostCrabby.svelte';
	import type { HostFill } from '#lib/server/ai/host.ts';
	import Info from '@lucide/svelte/icons/info';
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
	// Host Crabby (P12 step J): fills what the owner said; they check it and press Save as usual.
	function onfill(f: HostFill) {
		if (f.price_min != null) priceMin = String(f.price_min);
		if (f.price_max != null) priceMax = String(f.price_max);
		if (f.price_for_two != null) priceTwo = String(f.price_for_two);
		if (f.menu_add?.length) menu = [...menu.split('\n').filter(Boolean), ...f.menu_add].join('\n');
		if (f.phone) phone = f.phone;
		if (f.whatsapp) whatsapp = f.whatsapp;
		for (const h of f.hours ?? [])
			for (const d of h.days) {
				const row = hours.find((x) => x.weekday === d);
				if (!row) continue;
				row.closed = !!h.closed;
				if (h.opens) row.opens = h.opens;
				if (h.closes) row.closes = h.closes;
			}
	}

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
	const input = 'field h-12 w-full min-w-0 px-3 type-body text-text';
	const label = 'flex min-w-0 flex-col gap-1.5 type-small text-text-2';
	const card = 'flex flex-col gap-4 rounded-lg bg-surface p-4 shadow-e1';
	const pair = 'grid grid-cols-2 gap-3 rounded-lg bg-surface p-4 shadow-e1';
</script>

<Page title={data.name ?? m.owner_edit()} back>
	<div class="mx-auto mb-4 max-w-170">
		<HostCrabby type={data.stay ? 'stay' : 'eatery'} {onfill} />
	</div>
	<!-- Tideline tool variant (Report 2 §9.15, T-40): grouped surface cards, `field` inputs, no banner. -->
	<form onsubmit={save} class="mx-auto flex max-w-170 flex-col gap-4" data-testid="owner-form">
		<p class="flex gap-2.5 rounded-md bg-lagoon-50 p-3 type-small text-text">
			<Info
				size={18}
				class="mt-0.5 shrink-0 text-lagoon"
				aria-hidden="true"
			/>{m.owner_ratings_readonly()}
		</p>
		<div class={card}><PhotoUpload type={data.type as 'stay' | 'eatery'} id={data.id} /></div>
		{#if data.type === 'stay'}
			<div class={pair}>
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
			<div class={card}>
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
					<textarea rows="6" class="field p-3 type-body text-text" bind:value={menu} name="menu"
					></textarea>
				</label>
			</div>
			<fieldset class={card}>
				<legend class="float-left mb-1 w-full type-h3">{m.field_hours()}</legend>
				{#each hours as h (h.weekday)}
					<div
						class="grid grid-cols-[2.5rem_minmax(0,1fr)_minmax(0,1fr)_auto] items-center gap-2 type-small"
					>
						<span class="text-text">{msg(`wd_${h.weekday}`)}</span>
						<input
							type="time"
							class="field h-11 w-full min-w-0 px-2 text-text disabled:text-muted"
							bind:value={h.opens}
							disabled={h.closed}
							aria-label={`${msg(`wd_${h.weekday}`)} opens`}
						/>
						<input
							type="time"
							class="field h-11 w-full min-w-0 px-2 text-text disabled:text-muted"
							bind:value={h.closes}
							disabled={h.closed}
							aria-label={`${msg(`wd_${h.weekday}`)} closes`}
						/>
						<label class="flex min-h-11 items-center gap-1.5 text-text"
							><input
								type="checkbox"
								class="size-5 accent-(--kokum)"
								bind:checked={h.closed}
							/>{m.closed()}</label
						>
					</div>
				{/each}
			</fieldset>
		{/if}
		<div class={pair}>
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
		<div class="[&>*]:w-full"><Button type="submit" loading={busy}>{m.owner_save()}</Button></div>
	</form>
</Page>
