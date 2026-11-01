<script lang="ts">
	import { resolve } from '$app/paths';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import Route from '@lucide/svelte/icons/route';
	import User from '@lucide/svelte/icons/user';
	import Wrench from '@lucide/svelte/icons/wrench';
	import Store from '@lucide/svelte/icons/store';
	import Shield from '@lucide/svelte/icons/shield';
	import { m } from '#lib/paraglide/messages.js';
	import { getLocale } from '#lib/paraglide/runtime.js';
	import Page from '#lib/components/Page.svelte';
	import Button from '#lib/components/Button.svelte';
	import InsetList from '#lib/components/InsetList.svelte';
	import { msg } from '#lib/msg.ts';
	import { formatDate } from '#lib/format.ts';
	import OfflinePacks from '#lib/components/OfflinePacks.svelte';
	import { enablePush, disablePush, pushStatus } from '#lib/push.ts';
	import { onMount } from 'svelte';
	import type { PageProps } from './$types';
	import { page } from '$app/state';
	import { loginHref } from '#lib/login.ts';

	// Me (FRONTEND §7.14). Tideline (Report 2 §9.12, Report 1 §4.7, T-37): profile card, then trips → offline packs
	// → preferences → privacy choices → language & theme → tools → privacy → sign out. Saved lands in step F (T-5).
	let { data, form }: PageProps = $props();
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
				{#if data.email}
					<p class="type-body break-words text-text">{m.me_signed_in_as({ email: data.email })}</p>
				{:else}
					<p class="type-body text-text">{m.me_guest()}</p>
					<Button href={loginHref(page.url)}>{m.sign_in()}</Button>
				{/if}
			</div>
		</section>

		{#if data.email}
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
		{/if}

		<OfflinePacks />

		{#if data.email}
			<form method="POST" action="?/prefs" class="flex flex-col gap-3" data-testid="prefs">
				<h2 class="type-h2">{m.me_prefs()}</h2>
				<p class="type-small text-text-2">{m.me_prefs_hint()}</p>
				<div class="flex flex-col gap-4 rounded-lg bg-surface p-4 shadow-e1">
					<label class="flex flex-col gap-1.5 type-small text-text-2"
						>{m.plan_diet()}
						<select name="diet" class="field h-12 px-3 type-body text-text">
							<option value="">{m.filter_any()}</option>
							<option value="veg" selected={data.prefs.diet === 'veg'}>{m.diet_veg()}</option>
							<option value="non_veg" selected={data.prefs.diet === 'non_veg'}
								>{m.diet_nonveg()}</option
							>
							<option value="jain" selected={data.prefs.diet === 'jain'}>{m.diet_jain()}</option>
						</select>
					</label>
					<label class="flex flex-col gap-1.5 type-small text-text-2"
						>{m.plan_budget()}
						<select name="budget_level" class="field h-12 px-3 type-body text-text">
							<option value="">{m.filter_any()}</option>
							{#each ['budget', 'mid', 'premium'] as b (b)}<option
									value={b}
									selected={data.prefs.budget_level === b}>{msg(`budget_level_${b}`)}</option
								>{/each}
						</select>
					</label>
					<label class="flex flex-col gap-1.5 type-small text-text-2"
						>{m.plan_group()}
						<select name="group_type" class="field h-12 px-3 type-body text-text">
							<option value="">{m.filter_any()}</option>
							{#each ['family', 'couple', 'friends', 'solo'] as g (g)}<option
									value={g}
									selected={data.prefs.group_type === g}>{msg(`group_${g}`)}</option
								>{/each}
						</select>
					</label>
					<div class="flex flex-wrap items-center gap-3">
						<Button type="submit" variant="outline">{m.plan_save()}</Button>
						{#if form?.prefsSaved}<p class="type-small text-text" role="status">
								{m.owner_saved()}
							</p>{/if}
					</div>
				</div>
			</form>

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
				<li>
					<a href={resolve('/privacy')} class={row}
						><Shield size={20} class="shrink-0 text-text-2" aria-hidden="true" /><span
							class="flex-1 type-body-strong">{m.privacy_title()}</span
						><ChevronRight size={18} class="shrink-0 text-text-2" aria-hidden="true" /></a
					>
				</li>
			</ul>
		</InsetList>

		{#if data.email}
			<form method="POST" action="/login?/signOut" class="[&>*]:w-full">
				<Button variant="outline" type="submit">{m.sign_out()}</Button>
			</form>
		{/if}
	</div>
</Page>
