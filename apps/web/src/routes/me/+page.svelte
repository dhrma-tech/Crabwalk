<script lang="ts">
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';
	import Page from '#lib/components/Page.svelte';
	import Button from '#lib/components/Button.svelte';
	import type { PageProps } from './$types';

	// Me shell (P2). Saved trips, packs, roles etc. are added by later phases.
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
