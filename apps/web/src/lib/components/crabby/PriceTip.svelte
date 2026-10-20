<script lang="ts">
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';
	import Button from '../Button.svelte';
	import Crabby from '../Crabby.svelte';

	// Stay price-compare suggestion (PLAN P8 task 11): one line over the rows shown above, on request.
	let { slug }: { slug: string } = $props();
	let status = $state<'idle' | 'busy' | 'signin' | 'limit' | 'error' | 'done'>('idle');
	let text = $state('');

	async function run() {
		status = 'busy';
		const res = await fetch('/api/ai/price-tip', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ slug })
		}).catch(() => null);
		if (res?.status === 401) return void (status = 'signin');
		if (res?.status === 429) return void (status = 'limit');
		const r = res?.ok ? ((await res.json()) as { kind: string; text?: string }) : null;
		if (!r || !r.text) return void (status = 'error');
		text = r.text;
		status = 'done';
	}
</script>

<div class="flex items-start gap-2" data-testid="price-tip">
	{#if status === 'done'}
		<Crabby size={32} />
		<p class="border border-text px-3 py-2 type-small">{text}</p>
	{:else if status === 'signin'}
		<a href={resolve('/login')} class="type-small">{m.crabby_signin()}</a>
	{:else}
		<Button variant="ghost" loading={status === 'busy'} onclick={run}>{m.crabby_price_tip()}</Button
		>
		{#if status === 'limit'}<p class="type-small">{m.crabby_limit()}</p>{/if}
		{#if status === 'error'}<p class="type-small">{m.crabby_unavailable()}</p>{/if}
	{/if}
</div>
