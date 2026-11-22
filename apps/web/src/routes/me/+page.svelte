<script lang="ts">
	import { purgePrivateCaches, purgeThenSubmit } from '#lib/sw.ts';
	import { toast } from '#lib/toast.svelte.ts';
	import FileText from '@lucide/svelte/icons/file-text';
	import { resolve } from '$app/paths';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import Route from '@lucide/svelte/icons/route';
	import User from '@lucide/svelte/icons/user';
	import Wrench from '@lucide/svelte/icons/wrench';
	import Store from '@lucide/svelte/icons/store';
	import Shield from '@lucide/svelte/icons/shield';
	import MapPin from '@lucide/svelte/icons/map-pin';
	import BedDouble from '@lucide/svelte/icons/bed-double';
	import Utensils from '@lucide/svelte/icons/utensils';
	import BadgeCheck from '@lucide/svelte/icons/badge-check';
	import { m } from '#lib/paraglide/messages.js';
	import { getLocale } from '#lib/paraglide/runtime.js';
	import Page from '#lib/components/Page.svelte';
	import Button from '#lib/components/Button.svelte';
	import InsetList from '#lib/components/InsetList.svelte';
	import { msg } from '#lib/msg.ts';
	import { formatDate } from '#lib/format.ts';
	import OfflinePacks from '#lib/components/OfflinePacks.svelte';
	import Crabby from '#lib/components/CrabbyMark.svelte';
	import { enablePush, disablePush, pushStatus } from '#lib/push.ts';
	import { onMount } from 'svelte';
	import type { PageProps } from './$types';
	import { page } from '$app/state';
	import { loginHref } from '#lib/login.ts';
	import AdminGate from '#lib/components/AdminGate.svelte';
	import AdminBadge from '#lib/components/AdminBadge.svelte';

	// Me (FRONTEND §7.14). Tideline (Report 2 §9.12, Report 1 §4.7, T-37): profile card, then trips → offline packs
	// → Crabby & you (P12 profile) → privacy choices → language & theme → tools → privacy → sign out. Saved follows trips (T-46).
	let { data }: PageProps = $props();
	// TODO(before-deploy): restore full auth — temp gate: the Sign in toggle opens the admin email sheet.
	const gate = $derived(data.gate);
	let gateOpen = $state(false);
	onMount(() => {
		if (page.url.searchParams.has('admin')) gateOpen = true;
	});
	const SAVED_ICON = { place: MapPin, stay: BedDouble, eatery: Utensils };
	// T3-04: a stamp pops the first time this device shows it (seen list in localStorage; no storage → no pop).
	const SEEN = 'cw-stamps-seen';
	let fresh = $state(new Set<string>());
	onMount(() => {
		try {
			const seen = new Set<string>(JSON.parse(localStorage.getItem(SEEN) ?? '[]'));
			fresh = new Set(data.stamps.map((s) => s.slug).filter((s) => !seen.has(s)));
			localStorage.setItem(SEEN, JSON.stringify([...seen, ...fresh]));
		} catch {
			// private mode or blocked storage: show the stamps without the animation
		}
	});
	let push = $state<'on' | 'off' | 'unsupported' | 'denied'>('unsupported');
	onMount(async () => (push = await pushStatus()));
	async function togglePush() {
		if (push === 'on') {
			await disablePush();
			push = 'off';
		} else push = (await enablePush()) ? 'on' : await pushStatus();
	}
	const themes = [
		{ value: 'system', label: m.theme_system },
		{ value: 'light', label: m.theme_light },
		{ value: 'dark', label: m.theme_dark }
	] as const;
	const locales = [
		{ value: 'en', label: 'English' },
		{ value: 'hi', label: 'हिन्दी' },
		{ value: 'mr', label: 'मराठी' }
	] as const;
	const locale = getLocale();
	const row = 'row-link flex min-h-14 items-center gap-3 px-4 py-3 text-text no-underline';
	const seg = (on: boolean) => [
		'min-h-11 rounded-full px-4 type-label transition-[background-color,box-shadow,color] duration-(--dur-state)',
		on ? 'bg-surface text-text shadow-e1' : 'text-text-2 hover:text-text'
	];

	// Your data (SEC-15): export as a file; delete after typing the word. Caches are purged first, so nothing of
	// the account stays readable offline on this phone.
	let deleteDialog: HTMLDialogElement | undefined = $state();
	let confirmWord = $state('');
	let deleting = $state(false);
	async function deleteAccount(e: SubmitEvent) {
		e.preventDefault();
		if (confirmWord.trim().toLowerCase() !== 'delete') return;
		deleting = true;
		await purgePrivateCaches();
		const r = await fetch('/api/me/delete', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ confirm: 'delete' })
		}).catch(() => null);
		deleting = false;
		if (r?.ok) return void location.assign('/');
		deleteDialog?.close();
		toast(r?.status === 403 || r?.status === 409 ? m.data_delete_blocked() : m.send_failed());
	}
