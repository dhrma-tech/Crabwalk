<script lang="ts">
	import type { PageProps } from './$types';

	// Minimal P1 sign-in screen; styled and translated in P2.
	let { data, form }: PageProps = $props();
</script>

<h1>Sign in</h1>

{#if data.email}
	<p>Signed in as {data.email}</p>
	<form method="POST" action="?/signOut"><button>Sign out</button></form>
{:else}
	<form method="POST" action="?/google"><button>Continue with Google</button></form>

	{#if form?.sent}
		<form method="POST" action="?/verifyCode">
			<input type="hidden" name="email" value={form.email} />
			<label
				>Code sent to {form.email}
				<input name="token" inputmode="numeric" autocomplete="one-time-code" required /></label
			>
			<button>Verify</button>
		</form>
	{:else}
		<form method="POST" action="?/sendCode">
			<label>Email <input name="email" type="email" autocomplete="email" required /></label>
			<button>Send code</button>
		</form>
	{/if}

	{#if form?.error}<p role="alert">Sign-in failed ({form.error}). Try again.</p>{/if}
{/if}
