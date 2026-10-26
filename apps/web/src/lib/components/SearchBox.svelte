<script lang="ts">
	import SearchIcon from '@lucide/svelte/icons/search';
	import History from '@lucide/svelte/icons/history';
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';
	import { msg } from '#lib/msg.ts';

	// "Search places, stays, food" (FRONTEND §7.1): our published listings and dishes via /api/map/search,
	// grouped by kind with counts, plus recent searches kept on this device (Report 1 §4.2, T-24). Tideline
	// search field (Report 2 §8): sunken pill with a leading icon; focus = ink border + surface fill. Used on
	// Discover (id="search", the phone top bar's search button links there) and in the laptop top bar.
	let { class: cls = '', id }: { class?: string; id?: string } = $props();

	type Hit = { kind: string; slug: string; name: string };
	const KINDS = ['place', 'stay', 'eatery', 'dish'] as const;
	const RECENT_KEY = 'crabwalk:recent-searches';

	let q = $state('');
	let results = $state<Hit[]>([]);
	let open = $state(false);
	let recent = $state<string[]>([]);
	let timer: ReturnType<typeof setTimeout>;

	const groups = $derived(
		KINDS.map((kind) => ({ kind, hits: results.filter((r) => r.kind === kind) })).filter(
			(g) => g.hits.length
		)
	);

	function onSearch() {
		clearTimeout(timer);
		open = true;
		if (q.trim().length < 2) return void (results = []);
		timer = setTimeout(async () => {
			const r = await fetch(`/api/map/search?q=${encodeURIComponent(q.trim())}`).catch(() => null);
			results = r?.ok ? await r.json() : [];
		}, 300);
	}
	function onFocus() {
		try {
			recent = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
		} catch {
			recent = [];
		}
		open = true;
	}
	function remember() {
		const term = q.trim();
		recent = [term, ...recent.filter((t) => t !== term)].slice(0, 5);
		try {
			localStorage.setItem(RECENT_KEY, JSON.stringify(recent));
		} catch {
			// Storage blocked: recents just don't persist.
		}
	}
	function useRecent(term: string) {
		q = term;
		onSearch();
	}
	const hrefFor = (kind: string, slug: string) =>
		kind === 'place'
			? resolve('/place/[slug]', { slug })
			: kind === 'stay'
				? resolve('/stays/[slug]', { slug })
				: kind === 'eatery'
					? resolve('/food/[slug]', { slug })
					: resolve('/taste-konkan/[dish]', { dish: slug });
</script>

<div
	class={['relative', cls]}
	onfocusout={(e) => {
		if (!e.currentTarget.contains(e.relatedTarget as Node | null)) open = false;
	}}
>
	<label
		class="flex h-12 items-center gap-2 rounded-full border-[1.5px] border-transparent bg-surface-2 px-4 transition-colors duration-200 focus-within:border-text focus-within:bg-surface"
	>
		<SearchIcon size={20} aria-hidden="true" class="text-text-2" />
		<input
			{id}
			aria-label={m.discover_search()}
			bind:value={q}
			oninput={onSearch}
			onfocus={onFocus}
			onkeydown={(e) => {
				if (e.key === 'Escape') open = false;
			}}
			type="search"
			autocomplete="off"
			placeholder={m.discover_search()}
			class="h-full min-w-0 flex-1 bg-transparent type-body text-text placeholder:text-muted"
		/>
	</label>
	{#if open && (groups.length || (q.trim().length < 2 && recent.length))}
		<div
			class="absolute inset-x-0 z-panel mt-2 max-h-[70vh] overflow-y-auto rounded-lg bg-surface py-2 shadow-e3"
			data-testid="search-results"
		>
			{#if groups.length}
				{#each groups as g (g.kind)}
					<section aria-label={msg(`search_kind_${g.kind}`)}>
						<p class="flex justify-between px-4 pt-2 pb-1 type-label text-text-2">
							<span>{msg(`search_kind_${g.kind}`)}</span><span>{g.hits.length}</span>
						</p>
						<ul>
							{#each g.hits as r, i (i)}
								<li>
									<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- hrefFor() resolves -->
									<a
										href={hrefFor(r.kind, r.slug)}
										onclick={remember}
										class="row-link flex min-h-11 items-center px-4 py-2.5 type-body text-text no-underline"
										>{r.name}</a
									>
								</li>
							{/each}
						</ul>
					</section>
				{/each}
			{:else}
				<section aria-label={m.search_recent()}>
					<p class="px-4 pt-2 pb-1 type-label text-text-2">{m.search_recent()}</p>
					<ul>
						{#each recent as term (term)}
							<li>
								<button
									type="button"
									onclick={() => useRecent(term)}
									class="row-link flex min-h-11 w-full items-center gap-3 px-4 py-2.5 text-left type-body text-text"
								>
									<History size={20} aria-hidden="true" class="text-text-2" />{term}
								</button>
							</li>
						{/each}
					</ul>
				</section>
			{/if}
		</div>
	{/if}
</div>
