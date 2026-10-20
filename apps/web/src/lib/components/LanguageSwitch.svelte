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
	<div class="flex rounded-chip border border-border bg-surface p-0.5">
		{#each options as o (o.locale)}
			<button
				name="locale"
				value={o.locale}
				lang={o.locale}
				aria-label={o.name}
				aria-pressed={o.locale === current}
				class={[
					'flex h-10 min-w-10 items-center justify-center rounded-chip px-2 type-small',
					o.locale === current ? 'bg-sea-500 text-white' : 'text-text-2',
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
