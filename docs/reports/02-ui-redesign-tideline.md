# Crabwalk: Report 2. UI redesign ("Tideline")

> Goal: modern, minimal, beautiful and unmistakably Konkan. It replaces the current "Suna · 砂" look (DECISIONS P10a-1/3/5).
> This report defines the direction, the full token set, type, components and every key screen, precise enough to build without a separate design tool. Claude Code may refine details inside these rules (Report 3).
> All colour pairs were contrast-checked (WCAG 2.2); ratios are listed in §3.4.

---

## 1. Why the current UI feels basic and generic

A diagnosis from the code (`apps/web/src/app.css`, `ListingCard.svelte`, `+page.svelte`, `TopBar.svelte`, `AppNav.svelte`, `Button.svelte`):

| Symptom | Cause in code | Effect |
|---|---|---|
| Everything looks like a wireframe | 39 × `border border-border` boxes, no radii (`no radii, no shadows` rule), `--surface` = `--surface-raised` = `--bg` | No depth, no hierarchy. Cards, chips, tiles and inputs all look the same. |
| Flat, washed-out colour | One washi background, pastel tints (sakura/asagi/yamabuki…) used as large fills | Nothing draws the eye. The CTA indigo is the only accent, and it's quiet. |
| Weak type hierarchy | Shippori Mincho at **400 only**, h1 24 px, lots of 13 px secondary text (34 places) | Titles don't anchor sections. Small grey text everywhere reads as "admin tool". |
| Identity mismatch | Japanese names and motifs (washi, sumi, aizome, 蟹 logo, seal-like Crabby) | Pretty in isolation, but says nothing about Konkan: laterite, sea forts, kokum, mango, the Arabian Sea. |
| Photos don't lead | 4:3 image + plain text below; no-photo = striped pastel pattern | Travel is visual, but most cards look like coloured placeholders. |
| Desktop feels empty | ☰ drawer hides navigation; content is single column on most inner pages | Big blank margins, with navigation behind a click. |
| No motion or feedback | Hover = 5 % ink wash; no transitions between pages; skeletons unused | Feels static and older than it is. |

What the new direction fixes: **layered surfaces, soft geometry, one confident brand colour, a characterful display face, photo-led cards, and a real laptop layout.**

---

## 2. The direction: "Tideline"

**One line:** a calm, modern coastal journal. Warm shell-white paper, deep basalt ink, one bold **Kokum** accent, the **Lagoon** teal of a Konkan creek for anything to do with maps and information, and a flash of **Alphonso** gold for the special stuff (hidden gems, seasons).

**Why it suits Konkan travellers:**
- Kokum (the deep berry-red of kokum sherbet and solkadhi) is unique to the region. Nobody in travel uses it, it's not "travel app blue", and it reads premium.
- Lagoon teal ties every map, route, link and "Live" label to the water: creeks, backwaters, the sea.
- Alphonso gold is the Ratnagiri mango, reserved for delight (gems, festivals), never as text.
- Laterite brown appears only as an earth tone in illustrations and the "busy" end of the heatmap, a nod to the old palette without the heaviness.
- An editorial serif with real Devanagari (Eczar) makes Marathi and Hindi feel first-class, not bolted on.

**Principles:**
1. **Neutral first, colour with intent.** About 90 % of any screen is neutral. Kokum = act. Lagoon = know/navigate. Alphonso = delight. Status colours only with an icon and a label.
2. **Depth through surfaces, not lines.** Off-white page, white cards, soft shadow; sunken grey for inputs and chips. Hairlines only where they separate rows.
3. **Photo first, honest when there's no photo.** Photos are large and rounded; a missing photo becomes a designed category card, never a broken-looking stripe.
4. **Big type, few sizes.** A strong display face for titles, one clean sans for everything else, 14 px minimum for secondary text.
5. **Soft geometry.** Rounded corners in a strict 4-step scale (12 / 16 / 20 / 28) plus pill chips. Nothing else.
6. **Quiet motion.** Shared-element page transitions, springy sheets, subtle press states. All off under reduced motion.

