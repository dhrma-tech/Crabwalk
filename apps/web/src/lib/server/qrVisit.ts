// Scan token for "Verify visit" (hardening 2026-11, SEC-03). GET /q/:code hands the browser a signed, httpOnly
// cookie; POST /q/:code/visit only verifies a visit for a browser that loaded that scan page in the last
// 30 minutes. Token = <code>.<issuedAtMs>.<HMAC-SHA256(RATE_LIMIT_SALT, code.issuedAtMs.scanSessionId)>.
import { hmac } from './rate.ts';

export const VISIT_COOKIE = 'cw_qv';
export const VISIT_TTL_S = 30 * 60;

export const signVisit = async (code: string, sessionId: string, now = Date.now()) =>
	`${code}.${now}.${await hmac(`${code}.${now}.${sessionId}`)}`;

/** True for a token issued for this code and this scan session, at most 30 minutes ago. */
export async function checkVisit(
	token: string | undefined,
	code: string,
	sessionId: string | undefined,
	now = Date.now()
) {
	if (!token || !sessionId) return false;
	const [c, at = '', mac = '', ...rest] = token.split('.');
	if (rest.length || c !== code || !/^[0-9]{13}$/.test(at) || !/^[0-9a-f]{64}$/.test(mac))
		return false;
	const age = now - Number(at);
	if (age < 0 || age > VISIT_TTL_S * 1000) return false;
	const want = await hmac(`${code}.${at}.${sessionId}`);
	// Constant-time compare of two 64-character hex strings.
	let diff = 0;
	for (let i = 0; i < want.length; i++) diff |= want.charCodeAt(i) ^ mac.charCodeAt(i);
	return diff === 0;
}
