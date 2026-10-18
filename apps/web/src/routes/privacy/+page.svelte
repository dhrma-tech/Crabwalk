<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import Page from '#lib/components/Page.svelte';

	// PLAN P8 task 12 / DECISIONS P8-4: AI-processing disclosure only. DRAFT for legal review;
	// the rest of the privacy policy is written by the team.
	const sent = [m.privacy_ai_sent_1(), m.privacy_ai_sent_2(), m.privacy_ai_sent_3()];
	const never = [
		m.privacy_ai_never_1(),
		m.privacy_ai_never_2(),
		m.privacy_ai_never_3(),
		m.privacy_ai_never_4()
	];
</script>

<Page title={m.privacy_title()}>
	<article class="mx-auto flex max-w-[680px] flex-col gap-4">
		<p class="rounded-card bg-sand-100 p-3 type-small dark:bg-raised">{m.privacy_draft()}</p>
		<h2 class="type-h2">{m.privacy_ai_title()}</h2>
		<p class="type-body">{m.privacy_ai_intro()}</p>
		<h3 class="type-h3">{m.privacy_ai_sent()}</h3>
		<ul class="list-disc pl-6 type-body">
			{#each sent as s (s)}<li>{s}</li>{/each}
		</ul>
		<h3 class="type-h3">{m.privacy_ai_never()}</h3>
		<ul class="list-disc pl-6 type-body">
			{#each never as s (s)}<li>{s}</li>{/each}
		</ul>
		<h3 class="type-h3">{m.privacy_ai_staff_title()}</h3>
		<p class="type-body">{m.privacy_ai_staff()}</p>
		<h3 class="type-h3">{m.privacy_ai_limits_title()}</h3>
		<p class="type-body">{m.privacy_ai_limits()}</p>
	</article>
</Page>
