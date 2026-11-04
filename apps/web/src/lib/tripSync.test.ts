import { afterEach, describe, expect, it, vi } from 'vitest';
import { tripSync, type Req } from './tripSync.svelte.ts';

// P11 step F: the plan workspace outbox (ordered, survives offline) and undo/redo with ids from responses.
type Sent = { method: string; body: Record<string, unknown> };
function server(reply: (b: Record<string, unknown>) => Record<string, unknown> = () => ({})) {
	const sent: Sent[] = [];
	let offline = false;
	vi.stubGlobal('fetch', async (_url: string, init: RequestInit) => {
		if (offline) throw new TypeError('Failed to fetch');
		const body = JSON.parse(String(init.body)) as Record<string, unknown>;
		sent.push({ method: String(init.method), body });
		return new Response(JSON.stringify({ ok: true, ...reply(body) }));
	});
	return { sent, setOffline: (v: boolean) => (offline = v) };
}
const settle = () => new Promise((r) => setTimeout(r, 0));
const op = (body: Record<string, unknown>): Req => ({ path: '/workspace', method: 'POST', body });
afterEach(() => vi.unstubAllGlobals());

describe('tripSync', () => {
	it('sends edits in order and reloads once the outbox drains', async () => {
		const { sent } = server();
		const reload = vi.fn(async () => {});
		const s = tripSync('t1', reload);
		s.send(op({ n: 1 }));
		s.send(op({ n: 2 }));
		expect(s.status).toBe('saving');
		await settle();
		await settle();
		expect(sent.map((x) => x.body.n)).toEqual([1, 2]);
		expect(s.status).toBe('saved');
		expect(reload).toHaveBeenCalledTimes(1);
	});

	it('keeps edits queued while offline and sends them when the connection returns', async () => {
		const net = server();
		const s = tripSync('t2', async () => {});
		net.setOffline(true);
		s.send(op({ n: 1 }));
		await settle();
		expect(s.status).toBe('offline');
		expect(net.sent).toHaveLength(0);
		net.setOffline(false);
		s.flush();
		await settle();
		await settle();
		expect(net.sent.map((x) => x.body.n)).toEqual([1]);
		expect(s.status).toBe('saved');
	});

	it('undo → redo → undo follows the new row id each time', async () => {
		let next = 0;
		const { sent } = server((b) => (b.op === 'item.add' ? { id: `row-${++next}` } : {}));
		const s = tripSync('t3', async () => {});
		const add = op({ op: 'item.add', item: { kind: 'note', body: 'Ferry cash' } });
		const del = op({ op: 'item.delete', id: '' });
		add.onres = (x) => (del.body.id = x.id);
		s.send(add, [del]);
		await settle();
		s.undo();
		await settle();
		expect(sent.at(-1)!.body).toEqual({ op: 'item.delete', id: 'row-1' });
		s.redo();
		await settle();
		s.undo();
		await settle();
		expect(sent.at(-1)!.body).toEqual({ op: 'item.delete', id: 'row-2' });
		expect(s.canUndo).toBe(false);
		expect(s.canRedo).toBe(true);
	});

	it('keeps the last 30 edits and a new edit clears redo', async () => {
		server();
		const s = tripSync('t4', async () => {});
		for (let i = 0; i < 35; i++) s.send(op({ n: i }), [op({ n: -i })]);
		await settle();
		let undone = 0;
		while (s.canUndo) {
			s.undo();
			undone++;
		}
		expect(undone).toBe(30);
		s.send(op({ n: 99 }), [op({ n: -99 })]);
		expect(s.canRedo).toBe(false);
	});
});
