# Prompt for Claude Code: Crabwalk "Tideline" redesign + gap closure

> Paste this whole file into Claude Code at the repo root (`E:\CODEBASE\Crabwalk`), or say: "Read `docs/reports/03-claude-code-prompt.md` and follow it."
> It drives the work. The detail lives in `docs/reports/01-gaps-fixes-improvements.md` (Report 1) and `docs/reports/02-ui-redesign-tideline.md` (Report 2). Read both fully before you start.

---

## 0. Your role

You are the sole engineer on Crabwalk, a SvelteKit 3 + Svelte 5 + Tailwind v4 PWA on Cloudflare Pages with Supabase. The product works and is well tested. Your job:
1. Land the pending work safely.
2. Replace the current "Suna" UI with the **Tideline** design system (Report 2) across every screen.
3. Close the gaps and fixes in Report 1 that I approve.
4. Leave the repo ready for the guided production deploy.

You have **room to make good calls**. Report 2 is a design system, not a pixel spec. Where it is silent, design in its spirit: neutral first, one kokum action, lagoon for info, soft radii, photo-led, quiet motion. Do it, then record the choice in `docs/DECISIONS.md`. What you may **not** do is break the hard rules, change locked behaviour, or build `[ASK]` items without my answer.

---

## 1. Read first (in this order, search before opening big files)

1. `CLAUDE.md` (rules override habits; the higher section wins)
2. `docs/reports/01-gaps-fixes-improvements.md`, `docs/reports/02-ui-redesign-tideline.md`
3. `docs/DECISIONS.md` (especially P10a-*, R-*, P10-*, Found issues, Phase log)
4. `CRABWALK_FRONTEND.md` §6–§7, §10–§14 (component behaviour, locked screen order, i18n, perf, honest UI, tests). **Ignore §2/§3 values and §8 colours**: tokens now come from Report 2.
5. `AUDIT.md`, `docs/DEPLOY.md`
6. Code: `apps/web/src/app.css`, `src/routes/+layout.svelte`, `src/lib/components/**`, `src/lib/map/style.ts`, `src/lib/qr/page.ts`, `scripts/subset-fonts.mjs`, `src/lib/contrast.test.ts`, `static/manifest.webmanifest`, `static/icons/`.

---

## 2. Non-negotiables (from CLAUDE.md §2, plus this work)

- ₹0: no paid or card-required service, and no new runtime dependency for visuals (CSS + inline SVG only). Any new dependency → ask.
- AI firewall, no Ola tiles, no server cache of Ola, no fake "live", no stock or unlicensed photos, no secrets in git, no payments, sponsorship never touches rating/ranking/AI.
- Region lives in data. Never hard-code "Ratnagiri".
- **Locked screen section order (FRONTEND §7) stays.** You restyle and re-lay-out within it; you don't reorder.
- Honest-UI rules (FRONTEND §13) on every screen. Emergency red only in emergency UI. Crabby never on safety UI.
- QR page: < 100 KB, system fonts, ≤ 1 inline script, works without JS (C14/P6-1/P6-9).
- Performance: shell JS < 200 KB gz, fonts ≤ 4 files with the Latin/Devanagari split, LCP < 2.5 s target, MapLibre only on map/navigate/plan.
- WCAG 2.2 AA. Every colour pair in Report 2 §3.4 must be asserted in `contrast.test.ts`.
- Migrations are append-only. Spec files stay untouched. Out-of-scope bugs go to DECISIONS "Found issues", not into drive-by fixes.
- Windows/PowerShell-safe commands (`curl.exe`). Package manager: pnpm. Never `git push --force`. Never skip a failing check.

---

## 3. Before writing code: ask me once, in one message

Use AskUserQuestion (batch it, up to 4 per call). Show your recommended option first. Log every answer in `docs/DECISIONS.md` under a new section **"Tideline redesign (phase-10b)"** with refs `T-1…`.

| Ref | Question | Your recommended default |
|---|---|---|
| T-Q1 | Adopt **Tideline** (Report 2) and overwrite P10a-1/3/5 visuals? | Yes |
| T-Q2 | Display font: **Eczar** or Poppins fallback? (Decide after the D2 render, see below; ask then, not now.) | Eczar |
| T-Q3 | Laptop nav: persistent **top nav** + collapsible Crabby panel (overrides P10a-4)? | Yes |
| T-Q4 | Place page **sticky action bar** (Directions · Add to trip · Save · Share)? (Report 1 §3.9) | Yes |
| T-Q5 | **Saved places**: new `saved_items` table + API + Me section? (Report 1 §2.1) | Yes |
| T-Q6 | Content: desk-entry mode + **CSV importer** + `verification_method`/`source_urls` columns + "Checked online" vs "Visited" labels? (Report 1 §1.4–1.5) | Yes |
| T-Q7 | Photos: own photos + **CC-licensed with credit** (`credit`, `licence`, `source_url` on `photos`), never unlicensed web images? (Report 1 §1.6) | Yes |
| T-Q8 | Branch: work on `redesign/tideline` cut from `refinement` (after landing it), merge via PR, tag `phase-10b`? | Yes |

