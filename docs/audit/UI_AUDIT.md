# Crabwalk — UI audit and motion / graphics direction (2026-11-12)

Based on reading `apps/web/src/app.css`, the components under `apps/web/src/lib/components/`, the page files under `apps/web/src/routes/`, `AUDIT.md` (Lighthouse history) and the design rules in `CRABWALK_FRONTEND.md` and `docs/DECISIONS.md`. I did not run the site in a browser in this session, so visual judgements come from the code and the existing screenshot baselines' existence, not from fresh screenshots. Anything that needs eyes on a device is marked "check on device".

`web/` = `apps/web/src/`.

## 0. Constraints that shape every recommendation

| Rule | Source | Effect on this plan |
|---|---|---|
| No parallax | `CRABWALK_FRONTEND.md:299`, `docs/design/CLAUDE_DESIGN_BRIEF.md:336` | The brief for this audit asks for parallax. I specify a one-time hero "settle" instead and list true parallax as an owner decision (§9). |
| No bounce on safety UI; Crabby never on emergency UI | `CRABWALK_FRONTEND.md:299`, `web/lib/components/Crabby.svelte:5` | Emergency card, tide cut-off, alerts and closures get fades only. |
| Glass only over photos and the map | `web/app.css:452-464` | No new glass surfaces. Glass count per viewport is capped (§6). |
| Durations 120 / 200 / 300 ms, one easing | `CRABWALK_FRONTEND.md:299` | Kept as the base; new tokens extend them rather than replace them. |
| App shell JS < 200 KB gz (currently 137.8 KB) | `AUDIT.md:53-54` | No animation library. Everything below is CSS, the View Transitions API and Svelte's built-in `svelte/motion`. |
| No stock photos | `CLAUDE.md` §2 | Graphics are drawn SVG and CSS, never bought imagery. |
| Sponsorship never affects rating or ranking | `CLAUDE.md` §2 | No animated emphasis on sponsored items. |

## 1. Findings

**20 findings: 0 Critical, 4 High, 10 Medium, 6 Low.** Severity here means effect on perceived quality and on frame rate, not security.

