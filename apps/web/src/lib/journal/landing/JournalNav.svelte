<script lang="ts">
	import { page } from '$app/state';
	import { NAV } from '../content/landing.ts';
	import { tr, locale } from '../i18n.ts';
	import Crabby from '#lib/components/Crabby.svelte';

	// Reference nav: logo, five links, EN/हि/म, Sign in. The language switch is the app's own form POST to /prefs
	// (works without JS). Phones: links fold into a sheet.
	let { tone = 'light' }: { tone?: 'light' | 'dark' } = $props();
	const LANGS = [
		{ locale: 'en', short: 'EN', name: 'English' },
		{ locale: 'hi', short: 'हि', name: 'हिन्दी' },
		{ locale: 'mr', short: 'म', name: 'मराठी' }
	] as const;
	const current = locale();
	let open = $state(false);
</script>

<header class={['nav', tone]}>
	<a href="/" class="brand" aria-label={tr(NAV.home)}>
		<Crabby size={40} state="idle" follow={false} />
		<span class="word">Crabwalk</span>
	</a>

	<nav aria-label={tr(NAV.main)} class={['links', open && 'open']} id="journal-menu">
		{#each NAV.links as l (l.href)}
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -- static app paths -->
			<a href={l.href} onclick={() => (open = false)}>{tr(l.label)}</a>
		{/each}
	</nav>

	<div class="end">
		<form method="POST" action="/prefs" aria-label={tr(NAV.language)}>
			<input type="hidden" name="return" value={page.url.pathname + page.url.search} />
			<div class="lang" role="group" aria-label={tr(NAV.language)}>
				{#each LANGS as o (o.locale)}
					<button
						name="locale"
						value={o.locale}
						lang={o.locale}
						aria-label={o.name}
						aria-pressed={o.locale === current}
						class={[o.locale !== 'en' && 'j-deva']}>{o.short}</button
					>
				{/each}
			</div>
		</form>
		<a href="/onboarding" class="j-btn signin">{tr(NAV.signIn)}</a>
		<button
			class="burger"
			aria-expanded={open}
			aria-controls="journal-menu"
			aria-label={open ? tr(NAV.close) : tr(NAV.menu)}
			onclick={() => (open = !open)}
		>
			<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" class="j-ink" stroke-width="1.8">
				{#if open}<path d="M6 6l12 12M18 6L6 18" />{:else}<path d="M4 7h16M4 12h11M4 17h16" />{/if}
			</svg>
		</button>
	</div>
</header>

<style>
	.nav {
		position: relative;
		z-index: 20;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		width: 100%;
		max-width: var(--j-max);
		margin-inline: auto;
		padding: 18px var(--j-gutter) 0;
	}
	.brand {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		text-decoration: none;
	}
	.word {
		font-family: var(--j-display);
		font-size: 26px;
		letter-spacing: -0.01em;
	}
	.links {
		display: flex;
		gap: 28px;
		font-size: 12px;
		font-weight: 600;
		letter-spacing: 0.18em;
		text-transform: uppercase;
	}
	.links a {
		position: relative;
		padding-block: 10px;
		text-decoration: none;
	}
	/* Hover: an ink underline that draws from the left, slightly wobbly like a pen stroke. */
	.links a::after {
		content: '';
		position: absolute;
		left: 0;
		right: 0;
		bottom: 4px;
		height: 2px;
		background: currentColor;
		border-radius: 2px;
		transform: scaleX(0);
		transform-origin: left;
		transition: transform 0.35s var(--j-ease-out);
	}
	.links a:hover::after,
	.links a:focus-visible::after {
		transform: scaleX(1);
	}
	.end {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.lang {
		display: flex;
		padding: 3px;
		border: 1.5px solid currentColor;
		border-radius: 999px;
	}
	.lang button {
		min-width: 40px;
		min-height: 38px;
		padding: 0 10px;
		border: 0;
		border-radius: 999px;
		background: transparent;
		font-size: 13px;
		font-weight: 600;
	}
	.lang button.j-deva {
		font-size: 16px;
		font-weight: 400;
	}
	.lang button[aria-pressed='true'] {
		background: var(--navy);
		color: var(--white);
	}
	.signin {
		min-height: 44px;
		padding: 0 20px;
		font-size: 14px;
	}
	.burger {
		display: none;
		width: 44px;
		height: 44px;
		align-items: center;
		justify-content: center;
		border: 1.5px solid currentColor;
		border-radius: 999px;
		background: transparent;
	}
	.dark {
		color: var(--beige);
	}
	.dark .lang button[aria-pressed='true'] {
		background: var(--beige);
		color: var(--navy);
	}

	@media (max-width: 960px) {
		.burger {
			display: inline-flex;
		}
		.links {
			position: absolute;
			top: calc(100% + 8px);
			left: var(--j-gutter);
			right: var(--j-gutter);
			flex-direction: column;
			gap: 0;
			padding: 8px 20px;
			background: var(--beige);
			color: var(--navy);
			border: 1.5px solid var(--navy);
			border-radius: 20px;
			box-shadow: 4px 4px 0 var(--navy);
			visibility: hidden;
			opacity: 0;
			transform: translateY(-6px);
			transition:
				opacity 0.2s,
				transform 0.25s var(--j-ease-out),
				visibility 0s 0.25s;
		}
		.links.open {
			visibility: visible;
			opacity: 1;
			transform: none;
			transition:
				opacity 0.2s,
				transform 0.25s var(--j-ease-out);
		}
		.links a {
			padding-block: 14px;
			border-bottom: 1px dashed var(--line);
		}
		.links a:last-child {
			border-bottom: 0;
		}
	}
	@media (max-width: 560px) {
		.signin {
			display: none;
		}
		.word {
			font-size: 22px;
		}
		.lang button {
			min-width: 34px;
			padding: 0 6px;
		}
		.nav {
			gap: 8px;
		}
	}
</style>
