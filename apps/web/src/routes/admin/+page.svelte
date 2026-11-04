<script lang="ts">
	import { submitting } from '#lib/forms.ts';
	import { resolve } from '$app/paths';
	import MapPinPlus from '@lucide/svelte/icons/map-pin-plus';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import QrCode from '@lucide/svelte/icons/qr-code';
	import CalendarDays from '@lucide/svelte/icons/calendar-days';
	import SlidersHorizontal from '@lucide/svelte/icons/sliders-horizontal';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import { m } from '#lib/paraglide/messages.js';
	import Page from '#lib/components/Page.svelte';
	import Button from '#lib/components/Button.svelte';
	import InsetList from '#lib/components/InsetList.svelte';
	import StatusBadge from '#lib/components/StatusBadge.svelte';
	import type { PageProps } from './$types';

	// Tideline tool variant (Report 2 §9.15, T-41): queue counter tiles, tools as inset rows.
	let { data }: PageProps = $props();
	const c = $derived(data.counts);
	const queues = $derived(
		[
			{ n: c.review, href: resolve('/admin/review'), label: m.review_title() },
			{ n: c.reports, href: resolve('/admin/reports'), label: m.reports_title() },
			{ n: c.proofs, href: resolve('/admin/proofs'), label: m.proofs_title() },
			{ n: c.moderation, href: resolve('/admin/moderation'), label: m.moderation_title() },
			{ n: c.routes, href: resolve('/admin/routes'), label: m.routes_title() },
			{ n: c.claims, href: resolve('/admin/claims'), label: m.claims_title() },
			{ n: c.questions, href: resolve('/admin/questions'), label: m.team_title() }
		].filter((q) => q.n != null)
	);
	const tools = $derived([
		{ href: resolve('/admin/field'), label: m.field_title(), icon: MapPinPlus },
		{ href: resolve('/admin/alerts'), label: m.alerts_title(), icon: TriangleAlert },
		...(data.isAdmin
			? [
					{ href: resolve('/admin/qr'), label: m.qr_admin_title(), icon: QrCode },
					{ href: resolve('/admin/events'), label: m.events_title(), icon: CalendarDays },
					{ href: resolve('/admin/planner'), label: m.planner_settings(), icon: SlidersHorizontal }
				]
			: [])
	]);
</script>

<Page title={m.admin_title()} back tool>
	<div class="mx-auto flex max-w-170 flex-col gap-6">
		<section aria-labelledby="waiting" class="flex flex-col gap-3">
			<h2 id="waiting" class="type-h2">{m.admin_waiting()}</h2>
			<ul class="grid grid-cols-2 gap-3 sm:grid-cols-3" data-testid="queue-counter">
				{#each queues as q (q.href)}
					<li>
						<a
							href={q.href}
							class="row-link flex h-full min-h-24 flex-col justify-between gap-1 rounded-lg bg-surface p-4 text-text no-underline shadow-e1"
							><span class={['type-display', q.n ? 'text-kokum' : 'text-text-2']}>{q.n}</span><span
								class="type-small text-text-2">{q.label}</span
							></a
						>
					</li>
				{/each}
			</ul>
		</section>
		<InsetList>
			<ul>
				{#each tools as t (t.href)}
					<li class="border-b border-border last:border-0">
						<a
							href={t.href}
							class="row-link flex min-h-14 items-center gap-3 px-4 py-2.5 text-text no-underline"
							><t.icon size={20} class="shrink-0 text-lagoon" aria-hidden="true" /><span
								class="min-w-0 flex-1 type-body-strong">{t.label}</span
							><ChevronRight size={18} class="shrink-0 text-text-2" aria-hidden="true" /></a
						>
					</li>
				{/each}
			</ul>
		</InsetList>
		<section aria-labelledby="recheck" class="flex flex-col gap-3">
			<h2 id="recheck" class="type-h2">{m.recheck_title()}</h2>
			{#if data.due.length}
				<InsetList>
					<ul>
						{#each data.due as p (p.id)}
							<li
								class="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-2.5 last:border-0"
							>
								<div class="min-w-0">
									<a
										href={resolve('/place/[slug]', { slug: p.slug })}
										class="inline-flex min-h-11 items-center type-body-strong">{p.name}</a
									>
									{#if p.last}<div><StatusBadge kind="last-verified" date={p.last} /></div>{/if}
								</div>
								<form method="POST" action="?/verified" use:submitting>
									<input type="hidden" name="id" value={p.id} />
									<Button type="submit" variant="secondary">{m.recheck_mark()}</Button>
								</form>
							</li>
						{/each}
					</ul>
				</InsetList>
			{:else}
				<p class="type-body text-text-2">{m.recheck_empty()}</p>
			{/if}
		</section>
	</div>
</Page>
