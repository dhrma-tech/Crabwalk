import { describe, expect, it, vi } from 'vitest';

// TODO(before-deploy): restore full auth — guests use every feature without signing in (temp gate).
vi.mock('$app/env', () => ({ dev: true, building: false, browser: false }));
vi.mock('$app/env/public', () => ({ DEV_BYPASS_AUTH: 'false' }));
vi.mock('$app/env/private', () => ({
	AUTH_MODE: 'temp_email_gate',
	ADMIN_EMAILS: 'admin@example.org',
	ADMIN_SESSION_SECRET: 'test-secret-that-is-long-enough-123456'
}));

const { guestGate } = await import('./guest.ts');
const { session, requireStaff } = await import('./auth.ts');
const { ADMIN_COOKIE, signAdmin } = await import('./gate.ts');

const GUEST = { id: 'anon-1', is_anonymous: true, app_metadata: {} };

function event(opts: { user?: unknown; ua?: string; path?: string; cookie?: string } = {}) {
	const auth = {
		getUser: vi.fn(async () => ({
			data: { user: opts.user ?? null },
			error: opts.user ? null : {}
		})),
		signInAnonymously: vi.fn(async () => ({ data: { user: GUEST }, error: null })),
		signOut: vi.fn(async () => ({ error: null }))
	};
	const path = opts.path ?? '/api/saved';
	const e = {
		url: new URL(`http://localhost${path}`),
		request: new Request(`http://localhost${path}`, {
			method: 'POST',
			headers: { 'user-agent': opts.ua ?? 'Mozilla/5.0 (Linux; Android 14) Chrome/140' }
		}),
		cookies: { get: (n: string) => (n === ADMIN_COOKIE ? opts.cookie : undefined) },
		locals: {
			supabase: { auth, from: () => ({ select: () => ({ eq: async () => ({ data: [] }) }) }) },
			getUser: async () => {
				const { data } = await auth.getUser();
				return data.user;
			}
		}
	};
	return { e: e as never as Parameters<typeof session>[0] & { locals: App.Locals }, auth };
}
const run = async (e: unknown) => {
	await guestGate({ event: e as never, resolve: async () => new Response('ok') });
};

describe('guest access (temp gate)', () => {
	it('a visitor with no session gets a guest session the first time a feature asks', async () => {
		const { e, auth } = event();
		await run(e);
		expect(auth.signInAnonymously).not.toHaveBeenCalled(); // POST: nothing until asked
		const s = await session(e);
		expect(s.user.id).toBe('anon-1');
		expect(s.isAdmin).toBe(false);
		await session(e);
		expect(auth.signInAnonymously).toHaveBeenCalledTimes(1); // once per request
	});

	it('saves, trips and chat endpoints get a user instead of 401 / a login redirect', async () => {
		for (const path of ['/api/saved', '/api/trips', '/api/ai/chat', '/api/reviews', '/plan/new']) {
			const { e } = event({ path });
			await run(e);
			await expect(session(e)).resolves.toMatchObject({ user: { id: 'anon-1' } });
		}
	});

	it('a page view starts the guest session up front (client checks see the cookie)', async () => {
		const { e, auth } = event({ path: '/' });
		(e as unknown as { request: Request }).request = new Request('http://localhost/', {
			headers: { accept: 'text/html', 'user-agent': 'Mozilla/5.0 Chrome/140' }
		});
		await run(e);
		expect(auth.signInAnonymously).toHaveBeenCalledTimes(1);
	});

	it('crawlers get no account', async () => {
		const { e, auth } = event({ ua: 'Googlebot/2.1 (+http://www.google.com/bot.html)' });
		await run(e);
		expect(await e.locals.getUser()).toBeNull();
		expect(auth.signInAnonymously).not.toHaveBeenCalled();
	});

	it('an existing session is kept', async () => {
		const { e, auth } = event({ user: { id: 'u-real', app_metadata: {} } });
		await run(e);
		expect((await session(e)).user.id).toBe('u-real');
		expect(auth.signInAnonymously).not.toHaveBeenCalled();
	});

	it('a temp-admin session without a valid admin cookie is signed out and becomes a guest', async () => {
		const { e, auth } = event({ user: { id: 'adm', app_metadata: { temp_admin: true } } });
		await run(e);
		expect((await session(e)).user.id).toBe('anon-1');
		expect(auth.signOut).toHaveBeenCalled();
	});

	it('the admin keeps the session while the cookie is valid, with full staff roles', async () => {
		const cookie = await signAdmin('admin@example.org', 'test-secret-that-is-long-enough-123456');
		const { e, auth } = event({ user: { id: 'adm', app_metadata: { temp_admin: true } }, cookie });
		await run(e);
		const s = await session(e);
		expect(s).toMatchObject({
			user: { id: 'adm' },
			isAdmin: true,
			isReviewer: true,
			isVerifier: true
		});
		expect(auth.signOut).not.toHaveBeenCalled();
	});

	it('staff pages send guests to the email gate, staff APIs answer 403', async () => {
		const page = event({ path: '/admin/review' });
		await run(page.e);
		await expect(requireStaff(page.e)).rejects.toMatchObject({
			status: 303,
			location: '/me?admin=1'
		});
		const api = event({ path: '/api/admin/places' });
		await run(api.e);
		await expect(requireStaff(api.e)).rejects.toMatchObject({ status: 403 });
	});
});