Inspiration (principles, not copying): Airbnb's photo-led cards and soft radii; Apple Maps Guides' editorial rhythm; Linear's token discipline and restraint; Arc/Raycast-style floating bars.

---

## 3. Colour system

### 3.1 Light ("Shell")
```css
:root {
  /* Neutrals */
  --bg:            #F7F5F0;  /* shell: page */
  --surface:       #FFFFFF;  /* cards, sheets, bars */
  --surface-2:     #EFECE5;  /* sunken: inputs, chips, segmented, skeleton base */
  --surface-3:     #E6E2D9;  /* pressed sunken, skeleton shine */
  --border:        #E4DFD5;  /* row dividers, card edge in dark contexts */
  --border-strong: #8F887B;  /* input borders, 3:1 UI contrast */
  --text:          #15171A;  /* basalt */
  --text-2:        #4A4F57;  /* secondary */
  --text-muted:    #646973;  /* metadata ≥ 14 px only */

  /* Brand */
  --kokum:         #7A2048;  /* primary action, brand */
  --kokum-hover:   #651A3B;
  --kokum-ink:     #5E1838;  /* text on kokum-50 */
  --kokum-50:      #F7E9EF;
  --kokum-100:     #EED0DC;
  --on-kokum:      #FFFFFF;

  --lagoon:        #0F6B66;  /* links, map route, info, Live */
  --lagoon-ink:    #0B4F4B;
  --lagoon-50:     #E3F2F0;
  --lagoon-100:    #C5E5E1;

  --alphonso:      #F4B740;  /* FILL ONLY: gems, season highlights */
  --on-alphonso:   #3D2A00;
  --alphonso-50:   #FDF3DC;

  --laterite:      #A8492E;  /* illustration + heatmap busy end + "danger" state dot */
  --laterite-50:   #F8E8E2;

  /* Semantic (always with icon + label) */
  --ok:            #2F7D4F;  --ok-50: #E5F2EA;
  --caution:       #8A5A00;  --caution-50: #FFF1D6;
  --danger:        #A8492E;  --danger-50: #F8E8E2;  /* tide cut-off, closed, risky: not red */
  --emergency:     #C8102E;  --emergency-hover: #A90D27;  /* emergency card + QR emergency ONLY */
  --sponsor:       #646973;

  /* Verdict (low is not red; each ≥ 3:1 on surfaces) */
  --v1: #8F877A;  /* Skip / Avoid: stone */
  --v2: #B07A06;  /* Timepass / Okay: deep alphonso */
  --v3: #358A80;  /* Worth it / Good: seafoam */
  --v4: #0F6B66;  /* Must visit / Perfect / Local legend: lagoon */

  --focus: #0F6B66;
  --scrim: rgba(21, 23, 26, .48);
  --glass: rgba(255, 255, 255, .78);
}
```

### 3.2 Dark ("Night tide"), warm-cool deep slate, never pure black
```css
:root[data-theme="dark"], (system dark when not forced light) {
  --bg: #0F1215;  --surface: #171B1F;  --surface-2: #1F2429;  --surface-3: #262C32;
  --border: #2A3036;  --border-strong: #6B7380;
  --text: #F2EFE9;  --text-2: #B9BCC2;  --text-muted: #8D939B;
  --kokum: #E68AB0;  --kokum-hover: #EFA6C4;  --on-kokum: #2A0716;  --kokum-50: #3A1A28;  --kokum-ink: #F3C6D8;
  --lagoon: #5CC4BB;  --lagoon-50: #12302E;  --lagoon-ink: #A6E6DD;
  --alphonso: #F6C35E;  --on-alphonso: #2E2000;  --alphonso-50: #3A2E12;
  --laterite: #F08E6E;
  --ok: #7CC69A;  --caution: #E0B04A;  --danger: #F08E6E;  --emergency: #E5383B;
  --v1: #857C6E;  --v2: #D9A33A;  --v3: #4FB7AC;  --v4: #A6E6DD;
  --focus: #5CC4BB;  --glass: rgba(23, 27, 31, .78);
}
```
Dark-mode elevation: lighter surfaces replace shadows, plus a 1 px `rgba(255,255,255,.06)` edge on cards and sheets.

