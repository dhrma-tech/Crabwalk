# CRABWALK — FRONTEND SPEC (Prompt for Claude Code)

> Execution order lives in `CRABWALK_PLAN.md`. API and data live in `CRABWALK_BACKEND.md`.
> Design source of truth: `docs/Crabwalk Design.md` ("Laterite and sea" — LOCKED).
> Tags: `[LOCKED]` do not change · `[DEFAULT]` overridable in Phase 0 · `[OPEN]` ask the user first.
> Framework is `[OPEN]` (gate G1: SvelteKit vs Next.js). Everything below is framework-neutral; map routes/components to the chosen framework's conventions.

---

## 1. APPS

| App | Purpose | Constraints |
|---|---|---|
| `apps/web` | Main PWA (all screens except QR scan page) | App shell < 200 KB JS gzipped initial; installable; offline-capable |
| `apps/qr` | Standalone QR scan page `/q/:code` | < 100 KB total; no webfonts; no JS framework; loads on 2G |

---

## 2. DESIGN TOKENS (P2) `[LOCKED]` — copy exactly

```css
:root {
  --laterite:#B5462B; --sea:#0E6E6A; --mango:#E8A33D; --sand:#F6EFE4;
  --bg:#F6EFE4; --surface:#FBF8F2; --surface-raised:#FFFFFF; --border:#E9DFCF;
  --text:#1E1B16; --text-2:#5A4A35; --text-muted:#8A7A64;
  --cta:#B5462B; --on-cta:#FFFFFF; --link:#0E6E6A; --highlight:#E8A33D;
  --ok:#2E7D32; --caution:#B7791F; --danger:#C62828; --emergency:#D32F2F;
  --sponsor:#8A7A64;
  --v4:#0E6E6A; --v3:#6FC1BA; --v2:#E8A33D; --v1:#D9CBB5;
  --font-display:"Baloo 2",system-ui,sans-serif;
  --font-body:"Mukta",system-ui,"Noto Sans Devanagari",sans-serif;
  --r-chip:999px; --r-card:16px; --r-sheet:24px; --r-input:12px;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg:#16120E; --surface:#221C16; --surface-raised:#2C251D; --border:#3A3128;
    --text:#F3EADC; --text-2:#C9BBA6; --text-muted:#8F826F;
    --cta:#E0745A; --on-cta:#1E0B05; --link:#4FB3AC; --highlight:#F0B451;
  }
}
:root[data-theme="dark"] {
  --bg:#16120E; --surface:#221C16; --surface-raised:#2C251D; --border:#3A3128;
  --text:#F3EADC; --text-2:#C9BBA6; --text-muted:#8F826F;
  --cta:#E0745A; --on-cta:#1E0B05; --link:#4FB3AC; --highlight:#F0B451;
}
:lang(mr), :lang(hi) { line-height: 1.65; letter-spacing: 0; }
```
(`:root[data-theme="dark"]` block added so the manual override in Me works — same values as Design §2.3.)

### 2.1 Tonal ramps (Tailwind `theme.extend.colors`)
| Step | laterite | sea | mango | sand |
|---|---|---|---|---|
| 50 | #FBE9E2 | #DDF3F1 | #FCF0DA | #FBF8F2 |
| 100 | #F4CBBE | #B3E2DE | #F8DDAA | #F6EFE4 |
| 200 | #E59A82 | #6FC1BA | #F2C46E | #E9DFCF |
| 500 | #B5462B | #0E6E6A | #E8A33D | #8A7A64 |
| 700 | #8C3420 | #0A5350 | #A8721F | #5A4A35 |
| 900 | #4A1A0E | #05302E | #4A2E05 | #1E1B16 |
`fontFamily.display` = Baloo 2, `fontFamily.body` = Mukta.

### 2.2 Colour rules (enforce)
- Mango = **fill only, never text**. Text on mango = `#4A2E05`.
- `--text-muted` only for ≥14 px captions/metadata, never body.
- Semantic colours (ok/caution/danger/emergency/sponsor) never used for brand.
- `--emergency` appears ONLY on emergency card / QR emergency button.
- Every semantic colour is paired with icon + text label.
- Low verdicts are not red.
- Never generic "travel app blue".