| ID | Sev | Finding | Evidence | Direction |
|---|---|---|---|---|
| UI-01 | High | The bottom sheet animates `height`, which lays out the sheet's whole content every frame, on the map page where the GPU is already busy. | `web/lib/components/BottomSheet.svelte:62, 66` | Fixed full-height sheet moved with `translateY`; see §4.6. |
| UI-02 | High | Glass (`backdrop-filter: blur(14px)`) on the top bar, bottom nav, chips and photo badges dropped the mobile Lighthouse score on `/` from 98 to 82. Recorded, not resolved. | `AUDIT.md:44-65` (T-57) | Glass budget in §6; solid surface while scrolling fast or on low-end devices. |
| UI-03 | High | Most place cards have no photo: 57 photos for 171 places. The designed no-photo card is a flat tint with a 4 %-opacity wave and a faint icon, so most of the home page looks unfinished. | `docs/DEPLOY_CHECKLIST.md:26`, `web/lib/components/NoPhoto.svelte:45-63` | Per-family illustrated no-photo art (§5.2). This is the single biggest visual win until photos arrive. |
| UI-04 | High | Rating has no feedback of its own. A tap fires a request, a generic toast, and reloads every loader on the page. The gauge and bars appear fully drawn with no fill. | `web/lib/components/rating/VerdictVote.svelte:60-78`, `VerdictGauge.svelte:74-83`, `SubScores.svelte:29-32` | Optimistic state, tile "stamp", gauge fill, count-up (§4.7). |
| UI-05 | Med | Only one page transition exists: a root cross-fade. No card-to-detail continuity, no direction for back. | `web/routes/+layout.svelte:36-45` | Named view transitions (§4.1, §4.2). |
| UI-06 | Med | The motion token set is four durations and one curve; components hard-code others (`duration-300`, `0.6s`, `0.9s`, `2s ease-in-out`). | `web/app.css:54-58`; `ListingCard.svelte:71, 115`; `Crabby.svelte:53, 66`; `StatusBadge.svelte:82` | Full token set in §3. |
| UI-07 | Med | Skeleton shimmer animates `background-position` on every placeholder: paint work on each frame, multiplied by the number of blocks. | `web/lib/components/Skeleton.svelte:37-56` | One translated pseudo-element per skeleton group (§4.5). |
| UI-08 | Med | Saving (heart) swaps the fill with no motion; it is the main retention action. | `web/lib/components/ListingCard.svelte:160-166` | Heart pop (§4.4). |
| UI-09 | Med | Crabby's wait is a single state with no stages, and the reply arrives whole. A turn makes 3 to 7 model calls, so waits are long. | `web/lib/server/ai/chat.ts:128-241` (no streaming), `web/lib/components/crabby/CrabbyChat.svelte` | Staged thinking line and streamed text (§4.9). |
| UI-10 | Med | Three empty-state drawings cover every case (404 fort, offline boat, empty crab). Nothing for "no results for these filters", rate limit, AI unavailable, GPS denied, pack downloading, QR code not found. | `web/lib/components/Illustration.svelte:4` | Six more vignettes in the same style (§5.3). |
| UI-11 | Med | Share cards fall back to the app icon whenever a listing has no photo, which is most listings. | `web/lib/components/Meta.svelte:25, 39` | Generated OG cards (§5.5). |
| UI-12 | Med | The QR page's "verified visit" result is a line of text; scanning a plaque has no moment. | `web/lib/qr/page.ts:48, 183` | CSS-only stamp inside the 100 KB budget (§4.8). |
| UI-13 | Med | Legacy colour aliases from the previous design (`sakura`, `asagi`, `yama`, `wakaba`, `fuji`, `cta`, `link`, `highlight`) are still defined and mapped. | `web/app.css:174-192, 303-319` | Find remaining uses, replace, delete. |
| UI-14 | Med | Toasts use a Svelte `fly` transition. Svelte 5 runs transitions through the Web Animations API, which the global CSS reduced-motion rule (`animation-duration: 0.01ms`) does not reach. Likely still moves under reduced motion. | `web/lib/components/Toaster.svelte:2, 15`, `web/app.css:531-540` | Unverified in a browser. Use a `reducedMotion` media store and pass `duration: 0`. |
| UI-15 | Low | `theme-color` meta tags follow the system scheme, not the manual theme override, so a user who forces dark on a light phone gets a light browser bar. | `web/app.html:7-8`, `web/hooks.server.ts:47-51` | Emit a single `theme-color` from the server when `data-theme` is set. |
| UI-16 | Low | Category tiles put white labels on photos behind a 48 % scrim. Contrast depends on each image; the contrast test covers tokens only. | `web/routes/+page.svelte:118-137`, `web/lib/contrast.test.ts` | Bottom gradient scrim (0 → 70 %) and a test that samples each tile. Check on device. |
| UI-17 | Low | Text fields drop the focus outline for a 1.5 px border colour change. Works, but is the weakest focus indicator in the system. | `web/app.css:483-498, 527-530` | Keep the border and add a 2 px `--focus` ring at 40 % alpha on `:focus-within`. |
| UI-18 | Low | Map overlays appear without motion by decision (`fadeDuration: 0`, T-52), so the selected pin has no emphasis. | `AUDIT.md:67`, `web/lib/components/map/MapView.svelte` | One DOM marker for the selected pin only (§4.6). |
| UI-19 | Low | Display font is one weight (EB Garamond 400); all hierarchy inside headings comes from size. Fine, but section headings switch to Figtree 650, so a page mixes two heading voices. | `web/app.css:337-389` | Keep. Optionally set `type-h2` in Garamond on story pages only. Owner taste call. |
| UI-20 | Low | No density or elevation token between `e1` and `e2` for hover; cards jump from a near-flat to a 28 px shadow. | `web/app.css:49-51`, `ListingCard.svelte:71` | Animate `translateY(-2px)` with a pre-rendered shadow layer's opacity instead of `box-shadow` (§6). |

What is already good and should be kept: one token source with a contrast test; full dark theme; type utilities with Devanagari line-height rules; named z-layers; a global reduced-motion rule; LQIP blur-up on every photo; `prefers-reduced-transparency` handling on glass; 44 px touch targets; a component gallery at `/dev/components`.

## 2. Visual system review

| Area | State | Gap |
|---|---|---|
| Colour | Cool paper, basalt ink, one blue action, lagoon for information, alphonso for delight, laterite for danger, red reserved for emergencies. Light and dark blocks kept identical and tested. | The brand is "Konkan" but the screen is mostly grey-blue. Laterite and alphonso appear only in badges. §5 uses them in illustration and texture so warmth comes from graphics, not from recolouring UI. |
| Type | Garamond display + Figtree text; body never under 16 px; 14 px floor for secondary. | Good. No tabular-number utility for prices, counts and percentages; add `font-variant-numeric: tabular-nums` to `type-display` numerics and price cells (needed for count-ups). |
| Spacing | Tailwind 4 px scale; page gutters 20 px; section gap 40 / 56 px. | No named section rhythm tokens. Add `--space-section: 40px / 56px`, `--space-card: 14px`. Optional. |
| Radii | 12 / 16 / 24 / 32 + full. | Consistent. |
| Elevation | `e1–e3`; dark uses an inner light edge. | See UI-20. |
| Iconography | Lucide at 1.75 px stroke; custom category icons are still marked open (`AUDIT.md:157`). | Category glyphs are generic. Custom icons are an `[OPEN]` product item; do not build without the owner's go. |
| Imagery | Own or CC-licensed photos, WebP at 480 / 960 / 1600 with LQIP; 16:9 and 4:5 heroes; 4:3 cards. | No art direction per breakpoint (same crop for 4:5 phone hero and 16:9 laptop hero: `Hero.svelte:28-31` relies on `object-cover`). Add `object-position` from a focal point stored per photo (two numbers). |
| Dark mode | Complete. | UI-15. |
| Unfinished-looking | No-photo cards (UI-03), dashed "row empty" boxes on home (`+page.svelte:63-67`), plain `<input type="file">` in the booking-proof form (`VerdictVote.svelte:201-208`), privacy page marked draft. | Addressed in §5 and `UX_AUDIT.md`. |