### 3.3 Colour rules (replace FRONTEND §2.2 / P10a-1 rules)
- **One kokum filled button per screen** (the primary action). Kokum text only for links in brand moments; everyday links are lagoon.
- Alphonso is **never text**; text on it is `--on-alphonso`.
- `--emergency` appears only in `EmergencyCard` and the QR emergency bar. It is deliberately a brighter, warmer red than kokum, and the two never sit side by side.
- Danger states (tide cut-off, monsoon closed) use the **laterite dot + ink text**, never red fills.
- Category tints (tiles, no-photo cards, map legend), by family:
  - **Coast** (beach, backwater, waterfall): `--lagoon-50` bg, `--lagoon` icon
  - **Heritage** (fort, temple, museum, cave): `--laterite-50` bg, `--laterite` icon
  - **Land and life** (viewpoint, village, market, orchard): `--alphonso-50` bg, `--on-alphonso` icon
- Every crowd/heatmap value still shows "Live" or "Typical" (honest-UI rules unchanged).

### 3.4 Verified contrast (ratio)
| Pair | Light | Dark |
|---|---|---|
| text / bg | 16.5 | 16.4 |
| text-2 / bg | 7.6 | 9.9 |
| text-muted / bg · / surface-2 | 5.1 · 4.7 | 6.1 · 5.1 |
| on-kokum / kokum | 9.9 | 7.6 |
| kokum / bg (link) | 9.1 | 7.7 |
| lagoon / bg · / white | 5.8 · 6.3 | 9.0 |
| on-alphonso / alphonso | 7.7 | — |
| kokum-ink / kokum-50 | 10.7 | — |
| lagoon-ink / lagoon-50 | 8.2 | — |
| caution · ok · danger / bg | 5.4 · 4.6 · 5.3 | 9.4 · 9.3 · 7.9 |
| white / emergency | 5.9 | — |
| border-strong / bg (UI 3:1) | 3.2 | — |
| v1 · v2 · v3 · v4 / bg (graphic 3:1) | 3.3 · 3.4 · 3.8 · 5.8 | 4.6 · 8.3 · 7.8 · high |
| Pin glyphs: place · stay · food | 9.9 · 6.3 · 7.7 | — |

`contrast.test.ts` must be rewritten to assert all of these (text ≥ 4.5, large/UI/graphics ≥ 3).

---

## 4. Typography

### 4.1 Families (all SIL OFL, self-hosted, no CDN)
| Role | Family | Why |
|---|---|---|
| Display (titles, hero, big numbers) | **Eczar** 700 (Latin + Devanagari, Rosetta) | An editorial, high-contrast serif with a matching Devanagari design, so Marathi titles look as crafted as English ones. Distinctive, not a default. |
| Text (UI, body, labels) | **Anek Latin** + **Anek Devanagari**, variable `wght` 400–700 (Ek Type) | A modern, clean, Indian-designed family. The same skeleton across scripts keeps mixed EN/MR lines even. One variable file per script covers every weight. |

**Files (fits the 4-file budget and keeps the P10-4 split):** `display-700-latin.woff2`, `display-700-deva.woff2`, `text-var-latin.woff2`, `text-var-deva.woff2`. Instance Anek to `wdth=100` (fonttools `instancer`) and subset with the existing `scripts/subset-fonts.mjs` ranges. Target: ≤ 45 KB Latin, ≤ 110 KB Devanagari per file. Map labels use the text family (update `lib/map/style.ts` `font-faces`).

**Fallback pairing (if Eczar feels too editorial once rendered):** Poppins 600 (Latin + Devanagari) for display, same Anek text. That gives a more geometric, app-like look. Decide by rendering the Discover and Place screens in both (Report 3, step D2).

