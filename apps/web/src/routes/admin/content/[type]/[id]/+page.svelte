<script lang="ts">
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import Editor from '#lib/components/admin/Editor.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<a
	href="{resolve('/admin/content')}{page.url.search}"
	class="mb-3 flex min-h-11 items-center gap-1 type-label lg:hidden"
	><ChevronLeft size={18} aria-hidden="true" />All entries</a
>
{#key data.entry.id}
	<Editor
		entry={data.entry}
		reviews={data.reviews}
		labels={data.labels}
		broken={data.broken}
		talukas={data.talukas}
		tides={data.tides}
	/>
{/key}
