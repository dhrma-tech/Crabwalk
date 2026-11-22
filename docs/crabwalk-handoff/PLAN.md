# Landing + onboarding rebuild — plan

Brief: `crabwalk-handoff/CRABWALK_PROMPT.md`. References: `crabwalk-handoff/design-reference/*.dc.html`.
Owner answers (2026-11-22): landing **replaces `/`** (Discover feed moves to `/discover`); login uses **email
code** (G4: no phone/SMS OTP, ₹0); the new **Crabby replaces the mascot app-wide**; the new palette and fonts are
**scoped to the landing and onboarding** (the rest of the app keeps Tideline, T-1).

## 1. Stack (what exists wins, brief §9)

The repo is **SvelteKit 3 + Svelte 5 + Tailwind 4 + Paraglide**, deployed to Cloudflare Pages. No Next.js.

| Brief asks | Used instead | Why |
|---|---|---|
| Next.js App Router | SvelteKit routes | Framework exists. |
| GSAP + ScrollTrigger | `IntersectionObserver` + Web Animations API + CSS, one `inview` action, one rAF scroll loop | About 45 KB gz saved. Every effect here is "start when seen" or "follow scroll progress", which needs no timeline engine. Shell budget is 210 KB gz (L-1). |
| Lenis | Native scrolling | Smooth-scroll hijacking costs frames on mid-range Android and fights reduced-motion and keyboard scrolling. |
| Framer Motion | `svelte/motion` `Spring`/`Tween` + `svelte/transition` | React-only; Svelte has springs built in. |
| Rive | Hand-built SVG with named parts, CSS/WAAPI states | No runtime (Rive ≈ 150 KB wasm); parts stay editable. `CRABBY_BRIEF.md` covers a Rive version later. |
| next-intl | `L = { en, hi, mr }` triples in typed content files + `tr()` on Paraglide's locale | One typed source for data and copy; the EN/हि/म switch sets the Paraglide locale cookie. HI/MR are drafts (HANDOFF). |

### Folders

```
apps/web/src/lib/journal/          the "field journal" system (landing + onboarding only)
  journal.css                      scoped tokens, @font-face, paper grain, type scale, edges
  i18n.ts                          L type, tr(), Devanagari helpers
  sky.ts (+ test)                  IST clock → dawn / day / golden / night, sun arc position
  inview.ts                        IntersectionObserver action (once / progress)
  content/                         talukas, talukaGeo (generated), categories, gems, why, crabby,
                                   planner, verdict, footer, onboarding, nav
  landing/                         one component per section + Diorama, InkIcon, Stamp, Avatar, Edge, ScrollCrab
  onboarding/                      Scene, Postcard, steps, state (localStorage)
apps/web/src/lib/components/Crabby.svelte   the new fiddler crab (app-wide; old props mapped)
apps/web/src/routes/+page.svelte            landing
apps/web/src/routes/discover/               the old home, moved
apps/web/src/routes/crabby/sheet/           hidden character sheet (noindex)
apps/web/src/routes/onboarding/             login → code → about → group → interests → food → postcard
apps/web/scripts/taluka-geo.mjs             OSM → simplified SVG paths
apps/web/scripts/subset-journal-fonts.mjs   Gloock / Instrument Sans / Tiro Devanagari → WOFF2
```

## 2. Assets

- **Fonts (3 files, ≤ 4):** Gloock 400 Latin; Instrument Sans variable (wght 400–600) Latin; Tiro Devanagari
  Marathi 400 Devanagari. All SIL OFL, subset WOFF2, `font-display: swap`. Fraunces was considered and not taken:
  Gloock is the owner's pick and already has the poster contrast the brief wants.
- **Crabby parts (SVG):** `body`, `stalkL`, `stalkR`, `eyeL`, `eyeR`, `bigClaw`, `smallClaw`, `leg1`–`leg6`, plus
  props (`baby`, `gem`, `leaf`) for onboarding reactions. Below 40 px a simplified mark (no grain, no props).