### 4.2 Scale (mobile → laptop)
| Token | Size / line | Family / weight | Use |
|---|---|---|---|
| `display-xl` | 34/40 → 48/54 | Eczar 700, -0.01em Latin only | Discover hero line, place name on laptop |
| `display` | 28/34 → 36/42 | Eczar 700 | Place/stay/eatery name |
| `h1` | 24/30 → 28/34 | Eczar 700 | Page titles |
| `h2` | 20/26 | Anek 650 | Section titles |
| `h3` | 17/24 | Anek 600 | Card titles, list item names |
| `body` | 16/26 | Anek 400 | Paragraphs (never below 16) |
| `body-strong` | 16/26 | Anek 600 | Emphasis, prices |
| `small` | 14/20 | Anek 450 | Metadata, captions (minimum for any secondary text) |
| `label` | 13/16 | Anek 600 | Chips, badges, nav labels only |
| `number` | tabular-nums on all prices, times, distances, % |

Rules: sentence case everywhere, no ALL CAPS, no letter-spacing on Devanagari (`:lang(mr), :lang(hi) { line-height: 1.65; letter-spacing: 0 }`). Bilingual names: primary script in `h3`/`display`, other script below in `small` `--text-2`. Story text max width 680 px, with a 1.75 line height for `mr`/`hi`.

---

## 5. Space, shape, depth, motion

- **Spacing (4-pt):** 4, 8, 12, 16, 20, 24, 32, 40, 56, 72. Page gutter 20 px (phone) / 32 px (laptop). Section gap 40 px (phone) / 56 px (laptop). Container 1200 px, reading width 680 px.
- **Radii:** `--r-sm 12` (inputs, small buttons, image corners inside cards), `--r-md 16` (buttons, list thumbnails, tiles), `--r-lg 20` (cards), `--r-xl 28` (sheets, modals, hero bottom), `--r-full` (chips, avatars, icon buttons).
- **Elevation (light):**
  - `e1` cards: `0 1px 2px rgba(21,23,26,.04), 0 4px 12px rgba(21,23,26,.05)`
  - `e2` floating bars, docked panels: `0 8px 28px rgba(21,23,26,.10)`
  - `e3` sheets, menus, modals: `0 18px 48px rgba(21,23,26,.18)`
  - Dark: surfaces step up (`surface` → `surface-2`) with a 1 px light edge, and no big shadows.
- **Glass (photos and the map only):** `background: var(--glass); backdrop-filter: blur(14px) saturate(1.2)` on badges over photos, the floating nav and the map search bar. Provide a solid fallback with `@supports not (backdrop-filter: blur(1px))`.
- **Motion:** press 120 ms `scale(.97)`; state 200 ms; sheets 320 ms with `cubic-bezier(.2,.8,.2,1)` or a CSS `linear()` spring; page navigation uses the **View Transitions API** (SvelteKit `onNavigate` + `document.startViewTransition`) with a cross-fade, and a **shared hero image** from card to detail via `view-transition-name: hero-<slug>`. Skeleton shimmer is 1.2 s. Under `prefers-reduced-motion`: no transforms and no shared-element transition, instant cross-fade only. No bounce or parallax, and no motion at all on safety UI.

---

## 6. Iconography, imagery, brand marks

