import { describe, expect, it, vi } from 'vitest';

// TODO(before-deploy): restore full auth — tests for the temporary admin email gate.
vi.mock('$app/env', () => ({ dev: true, building: false, browser: false }));
vi.mock('$app/env/public', () => ({
	SUPABASE_URL: 'http://127.0.0.1:54321',
	DEV_BYPASS_AUTH: 'false'
}));
vi.mock('$app/env/private', () => ({
	AUTH_MODE: 'temp_email_gate',
	ADMIN_EMAILS: ' Admin.One@Example.org , two@example.org,three@example.org ',
	ADMIN_SESSION_SECRET: 'test-secret-that-is-long-enough-123456',
	ADMIN_PASSCODE: 'kq7m-x2pt-9vhd-r4nw-c8ja',
	SUPABASE_SERVICE_ROLE_KEY: 'service-key'
}));

const gate = await import('./gate.ts');
const {
	ADMIN_COOKIE,
	ADMIN_TTL_MS,
	isAdminEmail,
	onAllowlist,
	parseAllowlist,
	signAdmin,
	verifyAdmin
} = gate;
const SECRET = 'test-secret-that-is-long-enough-123456';
const LIST = parseAllowlist('a@x.org, B@X.org');

const cookieEvent = (value?: string) =>
	({
		cookies: { get: (n: string) => (n === ADMIN_COOKIE ? value : undefined) }
	}) as never;

describe('admin allowlist', () => {
	it('accepts admin emails in any case and with spaces', () => {
		for (const e of [
			'admin.one@example.org',
			'ADMIN.ONE@EXAMPLE.ORG',
			'  Admin.One@Example.org  ',
			'\tTWO@example.org\n',
			'three@EXAMPLE.org'
		])
			expect(isAdminEmail(e)).toBe(true);
	});

	it('rejects any other email', () => {
		for (const e of [
			'someone@example.org',
			'admin.one@example.org.evil.com',
			'admin.one@example',
			'',
			'ADMIN_EMAIL_2'
		])
			expect(isAdminEmail(e)).toBe(false);
	});

	it('ignores placeholder entries without an @', () => {
		expect(parseAllowlist('a@x.org,ADMIN_EMAIL_2,,ADMIN_EMAIL_3')).toEqual(['a@x.org']);
		expect(onAllowlist('ADMIN_EMAIL_2', parseAllowlist('a@x.org,ADMIN_EMAIL_2'))).toBe(false);
	});
});

describe('team passcode', () => {
	const PASS = 'kq7m-x2pt-9vhd-r4nw-c8ja';
	it('needs an admin email AND the passcode', async () => {
		expect(await gate.adminCredentials(' Admin.One@Example.org ', PASS)).toBe(true);
		expect(await gate.adminCredentials('two@example.org', PASS)).toBe(true);
	});
	it('rejects a wrong passcode, a near miss and an empty one', async () => {
		for (const p of ['', 'kq7m-x2pt-9vhd-r4nw-c8jb', PASS + ' ', PASS.toUpperCase(), 'password'])
			expect(await gate.adminCredentials('two@example.org', p)).toBe(false);
	});
	it('rejects the right passcode with a non-admin email', async () => {
		expect(await gate.adminCredentials('someone@example.org', PASS)).toBe(false);
	});
	it('lets nobody in when no passcode is configured', async () => {
		expect(await gate.passcodeMatches('', undefined, 'k')).toBe(false);
		expect(await gate.passcodeMatches('x', '', 'k')).toBe(false);
		expect(await gate.passcodeMatches('x', 'x', 'k')).toBe(true);
	});
});

