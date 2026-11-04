<script lang="ts">
	import { resolve } from '$app/paths';
	import { submitting } from '#lib/forms.ts';
	import { m } from '#lib/paraglide/messages.js';
	import { formatDate } from '#lib/format.ts';
	import Page from '#lib/components/Page.svelte';
	import Button from '#lib/components/Button.svelte';
	import type { PageProps } from './$types';

	// Questions for our team (P12 step E, 10.1): answer, mark time-sensitive answers with a "valid until" date,
	// close what can't be answered; expire answers that went out of date so Crabby stops reusing them.
	let { data }: PageProps = $props();
	const today = new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
	const LANG = { en: 'EN', hi: 'हि', mr: 'म' } as const;
</script>

<Page title={m.team_title()} back tool>
	<div class="mx-auto flex max-w-170 flex-col gap-6">
		<section class="flex flex-col gap-3">
			{#each data.open as q (q.id)}
				<article
					class="flex flex-col gap-3 rounded-lg bg-surface p-4 shadow-e1"
					data-testid="team-open"
				>
					<p class="type-body-strong">“{q.question}”</p>
					<p class="type-small text-text-2">
						{LANG[q.lang]} · {m.team_asked({ date: formatDate(q.created_at) })}
						{#if q.place}
							· <a href={resolve('/place/[slug]', { slug: q.place.slug })}>{q.place.name}</a>
						{/if}
					</p>
					<form method="POST" action="?/answer" use:submitting class="flex flex-col gap-3">
						<input type="hidden" name="id" value={q.id} />
						<label class="flex flex-col gap-1.5 type-small text-text-2"
							>{m.team_answer_label()}
							<textarea
								name="answer"
								required
								minlength="2"
								maxlength="2000"
								rows="3"
								class="field p-3 type-body text-text"></textarea>
						</label>
						<label class="flex flex-col gap-1.5 type-small text-text-2"
							>{m.team_valid_until()}
							<input
								name="until"
								type="date"
								min={today}
								class="field h-12 px-3 type-body text-text"
							/>
							<span>{m.team_time_sensitive()}</span>
						</label>
						<div class="flex flex-wrap gap-2">
							<Button type="submit">{m.team_send()}</Button>
						</div>
					</form>
					<form method="POST" action="?/close" use:submitting>
						<input type="hidden" name="id" value={q.id} />
						<Button type="submit" variant="ghost">{m.team_close()}</Button>
					</form>
				</article>
			{:else}
				<p class="type-body text-text-2">{m.team_open_empty()}</p>
			{/each}
		</section>

		{#if data.answered.length}
			<section class="flex flex-col gap-3">
				<h2 class="type-h2">{m.team_answered_title()}</h2>
				{#each data.answered as q (q.id)}
					{@const live = !q.expires_at || Date.parse(q.expires_at) > Date.now()}
					<article
						class="flex flex-col gap-2 rounded-lg bg-surface p-4 shadow-e1"
						data-testid="team-answered"
					>
						<p class="type-small text-text-2">“{q.question}”</p>
						<p class="type-body">{q.answer}</p>
						<p class="type-small text-text-2">
							{q.answered_at ? formatDate(q.answered_at) : ''} ·
							{q.expires_at
								? m.team_expires({ date: formatDate(q.expires_at) })
								: m.team_no_expiry()}
						</p>
						{#if live}
							<form method="POST" action="?/expire" use:submitting>
								<input type="hidden" name="id" value={q.id} />
								<Button type="submit" variant="ghost">{m.team_expire()}</Button>
							</form>
						{/if}
					</article>
				{/each}
			</section>
		{/if}
	</div>
</Page>