- **Illustration, all inline SVG in ink-line style:** hero diorama (sky, sun/moon, stars, far hills, near hills,
  sea + wave lines, Ratnadurg cliff + lighthouse + beam, foreground palms and rocks); 11 category ink icons;
  6 gem scenes (beach, waterfall, village variants); 3 "why" card dioramas (hotel, stay, places); 5 onboarding
  scenes (dawn beach, village lane, Ratnadurg fort, waterfall + orchard, evening market + thali); illustrated
  traveller avatars (clearly drawings, never presented as real people); 9 taluka postage stamps.
- **Map geometry:** OpenStreetMap taluka boundaries (admin_level 6 inside Ratnagiri district), simplified and
  projected to SVG paths at build time (script checked in, output checked in).
- **Photo slots (none shipped):** hero (Aare Ware road, golden hour), 6 gems, 11 category previews, 3 why
  cards. Every slot renders the illustration until a real photo exists; the duotone treatment is ready
  (`.duotone` filter) for when photos arrive. The existing `/static/categories/*.webp` are reused for the category
  hover preview, in duotone.

## 3. Motion inventory

| Section | Motion | Reduced motion |
|---|---|---|
| Hero | 6 parallax layers on pointer + scroll; sky from IST clock; night stars + lighthouse sweep; "Ratnagiri" letters rise from a wave mask; रत्नागिरी stroke-reveal (clip wipe); route draws, stops pop, mini Crabby scuttles to Pawas | Golden-hour sky, everything in final state |
| Notch | Arrow pulses every 4 s until first scroll | Static |
| Taluka map | District outline draws, then borders, markers drop with ink splash, leader lines + labels; hover = turbulence watercolour wash; card cross-fade; stamp thunk | Final state, plain cross-fade |
| Categories | Ink icons draw on view / hover; drifting ribbon on desktop; floating duotone preview | Static ribbon |
| Gems | Drag/swipe with inertia + snap, keys, 3D side cards, inner parallax, verdict bar fill, caption slide; autoplay pauses on hover/focus/hidden | No autoplay, instant |
| Why | Pins drop staggered, route draws, offline demo toggle (bars, chip, Crabby sleep → wave); card layers shift, arrow rotates 45° | Instant states |
| Meet Crabby | Scuttle in, eyes to viewer, wave; bubbles type in; click → point | Crabby in place, bubbles shown |
| Scroll crab | Tiny Crabby along the bottom edge = scroll progress, faces scroll direction, idles on stop | Removed |
| Planner | Message types, Crabby thinks, stops assemble, chips pop, mini-map route draws; D1/D2/D3 switch + replay | Final state per tab |
| Verdict | 9 columns loop vertically, alternating, pause on hover/focus; gauge segments spring, % counts | Static wall |
| CTA/footer | कोकण water fill rises and sways; tide line ripples; Crabby waves goodbye | Static fill |
| Onboarding | Sideways step slide, scene crossfade + parallax, Crabby shared element with reactions, liquid progress, spring chips, postcard build + flip | Fades only |

Low-end (`hardwareConcurrency ≤ 4` or Save-Data, the existing `html[data-lite]`): 3 parallax layers, no stars,
no wall loop, no ribbon drift.

## 4. Performance budget

- LCP < 2.5 s on 4G mid-range Android: LCP is the HTML headline (text, not an image); Gloock preloaded.
- Route JS for `/` < 200 KB gz incl. the shell; each section's motion code is in its own component and starts
  only when the section nears the viewport. No images above the fold; all illustration is inline SVG.
- Fonts: ≤ 3 files on the landing; Devanagari only downloads when Devanagari is on screen (unicode-range).
- No WebGL.

## 5. Changes to the design, with reasons

1. **Phone + OTP → email + code** (G4, ₹0). Same layout; the 6-box code screen verifies the Supabase email code.
   While the temporary access gate is on, sign-in says it opens at launch and "Explore without an account" works.
2. **Gem verdict bars, verdict gauge distributions** are the reference's illustrative numbers, kept only as bar
   widths and marked as sample data; every visible count stays `[n]` / `[%]`.
3. **Trip planner D2/D3** are not in the reference; they reuse places from the reference data with plain reasons,
   marked as demo copy for team review.
4. **Character sheet at `/crabby/sheet`**, because `/crabby` is the live AI chat.
5. **Accent:** laterite `#B5462B` (Crabby's shell, one highlight per screen); mango stays out to keep one warm note.
6. **Map labels** stay the reference's 12 places; positions come from real coordinates, so leader lines are re-laid.
