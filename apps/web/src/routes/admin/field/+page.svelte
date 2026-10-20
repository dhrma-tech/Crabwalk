<script lang="ts">
	import { onMount } from 'svelte';
	import LocateFixed from '@lucide/svelte/icons/locate-fixed';
	import Camera from '@lucide/svelte/icons/camera';
	import { m } from '#lib/paraglide/messages.js';
	import { msg } from '#lib/msg.ts';
	import { toast } from '#lib/toast.svelte.ts';
	import Page from '#lib/components/Page.svelte';
	import Button from '#lib/components/Button.svelte';
	import { categoryIcons } from '#lib/components/CategoryIcon.svelte';
	import { processPhoto, type Processed } from '#lib/field/photos.ts';
	import { all, flush, put, send, type Submission } from '#lib/field/queue.ts';
	import type { PageProps } from './$types';

	// Verifier field form (FRONTEND §7.15, PLAN P4 task 1). The fixed checklist = the same fact fields on every
	// visit (DECISIONS P4-5). Offline-first: everything goes through the IndexedDB queue.
	let { data }: PageProps = $props();

	type Kind = 'places' | 'stays' | 'eateries';
	let kind = $state<Kind>('places');
	const days = [1, 2, 3, 4, 5, 6, 0];
	const blankHours = () => days.map((d) => ({ weekday: d, opens: '', closes: '', closed: false }));

	let f = $state(fresh());
	function fresh() {
		return {
			name_en: '',
			name_mr: '',
			lon: '',
			lat: '',
			taluka_id: data.talukas.length === 1 ? data.talukas[0].id : '',
			category: 'beach',
			fee: '',
			feeInr: '',
			visitMin: '',
			best: '',
			reach: '',
			station: '',
			bus: '',
			gem: false,
			tide: false,
			monsoon: 'open',
			monsoonReason: '',
			delivery: {} as Record<string, boolean>,
			hoursUnknown: false,
			hours: blankHours(),
			crowd: {} as Record<number, string>,
			notes: '',
			vibes: [] as string[],
			style: '',
			amenities: {} as Record<string, boolean>,
			network: {} as Record<string, string>,
			food: {} as Record<string, boolean>,
			priceMin: '',
			priceMax: '',
			phone: '',
			whatsapp: '',
			auth: '',
			priceTwo: '',
			diet: {} as Record<string, boolean>,
			apps: {} as Record<string, string>,
			dishes: [] as string[]
		};
	}
	let photos = $state<Processed[]>([]);
	let previews = $state<string[]>([]);
	let gps = $state<'idle' | 'busy' | 'denied'>('idle');
	let accuracy = $state<number | null>(null);
	let queued = $state<Submission[]>([]);
	let busy = $state(false);

	const refresh = async () => (queued = await all());
	onMount(() => {
		refresh();
		const online = async () => (await flush(), refresh());
		addEventListener('online', online);
		online();
		return () => removeEventListener('online', online);
	});

	function locate() {
		gps = 'busy';
		navigator.geolocation.getCurrentPosition(
			async (p) => {
				f.lon = p.coords.longitude.toFixed(6);
				f.lat = p.coords.latitude.toFixed(6);
				accuracy = Math.round(p.coords.accuracy);
				gps = 'idle';
				const r = await fetch(`/api/admin/taluka-at?lon=${f.lon}&lat=${f.lat}`)
					.then((x) => (x.ok ? (x.json() as Promise<{ taluka_id: string | null }>) : null))
					.catch(() => null);
				if (r?.taluka_id && data.talukas.some((t) => t.id === r.taluka_id))
					f.taluka_id = r.taluka_id;
			},
			() => (gps = 'denied'),
			{ enableHighAccuracy: true, timeout: 20000 }
		);
	}

	async function addPhotos(e: Event) {
		const files = [...((e.target as HTMLInputElement).files ?? [])];
		for (const file of files) {
			const p = await processPhoto(file);
			photos.push(p);
			previews.push(URL.createObjectURL(p.blobs[480]!));
		}
		(e.target as HTMLInputElement).value = '';
	}

	const hours = () =>
		f.hoursUnknown
			? days.map((d) => ({ weekday: d, opens: null, closes: null, hours_unknown: true }))
			: f.hours
					.filter((h) => h.closed || (h.opens && h.closes))
					.map((h) => ({
						weekday: h.weekday,
						opens: h.closed ? null : h.opens,
						closes: h.closed ? null : h.closes,
						hours_unknown: false
					}));
	const num = (s: string) => (s === '' ? null : Number(s));

	function payload(id: string) {
		const base = {
			id,
			name_en: f.name_en,
			name_mr: f.name_mr || undefined,
			lon: Number(f.lon),
			lat: Number(f.lat),
			taluka_id: f.taluka_id
		};
		if (kind === 'places')
			return {
				...base,
				category: f.category,
				entry_fee_text: f.fee,
				entry_fee_inr: f.feeInr === '' || f.feeInr == null ? null : Number(f.feeInr),
				visit_minutes: f.visitMin === '' || f.visitMin == null ? null : Number(f.visitMin),
				best_time_text: f.best,
				how_to_reach_text: f.reach,
				nearest_station_text: f.station,
				nearest_bus_stop_text: f.bus,
				is_hidden_gem: f.gem,
				is_tide_dependent: f.tide,
				monsoon_status: f.monsoon,
				monsoon_reason: f.monsoonReason,
				food_delivery: f.delivery,
				hours: hours(),
				crowd: Object.entries(f.crowd)
					.filter(([, l]) => l)
					.map(([w, l]) => ({ weekday: Number(w), level: l })),
				notes: f.notes
			};
		if (kind === 'stays')
			return {
				...base,
				vibe_tags: f.vibes,
				service_style: f.style || null,
				amenities: f.amenities,
				network_strength: f.network,
				food_at_stay: f.food,
				price_min: num(f.priceMin),
				price_max: num(f.priceMax),
				phone: f.phone,
				whatsapp: f.whatsapp
			};
		return {
			...base,
			authenticity: f.auth || null,
			price_for_two: num(f.priceTwo),
			diet_flags: f.diet,
			service_style: f.style || null,
			food_apps: Object.fromEntries(
				Object.entries(f.apps).map(([a, link]) => [a, { available: !!link, link }])
			),
			hours: hours(),
			dish_ids: f.dishes,
			phone: f.phone,
			whatsapp: f.whatsapp
		};
	}

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		busy = true;
		const id = crypto.randomUUID();
		const s: Submission = {
			id,
			type: kind,
			payload: $state.snapshot(payload(id)) as Record<string, unknown>,
			photos: $state.snapshot(photos) as Processed[],
			done: []
		};
		await put(s);
		const r = navigator.onLine ? await send(s) : 'queued';
		busy = false;
		await refresh();
		if (r === 'failed') return toast(m.send_failed());
		toast(r === 'sent' ? m.sent_review() : m.queued_offline());
		f = fresh();
		photos = [];
		previews = [];
		accuracy = null;
	}

	const input = 'h-11 w-full border-b border-text bg-bg type-body text-text';
	const label = 'flex flex-col gap-1.5 type-small text-text-2';
	const box =
		'flex min-h-11 items-center gap-2 border border-border bg-surface px-4 type-small text-text';
