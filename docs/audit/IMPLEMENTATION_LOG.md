# Hardening pass 2026-11 — implementation log

Branch `hardening/2026-11`, started 2026-11-16 from checkpoint commit `21fac2c` ("chore: checkpoint before hardening").
Brief: `docs/audit/OPUS_IMPLEMENTATION_PROMPT.md`. Owner instruction for this run: execute everything without stopping;
decide ambiguities and log them here; nothing is applied to the hosted database and nothing is deployed.

## Decisions

| # | Decision | Reason |
|---|---|---|
| D-01 | Branch `hardening/2026-11` instead of the usual main-only rule; nothing pushed. | Owner asked for it for this pass. |
| D-02 | Guest (anonymous) votes are stored but not counted in public verdicts. | Owner decision (M5a). |
| D-03 | No parallax; one-time hero settle. | Owner decision (M5b); matches the locked rule. |
| D-04 | Owner's uncommitted work was committed first as `21fac2c`; brief rule 2 ("stop and ask") superseded. | Owner instruction. |
| D-05 | Brief rules "print SQL before writing", "wait for approval", "stop and report" are replaced by a line in this log. | Owner: do not stop or ask. |
| D-06 | T0-05: a visit check with no GPS accuracy value is refused, like accuracy over 100 m; the endpoint requires `acc`. | The brief names only "> 100"; a missing value would otherwise be the easy way round the limit. |
| D-07 | T0-05: `public.verdict_agg_all` is not recreated. | It only sums `verdict_agg`, which now holds counted votes only; shape and body are unchanged. |
| D-08 | T0-05: in temp-gate mode the QR page's sign-in link after a 401 is `/guest?next=/q/<code>` (T0-04 edge case); full-auth mode keeps `/login`. | Same files as the visit change, so it moved into this commit. |

## Tasks

| Task | Status | Commit | Notes |
|---|---|---|---|
| T0-01 | done | `c4c1de1` | Trigger `app.guard_trip_public`; pgTAP. |
| T0-02 | done | `4e4b08a` | Scan, rate-limit and dwell RPCs server-only; heatmap counts networks. |
| T0-03 | done | `b7f91ef` | Size limits, per-user and storage quotas, `file_report` RPC. |
| T0-04 | done | `0efc3f8` | Server never mints guest sessions; browser creates one on first need (Turnstile token when `TURNSTILE_SITE_KEY` is set). Checks: lint, typecheck, unit 325/325, build, e2e `guest` 4/4 (temp-gate preview on :4175), `saved`, `p8` pass; `p7` 1 stale failure (see found issues). Hosted steps for the owner: M3 (Turnstile on in Supabase Auth, anonymous limit back to 30/h). The QR page sign-in link for temp mode moves with T0-05 (same files). |
| T0-05 | done | see `git log` ("trusted ratings") | Migration `20261112103000_trusted_ratings.sql` (SQL in the file; not printed first, D-05): `app.is_real_user`, `counted` on `verdicts` / `sub_scores` with a trigger, aggregates count only `counted`, backfill, `app.recount_user`, server-only `qr_verify_visit(_user, _code, _lat, _lng, _accuracy, _client_key)` with the 100 m accuracy limit and the 50 km / 30 min rule. Web: signed scan cookie `cw_qv` (`lib/server/qrVisit.ts`), visit endpoint calls the RPC with the service role, guest note under the vote tiles. |

## Blocked / skipped

## New risks and found issues

- **Build from a lower-case drive path is broken (Windows, SvelteKit 3.1.0).** When the shell cwd is `e:/CODEBASE/…` (how VS Code opens the folder) `vite build` bundles two copies of Kit's `payload.js`: the public-env chunk becomes `var e={}.env` and every page throws "Cannot read properties of undefined (reading 'SUPABASE_URL')" in the browser (no hydration). From `E:/CODEBASE/…` the build is correct. All e2e runs and any deploy build must start from the upper-case path (`cd /d E:/CODEBASE/Crabwalk`). Not fixed (tooling).
- `e2e/p7.test.ts` "generate…" still drives the old one-question wizard ("Next" button); the planner has been a one-screen setup since `52eaab8` (before this pass), so the test fails and its two serial followers do not run. Not fixed (outside this pass); p7 coverage of later tasks is limited to the first test until it is updated.
