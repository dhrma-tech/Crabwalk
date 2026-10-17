<script lang="ts">
	import Phone from '@lucide/svelte/icons/phone';
	import MessageCircle from '@lucide/svelte/icons/message-circle';
	import { m } from '#lib/paraglide/messages.js';
	import Button from '../Button.svelte';

	// Direct call / WhatsApp (homestays not on OTAs, BACKEND §13).
	let { phone, whatsapp }: { phone: string | null; whatsapp: string | null } = $props();
	const digits = (s: string) => s.replace(/[^\d+]/g, '');
</script>

{#if phone || whatsapp}
	<div class="flex flex-wrap gap-2">
		{#if phone}
			<Button variant="secondary" href={`tel:${digits(phone)}`}>
				{#snippet icon()}<Phone size={20} aria-hidden="true" />{/snippet}{m.call()}
			</Button>
		{/if}
		{#if whatsapp}
			<Button variant="secondary" href={`https://wa.me/${digits(whatsapp).replace('+', '')}`}>
				{#snippet icon()}<MessageCircle size={20} aria-hidden="true" />{/snippet}{m.whatsapp()}
			</Button>
		{/if}
	</div>
{/if}
