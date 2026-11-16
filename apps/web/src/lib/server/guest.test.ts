import { describe, expect, it, vi } from 'vitest';

// TODO(before-deploy): restore full auth — temp gate. Hardening 2026-11 (SEC-02): the server never creates a
// guest session; the browser does (lib/guest.client.ts, behind Turnstile) when a feature first needs one.
vi.mock('$app/env', () => ({ dev: true, building: false, browser: false }));
vi.mock('$app/env/public', () => ({ DEV_BYPASS_AUTH: 'false' }));
vi.mock('$app/env/private', () => ({
	AUTH_MODE: 'temp_email_gate',
	ADMIN_EMAILS: 'admin@example.org',
	ADMIN_SESSION_SECRET: 'test-secret-that-is-long-enough-123456',
	ADMIN_SESSION_EPOCH: ''
}));

const { guestGate } = await import('./guest.ts');
const { session, requireStaff } = await import('./auth.ts');
const { ADMIN_COOKIE, signAdmin } = await import('./gate.ts');

function event(opts: { user?: unknown; ua?: string; path?: string; cookie?: string } = {}) {
	const auth = {
		getUser: vi.fn(async () => ({
			data: { user: opts.user ?? null },
			error: opts.user ? null : {}
		})),
		signInAnonymously: vi.fn(async () => ({ data: { user: { id: 'anon-1' } }, error: null })),
		signOut: vi.fn(async () => ({ error: null }))
	};
	const path = opts.path ?? '/api/saved';
	const e = {
		url: new URL(`http://localhost${path}`),
		request: new Request(`http://localhost${path}`, {
			headers: {
				accept: 'text/html',
				'user-agent': opts.ua ?? 'Mozilla/5.0 (Linux; Android 14) Chrome/140'
			}
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
	it('a cookieless page view creates no account and no session', async () => {
		const { e, auth } = event({ path: '/' });
		await run(e);
		expect(await e.locals.getUser()).toBeNull();
		expect(auth.signInAnonymously).not.toHaveBeenCalled();
	});

	it('APIs answer 401 without a session (the browser then creates one and retries)', async () => {
		for (const path of ['/api/saved', '/api/trips', '/api/ai/chat', '/api/reviews']) {
			const { e, auth } = event({ path });
			await run(e);
			await expect(session(e)).rejects.toMatchObject({ status: 401 });
			expect(auth.signInAnonymously).not.toHaveBeenCalled();
		}
	});

	it('pages that need a session send the visitor to /guest and back, never to /login', async () => {
		const { e } = event({ path: '/plan/new' });
		await run(e);
		await expect(session(e)).rejects.toMatchObject({
			status: 303,
			location: '/guest?next=%2Fplan%2Fnew'
		});
	});

	it('an existing guest or real session is kept', async () => {
		for (const user of [
			{ id: 'anon-1', is_anonymous: true, app_metadata: {} },
			{ id: 'u-real', app_metadata: {} }
		]) {
			const { e, auth } = event({ user });
			await run(e);
			expect((await session(e)).user.id).toBe(user.id);
			expect((await session(e)).isAdmin).toBe(false);
			expect(auth.signOut).not.toHaveBeenCalled();
		}
	});

	it('a temp-admin session without a valid admin cookie is signed out', async () => {
		const { e, auth } = event({ user: { id: 'adm', app_metadata: { temp_admin: true } } });
		await run(e);
		expect(await e.locals.getUser()).toBeNull();
		expect(auth.signOut).toHaveBeenCalledTimes(1);
		expect(auth.signInAnonymously).not.toHaveBeenCalled();
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
		const guest = { id: 'anon-1', is_anonymous: true, app_metadata: {} };
		const page = event({ path: '/admin/review', user: guest });
		await run(page.e);
		await expect(requireStaff(page.e)).rejects.toMatchObject({
			status: 303,
			location: '/me?admin=1'
		});
		const api = event({ path: '/api/admin/places', user: guest });
		await run(api.e);
		await expect(requireStaff(api.e)).rejects.toMatchObject({ status: 403 });
	});
});