### 2.3 Typography
| Token | Size/LH | Font |
|---|---|---|
| display | 28/34 | Baloo 2 700 |
| h1 | 22/28 | Baloo 2 700 |
| h2 | 18/24 | Baloo 2 600 |
| h3 | 16/22 | Mukta 600 |
| body | 16/24 | Mukta 400 (never < 16 for body) |
| small | 14/20 | Mukta 400 |
| tiny | 12/16 | Mukta 600 (badges/chips only) |
- Self-host WOFF2, subset Latin + Devanagari, `font-display: swap`, max 4 files, no Google Fonts CDN at runtime.
- Story font: Tiro Devanagari Marathi `[OPEN]` (G11).
- No ALL CAPS anywhere. No letter-spacing on Devanagari.
- Bilingual names: primary language on top, other script below in `--text-2`.

### 2.4 Layout
- Spacing: 4, 8, 12, 16, 24, 32, 48 (`--s-1`…`--s-7`). Gutter 16 px. Desktop max 1200 px, reading width 680 px.
- Breakpoints: 360 (base), 640, 1024, 1280.
- Radius: chips/buttons 999 px, cards 16 px, sheets 24 px top, inputs 12 px.
- Flat cards with 1 px border. Shadow only on floating elements: `0 4px 16px rgba(30,27,22,.12)`.
- Touch targets ≥ 44×44 px, ≥ 8 px apart. Primary actions in bottom 40% of screen.
- Respect `env(safe-area-inset-*)`.

---

## 3. ICONS AND IMAGERY (P2)
- UI icons: Lucide, outline, 1.75 px stroke, 20/24 px.
- Category icons (11): beach, fort, temple, waterfall, viewpoint, backwater, cave, museum, village, market, orchard — same glyphs as map pins. Custom set is `[OPEN]` (in-house vs commission) — use Lucide placeholders behind an `<CategoryIcon>` wrapper so swapping later is one file.
- Utility pins: neutral grey (fuel, ATM, hospital, pharmacy, police, toilet, EV, mechanic, bus, rail, ferry).
- Photos: verifier-shot only; cards 4:3, hero 16:9; lazy, AVIF/WebP, `srcset`, LQIP blur placeholder.
- Illustration: flat, laterite/sea/mango only (empty states, onboarding, errors).
- Crabby mascot: design `[OPEN]` (artist). Use a placeholder SVG behind `<Crabby>` component. Never on safety screens.
- Texture (optional) ≤ 6% opacity in headers; not on QR page.

---

## 4. ROUTES (map to framework from G1)

| Route | Screen # | Phase | Auth |
|---|---|---|---|
| `/` | 1 Discover | P4 | public |
| `/place/:slug` | 2 Place page | P4 | public |
| `/q/:code` | 3 QR scan (served by `apps/qr`) | P6 | public |
| `/map` | 4 Map | P3 | public |
| `/stays`, `/stays/:slug` | 5 | P4 | public |
| `/food`, `/food/:slug` | 6 | P4 | public |
| `/taste-konkan`, `/taste-konkan/:dish` | 7 | P4 | public |
| `/plan/new` | 8 Planner input | P7 | user |
| `/plan/:id` | 9 Plan view | P7 | user (owner) |
| `/plan/share/:token` | 9 read-only | P7 | public |
| `/plan/vote/:token` | 10 Group vote | P7 | public (guest) |
| `/trip/live/:id` | 11 Live trip | P9 | user |
| `/navigate` | 12 Navigation | P9 | public `[DEFAULT]` |
| `/crabby` | 13 Chat | P8 | user |
| `/me` | 14 Me | P2 (shell) → filled each phase | user |
| `/admin/field` | 15 Verifier form | P4 | verifier |
| `/admin/reports` | 15 Report triage | P6 | verifier |
| `/admin/review` | content approval | P4 | reviewer |
| `/owner` | 16 Owner claim/edit | P4 | owner |
| `/start` | 17 Station/bus QR landing | P6 | public |
| `/itineraries`, `/itineraries/:slug` | ready-made | P7 | public |

---

## 5. NAVIGATION SHELL (P2) `[LOCKED]`
- Bottom nav (5): Discover · Map · **Crabby (centre, raised)** · Plan · Me.
- Top bar: back, title, language switch (EN / हि / म), search.
- Desktop: left rail replaces bottom nav; Crabby becomes right-side panel.
- Crabby floating bubble bottom-right above nav on every page (P8) — hidden on emergency/safety UI.

---

## 6. COMPONENTS (P2 build; filled in later phases)

