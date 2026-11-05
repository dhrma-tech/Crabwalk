import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('$app/env', () => ({ dev: true }));
vi.mock('$app/env/public', () => ({ DEV_BYPASS_AUTH: 'false' }));
vi.mock('$app/env/private', () => ({
	DEV_QUICK_LOGIN: 'true',
	DEV_LOGIN_ADMIN: 'admin@example.org',
	DEV_LOGIN_USER: 'user@example.org',
	DEV_LOGIN_PASSWORD: 'pw'
}));

const { quickLogin } = await import('#lib/devAuth.server.ts');

describe('quickLogin (dev one-click sign-in)', () => {
	afterEach(() => vi.unstubAllEnvs());

	it('gives both accounts on localhost in a dev build with the flag set', () => {
		expect(quickLogin('localhost')).toEqual({
			admin: 'admin@example.org',
			user: 'user@example.org',
			password: 'pw'
		});
		expect(quickLogin('127.0.0.1')).not.toBeNull();
	});

	it('is off on any other host', () => {
		for (const host of ['crabwalk.pages.dev', 'localhost.evil.com', '192.168.1.5', '[::1]'])
			expect(quickLogin(host)).toBeNull();
	});

	it('is off in a production build, even on localhost', () => {
		vi.stubEnv('PROD', true);
		expect(quickLogin('localhost')).toBeNull();
	});
});
