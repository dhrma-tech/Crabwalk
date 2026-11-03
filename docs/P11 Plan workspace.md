# P11 — Plan workspace (Wanderlog-style, Tideline theme)

Status: **approved** (user, 2026-11-03; §9 answered). Source: user's "Wanderlog UI, Features and Dev/User Analysis" + scope answers:
map split view + sections, lists/notes/checklists, expenses + group balances, realtime co-editing; phones = map on top, list sheet.
Once approved, this changes FRONTEND §7.9 (Plan view) and is logged in `DECISIONS.md` as P11-n.

## 1. Goal
`/plan/:id` becomes one trip workspace: the itinerary and a map side by side, every stop a numbered pin, plus lists,
notes, checklists, real spends and tripmates editing together live. Everything the plan page does today stays.

**Kept as is:** AI planner (`/plan/new`), day timeline (time, travel time, reason chip), drag to reorder, add meal/stay,
estimate budget card, share link, group vote, PDF, Google Maps per day, live trip, publish route, offline saved trips.

**Left out (hard rules / ₹0):** Google Maps (MapLibre stays), in-app hotel search or booking (Agoda stays a referral link),
email/Gmail reservation import, Tripadvisor content, any paywall. Crabby replaces Wanderlog's AI Assistant.

## 2. Layout
**Laptop (≥ 1024 px), three columns**
| Outline (200 px, sticky) | Content (≈ 560 px, scrolls) | Map (rest, sticky, full height) |
|---|---|---|
| Trip title, Saved ✓, undo/redo · Overview · Places to visit · each list · Itinerary → Day 1…N · Expenses · Notes | Collapsible sections (chevron, `…` menu) | MapLibre; pins for the section in view |

**Phone (< 1024 px)** — map fills the top, the workspace is a draggable sheet over it (snap: peek 30 % / half / full),
like `/map`. Outline becomes a sticky chip row at the top of the sheet (scroll row with the scroll pill).

**Map ↔ list sync:** tap a stop → its pin pulses and the map pans to it; tap a pin → the list scrolls to the stop.
The map shows the active day (numbered pins + connector line) or, in a list section, that list's pins.

## 3. Sections (top to bottom)
1. **Header** — title (rename), days, tripmate avatars, Share, `…` (print, view-only, collapse all, delete).
2. **Overview** — the current estimate budget card + quick stats (days, stops, km).
3. **Places to visit** — default bucket list + user lists ("New list"). Each list: add-a-place search (our published
   places, stays, eateries), note and checklist items, and a **Recommended** row (published places in the trip's
   talukas, gems and best rated first, one-tap `+`). Items drag (or "Move to day…" on phones) into the itinerary.
4. **Itinerary** — today's day tabs + timeline. Days are numbered (Day 1…N); a start date stays optional, so the
   itinerary shows before anyone commits to dates.
5. **Expenses** — log spends, see balances (§5).
6. **Notes** — trip notes and checklists (packing list, documents, "carry cash for ferry").

## 4. Theme (Tideline)
- Pins in map pin colours: places = action blue (`--kokum`), meals = alphonso, stays = lagoon; day connector = lagoon.
- Cards `--radius-lg` (24 px), surfaces on cool paper, e1 shadow; sections are surface cards with an h2 in Figtree
  (EB Garamond only for the trip title, as other page titles).
- Recommended places and day chips use the scroll rows with the scroll pill.
- Map controls glass, as on `/map`. Crabby stays the AI entry point (dock + Apply/Discard ActionPreviewCard), with new
  chips here: "Fill day 2", "Find lunch near stop 3".
- Copy: sentence case, verb-first buttons ("Add place", "Log spend", "Invite tripmate"), EN/HI/MR for every string.

## 5. Expenses and balances
- A spend: amount (₹, whole rupees), what for (free text, optional link to a stop), category (stay, food, fuel,
  entry, activities, other), paid by (tripmate), date (optional), split: **equal** between chosen tripmates or
  **custom** rupee amounts per tripmate (must add up to the total; the form shows what's left).
- Tripmates can be **names without accounts** (friends who never sign in); an invited editor becomes a linked tripmate.
- Balances: net per tripmate and a minimal "A pays B ₹x" list (greedy settle). Tracking only: no payment links, no UPI.
- Overview shows estimate (existing budget card) vs actual (sum of spends).

## 6. Co-editing
- Roles: owner, editor, viewer. Up to **20 tripmates** per trip (owner included). Owner invites with an **edit link**
  or a **view link** (new tokens; the existing public share link stays read-only). Opening one while signed in adds
  you with that role.
- **Invite by email:** if the address belongs to a Crabwalk account, that person is added straight away and the trip
  appears in their trips (no email sent). Otherwise "Send invite" opens the inviter's own mail app (`mailto:`) with the
  link filled in. No mail service (₹0; custom SMTP is still deferred, P1-19).
- Live sync: Supabase Realtime (Postgres changes on the trip's rows, filtered by `trip_id`); edits apply
  optimistically and reconcile on the server echo. Last write wins per row.
- "Saved ✓ / Saving… / Offline — will sync" indicator; offline edits queue like field visits do today.
- Undo/redo: per user, this session only, last 30 edits (stop moves, list items, notes, spends).

## 7. Data (one new migration, append-only)
| Table | Columns (main) |
|---|---|
| `trip_members` | trip_id, user_id (nullable), display_name, role (owner/editor/viewer), joined_at |
| `trip_invites` | trip_id, token, role (editor/viewer), created_by, revoked_at |
| (members cap) | trigger: at most 20 `trip_members` rows per trip |
| `trip_lists` | trip_id, title, position |
| `trip_list_items` | list_id, position, kind (place/stay/eatery/note/check), entity_id, text, done |
| `trip_notes` | trip_id, body (markdown-lite), updated_by |
| `trip_expenses` | trip_id, amount, category, label, stop_id, paid_by (member), date, created_by |
| `trip_expense_shares` | expense_id, member_id, amount (rupees; equal splits store the computed share) |
- Uses the existing nullable `trips.start_date` (no new column).
- RLS: `app.trip_role(trip)` → owner/editor/viewer; read for members, write for owner/editor; invite tokens redeem
  through a security-definer function. Existing owner-only policies widen to members.
- No phone numbers or location history leave the DB to the LLM: Crabby gets stops and list places only, never expenses
  or member names (AI firewall unchanged).

## 8. Build steps (one phase, in order)
| Step | Work | Done when |
|---|---|---|
| A | Migration + RLS + types; pgTAP/vitest for roles and invite redeem | viewer can't write, editor can, outsider sees nothing |
| B | Workspace shell: three columns / phone sheet, outline, collapsible sections | e2e at 390 px and 1280 px |
| C | Map pane: day pins, connector, list pins, list ↔ map sync | tap stop ↔ pin both ways |
| D | Lists, recommended row, notes, checklists, move to day | add → drag into Day 2 → shows on map |
| E | Expenses + balances + estimate vs actual | 3 tripmates, 4 spends → correct settle list (unit tested) |
| F | Invites, realtime, Saved indicator, offline queue, undo/redo | two browsers see each other's edit < 2 s |
| G | HI/MR strings, a11y (axe), Lighthouse, screenshots, DECISIONS + phase log, tag `phase-11` | all checks green |

## 9. Answered (user, 2026-11-03)
1. Invites: links **and** email (account lookup + `mailto:`, §6).
2. Splits: equal **and** custom amounts (§5).
3. Tripmate cap: 20 per trip.
4. Runs as `P11` with the usual end-of-phase protocol (tag `phase-11`).
