// Offline outbox (hardening T1-10, UX-15): votes, sub-scores and hearts made without a connection wait in
// IndexedDB and are sent when the browser is back online (the `online` event, or the next page load).
// One entry per (endpoint, listing, group or dimension): a newer tap replaces the older one. Same IndexedDB
// pattern as the field queue (`field/queue.ts`).
type Item = { key: string; url: string; method: 'POST' | 'DELETE'; body?: string; at: number };
const DB = 'crabwalk-outbox';
const STORE = 'outbox';

function open() {
	return new Promise<IDBDatabase>((res, rej) => {
		const r = indexedDB.open(DB, 1);
		r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'key' });
		r.onsuccess = () => res(r.result);
		r.onerror = () => rej(r.error);
	});
}
async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>) {
	const db = await open();
	return new Promise<T>((res, rej) => {
		const req = fn(db.transaction(STORE, mode).objectStore(STORE));
		req.onsuccess = () => res(req.result);
		req.onerror = () => rej(req.error);
	});
}
const put = (i: Item) => tx('readwrite', (s) => s.put(i));
const all = () => tx<Item[]>('readonly', (s) => s.getAll());
const del = (key: string) => tx('readwrite', (s) => s.delete(key));

const request = (i: Item) =>
	fetch(i.url, {
		method: i.method,
		headers: i.body ? { 'content-type': 'application/json' } : undefined,
		body: i.body
	});

/**
 * Sends now, or queues when offline or the network fails (resolves `null`). A server answer, good or bad, is
 * returned as is. `wrap` lets a caller retry once after renewing a guest session.
 */
export async function send(
	key: string,
	url: string,
	init: { method: 'POST' | 'DELETE'; body?: unknown },
	wrap: (f: () => Promise<Response>) => Promise<Response> = (f) => f()
): Promise<Response | null> {
	const item: Item = {
		key,
		url,
		method: init.method,
		body: init.body === undefined ? undefined : JSON.stringify(init.body),
		at: Date.now()
	};
	if (navigator.onLine !== false) {
		const r = await wrap(() => request(item)).catch(() => null);
		if (r) return r;
	}
	try {
		await put(item);
	} catch {
		return new Response(null, { status: 503 }); // nowhere to keep it: report a failure
	}
	return null;
}

let flushing = false;
/** Replays the queue oldest first. Stops at a network failure or a 5xx / 408 / 429 (kept for later). */
export async function flush() {
	if (flushing || navigator.onLine === false) return;
	flushing = true;
	try {
		for (const i of (await all()).sort((a, b) => a.at - b.at)) {
			const r = await request(i).catch(() => null);
			if (!r || r.status >= 500 || r.status === 408 || r.status === 429) break;
			await del(i.key); // sent, or refused for good (4xx): never retried forever
		}
	} catch {
		// IndexedDB unavailable (private mode): nothing was queued either.
	} finally {
		flushing = false;
	}
}

/** Root layout: flush now and whenever the connection comes back. */
export function startOutbox() {
	void flush();
	addEventListener('online', flush);
	return () => removeEventListener('online', flush);
}
