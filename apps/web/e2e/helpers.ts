// Shared e2e helpers for the local stack (E2E_SUPABASE=local).
import { expect, type Browser, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';

export const psql = (sql: string) =>
	execFileSync('docker', ['exec', 'supabase_db_crabwalk', 'psql', '-U', 'postgres', '-qtAc', sql], {
		encoding: 'utf8'
	}).trim();

/** Email-OTP sign-in through the real UI; the 6-digit code is read from local Mailpit. */
export async function signIn(page: Page, email: string) {
	await page.goto('/login');
	await page.getByLabel('Email').fill(email);
	await page.getByRole('button', { name: 'Send code' }).click();
	await expect(page.getByLabel('6-digit code')).toBeVisible();
	let code = '';
	for (let i = 0; i < 30 && !code; i++) {
		const s = await (
			await fetch(
				`http://127.0.0.1:54324/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}`
			)
		).json();
		if (s.messages?.[0]) {
			const msg = await (
				await fetch(`http://127.0.0.1:54324/api/v1/message/${s.messages[0].ID}`)
			).json();
			code = (msg.Text as string).match(/\b(\d{6})\b/)?.[1] ?? '';
		}
		if (!code) await page.waitForTimeout(500);
	}
	await page.getByLabel('6-digit code').fill(code);
	await page.getByRole('button', { name: 'Verify code' }).click();
	await expect(page.getByText(`Signed in as ${email}`)).toBeVisible();
}

export async function userWithRole(browser: Browser, email: string, role: 'verifier' | 'reviewer') {
	const ctx = await browser.newContext();
	const page = await ctx.newPage();
	await signIn(page, email);
	psql(
		`insert into user_roles (user_id, role, taluka_id)
		 select u.id, '${role}', ${role === 'verifier' ? `(select id from talukas where name_en = 'Ratnagiri')` : 'null'}
		 from auth.users u where u.email = '${email}' on conflict do nothing`
	);
	return { ctx, page };
}