### 6.1 Buttons
| Variant | Style | Rule |
|---|---|---|
| Primary | laterite fill, white text, pill, 48 px | ONE per screen |
| Secondary | sea outline + sea text, 40 px | |
| Ghost | sea text only, 40 px | |
| Emergency | `--emergency` fill, white, phone icon | emergency card / QR only |
Loading = Crabby spinner, keep label.

### 6.2 Chips and tags
- Filter chip: sand-50 bg + border; selected = sea fill + white text + check icon.
- Vibe tag: small, sand-100 fill, `--text-2`.
- Max 3 tags on cards, then "+N".

### 6.3 Cards
- **PlaceCard:** photo 4:3 → name (EN + MR) → category icon + distance → mini verdict bar → up to 2 badges (crowd, tide/monsoon) → heart top-right.
- **StayCard:** photo → name → vibe tags → price range ("₹1,800–2,500 · from Agoda") → verdict → service style icon (homely/professional) → heart.
- **EateryCard:** photo → name → authenticity tag → signature dish → price for two → veg/non-veg/Jain dots → verdict → heart.
- Tap → detail.

### 6.4 VerdictGauge (P5) `[LOCKED]`
- Horizontal segmented bar, 4 colours (`--v1`…`--v4`) + winning verdict label + % + vote count.
- Labels by type: place (Skip · Timepass · Worth it · Must visit), stay (Avoid · Okay · Good stay · Perfect stay), food (Skip · Okay · Go for it · Local legend).
- Group-type segmented control below: Family · Couple · Solo · Friends.
- "New" state (<10 votes): grey outline gauge + "New" label.
- Sub-scores: small labelled bars 0–5, sea fill. Hygiene/cleanliness bar shows lock icon + "Verified visitors only".
- Voting UI: 4 large verdict buttons (icon + label, no emoji) → optional quick-tap sub-scores → optional text/photo. Hygiene/cleanliness taps disabled with explanation unless verified.

### 6.5 StatusBadge
| Badge | Style |
|---|---|
| Tide accessible | `--ok` + wave icon + "Accessible till 4:30 pm" |
| Tide cut off | `--danger` + wave icon + "Next safe: 6:10 pm" |
| Monsoon open/risky/closed | ok/caution/danger + cloud-rain icon + reason |
| Crowd empty/calm/busy | sea-50 / sea-100 / mango-100 fill; sea-900 / mango-900 text; suffix "Live" or "Typical" |
| Hidden gem | mango fill + gem icon, text `#4A2E05` |
| Verified | sea outline + check |
| Last verified | muted text "Verified 3 Oct 2026" |

### 6.6 BottomSheet (map)
Peek (120 px: name + key badge) → half (details + actions) → full (full place page). Drag handle, 24 px top radius, snap points.

### 6.7 Crabby (P8)
- Floating bubble with context prompt chips (place page: "Best time to visit?", "Add to my trip").
- Full-screen chat: user bubbles sand-50, Crabby bubbles surface + crab avatar.
- **ActionPreviewCard:** proposed plan/edit → **Apply** (laterite primary) / **Discard** (ghost). Nothing changes until Apply.
- Plan stop reason chip ("Low crowd + sunset").
- Mic button (Web Speech API); recording pulses sea.
- "I don't know" state: honest message + verified alternative cards.
- Emergency keyword detection runs client-side BEFORE sending → slide up EmergencyCard, no network call to AI.
- Daily limit reached state (~20 msgs).
- Login wall for chat.

### 6.8 EmergencyCard `[LOCKED]`
Full-width sheet, `--emergency` header: **Call 112** (huge, `tel:112`), nearest hospital (distance + call + navigate), share live location (Web Share / SMS link with coordinates). Works offline (cached hospital list per taluka). No branding, no mascot, no bounce.

### 6.9 Tide components (P9)
Badge (above) + **TideTimeSlider** on map and place page: drag through day; spots recolour accessible/cut off; tide height curve; attribution "Tide data: TidesAtlas (CC BY 4.0)".

### 6.10 Alerts and banners
Monsoon/ghat/landslide banner: caution/danger fill-50, icon, reason, "Reported 2 h ago · expires in 22 h". Toasts: bottom above nav, 4 s, ink bg + sand text.

### 6.11 Inputs
48 px, 12 px radius, sand-50 fill, sea 2 px focus ring. Planner: stepper (days), segmented (pace, group), chips (interests), slider (budget ₹).

