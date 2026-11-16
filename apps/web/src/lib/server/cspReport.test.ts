import { describe, expect, it } from 'vitest';
import { parseCspReports } from './cspReport.ts';

describe('CSP reports (SEC-10)', () => {
	it('reads the legacy format and keeps no tokens, queries or full blocked URLs', () => {
		const out = parseCspReports(
			JSON.stringify({
				'csp-report': {
					'document-uri': 'https://crabwalk.example/plan/share/abcdefghijklmnopqrstuv?x=secret',
					'effective-directive': 'img-src',
					'blocked-uri': 'https://evil.example/pixel.png?u=me'
				}
			})
		);
		expect(out).toEqual([
			{ directive: 'img-src', blocked: 'https://evil.example', page: '/plan/share/:id' }
		]);
		expect(JSON.stringify(out)).not.toMatch(/secret|abcdefghij|pixel|u=me/);
	});
	it('reads the Reporting API format and keeps inline/eval as is', () => {
		const out = parseCspReports(
			JSON.stringify([
				{
					type: 'csp-violation',
					body: {
						documentURL: 'https://crabwalk.example/stays',
						effectiveDirective: 'script-src-elem',
						blockedURL: 'inline'
					}
				},
				{ type: 'deprecation', body: {} }
			])
		);
		expect(out).toEqual([{ directive: 'script-src-elem', blocked: 'inline', page: '/stays' }]);
	});
	it('ignores junk', () => {
		expect(parseCspReports('not json')).toEqual([]);
		expect(parseCspReports('{"x":1}')).toEqual([]);
		expect(parseCspReports('null')).toEqual([]);
	});
});
