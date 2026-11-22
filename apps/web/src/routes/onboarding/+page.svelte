<script lang="ts">
	import '#lib/journal/journal.css';
	import { onMount, tick } from 'svelte';
	import { fly } from 'svelte/transition';
	import { deserialize } from '$app/forms';
	import { resolve } from '$app/paths';
	import { dur } from '#lib/motion.ts';
	import { captchaToken } from '#lib/guest.client.ts';
	import Crabby, { type CrabbyState } from '#lib/components/Crabby.svelte';
	import Scene, { type SceneKey } from '#lib/journal/onboarding/Scene.svelte';
	import Postcard from '#lib/journal/onboarding/Postcard.svelte';
	import OtpInput from '#lib/journal/onboarding/OtpInput.svelte';
	import InkIcon from '#lib/journal/landing/InkIcon.svelte';
	import { tr, locale, isDeva, whenDevaReady, type L, type Locale } from '#lib/journal/i18n.ts';
	import { OB, OB_STEPS, OB_KEY, type ObState } from '#lib/journal/content/onboarding.ts';
	import type { PageProps } from './$types';

	// Onboarding (brief §8, reference ob1–ob5 + the code step): one continuous coast scene on top (phones) or on the
	// left (laptops), Crabby walking with you and reacting to choices, a postcard that builds up and flips at the
	// end. Answers live in one state object saved to localStorage, so a refresh keeps progress. Language cards
	// re-render the whole flow in that script at once; the choice becomes the app language at the end.
	let { data }: PageProps = $props();

	const fresh = (): ObState => ({
		step: 'login',
		email: '',
		name: '',
		lang: locale(),
		city: '',
		group: '',
		care: [],
		modes: [],
		interests: [],
		pace: 'balanced',
		gems: false,
		food: '',
		budget: '',
		stay: ''
	});
	let s = $state<ObState>(fresh());
	let loaded = $state(false);
	let devaReady = $state(false);
	onMount(() => whenDevaReady(() => (devaReady = true)));
	let flipped = $state(false);
	let dir = $state(1);
	const t = (l: L) => tr(l, s.lang);
	const at = $derived(OB_STEPS.indexOf(s.step));
	const SCENE: Record<ObState['step'], SceneKey> = {
		login: 'dawn',
		code: 'dawn',
		about: 'lane',
		group: 'fort',
		interests: 'falls',
		food: 'market',
		done: 'golden'
	};
	const FORM_STEPS = ['about', 'group', 'interests', 'food'] as const;
	const formAt = $derived((FORM_STEPS as readonly string[]).indexOf(s.step));

	onMount(() => {
		try {
			const raw = localStorage.getItem(OB_KEY);
			if (raw) {
				const saved = JSON.parse(raw) as Partial<ObState>;
				if (saved && typeof saved === 'object' && OB_STEPS.includes(saved.step as ObState['step']))
					Object.assign(s, saved);
			}
		} catch {
			/* private mode or bad JSON: start fresh */
		}
		if (data.signedIn && (s.step === 'login' || s.step === 'code')) s.step = 'about';
		if (s.step === 'done') flipped = true;
		loaded = true;
	});
	$effect(() => {
		const json = JSON.stringify(s);
		if (!loaded) return;
		try {
			localStorage.setItem(OB_KEY, json);
		} catch {
			/* storage full or blocked: progress just isn't kept */
		}
	});

	let heading = $state<HTMLElement>();
	async function go(step: ObState['step']) {
		dir = OB_STEPS.indexOf(step) >= at ? 1 : -1;
		walk();
		s.step = step;
		await tick();
		heading?.focus();
	}
	const next = () => go(OB_STEPS[Math.min(OB_STEPS.length - 1, at + 1)]);
	const back = () => go(s.step === 'about' ? 'login' : OB_STEPS[Math.max(0, at - 1)]);

	// Crabby, the shared element: walks to a new spot each step and reacts to choices.
	let crab = $state<CrabbyState>('wave');
	let crabTimer: ReturnType<typeof setTimeout>;
	function act(st: CrabbyState, ms: number) {
		clearTimeout(crabTimer);
		crab = st;
		crabTimer = setTimeout(() => (crab = 'idle'), ms);
	}
	const walk = () => act('scuttle', 1100);
	const SPOT: Record<ObState['step'], number> = {
		login: 16,
		code: 30,
		about: 58,
		group: 24,
		interests: 62,
		food: 34,
		done: 50
	};
	const hold = $derived(
		s.step === 'group' && s.group === 'family'
			? 'baby'
			: s.step === 'interests' && s.gems
				? 'gem'
				: s.step === 'food' && s.food === 'veg'
					? 'leaf'
					: null
	);
	const SAYS: Partial<Record<ObState['step'], L>> = {
		about: OB.about.crabby,
		group: OB.group.crabby,
		interests: OB.interests.crabby,
		food: OB.food.crabby
	};

	// Sign-in through the /login actions (email code). Temp gate: those are closed, so say so.
	let busy = $state(false);
	let err = $state<L | null>(null);
	let code = $state('');
	let codeErr = $state(false);
	let wait = $state(0);
	let note = $state<L | null>(null);
	let timer: ReturnType<typeof setInterval>;
	async function post(action: 'sendCode' | 'verifyCode', fields: Record<string, string>) {
		const body = new FormData();
		for (const [k, v] of Object.entries(fields)) body.set(k, v);
		const res = await fetch(`/login?/${action}`, {
			method: 'POST',
			body,
			headers: { 'x-sveltekit-action': 'true', accept: 'application/json' }
		});
		return deserialize(await res.text());
	}
	async function sendCode(e?: SubmitEvent) {
		e?.preventDefault();
		err = null;
		if (data.gate) return (err = OB.login.gate);
		if (!/^\S+@\S+\.\S+$/.test(s.email.trim())) return (err = OB.login.errEmail);
		if (!navigator.onLine) return (err = OB.login.offline);
		busy = true;
		try {
			const captcha = (await captchaToken()) ?? 'none';
			const r = await post('sendCode', { email: s.email.trim(), next: '/onboarding', captcha });
			if (r.type === 'success') {
				startWait();
				if (s.step === 'code') note = OB.code.sent;
				else go('code');
			} else if (r.type === 'failure') {
				err =
					r.status === 429
						? OB.login.errRate
						: r.data?.error === 'email'
							? OB.login.errEmail
							: OB.login.errSend;
			} else err = OB.login.errSend;
		} catch {
			err = navigator.onLine ? OB.login.errSend : OB.login.offline;
		} finally {
			busy = false;
		}
	}
	function startWait() {
		wait = 30;
		clearInterval(timer);
		timer = setInterval(() => (wait = Math.max(0, wait - 1)) || clearInterval(timer), 1000);
	}
	async function verify(token = code) {
		if (token.length !== 6 || busy) return;
		busy = true;
		codeErr = false;
		try {
			const r = await post('verifyCode', { email: s.email.trim(), token, next: '/onboarding' });
			if (r.type === 'redirect' || r.type === 'success') {
				act('celebrate', 1600);
				go('about');
			} else codeErr = true;
		} catch {
			codeErr = true;
		} finally {
			busy = false;
		}
	}

	// Choices
	function toggle(list: 'care' | 'modes' | 'interests', key: string) {
		const has = s[list].includes(key);
		s[list] = has ? s[list].filter((k) => k !== key) : [...s[list], key];
		if (list === 'interests' && !has && s.interests.length === 3) act('celebrate', 1400);
	}
	function pickPace(p: ObState['pace']) {
		s.pace = p;
		act('scuttle', p === 'packed' ? 1600 : 900);
	}
	const need = $derived(Math.max(0, 3 - s.interests.length));

	// Finish: the postcard flips, then the language choice becomes the app language.
	async function finish() {
		await go('done');
		setTimeout(() => {
			flipped = true;
			act('celebrate', 2200);
		}, dur(500));
	}
	const fontFor = (l: Locale) => (l === 'en' ? undefined : 'j-deva');
