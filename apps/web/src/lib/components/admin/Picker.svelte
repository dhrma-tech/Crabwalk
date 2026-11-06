<script lang="ts">
	// Searchable dish / eatery picker for dish ↔ eatery links. Shows a warning when the linked entry is gone or
	// archived (broken link).
	let {
		kind,
		value = $bindable(),
		labels = {},
		broken = null
	}: {
		kind: 'dish' | 'eatery';
		value: unknown;
		labels?: Record<string, string>;
		broken?: 'missing' | 'archived' | null;
	} = $props();

	type Hit = { id: string; name: string; code: string | null; archived: boolean };
	let q = $state('');
	let hits = $state<Hit[]>([]);
	let open = $state(false);
	let picked = $state<Record<string, string>>({});
	let timer: ReturnType<typeof setTimeout> | undefined;
	const label = $derived(
		typeof value === 'string' ? (picked[value] ?? labels[value] ?? 'Unknown entry') : null
	);

	function find() {
		clearTimeout(timer);
		timer = setTimeout(async () => {
			const r = await fetch(
				`/api/admin/content/search?kind=${kind}&q=${encodeURIComponent(q)}`
			).catch(() => null);
			hits = r?.ok ? await r.json() : [];
			open = true;
		}, 200);
	}
	function choose(h: Hit) {
		picked[h.id] = h.code ? `${h.name} (${h.code})` : h.name;
		value = h.id;
		open = false;
		q = '';
	}
</script>

<div class="relative flex flex-col gap-1">
	{#if label}
		<p class="type-body-strong text-text">
			{label}
			{#if broken}<span class="ml-1 type-small text-danger" role="alert"
					>⚠ {broken === 'missing'
						? 'broken link: entry no longer exists'
						: 'linked entry is archived'}</span
				>{/if}
		</p>
	{/if}
	<input
		type="search"
		class="min-h-11 w-full rounded-md border border-border-strong bg-surface px-3 type-body"
		placeholder={`Search ${kind === 'dish' ? 'dishes' : 'eateries'} by name or ID`}
		aria-label={`Pick ${kind}`}
		bind:value={q}
		oninput={find}
		onfocus={find}
	/>
	{#if open && hits.length}
		<ul
			class="absolute top-full z-overlay mt-1 max-h-64 w-full overflow-auto rounded-md bg-surface shadow-e3"
			role="listbox"
		>
			{#each hits as h (h.id)}
				<li role="option" aria-selected={value === h.id}>
					<button
						type="button"
						class="flex min-h-11 w-full items-center gap-2 px-3 text-left type-body hover:bg-surface-2"
						onclick={() => choose(h)}
						>{h.name}{#if h.code}<span class="type-small text-text-2">{h.code}</span
							>{/if}{#if h.archived}<span class="type-small text-caution">archived</span
							>{/if}</button
					>
				</li>
			{/each}
		</ul>
	{/if}
</div>
