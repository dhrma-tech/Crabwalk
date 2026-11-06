<script lang="ts">
	import Phone from '@lucide/svelte/icons/phone';
	import MessageCircle from '@lucide/svelte/icons/message-circle';
	import { m } from '#lib/paraglide/messages.js';
	import Button from '../Button.svelte';
	import { telHref, waHref } from '#lib/phone.ts';

	// Direct call / WhatsApp (homestays not on OTAs, BACKEND §13). Numbers are stored as 10 digits (field forms).
	let { phone, whatsapp }: { phone: string | null; whatsapp: string | null } = $props();
</script>

{#if phone || whatsapp}
	<div class="flex flex-wrap gap-2">
		{#if phone}
			<Button variant="secondary" href={telHref(phone)}>
				{#snippet icon()}<Phone size={20} aria-hidden="true" />{/snippet}{m.call()}
			</Button>
		{/if}
		{#if whatsapp}
			<Button variant="secondary" href={waHref(whatsapp)}>
				{#snippet icon()}<MessageCircle size={20} aria-hidden="true" />{/snippet}{m.whatsapp()}
			</Button>
		{/if}
	</div>
{/if}
