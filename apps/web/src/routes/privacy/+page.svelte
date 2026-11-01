<script lang="ts">
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import Send from '@lucide/svelte/icons/send';
	import X from '@lucide/svelte/icons/x';
	import { m } from '#lib/paraglide/messages.js';
	import Page from '#lib/components/Page.svelte';

	// PLAN P10 task 5 / DECISIONS P10-3 (+ P8-4 AI section): full policy DRAFT until legal approval.
	// Tideline (T-39): Report 2 draws no privacy screen, so it reuses the reading column (dish page) and the
	// do's/don'ts cards (place page) for what Crabby sends and never sends.
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
	<article class="mx-auto flex max-w-170 flex-col gap-8">
		<p class="flex gap-2.5 rounded-lg bg-caution-50 p-4 type-small text-text">
			<TriangleAlert size={18} class="mt-0.5 shrink-0" aria-hidden="true" />{m.privacy_draft()}
		</p>
		{#each sections as [title, body] (title)}
			<section class="flex flex-col gap-2">
				<h2 class="type-h2">{title}</h2>
				{#if lines(body).length > 1}
					<ul class="flex list-disc flex-col gap-1.5 pl-6 type-body marker:text-text-2">
						{#each lines(body) as line (line)}<li>{line}</li>{/each}
					</ul>
				{:else}
					<p class="type-body">{body}</p>
				{/if}
			</section>
		{/each}

		<section class="flex flex-col gap-4">
			<h2 class="type-h2">{m.privacy_ai_title()}</h2>
			<p class="type-body">{m.privacy_ai_intro()}</p>
			<div class="grid gap-3 sm:grid-cols-2">
				<div class="flex flex-col gap-3 rounded-lg bg-surface p-4 shadow-e1">
					<h3 class="type-h3">{m.privacy_ai_sent()}</h3>
					<ul class="flex flex-col gap-2 type-body">
						{#each sent as s (s)}<li class="flex gap-2.5">
								<Send size={18} class="mt-1 shrink-0 text-lagoon" aria-hidden="true" />{s}
							</li>{/each}
					</ul>
				</div>
				<div class="flex flex-col gap-3 rounded-lg bg-danger-50 p-4">
					<h3 class="type-h3 text-text">{m.privacy_ai_never()}</h3>
					<ul class="flex flex-col gap-2 type-body text-text">
						{#each never as s (s)}<li class="flex gap-2.5">
								<X size={18} class="mt-1 shrink-0" aria-hidden="true" />{s}
							</li>{/each}
					</ul>
				</div>
			</div>
			<h3 class="type-h3">{m.privacy_ai_staff_title()}</h3>
			<p class="type-body">{m.privacy_ai_staff()}</p>
			<h3 class="type-h3">{m.privacy_ai_limits_title()}</h3>
			<p class="type-body">{m.privacy_ai_limits()}</p>
		</section>
	</article>
</Page>
