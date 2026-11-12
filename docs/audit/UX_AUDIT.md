# Crabwalk — UX audit (2026-11-12)

Derived from the route, component and server code. Step and tap counts are read from the code paths, not measured with users. I did not run the site on a device in this session; items that need a real phone are marked "check on device". `web/` = `apps/web/src/`.

**19 findings: 0 Critical, 5 High, 9 Medium, 5 Low.**

## 1. Core journeys

Taps exclude scrolling and typing; "screens" counts full page loads.

| Journey | Path in code | Screens | Taps | Friction and dead ends |
|---|---|---|---|---|
| **QR scan → guide** | `/q/:code` standalone HTML (`web/routes/q/[code]/+server.ts`, `web/lib/qr/page.ts`) | 1 | 0 | Strong: about 5 KB, no JS needed, 112 bar pinned. Weak points: the "Sign in" link after a 401 on Verify goes to `/login` with no return path (`page.ts:183`), so after signing in the visitor is not brought back to the plaque page (UX-04). The page offers the full guide and Crabby but no "save this place" or "add to my trip". |
| **Verify a visit** | Verify button → GPS prompt → `POST /q/:code/visit` | 1 | 2 (button, permission) | Result is one line of text. If GPS is denied the message says GPS is off, with no hint how to turn it on. The benefit ("unlocks hygiene rating") is stated before the tap but nothing links to the rating afterwards. |
| **Discover by vibe** | Home → "See all" on the stays row → filter sheet → Vibe | 3 | 4 | Vibe exists only as a stay filter (`web/lib/server/filters.ts:13-20`). Places have only `category` and `hidden_gem` (`:9-11`). There is no vibe entry on the home page and no vibe for food. The product promise "sorted by vibe" is not visible in the first screen (UX-01). Stays and Food are not in the bottom nav (`web/lib/components/AppNav.svelte:18-22`); they are reached from home rows or the top-bar menu. |
| **Plan a trip** | Nav "Plan" → `/plan/new` → redirect to `/plan/:id` → Trip setup form → Generate | 2 | 2 + form | Setup asks start point, days, date, group, people, budget, interests, diet, pace on one screen (`web/lib/components/plan/TripSetup.svelte`). No skip with defaults visible at the top ("Just plan 2 days from Ratnagiri"). Regenerate replaces the plan after a confirm; there is no undo. The page file is 939 lines with many sections; orientation on a phone depends on the outline component. Check on device. |
| **Choose a stay** | Home → stays → filter → card → detail → price table | 4 | 4–5 | The price table links straight out in a new tab (`web/lib/components/listing/PriceTable.svelte:30`). Nothing tells the user they are leaving or that Crabwalk takes no payment at that moment (UX-07). Availability request is a second path on the same page; the difference between "book on provider" and "ask the owner" is not explained side by side. |
| **Rate a place** | Detail → scroll to "Your verdict" → group (default Family) → tap a tile | 1 | 1–2 | The vote section sits below story, nearby and reviews on phones (`web/routes/place/[slug]/+page.svelte:242-256` after `:104-237`). Each tap reloads all page data (`VerdictVote.svelte:68`). Default group "Family" is silently applied; a solo traveller who does not notice the control votes as a family (UX-03). A user can vote in all four groups. Text reviews say "pending" with no expected time. |
| **Book via redirect** | Stay detail → price row link | 1 | 1 | No interstitial, no click record, no return prompt ("Did you book? Upload proof to rate cleanliness"). The booking-proof upload lives inside the vote section, far from the booking action. |

## 2. Findings

