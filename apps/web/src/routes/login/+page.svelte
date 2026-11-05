<script lang="ts">
	import { onMount } from 'svelte';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import { m } from '#lib/paraglide/messages.js';
	import Page from '#lib/components/Page.svelte';
	import Button from '#lib/components/Button.svelte';
	import BrandMark from '#lib/components/BrandMark.svelte';
	import Input from '#lib/components/Input.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const errors: Record<string, () => string> = {
		oauth: m.login_err_oauth,
		email: m.login_err_email,
		send: m.login_err_send,
		rate: m.login_err_rate,
		code: m.login_err_code,
		// Dev-only quick sign-in (not translated: never in a build).
		quick: () => 'Dev sign-in failed: check DEV_LOGIN_* in .env.local.'
	};
	const error = $derived(form?.error ?? data.error);
	// Email and code errors show under their field; the rest are a page-level alert.
	const pageError = $derived(error && error !== 'email' && error !== 'code' ? errors[error] : null);
	// Where to go after signing in (validated server-side); carried through every step.
	const next = $derived(form?.next ?? data.next ?? '');

	// 6-box code (Report 2 §9.13): one real input (label, paste, one-time-code autofill) drawn as six boxes once
	// the page has hydrated; without JS it stays a plain field.
	let code = $state('');
	let boxes = $state(false);
	let focused = $state(false);
	onMount(() => (boxes = true));
</script>

<Page title={m.sign_in()} back>
	<!-- Tideline (T-38): a centred card on a soft lagoon-to-shell band. -->
	<div class="relative -mx-5 -mt-2 px-5 pt-8 pb-6 lg:mx-0 lg:mt-0 lg:px-8 lg:pt-12">
		<div
			class="absolute inset-x-0 top-0 h-72 bg-linear-to-b from-lagoon-50 to-bg lg:rounded-t-xl"
			aria-hidden="true"
		></div>
		<div class="relative mx-auto flex max-w-105 flex-col gap-5 rounded-xl bg-surface p-6 shadow-e2">
			{#if data.email}
				<BrandMark size={40} />
				<p class="type-body break-words">{m.me_signed_in_as({ email: data.email })}</p>
				<div class="flex flex-col gap-3 [&>*]:w-full [&_button]:w-full">
					<Button href="/">{m.go_discover()}</Button>
					<form method="POST" action="?/signOut">
						<Button variant="outline" type="submit">{m.sign_out()}</Button>
					</form>
				</div>
			{:else}
				<div class="flex flex-col gap-4">
					<BrandMark size={40} />
					<h2 class="type-h1">{m.plan_signin()}</h2>
				</div>
				{#if pageError}
					<p class="flex gap-2.5 rounded-md bg-danger-50 p-4 type-body text-text" role="alert">
						<CircleAlert size={20} class="mt-0.5 shrink-0" aria-hidden="true" />{pageError()}
					</p>
				{/if}

				{#if form?.sent}
					<form method="POST" action="?/verifyCode" class="flex flex-col gap-4">
						<p class="type-body text-text-2">{m.login_code_sent({ email: form.email })}</p>
						<input type="hidden" name="email" value={form.email} />
						<input type="hidden" name="next" value={next} />
						<div class="flex flex-col gap-1.5">
							<label for="token" class="type-small text-text-2">{m.login_code()}</label>
							<div class="relative">
								{#if boxes}
									<div class="grid grid-cols-6 gap-2" aria-hidden="true">
										{#each { length: 6 }, i (i)}
											<span
												class={[
													'flex h-14 items-center justify-center rounded-sm border-[1.5px] type-h2 tabular-nums transition-colors duration-(--dur-state)',
													focused && i === Math.min(code.length, 5)
														? 'border-text bg-surface'
														: error === 'code'
															? 'border-danger bg-surface-2'
															: 'border-transparent bg-surface-2'
												]}>{code[i] ?? ''}</span
											>
										{/each}
									</div>
								{/if}
								<input
									id="token"
									name="token"
									bind:value={code}
									oninput={() => (code = code.replace(/\D/g, '').slice(0, 6))}
									onfocus={() => (focused = true)}
									onblur={() => (focused = false)}
									inputmode="numeric"
									autocomplete="one-time-code"
									pattern={'[0-9]{6}'}
									maxlength={6}
									required
									aria-invalid={error === 'code' || undefined}
									aria-describedby={error === 'code' ? 'token-error' : undefined}
									class={boxes
										? 'absolute inset-0 h-full w-full bg-transparent text-transparent caret-transparent outline-none selection:bg-transparent'
										: 'field h-13 w-full px-4 type-body text-text'}
								/>
							</div>
							{#if error === 'code'}
								<p id="token-error" class="flex items-start gap-1.5 type-small text-danger">
									<CircleAlert size={16} aria-hidden="true" class="mt-0.5" />{m.login_err_code()}
								</p>
							{/if}
						</div>
						<Button type="submit" class="w-full">{m.login_verify()}</Button>
					</form>
				{:else}
					{#if data.quick}
						<!-- Dev server on localhost only (DEV_QUICK_LOGIN): turn off before deploy. -->
						<div
							class="flex flex-col gap-2 rounded-lg border border-dashed border-border p-3"
							data-testid="dev-quick-login"
						>
							<p class="type-small text-text-2">Dev only: skip sign-in as</p>
							<div class="flex gap-2 [&>*]:flex-1">
								{#each [['admin', 'Admin'], ['user', 'User']] as [as, label] (as)}
									<form method="POST" action="?/quick" class="[&_button]:w-full">
										<input type="hidden" name="next" value={next} />
										<input type="hidden" name="as" value={as} />
										<Button type="submit" variant="outline">{label}</Button>
									</form>
								{/each}
							</div>
						</div>
					{/if}
					<form method="POST" action="?/google">
						<input type="hidden" name="next" value={next} />
						<!-- Google's sign-in branding: the standard four-colour G on a plain outline button. -->
						<Button type="submit" variant="outline" class="w-full">
							{#snippet icon()}
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
							{/snippet}
							{m.login_google()}
						</Button>
					</form>
					<p class="flex items-center gap-3 type-small text-text-2" aria-hidden="true">
						<span class="h-px flex-1 bg-border"></span>{m.login_or()}<span
							class="h-px flex-1 bg-border"
						></span>
					</p>
					<form method="POST" action="?/sendCode" class="flex flex-col gap-4">
						<input type="hidden" name="next" value={next} />
						<Input
							id="email"
							name="email"
							type="email"
							label={m.login_email()}
							autocomplete="email"
							required
							error={error === 'email' ? m.login_err_email() : null}
						/>
						<Button type="submit" class="w-full">{m.login_send_code()}</Button>
					</form>
				{/if}
			{/if}
		</div>
	</div>
</Page>
