<script lang="ts">
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
		code: m.login_err_code
	};
	const error = $derived(form?.error ?? data.error);
</script>

<Page title={m.sign_in()} back>
	<div class="mx-auto flex max-w-[420px] flex-col gap-6 py-4">
		{#if data.email}
			<p class="type-body">{m.me_signed_in_as({ email: data.email })}</p>
			<form method="POST" action="?/signOut">
				<Button variant="secondary" type="submit">{m.sign_out()}</Button>
			</form>
		{:else}
			<!-- Suna 4a: seal mark + serif invitation; Google is the outline button, "Send code" the primary. -->
			<div class="flex flex-col gap-4 pt-6">
				<BrandMark size={40} />
				<h2 class="type-h1 text-[28px]">{m.plan_signin()}</h2>
			</div>
			{#if error && errors[error]}
				<p class="border border-text p-4 type-body" role="alert">
					{errors[error]()}
				</p>
			{/if}

			{#if form?.sent}
				<form method="POST" action="?/verifyCode" class="flex flex-col gap-4">
					<p class="type-body">{m.login_code_sent({ email: form.email })}</p>
					<input type="hidden" name="email" value={form.email} />
					<Input
						id="token"
						name="token"
						label={m.login_code()}
						inputmode="numeric"
						autocomplete="one-time-code"
						required
					/>
					<Button type="submit">{m.login_verify()}</Button>
				</form>
			{:else}
				<form method="POST" action="?/google">
					<Button type="submit" variant="secondary" class="w-full">{m.login_google()}</Button>
				</form>
				<p class="text-center type-small text-text-2">{m.login_or()}</p>
				<form method="POST" action="?/sendCode" class="flex flex-col gap-4">
					<Input
						id="email"
						name="email"
						type="email"
						label={m.login_email()}
						autocomplete="email"
						required
					/>
					<Button type="submit">{m.login_send_code()}</Button>
				</form>
			{/if}
		{/if}
	</div>
</Page>
