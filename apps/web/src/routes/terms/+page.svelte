<script lang="ts">
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import { m } from '#lib/paraglide/messages.js';
	import Page from '#lib/components/Page.svelte';

	// Terms of use (hardening 2026-11, SEC-15): headed sections with placeholders only. The owner writes the legal
	// text before launch (owner step M9); nothing here is a legal term yet.
	const sections = [
		m.terms_s_who(),
		m.terms_s_use(),
		m.terms_s_content(),
		m.terms_s_listings(),
		m.terms_s_liability(),
		m.terms_s_changes(),
		m.terms_s_contact()
	];
</script>

<Page title={m.terms_title()}>
	<article class="mx-auto flex max-w-170 flex-col gap-8">
		<p
			class="flex gap-2.5 rounded-lg bg-caution-50 p-4 type-small text-text"
			data-testid="terms-draft"
		>
			<TriangleAlert size={18} class="mt-0.5 shrink-0" aria-hidden="true" />{m.terms_draft()}
		</p>
		{#each sections as title (title)}
			<section class="flex flex-col gap-2">
				<h2 class="type-h2">{title}</h2>
				<p class="type-body text-text-2">{m.terms_placeholder()}</p>
			</section>
		{/each}
	</article>
</Page>
