<script lang="ts">
	import Page from '#lib/components/Page.svelte';
	import type { PageProps } from './$types';

	// Internal tool, English only like the content editor (hardening D-22): admin gate, limiter, AI budget, CSP
	// reports and quota hits, newest first. Times in IST.
	let { data }: PageProps = $props();
	const when = new Intl.DateTimeFormat('en-IN', {
		dateStyle: 'medium',
		timeStyle: 'medium',
		timeZone: 'Asia/Kolkata'
	});
</script>

<Page title="Security events" back>
	<div class="mx-auto max-w-300">
		{#if !data.events.length}
			<p class="type-body text-text-2">No events in the last 90 days.</p>
		{:else}
			<div class="overflow-x-auto">
				<table class="w-full type-small" data-testid="security-events">
					<thead>
						<tr class="text-left text-text-2">
							<th scope="col" class="py-2 pr-4">When (IST)</th>
							<th scope="col" class="py-2 pr-4">Event</th>
							<th scope="col" class="py-2 pr-4">Client</th>
							<th scope="col" class="py-2">Detail</th>
						</tr>
					</thead>
					<tbody>
						{#each data.events as e (e.id)}
							<tr class="border-t border-border align-top">
								<td class="py-2 pr-4 whitespace-nowrap">{when.format(new Date(e.at))}</td>
								<td class="py-2 pr-4 font-mono">{e.kind}</td>
								<td class="py-2 pr-4 font-mono">{e.client_key?.slice(0, 8) ?? '—'}</td>
								<td class="py-2 font-mono break-all">{e.detail ? JSON.stringify(e.detail) : ''}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</div>
</Page>