</script>

<!-- A switch that reads as one (Standout toggle, T-31); the button's name stays the action ("Turn on"). -->
{#snippet toggle(on: boolean, action: string)}
	<span class="sr-only">{action}</span>
	<span
		class={[
			'relative h-7 w-12 rounded-full transition-colors duration-(--dur-state)',
			on ? 'bg-kokum' : 'bg-border-strong'
		]}
		aria-hidden="true"
		><span
			class={[
				'absolute top-1 left-1 size-5 rounded-full bg-white shadow-e1 transition-transform duration-(--dur-state)',
				on && 'translate-x-5'
			]}
		></span></span
	>
{/snippet}

<Page title={m.nav_me()}>
	<div class="mx-auto flex max-w-170 flex-col gap-8">
		<section class="flex items-center gap-4 rounded-xl bg-surface p-5 shadow-e1">
			<span
				class="flex size-14 shrink-0 items-center justify-center rounded-full bg-lagoon-50 type-h2 text-lagoon-ink uppercase"
				aria-hidden="true"
				>{#if data.email}{data.email[0]}{:else}<User size={26} />{/if}</span
			>
			<div class="flex min-w-0 flex-1 flex-col items-start gap-2">
				{#if gate.on}
					<!-- TODO(before-deploy): restore full auth — temp gate profile card. -->
					{#if gate.admin}
						<p class="type-body break-words text-text">{m.gate_admin_as({ email: gate.admin })}</p>
						<div class="flex flex-wrap items-center gap-2">
							<Button href="/admin/content">{m.gate_panel()}</Button>
							<AdminBadge />
						</div>
					{:else}
						<p class="type-body text-text">{m.gate_guest()}</p>
						<Button onclick={() => (gateOpen = true)} data-testid="gate-open">{m.sign_in()}</Button>
					{/if}
				{:else if data.email}
					<p class="type-body break-words text-text">{m.me_signed_in_as({ email: data.email })}</p>
				{:else}
					<p class="type-body text-text">{m.me_guest()}</p>
					<Button href={loginHref(page.url)}>{m.sign_in()}</Button>
				{/if}
			</div>
		</section>

		{#if data.signedIn}
			<section class="flex flex-col gap-3" data-testid="my-trips">
				<h2 class="type-h2">{m.me_trips()}</h2>
				{#if data.trips.length}
					<InsetList>
						<ul>
							{#each data.trips as t (t.id)}
								<li class="border-b border-border last:border-0">
									<a href={resolve('/plan/[id]', { id: t.id })} class={row}
										><Route size={20} class="shrink-0 text-lagoon" aria-hidden="true" /><span
											class="flex min-w-0 flex-1 flex-col"
											><span class="type-h3 break-words">{t.title}</span><span
												class="type-small text-text-2"
												>{m.plan_n_days({ n: t.days })}{t.start_date
													? ` · ${formatDate(t.start_date)}`
													: ''}</span
											></span
										><ChevronRight size={18} class="shrink-0 text-text-2" aria-hidden="true" /></a
									>
								</li>
							{/each}
						</ul>
					</InsetList>
				{:else}
					<p class="type-body text-text-2">{m.me_no_trips()}</p>
				{/if}
				<div><Button href={resolve('/plan/new')} variant="outline">{m.plan_new()}</Button></div>
			</section>

			<!-- Saved (T-5 / T-46): hearted places, stays and food, newest first. -->
			<section class="flex flex-col gap-3" data-testid="my-saved">
				<h2 class="type-h2">{m.saved()}</h2>
				{#if data.saved.length}
					<InsetList>
						<ul>
							{#each data.saved as s (s.href)}
								{@const Icon = SAVED_ICON[s.type]}
								<li class="border-b border-border last:border-0">
									<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- href built server-side from a known route + slug -->
									<a href={s.href} class={row}
										><Icon size={20} class="shrink-0 text-kokum" aria-hidden="true" /><span
											class="flex min-w-0 flex-1 flex-col"
											><span class="type-h3 break-words">{s.name}</span><span
												class="type-small text-text-2">{msg(`type_${s.type}`)}</span
											></span
										><ChevronRight size={18} class="shrink-0 text-text-2" aria-hidden="true" /></a
									>
								</li>
							{/each}
						</ul>
					</InsetList>
				{:else}
					<p class="type-body text-text-2">{m.saved_empty()}</p>
				{/if}
			</section>

			<!-- T3-04 (F1): a stamp for each place checked in at with its QR code, newest first. -->
			<section class="flex flex-col gap-3" data-testid="my-stamps">
				<h2 class="type-h2">{m.me_stamps()}</h2>
				{#if data.stamps.length}
					<ul class="grid grid-cols-2 gap-3 sm:grid-cols-3">
						{#each data.stamps as s (s.slug)}
							<li>
								<a
									href={resolve('/place/[slug]', { slug: s.slug })}
									class={[
										'flex min-h-28 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-lagoon p-3 text-center text-text no-underline',
										fresh.has(s.slug) && 'pop'
									]}
									data-testid="stamp"
									data-fresh={fresh.has(s.slug) || undefined}
									><BadgeCheck size={20} class="text-lagoon" aria-hidden="true" /><span
										class="type-label break-words">{s.name}</span
									><span class="type-small text-text-2">{formatDate(s.date)}</span></a
								>
							</li>
						{/each}
					</ul>
				{:else}
					<p class="type-body text-text-2">{m.me_stamps_empty()}</p>
				{/if}
			</section>
		{/if}

		<OfflinePacks />

		{#if data.signedIn}
			<!-- P12: Crabby's memory is the profile (quiz, sources, style) on its own page. -->
			<a
				href={resolve('/me/crabby')}
				class="row-link flex min-h-16 items-center gap-4 rounded-lg bg-surface p-4 text-text no-underline shadow-e1"
				data-testid="crabby-profile-link"
			>
				<Crabby size={40} />
				<span class="flex min-w-0 flex-1 flex-col">
					<span class="type-body-strong">{m.crabby_me_title()}</span>
					<span class="type-small text-text-2">{m.me_crabby_link_hint()}</span>
				</span>
				<ChevronRight size={20} class="shrink-0 text-text-2" aria-hidden="true" />
			</a>
			<a
				href={resolve('/me/requests')}
				class="row-link flex min-h-14 items-center gap-4 rounded-lg bg-surface px-4 text-text no-underline shadow-e1"
				data-testid="my-requests-link"
			>
				<span class="min-w-0 flex-1 type-body-strong">{m.req_mine()}</span>
				<ChevronRight size={20} class="shrink-0 text-text-2" aria-hidden="true" />
			</a>

			<section class="flex flex-col gap-3" data-testid="consents">
				<h2 class="type-h2">{m.consents_title()}</h2>
				<InsetList>
					<form method="POST" action="?/dwell" class="flex items-start gap-4 p-4">
						<input type="hidden" name="on" value={data.dwell ? '0' : '1'} />
						<div class="flex min-w-0 flex-1 flex-col gap-1">
							<p class="type-body-strong">{m.dwell_title()}</p>
							<p class="type-small text-text-2">{m.dwell_hint()}</p>
						</div>
						<div class="flex shrink-0 items-center gap-1">
							<span class="type-label text-text-2" data-testid="dwell-state"
								>{data.dwell ? m.consent_on() : m.consent_off()}</span
							>
							<button type="submit" class="flex min-h-11 min-w-14 items-center justify-center"
								>{@render toggle(
									data.dwell,
									data.dwell ? m.dwell_revoke() : m.dwell_grant()
								)}</button
							>
						</div>
					</form>
					<div class="flex items-start gap-4 p-4">
						<div class="flex min-w-0 flex-1 flex-col gap-1">
							<p class="type-body-strong">{m.push_title()}</p>
							<p class="type-small text-text-2">
								{push === 'denied' ? m.push_denied() : m.push_iphone()}
							</p>
						</div>
						{#if push === 'on' || push === 'off'}
							<div class="flex shrink-0 items-center gap-1">
								<span class="type-label text-text-2"
									>{push === 'on' ? m.consent_on() : m.consent_off()}</span
								>
								<button
									type="button"
									class="flex min-h-11 min-w-14 items-center justify-center"
									onclick={togglePush}
									>{@render toggle(
										push === 'on',
										push === 'on' ? m.push_disable() : m.push_enable()
									)}</button
								>
							</div>
						{/if}
					</div>
				</InsetList>
			</section>
		{/if}

		{#if data.signedIn}
			<section class="flex flex-col gap-3" data-testid="your-data">
				<h2 class="type-h2">{m.data_title()}</h2>
				{#if data.guest}<p class="type-body text-text-2" data-testid="guest-notice">
						{m.data_guest()}
					</p>{/if}
				<div class="flex flex-wrap gap-3">
					<a
						href={resolve('/api/me/export')}
						download
						class="inline-flex min-h-12 items-center rounded-md bg-surface-2 px-5 type-body-strong text-text no-underline hover:bg-surface-3"
						data-testid="data-export">{m.data_export()}</a
					>
					{#if !data.isStaff}
						<Button variant="ghost" onclick={() => ((confirmWord = ''), deleteDialog?.showModal())}
							>{m.data_delete()}</Button
						>
					{/if}
				</div>
			</section>
			<dialog
				bind:this={deleteDialog}
				class="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-xl bg-surface p-5 text-text shadow-e3 backdrop:bg-text/40"
				aria-labelledby="delete-title"
			>
				<form class="flex flex-col gap-4" onsubmit={deleteAccount}>
					<h2 id="delete-title" class="type-h2">{m.data_delete()}</h2>
					<p class="type-body">{m.data_delete_body()}</p>
					<label class="flex flex-col gap-1.5 type-small">
						{m.data_delete_type()}
						<input
							bind:value={confirmWord}
							class="field h-12 px-3 type-body"
							autocomplete="off"
							data-testid="delete-confirm"
						/>
					</label>
					<div class="flex flex-wrap justify-end gap-2">
						<Button variant="ghost" type="button" onclick={() => deleteDialog?.close()}
							>{m.data_keep()}</Button
						>
						<Button
							type="submit"
							loading={deleting}
							disabled={confirmWord.trim().toLowerCase() !== 'delete'}
							>{m.data_delete_confirm()}</Button
						>
					</div>
				</form>
			</dialog>
		{/if}

		<section class="flex flex-col gap-3">
			<h2 class="type-h2">{m.language()} · {m.theme()}</h2>
			<div class="flex flex-col gap-4 rounded-lg bg-surface p-4 shadow-e1">
				<form method="POST" action="/prefs" class="flex flex-col gap-2" data-clip-check>
					<input type="hidden" name="return" value="/me" />
					<p class="type-small text-text-2">{m.language()}</p>
					<div class="flex w-fit max-w-full flex-wrap rounded-full bg-surface-2 p-0.5">
						{#each locales as l (l.value)}
							<button
								name="locale"
								value={l.value}
								lang={l.value}
								aria-pressed={locale === l.value}
								class={[
									seg(locale === l.value),
									locale === 'en' && l.value !== 'en' && 'font-[system-ui]'
								]}>{l.label}</button
							>
						{/each}
					</div>
				</form>
				<form method="POST" action="/prefs" class="flex flex-col gap-2" data-clip-check>
					<input type="hidden" name="return" value="/me" />
					<p class="type-small text-text-2">{m.theme()}</p>
					<div class="flex w-fit max-w-full flex-wrap rounded-full bg-surface-2 p-0.5">
						{#each themes as t (t.value)}
							<button
								name="theme"
								value={t.value}
								aria-pressed={data.theme === t.value}
								class={seg(data.theme === t.value)}>{t.label()}</button
							>
						{/each}
					</div>
				</form>
			</div>
		</section>

		<InsetList>
			<ul>
				{#if data.isStaff}<li class="border-b border-border">
						<a href={resolve('/admin')} class={row}
							><Wrench size={20} class="shrink-0 text-text-2" aria-hidden="true" /><span
								class="flex-1 type-body-strong">{m.me_staff()}</span
							><ChevronRight size={18} class="shrink-0 text-text-2" aria-hidden="true" /></a
						>
					</li>{/if}
				{#if data.isOwner}<li class="border-b border-border">
						<a href={resolve('/owner')} class={row}
							><Store size={20} class="shrink-0 text-text-2" aria-hidden="true" /><span
								class="flex-1 type-body-strong">{m.me_owner()}</span
							><ChevronRight size={18} class="shrink-0 text-text-2" aria-hidden="true" /></a
						>
					</li>{/if}
				<li class="border-b border-border">
					<a href={resolve('/terms')} class={row}
						><FileText size={20} class="shrink-0 text-text-2" aria-hidden="true" /><span
							class="flex-1 type-body-strong">{m.terms_title()}</span
						><ChevronRight size={18} class="shrink-0 text-text-2" aria-hidden="true" /></a
					>
				</li>
				<li>
					<a href={resolve('/privacy')} class={row}
						><Shield size={20} class="shrink-0 text-text-2" aria-hidden="true" /><span
							class="flex-1 type-body-strong">{m.privacy_title()}</span
						><ChevronRight size={18} class="shrink-0 text-text-2" aria-hidden="true" /></a
					>
				</li>
			</ul>
		</InsetList>

		{#if data.email && !gate.on}
			<form method="POST" action="/login?/signOut" class="[&>*]:w-full" onsubmit={purgeThenSubmit}>
				<Button variant="outline" type="submit">{m.sign_out()}</Button>
			</form>
		{/if}
	</div>
</Page>
<!-- TODO(before-deploy): restore full auth — temp admin email gate. -->
{#if gate.on}<AdminGate bind:open={gateOpen} />{/if}
