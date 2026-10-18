<script lang="ts">
	import { resolve } from '$app/paths';
	import ArrowLeft from '@lucide/svelte/icons/arrow-left';
	import Search from '@lucide/svelte/icons/search';
	import { m } from '#lib/paraglide/messages.js';
	import { toast } from '#lib/toast.svelte.ts';
	import LanguageSwitch from './LanguageSwitch.svelte';

	// FRONTEND §5: back, title, language switch, search.
	let { title, back = false }: { title: string; back?: boolean } = $props();

	function goBack(e: MouseEvent) {
		if (history.length > 1) {
			e.preventDefault();
			history.back();
		}
	}
</script>

<header
	class="sticky top-0 z-20 border-b border-border bg-bg/95 print:hidden pt-[env(safe-area-inset-top)] backdrop-blur"
>
	<div class="mx-auto flex min-h-14 max-w-[1200px] items-center gap-2 px-4 py-1" data-clip-check>
		{#if back}
			<a
				href={resolve('/')}
				class="-ml-2 flex size-11 items-center justify-center rounded-chip text-text"
				aria-label={m.back()}
				onclick={goBack}
			>
				<ArrowLeft size={24} aria-hidden="true" />
			</a>
		{/if}
		<h1 class="min-w-0 flex-1 type-h2 lg:type-h1">{title}</h1>
		<LanguageSwitch />
		<!-- No search route in the spec yet: honest, disabled control. -->
		<button
			type="button"
			class="flex size-11 items-center justify-center rounded-chip text-muted"
			aria-label={m.search()}
			aria-disabled="true"
			title={m.search_later()}
			onclick={() => toast(m.search_later())}
		>
			<Search size={24} aria-hidden="true" />
		</button>
	</div>
</header>