</script>

<svelte:head>
	<title>{t(OB.title)} · Crabwalk</title>
	<meta name="robots" content="noindex" />
	<link
		rel="preload"
		href="/fonts/journal-display-latin.woff2"
		as="font"
		type="font/woff2"
		crossorigin="anonymous"
	/>
</svelte:head>

<div class={['journal', 'ob', `at-${s.step}`, devaReady && 'deva-ready']} lang={s.lang}>
	<!-- the scene: same coast, a new place per step -->
	<div class="stage">
		<Scene scene={SCENE[s.step]} />
		{#if s.step !== 'done'}
			<div class="crab" style:left="{SPOT[s.step]}%">
				{#if s.step === 'login'}
					<div class="bubble">
						<p class="j-deva" lang="mr">{OB.login.hello}</p>
						<p>{t(OB.login.im)}</p>
					</div>
				{:else if SAYS[s.step]}
					{#key s.step}
						<p
							class={[
								'bubble small',
								SPOT[s.step] > 50 && 'r',
								isDeva(t(SAYS[s.step]!)) && 'j-deva'
							]}
							aria-live="polite"
						>
							{t(SAYS[s.step]!)}
						</p>
					{/key}
				{/if}
				<Crabby
					size={150}
					state={crab}
					{hold}
					speed={s.pace === 'packed' ? 2.4 : s.pace === 'relaxed' ? 0.7 : 1}
				/>
			</div>
		{/if}
		{#if s.step !== 'login' && s.step !== 'code'}
			<div class={['postcard', s.step === 'done' && 'center']}>
				<Postcard {s} lang={s.lang} {flipped} />
			</div>
		{/if}
	</div>

	<!-- the form -->
	<main class="sheet" id="main">
		<div class="bar">
			{#if s.step !== 'login' && s.step !== 'done'}
				<button class="iconbtn" onclick={back} aria-label={t(OB.back)}>
					<svg
						width="18"
						height="18"
						viewBox="0 0 24 24"
						class="j-ink"
						stroke-width="1.8"
						aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg
					>
				</button>
			{:else}
				<a href={resolve('/')} class="brand" aria-label="Crabwalk"
					><Crabby size={30} follow={false} /><span>Crabwalk</span></a
				>
			{/if}
			{#if formAt >= 0}
				<div
					class="progress"
					role="progressbar"
					aria-valuemin="1"
					aria-valuemax="4"
					aria-valuenow={formAt + 1}
					aria-label={t(OB.stepOf).replace('{n}', String(formAt + 1))}
				>
					{#each FORM_STEPS as f, i (f)}
						<span class={['seg', i < formAt && 'full', i === formAt && 'now']}><i></i></span>
					{/each}
				</div>
				<button class="skip" onclick={next}>{t(OB.skip)}</button>
			{:else if s.step === 'login'}
				<div class="lang" role="group" aria-label={t(OB.language)}>
					{#each OB.langs as l (l.key)}
						<button
							aria-pressed={s.lang === l.key}
							lang={l.key}
							class={fontFor(l.key)}
							onclick={() => (s.lang = l.key)}
							>{l.key === 'en' ? 'EN' : l.key === 'hi' ? 'हि' : 'म'}</button
						>
					{/each}
				</div>
			{/if}
		</div>

		<div class="steps">
			{#key s.step}
				<section
					class="step"
					in:fly={{ x: 70 * dir, duration: dur(520), delay: dur(120), opacity: 0 }}
					out:fly={{ x: -70 * dir, duration: dur(320), opacity: 0 }}
				>
					{#if s.step === 'login'}
						<h1 bind:this={heading} tabindex="-1">{t(OB.login.title)}</h1>
						<p class="sub">{t(OB.login.sub)}</p>
						<form onsubmit={sendCode} class="stack" novalidate>
							<label for="ob-email" class="lbl">{t(OB.login.email)}</label>
							<input
								id="ob-email"
								class="field"
								type="email"
								autocomplete="email"
								inputmode="email"
								bind:value={s.email}
								aria-describedby="ob-email-hint ob-email-err"
								aria-invalid={!!err}
								placeholder="you@example.com"
							/>
							<p id="ob-email-hint" class="hint">{t(OB.login.emailHint)}</p>
							<button class="j-btn wide" disabled={busy}
								>{busy ? t(OB.login.sending) : t(OB.login.send)}</button
							>
							<p id="ob-email-err" class="err" role="alert">{err ? t(err) : ''}</p>
						</form>
						<p class="or" aria-hidden="true"><span></span>{t(OB.login.or)}<span></span></p>
						<form
							method="POST"
							action="/login?/google"
							onsubmit={(e) => data.gate && (e.preventDefault(), (err = OB.login.gate))}
						>
							<input type="hidden" name="next" value="/onboarding" />
							<button class="google">
								<svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true"
									><path
										fill="#EA4335"
										d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
									/><path
										fill="#4285F4"
										d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
									/><path
										fill="#FBBC05"
										d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
									/><path
										fill="#34A853"
										d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
									/></svg
								>
								{t(OB.login.google)}
							</button>
						</form>
						{#if data.gate}<p class="gate" role="note">{t(OB.login.gate)}</p>{/if}
						<button class="guest" onclick={() => go('about')}
							>{t(OB.login.guest)} <span aria-hidden="true">→</span></button
						>
						<p class="legal">
							{t(OB.login.agree)} <a href={resolve('/terms')}>{t(OB.login.terms)}</a>
							{t(OB.login.and)} <a href={resolve('/privacy')}>{t(OB.login.privacy)}</a>{t(
								OB.login.agreeEnd
							)}
						</p>
					{:else if s.step === 'code'}
						<h1 bind:this={heading} tabindex="-1">{t(OB.code.title)}</h1>
						<p class="sub">{t(OB.code.sub).replace('{email}', s.email)}</p>
						<form class="stack" onsubmit={(e) => (e.preventDefault(), verify())}>
							<OtpInput
								bind:value={code}
								label={t(OB.code.label)}
								digitLabel={(n) => t(OB.code.digit).replace('{n}', String(n))}
								invalid={codeErr}
								describedby="ob-code-err"
								oncomplete={(c) => verify(c)}
							/>
							<p id="ob-code-err" class="err" role="alert">{codeErr ? t(OB.code.error) : ''}</p>
							<button class="j-btn wide" disabled={busy || code.length !== 6}
								>{t(OB.code.verify)}</button
							>
						</form>
						<div class="row">
							{#if wait > 0}
								<p class="hint" aria-live="polite">
									{t(OB.code.resendIn).replace('{s}', String(wait))}
								</p>
							{:else}
								<button class="link" onclick={() => sendCode()} disabled={busy}
									>{t(OB.code.resend)}</button
								>
							{/if}
							<button class="link" onclick={() => go('login')}>{t(OB.code.change)}</button>
						</div>
						{#if note}<p class="hint" role="status">{t(note)}</p>{/if}
					{:else if s.step === 'about'}
						<h1 bind:this={heading} tabindex="-1">{t(OB.about.title)}</h1>
						<label for="ob-name" class="lbl">{t(OB.about.name)}</label>
						<input
							id="ob-name"
							class="field"
							type="text"
							autocomplete="given-name"
							bind:value={s.name}
							placeholder={t(OB.about.namePh)}
							maxlength="40"
						/>
						<fieldset class="group">
							<legend class="lbl">{t(OB.about.lang)}</legend>
							{#each OB.langs as l (l.key)}
								<label class={['card', s.lang === l.key && 'on']} lang={l.key}>
									<input type="radio" name="ob-lang" value={l.key} bind:group={s.lang} />
									<span class="ctext">
										<span class={['cname', fontFor(l.key)]}>{l.name}</span>
										<span class={['csub', fontFor(l.key)]}>{l.sample}</span>
									</span>
									<span class="radio" aria-hidden="true"></span>
								</label>
							{/each}
						</fieldset>
						<label for="ob-city" class="lbl"
							>{t(OB.about.city)} <span class="opt">{t(OB.about.optional)}</span></label
						>
						<div class="withicon">
							<InkIcon name="pin" size={20} stroke={3} />
							<input
								id="ob-city"
								class="field"
								type="text"
								autocomplete="address-level2"
								bind:value={s.city}
								placeholder={t(OB.about.cityPh)}
								maxlength="40"
							/>
						</div>
					{:else if s.step === 'group'}
						<h1 bind:this={heading} tabindex="-1">{t(OB.group.title)}</h1>
						<fieldset class="group grid2">
							<legend class="sr-only">{t(OB.group.label)}</legend>
							{#each OB.groups as g (g.key)}
								<label class={['card tall', s.group === g.key && 'on dark']}>
									<input
										type="radio"
										name="ob-group"
										value={g.key}
										bind:group={s.group}
										onchange={() => act('wave', 1200)}
									/>
									<InkIcon name={g.icon} size={34} stroke={2.4} />
									<span class="cname">{t(g.label)}</span>
									<span class="csub">{t(g.hint)}</span>
								</label>
							{/each}
						</fieldset>
						<fieldset class="group">
							<legend class="lbl">{t(OB.group.care)}</legend>
							<div class="chips">
								{#each OB.care as c (c.key)}
									<label class={['j-chip', s.care.includes(c.key) && 'on']}
										><input
											type="checkbox"
											checked={s.care.includes(c.key)}
											onchange={() => toggle('care', c.key)}
										/>{t(c.label)}</label
									>
								{/each}
							</div>
						</fieldset>
						<fieldset class="group">
							<legend class="lbl">{t(OB.group.modes)}</legend>
							<div class="chips">
								{#each OB.modes as c (c.key)}
									<label class={['j-chip', s.modes.includes(c.key) && 'on']}
										><input
											type="checkbox"
											checked={s.modes.includes(c.key)}
											onchange={() => toggle('modes', c.key)}
										/>{t(c.label)}</label
									>
								{/each}
							</div>
						</fieldset>
					{:else if s.step === 'interests'}
						<div class="titlerow">
							<h1 bind:this={heading} tabindex="-1">{t(OB.interests.title)}</h1>
							<span class="count" aria-live="polite"
								>{t(OB.interests.picked).replace('{n}', String(s.interests.length))}</span
							>
						</div>
						<fieldset class="group">
							<legend class="sr-only">{t(OB.interests.label)}</legend>
							<div class="chips">
								{#each OB.interestList as c (c.key)}
									<label class={['j-chip icon', s.interests.includes(c.key) && 'on']}>
										<input
											type="checkbox"
											checked={s.interests.includes(c.key)}
											onchange={() => toggle('interests', c.key)}
										/>
										<InkIcon name={c.icon} size={20} stroke={2.8} />{t(c.label)}
									</label>
								{/each}
							</div>
						</fieldset>
						<fieldset class="group">
							<legend class="lbl">{t(OB.interests.pace)}</legend>
							<div class="grid3">
								{#each OB.paces as p (p.key)}
									<label class={['card small', s.pace === p.key && 'on dark']}>
										<input
											type="radio"
											name="ob-pace"
											value={p.key}
											checked={s.pace === p.key}
											onchange={() => pickPace(p.key)}
										/>
										<span class="cname">{t(p.label)}</span>
										<span class="csub">{t(p.hint)}</span>
									</label>
								{/each}
							</div>
						</fieldset>
						<button
							class={['switch', s.gems && 'on']}
							role="switch"
							aria-checked={s.gems}
							onclick={() => (s.gems = !s.gems)}
						>
							<span class="ctext"
								><span class="cname">{t(OB.interests.gems)}</span><span class="csub"
									>{t(OB.interests.gemsHint)}</span
								></span
							>
							<span class="track" aria-hidden="true"><span class="knob"></span></span>
						</button>
					{:else if s.step === 'food'}
						<h1 bind:this={heading} tabindex="-1">{t(OB.food.title)}</h1>
						<fieldset class="group">
							<legend class="lbl">{t(OB.food.food)}</legend>
							<div class="chips">
								{#each OB.foods as f (f.key)}
									<label class={['j-chip', s.food === f.key && 'on']}>
										<input type="radio" name="ob-food" value={f.key} bind:group={s.food} />
										<span class={['vmark', f.shape]} style:--c={f.dot} aria-hidden="true"
											><i></i></span
										>{t(f.label)}
									</label>
								{/each}
							</div>
						</fieldset>
						<fieldset class="group">
							<legend class="lbl"
								>{t(OB.food.budget)} <span class="opt">{t(OB.food.budgetHint)}</span></legend
							>
							<div class="chips">
								{#each OB.budgets as b (b.key)}
									<label class={['j-chip', s.budget === b.key && 'on']}
										><input type="radio" name="ob-budget" value={b.key} bind:group={s.budget} />{t(
											b.label
										)}</label
									>
								{/each}
							</div>
						</fieldset>
						<fieldset class="group grid2">
							<legend class="lbl">{t(OB.food.stay)}</legend>
							{#each OB.stays as st (st.key)}
								<label class={['card tall', s.stay === st.key && 'on dark']}>
									<input type="radio" name="ob-stay" value={st.key} bind:group={s.stay} />
									<InkIcon name={st.icon} size={30} stroke={2.6} />
									<span class="cname">{t(st.label)}</span>
									<span class="csub">{t(st.hint)}</span>
								</label>
							{/each}
						</fieldset>
						<p class="privacy">
							<InkIcon name="shield" size={20} stroke={3} />{t(OB.food.privacy)}
						</p>
					{:else}
						<h1 bind:this={heading} tabindex="-1" class="ready">
							{t(OB.done.ready).replace('{name}', s.name.trim() || t(OB.done.friend))}
						</h1>
						<p class="sub">{t(OB.done.sub)}</p>
						<form method="POST" action="/prefs" class="stack">
							<input type="hidden" name="locale" value={s.lang} />
							<input type="hidden" name="return" value="/discover" />
							<button class="j-btn wide">{t(OB.done.go)} <span aria-hidden="true">→</span></button>
						</form>
						<a href={resolve('/')} class="link center">{t(OB.done.home)}</a>
					{/if}
				</section>
			{/key}
		</div>

		{#if formAt >= 0}
			<div class="foot">
				{#if s.step === 'food'}
					<button class="j-btn wide" onclick={finish}>{t(OB.food.start)}</button>
				{:else}
					<button
						class="j-btn wide"
						onclick={next}
						disabled={s.step === 'interests' && need > 0}
						aria-describedby={s.step === 'interests' ? 'ob-need' : undefined}
					>
						{t(OB.cont)} <span aria-hidden="true">→</span>
					</button>
					{#if s.step === 'interests' && need > 0}<p id="ob-need" class="hint center">
							{t(OB.interests.need).replace('{n}', String(need))}
						</p>{/if}
				{/if}
			</div>
		{/if}
	</main>
</div>

<style>
	.ob {
		min-height: 100dvh;
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		grid-template-rows: auto 1fr;
	}
	.stage {
		position: relative;
		height: 340px;
		overflow: hidden;
	}
	.crab {
		position: absolute;
		bottom: 6px;
		translate: -50% 0;
		transition: left 1.1s cubic-bezier(0.45, 0, 0.3, 1);
		z-index: 3;
	}
	.crab :global(.crabby) {
		width: clamp(110px, 32vw, 180px);
		height: auto;
	}
	.bubble {
		position: absolute;
		bottom: calc(100% - 26px);
		left: 50%;
		width: max-content;
		max-width: 240px;
		padding: 10px 14px;
		border-radius: 18px 18px 18px 4px;
		background: var(--navy);
		color: var(--beige);
		font-size: 14px;
		font-weight: 600;
		line-height: 1.35;
		box-shadow: 3px 3px 0 var(--laterite);
		animation: pop 0.45s var(--j-spring) both;
	}
	.bubble .j-deva {
		font-size: 18px;
		font-weight: 400;
	}
	.bubble.small {
		font-weight: 500;
		max-width: min(240px, 46vw);
	}
	.bubble.r {
		left: auto;
		right: 50%;
		border-radius: 18px 18px 4px 18px;
	}
	.postcard {
		position: absolute;
		z-index: 4;
		right: 14px;
		top: 14px;
		width: min(250px, 58vw);
		transform: rotate(3deg);
		transition:
			all 0.9s cubic-bezier(0.3, 1.2, 0.4, 1),
			opacity 0.3s;
	}
	.postcard.center {
		right: 50%;
		top: 50%;
		width: min(420px, 86vw);
		transform: translate(50%, -50%) rotate(-2deg);
	}
	.sheet {
		position: relative;
		z-index: 5;
		margin-top: -28px;
		display: flex;
		flex-direction: column;
		padding: 18px 20px 24px;
		border-radius: 28px 28px 0 0;
		background: var(--beige);
		box-shadow: 0 -10px 30px rgb(47 65 86 / 0.12);
	}
	.bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		min-height: 48px;
	}
	.brand {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-family: var(--j-display);
		font-size: 22px;
		text-decoration: none;
	}
	.iconbtn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 44px;
		height: 44px;
		border-radius: 999px;
		border: 1.5px solid var(--navy);
		background: transparent;
	}
	.skip {
		min-height: 44px;
		padding: 0 8px;
		border: 0;
		background: transparent;
		font-weight: 600;
		text-decoration: underline;
		text-underline-offset: 3px;
	}
	.lang {
		display: flex;
		padding: 3px;
		border: 1.5px solid var(--navy);
		border-radius: 999px;
	}
	.lang button {
		min-width: 44px;
		min-height: 38px;
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
	/* liquid progress: each segment fills with a sloshing drop at its leading edge */
	.progress {
		flex: 1;
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 6px;
		max-width: 220px;
	}
	.seg {
		position: relative;
		height: 8px;
		border-radius: 999px;
		background: var(--line);
		overflow: hidden;
	}
	.seg i {
		position: absolute;
		inset: 0;
		width: 0;
		border-radius: 999px;
		background: var(--navy);
		transition: width 0.9s cubic-bezier(0.5, 1.6, 0.4, 1);
	}
	.seg.full i {
		width: 100%;
	}
	.seg.now i {
		width: 55%;
		background: linear-gradient(90deg, var(--navy) 70%, var(--teal));
	}
	.seg.now i::after {
		content: '';
		position: absolute;
		right: -3px;
		top: -2px;
		width: 12px;
		height: 12px;
		border-radius: 50%;
		background: var(--teal);
	}
	.steps {
		display: grid;
		flex: 1;
		margin-top: 8px;
	}
	.step {
		grid-area: 1 / 1;
		display: flex;
		flex-direction: column;
		gap: 12px;
		min-width: 0;
	}
	h1 {
		margin-top: 8px;
		font-family: var(--j-display);
		font-weight: 400;
		font-size: clamp(30px, 6vw, 44px);
		line-height: 1.05;
		letter-spacing: -0.02em;
		text-wrap: balance;
	}
	h1:focus {
		outline: none;
	}
	.ob:lang(hi) h1,
	.ob:lang(mr) h1 {
		line-height: 1.25;
		letter-spacing: 0;
	}
	.sub {
		color: var(--muted);
	}
	.stack {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.lbl {
		margin-top: 6px;
		font-size: 15px;
		font-weight: 600;
	}
	.opt {
		font-weight: 400;
		color: var(--muted);
	}
	.field {
		width: 100%;
		min-height: 54px;
		padding: 0 16px;
		border: 1.5px solid var(--line);
		border-radius: 16px;
		background: var(--white);
		color: var(--navy);
		font: inherit;
		font-size: 16px;
	}
	.field:focus {
		outline: none;
		border-color: var(--navy);
		box-shadow: 3px 3px 0 var(--navy);
	}
	.field[aria-invalid='true'] {
		border-color: var(--laterite);
	}
	.withicon {
		position: relative;
		display: flex;
		align-items: center;
		color: var(--muted);
	}
	.withicon :global(svg) {
		position: absolute;
		left: 14px;
	}
	.withicon .field {
		padding-left: 44px;
	}
	.hint {
		font-size: 13px;
		color: var(--muted);
	}
	.err {
		min-height: 1em;
		font-size: 14px;
		font-weight: 600;
		color: var(--laterite);
	}
	.err:empty {
		display: none;
	}
	.j-btn.wide {
		width: 100%;
	}
	.j-btn:disabled {
		opacity: 0.45;
		cursor: not-allowed;
		transform: none;
		box-shadow: none;
	}
	.or {
		display: flex;
		align-items: center;
		gap: 12px;
		color: var(--muted);
		font-size: 14px;
	}
	.or span {
		flex: 1;
		height: 1px;
		background: var(--line);
	}
	/* Google sign-in, per its branding: four-colour G, plain light button, grey outline */
	.google {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 12px;
		width: 100%;
		min-height: 52px;
		border: 1px solid #747775;
		border-radius: 999px;
		background: #ffffff;
		color: #1f1f1f;
		font-size: 15px;
		font-weight: 500;
	}
	.gate {
		padding: 12px 14px;
		border-radius: 14px;
		border: 1px dashed var(--teal);
		background: var(--white);
		font-size: 14px;
	}
	.guest {
		align-self: center;
		min-height: 44px;
		border: 0;
		background: transparent;
		font-weight: 600;
		text-decoration: underline;
		text-underline-offset: 4px;
	}
	.legal {
		font-size: 12px;
		color: var(--muted);
		text-align: center;
	}
	.row {
		display: flex;
		justify-content: space-between;
		gap: 12px;
		flex-wrap: wrap;
		align-items: center;
	}
	.link {
		min-height: 44px;
		padding: 0;
		border: 0;
		background: transparent;
		font-weight: 600;
		text-decoration: underline;
		text-underline-offset: 3px;
	}
	.center {
		align-self: center;
		text-align: center;
	}
	.group {
		margin: 0;
		padding: 0;
		border: 0;
		display: flex;
		flex-direction: column;
		gap: 8px;
		min-width: 0;
	}
	.grid2 {
		display: grid;
		grid-template-columns: 1fr 1fr;
	}
	.grid2 legend {
		grid-column: 1 / -1;
	}
	.grid3 {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 8px;
	}
	.card {
		position: relative;
		display: flex;
		align-items: center;
		gap: 12px;
		min-height: 60px;
		padding: 12px 16px;
		border: 1.5px solid var(--line);
		border-radius: 18px;
		background: rgb(255 255 255 / 0.6);
		cursor: pointer;
		transition:
			border-color 0.2s,
			background 0.2s,
			transform 0.3s var(--j-spring);
	}
	.card:active {
		transform: scale(0.97);
	}
	.card.on {
		border-color: var(--navy);
		background: var(--white);
		box-shadow: 3px 3px 0 var(--navy);
	}
	.card.dark {
		background: var(--navy);
		color: var(--white);
	}
	.card.tall {
		flex-direction: column;
		align-items: flex-start;
		gap: 4px;
	}
	.card.small {
		flex-direction: column;
		align-items: flex-start;
		gap: 0;
		padding: 10px 12px;
	}
	.card input,
	.j-chip input {
		position: absolute;
		opacity: 0;
		width: 1px;
		height: 1px;
	}
	.card:has(input:focus-visible),
	.j-chip:has(input:focus-visible) {
		outline: 3px solid var(--laterite);
		outline-offset: 2px;
	}
	.ctext {
		display: flex;
		flex: 1;
		flex-direction: column;
		text-align: left;
	}
	.cname {
		font-weight: 600;
		font-size: 16px;
	}
	.csub {
		font-size: 13px;
		opacity: 0.75;
	}
	.cname.j-deva {
		font-size: 18px;
		font-weight: 400;
	}
	.radio {
		width: 20px;
		height: 20px;
		border-radius: 50%;
		border: 1.5px solid var(--navy);
		background: var(--white);
	}
	.card.on .radio {
		background: radial-gradient(circle, var(--navy) 45%, var(--white) 50%);
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.j-chip {
		position: relative;
		cursor: pointer;
		background: rgb(255 255 255 / 0.6);
	}
	.j-chip.on {
		background: var(--navy);
		color: var(--white);
	}
	.j-chip.icon {
		gap: 6px;
		padding-left: 10px;
	}
	.vmark {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 16px;
		height: 16px;
		border: 1.5px solid var(--c);
		border-radius: 3px;
		background: #fff;
	}
	.vmark i {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--c);
	}
	.vmark.triangle i {
		border-radius: 0;
		clip-path: polygon(50% 0, 100% 100%, 0 100%);
	}
	.titlerow {
		display: flex;
		justify-content: space-between;
		align-items: flex-end;
		gap: 12px;
	}
	.count {
		flex: none;
		padding: 6px 12px;
		border-radius: 999px;
		background: var(--navy);
		color: var(--white);
		font-size: 13px;
		font-weight: 600;
	}
	.switch {
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
		min-height: 64px;
		padding: 12px 16px;
		border: 1.5px solid var(--line);
		border-radius: 18px;
		background: rgb(255 255 255 / 0.6);
		text-align: left;
	}
	.switch.on {
		border-color: var(--navy);
	}
	.track {
		position: relative;
		flex: none;
		width: 48px;
		height: 28px;
		border-radius: 999px;
		background: var(--line);
		transition: background 0.2s;
	}
	.knob {
		position: absolute;
		top: 3px;
		left: 3px;
		width: 22px;
		height: 22px;
		border-radius: 50%;
		background: var(--white);
		box-shadow: 0 1px 3px rgb(0 0 0 / 0.25);
		transition: transform 0.35s var(--j-spring);
	}
	.switch.on .track {
		background: var(--navy);
	}
	.switch.on .knob {
		transform: translateX(20px);
	}
	.privacy {
		display: flex;
		gap: 10px;
		align-items: flex-start;
		padding: 12px 14px;
		border-radius: 14px;
		background: var(--white);
		font-size: 13px;
		color: var(--muted);
	}
	.ready {
		font-size: clamp(34px, 6vw, 52px);
	}
	.foot {
		position: sticky;
		bottom: 0;
		margin: 16px -20px -24px;
		padding: 12px 20px calc(16px + env(safe-area-inset-bottom));
		background: linear-gradient(to bottom, transparent, var(--beige) 24%);
	}
	@keyframes pop {
		from {
			opacity: 0;
			transform: scale(0.7) translateY(8px);
		}
	}

	/* laptops: split screen, the scene on the left (≈55 %), the form on the right */
	@media (min-width: 960px) {
		.ob {
			grid-template-columns: 55fr 45fr;
			grid-template-rows: 1fr;
			height: 100dvh;
		}
		.stage {
			height: 100dvh;
			position: sticky;
			top: 0;
		}
		.crab {
			bottom: 4%;
		}
		.crab :global(.crabby) {
			width: 220px;
		}
		.postcard {
			right: 32px;
			top: 32px;
			width: 300px;
		}
		.postcard.center {
			width: 460px;
		}
		.sheet {
			margin-top: 0;
			border-radius: 0;
			box-shadow: none;
			overflow-y: auto;
			padding: 32px clamp(24px, 4vw, 56px) 32px;
		}
		.foot {
			margin: 16px calc(-1 * clamp(24px, 4vw, 56px)) -32px;
			padding-inline: clamp(24px, 4vw, 56px);
		}
	}
</style>
