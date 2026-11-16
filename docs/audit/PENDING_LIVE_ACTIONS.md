# Pending live actions (owner only)

Nothing in the hardening pass touched the hosted Supabase project, Cloudflare, or any real key. Everything below is
for the owner to do by hand, in this order. Each migration's exact SQL is the file named; read it before applying.

## A. Before applying anything

1. Back up the hosted database: `pnpm db:backup` (keep the folder off the repo).
2. Audit ready-made trips: `select id, owner_id, title, slug from public.trips where is_ready_made;` — unset any row
   the team did not create (`update public.trips set is_ready_made = false, slug = null where id = '<id>';`).

## B. Migrations to apply to hosted, in this order

Apply with `supabase db push` after reading each file (timestamps give the order; `db push` keeps it).

| # | File | What it does | Pre-check on hosted |
|---|---|---|---|
| 1 | `supabase/migrations/20261111100000_auto_entry_codes.sql` | Owner's own migration (in the checkpoint commit) | Confirm whether it is already applied: `supabase migration list` |
| 2 | `supabase/migrations/20261112100000_guard_trip_public.sql` | SEC-01 trigger: only staff / service role set `is_ready_made`, `slug`, `owner_id` on trips | Step A.2 |

## C. Dashboard, env and secret steps

