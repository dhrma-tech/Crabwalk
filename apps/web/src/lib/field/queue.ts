// Offline draft queue for the field form (FRONTEND §7.15 [DEFAULT]): IndexedDB, replayed when online.
// Listing ids/photo ids are client-generated, so a retry never creates duplicates.
import { uploadPhoto, type Processed } from './photos.ts';

export type Submission = {
	id: string;
	type: 'places' | 'stays' | 'eateries';
	payload: Record<string, unknown>;
	photos: Processed[];
	done: string[];
	error?: string;
};
const DB = 'crabwalk-field';
const STORE = 'queue';

function open() {
	return new Promise<IDBDatabase>((res, rej) => {
		const r = indexedDB.open(DB, 1);
		r.onupgradeneeded = () => r.result.createObjectStore(STORE, { keyPath: 'id' });
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
export const put = (s: Submission) => tx('readwrite', (st) => st.put(s));
export const all = () => tx<Submission[]>('readonly', (st) => st.getAll());
const del = (id: string) => tx('readwrite', (st) => st.delete(id));

const entityType = { places: 'place', stays: 'stay', eateries: 'eatery' } as const;

/** Sends one submission. Network failure → stays queued. 4xx → kept with an error for the verifier to see. */
export async function send(s: Submission): Promise<'sent' | 'queued' | 'failed'> {
	try {
		const res = await fetch(`/api/admin/${s.type}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(s.payload)
		});
		if (!res.ok) {
			await put({ ...s, error: (await res.text()).slice(0, 200) });
			return res.status >= 500 ? 'queued' : 'failed';
		}
		for (const [i, p] of s.photos.entries()) {
			if (s.done.includes(p.id)) continue;
			await uploadPhoto(p, { type: entityType[s.type], id: s.id }, i === 0);
			s.done.push(p.id);
			await put(s);
		}
		await del(s.id);
		return 'sent';
	} catch (e) {
		if ((e as { status?: number }).status && (e as { status: number }).status < 500) {
			await put({ ...s, error: (e as Error).message });
			return 'failed';
		}
		return 'queued';
	}
}

export async function flush() {
	if (!navigator.onLine) return;
	for (const s of await all()) if (!s.error) await send(s);
}
