<script lang="ts">
	import SearchIcon from '@lucide/svelte/icons/search';
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';

	// "Search places, stays, food" (FRONTEND §7.1): our published listings via /api/map/search. Tideline search
	// field (Report 2 §8): sunken pill with a leading icon; focus = ink border + surface fill. Used on Discover
	// (id="search", the phone top bar's search button links there) and in the laptop top bar.
	let { class: cls = '', id }: { class?: string; id?: string } = $props();

	let q = $state('');
	let results = $state<{ kind: string; slug: string; name: string }[]>([]);
	let timer: ReturnType<typeof setTimeout>;
	function onSearch() {
		clearTimeout(timer);
		if (q.trim().length < 2) return void (results = []);
		timer = setTimeout(async () => {
			const r = await fetch(`/api/map/search?q=${encodeURIComponent(q.trim())}`);
			results = r.ok ? await r.json() : [];
		}, 300);
	}
	const hrefFor = (kind: string, slug: string) =>
		kind === 'place'
			? resolve('/place/[slug]', { slug })
			: kind === 'stay'
				? resolve('/stays/[slug]', { slug })
				: resolve('/food/[slug]', { slug });
</script>

<div class={['relative', cls]}>
	<label
		class="flex h-12 items-center gap-2 rounded-full border-[1.5px] border-transparent bg-surface-2 px-4 transition-colors duration-200 focus-within:border-text focus-within:bg-surface"
	>
		<SearchIcon size={20} aria-hidden="true" class="text-text-2" />
		<input
			{id}
			aria-label={m.discover_search()}
			bind:value={q}
			oninput={onSearch}
			type="search"
			placeholder={m.discover_search()}
			class="h-full min-w-0 flex-1 bg-transparent type-body text-text placeholder:text-muted"
		/>
	</label>
	{#if results.length}
		<ul class="absolute inset-x-0 z-panel mt-2 rounded-lg bg-surface py-1 shadow-e3">
			{#each results as r, i (i)}
				<li>
					<a
						href={hrefFor(r.kind, r.slug)}
						class="row-link block px-4 py-3 type-body text-text no-underline">{r.name}</a
					>
				</li>
			{/each}
		</ul>
	{/if}
</div>
