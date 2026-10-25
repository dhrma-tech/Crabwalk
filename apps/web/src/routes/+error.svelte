<script lang="ts">
	import { page } from '$app/state';
	import { m } from '#lib/paraglide/messages.js';
	import { loginHref } from '#lib/login.ts';
	import Page from '#lib/components/Page.svelte';
	import ErrorState from '#lib/components/ErrorState.svelte';
	import Button from '#lib/components/Button.svelte';

	// FRONTEND §6.12: say what happened and what to do next — never a raw error.
	const kind = $derived(
		page.status === 404
			? 'missing'
			: page.status === 401 || page.status === 403
				? 'denied'
				: 'broken'
	);
	const title = $derived(
		kind === 'missing' ? m.not_found_title() : kind === 'denied' ? m.not_allowed() : m.error_title()
	);
</script>

<Page {title} back>
	{#if kind === 'missing'}
		<ErrorState {title} body={m.not_found_body()} art="fort">
			{#snippet action()}<Button href="/">{m.go_discover()}</Button>{/snippet}
		</ErrorState>
	{:else if kind === 'denied'}
		<ErrorState {title} body={m.not_allowed_body()}>
			{#snippet action()}
				<div class="flex flex-wrap items-center gap-4">
					<Button href="/">{m.go_discover()}</Button>
					<Button variant="ghost" href={loginHref(page.url)}>{m.sign_in()}</Button>
				</div>
			{/snippet}
		</ErrorState>
	{:else}
		<ErrorState {title} body={m.error_body()}>
			{#snippet action()}
				<div class="flex flex-col items-start gap-3">
					<Button onclick={() => location.reload()}>{m.try_again()}</Button>
					{#if page.error?.id}<p class="text-[12px] text-text-2">
							{m.error_ref({ id: page.error.id })}
						</p>{/if}
				</div>
			{/snippet}
		</ErrorState>
	{/if}
</Page>
