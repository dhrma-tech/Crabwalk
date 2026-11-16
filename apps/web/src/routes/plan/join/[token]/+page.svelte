<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import Page from '#lib/components/Page.svelte';
	import Button from '#lib/components/Button.svelte';
	import type { PageProps } from './$types';

	// SEC-20: joining is a deliberate tap (POST), never a side effect of opening the link.
	let { data }: PageProps = $props();
</script>

<Page title={m.plan_join_title()}>
	<form method="POST" action="?/join" class="mx-auto flex max-w-120 flex-col gap-4 py-8">
		<p class="type-h2">{data.title}</p>
		<p class="type-body text-text-2">
			{data.role === 'editor' ? m.plan_role_editor() : m.plan_role_viewer()}
		</p>
		<div class="[&>*]:w-full"><Button type="submit">{m.plan_join_button()}</Button></div>
	</form>
</Page>
