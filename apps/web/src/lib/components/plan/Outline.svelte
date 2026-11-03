<script lang="ts" module>
	export type OutlineItem = { id: string; label: string; section: string; sub?: boolean };
</script>

<script lang="ts">
	// Plan workspace outline (P11 §2): a sticky list of sections (and days) on laptops, a chip scroll row at the
	// top of the sheet on phones. Picking an entry unfolds its section and scrolls to it.

	let {
		items,
		label,
		variant,
		onpick
	}: {
		items: OutlineItem[];
		label: string;
		variant: 'rail' | 'chips';
		onpick: (item: OutlineItem) => void;
	} = $props();
	let current = $state<string | null>(null);

	function pick(e: MouseEvent, item: OutlineItem) {
		e.preventDefault();
		current = item.id;
		onpick(item);
	}
</script>

<nav aria-label={label}>
	{#if variant === 'rail'}
		<ul class="flex flex-col gap-0.5">
			{#each items as item (item.id)}
				<li>
					<a
						href="#{item.id}"
						aria-current={current === item.id ? 'location' : undefined}
						onclick={(e) => pick(e, item)}
						class={[
							'row-link flex min-h-10 items-center rounded-md px-3 text-text no-underline aria-[current]:bg-kokum-50 aria-[current]:text-kokum-ink',
							item.sub ? 'pl-6 type-small' : 'type-label'
						]}>{item.label}</a
					>
				</li>
			{/each}
		</ul>
	{:else}
		<ul class="scroll-row -mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
			{#each items.filter((i) => !i.sub) as item (item.id)}
				<li class="shrink-0">
					<a
						href="#{item.id}"
						aria-current={current === item.id ? 'location' : undefined}
						onclick={(e) => pick(e, item)}
						class="inline-flex min-h-9 items-center rounded-full bg-surface-2 px-4 type-label text-text no-underline aria-[current]:bg-text aria-[current]:text-bg"
						>{item.label}</a
					>
				</li>
			{/each}
		</ul>
	{/if}
</nav>
