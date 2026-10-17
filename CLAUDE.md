# CLAUDE.md — Crabwalk

Read every session. Project rules override general habits. If two rules conflict, the higher section wins.

## 1. Source of truth
- Execution order: `CRABWALK_PLAN.md`. What to build: `CRABWALK_BACKEND.md`, `CRABWALK_FRONTEND.md`.
- Locked decisions: `docs/Crabwalk Plan.md`, `docs/Crabwalk Design.md`. Decisions log: `docs/DECISIONS.md`.
- Tags: `[LOCKED]` build exactly · `[DEFAULT]` use unless overridden · `[OPEN]` ask first, never build.
- Spec silent on something → it is `[OPEN]`. Ask; don't fill the gap.

## 2. Hard rules (never break)
- ₹0 budget. No paid or card-required service. Need one → stop and ask.
- AI firewall: AI code never imports `services/ola-proxy`, never reads `OLA_*`, never receives Ola data.
- No Ola tiles. No server-side cache of Ola results.
- LLM never states facts not returned by our tools. No phone numbers or location history in LLM payloads.
- No OTA scraping. No on-platform payments. Sponsorship never touches rating, ranking or AI.
- No fake "live" data. No stock photos. No secrets in git.
- MVP scope = Ratnagiri. Product is Konkan-wide later. Don't hard-code "Ratnagiri" in logic or schema — keep region in data (taluka/region rows, env, config). Don't build multi-region features now.

## 3. Think before coding
- Before any non-trivial change, state in 3–5 lines: goal, files touched, assumptions, how you'll verify it.
- More than one reasonable reading of the spec → list them, ask. Don't pick silently.
- Spec contradicts itself or looks wrong → say so with file + section. Don't quietly "fix" the spec.
- Confused → name what's unclear and stop.

## 4. Simplicity
- Write the smallest code that meets the spec and its acceptance list.
- No unrequested features, abstractions, layers, or generic frameworks.
- No error handling for cases that can't happen; do handle real failures (network, 429, offline, GPS denied).
- Exception: config tables, flags, adapters and provider interfaces the spec names ARE required, not over-engineering — e.g. `correction_factors`, `AGODA_ENABLED`, `TIDE_PROVIDER`, the LLM router, Sarvam-ready provider interface, `<CategoryIcon>` / `<Crabby>` placeholder wrappers.
- If a file grows far past what the task needs, simplify before moving on.

## 5. Surgical changes
- Touch only what the current task needs. No drive-by refactors, renames, or reformatting of unrelated code.
- Never edit outside the current phase's scope. Found a bug elsewhere → note it in `docs/DECISIONS.md` under "Found issues", don't fix unasked.
- Never change the spec files unless I ask.
- Migrations are append-only once pushed. New change = new migration.

## 6. Goal-driven execution
- Each task's success = its phase acceptance checklist + tests passing. Write/extend the test first when practical.
- Verify by running, not by reading: lint, typecheck, test, build. Report actual output on failure.
- Done means: checklist items ticked with evidence (command output, file path), not "should work".

## 7. Phase workflow
- One phase at a time. Phases never overlap.
- End of phase: run §3 git protocol in `CRABWALK_PLAN.md` → push `main` → tag `phase-N` → log in `DECISIONS.md` → stop.
- Report: built, acceptance results, commit hash, deferred items. Wait for my "go".
- Never `git push --force`. Never skip a failing check.

## 8. Efficiency (token + time)
- Read only files the task needs; use search before opening large files.
- Don't re-read files you just wrote. Don't paste large files back to me.
- Replies: short, precise, no filler, no sugarcoating. Code over prose.
- Batch related edits; avoid many tiny tool calls.

## 9. Environment
- OS: Windows. Repo: `E:\CODEBASE\Crabwalk`. Use PowerShell-safe commands (`curl.exe`, not `curl`).
- Package manager per `DECISIONS.md` (default pnpm).
