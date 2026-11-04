// Trip journal media on the phone (P12-0): photos and clips the user adds stay in this browser's IndexedDB and
// are never uploaded. Only a photo the user shares into the journal goes to our storage (compressed, webp).
export type LocalMedia = { id: string; trip: string; blob: Blob; type: string; added: number };

const open = () =>
	new Promise<IDBDatabase>((ok, fail) => {
		const r = indexedDB.open('crabwalk-journal', 1);
		r.onupgradeneeded = () =>
			r.result.createObjectStore('media', { keyPath: 'id' }).createIndex('trip', 'trip');
		r.onsuccess = () => ok(r.result);
		r.onerror = () => fail(r.error);
	});

async function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>) {
	const db = await open();
	return new Promise<T>((ok, fail) => {
		const r = run(db.transaction('media', mode).objectStore('media'));
		r.onsuccess = () => ok(r.result);
		r.onerror = () => fail(r.error);
	}).finally(() => db.close());
}

export const listMedia = (trip: string) =>
	tx<LocalMedia[]>('readonly', (s) => s.index('trip').getAll(trip)).then((all) =>
		all.sort((a, b) => a.added - b.added)
	);
export const addMedia = (trip: string, file: File) =>
	tx('readwrite', (s) =>
		s.put({ id: crypto.randomUUID(), trip, blob: file, type: file.type, added: Date.now() })
	);
export const removeMedia = (id: string) => tx('readwrite', (s) => s.delete(id));
