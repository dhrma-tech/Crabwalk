<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import Page from '#lib/components/Page.svelte';
	import EmptyState from '#lib/components/EmptyState.svelte';
</script>

<!-- Crabby chat is built in P8. -->
<Page title={m.nav_crabby()}>
	<EmptyState title={m.soon_title()} body={m.soon_crabby()} />
</Page>
