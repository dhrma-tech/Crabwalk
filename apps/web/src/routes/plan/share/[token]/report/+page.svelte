<script lang="ts">
	import FileDown from '@lucide/svelte/icons/file-down';
	import { m } from '#lib/paraglide/messages.js';
	import Meta from '#lib/components/Meta.svelte';
	import TopBar from '#lib/components/TopBar.svelte';
	import Button from '#lib/components/Button.svelte';
	import TripReport from '#lib/components/plan/TripReport.svelte';
	import type { PageProps } from './$types';

	// Shared trip report (P12 step H): read-only, the latest finalized version.
	let { data }: PageProps = $props();
</script>

<Meta title={data.report.cover.title} />
<TopBar title={m.rep_title()} />
<main id="main" class="mx-auto flex w-full max-w-190 flex-col gap-6 px-5 py-6">
	<div class="flex flex-wrap items-center gap-2 print:hidden">
		<span class="rounded-full bg-surface-2 px-3 py-1 type-label"
			>{m.rep_version({ n: data.version })}</span
		>
		<Button variant="secondary" onclick={() => window.print()}>
			{#snippet icon()}<FileDown size={20} aria-hidden="true" />{/snippet}{m.plan_pdf()}
		</Button>
	</div>
	<TripReport r={data.report} summary={data.summary} />
</main>
