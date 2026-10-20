<script lang="ts">
	import { m } from '#lib/paraglide/messages.js';
	import Page from '#lib/components/Page.svelte';

	// PLAN P10 task 5 / DECISIONS P10-3 (+ P8-4 AI section): full policy DRAFT until legal approval.
	const sections = [
		[m.privacy_s1_title(), m.privacy_s1_body()],
		[m.privacy_s2_title(), m.privacy_s2_body()],
		[m.privacy_s3_title(), m.privacy_s3_body()],
		[m.privacy_s4_title(), m.privacy_s4_body()],
		[m.privacy_s5_title(), m.privacy_s5_body()],
		[m.privacy_s6_title(), m.privacy_s6_body()],
		[m.privacy_s7_title(), m.privacy_s7_body()],
		[m.privacy_s8_title(), m.privacy_s8_body()]
	];
	const lines = (b: string) => b.split(String.fromCharCode(10));
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
		<p class="bg-yama p-3 type-small">{m.privacy_draft()}</p>
		{#each sections as [title, body] (title)}
			<section class="flex flex-col gap-2">
				<h2 class="type-h2">{title}</h2>
				{#if lines(body).length > 1}
					<ul class="list-disc pl-6 type-body">
						{#each lines(body) as line (line)}<li>{line}</li>{/each}
					</ul>
				{:else}
					<p class="type-body">{body}</p>
				{/if}
			</section>
		{/each}
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
