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

<form method="POST" action="/prefs" class="shrink-0" aria-label={m.language()}>
	<input type="hidden" name="return" value={page.url.pathname + page.url.search} />
	<!-- Tideline segmented pill (Report 2 §8): 44 px targets, the current one a raised surface thumb. -->
	<div class="flex rounded-full bg-surface-2">
		{#each options as o (o.locale)}
			{@const on = o.locale === current}
			<button
				name="locale"
				value={o.locale}
				lang={o.locale}
				aria-label={o.name}
				aria-pressed={on}
				class={[
					'group flex size-11 items-center justify-center type-label',
					// P10-4: on English pages the हि / म labels use the system font, so the Devanagari
					// web-font files are never downloaded just for this switch.
					current === 'en' && o.locale !== 'en' && 'font-[system-ui]'
				]}
			>
				<span
					class={[
						'flex h-9 min-w-9 items-center justify-center rounded-full px-2 transition-colors duration-200',
						on ? 'bg-surface text-text shadow-e1' : 'text-text-2 group-hover:text-text'
					]}>{o.short}</span
				>
			</button>
		{/each}
	</div>
</form>
