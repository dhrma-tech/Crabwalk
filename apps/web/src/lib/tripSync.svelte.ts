// Plan workspace saving (P11 §6). Every edit goes through one ordered outbox per trip, kept in localStorage so
// edits made offline survive a reload and replay when the connection returns (like the field queue). A network
// failure keeps the edit queued; a refused edit (4xx/5xx) is dropped with a toast. The page reloads its data once
// the outbox drains. Undo/redo: this session only, the last 30 edits, each stored with its inverse.
import { m } from '#lib/paraglide/messages.js';
import { toast } from '#lib/toast.svelte.ts';

export type Req = {
	path: string;
	method: string;
	body: Record<string, unknown>;
	/** false: the page keeps its state (notes being typed); no reload when this one lands. */
	reload?: boolean;
	/** Response hook: new row ids are written into the paired undo/redo request. Not kept offline. */
	onres?: (r: Record<string, unknown>) => void;
	/** Local effect when replayed by undo/redo (e.g. put the notes text back). */
	apply?: () => void;
};
type Entry = { do: Req[]; undo: Req[] };
const LIMIT = 30;

export function tripSync(tripId: string, reload: () => Promise<unknown>) {
	const key = `crabwalk-plan-outbox:${tripId}`;
	let outbox: Req[] = [];
	try {
		outbox = JSON.parse(localStorage.getItem(key) ?? '[]') as Req[];
	} catch {
		/* private mode / blocked storage: start empty */
	}
	const s = $state({ pending: outbox.length, offline: false, past: 0, future: 0 });
	const past: Entry[] = [];
	const future: Entry[] = [];
	let busy = false;
	let dirty = false;

	function save() {
		s.pending = outbox.length;
		try {
			if (outbox.length) localStorage.setItem(key, JSON.stringify(outbox));
			else localStorage.removeItem(key);
		} catch {
			/* storage full or blocked: the in-memory queue still syncs while the page is open */
		}
	}
	async function pump() {
		if (busy) return;
		busy = true;
		while (outbox.length) {
			const r = outbox[0]!;
			const res = await fetch(`/api/trips/${tripId}${r.path}`, {
				method: r.method,
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(r.body)
			}).catch(() => null);
			if (!res) {
				s.offline = true;
				busy = false;
				return;
			}
			s.offline = false;
			outbox.shift();
			save();
			if (r.reload !== false) dirty = true;
			if (res.ok) r.onres?.((await res.json().catch(() => ({}))) as Record<string, unknown>);
			else toast(m.send_failed());
		}
		busy = false;
		if (dirty) {
			dirty = false;
			await reload();
		}
	}
	function enqueue(...reqs: Req[]) {
		outbox.push(...reqs);
		save();
		void pump();
	}
	function counts() {
		s.past = past.length;
		s.future = future.length;
	}

	return {
		get status(): 'saved' | 'saving' | 'offline' {
			return s.offline && s.pending ? 'offline' : s.pending ? 'saving' : 'saved';
		},
		get canUndo() {
			return s.past > 0;
		},
		get canRedo() {
			return s.future > 0;
		},
		/** Send an edit; with an inverse it joins the undo history (and clears redo). */
		send(req: Req, inverse?: Req[] | null) {
			if (inverse) {
				past.push({ do: [req], undo: inverse });
				if (past.length > LIMIT) past.shift();
				future.length = 0;
				counts();
			}
			enqueue(req);
		},
		undo() {
			const e = past.pop();
			if (!e) return;
			future.push(e);
			counts();
			e.undo.forEach((r) => r.apply?.());
			enqueue(...e.undo.map((r) => ({ ...r, reload: true })));
		},
		redo() {
			const e = future.pop();
			if (!e) return;
			past.push(e);
			counts();
			e.do.forEach((r) => r.apply?.());
			enqueue(...e.do.map((r) => ({ ...r, reload: true })));
		},
		/** Someone else changed the trip (realtime): reload now, or after our own queued edits land. */
		refresh() {
			if (busy || outbox.length) dirty = true;
			else void reload();
		},
		/** Replay what was queued offline (page open, connection back). */
		flush: () => void pump()
	};
}
