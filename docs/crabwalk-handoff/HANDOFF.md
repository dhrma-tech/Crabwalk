# Landing + onboarding — handoff

What shipped, what is still a placeholder, and what a human needs to do next. Plan and reasons: `PLAN.md`.
Crabby art brief: `CRABBY_BRIEF.md`.

## Where things are

| What | Where |
|---|---|
| Landing (`/`) | `apps/web/src/routes/+page.svelte`, sections in `apps/web/src/lib/journal/landing/` |
| Old Discover home | moved to `/discover` (`apps/web/src/routes/discover/`) |
| Onboarding (`/onboarding`) | `apps/web/src/routes/onboarding/`, parts in `apps/web/src/lib/journal/onboarding/` |
| Crabby | `apps/web/src/lib/components/Crabby.svelte` (full character: landing, onboarding); `CrabbyMark.svelte` (same silhouette, light) in the app shell; sheet at `/crabby/sheet` (noindex) |
| Copy and data (EN/HI/MR) | `apps/web/src/lib/journal/content/*.ts` |
| Tokens, fonts, paper grain | `apps/web/src/lib/journal/journal.css` (scoped to `.journal`; the app keeps Tideline) |
| Taluka geometry | `apps/web/src/lib/journal/content/talukaGeo.ts` (generated) |
| Tests | `apps/web/e2e/journal.test.ts`, `apps/web/src/lib/journal/sky.test.ts` |

## Photo shots needed

All slots render the illustration until a photo exists. Photos get the duotone treatment (`.j-duotone`: navy
shadows, beige highlights, full colour on hover). Shoot landscape unless noted, golden hour where it says so,
no identifiable faces without consent.

1. **Hero:** Aare Ware coastal road at golden hour (wide, 3:1 crop safe; the headline sits over the sky).
2. **Hidden gems (portrait 3:4):** Velneshwar, Bhandarpule, Marleshwar falls (monsoon and dry), Kolthare, Pawas
   village lane, Ladghar.
3. **Category previews (3:2):** one per category, 11 in all. The current preview uses the existing
   `static/categories/*.webp` (see `CREDITS.md` there); replace with team photos when ready.
4. **Why cards (16:10):** a Ratnagiri hotel frontage, a Konkani homestay with its family kitchen, a sea fort.
5. **Traveller wall:** only real, consented traveller photos may replace the illustrated avatars. Never AI or
   stock faces.

## Copy that needs native review

Every Hindi and Marathi string in `apps/web/src/lib/journal/content/` is a Claude draft (`talukas.ts`,
`places.ts`, `landing.ts`, `onboarding.ts`). Check first:

- Crabby's name in Devanagari: the drafts use **क्रैबी** (HI) and **क्रॅबी** (MR); the app's Paraglide strings
  have the same open question (`messages/NEEDS_REVIEW.md`).
- Crowd suffix "शांत · सहसा" / "शांत · आम तौर पर" on gem cards.
- Taluka one-liners (`talukas.ts`) and the onboarding questions, which are long and conversational.
- The Marathi and Hindi sample questions in Meet Crabby came from the reference and are kept as written.

## Map data

- Source: OpenStreetMap relations 10354700–10354708 (the nine talukas, admin_level 6), © OpenStreetMap
  contributors, ODbL. The map credits it under the drawing; the footer keeps the OSM credit.
- Regenerate: fetch with any Overpass mirror
  (`[out:json];rel(id:10354700,…,10354708);out geom;`), then
  `node apps/web/scripts/taluka-geo.mjs <file.json>`. Shared borders are simplified once, so neighbours never gap.
- Label coordinates come from the repo's own OSM-sourced place data (`data/places/*.yaml`). **Unhale springs**
  and **Ratnagiri city** are approximate town centres; verify on the ground.

## Still placeholder (by design)

