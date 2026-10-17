<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import Page from '#lib/components/Page.svelte';
	import EmptyState from '#lib/components/EmptyState.svelte';
</script>

<!-- Map is built in P3. -->
<Page title={m.nav_map()}>
	<EmptyState title={m.soon_title()} body={m.soon_map()} />
</Page>