- **UI icons:** Lucide, **1.75 px** stroke (back to FRONTEND §3), 20 px inline / 24 px in nav and buttons. Icons always carry `aria-hidden` plus a text label, or an `aria-label`.
- **Category icons:** still Lucide behind `<CategoryIcon>` (the custom set remains `[OPEN]`), shown inside a **40 px rounded tile** (`--r-md`) in the family tint (§3.3). Map pins use the same glyphs.
- **Photos:** cards 4:3 (`--r-lg` top or `--r-sm` inset), hero 4:5 on phones (immersive) and 16:9 on laptop, always with LQIP blur-up. Text over photos only with a bottom scrim `linear-gradient(transparent, rgba(0,0,0,.55))` and white text.
- **No-photo card (designed, not a placeholder):** the family-tint background, a large category glyph at 72 px in the family colour at 22 % opacity, offset bottom-right, a faint topographic/wave line pattern (inline SVG, 4 % opacity), and the label "Photo coming soon" in `small`. It looks deliberate, so a mostly photo-less catalogue still looks good.
- **Wordmark placeholder (logo is `[OPEN]`, artist pending):** `crabwalk` in lowercase Eczar 700, kokum, with a tiny sideways double-chevron mark `‹›` (a crab's sidestep) before it. **Remove the 蟹 glyph** from the brand mark, fonts and PWA icons; regenerate icons as the chevron mark in white on kokum.
- **Crabby placeholder (art is `[OPEN]`):** a 1-file inline SVG, kokum rounded body, two eye stalks with white eyes, two small claws, flat with no gradients, legible at 24 px. States: idle, walking (sidestep loader), waving (one claw rotates 20° twice, the success state). Never on safety UI (unchanged).
- **Illustrations (empty and error states):** flat line-and-fill vignettes in the brand colours only: a sea fort silhouette (404), a fishing boat on calm water (offline), a crab peeking from sand (empty search). Keep them simple inline SVGs, each ≤ 3 KB.

---

## 7. Shell and navigation

### 7.1 Phone (< 1024 px)
- **Top bar:** transparent over hero photos and `--surface` with `e2` once scrolled (an IntersectionObserver sentinel). Left: back chevron (44 px round icon button) or wordmark. Centre: page title (`h3`, fades in on scroll for detail pages). Right: search icon button and the language switch as a compact `EN · हि · म` segmented pill.
- **Bottom nav:** a **floating bar** 12 px above the safe area with 16 px side insets, `--r-xl`, glass, `e2`. Five items with icon and `label`; the active item gets a kokum icon plus a 4 px kokum dot. **Crabby centre:** a 56 px kokum circle raised 14 px, holding the Crabby placeholder in white. It hides while the keyboard is open and on `/navigate` and the emergency card.
- **Context chips** (place page Crabby prompts) float above the nav as glass pills.

### 7.2 Laptop (≥ 1024 px)
Replace the ☰ drawer (P10a-4) with a **persistent top navigation**, which is more discoverable and modern:
- 72 px bar: wordmark → inline links (Discover · Map · Plan · Itineraries · Taste Konkan) → centred search field (480 px, `--surface-2`, `--r-full`) → language pill → avatar/Sign in.
- **Crabby** is a right-docked 360 px panel, **collapsible** to a floating kokum button (state remembered per viewer in localStorage, wrapped in try/catch). Default: collapsed on Discover/lists, open on Plan.
- Content: 12-column grid, 1200 px max, 32 px gutters.
- **This overrides DECISIONS P10a-4 → `[ASK]`.** Report 3 tells Claude Code to confirm before building it.

---

## 8. Components (build each with every state: default, hover, pressed, focus, disabled, loading, error, empty, offline)

| Component | Spec |
|---|---|
| **Button** | Primary: kokum fill, white text, 48 px tall, `--r-md`, `body-strong`, one per screen. Secondary: `--surface-2` fill, ink text. Outline: 1.5 px `--border-strong`. Ghost: lagoon text, underline on hover. Icon: 44 px round, `--surface` + e1 over photos (glass). Emergency: red, 56 px, phone icon, `--r-md` (emergency UI only). Loading: Crabby walker + label kept. Disabled: `--surface-2` bg + `--text-muted`. Focus: 2 px `--focus` ring, 2 px offset. |
| **Chip** | Filter: 36 px tall (44 px hit area with padding), `--r-full`, `--surface-2`, `label`. Selected: **ink fill (`--text`) + white text + check icon**. Vibe tag: 28 px, `--surface-2`, `small` `--text-2`. Max 3 + "+N". |
| **Segmented control** | Track `--surface-2` `--r-full`; selected thumb `--surface` + e1, sliding 200 ms. Used for group type (Family · Couple · Solo · Friends), pace, the language switch and day tabs. |
| **Input** | 52 px, `--r-sm`, `--surface-2` fill, no border at rest. **Focus: 1.5 px `--text` border + white fill**, no outline box (keeps R-8 "no outline while typing" while still meeting WCAG 2.4.7). Error: 1.5 px `--danger` border + message with icon below. Search variant: leading search icon, `--r-full`. |
| **PlaceCard / StayCard / EateryCard** | `--surface`, `--r-lg`, e1, overflow hidden. Photo 4:3 on top (or the no-photo card). **Glass badges over the photo**, top-left: gem (alphonso), crowd (Live/Typical); heart top-right (44 px glass icon button). Body padding 14 px: name `h3` + other script `small`, a meta row (`small` `--text-2`: category · distance · price), and the mini verdict bar (4 px tall, `--r-full`, segment gaps 2 px) with the winning label + %. Hover (pointer devices): photo zooms to 1.03 over 300 ms and the card lifts to e2. |
| **Hero carousel card** (Hidden gems, itineraries) | 280×360 phone / 4-up laptop, full-bleed photo, bottom scrim, name in white `display`, glass badge row, scroll-snap with peeking next card. |
| **List row** (Stays/Food lists, nearby) | 96 px thumbnail `--r-md` + name/meta/verdict + chevron; rows separated by `--border` hairlines inside a `--surface` `--r-lg` group (iOS-style inset list). |
| **VerdictGauge** | A card with a big winning label (`h2`) + `display`-size % + vote count `small`, a 12 px segmented bar (`--r-full`, 2 px gaps, proportional bands), labels under each band, then the group segmented control. "New" (< 10 votes): dashed `--border-strong` outline bar + "New · 6 votes so far". Sub-scores: 6 px lagoon bars with value; locked hygiene shows a lock icon + "Verified visitors only". |
| **VerdictVote** | 4 large tiles in a 2×2 grid (phone) / 4×1 (laptop), icon + label, `--surface-2`; selected = verdict colour border 2 px + check + tinted fill. Then quick-tap sub-scores as 1–5 pill chips. |
| **StatusBadge** | Pill, `label`, 28 px: a coloured **dot or icon** + ink text on `--surface-2`, or on glass over photos. Tide accessible (ok dot + wave icon), cut off (danger dot + "Next safe 6:10 pm"), monsoon, crowd (Live = lagoon dot with a soft 2 s pulse, Typical = hollow dot), hidden gem (alphonso fill + gem icon), verified (lagoon check), "Checked online" vs "Visited" (Report 1 §1.5). |
| **Facts grid** | 2 columns phone / 3 laptop; each fact = 20 px lagoon icon + `small` label `--text-2` + `body-strong` value; tiles on `--surface-2` `--r-md`. |
| **BottomSheet** | `--surface`, `--r-xl` top, e3, 36×4 handle; snap peek (132 px) / half / full; spring motion. |
| **Toast** | Ink bg `--text`, `--bg` text, `--r-md`, e3, bottom above the nav, 4 s, slides up. |
| **Skeleton** | `--surface-2` with a moving `--surface-3` highlight; shapes match the real layout (card, row, text lines). Static under reduced motion. |
| **Empty / error / offline** | Illustration (§6) + `h2` + one sentence + one CTA. Offline banner: a top pill in caution-50 with the cloud-off icon, "You're offline, showing saved data" + pack status. |
| **AudioGuidePlayer** | A `--surface-2` card: a 48 px kokum play button, a waveform-style progress (static bars), −15 s, speed pill (0.75–1.5×), transcript toggle. |
| **TideTimeSlider** | A 72 px tall card with a tide-height area curve (lagoon at 20 % fill) and a draggable thumb with a time bubble; safe windows shaded ok-50, cut-off windows danger-50; attribution line under it. |
| **EmergencyCard** | Unchanged rules: full-screen, `--emergency` header, giant "Call 112", hospital, share location; system font weight 700 for "Call 112"; no mascot, no motion. |
| **ActionPreviewCard** (Crabby) | `--surface` card with a kokum left edge (4 px), a diff-style list (+ added stop / − removed), primary **Apply** (kokum) + ghost **Discard**. |

---

## 9. Screens (phone first; laptop notes in *italics*). The locked section order (FRONTEND §7) is kept.

1. **Discover `/`**
   - **Hero block** (new visual treatment of existing data, no new data): `display-xl` greeting line ("Find your Konkan"), the search field, then a **"Today on the coast" glass strip** with real cached data only: weather for the user's taluka (OWM cache, with timestamp), next low tide at the nearest station (TideCheck, with attribution), and today's season/event chips. Every item is labelled and timed; if any is missing, it's hidden (no fake live data).
   - Categories: a horizontal scroller of 11 **tinted icon tiles** (72×88, `--r-md`).
   - Hidden gems: the hero carousel (§8).
   - Ready-made itineraries: wide cards with a mini route line (stops as dots), days, budget.
   - Taste Konkan: round 88 px dish photos with names (a circle crop feels like plates).
   - Near me: the "Use my location" button, then the PlaceCard grid.
   - *Laptop: hero split 7/5 (text + search left, a large featured gem photo right); gems 4-up; itineraries 3-up; dishes 6-up.*
2. **Place `/place/:slug`**
   - An immersive hero (4:5) under a transparent top bar; a white **content sheet overlaps the photo by 28 px** with `--r-xl` top corners.
   - Name `display` + other script + category · taluka, then the badge row.
   - **Sticky action bar** (bottom, above the nav, glass): Directions · Add to trip (primary) · Save · Share (`[ASK]`, Report 1 §3.9).
   - Audio guide → VerdictGauge card → Vote → Facts grid → Story (first paragraph larger, `body` 18/30) → History/Significance → Do's & don'ts as two tinted cards (ok-50 ✓ / danger-50 ✕ with icons) → Status/tide card with slider → Nearby (inset list with icons) → Similar / Less crowded (horizontal cards) → Food delivery → Reviews → "Visited / Checked online" date + Report a problem.
   - *Laptop: 16:9 hero inside the container (`--r-xl`), then two columns: story column 7/12 and a sticky facts column 5/12 (gauge, vote, facts, status, actions).*
3. **Map `/map`:** full-bleed map; a **glass search bar** at the top with a filter chip row under it; a layer FAB (glass, bottom-right above the nav) opening a layers sheet with grouped toggles (Places · Stays · Food · Utilities · Live & safety); the BottomSheet for the selected pin with photo, name, verdict and actions. Legends sit in glass cards. *Laptop: the left 400 px results list panel + map; the sheet becomes a floating card.*
4. **Stays / Food lists:** sticky filter chip bar (scrolls horizontally) + result count + sort; inset list rows (phone) / card grid 3-up (laptop).
5. **Stay / Eatery detail:** same skeleton as Place. Stays add an amenities icon grid, network strength as signal bars per operator, and a **price comparison table** as rows with source label, price and an action button (each row shows its source, honest UI). Eateries add signature dishes as round photo chips, the menu as a clean two-column list with dot leaders, and food-app buttons as brand-neutral outline buttons with the app name.
6. **Taste Konkan:** a 2-col dish grid of square photos with `--r-lg` and the name below; the dish page has a hero, "What it is", "Story" and "Where it's best" as an inset list of eateries.
7. **Planner `/plan/new`:** a one-question-per-step wizard with a progress bar (7 steps: days stepper → start → group → budget slider → interests chips → pace segmented → Standout toggle). Big tap targets; "Generate" is a kokum full-width button in the thumb zone; the Crabby walker while it plans.
8. **Plan view `/plan/:id`:** day segmented tabs, a mini route map strip, then a vertical **timeline** (lagoon line, time on the left in tabular numbers, stop cards on the right with a reason chip, travel time between stops as a dotted connector with a car icon). Budget card with a donut or stacked bar per category and per-person split. Share / PDF / Google Maps per day in an overflow sheet.
9. **Live trip:** a current-stop hero card, the next stop + ETA, a nudge banner (caution-50), and a giant "Navigate" kokum button.
10. **Navigation:** a full-screen map; a big next-turn card at the top (ink bg, white `display` distance, direction arrow); a bottom bar with ETA, voice toggle, wake-lock indicator and "Open in Google Maps". Dark scheme auto-suggested after sunset (unchanged).
11. **Crabby `/crabby`:** user bubbles kokum-50 with kokum-ink text, `--r-lg` with a squared bottom-right corner; Crabby bubbles `--surface` with e1 and the avatar; suggestion chips above the input; input bar glass + mic button (lagoon pulse when recording). Daily limit and login wall as friendly cards.
12. **Me:** a profile header card (avatar, name, sign in/out), then inset groups: Trips · Saved · Offline packs (size, version, progress ring) · Preferences · Privacy & consents (toggles) · Language & theme (segmented) · About/Privacy.
13. **Login:** a centred card on a soft lagoon-to-shell gradient band, Google button (outline with the G mark per Google brand rules), the email code flow with a 6-box OTP input.
14. **QR page `/q/:code`:** stays system fonts and < 100 KB (locked). Restyle with the same tokens as inline CSS: shell bg, white content card with `--r-lg`, kokum audio button, laterite/ok status dots, red pinned emergency bar. Georgia stays the title fallback.
15. **Admin / owner:** a calmer "tool" variant: denser spacing (8-pt), tables as inset lists, an "Internal tool" lagoon-50 banner. Same components, no hero imagery.

---

## 10. Map style (replaces P10a-1 map colours)
| Layer | Light | Dark |
|---|---|---|
| Land | `#F3F0E8` | `#12161A` |
| Water | `#CFE6E3`, coastline `#9CCBC5` | `#0E2A2C`, coastline `#1D4A4A` |
| Parks/forest | `#E2EAD6` | `#17221B` |
| Major roads | `#FFFFFF` + `#E4DFD5` casing | `#232A30` + `#2E363D` casing |
| Ghat/warning roads | `#E8A48E`, dashed 2-2 | `#A8492E` |
| Planned route | `#0F6B66` 6 px + white 2 px casing | `#5CC4BB` + `#0F1215` casing |
| Labels | `#3A3F45`, halo `#F7F5F0` 1.5 px, Anek | `#C9CCD1`, halo `#0F1215` |
| Pins | places kokum / stays lagoon / food alphonso (glyph `--on-alphonso`), white 2 px ring, e1 | same hues, dark-mode values |
| Clusters | ink `#15171A` circle + white count, kokum ring when it holds a selected pin | `#F2EFE9` circle + ink count |
| Utilities | `--surface` circle + `--text-2` glyph + `--border-strong` ring | dark equivalents |
| Heatmap | lagoon-50 → alphonso → laterite, always labelled Live/Typical | same |

---

## 11. Accessibility and performance guardrails (non-negotiable)
- WCAG 2.2 AA: every pair in §3.4; focus visible on everything (inputs via the border rule); targets ≥ 44×44; colour never the only signal.
- Fonts ≤ 4 files, Latin pages never download Devanagari (`unicode-range`); app shell JS < 200 KB gz; no new runtime dependencies for visuals (CSS + inline SVG only); View Transitions are progressive enhancement.
- `backdrop-filter` has a solid fallback; glass is never placed behind body text.
- LCP < 2.5 s on 4G mid-range Android: the hero image `fetchpriority="high"` + preloaded LQIP; display font preloaded (Latin only).
- Marathi longest-string clip check on every component (existing `data-clip-check`).

---

## 12. What stays the same
The locked section order of every screen (FRONTEND §7), honest-UI rules (§13), emergency rules, the QR budget, the hard rules, the i18n mechanics, the component APIs where possible (restyle first, change props only when needed).