### 6.12 States
Skeletons sand-100 shimmer (static under reduced motion). Empty: Crabby illustration + invitation + one CTA. Offline banner: "You're offline — showing saved data" + taluka-pack status. Errors: what happened + what to do; never raw errors.

### 6.13 AudioGuidePlayer
Play/pause, 15 s back, speed 0.75–1.5×, transcript toggle, language follows UI.

---

## 7. SCREENS (layout order is LOCKED — Design §7)

1. **Discover (P4):** search bar → season strip ("Mango season · Turtle nesting" from `place_seasonal`/`events_calendar`) → category icon row (11) → "Hidden gems" carousel → ready-made itineraries → Taste Konkan dishes → near me.
2. **Place page (P4, gauge P5):** hero 16:9 → name EN/MR + category + badges → audio guide → verdict gauge → quick facts grid (timings, fee, best time, how to reach, nearest station) → story/history → do's & don'ts → monsoon/tide status → nearby (stays, food, utilities) → similar / less-crowded alternative (P8) → food-delivery availability → reviews → "Last verified".
3. **QR scan page (P6, `apps/qr`):** name + photo → audio guide → story → do's & don'ts → safety/status → Near me now → emergency button pinned bottom; language auto-detect + switch; sponsor line grey at bottom ("Supported by X"); report-a-problem link; system fonts only (`system-ui, "Noto Sans Devanagari", sans-serif`); plain HTML/CSS + tiny vanilla JS; < 100 KB; serves from PWA cache if installed.
4. **Map (P3; live layers P9):** full-screen MapLibre → search + filter chips top (category, vibe, verdict, veg, price, "Open now") → layer toggle FAB → tide slider when tide layer on → bottom sheet. "Open now": pins with unknown hours excluded and marked "hours unknown".
5. **Stays (P4):** filters (vibe, service style, price, amenities) → cards → detail: photos, verdict + sub-scores, amenities checklist, network strength by operator, food at stay, price compare table (Agoda live + affiliate links + direct call/WhatsApp; each row shows source).
6. **Food (P4):** filters (veg, authenticity, price) → cards → detail: signature dishes, menu, sub-scores, Swiggy/Zomato/other availability buttons (deep links).
7. **Taste Konkan (P4):** dish grid → dish page: what it is, story, where it's best (linked eateries).
8. **Planner input (P7):** stepped: days → start → group → budget → interests → pace → Standout toggle → Generate.
9. **Plan view (P7):** day tabs → timeline of stops (time, travel time, reason chip) → drag to reorder → add stay/meal → budget card (stay/food/fuel/entry/activities, editable vehicle/mileage, per-person split) → share / PDF / Google Maps per day.
10. **Group vote (P7):** no-login page: spot cards + vote buttons + name field → creator sees merged plan + trade-offs from Crabby (P8).
11. **Live trip (P9):** current stop card → next stop + ETA → nudge banners ("Running late — skip X?") → start navigation.
12. **Navigation (P9):** map + route line + big next-turn card + voice toggle + wake-lock indicator + limits notice (GPS pauses when minimized; iOS Safari restrictions) + "Open in Google Maps" for long highway drives.
13. **Crabby chat (P8):** §6.7.
14. **Me (P2→):** saved places, trips, preferences (veg, budget, group), language, theme, offline taluka packs, privacy/consent toggles (dwell time, push).
15. **Verifier admin (P4/P6):** field form — GPS auto-fill, photo capture (`capture` attr), fixed checklist, crowd level per day/season, monsoon status + reason, hidden-gem toggle, tide dependency, hours, fees, food-app availability; offline draft queue `[DEFAULT]`; report triage list.
16. **Owner claim (P4):** OTP (G5) → edit facts only: photos, prices, menu, timings, contact. Rating/review UI read-only.
17. **Station/bus landing `/start` (P6):** "Start your Konkan trip" → ready-made itineraries + planner CTA.

---

## 8. MAP (P3) `[LOCKED]`

