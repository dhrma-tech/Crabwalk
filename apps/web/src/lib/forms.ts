import { enhance, type SubmitFunction } from '$app/forms';
import { m } from '#lib/paraglide/messages.js';
import { toast } from '#lib/toast.svelte.ts';

const submitButtons = (form: HTMLFormElement) =>
	form.querySelectorAll<HTMLButtonElement>('button:not([type="button"])');

function setBusy(form: HTMLFormElement, busy: boolean) {
	if (busy) form.setAttribute('aria-busy', 'true');
	else form.removeAttribute('aria-busy');
	for (const b of submitButtons(form)) b.disabled = busy;
}

/**
 * `use:enhance` with feedback: while the action runs the form is aria-busy and its submit buttons are
 * disabled (no double submits); an unexpected failure shows a toast. Takes an optional SubmitFunction,
 * exactly like `enhance`.
 */
export function submitting(form: HTMLFormElement, submit?: SubmitFunction) {
	return enhance(form, async (input) => {
		// FormData (including the submitter's name/value) is captured before this runs, so disabling is safe.
		setBusy(form, true);
		const cancel = input.cancel;
		input.cancel = () => {
			setBusy(form, false);
			cancel();
		};
		const after = await submit?.(input);
		return async (opts) => {
			setBusy(form, false);
			if (opts.result.type === 'error') toast(m.send_failed());
			if (after) await after(opts);
			else await opts.update();
		};
	});
}

/**
 * Plain (non-enhanced) POST forms: disable submit buttons once the browser has built the request, so a
 * slow network can't cause a double submit. Enhanced or script-handled forms call preventDefault and
 * manage their own state. A page restored from the back/forward cache gets its buttons back.
 */
export function guardPlainForms() {
	const onSubmit = (e: SubmitEvent) => {
		const form = e.target;
		if (e.defaultPrevented || !(form instanceof HTMLFormElement) || form.method !== 'post') return;
		// After this task: the entry list (with the submitter's value) is already built by then.
		setTimeout(() => setBusy(form, true));
	};
	const onShow = (e: PageTransitionEvent) => {
		if (e.persisted) for (const f of document.forms) setBusy(f, false);
	};
	addEventListener('submit', onSubmit);
	addEventListener('pageshow', onShow);
	return () => {
		removeEventListener('submit', onSubmit);
		removeEventListener('pageshow', onShow);
	};
}
