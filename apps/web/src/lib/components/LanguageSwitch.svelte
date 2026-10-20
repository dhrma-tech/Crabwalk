<script lang="ts">
	import { page } from '$app/state';
	import { m } from '#lib/paraglide/messages.js';
	import { getLocale } from '#lib/paraglide/runtime.js';

	// EN / हि / म one-tap switch (FRONTEND §5, §10). Form POST → works without JS.
	const options = [
		{ locale: 'en', short: 'EN', name: 'English' },
		{ locale: 'hi', short: 'हि', name: 'हिन्दी' },
		{ locale: 'mr', short: 'म', name: 'मराठी' }
	] as const;
	const current = getLocale();
</script>

<form method="POST" action="/prefs" class="flex" aria-label={m.language()}>
	<input type="hidden" name="return" value={page.url.pathname + page.url.search} />
	<!-- Suna: plain "EN हि म", the current one underlined in ink; 44 px targets. -->
	<div class="flex">
		{#each options as o (o.locale)}
			<button
				name="locale"
				value={o.locale}
				lang={o.locale}
				aria-label={o.name}
				aria-pressed={o.locale === current}
				class={[
					'flex h-11 min-w-9 items-center justify-center px-1 text-[13px] leading-none',
					o.locale === current
						? 'text-text underline decoration-1 underline-offset-[6px]'
						: 'text-text-2',
					// P10-4: on English pages the हि / म labels use the system font, so the Devanagari
					// web-font files are never downloaded just for this switch.
					current === 'en' && o.locale !== 'en' && 'font-[system-ui]'
				]}
			>
				{o.short}
			</button>
		{/each}
	</div>
</form>