## 3. Motion tokens (add to `web/app.css` `:root`)

```css
:root {
  /* Durations */
  --dur-instant: 80ms;    /* colour and opacity feedback under the finger */
  --dur-press:   120ms;   /* existing: press scale */
  --dur-state:   200ms;   /* existing: toggles, chips, tabs, hover */
  --dur-enter:   260ms;   /* element entering: cards, toasts, popovers */
  --dur-exit:    180ms;   /* element leaving: always shorter than enter */
  --dur-sheet:   320ms;   /* existing: sheets, drawers */
  --dur-page:    300ms;   /* view transitions */
  --dur-emph:    480ms;   /* one-off moments: stamp, gauge fill */
  --dur-count:   700ms;   /* number count-ups */
  --dur-shimmer: 1.2s;    /* existing */
  --dur-ambient: 6s;      /* slow loops: wave drift, tide line */

  /* Easing */
  --ease:        cubic-bezier(0.2, 0.8, 0.2, 1);   /* existing: default, decelerate */
  --ease-in:     cubic-bezier(0.4, 0, 1, 1);       /* exits */
  --ease-inout:  cubic-bezier(0.65, 0, 0.35, 1);   /* moves on screen, sheet snaps */
  --ease-linear: linear;                           /* shimmer, progress */
  /* Spring with a small overshoot (about 1.7 %). linear() needs Chrome 113, Safari 17.2, Firefox 112. */
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --ease-spring-soft: cubic-bezier(0.3, 1.25, 0.5, 1);

  /* Distances */
  --move-xs: 4px;   /* hover lift, press */
  --move-sm: 8px;   /* reveal offset */
  --move-md: 16px;  /* toast, popover */
  --move-lg: 32px;  /* page slide */

  /* Stagger */
  --stagger: 40ms;      /* per item */
  --stagger-max: 6;     /* items 7+ appear with the 6th */
}
@supports (animation-timing-function: linear(0, 1)) {
  :root {
    --ease-spring: linear(0, 0.006, 0.025 2.8%, 0.101 6.1%, 0.539 18.9%, 0.721 25.3%, 0.849 31.5%,
      0.937 38.1%, 0.968 41.8%, 0.991 45.7%, 1.006 50.1%, 1.015 55%, 1.017 63.9%, 1.001);
  }
}
```

**Spring configs for script-driven motion** (Svelte 5 `Spring` from `svelte/motion`, already in the framework, no new dependency):

| Name | stiffness | damping | Use |
|---|---|---|---|
| `snappy` | 0.25 | 0.7 | sheet release, tile press return |
| `gentle` | 0.12 | 0.8 | gauge segments, count-up easing target |
| `drag` | 1 | 1 | sheet follows the finger 1:1 while dragging (no spring) |

Count-ups use `Tween` with `duration: 700`, `easing: cubicOut`.

**Stagger rule:** item `i` (0-based) gets `animation-delay: calc(min(var(--i), var(--stagger-max)) * var(--stagger))`. Lists set `style="--i:{index}"`. Only the first screenful staggers; items revealed by scrolling use the scroll reveal instead.

**Reduced motion** (`prefers-reduced-motion: reduce`): the global rule in `web/app.css:531-540` stays. In addition:
- Add `web/lib/motion.ts` exporting `reducedMotion` (a `MediaQuery` from `svelte/reactivity`) and `dur(ms)` that returns 0 when reduced. All `Spring`, `Tween` and Svelte transitions take their duration from it (fixes UI-14).
- View transitions are already skipped under reduced motion (`web/routes/+layout.svelte:37`); keep.
- Opacity changes up to 200 ms are allowed under reduced motion (state must still be visible); movement, scale and loops are not.

**Data saver** (`navigator.connection?.saveData === true` or `prefers-reduced-data: reduce`): treat as reduced motion for ambient loops and scroll reveals, skip the 960 px photo in `srcset` on cards, and do not start any decorative animation before first input. Add `saveData` to `web/lib/motion.ts`.

**Utilities to add (Tailwind `@utility` in `app.css`):** `enter-rise` (opacity 0 → 1, `translateY(var(--move-sm))` → 0, `--dur-enter`, `--ease`, with the stagger delay), `press` (`active:scale-[.97]`, `--dur-press`), `pop` (scale 0.8 → 1 with `--ease-spring`, `--dur-emph`), `reveal` (scroll-driven, §4.3).

## 4. Motion specifications

