<script lang="ts">
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';
	import { menu } from '#lib/menu.svelte.ts';
	import LanguageSwitch from './LanguageSwitch.svelte';
	import BrandMark from './BrandMark.svelte';
	import SearchBox from './SearchBox.svelte';

	// FRONTEND §5: back, title, language switch, search. Suna: phones show the 蟹 mark (or ‹) + title;
	// laptops add ☰ (menu drawer, P10a-4), the wordmark and the search field.
	let { title, back = false }: { title: string; back?: boolean } = $props();

	function goBack(e: MouseEvent) {
		if (history.length > 1) {
			e.preventDefault();
			history.back();
		}
	}
</script>

<header class="sticky top-0 z-20 bg-bg pt-[env(safe-area-inset-top)] print:hidden">
	<div
		class="mx-auto flex min-h-14 max-w-[1200px] items-center gap-3 px-6 py-1.5 lg:min-h-[76px] lg:gap-5 lg:px-10"
		data-clip-check
	>
		<button
			type="button"
			class="hidden size-11 shrink-0 flex-col items-center justify-center gap-[5px] border border-text lg:flex"
			aria-label={m.nav_menu()}
			aria-expanded={menu.open}
			aria-controls="app-menu"
			onclick={() => (menu.open = !menu.open)}
		>
			{#each [0, 1, 2] as i (i)}<span class="h-px w-[18px] bg-text"></span>{/each}
		</button>
		<a
			href={resolve('/')}
			class="hidden shrink-0 text-[17px] font-medium text-text no-underline lg:block"
			>{m.app_name()}</a
		>
		{#if back}
			<a
				href={resolve('/')}
				class="-ml-2 flex size-11 shrink-0 items-center justify-center text-[26px] leading-none text-text no-underline lg:ml-0"
				aria-label={m.back()}
				onclick={goBack}><span aria-hidden="true">‹</span></a
			>
		{:else}
			<span class="lg:hidden"><BrandMark /></span>
		{/if}
		<h1 class={['min-w-0 flex-1 type-h3 lg:text-[17px]', title === m.app_name() && 'lg:sr-only']}>
			{title}
		</h1>
		<SearchBox class="hidden max-w-[520px] flex-1 lg:block" />
		<div class="ml-auto shrink-0"><LanguageSwitch /></div>
	</div>
</header>
