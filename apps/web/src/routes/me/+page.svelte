<script lang="ts">
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';
	import Page from '#lib/components/Page.svelte';
	import Button from '#lib/components/Button.svelte';
	import { formatDate } from '#lib/format.ts';
	import type { PageProps } from './$types';

	// Me (FRONTEND §7.14). Trips from P7; offline packs (P9) and consents arrive later.
	let { data }: PageProps = $props();
	const themes = [
		{ value: 'system', label: m.theme_system },
		{ value: 'light', label: m.theme_light },
		{ value: 'dark', label: m.theme_dark }
	] as const;
</script>

<Page title={m.nav_me()}>
	<div class="mx-auto flex max-w-[680px] flex-col gap-6">
		<section class="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
			{#if data.email}
				<p class="type-body">{m.me_signed_in_as({ email: data.email })}</p>
				<form method="POST" action="/login?/signOut">
					<Button variant="secondary" type="submit">{m.sign_out()}</Button>
				</form>
			{:else}
				<p class="type-body">{m.me_guest()}</p>
				<div><Button href={resolve('/login')}>{m.sign_in()}</Button></div>
			{/if}
		</section>

		{#if data.email}
			<section class="flex flex-col gap-3" data-testid="my-trips">
				<h2 class="type-h2">{m.me_trips()}</h2>
				{#if data.trips.length}
					<ul
						class="flex flex-col divide-y divide-border rounded-card border border-border bg-surface"
					>
						{#each data.trips as t (t.id)}
							<li>
								<a
									href={resolve('/plan/[id]', { id: t.id })}
									class="flex flex-col px-4 py-3 text-text no-underline"
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

		{#if data.isStaff || data.isOwner}
			<nav class="flex flex-col gap-2">
				{#if data.isStaff}<a
						href={resolve('/admin')}
						class="flex min-h-12 items-center rounded-card border border-border bg-surface px-4 type-h3 text-text no-underline"
						>{m.me_staff()}</a
					>{/if}
				{#if data.isOwner}<a
						href={resolve('/owner')}
						class="flex min-h-12 items-center rounded-card border border-border bg-surface px-4 type-h3 text-text no-underline"
						>{m.me_owner()}</a
					>{/if}
			</nav>
		{/if}

		<section class="flex flex-col gap-3 rounded-card border border-border bg-surface p-4">
			<h2 class="type-h2">{m.theme()}</h2>
			<form method="POST" action="/prefs" class="flex flex-wrap gap-2" data-clip-check>
				<input type="hidden" name="return" value="/me" />
				{#each themes as t (t.value)}
					<button
						name="theme"
						value={t.value}
						aria-pressed={data.theme === t.value}
						class={[
							'min-h-11 rounded-chip border px-4 type-small',
							data.theme === t.value
								? 'border-sea-500 bg-sea-500 text-white'
								: 'border-border bg-surface text-text'
						]}
					>
						{t.label()}
					</button>
				{/each}
			</form>
		</section>
	</div>
</Page>
