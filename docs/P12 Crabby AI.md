# P12 — Crabby AI: Konkan-physics assistant (product plan §4 + §10)

Status: **approved** (user, 2026-11-04; §2 changes approved, §9 answered). Source: user's "Crabwalk AI integration.md" (product plan, last
updated 3 Nov 2026) §4 "Ask, don't assume" + §10.1–10.12, and the user's answers on 2026-11-04 (§9). One phase, steps
A–N, tag `phase-12`. Once approved, logged in `DECISIONS.md` as P12-n.

## 1. Goal
Crabby stops being a chat box and becomes the app's hands and voice: it can drive any screen, asks instead of guessing,
knows each traveller, plans inside the trip's group chat, writes the trip report and journal, and does the things a
global app can't (our team's answers, QR spots, unlisted homestays, owner voice entry, photo and reel lookup).

**Kept as is (P8):** Groq/Gemini router with fallback, DB-only tools, Apply/Discard previews, emergency bypass (client +
server), ~20 messages/day cap, moderation, nightly review summaries, embeddings for similar places, AI firewall (no Ola
data, no phone numbers or location history to any LLM).

## 2. Changes to the product plan (approved, user 2026-11-04)
| Product plan says | P12 does | Why |
|---|---|---|
| §10.10 media on Cloudflare R2 (10 GB free) | Photos and clips stay on the phone; only compressed photos the user puts in a **shared** journal / story card upload to Supabase Storage, per-user cap | R2 needs a card on file (breaks ₹0 rule, DECISIONS G3 "No R2"). User answer §9.2 |
| §10.8 separate groups; "replaces the no-login vote link" | Chat is a section of the P11 trip workspace, for its tripmates (same invites and roles). Vote link retired; group votes become **poll cards** in the chat | P11 already has tripmates, roles, invites, realtime. User answer §9.3 |
| §4 / BACKEND §11.4 "no chat history stored" | Still true for 1:1 Crabby chats. **Group chat messages are stored** (people talk to each other there); Crabby reads them only inside that trip | Group chat can't work without stored messages — needs the lock to say so |
| §10.1 dedupe questions with embeddings | Postgres text similarity (`pg_trgm` + full-text) against past team answers | Our embeddings are made once on a laptop; the live app has no free model to embed a new question. Same-model online embeddings would need a paid or rate-limited API |
| §10.5 match against "our photo embeddings" | Gemini Flash describes the photo → we match the description (name, category, dish words) against our DB near the user | No photo embeddings exist; text match is free and grounded |
| §10.6 Instagram via oEmbed after Meta app review | YouTube oEmbed title + user-pasted caption or screenshot only; Instagram oEmbed later | Meta app review is outside our control |
| §10.11 "every UI action is a named function" | One action registry; today's 6 Crabby action types (create/edit plan, open map, start nav, shortlist stays, save/share) move into it | Same idea, built on what exists |

