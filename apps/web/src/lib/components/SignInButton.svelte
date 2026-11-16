<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import { m } from '#lib/paraglide/messages.js';
	import { ensureSession, guestMode, signInHref } from '#lib/guest.client.ts';
	import Button from './Button.svelte';

	// The "Sign in" call to action wherever a feature needs a session. Full auth: a link to /login that returns
	// here. Temp gate (SEC-02): one tap creates the guest session in place and reloads the page data; if that
	// fails (blocked challenge, offline) it falls back to the /guest page, which explains and offers Retry.
	let {
		label = m.sign_in(),
		variant = 'primary'
	}: { label?: string; variant?: 'primary' | 'secondary' | 'outline' | 'ghost' } = $props();
	let busy = $state(false);

	async function start() {
		busy = true;
		if (await ensureSession()) await invalidateAll();
		else location.href = signInHref(page.url);
		busy = false;
	}
</script>

{#if guestMode()}
	<Button {variant} loading={busy} onclick={start} data-testid="guest-continue"
		>{m.guest_continue()}</Button
	>
{:else}
	<Button {variant} href={signInHref(page.url)}>{label}</Button>
{/if}