| ID | Sev | Finding | Evidence | Fix |
|---|---|---|---|---|
| UX-01 | High | Vibe discovery, a headline promise, is one filter on one list. No vibe entry on home, none for places or food. | `web/lib/server/filters.ts:9-20`; `web/routes/+page.svelte` (categories only) | A "Pick a vibe" chip row on home under the search box that deep-links to the lists with the filter applied; add a small vibe / mood tag set for places (data: a `tags` array already exists in admin fields; unverified whether it is populated) and for eateries; later, plain-language vibe search (feature F2). |
| UX-02 | High | Offline is uneven. Reading cached pages and packs works; votes, reviews, saves, reports and Crabby fail with "Couldn't send. Check the fields and try again." which blames the user's input. Only trip edits and field-team entries are queued. | `web/lib/saved.svelte.ts:53-56`, `VerdictVote.svelte:67`, `messages/en.json:309`, `web/lib/tripSync.svelte.ts`, `web/lib/field/queue.ts` | A shared outbox (IndexedDB) for verdicts, sub-scores, saves and reports with background retry when `online` fires; distinct copy for offline ("Saved on this phone. Will send when you are back online.") and for server errors. |
| UX-03 | High | The rating model is not explained where it is read or where it is given. The gauge is titled "What visitors say" with four bands and a group control; the vote defaults to "Family"; sub-scores show a lock with one line. No "how ratings work" anywhere. | `VerdictGauge.svelte:37, 94-100`, `VerdictVote.svelte:45, 124-133`, `messages/en.json:386-405` | A one-line caption under the gauge ("Most couples say: Worth it") that changes with the group; a "How ratings work" link opening a 4-point sheet (verdict words, groups, verified-only scores, moderation); ask "Who did you travel with?" once and remember it (profile `group_type` exists) instead of defaulting to Family; show the user's own vote on the gauge ("You: Must visit"). |
| UX-04 | High | Sign-in round trips lose context: the QR page links to `/login` without `next`; in temp-gate mode `/login` redirects to the admin gate on `/me?admin=1`, which is the wrong place for a traveller. | `web/lib/qr/page.ts:183`, `web/routes/login/+page.server.ts:14` | QR link becomes `/login?next=/q/<code>`; in temp mode hide sign-in links for guests entirely (they already have a session) and show the admin gate only from Me. |
| UX-05 | High | No analytics of any kind, so none of these journeys can be measured. | no matches for analytics libraries or event tables in `web/` | §7. |
| UX-06 | Med | First visit creates a guest account silently. Saves and trips live in that browser's session; clearing cookies or switching phones loses them, and nothing says so. There is no "keep my trips: sign in" upgrade path while the temp gate is on. | `web/lib/server/guest.ts`, `docs/RESTORE_AUTH.md:11` | A small notice on Me ("You are browsing as a guest. Trips and saves stay on this phone.") and, in full-auth mode, link the anonymous user to a real identity (`linkIdentity` / `updateUser`) so data carries over. |
| UX-07 | Med | Booking is an unannounced exit. | `PriceTable.svelte:30` | Outbound sheet with provider, price source and "Crabwalk never takes payment"; log the click; on return (page `visibilitychange` within 30 minutes) offer "Booked? Add your booking proof". |
| UX-08 | Med | Hindi and Marathi are indexable by nobody: locale is a cookie, URLs are identical, there is no `hreflang`. Search engines will see English only. | `apps/web/vite.config.ts:55`, no `hreflang` in `web/` | Add locale-prefixed URLs (`/mr/...`, `/hi/...`) with Paraglide's URL strategy and `hreflang` alternates, or at minimum `?lang=` alternates in the sitemap. Decide before public launch, because it changes canonical URLs. QR URLs stay unprefixed. |
| UX-09 | Med | No structured data. Listings have names, coordinates, ratings and photos but emit no JSON-LD, so no rich results. | `web/lib/components/Meta.svelte` | `TouristAttraction`, `LodgingBusiness`, `Restaurant` JSON-LD with `geo`, `image`, and `aggregateRating` only when a listing has ≥ 10 counted votes. The CSP needs the JSON-LD script to carry the nonce (SvelteKit handles inline scripts in `svelte:head` when `csp.mode` is `auto`; verify). |
| UX-10 | Med | Translations: 1,197 keys in each language, none missing, but Hindi and Marathi strings are machine drafts awaiting a native review. | `node` key count; `apps/web/messages/NEEDS_REVIEW.md`; `web/lib/server/ai/persona.ts:2-3` | Native review before public launch, safety strings first (tide, monsoon, emergency, alerts). |
| UX-11 | Med | Empty and error states reuse one generic title "Not here yet" for filtered lists with no results. | `web/routes/stays/+page.svelte:81`, `messages/en.json:39` | Say what happened and offer the nearest relaxation: "No stays match Beachfront under ₹2,000. Remove price limit?" with one-tap chips per active filter. |
| UX-12 | Med | The vote and review live at the bottom of long detail pages on phones; the sticky action bar has Directions, Add to trip, Save, Share but no Rate. | `web/lib/components/listing/ActionBar.svelte:87-116` | After a verified visit or when arriving from a QR page (`?from=qr`), show a one-time inline prompt near the top: "Been here? Give your verdict" that scrolls to `#vote`. |
| UX-13 | Med | Search covers names only (`ilike` on translated names), 5 per kind. No search by taluka, category, dish ingredient or vibe; no typo tolerance although `pg_trgm` is installed. | `supabase/migrations/20261026100000_discover_today_search.sql:15-41`, `20261104100000_p12_crabby.sql:9` | Trigram similarity on names and alternate names; include taluka and category words; show "Did you mean". |
| UX-14 | Med | Regenerating a plan replaces it with no undo; a tripmate with editor rights can do it. | `web/lib/components/plan/TripSetup.svelte:102` (confirm only), `web/routes/api/trips/[id]/generate/+server.ts` | Keep the previous stops as a snapshot row and show "Undo" in a toast for 30 seconds and in the trip menu for 24 hours. |
| UX-15 | Low | Home row "empty" placeholders are dashed boxes with a sentence; they read as broken layout while data is still being collected. | `web/routes/+page.svelte:63-67` | Hide empty rows on home until they have at least 3 items. |
| UX-16 | Low | The PWA manifest has no `shortcuts`, `screenshots` or `share_target`; install prompts on Android show the minimal sheet. | `apps/web/static/manifest.webmanifest` | Add shortcuts (Map, Plan, Crabby), two screenshots, and later a share target for reel links (ties in with reel-to-trip). |
| UX-17 | Low | Review moderation gives no expectation: "pending" with no time frame and no notification on approval. | `VerdictVote.svelte:216-217` | "Usually approved within a day"; push or in-app note on approval or rejection with the reason category. |
| UX-18 | Low | The booking-proof upload is a bare file input inside the rating section. | `VerdictVote.svelte:198-210` | Styled picker with camera option, preview, and the 30-day deletion promise next to it. |
| UX-19 | Low | "Timepass" as a verdict label is natural in Indian English but opaque to others; Marathi and Hindi equivalents need the native review. | `messages/en.json:370` | Keep (it fits the audience); confirm in review. |

