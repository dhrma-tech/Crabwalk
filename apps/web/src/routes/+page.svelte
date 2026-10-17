<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import Page from '#lib/components/Page.svelte';
	import EmptyState from '#lib/components/EmptyState.svelte';
</script>

<!-- Discover is built in P4; honest empty state until then. -->
<Page title={m.app_name()}>
	<EmptyState title={m.soon_title()} body={m.soon_discover()} />
</Page>