### 4.1 Page transitions
- Mechanism: the existing `onNavigate` + `document.startViewTransition` hook. Add `document.documentElement.dataset.nav = 'forward' | 'back' | 'tab'`, set from `nav.type` and `nav.delta` (`popstate` with negative delta = back; a bottom-nav target = tab).
- Tab switches (bottom nav): cross-fade only, `--dur-state`.
- Forward into a detail page: old page fades to 0 over `--dur-exit` with `--ease-in`; new page fades in and rises `--move-sm` over `--dur-page` with `--ease`.
- Back: mirror, new page comes down `--move-sm`.
- The top bar and bottom nav get `view-transition-name: topbar` / `appnav` so they stay still while content changes.
- Fallback (no View Transitions API, mainly older Firefox and WebView): no animation. Do not polyfill.

### 4.2 Shared element: card → detail
- The tapped card's photo wrapper gets `view-transition-name: hero` at click time only (set in a `pointerdown`/`click` handler on `ListingCard`, removed after `nav.complete`), so at most one element carries the name. The detail page's `Hero` wrapper carries the same name permanently.
- Timing: `--dur-page`, `--ease-inout`. The browser morphs position, size and corner radius (`::view-transition-group(hero)`), and cross-fades the 480 px card image into the hero image.
- The card's title is not morphed (different font size and wrapping in three scripts causes a visible jump).
- No-photo cards morph the tinted block the same way.
- Back navigation: the detail page sets the name on its hero; the list page sets it on the card whose `href` matches `nav.from.url.pathname`.

### 4.3 Scroll-triggered reveals
- CSS scroll-driven animation only, inside `@supports (animation-timeline: view())`; browsers without it show content immediately (no IntersectionObserver fallback, to keep JS out).
  ```css
  @utility reveal {
    @supports (animation-timeline: view()) {
      animation: reveal-in linear both;
      animation-timeline: view();
      animation-range: entry 0% entry 40%;
    }
  }
  @keyframes reveal-in { from { opacity: 0; transform: translateY(var(--move-sm)); } }
  ```
- Applied to section blocks below the first screen on Discover and detail pages. Never to text the user came to read first (title, verdict, safety status), never to anything inside a horizontally scrolling row, never on the map page.

### 4.4 Micro-interactions
| Element | Trigger | Motion |
|---|---|---|
| Buttons, tiles, chips | press | scale 0.97, `--dur-press` (exists for buttons; extend to `Chip`, `IconButton`, nav items) |
| Cards (pointer devices) | hover | photo scale 1.03 (exists); card `translateY(-2px)`; shadow by opacity of a pre-drawn `::after` layer, `--dur-state` |
| Heart | save | icon scales 1 → 1.3 → 1 with `--ease-spring`, `--dur-emph`; fill colour snaps at the start; `navigator.vibrate?.(10)` when available |
| Heart | unsave | fill fades over `--dur-instant`; no scale |
| Chip / segmented control | select | the selected background slides between options (`translateX`, `--dur-state`, `--ease-inout`) instead of each option recolouring |
| Bottom nav | select | the active dot slides to the new tab (one absolutely positioned dot, `translateX`); icon colour fades |
| Toast | in / out | rise `--move-md` + fade, `--dur-enter` / `--dur-exit` |
| Language switch | change | full reload today; add a `--dur-state` fade of `main` before the form posts |
| Form submit | pending | Crabby sidestep in the button (exists) |
| Copy link | success | icon swaps to a check for 1.2 s with a `pop` |

### 4.5 Loading
- **Skeletons:** keep the layout shapes. Replace per-block `background-position` animation with one `::after` on the skeleton group: a 40 %-wide gradient band moved by `transform: translateX(-100% → 250%)`, `--dur-shimmer`, linear, `mix-blend-mode: plus-lighter` in dark and `multiply` in light. One compositor animation per group instead of N paints.
- **Image blur-up:** LQIP is already the background. Add `opacity: 0 → 1` over `--dur-state` on the `<img>` when it has loaded (`onload` sets a class; if `img.complete` at mount, no animation).
- **Pull to refresh:** do not build a custom one. Keep the browser's native gesture; in standalone PWA mode on Android it is still provided. A custom implementation fights `overscroll-behavior` and costs input latency. If the owner wants a branded one later, it is a wave line that fills as the user pulls, on Discover only.
- **Route-level pending:** a 2 px kokum progress line under the top bar that appears if a navigation takes more than 150 ms (`navigating` from `$app/state`), animating `scaleX` 0 → 0.8 over 2 s then to 1 on completion.