describe('signed admin cookie', () => {
	it('verifies for 7 days, then expires', async () => {
		const now = Date.UTC(2026, 10, 6);
		const c = await signAdmin(' B@x.org ', SECRET, now);
		expect(await verifyAdmin(c, SECRET, LIST, now + 1000)).toBe('b@x.org');
		expect(await verifyAdmin(c, SECRET, LIST, now + ADMIN_TTL_MS - 1)).toBe('b@x.org');
		expect(await verifyAdmin(c, SECRET, LIST, now + ADMIN_TTL_MS)).toBeNull();
		expect(await verifyAdmin(c, SECRET, LIST, now + ADMIN_TTL_MS + 86_400_000)).toBeNull();
	});

	it('rejects a tampered payload, a wrong secret and junk', async () => {
		const c = await signAdmin('a@x.org', SECRET);
		const [p, s] = c.split('.');
		const forged = btoa(JSON.stringify({ e: 'b@x.org', x: Date.now() + 1e9 }))
			.replace(/=+$/, '')
			.replace(/\+/g, '-')
			.replace(/\//g, '_');
		expect(await verifyAdmin(`${forged}.${s}`, SECRET, LIST)).toBeNull();
		expect(await verifyAdmin(c, 'another-secret', LIST)).toBeNull();
		for (const junk of [undefined, '', 'abc', `${p}.`, `.${s}`, `${p}.${s}.x`, 'a.b'])
			expect(await verifyAdmin(junk, SECRET, LIST)).toBeNull();
	});

	it('stops working once the email is taken off the allowlist', async () => {
		const c = await signAdmin('a@x.org', SECRET);
		expect(await verifyAdmin(c, SECRET, LIST)).toBe('a@x.org');
		expect(await verifyAdmin(c, SECRET, parseAllowlist('b@x.org'))).toBeNull();
	});

	it('gateAdmin reads the request cookie against this deployment', async () => {
		const ok = await signAdmin('two@example.org', SECRET);
		expect(await gate.gateAdmin(cookieEvent(ok))).toBe('two@example.org');
		expect(await gate.gateAdmin(cookieEvent())).toBeNull();
		const old = await signAdmin('two@example.org', SECRET, Date.now() - ADMIN_TTL_MS - 1);
		expect(await gate.gateAdmin(cookieEvent(old))).toBeNull();
		const outsider = await signAdmin('someone@example.org', SECRET);
		expect(await gate.gateAdmin(cookieEvent(outsider))).toBeNull();
	});
});

describe('admin APIs (server-side check)', () => {
	const ev = (cookie: string | undefined, path: string) =>
		({
			...(cookieEvent(cookie) as object),
			url: new URL(`http://localhost${path}`),
			params: { type: 'place', id: '00000000-0000-4000-8000-000000000001' },
			request: new Request(`http://localhost${path}`, { method: 'GET' }),
			locals: { getUser: async () => ({ id: 'u1' }) }
		}) as never;
	const status = async (p: unknown) => {
		try {
			await p;
			return 200;
		} catch (e) {
			return (e as { status?: number }).status ?? 500;
		}
	};

	it('reject a request with no admin cookie, an expired one or a forged one', async () => {
		const { GET } = await import('../../routes/api/admin/content/[type]/[id]/+server.ts');
		const path = '/api/admin/content/place/00000000-0000-4000-8000-000000000001';
		expect(await status(GET(ev(undefined, path)))).toBe(401);
		const expired = await signAdmin('two@example.org', SECRET, Date.now() - ADMIN_TTL_MS - 5);
		expect(await status(GET(ev(expired, path)))).toBe(401);
		const forged = (await signAdmin('two@example.org', 'wrong-secret')) as string;
		expect(await status(GET(ev(forged, path)))).toBe(401);
	});

	it('every admin content route checks the admin first', async () => {
		const mods = await Promise.all([
			import('../../routes/api/admin/content/[type]/+server.ts'),
			import('../../routes/api/admin/content/[type]/[id]/+server.ts'),
			import('../../routes/api/admin/content/[type]/[id]/photos/+server.ts'),
			import('../../routes/api/admin/content/reviews/+server.ts'),
			import('../../routes/api/admin/content/search/+server.ts'),
			import('../../routes/api/admin/tables/[table]/+server.ts'),
			import('../../routes/api/admin/tables/[table]/[id]/+server.ts')
		]);
		for (const mod of mods)
			for (const [method, fn] of Object.entries(mod))
				if (['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(method))
					expect(
						await status((fn as (e: never) => Promise<unknown>)(ev(undefined, '/api/admin/x'))),
						method
					).toBe(401);
	});

	it('admin pages send a visitor without the cookie to the email gate', async () => {
		const { adminEditor } = await import('./content.ts');
		try {
			await adminEditor(ev(undefined, '/admin/content'));
			expect.unreachable();
		} catch (e) {
			expect((e as { status: number; location: string }).status).toBe(303);
			expect((e as { location: string }).location).toBe('/me?admin=1');
		}
		const ok = await signAdmin('Admin.One@example.org', SECRET);
		expect(await adminEditor(ev(ok, '/admin/content'))).toBe('admin.one@example.org');
	});
});