- MapLibre GL JS + PMTiles protocol, tiles from `PMTILES_BASE_URL`. Never load Ola tiles.
- Style:
| Layer | Light | Dark |
|---|---|---|
| Land | #F6EFE4 | #16120E |
| Water | #B3E2DE, coastline #6FC1BA | #05302E |
| Parks/forest | #E3E8D4 | darkened `[DEFAULT]` |
| Major roads | #FFFFFF + #E9DFCF casing | #3A3128 |
| Ghat/warning roads | #E59A82 | same |
| Planned route | #0E6E6A 6 px + white 2 px casing | #4FB3AC |
| Labels | ink #1E1B16, sand halo, Mukta | light text |
- Pins: category glyph on laterite (places), sea (stays), mango (food). Clusters: sea circle + count.
- Utility layers toggle (11 types) — grey pins.
- "Busy now" heatmap: mango → laterite gradient + "Live"/"Typical" label (P9).
- Alerts layer with expiry text (P9). Trails layer + GPX download (P9). Tide layer + slider (P9).
- Attribution always visible: "© OpenStreetMap contributors"; add "Ola Maps" (linked to openstreetmap.org/copyright) whenever Ola results are on screen.
- Search: own DB first; if no match → Ola Autocomplete via `ola-proxy` (debounced). Ola results kept in device cache only.

---

## 9. PWA AND OFFLINE (P2 shell, P9 packs)
- Manifest (name Crabwalk, theme colour laterite, background sand), icons (placeholder until logo `[OPEN]`).
- Service worker: cache app shell; runtime cache for published content (stale-while-revalidate `[DEFAULT]`); QR page cached for installed users.
- Taluka packs (9): download PMTiles pack + listing data per taluka from Me / map; show size + version + delete.
- Saved trips: route shapes + stops cached automatically.
- Emergency hospital list cached per downloaded taluka.
- Ola responses: device cache only; never synced.
- Web push subscribe (P9) after consent; iPhone note: requires installed PWA.
- Wake lock during navigation.

---

## 10. i18n (P2) `[LOCKED]`
- Languages: `en`, `hi`, `mr`. Auto-detect from `navigator.languages`; one-tap switch in top bar; persist in profile/local.
- All UI strings in message files; content comes from `*_translations` tables.
- Set `lang` attribute on `<html>` and on mixed-language blocks.
- Numbers/₹ per locale with Indian grouping (₹1,25,000) via `Intl.NumberFormat('en-IN' | 'hi-IN' | 'mr-IN')`.
- Screen-reader labels in all 3 languages.
- Test every component with the longest Marathi string.
- Marathi copy is written natively and team-reviewed; never ship machine-literal strings without review flag.

---

## 11. PERFORMANCE BUDGETS (verify in P10) `[LOCKED]`
| Item | Budget |
|---|---|
| QR scan page | < 100 KB total, no webfonts, no framework, 2G |
| App shell | < 200 KB JS gzipped initial |
| Fonts | ≤ 4 WOFF2, subset |
| Images | AVIF/WebP, srcset, lazy, LQIP |
| LCP | < 2.5 s on 4G mid-range Android |
| Offline | shell + saved trips + chosen taluka packs |
Code-split map, planner, chat, admin routes. MapLibre loaded only on map/navigation/plan routes.

---

## 12. ACCESSIBILITY, MOTION, DARK MODE, COPY
- WCAG 2.2 AA; visible sea 2 px focus rings; icons labelled; colour never the only signal.
- Motion: 120 ms press, 200 ms state, 300 ms sheet/page; easing `cubic-bezier(.2,.8,.2,1)`; Crabby walks sideways as loader, claw-wave on success; no parallax; no bounce on safety UI; `prefers-reduced-motion` → fades or none.
- Dark mode: follows system, manual override in Me, auto-suggest dark during live navigation after sunset; warm dark.
- Copy: friendly local guide; sentence case; no "please", no "successfully", no exclamation marks in system text; buttons verb-first ("Add to trip", "Call 112", "Ask Crabby"); Crabby warm and a little playful, never jokes on safety.

---

## 13. HONEST-UI RULES (check on every screen)
- Every crowd/heatmap value labelled "Live" or "Typical".
- "Last verified" date on every place page.
- Price rows show their source.
- Sponsor line grey only, never near rating/ranking UI, never boosts order.
- Alerts show reported time + expiry.
- Hours unknown → say so; never assume open.

---

## 14. FRONTEND TESTS (minimum)
- Component snapshots in EN/HI/MR + dark mode (P2)
- Verdict gauge states: normal, tie, New, locked hygiene (P5)
- QR page size check in CI: fail build if > 100 KB (P6)
- Emergency keyword triggers card with zero AI network calls (P8)
- Offline: navigate saved trip with network disabled (P9)
- Lighthouse CI: PWA, a11y ≥ AA, LCP budget (P10)