## 3. Information architecture and navigation

- **Bottom nav:** Discover, Map, Crabby (raised), Plan, Me. Stays and Food are one level down. For a guide whose promise includes stays-by-vibe and food, consider replacing the single Discover tab with a segmented header on the Discover page (Places · Stays · Food) that keeps scroll position per segment. No sixth tab.
- **Top-bar menu:** itineraries and Taste Konkan (`web/lib/components/TopBar.svelte:30-31`). Fine as secondary.
- **Trust signals for "verified":** `StatusBadge kind="verified"` and `last-verified` with method `desk` or `field` (`StatusBadge.svelte:15-17`). Good that desk-researched and field-verified are distinguished. Missing: a link from the badge to what verification means, and the verifier line (feature F4).
- **Sponsor:** grey text on the QR page only (`web/lib/qr/page.ts:192-193`). Consistent with the hard rule.

## 4. First visit, language, outdoor and one-handed use

| Topic | State | Gap |
|---|---|---|
| Zero login | Works by design in temp mode; in full mode, saving, voting, planning and Crabby all redirect to login. | UX-06. Planning without an account is the most valuable guest feature; in full mode consider a local-only draft trip that is saved on sign-in. |
| Language | Switch in the top bar and on the QR page; names shown in two scripts on cards (`ListingCard.svelte:57-62`). | UX-08, UX-10. The switch is a full page reload through `/prefs`. |
| Readability outdoors | 16 px body, 4.5:1 token contrast tested, QR page in system fonts. | White-on-photo labels (UI-16). No high-contrast or large-text mode; `meta name="text-scale"` is present (`web/app.html:6`). Check sunlight legibility of `--text-muted` (#646973 on #f5f7fa) on device. |
| One-handed use | Bottom nav, sticky action bar, sheets. | Top-bar back button and language switch are out of thumb reach; back also works by gesture. Filter sheet's apply button position: check on device. |
| Forms | Zod validation server-side; pending states on 23 of 28 forms were fixed (`AUDIT.md:120`). | Inline field errors are sparse; many endpoints return a generic 400. |
| Microcopy tone | Plain, friendly; Crabby playful with a "plain" option. | Error copy blames input (UX-02). |

## 5. Accessibility (WCAG 2.1 AA)

Evidence of care: skip link (`web/routes/+layout.svelte:53-57`), focus-visible ring, 44 px targets (`AUDIT.md:124`), heading-order fixes, `aria-pressed` / `radiogroup` on rating controls, axe runs in three e2e suites (`e2e/p10`, `p11`, `p12`), Lighthouse accessibility 100 on the four measured pages (`AUDIT.md`).

Gaps to verify or fix:
- axe is not run on every route; add a loop over all public routes in both themes and three languages.
- The bottom sheet handle is a button with `aria-expanded`, but the sheet has no accessible name and is not announced when it opens with new content (`BottomSheet.svelte:58-67`). Add `aria-label` and move focus to the sheet heading when a pin is selected by keyboard.
- The map is not operable by keyboard beyond MapLibre defaults; the "n in view" list is the accessible alternative. Verify that every pin's content is reachable from that list.
- Toasts: confirm they are in an `aria-live="polite"` region (not read in this session).
- Sub-score dots are `role="radio"` without roving `tabindex`; arrow-key behaviour is missing (`VerdictVote.svelte:171-187`).
- Colour is not the only signal for verdict bands (labels exist). Good.
- Time limits: none. Motion: see `UI_AUDIT.md` §10.

## 6. Performance as UX

| Metric | Evidence | Note |
|---|---|---|
| Lighthouse mobile perf | `/` 82, place 85, stays 88, map 32; desktop 93–99 except map 51 | `AUDIT.md:42-47`; last measured at phase 10b–12, not re-run today. |
| App shell JS | 137.8 KB gz | `AUDIT.md:53`. Today's build: total client JS 2.6 MB raw across all chunks; the largest chunk is 1,049 KB raw (MapLibre, loaded only on map pages) and one route node is 295 KB raw (unverified which route). |
| QR page | 5 KB transfer, no JS required | `AUDIT.md:53` |
| Fonts | 55 KB on Latin pages; +230 KB Devanagari file when needed | `AUDIT.md:54-56`. The Devanagari file is large for 2G; consider subsetting to the glyphs actually used in UI strings plus a full file loaded lazily for content. |
| Images | 480 / 960 / 1600 WebP with LQIP | Good. |
| What works offline | App shell, visited pages, cached list APIs, downloaded packs (tiles + data), saved trips' routes, turn-by-turn on `/navigate`, trip edits (queued), field entries (queued) | `service-worker/index.ts`, `tripSync.svelte.ts`, `field/queue.ts` |
| What fails offline, and how | Votes, sub-scores, reviews, saves, reports, booking proofs, Crabby, search, tides, pins without a pack: a toast, sometimes misleading (UX-02). Unvisited pages fall back to cached `/` or a bare "Offline" text. | `service-worker/index.ts:136-145` |

Add real-user monitoring of LCP, INP and CLS (§7) before tuning further; lab numbers on this laptop swing by 25 points (`AUDIT.md:38-40`).

## 7. Analytics: what to measure

Constraint: ₹0 and privacy-first. Build a first-party event log, not a third-party script (the CSP has no third-party hosts today, which is good).

- `POST /api/e` (sendBeacon) → `analytics_events (day date, name text, props jsonb, session_hash text, lang, path_group text)`; service-role insert after the IP rate limit; no user id, no IP, session hash rotates daily; retention 13 months aggregated, 30 days raw.
- Events: `page_view` (route id, not URL), `qr_landing` (code), `qr_verify` (result), `search` (result count, zero-result flag; not the raw text unless it matched a listing), `filter_apply` (list, keys), `card_open` (kind, position, source row), `save`, `vote` (kind, level, group, verified), `subscore`, `review_submit`, `plan_generate` (days, interests count, duration ms), `plan_edit`, `plan_share`, `book_out` (provider, stay), `request_send`, `crabby_turn` (tool names, latency, outcome), `crabby_action_apply`, `pack_download`, `offline_view`, `lang_switch`, `pwa_install`, `web_vital` (name, value, route id).
- Questions these answer: QR scan → verify → vote funnel; share of sessions that use vibe filters; plan completion rate and time; zero-result searches (content gaps for the data team); booking click-through per provider; Crabby "don't know" rate; which places are opened but never saved.
- A simple `/admin/insights` page with daily counts. No dashboards product.

## 8. Retention and growth loops

| Loop | Today | Gap / action |
|---|---|---|
| Save / favourites | Hearts on cards and a Saved list on Me (`web/routes/me/+page.svelte:142-166`) | No collections; no "saved near you" on the map; saved places are not offered when planning. Add "Plan with your saved places". |
| Shareable itineraries | Share link by token, print to PDF, Google Maps links (`web/routes/plan/[id]/+page.svelte:836, 919`) | The shared page has no "Copy this trip" call to action for the recipient: the best acquisition hook. Add it. Share cards use the app icon (UI-11). |
| Visited stamps | Verified visits exist in the database, with no user-facing view | Feature F1. |
| Return triggers | Web push for trip nudges, stay replies, team answers, "a year ago" (`supabase/migrations/20261104120000_p12_push_queue.sql`) | Push needs consent and a deployed function (not live). Add calendar export for a trip and a festival reminder (feature F9). |
| SEO | Sitemap, robots, canonical, OG basics; whole site `noindex` while the gate is on | UX-08, UX-09. Dish and place pages are the long-tail entry points; they need the native-reviewed Marathi and Hindi text to be indexable. |
| Community | Reviews with moderation; "Ask our team"; publish a route for review | Show answered team questions on the place page as a small Q&A block (they are already reused by Crabby). |

## 9. Quick wins (each under a day)

1. QR sign-in link with `next` (UX-04).
2. Remember the traveller group and stop defaulting to Family (UX-03).
3. Distinct offline copy (UX-02, copy only; the outbox is larger).
4. Hide empty home rows (UX-15).
5. "Copy this trip" on shared plans (§8).
6. Filter-aware empty state with relaxation chips (UX-11).
7. Manifest shortcuts and screenshots (UX-16).
8. "Usually approved within a day" on reviews (UX-17).