### 4.6 Bottom sheet and map
- **Sheet:** render at full height once; position with `transform: translateY(calc(100% - var(--sheet-h)))`. During drag, set `--sheet-h` from pointer position with no transition. On release, animate to the nearest snap with a `Spring` (`snappy`), using release velocity to choose the snap when it exceeds 0.5 px/ms. Content scrolls only at `full`. Height of the scroll area is fixed, so no layout happens during the move. Under reduced motion, snap instantly.
- Keep keyboard behaviour (tap to cycle, `aria-expanded`) exactly as now (`BottomSheet.svelte:68-82`).
- **Selected pin:** MapLibre symbol layers stay unanimated (performance decision T-52). Add one DOM `Marker` for the selected pin only: a ring that scales 0.6 → 1 with `--ease-spring`, `--dur-emph`, then stays. Removing selection fades it over `--dur-exit`.
- **Live crowd pulse** (`StatusBadge` `.pulse`): keep, but only when the data is live (already conditional on `props.live`, `StatusBadge.svelte:51`). Use `--dur-ambient / 3`.
- **Map fly-to:** already disabled under reduced motion (`MapView.svelte:863`); keep.

### 4.7 Rating flow (verdict level, traveller group, sub-scores)
Goal: one tap feels finished within 100 ms and the page shows the effect without a reload.

1. **Tap a verdict tile** (`VerdictVote.svelte:140-156`):
   - Immediately (optimistic): the tile takes its verdict colour; the check mark `pop`s in the corner; the tile's icon does a 12° tilt and back (`--dur-emph`, `--ease-spring`). `navigator.vibrate?.(12)`.
   - The other three tiles fade to 60 % opacity for `--dur-state`, then return.
   - No toast on success. On failure, the tile shakes 3 × 4 px (`--dur-state`) and reverts, with a toast.
2. **Gauge reacts** (`VerdictGauge.svelte`):
   - Segments are `flex-grow` values today. Render each segment at full width and scale it with `transform: scaleX()` from a `Tween` per segment so the bar re-balances over `--dur-emph` without layout.
   - The percentage counts from the old to the new value over `--dur-count` with `tabular-nums`; the `sr-only` text updates once at the end.
   - First view: when the gauge scrolls into view, segments grow from 0 left to right with a 60 ms stagger, and the percentage counts up from 0. Once per page view.
   - "New" (under 10 votes) state: the dashed bar draws itself (`stroke-dashoffset` on an SVG rect) over `--dur-emph`.
3. **Sub-score taps** (0–5 dots, `VerdictVote.svelte:171-187`):
   - Dots up to the tapped value fill left to right with a 30 ms stagger (`scale 0.6 → 1`, `--ease-spring`); the public bar in `SubScores` animates its `scaleX` to the new average.
   - Locked hygiene / cleanliness: tapping a disabled dot nudges the lock icon (4 px, once) and scrolls the "verified visitors only" explanation into view. No toast.
4. **Group switch** (`Segmented`): the selected pill slides; the tiles' selected state cross-fades to that group's saved verdict.
5. **Review sent:** the form collapses (`grid-template-rows: 1fr → 0fr`, `--dur-sheet`) into a line "Sent for review" with a Crabby `waving` (already drawn, `Crabby.svelte:64-77`).
6. **Verified visit granted** (from the QR page or a booking proof): the lock on hygiene / cleanliness opens (two-frame SVG, `--dur-emph`) and the row gains a lagoon outline for 1.5 s.

Data change needed: replace `invalidateAll()` with a local optimistic store and a targeted `invalidate('app:ratings')` (also listed as Q6 in `ARCHITECTURE.md`).

### 4.8 QR scan success
The QR page is standalone HTML with a strict hash-based CSP and a 100 KB budget (`web/lib/qr/page.ts`, `AUDIT.md:53`). Everything here is inline CSS, no script additions beyond toggling a class in the existing handler.
- On page load: the place name fades up (`--dur-enter`); nothing else moves (people are outdoors, often on slow phones).
- On "Verify visit" success (`j.verified` in the inline script, `page.ts:48`): the status paragraph gets class `ok`, which shows an inline SVG stamp: a circle that draws itself (`stroke-dashoffset`, 480 ms), a check that draws after it (200 ms), and a short dashed ring that scales 0.8 → 1 with the spring curve. Lagoon colour. Text: the existing `tOk` string.
- On "too far": the distance text appears with no animation, caution colour.
- The inline script change alters its hash; `qrCsp()` computes the hash from the `JS` constant, so it stays in sync automatically (`page.ts:228-230`).
- Budget: under 1.2 KB of CSS + SVG added.

### 4.9 Crabby thinking and streaming
Depends on streaming from the server (`AI_AUDIT.md` AI-02).
- **Thinking:** a Crabby bubble with the mascot `walking` and one status line that changes with server events: "Looking up places…", "Checking tides and weather…", "Building your plan…", "Writing the answer…". Each line cross-fades (`--dur-state`). Lines come from event types, not from model text.
- **Streaming text:** append tokens as they arrive; no per-character animation. A soft caret (2 px lagoon bar, 1 s opacity blink) at the end while streaming; removed on completion. Under reduced motion the caret is static.
- **Action preview cards** (`ActionPreviewCard.svelte`): enter with `enter-rise` after the text finishes; Apply shows the button's pending Crabby, then the card collapses to a one-line confirmation with a `pop` check.
- **Question cards:** options stagger in (`--stagger`).
- **Unavailable / limit:** no animation; an illustration from §5.3.

