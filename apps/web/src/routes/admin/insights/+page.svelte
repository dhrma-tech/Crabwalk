<script lang="ts">
	import Page from '#lib/components/Page.svelte';
	import { formatNumber } from '#lib/format.ts';
	import type { PageProps } from './$types';

	// Internal tool, English only like the content editor (hardening D-22). Counts only: the event log holds no
	// people (no user id, IP, email or free text), and a session hash that changes every day.
	let { data }: PageProps = $props();
	const names = $derived([...new Set(data.rows.map((r) => r.name))].sort());
	const days = $derived([...new Set(data.rows.map((r) => r.day))].sort().reverse());
	const count = (day: string, name: string) =>
		data.rows.find((r) => r.day === day && r.name === name)?.n ?? 0;
	const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)} %` : '—');
</script>

<Page title="Insights" back>
	<div class="mx-auto flex max-w-300 flex-col gap-8">
		<section aria-labelledby="funnel-title" class="flex flex-col gap-3">
			<h2 id="funnel-title" class="type-h2">QR funnel, last 30 days</h2>
			<dl class="grid grid-cols-3 gap-3" data-testid="qr-funnel">
				<div class="rounded-lg bg-surface p-4 shadow-e1">
					<dt class="type-small text-text-2">Scans opened</dt>
					<dd class="type-h2 tabular-nums">{formatNumber(data.funnel.landing)}</dd>
				</div>
				<div class="rounded-lg bg-surface p-4 shadow-e1">
					<dt class="type-small text-text-2">Visit checks</dt>
					<dd class="type-h2 tabular-nums">
						{formatNumber(data.funnel.checks)}
						<span class="type-small text-text-2"
							>{pct(data.funnel.checks, data.funnel.landing)}</span
						>
					</dd>
				</div>
				<div class="rounded-lg bg-surface p-4 shadow-e1">
					<dt class="type-small text-text-2">Verified</dt>
					<dd class="type-h2 tabular-nums">
						{formatNumber(data.funnel.verified)}
						<span class="type-small text-text-2"
							>{pct(data.funnel.verified, data.funnel.checks)}</span
						>
					</dd>
				</div>
			</dl>
		</section>
		<section aria-labelledby="daily-title" class="flex flex-col gap-3">
			<h2 id="daily-title" class="type-h2">Events per day (IST)</h2>
			{#if !days.length}
				<p class="type-body text-text-2">No events in the last 30 days.</p>
			{:else}
				<div class="overflow-x-auto">
					<table class="w-full type-small tabular-nums" data-testid="insights-daily">
						<thead>
							<tr class="text-left text-text-2">
								<th scope="col" class="py-2 pr-4">Day</th>
								{#each names as n (n)}<th scope="col" class="py-2 pr-4 font-mono">{n}</th>{/each}
							</tr>
						</thead>
						<tbody>
							{#each days as d (d)}
								<tr class="border-t border-border">
									<th scope="row" class="py-2 pr-4 text-left font-normal whitespace-nowrap">{d}</th>
									{#each names as n (n)}<td class="py-2 pr-4">{count(d, n) || ''}</td>{/each}
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</section>
	</div>
</Page>
