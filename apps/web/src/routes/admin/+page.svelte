<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';
	import Page from '#lib/components/Page.svelte';
	import Button from '#lib/components/Button.svelte';
	import StatusBadge from '#lib/components/StatusBadge.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	const links = $derived([
		{ href: resolve('/admin/field'), label: m.field_title() },
		{ href: resolve('/admin/reports'), label: m.reports_title() },
		{ href: resolve('/admin/proofs'), label: m.proofs_title() },
		...(data.isReviewer
			? [
					{ href: resolve('/admin/review'), label: m.review_title() },
					{ href: resolve('/admin/moderation'), label: m.moderation_title() }
				]
			: []),
		...(data.isAdmin
			? [
					{ href: resolve('/admin/claims'), label: m.claims_title() },
					{ href: resolve('/admin/qr'), label: m.qr_admin_title() }
				]
			: [])
	]);
</script>

<Page title={m.admin_title()} back>
	<div class="mx-auto flex max-w-[680px] flex-col gap-6">
		<nav class="grid grid-cols-2 gap-3">
			{#each links as l (l.href)}
				<a
					href={l.href}
					class="flex min-h-14 items-center rounded-card border border-border bg-surface px-4 type-h3 text-text no-underline"
					>{l.label}</a
				>
			{/each}
		</nav>
		<section class="flex flex-col gap-3">
			<h2 class="type-h2">{m.recheck_title()}</h2>
			{#if data.due.length}
				<ul
					class="flex flex-col divide-y divide-border rounded-card border border-border bg-surface"
				>
					{#each data.due as p (p.id)}
						<li class="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
							<div>
								<a href={resolve('/place/[slug]', { slug: p.slug })} class="type-body">{p.name}</a>
								{#if p.last}<div><StatusBadge kind="last-verified" date={p.last} /></div>{/if}
							</div>
							<form method="POST" action="?/verified" use:enhance>
								<input type="hidden" name="id" value={p.id} />
								<Button type="submit" variant="secondary">{m.recheck_mark()}</Button>
							</form>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="type-body text-text-2">{m.recheck_empty()}</p>
			{/if}
		</section>
	</div>
</Page>
