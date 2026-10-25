<script lang="ts">
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';
	import Page from '#lib/components/Page.svelte';
	import Button from '#lib/components/Button.svelte';
	import { msg } from '#lib/msg.ts';
	import { formatDate } from '#lib/format.ts';
	import OfflinePacks from '#lib/components/OfflinePacks.svelte';
	import { enablePush, disablePush, pushStatus } from '#lib/push.ts';
	import { onMount } from 'svelte';
	import type { PageProps } from './$types';
	import { page } from '$app/state';
	import { loginHref } from '#lib/login.ts';

	// Me (FRONTEND §7.14). Trips from P7; offline packs (P9) and consents arrive later.
	let { data, form }: PageProps = $props();
	let push = $state<'on' | 'off' | 'unsupported' | 'denied'>('unsupported');
	onMount(async () => (push = await pushStatus()));
	async function togglePush() {
		if (push === 'on') {
			await disablePush();
			push = 'off';
		} else push = (await enablePush()) ? 'on' : await pushStatus();
	}
	const sel = 'h-11 border-b border-text bg-bg type-body text-text';
	const themes = [
		{ value: 'system', label: m.theme_system },
		{ value: 'light', label: m.theme_light },
		{ value: 'dark', label: m.theme_dark }
	] as const;
</script>

<Page title={m.nav_me()}>
	<div class="mx-auto flex max-w-[680px] flex-col gap-6">
		<section class="flex flex-col gap-3 border-t border-text pt-3">
			{#if data.email}
				<p class="type-body">{m.me_signed_in_as({ email: data.email })}</p>
				<form method="POST" action="/login?/signOut">
					<Button variant="secondary" type="submit">{m.sign_out()}</Button>
				</form>
			{:else}
				<p class="type-body">{m.me_guest()}</p>
				<div><Button href={loginHref(page.url)}>{m.sign_in()}</Button></div>
			{/if}
		</section>

		{#if data.email}
			<section class="flex flex-col gap-3" data-testid="my-trips">
				<h2 class="type-h2">{m.me_trips()}</h2>
				{#if data.trips.length}
					<ul class="flex flex-col divide-y divide-border border-t border-text">
						{#each data.trips as t (t.id)}
							<li>
								<a
									href={resolve('/plan/[id]', { id: t.id })}
									class="row-link flex flex-col py-3 text-text no-underline"
									><span class="type-h3">{t.title}</span><span class="type-small text-text-2"
										>{m.plan_n_days({ n: t.days })}{t.start_date
											? ` · ${formatDate(t.start_date)}`
											: ''}</span
									></a
								>
							</li>
						{/each}
					</ul>
				{:else}
					<p class="type-body text-text-2">{m.me_no_trips()}</p>
				{/if}
				<div><Button href={resolve('/plan/new')} variant="secondary">{m.plan_new()}</Button></div>
			</section>
		{/if}

		{#if data.email}
			<form
				method="POST"
				action="?/prefs"
				class="flex flex-col gap-3 border-t border-text pt-3"
				data-testid="prefs"
			>
				<h2 class="type-h2">{m.me_prefs()}</h2>
				<p class="type-small text-text-2">{m.me_prefs_hint()}</p>
				<label class="flex flex-col gap-1 type-small text-text-2"
					>{m.plan_diet()}
					<select name="diet" class={sel}>
						<option value="">{m.filter_any()}</option>
						<option value="veg" selected={data.prefs.diet === 'veg'}>{m.diet_veg()}</option>
						<option value="non_veg" selected={data.prefs.diet === 'non_veg'}
							>{m.diet_nonveg()}</option
						>
						<option value="jain" selected={data.prefs.diet === 'jain'}>{m.diet_jain()}</option>
					</select>
				</label>
				<label class="flex flex-col gap-1 type-small text-text-2"
					>{m.plan_budget()}
					<select name="budget_level" class={sel}>
						<option value="">{m.filter_any()}</option>
						{#each ['budget', 'mid', 'premium'] as b (b)}<option
								value={b}
								selected={data.prefs.budget_level === b}>{msg(`budget_level_${b}`)}</option
							>{/each}
					</select>
				</label>
				<label class="flex flex-col gap-1 type-small text-text-2"
					>{m.plan_group()}
					<select name="group_type" class={sel}>
						<option value="">{m.filter_any()}</option>
						{#each ['family', 'couple', 'friends', 'solo'] as g (g)}<option
								value={g}
								selected={data.prefs.group_type === g}>{msg(`group_${g}`)}</option
							>{/each}
					</select>
				</label>
				{#if form?.prefsSaved}<p class="type-small" role="status">{m.owner_saved()}</p>{/if}
				<div><Button type="submit" variant="secondary">{m.plan_save()}</Button></div>
			</form>
		{/if}

		{#if data.email}
			<section class="flex flex-col gap-3 border-t border-text pt-3" data-testid="consents">
				<h2 class="type-h2">{m.consents_title()}</h2>
				<form method="POST" action="?/dwell" class="flex flex-col gap-2">
					<input type="hidden" name="on" value={data.dwell ? '0' : '1'} />
					<p class="type-body">{m.dwell_title()}</p>
					<p class="type-small text-text-2">{m.dwell_hint()}</p>
					<p class="type-small" data-testid="dwell-state">
						{data.dwell ? m.consent_on() : m.consent_off()}
					</p>
					<div>
						<Button type="submit" variant="secondary"
							>{data.dwell ? m.dwell_revoke() : m.dwell_grant()}</Button
						>
					</div>
				</form>
				<div class="flex flex-col gap-2 border-t border-border pt-3">
					<p class="type-body">{m.push_title()}</p>
					{#if push === 'unsupported'}<p class="type-small text-text-2">{m.push_iphone()}</p>
					{:else if push === 'denied'}<p class="type-small text-text-2">{m.push_denied()}</p>
					{:else}
						<div>
							<Button variant="secondary" onclick={togglePush}
								>{push === 'on' ? m.push_disable() : m.push_enable()}</Button
							>
						</div>
						<p class="type-small text-text-2">{m.push_iphone()}</p>
					{/if}
				</div>
			</section>
		{/if}

		<OfflinePacks />

		{#if data.isStaff || data.isOwner}
			<nav class="flex flex-col gap-2">
				{#if data.isStaff}<a
						href={resolve('/admin')}
						class="row-link flex min-h-12 items-center border-b border-border type-h3 text-text no-underline"
						>{m.me_staff()}</a
					>{/if}
				{#if data.isOwner}<a
						href={resolve('/owner')}
						class="row-link flex min-h-12 items-center border-b border-border type-h3 text-text no-underline"
						>{m.me_owner()}</a
					>{/if}
			</nav>
		{/if}

		<p>
			<a href={resolve('/privacy')} class="inline-flex min-h-11 items-center type-body"
				>{m.privacy_title()}</a
			>
		</p>

		<section class="flex flex-col gap-3 border-t border-text pt-3">
			<h2 class="type-h2">{m.theme()}</h2>
			<form
				method="POST"
				action="/prefs"
				class="flex w-fit flex-wrap border border-text"
				data-clip-check
			>
				<input type="hidden" name="return" value="/me" />
				{#each themes as t (t.value)}
					<button
						name="theme"
						value={t.value}
						aria-pressed={data.theme === t.value}
						class={[
							'min-h-11 px-4 type-small',
							data.theme === t.value ? 'bg-text text-bg' : 'text-text'
						]}
					>
						{t.label()}
					</button>
				{/each}
			</form>
		</section>
	</div>
</Page>
