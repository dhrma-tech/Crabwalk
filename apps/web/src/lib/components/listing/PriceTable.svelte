<script lang="ts" module>
	/** `offer`: a stored booking offer; the browser only ever gets its id (`/out/<id>` redirects). */
	export type PriceRow = { label: string; price: string | null; source: string; offer?: string };
</script>

<script lang="ts">
	import X from '@lucide/svelte/icons/x';
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import { m } from '#lib/paraglide/messages.js';
	import { dur } from '#lib/motion.ts';
	import IconButton from '../IconButton.svelte';

	// FRONTEND §7.5: every price row shows its source (§13). We never take payments.
	// Tideline: rows on one surface card with hairlines (inset list).
	// Hardening T1-10 (UX-11): a booking row opens a sheet first (provider, source, "never takes payment");
	// Continue opens `/out/<offer>` in a new tab with a short progress line (brief section 4.11).
	let { rows }: { rows: PriceRow[] } = $props();
	let dialog: HTMLDialogElement | undefined = $state();
	let current = $state<PriceRow | null>(null);
	let going = $state(false);
	function open(r: PriceRow) {
		current = r;
		going = false;
		dialog?.showModal();
	}
	function go() {
		going = true;
		setTimeout(() => dialog?.close(), dur(600));
	}
</script>

{#if !rows.length}
	<p class="type-body text-text-2">{m.price_none()}</p>
{:else}
	<div class="overflow-hidden rounded-lg bg-surface shadow-e1">
		<table class="w-full" data-testid="price-table">
			<tbody class="divide-y divide-border">
				{#each rows as r, i (i)}
					<tr>
						<td class="py-3 pr-3 pl-4">
							<p class="type-h3">{r.label}</p>
							<p class="type-small text-text-2" data-testid="price-source">
								{m.source_label({ source: r.source })}
							</p>
						</td>
						<td class="py-3 pr-4 text-right type-body-strong whitespace-nowrap">
							{#if r.offer}
								<button
									type="button"
									class="min-h-11 text-lagoon underline-offset-4 hover:underline"
									aria-haspopup="dialog"
									onclick={() => open(r)}>{r.price ?? m.price_see()}</button
								>
							{:else}
								{r.price ?? ''}
							{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}

<dialog
	bind:this={dialog}
	aria-labelledby="out-title"
	class="mx-auto mt-auto mb-0 w-full max-w-none overflow-hidden rounded-t-xl bg-surface p-5 pb-[calc(--spacing(5)+env(safe-area-inset-bottom))] text-text shadow-e3 backdrop:bg-(--scrim) lg:m-auto lg:max-w-105 lg:rounded-xl lg:pb-5"
	data-testid="out-sheet"
	onclose={() => (current = null)}
>
	{#if current?.offer}
		<span
			class={['out-line absolute inset-x-0 top-0 h-0.5 origin-left bg-kokum', going && 'go']}
			aria-hidden="true"
		></span>
		<div class="flex flex-col gap-3">
			<div class="flex items-center justify-between gap-2">
				<h2 id="out-title" class="type-h2">{current.label}</h2>
				<IconButton label={m.close()} onclick={() => dialog?.close()}
					><X size={20} aria-hidden="true" /></IconButton
				>
			</div>
			{#if current.price}<p class="type-body-strong">{current.price}</p>{/if}
			<p class="type-small text-text-2">{m.source_label({ source: current.source })}</p>
			<p class="type-body">{m.out_never_pay()}</p>
			<!-- eslint-disable svelte/no-navigation-without-resolve -- our own redirect endpoint -->
			<a
				href={`/out/${current.offer}`}
				target="_blank"
				rel="noopener noreferrer sponsored"
				class="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-kokum px-5 type-body-strong text-on-kokum no-underline hover:bg-kokum-hover"
				onclick={go}
				>{m.out_continue({ provider: current.label })}<ExternalLink
					size={18}
					aria-hidden="true"
				/></a
			>
			<!-- eslint-enable svelte/no-navigation-without-resolve -->
		</div>
	{/if}
</dialog>

<style>
	/* The outbound sheet rises over --dur-sheet; Continue draws a 600 ms line before it closes. */
	dialog[open] {
		animation: rise var(--dur-sheet) var(--ease);
	}
	@keyframes rise {
		from {
			transform: translateY(var(--move-lg));
			opacity: 0;
		}
	}
	.out-line {
		transform: scaleX(0);
	}
	.go {
		transform: scaleX(1);
		transition: transform 600ms var(--ease);
	}
</style>
