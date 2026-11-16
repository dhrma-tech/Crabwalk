// Ask the service worker to drop cached pages and saved trip routes (SEC-09). Called before sign-out and
// admin exit, so nothing of this person's session can be opened offline afterwards. Resolves when the worker
// confirms, or after 300 ms: signing out never waits on it.
export function purgePrivateCaches(): Promise<void> {
	const worker = 'serviceWorker' in navigator ? navigator.serviceWorker.controller : null;
	if (!worker) return Promise.resolve();
	return new Promise((done) => {
		const { port1, port2 } = new MessageChannel();
		const timer = setTimeout(done, 300);
		port1.onmessage = () => (clearTimeout(timer), done());
		worker.postMessage({ type: 'purge' }, [port2]);
	});
}

/** onsubmit for a plain sign-out form: purge first, then let the form post as usual. */
export async function purgeThenSubmit(e: SubmitEvent) {
	const form = e.currentTarget as HTMLFormElement;
	e.preventDefault();
	await purgePrivateCaches();
	form.submit();
}