## 3. Features (what the user sees)
| § | Feature | Notes |
|---|---|---|
| 10.11 | **Crabby drives the app** | Registry actions: openPage, switchTab, setFilters, openPlace, openMap, addToTrip, startNavigation, … Auto: navigation, tabs, filters, map view. Confirm first: anything that changes data or leaves the site. Ghost-tap highlight + status line + Stop. Allowlist: never admin / verifier / owner pages, never another user's data |
| §4 | **Question cards** ("Ask, don't assume") | 1–4 questions, 2–4 options each + Other, recommended option marked, multi-select where it fits, "Let Crabby decide" (Crabby says what it picked and why). Routing: user / group poll / our team / owner. Unanswered items show "Pending" |
| 10.7 | **Personal profile** | Onboarding quiz (vehicle + mileage, budget, interests, pace, food, group type); per-source consent toggles in Me (quiz, activity, chats, trips + QR scans); profile computed by code; "What Crabby thinks about you" card (edit / delete a line, reset). Only a short summary reaches the LLM |
| 10.9 | **Persona** | Playful by default, "Plain mode" switch in Me. HI/MR humour written natively (team review). Persona off on safety, emergency, tide/monsoon warnings |
| 10.1 | **Ask our team** | No verified answer → "Ask our team" with expected wait; dedupe against past answers; team dashboard; answer in chat + web push; stored as verified Q&A (place, date, answered_by, expiry for time-sensitive ones) and reused for everyone |
| 10.3 | **Crabby at the spot** | QR scan page (still < 100 KB, no login) gets "Ask Crabby about this spot" → Crabby preloaded with place, time, tide/monsoon/crowd, active trip; chips "What now?", "Is it safe to go down?", "Where to eat nearby?", "What's next on my trip?". Logged out → static FAQ + login prompt |
| 10.8 | **Group chat** | Chat section in the trip workspace (P11 tripmates); join notice ("Crabby reads messages here to plan"); share places/stays/plans as cards; poll cards; Crabby replies when tagged and **proactively** (rules + Groq 8B decide; cooldown; daily cap per group; tagged always allowed); moderation on every message |
| 10.12 | **Trip report** | Named after the trip, built from our DB by template (cover, day by day with constraints, places, food, stays, expenses from P11, practical: weather/tide outlook, packing list, nearest hospital/ATM/fuel, emergency card). LLM writes only a short summary. Live page + versions + PDF + share; "Data as of …"; Pending items never guessed; posted to the group chat |
| 10.2 | **Books the unbookable** | Request card (dates, guests, budget) → claimed owner: owner page + push, one-tap reply; unclaimed: team relays by prefilled WhatsApp (manual). One counter offer, user decides. Phone shared only after the user confirms. No booking, no payment |
| 10.4 | **Host Crabby** | Owner (and admin form) speaks or types in MR/HI/EN → Crabby fills the stay/food fields → owner reviews → team approves. Facts only, never ratings |
| 10.5 | **Snap and ask** | Photo → EXIF/GPS stripped on device → Gemini describes → matched to our DB near the user → name, story, link; no confident match → "Not sure" + Ask our team. Own consent toggle |
| 10.6 | **Reel to trip** | Paste a YouTube link, caption or screenshot → match → reality-check card (open/closed, monsoon, safety, verdict, best time) → add to trip. Not in our DB → "Not in our list yet" + Ask our team, logged as a lead |
| 10.10 | **Trip journal** | Auto-filled from the trip (route, stops visited via GPS + QR, time spent, weather/tide, food); add photos/clips anytime (on the phone); end-of-trip interview (voice or text, 3 languages); Crabby writes the story only from answers + data; one tap turns a line into a verdict vote/review; private by default, share link / story card / PDF; "One year ago" nudge |

## 4. Free-tier budget (₹0)
- Every feature reuses the router (Groq 8B for intent, moderation, "should Crabby speak?"; Gemini Flash for replies,
  vision, summaries). Fallback chain unchanged; 429 → next provider → "Crabby is busy" card, never a paid call.
- Caps (defaults, tuned in step N against real usage): 1:1 chat 20/user/day (unchanged); group chat — tagged replies
  count against the tagger's cap, proactive replies ≤ 10/group/day with ≥ 10 min cooldown; snap and ask 5/user/day;
  reel to trip 5/user/day; journal story 3/trip; trip report summary 1 per version.
- Storage: shared journal photos ≤ 20 per user, ≤ 300 KB each after compression (Supabase free tier 1 GB total).

## 5. Data (one migration, append-only)
| Table | Main columns |
|---|---|
| `user_profile` | user_id, quiz answers (vehicle, mileage, budget band, interests, pace, food, group type), computed scores, summary lines (editable), persona (`playful` / `plain`), per-source consents |
| `team_questions` | asker, question, place_id?, status (open / answered / expired), answer, answered_by, answered_at, expires_at, lang; trigram + FTS index |
| `stay_requests` | user, stay/eatery, dates, guests, budget, status, owner reply, price, one counter, phone_shared_at |
| `trip_messages` | trip_id, author (member or Crabby), kind (text / card / poll / question), body, payload, created_at; Realtime; daily purge 30 days after the trip's last day (§9.6) |
| `trip_polls` / `trip_poll_votes` | poll in a message, options, multi-select, member votes |
| `crabby_group_usage` | trip_id, day, proactive count, last_spoke_at |
| `trip_reports` | trip_id, version, payload (JSON snapshot), summary, created_at |
| `trip_journals` / `journal_entries` | trip_id, user, story, interview answers, shared photos (storage paths), share token |
| `ai_leads` | reel / photo inputs we couldn't match (for the content team) |
- Existing `user_preferences` (diet, budget, group type) is folded into `user_profile` (migrated, old table kept read-only until removed).
- RLS: own rows only for profile / journals / requests; trip members for messages, polls, reports; team roles for
  `team_questions` and relayed requests; owners for their own stays' requests.

