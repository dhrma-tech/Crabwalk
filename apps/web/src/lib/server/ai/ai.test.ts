import { describe, expect, it } from 'vitest';
import { isEmergency } from '#lib/emergency.ts';
import { ProviderError, type ChatRequest, type Provider } from './providers.ts';
import { audit, route } from './router.ts';
import { scrub } from './scrub.ts';

const provider = (name: string, behave: () => never | { content: string }) => {
	const calls: ChatRequest[] = [];
	const p: Provider = {
		name,
		async chat(req) {
			calls.push(req);
			const r = behave();
			return { content: r.content, tool_calls: [] };
		}
	};
	return { p, calls };
};
const fail = (status: number) => () => {
	throw new ProviderError('x', status, 'boom');
};

describe('router (PLAN P8 acceptance: provider 429 → falls through chain)', () => {
	it('429 moves to the next provider', async () => {
		const a = provider('groq-8b', fail(429));
		const b = provider('groq-70b', () => ({ content: 'ok' }));
		const r = await route(
			[
				{ provider: a.p, model: 'm1' },
				{ provider: b.p, model: 'm2' }
			],
			{ messages: [{ role: 'user', content: 'hi' }] }
		);
		expect(r).toMatchObject({ content: 'ok', provider: 'groq-70b', model: 'm2' });
		expect(a.calls).toHaveLength(1);
	});
	it('5xx and network errors fall through too; the last error surfaces when all fail', async () => {
		const a = provider('a', fail(503));
		const b = provider('b', fail(0));
		const c = provider('c', fail(429));
		await expect(
			route(
				[
					{ provider: a.p, model: '1' },
					{ provider: b.p, model: '2' },
					{ provider: c.p, model: '3' }
				],
				{ messages: [] }
			)
		).rejects.toMatchObject({ status: 429 });
	});
	it('a 400 is a bug, not capacity: no fall-through', async () => {
		const a = provider('a', fail(400));
		const b = provider('b', () => ({ content: 'never' }));
		await expect(
			route(
				[
					{ provider: a.p, model: '1' },
					{ provider: b.p, model: '2' }
				],
				{ messages: [] }
			)
		).rejects.toMatchObject({ status: 400 });
		expect(b.calls).toHaveLength(0);
	});
	it('every payload is scrubbed before any provider sees it', async () => {
		const seen: ChatRequest[] = [];
		audit.onPayload = (_p, req) => seen.push(req);
		const a = provider('a', () => ({ content: 'ok' }));
		await route([{ provider: a.p, model: 'm' }], {
			messages: [{ role: 'user', content: 'Call me on +91 98220 12345, I am at 16.9902, 73.3120' }]
		});
		audit.onPayload = undefined;
		for (const body of [JSON.stringify(seen), JSON.stringify(a.calls)]) {
			expect(body).not.toMatch(/98220|12345|16\.9902|73\.3120/);
			expect(body).toContain('[number removed]');
			expect(body).toContain('[location removed]');
		}
	});
});

describe('scrub (CLAUDE.md §2: no phone numbers / location in LLM payloads)', () => {
	it.each([
		'9822012345',
		'+91 98220 12345',
		'+91-9822012345',
		'02352-222222',
		'(02352) 222 222',
		'0 2352 222222'
	])('removes phone %s', (p) => {
		expect(scrub(`call ${p} now`)).not.toMatch(/\d{4}/);
	});
	it('removes coordinates', () => {
		expect(scrub('at 17.2911,73.2054 or 16.99021')).toBe(
			'at [location removed] or [location removed]'
		);
	});
	it('keeps prices, times, dates, distances, short numbers', () => {
		const t = '₹1,500 for two, opens 09:30, on 2026-10-20, 3.5 km, room 12, 4.2 rating, ₹12000';
		expect(scrub(t)).toBe(t);
	});
});

describe('emergency keywords (BACKEND §11.6, draft list P8-3)', () => {
	it.each([
		'there was an accident on the ghat',
		'My son got a SNAKE BITE!',
		'lost child near the beach',
		'someone is drowning',
		'call an ambulance',
		'मुझे बचाओ',
		'सांप ने काटा है',
		'बच्चा खो गया',
		'साप चावला आहे',
		'मुलगा हरवला',
		'अपघात झाला',
		'आग लगी है',
		'bachao',
		'madat kara'
	])('triggers: %s', (t) => expect(isEmergency(t)).toBe(true));

	it.each([
		'best time to see fireflies?',
		'my fellow travellers want fish thali',
		'आगे कहाँ जाएं?',
		'पूरा दिन कहाँ घूमें?',
		'विषय: किल्ले',
		'fort timings tomorrow',
		'sunset point near Ganpatipule'
	])('does not trigger: %s', (t) => expect(isEmergency(t)).toBe(false));
});