</script>

<Page title={m.field_title()} back>
	<form
		onsubmit={submit}
		class="mx-auto flex max-w-[680px] flex-col gap-6 pb-8"
		data-testid="field-form"
	>
		{#if queued.length}
			<p class="bg-yama p-3 type-small text-text" role="status">
				{m.queue_count({ n: queued.length })}{#each queued.filter((q) => q.error) as q (q.id)}<br
					/>{q.payload.name_en}: {q.error}{/each}
			</p>
		{/if}

		<fieldset class="flex flex-wrap gap-2">
			<legend class="mb-2 type-h3">{m.field_type()}</legend>
			{#each [['places', m.type_place], ['stays', m.type_stay], ['eateries', m.type_eatery]] as const as [k, l] (k)}
				<label class={box}><input type="radio" bind:group={kind} value={k} />{l()}</label>
			{/each}
		</fieldset>

		<label class={label}
			>{m.field_name_en()}<input
				class={input}
				bind:value={f.name_en}
				required
				minlength="2"
				maxlength="120"
				name="name_en"
			/></label
		>
		<label class={label}
			>{m.field_name_mr()}<input
				class={input}
				bind:value={f.name_mr}
				maxlength="120"
				lang="mr"
				name="name_mr"
			/></label
		>

		<fieldset class="flex flex-col gap-3">
			<legend class="mb-2 type-h3">{m.field_location()}</legend>
			<div>
				<Button variant="secondary" onclick={locate} loading={gps === 'busy'}
					>{#snippet icon()}<LocateFixed
							size={20}
							aria-hidden="true"
						/>{/snippet}{m.gps_use()}</Button
				>
			</div>
			{#if gps === 'denied'}<p class="type-small" role="alert">{m.gps_denied()}</p>{/if}
			{#if accuracy != null}<p class="type-small text-text-2">
					{m.gps_accuracy({ m: accuracy })}
				</p>{/if}
			<div class="grid grid-cols-2 gap-3">
				<label class={label}
					>{m.field_lat()}<input
						class={input}
						bind:value={f.lat}
						required
						inputmode="decimal"
						pattern="-?\d+(\.\d+)?"
						name="lat"
					/></label
				>
				<label class={label}
					>{m.field_lon()}<input
						class={input}
						bind:value={f.lon}
						required
						inputmode="decimal"
						pattern="-?\d+(\.\d+)?"
						name="lon"
					/></label
				>
			</div>
			<label class={label}
				>{m.field_location()}
				<select class={input} bind:value={f.taluka_id} required name="taluka_id">
					<option value="" disabled>—</option>
					{#each data.talukas as t (t.id)}<option value={t.id}>{t.name}</option>{/each}
				</select>
			</label>
		</fieldset>

		<fieldset class="flex flex-col gap-3">
			<legend class="mb-2 type-h3">{m.field_photos()}</legend>
			<label class={[box, 'w-fit cursor-pointer']}
				><Camera size={20} aria-hidden="true" />{m.field_photos()}
				<input
					type="file"
					accept="image/*"
					capture="environment"
					multiple
					class="sr-only"
					onchange={addPhotos}
				/>
			</label>
			{#if previews.length}<div class="flex flex-wrap gap-2">
					{#each previews as src, i (i)}<img {src} alt="" class="size-20 object-cover" />{/each}
				</div>{/if}
		</fieldset>

		{#if kind === 'places'}
			<label class={label}
				>{m.field_category()}
				<select class={input} bind:value={f.category} name="category"
					>{#each Object.keys(categoryIcons) as c (c)}<option value={c}>{msg(`cat_${c}`)}</option
						>{/each}</select
				>
			</label>
			{#each [['fee', m.field_fee], ['best', m.fact_best_time], ['reach', m.fact_how_to_reach], ['station', m.fact_station], ['bus', m.fact_bus]] as const as [k, l] (k)}
				<label class={label}
					>{l()}<input class={input} bind:value={f[k]} maxlength="1000" name={k} /></label
				>
			{/each}
			<label class={label}
				>{m.field_fee_inr()}<input
					class={input}
					type="number"
					min="0"
					step="1"
					inputmode="numeric"
					bind:value={f.feeInr}
					name="fee_inr"
				/></label
			>
			<label class={label}
				>{m.field_visit_minutes()}<input
					class={input}
					type="number"
					min="10"
					max="600"
					step="5"
					inputmode="numeric"
					bind:value={f.visitMin}
					name="visit_minutes"
				/></label
			>
			<div class="flex flex-wrap gap-2">
				<label class={box}
					><input type="checkbox" bind:checked={f.gem} />{m.field_hidden_gem()}</label
				>
				<label class={box}><input type="checkbox" bind:checked={f.tide} />{m.field_tide()}</label>
			</div>
			<label class={label}
				>{m.field_monsoon()}
				<select class={input} bind:value={f.monsoon}
					>{#each ['open', 'risky', 'closed'] as s (s)}<option value={s}
							>{msg(`monsoon_${s}`)}</option
						>{/each}</select
				>
			</label>
			{#if f.monsoon !== 'open'}<label class={label}
					>{m.field_monsoon_reason()}<input
						class={input}
						bind:value={f.monsoonReason}
						maxlength="1000"
					/></label
				>{/if}
			<fieldset class="flex flex-col gap-2">
				<legend class="mb-2 type-h3">{m.field_crowd()}</legend>
				{#each days as d (d)}
					<label class="flex items-center justify-between gap-3 type-small"
						>{msg(`wd_${d}`)}
						<select
							class="h-11 border border-border bg-surface px-3 type-small"
							bind:value={f.crowd[d]}
						>
							<option value="">—</option>{#each ['empty', 'calm', 'busy'] as l (l)}<option value={l}
									>{msg(`crowd_${l}`)}</option
								>{/each}
						</select>
					</label>
				{/each}
			</fieldset>
			<fieldset class="flex flex-wrap gap-2">
				<legend class="mb-2 type-h3">{m.field_delivery()}</legend>
				{#each ['swiggy', 'zomato', 'eatsure', 'magicpin'] as a (a)}<label class={box}
						><input type="checkbox" bind:checked={f.delivery[a]} />{a[0].toUpperCase() +
							a.slice(1)}</label
					>{/each}
			</fieldset>
		{/if}

		{#if kind === 'stays'}
			<fieldset class="flex flex-wrap gap-2">
				<legend class="mb-2 type-h3">{m.filter_vibe()}</legend>
				{#each ['traditional_konkani_home', 'family', 'luxury', 'business', 'backpacker', 'couple_friendly', 'pet_friendly', 'beachfront', 'orchard_stay'] as v (v)}
					<label class={box}
						><input type="checkbox" bind:group={f.vibes} value={v} />{msg(`vibe_${v}`)}</label
					>
				{/each}
			</fieldset>
			<fieldset class="flex flex-wrap gap-2">
				<legend class="mb-2 type-h3">{m.amenities()}</legend>
				{#each ['ac', 'hot_water', 'wifi', 'parking', 'power_backup'] as a (a)}<label class={box}
						><input type="checkbox" bind:checked={f.amenities[a]} />{msg(`amenity_${a}`)}</label
					>{/each}
			</fieldset>
			<fieldset class="flex flex-col gap-2">
				<legend class="mb-2 type-h3">{m.network_title()}</legend>
				{#each ['Jio', 'Airtel', 'Vi', 'BSNL'] as op (op)}
					<label class="flex items-center justify-between gap-3 type-small"
						>{op}
						<select
							class="h-11 border border-border bg-surface px-3 type-small"
							bind:value={f.network[op]}
						>
							<option value="">—</option>{#each ['none', 'weak', 'good'] as l (l)}<option value={l}
									>{msg(`network_${l}`)}</option
								>{/each}
						</select>
					</label>
				{/each}
			</fieldset>
			<fieldset class="flex flex-wrap gap-2">
				<legend class="mb-2 type-h3">{m.food_at_stay()}</legend>
				{#each ['veg', 'non_veg', 'malvani', 'jain', 'homemade_included'] as k (k)}<label
						class={box}><input type="checkbox" bind:checked={f.food[k]} />{msg(`food_${k}`)}</label
					>{/each}
			</fieldset>
			<div class="grid grid-cols-2 gap-3">
				<label class={label}
					>{m.field_price_min()}<input
						class={input}
						type="number"
						min="0"
						bind:value={f.priceMin}
					/></label
				>
				<label class={label}
					>{m.field_price_max()}<input
						class={input}
						type="number"
						min="0"
						bind:value={f.priceMax}
					/></label
				>
			</div>
		{/if}

		{#if kind === 'eateries'}
			<label class={label}
				>{m.filter_authenticity()}
				<select class={input} bind:value={f.auth}
					><option value="">—</option
					>{#each ['home_style', 'local_legend', 'tourist_oriented'] as a (a)}<option value={a}
							>{msg(`auth_${a}`)}</option
						>{/each}</select
				>
			</label>
			<label class={label}
				>{m.field_price_two()}<input
					class={input}
					type="number"
					min="0"
					bind:value={f.priceTwo}
				/></label
			>
			<fieldset class="flex flex-wrap gap-2">
				<legend class="mb-2 type-h3">{m.filter_diet()}</legend>
				{#each [['veg', m.diet_veg], ['non_veg', m.diet_nonveg], ['jain', m.diet_jain]] as const as [k, l] (k)}<label
						class={box}><input type="checkbox" bind:checked={f.diet[k]} />{l()}</label
					>{/each}
			</fieldset>
			<fieldset class="flex flex-col gap-2">
				<legend class="mb-2 type-h3">{m.field_food_apps()}</legend>
				{#each ['swiggy', 'zomato', 'eatsure', 'magicpin'] as a (a)}
					<label class={label}
						>{a[0].toUpperCase() + a.slice(1)}<input
							class={input}
							type="url"
							pattern="https://.*"
							placeholder="https://"
							bind:value={f.apps[a]}
						/></label
					>
				{/each}
			</fieldset>
			{#if data.dishes.length}
				<fieldset class="flex flex-wrap gap-2">
					<legend class="mb-2 type-h3">{m.field_signature()}</legend>
					{#each data.dishes as d (d.id)}<label class={box}
							><input type="checkbox" bind:group={f.dishes} value={d.id} />{d.name}</label
						>{/each}
				</fieldset>
			{/if}
		{/if}

		{#if kind !== 'places'}
			<label class={label}
				>{m.filter_style()}
				<select class={input} bind:value={f.style}
					><option value="">—</option><option value="homely">{m.service_homely()}</option><option
						value="professional">{m.service_professional()}</option
					></select
				>
			</label>
			<div class="grid grid-cols-2 gap-3">
				<label class={label}
					>{m.field_phone()}<input class={input} type="tel" bind:value={f.phone} /></label
				>
				<label class={label}
					>{m.field_whatsapp()}<input class={input} type="tel" bind:value={f.whatsapp} /></label
				>
			</div>
		{/if}

		{#if kind !== 'stays'}
			<fieldset class="flex flex-col gap-2">
				<legend class="mb-2 type-h3">{m.field_hours()}</legend>
				<label class={[box, 'w-fit']}
					><input type="checkbox" bind:checked={f.hoursUnknown} />{m.field_hours_unknown()}</label
				>
				{#if !f.hoursUnknown}
					{#each f.hours as h (h.weekday)}
						<div class="grid grid-cols-[3rem_1fr_1fr_auto] items-center gap-2 type-small">
							<span>{msg(`wd_${h.weekday}`)}</span>
							<input
								type="time"
								class="h-11 border border-border bg-surface px-2"
								bind:value={h.opens}
								disabled={h.closed}
								aria-label={`${msg(`wd_${h.weekday}`)} opens`}
							/>
							<input
								type="time"
								class="h-11 border border-border bg-surface px-2"
								bind:value={h.closes}
								disabled={h.closed}
								aria-label={`${msg(`wd_${h.weekday}`)} closes`}
							/>
							<label class="flex min-h-11 items-center gap-1"
								><input type="checkbox" bind:checked={h.closed} />{m.closed()}</label
							>
						</div>
					{/each}
				{/if}
			</fieldset>
		{/if}

		{#if kind === 'places'}
			<label class={label}
				>{m.field_notes()}<textarea
					class="border border-text bg-transparent p-3 type-body text-text"
					rows="4"
					maxlength="1000"
					bind:value={f.notes}
					name="notes"></textarea></label
			>
		{/if}

		<Button type="submit" loading={busy}>{m.submit_review()}</Button>
	</form>
</Page>