### 4.10 Numbers
`Tween`-driven count-ups for: verdict percentage, vote count on first view, trip budget totals (`BudgetCard.svelte`), expense balances, "n places in view" on the map (debounced 200 ms so panning does not spin the number). Rule: count only when the number changes because of something the user just did or when it first enters the viewport; never on every re-render. Use `tabular-nums` and a fixed-width container to avoid layout shift.

### 4.11 Empty and error states
The vignette fades in and rises `--move-sm` once. One ambient loop per vignette, 6 s, paused when off-screen (`animation-play-state` via scroll-driven `view()` where supported): boat rocks ±2°, fort flag waves, crab eyes blink every 4 s. Disabled under reduced motion and data saver.

## 5. Graphics

### 5.1 Hero and section graphics
- **Discover hero (phones):** today a heading, search and the Today strip on a flat background (`web/routes/+page.svelte:86-92`). Add an SVG coastline band behind the heading: three wave lines in `--lagoon-100`, `--kokum-100`, `--alphonso-50`, 100 % wide, 96 px tall, about 1.5 KB inline. The lines drift horizontally by `translateX` at different speeds (`--dur-ambient` × 1, 1.4, 1.9). This is not parallax (nothing is tied to scroll).
- **Section dividers:** a single laterite-stone course (a row of rounded rectangles of varying width, 6 px tall, `--laterite-50`) between Discover sections in place of whitespace alone. Static.
- **Today strip:** the tide state gets a tiny water-level bar that sits at the current height between low and high (data already loaded for the strip). Static position; no fake movement.

### 5.2 No-photo cards (UI-03)
Replace the single wave mask with one SVG scene per family, each under 1.2 KB, drawn in tokens so both themes work:
| Family | Scene | Colours |
|---|---|---|
| coast (beach, backwater, stays) | horizon line, three wave lines, a leaning coconut palm | lagoon-50 ground, lagoon lines, alphonso sun |
| heritage (fort, temple, museum, dishes) | laterite wall courses with a bastion or a temple shikhara silhouette | laterite-50 ground, laterite shapes |
| land (waterfall, viewpoint, village, orchard, market, eateries) | Sahyadri ridge lines with a mango or cashew branch | ok-50 ground, ok and caution accents |
Keep the "Photo coming soon" label and the category glyph. The scenes are decoration (`aria-hidden`).

### 5.3 Illustration set (same style as `Illustration.svelte`: flat fill + 1.5 px line, 160 × 100, < 3 KB each)
Existing: `fort`, `boat`, `crab`. Add: `net` (no results for these filters: an empty fishing net), `tide` (rate limit / try later: a tide pole at high water), `lamp` (Crabby unavailable: a lighthouse with the lamp off), `compass` (GPS denied or unavailable), `crate` (offline pack downloading: a mango crate being filled, with a determinate fill tied to real progress), `plaque` (QR code not found: a blank laterite plaque).

### 5.4 Patterns and textures
- **Wave line** (exists in `NoPhoto.svelte:58-62`): promote to a shared `pattern-waves` utility.
- **Laterite course:** §5.1.
- **Mat weave:** a 12 × 12 px two-line weave at 3 % opacity for the background of empty list areas and the plan workspace's empty day. One data-URI.
- No noise textures or large gradient meshes (banding and paint cost on low-end Android).
- Gradients: only scrims on photos (bottom 0 → 70 % `--scrim`) and the alphonso sun disc. No glass additions.

### 5.5 Share (OG) cards
- 1200 × 630, generated on request and cached: left 60 % the listing photo (or the family scene from §5.2), right 40 % paper background with the name in Garamond, the verdict label and percentage, the category, and the wordmark.
- Implementation without a new runtime dependency: an endpoint `/og/[type]/[slug].svg` that returns an SVG built by string template (same escaping helper as `web/lib/qr/page.ts:11-15`) with `Cache-Control: public, max-age=86400`. WhatsApp and most social scrapers need PNG or JPEG, so SVG alone is not enough: rasterising needs either a build-time step (a pipeline script that renders PNGs for all published listings into the `photos` bucket, run after publishing) or a WASM rasteriser at the edge (new dependency, roughly 1 to 2 MB in the server bundle, not in the client). Recommend the pipeline route first: zero runtime cost, fits the existing pipelines folder.
- Devanagari names need the Anek font embedded in the SVG at render time (pipeline has file access).

### 5.6 Image optimisation
- Already in place: client-side WebP at 480 / 960 / 1600, LQIP, `sizes`, lazy loading on cards, `fetchpriority="high"` on heroes.
- Add: `width` / `height` on hero images from the stored dimensions to remove any layout shift; focal point (`photos.focus_x, focus_y`, a migration) → `object-position`; `content-visibility: auto` with `contain-intrinsic-size` on below-the-fold card rows.
- AVIF: not worth it now. Encoding happens in the field team's browser, where AVIF encode support is poor; a pipeline re-encode of the 155 existing files would save bytes only on heroes. Revisit when the photo count is above about 1,000.

