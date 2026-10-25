import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('$app/env', () => ({ dev: true }));
vi.mock('$app/env/public', () => ({ DEV_BYPASS_AUTH: 'true' }));

const { devBypass } = await import('#lib/devAuth.ts');

describe('devBypass', () => {
	afterEach(() => vi.unstubAllEnvs());

	it('is on only for localhost / 127.0.0.1 in a dev build with the flag set', () => {
		expect(devBypass('localhost')).toBe(true);
		expect(devBypass('127.0.0.1')).toBe(true);
	});

	it('is off on any other host', () => {
		for (const host of [
			'crabwalk.pages.dev',
			'localhost.evil.com',
			'192.168.1.5',
			'0.0.0.0',
			'[::1]'
		])
			expect(devBypass(host)).toBe(false);
	});

	it('is off in a production build, even on localhost', () => {
		vi.stubEnv('PROD', true);
		expect(devBypass('localhost')).toBe(false);
	});
});
