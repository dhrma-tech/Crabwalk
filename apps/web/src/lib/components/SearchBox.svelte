<script lang="ts">
	import { resolve } from '$app/paths';
	import { m } from '#lib/paraglide/messages.js';

	// "Search places, stays, food" (FRONTEND §7.1): our published listings via /api/map/search.
	// Underline field (Suna); used on Discover and in the laptop top bar.
	let { class: cls = '' }: { class?: string } = $props();

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
	<div class="flex h-11 items-center border-b border-text">
		<input
			aria-label={m.discover_search()}
			bind:value={q}
			oninput={onSearch}
			type="search"
			placeholder={m.discover_search()}
			class="h-full min-w-0 flex-1 bg-transparent type-body text-text placeholder:text-text-2"
		/>
	</div>
	{#if results.length}
		<ul class="absolute inset-x-0 z-30 mt-1 border border-text bg-bg">
			{#each results as r, i (i)}
				<li class="border-b border-border last:border-0">
					<a href={hrefFor(r.kind, r.slug)} class="block px-4 py-3 type-body text-text no-underline"
						>{r.name}</a
					>
				</li>
			{/each}
		</ul>
	{/if}
</div>