### 5.7 Map styling
`web/lib/map/style.ts` builds a custom style on the Protomaps basemap (198 lines; not reviewed line by line in this session). Direction: water in `--lagoon-50`, land in `--bg`, forest in a desaturated `--ok-50`, roads neutral with ghat sections in `--caution`, labels in Figtree with the Devanagari half, pins using the verdict ramp only on the pin sheet (never on the map, to keep ratings out of the at-a-glance layer). Check on device that the dark style keeps road contrast above 3:1.

## 6. Performance guardrails

| Rule | Detail |
|---|---|
| Animate only `transform` and `opacity` | Exceptions: `grid-template-rows` for the one collapse in §4.7, `stroke-dashoffset` on small SVGs. Never `height`, `width`, `top`, `box-shadow`, `filter`, `backdrop-filter`, `background-position`. |
| Glass budget | At most two `backdrop-filter` surfaces visible at once (top bar and bottom nav). Chips and badges over photos use a solid `--glass`-coloured fill without blur at phone widths. Nothing animates on top of or underneath a blurred surface. |
| `will-change` | Set only for the duration of an interaction (sheet drag, gauge fill), removed after. |
| Low-end detection | `navigator.deviceMemory <= 2` or `hardwareConcurrency <= 4` → treat as data saver for ambient loops and reveals; replace glass with solid surfaces. Stored in `web/lib/motion.ts`. |
| Frame budget | Any interaction animation must hold 60 fps (16.7 ms) on a 4× CPU-throttled Chrome profile of `/`, `/place/:slug` and `/map`. No long task above 50 ms caused by animation code. |
| Web Vitals | LCP element is the Discover heading or the hero image: neither may start at `opacity: 0` (reveals exclude them). CLS stays 0: all animated elements reserve their final size. INP: handlers apply the optimistic class first, then start network work. |
| CSS weight | Added motion and graphics CSS ≤ 4 KB gzipped in the app stylesheet; inline SVG scenes ≤ 6 KB total, loaded with the components that use them. |
| JS weight | No new dependency. `web/lib/motion.ts` ≤ 1 KB. Shell stays under the existing 200 KB e2e budget. |
| Test | Extend the Playwright shell suite: with `reducedMotion: 'reduce'`, assert no element has a running animation after load (`document.getAnimations().length === 0`). |

## 7. Library decisions

