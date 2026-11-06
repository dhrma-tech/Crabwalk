# Restore full auth (before deploy)

The temporary access gate (`AUTH_MODE=temp_email_gate`, 2026-11-06) replaces sign-in while the team checks the data. Every change point carries `TODO(before-deploy): restore full auth`. Find them all with:

```
git grep -n "TODO(before-deploy): restore full auth"
```

## What the gate does

- **Guests:** no sign-in anywhere. The first page view gives the visitor a Supabase **anonymous** session (crawlers excluded). Saves, trips, the planner, group chat, votes, reviews, journal and the Crabby daily cap all run under RLS exactly as for a signed-in user. Their data is tied to that browser.
- **Admins:** "Sign in" on Me opens a sheet with an email field and the team passcode. The server checks `ADMIN_EMAILS` **and** `ADMIN_PASSCODE`, sets a signed httpOnly cookie (`cw_admin`, HMAC with `ADMIN_SESSION_SECRET`, 7 days), and starts a real Supabase session for that email (created on first use, `app_metadata.temp_admin = true`, an `admin` row in `user_roles`). Every admin page and API checks the cookie server-side. When the cookie is missing, expired or off the list, that session is signed out on the next request.
- 10 failed tries from one client lock it out for an hour (`gate_attempts`); the per-client rate limit (10 tries / 10 min) applies too.
- The whole site is `noindex`: `X-Robots-Tag: noindex, nofollow` on every response, a robots meta tag, and `robots.txt` → `Disallow: /`.
- `/login` redirects to `/me?admin=1`; its OTP and Google actions return 404.

## Step 1: flip the flag

In the deployed env (and `.env.local`):

```
AUTH_MODE=full
```

With `full`, every gate branch is off and the normal login, `session()` roles, `/login` and the sign-out button come back unchanged. The admin content editor keeps working for users with the `admin` role.

## Step 2: remove the env vars

- `ADMIN_EMAILS`
- `ADMIN_SESSION_SECRET`
- `ADMIN_PASSCODE`

Hosted: Cloudflare dashboard → Workers & Pages → `crabwalk` → Settings → Variables and Secrets (or `npx wrangler pages secret delete <NAME> --project-name crabwalk`), then redeploy.

(`SUPABASE_SERVICE_ROLE_KEY` stays: the admin editor writes with it after the admin check.)

## Step 3: Supabase Auth

1. Turn **anonymous sign-ins off**: Dashboard → Authentication → Sign In / Providers → "Allow anonymous sign-ins". Locally, set `enable_anonymous_sign_ins = false` in `supabase/config.toml`.
2. Optional clean-up of guest accounts (their saves and trips go with them):
   `delete from auth.users where is_anonymous;` (needs your go-ahead, it deletes data).
3. Temp admin accounts: decide per email whether it keeps the `admin` role. Remove the flag:
   `update auth.users set raw_app_meta_data = raw_app_meta_data - 'temp_admin' where raw_app_meta_data ? 'temp_admin';`
   and remove unwanted role rows from `user_roles`.

## Step 4: remove the code (optional, after step 1 works)

| File | Change to undo |
|---|---|
| `apps/web/src/lib/server/gate.ts` | delete (allowlist, cookie signing) |
| `apps/web/src/lib/server/guest.ts` | delete (anonymous guest sessions) and its line in `hooks.server.ts` |
| `apps/web/src/lib/server/adminSession.ts` | delete |
| `apps/web/src/routes/auth/admin/+server.ts` | delete |
| `apps/web/src/routes/+layout.server.ts` | delete (gate state for the header) |
| `apps/web/src/lib/components/AdminGate.svelte`, `AdminBadge.svelte` | delete; remove from `TopBar.svelte` and `routes/me/+page.svelte` |
| `apps/web/src/lib/server/auth.ts` | remove the `tempGate()` branches in `session()` / `requireStaff()` |
| `apps/web/src/lib/server/content.ts` | `adminEditor()`: keep only the `requireStaff(event, 'admin')` path |
| `apps/web/src/routes/me/+page.server.ts` | remove `gate` / `admin` lines (`isStaff` back to roles only) |
| `apps/web/src/routes/login/+page.server.ts` | remove the four `tempGate()` lines |
| `apps/web/src/lib/server/rate.ts` | remove the `admin-gate` rule (`clientKey()` can stay) |
| `apps/web/src/hooks.server.ts`, `routes/robots.txt/+server.ts`, `routes/+layout.svelte` | remove the temp-gate `noindex` branches (the site becomes indexable again) |
| `supabase` | `gate_attempts`, `gate_locked`, `gate_record` (migration `20261107100000`) are unused once the gate is gone; leave them or drop them in a new migration |
| `apps/web/src/env.ts`, `.env.example` | remove `AUTH_MODE`, `ADMIN_EMAILS`, `ADMIN_SESSION_SECRET`, `ADMIN_PASSCODE` |
| `apps/web/messages/*.json` | remove the `gate_*` keys |
| `apps/web/src/lib/server/gate.test.ts`, `guest.test.ts` | delete |

The `hooks.server.ts` change that memoises `getUser()` per request is independent and can stay.

## Step 5: check

`pnpm lint && pnpm typecheck && pnpm test && pnpm build`, then sign in with email OTP and Google, open `/admin`, and check a signed-out visitor gets the normal sign-in prompts again.
