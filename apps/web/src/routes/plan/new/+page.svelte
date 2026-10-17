<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import Page from '#lib/components/Page.svelte';
	import EmptyState from '#lib/components/EmptyState.svelte';
</script>

<!-- Planner is built in P7. -->
<Page title={m.nav_plan()}>
	<EmptyState title={m.soon_title()} body={m.soon_plan()} />
</Page>