- Every count: `[n] verified places`, `[n] votes`, `[%] of [n] … votes`, `₹[total]`.
- Verdict **bar widths** on the gem cards and the Ratnadurg gauge use the reference's illustrative split; they
  are labelled "Sample split until votes arrive". Wire them to real aggregates and drop the label.
- Trip-planner **D2 and D3** are demo copy made from reference places (labelled "Demo plan · sample stops").
- Gem art, why-card art and traveller avatars are illustrations.
- Crabby is a coded placeholder of good quality; final art per `CRABBY_BRIEF.md`.

## Known limits

- **Sign-in on onboarding** uses the existing `/login` actions (email code + Google). While the temporary access
  gate is on (`AUTH_MODE=temp_email_gate`), those actions are closed, so the screen says sign-in opens at
  launch and the guest path works. When full auth returns, nothing here needs to change.
- **Onboarding answers** are kept in `localStorage` (`cw_onboarding`) only, as the brief asks; the language
  choice becomes the app locale at the end. Syncing the rest to the account is not built.
- **Devanagari font** (Tiro, 96 KB) loads on English landing pages too, because the design shows Devanagari
  words there. It is `font-display: swap` and never blocks the headline.
- Motion uses IntersectionObserver + CSS + Web Animations + `svelte/motion` springs instead of
  GSAP/Lenis/Framer (PLAN.md §1). No smooth-scroll hijacking.

## Checks (2026-11-22)

| Check | Result |
|---|---|
| Typecheck (`svelte-check`) | 0 errors (1 warning, pre-existing) |
| Unit tests | 457 / 457 (incl. 4 new `sky.test.ts`) |
| E2E `e2e/journal.test.ts` | 7 / 7: section order, interactions, onboarding persistence, Crabby sheet, axe |
| E2E full suite (no local stack) | 25 passed, 113 skipped (need `E2E_SUPABASE=local`); shell JS on `/discover` 209.2 KB gz (< 210). "PWA is installable" and "dark theme tokens" failed once under 3 workers and passed on re-run (known load flake, DECISIONS P10) |
| `pnpm lint` | fails on a pre-existing error in `CrabbyChat.svelte:440` from abd5a86 (logged under Found issues); everything else passes |
| axe (WCAG 2.2 AA) on `/` and `/onboarding` | no serious or critical issues |
| Lighthouse mobile `/` (median of 3) | Perf 66 · A11y 100 · Best practices 100 · SEO 100 — FCP 4.7 s, LCP 5.4 s, TBT 160 ms, CLS 0.003 |
| Lighthouse mobile `/onboarding` | Perf 75 · A11y 100 · Best practices 100 · SEO 54 (noindex by design) — FCP 4.1 s, LCP 4.3 s |
| Same profile, existing page `/privacy` (baseline) | Perf 79 — FCP 3.6 s, LCP 4.0 s |

Lighthouse runs its simulated slow-4G profile (1.6 Mbps, 4× CPU) against a local `wrangler pages dev` build;
unthrottled, the landing paints at 0.7 s with LCP = FCP (the hero subtitle). **The brief's "LCP < 2.5 s on
4G" is not met on that profile.** What costs it, in order:

1. **App-shell JavaScript** loaded on every route: 242 KB gzip in total for `/`, of which the landing's own code
   is about 50 KB; the rest is the shared shell (budget 210 KB, DECISIONS L-1). The brief's 200 KB total needs
   a lighter shell for marketing routes (an owner decision).
2. **HTML weight** from inline SVG art: 40 KB gzip (taluka map, traveller wall, scenes). Already trimmed: each
   taluka path is drawn once and reused, the wall's loop repeats render in the browser.
3. **Fonts:** Gloock is preloaded; Instrument Sans and Tiro load with `swap`. Tiro (96 KB) now loads after the
   page `load` on English pages (`whenDevaReady`), and रत्नागिरी writes itself once it arrives.

Done for speed: below-the-fold blocks use `content-visibility: auto`; the grain layer has no blend mode; the
app's own fonts are no longer preloaded on journal pages; the hero's LCP text paints in the first frame.