Anything else you find that is `[OPEN]`, ask with your recommendation. Don't guess.

---

## 4. Work plan (one phase at a time; finish each with its checks green)

Each step lists **goal → main files → acceptance**. Before every non-trivial step, write your 3–5 line plan (goal, files, assumptions, how you'll verify), per CLAUDE.md §3.

### Step A: Land pending work (Report 1 §1.1–1.2)
- Decide `.vscode/` (gitignore, or commit only `extensions.json`).
- Split `lib/devAuth.ts` into `devAuth.server.ts` (hook, DEV_ROLES, devBypass) and `devAuth.client.ts` (toast + fetch wrapper). Add a unit test that `devBypass` is false for PROD or a non-local host. Add a CI step that fails if a committed env file sets `DEV_BYPASS_AUTH=true`.
- Commit in logical commits (dev bypass; Discover card grid; R-8 log). Push `refinement`, open a PR to `main`, merge when CI is green. Then cut `redesign/tideline`.
- **Accept:** clean tree, CI green, `main..refinement` = 0.

### Step B: Safety net fixes that touch no UI (Report 1 §3.1–3.3)
- New migration: `alter default privileges in schema public revoke execute on functions from public;` plus a pgTAP test that enumerates every `SECURITY DEFINER` function in `public` and checks anon/public EXECUTE against an explicit allowlist.
- e2e: wait for `serviceWorker.ready` + controller before going offline; add a `pree2e` step that frees :4173 on Windows.
- **Accept:** `pnpm run test`, `supabase test db`, `playwright test` green twice in a row.

### Step C: Design tokens + fonts (Report 2 §3–§5)
- Rewrite `app.css` tokens (light + dark + manual override), the Tailwind `@theme` mapping (keep "default palette removed"), the type utilities (`type-display-xl` … `type-label`), the radii, elevation (`shadow-e1/e2/e3`), glass, the motion tokens, the z-layers (keep the names), and the `row-link` replacement.
- Fonts: fetch Eczar 700 and Anek Latin/Devanagari (variable) from the google/fonts OFL sources, instance Anek `wdth=100`, subset via `scripts/subset-fonts.mjs` (same `unicode-range` split), keep `OFL.txt`. Update `@font-face`, `lib/map/style.ts` font-faces, and the preload of the Latin display file. Remove the Shippori/Zen/Noto files and the 蟹 glyph.
- Rewrite `contrast.test.ts` to Report 2 §3.4 (text ≥ 4.5; UI, graphics, pins ≥ 3; both themes).
- **Accept:** lint, typecheck, unit, build green; font files ≤ 4 weights split by script; sizes reported; contrast tests pass.

### Step D: Shell + core components (Report 2 §6–§8)
- D1: `TopBar` (transparent → solid on scroll), floating phone `AppNav` with the raised Crabby, laptop top nav (if T-Q3 = yes) and the collapsible docked Crabby, `LanguageSwitch` as a segmented pill, `OfflineBanner`, `Toaster`, the View Transitions hook in `+layout.svelte` (progressive, reduced-motion aware), the wordmark placeholder (`BrandMark`), the new `Crabby` SVG (idle / walking / waving), and new PWA icons (`static/icons/`, regenerate once and commit), `manifest.webmanifest` + `theme-color` metas per scheme.
- D2: `Button`, `Chip`, segmented control (new, if none exists), `Input` (focus = border rule), `ListingCard` → photo-led cards with glass badges, the hero carousel card, the inset list row, `NoPhoto` → the designed category card, `StatusBadge`, `Skeleton`, `EmptyState`/`ErrorState` with the illustrations, `BottomSheet`, `VerdictGauge`, `VerdictVote`, `SubScores`, `MiniVerdict`, `AudioGuide`, `TideSlider`, `Facts`, `PriceTable`, `EmergencyCard` (rules unchanged), Crabby chat bubbles + `ActionPreviewCard`.
- Update `/dev/components` to show every component in every state, in EN/MR, light/dark. Refresh screenshot baselines.
- **Font check (T-Q2):** render Discover + Place with Eczar and with the Poppins fallback, take screenshots at 360 and 1280, show me both, and ask. Default to Eczar if I don't answer.
- **Accept:** gallery renders all states; the longest Marathi strings don't clip (`data-clip-check`); axe has no violations; snapshots updated.

### Step E: Screens (Report 2 §9, in this order)
Discover → Place → Map (+ map style per Report 2 §10) → Stays list/detail → Food list/detail → Taste Konkan → Itineraries/Start → Planner wizard → Plan view → Share/Vote → Live trip → Navigate → Crabby → Me → Login → Privacy → Owner → Admin (tool variant) → QR page (inline CSS restyle, budget kept) → 404/error.
- Keep each screen's locked section order. Laptop layouts per Report 2 (the two-column detail pages close the P10a deferral).
- The "Today on the coast" strip uses **only cached real data** (weather_cache, tide data, season/events) with timestamps and attribution; it hides if data is missing.
- Replace raw `text-[Npx]` / `w-[Npx]` with tokens. Move secondary text to ≥ 14 px (Report 1 §3.6–3.7).
- **Accept per screen:** 360/768/1024/1440 px with no horizontal scroll, 44 px targets, axe clean, EN/HI/MR, light/dark, and e2e still green.

### Step F: Functional gaps (only the approved ones)
- QR page: active alerts within ~2 km in the safety block (severity dot, reported time, expiry), and replace the inline-script `alert()` with `aria-live` status text. Keep < 40 KB HTML (CI test). (Report 1 §2.2–2.3)
- Skeletons on client-fetched areas (Report 1 §2.4).
- If T-Q4: place-page action bar (Directions → `/navigate?to=`, Add to trip → existing trip edit/planner, Save, Share via Web Share with a copy-link fallback).
- If T-Q5: `saved_items` migration + RLS (own rows) + pgTAP + `/api/saved` + heart on every card (optimistic, guest → sign in with `?next`) + Me "Saved" + service-worker no-cache for the user's own data.
- If T-Q6: `/admin/field` desk mode (manual lat/lng or map pick, file upload); `pipelines/content-import` (CSV template + validation with Zod, dry run by default, `--live` writes `content_drafts`, idempotent by slug, report of rejected rows); migration `verification_method` + `source_urls`; StatusBadge "Visited" vs "Checked online". Commit a template CSV in `pipelines/content-import/template.csv`.
- If T-Q7: `photos.credit`, `licence`, `source_url` columns, required for non-own photos; credit line under hero images; field/review form inputs.
- Any new UI string: EN + drafted HI/MR, added to `messages/NEEDS_REVIEW.md`.
- **Accept:** a unit/DB/e2e test per feature; RLS tests for any new table; the AI firewall check still passes.

### Step G: Polish + verification (the definition of done for this phase)
- Map perf (Report 1 §3.4): create overlay layers lazily on toggle, `fadeDuration: 0`, render the sheet/list before map init. Re-measure.
- Run everything: `pnpm run lint`, `pnpm run typecheck`, `pnpm run test`, `pnpm run build`, `pnpm exec supabase test db`, `pnpm --filter @crabwalk/web exec playwright test` (free :4173 first), and Lighthouse mobile + desktop on `/`, `/place/:slug`, `/stays`, `/map`.
- **Targets:** Perf ≥ 90 (map excepted, report its number), A11y 100, Best practices 100, SEO 100; QR < 100 KB transfer; shell JS < 200 KB gz; font bytes reported.
- Update `AUDIT.md` (Lighthouse before/after), `README.md` (design system line), and `docs/DECISIONS.md` (T-* decisions, a Found issues entry for anything out of scope, a Phase log row `phase-10b`).
- Git: per CLAUDE.md §7 and PLAN §3 (gitleaks, no secrets), PR `redesign/tideline` → `main`, tag `phase-10b`, push the tag.
- **Report back:** what was built, acceptance evidence (command output summaries, file paths), screenshots of Discover/Place/Map/Plan at 360 and 1280 (light + dark), commit hash, and what was deferred. Then stop and wait for my "go" for the guided deploy (Report 1 §1.3).

---

## 5. How to work (efficiency + quality)

- Restyle components first, then screens: most screens improve automatically once the components are right.
- Keep component APIs stable where you can. If you change props, update every caller in the same commit.
- Small, conventional commits (`feat(ui)`, `style(place)`, `fix(qr)`, `test(db)`). One concern per commit.
- Don't paste big files back to me. Report diffs as summaries with paths.
- When the spec is silent on a visual detail, decide in the spirit of Report 2 and log it (`T-n`). When it's silent on **behaviour or data**, ask.
- If something in Report 1 or 2 is wrong once you see the code (a path, a claim, a contrast number), say so with file + line, fix the plan, and log it. Don't silently work around it.
- Done = evidence, not "should work".

---

## 6. Out of scope for this phase (don't start)

The production deploy (Report 1 §1.3, needs me), Agoda API, audio/TTS, weather forecast in the planner, analytics, "Crabby's choice", Konkan-wide expansion, custom icon/logo/mascot art (placeholders only), and anything marked parked or skipped in the plan.
