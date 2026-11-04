<script lang="ts">
	import FileDown from '@lucide/svelte/icons/file-down';
	import Link from '@lucide/svelte/icons/link';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { submitting } from '#lib/forms.ts';
	import { m } from '#lib/paraglide/messages.js';
	import { formatDate } from '#lib/format.ts';
	import { toast } from '#lib/toast.svelte.ts';
	import Meta from '#lib/components/Meta.svelte';
	import TopBar from '#lib/components/TopBar.svelte';
	import Button from '#lib/components/Button.svelte';
	import TripReport from '#lib/components/plan/TripReport.svelte';
	import type { PageProps } from './$types';

	// Trip report (P12 step H): live (follows every plan edit) or a finalized version; Print = PDF; the share link
	// shows the latest finalized version to anyone with the trip's read-only link.
	let { data }: PageProps = $props();
	async function copyShare() {
		await navigator.clipboard
			?.writeText(`${page.url.origin}/plan/share/${data.shareToken}/report`)
			.catch(() => {});
		toast(m.plan_link_copied());
	}
</script>

<Meta title={data.report.cover.title} />
<TopBar title={m.rep_title()} back />
<main id="main" class="mx-auto flex w-full max-w-190 flex-col gap-6 px-5 py-6">
	<div class="flex flex-wrap items-center gap-2 print:hidden">
		<span class="rounded-full bg-surface-2 px-3 py-1 type-label" data-testid="report-version">
			{data.version ? m.rep_version({ n: data.version }) : m.rep_live()}
		</span>
		{#if data.version}
			<a href={resolve('/plan/[id]/report', { id: data.tripId })} class="type-small"
				>{m.rep_see_live()}</a
			>
		{/if}
		<!-- eslint-disable svelte/no-navigation-without-resolve -- resolve() + a ?v= query -->
		{#each data.versions.filter((x) => x.version !== data.version) as x (x.version)}
			<a
				href={`${resolve('/plan/[id]/report', { id: data.tripId })}?v=${x.version}`}
				class="type-small">{m.rep_version({ n: x.version })} · {formatDate(x.created_at)}</a
			>
		{/each}
		<!-- eslint-enable svelte/no-navigation-without-resolve -->
	</div>
	<div class="flex flex-wrap gap-2 print:hidden">
		{#if data.canFinalize && !data.version}
			<form method="POST" action="?/finalize" use:submitting>
				<Button type="submit">{m.rep_finalize()}</Button>
			</form>
		{/if}
		<Button variant="secondary" onclick={() => window.print()}>
			{#snippet icon()}<FileDown size={20} aria-hidden="true" />{/snippet}{m.plan_pdf()}
		</Button>
		{#if data.versions.length}
			<Button variant="ghost" onclick={copyShare}>
				{#snippet icon()}<Link size={20} aria-hidden="true" />{/snippet}{m.rep_share()}
			</Button>
		{/if}
	</div>
	<TripReport r={data.report} summary={data.summary} />
</main>