| Option | Decision | Reason |
|---|---|---|
| View Transitions API | **Use** | Already used; gives page and shared-element transitions with no JS weight. Missing support degrades to no animation. |
| CSS scroll-driven animations | **Use behind `@supports`** | Already used for the scroll progress bar (`ScrollProgress.svelte`). No JS. |
| `svelte/motion` (`Spring`, `Tween`), `svelte/transition` | **Use** | In the framework; needed for drag physics and count-ups. |
| Motion (Framer Motion's vanilla successor) | No | About 5 to 18 KB gz for features covered above. |
| GSAP | No | About 25 KB gz core; licence and weight not justified for the effects specified. |
| Lottie | No | Player is about 60 KB gz (light player about 15 KB) plus JSON per animation; the mascot is 1 KB of SVG and CSS already. |
| Rive | No | WASM runtime about 150 KB. |
| Custom pull-to-refresh | No | §4.5. |

## 8. Screen by screen

| Screen | Before (from code) | After: what changes visually | After: what moves | Notes |
|---|---|---|---|---|
| Home / Discover (`routes/+page.svelte`) | Heading, search, Today strip; category photo tiles; rows of cards, most without photos; dashed boxes for empty rows. | Coastline band behind the heading; family scenes on no-photo cards; laterite course between sections; weave texture in empty rows with a one-line prompt. | First screen: heading, search, strip rise in with stagger (3 items). Wave lines drift. Rows below reveal on scroll. Card → detail morph on tap. | LCP heading must not start hidden: stagger applies to search and strip only. |
| Place guide (`routes/place/[slug]`) | 4:5 immersive hero under a transparent bar; title sheet overlapping; badges; story; nearby; verdict; vote; facts; status. | Focal-point crop; hero credit pill solid on phones; verdict card gets the animated gauge; safety status block keeps plain styling. | Hero arrives by shared-element morph, then settles from scale 1.04 to 1 once (`--dur-emph`). Top-bar title fade on scroll (exists). Sections reveal. Gauge fills when visible. | No motion on the status / safety block. |
| Food list and detail (`routes/food`) | Filter controls; rows on phones, cards on laptops; detail with menu, dishes, sub-scores. | Same card treatment; dish chips with a small steam glyph for signature dishes (static). | List items stagger on first load (6 max); filter change cross-fades the list (`--dur-state`) and moves kept items with `animate:flip` (Svelte built-in). Sub-score bars fill on view. | Flip only when the list has ≤ 30 items. |
| Stays list and detail (`routes/stays`) | Same list pattern; price table; request form. | Vibe filter shown as a horizontally scrolling chip row with a sliding selection instead of a select; price table rows get a provider mark column. | Chip selection slides. Price rows stagger in. Booking link press shows the outbound interstitial (see `UX_AUDIT.md` UX-07). | Sponsor label stays grey and static. |
| Map (`routes/map`) | Full-screen map, glass chips, search, bottom sheet at peek / half / full by height. | Chips lose blur on phones (solid fill); selected pin ring; sheet with a clearer handle shadow. | Sheet on transform with spring release; selected pin ring pops; "n in view" counts with debounce. | No reveals, no ambient loops on this page. |
| Trip planner (`routes/plan/[id]`) | Setup form in the workspace; day lists with drag-and-drop; budget; chat; sheet-as-column on laptops. | Empty day uses the weave texture and a short prompt; generate button shows staged progress text. | Generating: stops enter day by day with stagger; route strip draws left to right (`scaleX`); budget totals count up. Drag-and-drop keeps `svelte-dnd-action`'s flip. Saving indicator cross-fades saved / saving / offline. | Realtime updates from tripmates fade in with a 1.5 s lagoon outline so changes by others are noticeable. |
| Rating flow (`VerdictVote`, `VerdictGauge`, `SubScores`) | Tiles, dots, toast, full reload. | Selected tile in verdict colour with a check; lock opens after verification. | §4.7 in full. | Optimistic state is required for this to feel right. |
| QR landing (`/q/[code]`) | System-font static page; verify button; text result. | Stamp graphic on success; nothing else added. | §4.8. | Stay under 100 KB; no web fonts. |
| Booking redirect | None exists: a plain external link (`PriceTable.svelte:30`). | New interstitial sheet: "You are leaving Crabwalk for <provider>. We never take payment." with provider name, price source and Continue. | Sheet rises (`--dur-sheet`); Continue shows a 600 ms progress line then opens the link. | Needs the `/out/:offerId` endpoint from SEC-27. |
| Search and filters (`SearchBox`, `ListControls`) | Search box with grouped results; filter selects; "clear all". | Results grouped with small kind icons; recent searches when empty; `net` illustration for no results; active filter count on the filter button. | Results stagger (40 ms, 5 max); skeleton rows while loading; filter sheet rises; applied chips pop in. | Debounce stays; no animation per keystroke. |
| Crabby (`/crabby`, dock) | Bubbles; action cards; question cards; whole-reply rendering. | Stage line while thinking; streamed text; `lamp` and `tide` illustrations for unavailable and limit. | §4.9. | |
| Me, journal, report | Lists and forms. | Stamp passport (feature F1) is the visual centre once built. | Stamps `pop` in the first time they are seen. | Later tier. |

## 9. Owner decisions needed

| # | Question | Default taken in this plan |
|---|---|---|
| 1 | Allow true scroll parallax on heroes? It is banned by `CRABWALK_FRONTEND.md:299`. | No. One-time hero settle instead. |
| 2 | Glass on chips and badges over photos at phone widths: keep the blur (locked look, T-1) or go solid for frame rate? | Solid on phones, glass from `lg` up. Needs sign-off because T-1 is locked. |
| 3 | Custom category icons and richer Crabby art are `[OPEN]` items. | Not built; no-photo scenes and vignettes only. |
| 4 | OG images by pipeline (free, static) or at the edge (new server dependency)? | Pipeline. |
| 5 | Haptics (`navigator.vibrate`) on vote and save? | Yes, 10–12 ms, Android only (iOS ignores it). |

## 10. Accessibility of motion and graphics

- Every animation has a reduced-motion form (§3). The Playwright check in §6 enforces it.
- No flashing: nothing changes luminance more than three times a second; the only blink is the streaming caret at 1 Hz, opacity 1 → 0.3.
- Focus is never moved by an animation; focus rings are not animated; view transitions keep focus on the navigated-to page's heading (SvelteKit default focus handling stays).
- All decorative SVGs are `aria-hidden`; informative graphics (gauge, sub-score bars, stamp) keep text equivalents (`VerdictGauge.svelte:76-78` already does; the stamp reuses the status paragraph with `role="status"`).
- Count-ups: assistive text updates once with the final value (`aria-live` regions are not attached to the animating node).
- Contrast: new illustration colours are tokens already covered by `web/lib/contrast.test.ts`; add the category-tile sample test from UI-16.
- Alt text: listing photos use the listing name today (`web/lib/server/qr.ts:74-76`, `photoUrls`). Add an optional `photos.alt` column so the field team can describe the scene; fall back to the name.
- Touch targets: animated elements keep their 44 px hit area during and after scale changes (scale the inner icon, not the button box).