## 6. AI firewall and privacy (unchanged rules, new surfaces)
- No tool returns Ola data, phone numbers or location history. Photos have EXIF/GPS stripped on the device before upload;
  the user's location is used only in our own matching. Group chat text sent to the LLM is the last N messages of that
  trip only, with names replaced by "Member 1…n".
- Privacy policy gains: group chat processing, photo processing (free-tier content may be used by Google), profile sources.

## 7. Build steps (one phase, in order)
| Step | Work | Done when |
|---|---|---|
| A | Migration + RLS + types; pgTAP for every new table's roles | outsider sees nothing, member/owner/team rules hold |
| B | Action registry (10.11): buttons and Crabby call the same functions; ghost tap, status line, Stop; auto vs confirm; allowlist | "show veg eateries in Dapoli on the map" runs end to end; admin page refused (e2e) |
| C | Question cards + `ask_user` tool + Pending state | planner with no dates asks one card instead of guessing (mock e2e) |
| D | Profile + quiz + consents + "What Crabby thinks" card; persona + plain mode | quiz → planner defaults; delete a line → gone from the LLM summary (unit) |
| E | Ask our team: escalation, dedupe, dashboard, push, Q&A reuse + expiry | same question twice → second user gets the stored answer (e2e) |
| F | Crabby at the spot: QR button, context, chips, logged-out FAQ | scan page still < 100 KB; chat opens with the place's tide status |
| G | Group chat: workspace section, realtime, cards, polls (vote link retired), @Crabby, proactive with limits, moderation | two browsers chat < 2 s; proactive reply respects cooldown and daily cap (unit + e2e) |
| H | Trip report: template, versions, PDF, share, posted to chat | report matches the plan after an edit; Pending shown for missing data |
| I | Books the unbookable: request card, owner reply, WhatsApp relay, one counter | request → owner reply → user sees price; phone hidden until confirm |
| J | Host Crabby: voice/text → fields, review, team approve | Marathi sentence fills price + timings (mock e2e) |
| K | Snap and ask: EXIF strip, vision, DB match, Not sure path | seed fort photo → its page; random photo → "Not sure" |
| L | Reel to trip: YouTube oEmbed / caption / screenshot, reality check, leads | YouTube link of a seed place → reality-check card → added to trip |
| M | Trip journal: auto-fill, interview, story, phone media + shared photos, one-tap vote, share/export, one-year nudge | finished trip → interview → story uses only answers + data |
| N | HI/MR strings, a11y (axe), Lighthouse, quota test against Groq/Gemini free tiers, privacy policy text, DECISIONS + phase log, tag `phase-12` | all checks green |

## 8. Left out (₹0 / rules)
Paid WhatsApp Cloud API (automated owner flow), Instagram oEmbed until Meta review, Sarvam until approved (provider
interface ready), any payment or booking confirmation, scraping of any OTA or social site.

## 9. Answered (user, 2026-11-04)
1. One big phase (steps A–N), one tag.
2. Journal media: phone + Supabase for shared photos only (no R2).
3. Group chat inside the trip workspace; vote link retired, votes become poll cards.
4. Proactive Crabby in group chat with limits (rules + Groq 8B, cooldown, daily cap).
5. All §2 changes approved.
6. Group chat retention: messages deleted **30 days after the trip's last day** (trips without dates: 30 days after the last message).
7. Ask our team: **verifiers and admins** answer from the team dashboard; Crabby promises "usually within a day".
8. Persona HI/MR humour: Claude drafts native-style lines, listed in `NEEDS_REVIEW.md`; a native speaker on the team approves them.

## 10. Still open (ask before building the step)
- **Unclaimed-owner relay:** which team role taps the WhatsApp relay? (step I)
- **Trips without dates and retention:** confirm "30 days after the last message" (step A).
