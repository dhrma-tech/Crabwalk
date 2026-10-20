# Crabwalk — complete UI redesign brief (prompt for Claude Design)

> Paste everything below this line into Claude Design.

---

## 0. The ask

You are the lead product designer for **Crabwalk**, a travel web app (installable PWA) for the Konkan coast of Maharashtra, India. The app is already built and working: every feature, every page and the data behind it exist. **We don't like the current look at all, and we want a new frontend designed from scratch.** That means a new brand feel, colour palette, typography, iconography, component library and a fresh layout for every screen.

Do not iterate on the current design. Treat it as a blank slate. The only fixed things are **what each page must do** (sections 3–6) and a short list of **hard functional constraints** (section 2). Everything visual is yours to decide.

What we want from you, in order:

1. **Three distinct visual directions** (mood, palette, type pairing, a sample Discover screen and a sample Place screen for each, light and dark). Give each a name and one paragraph on why it suits Konkan travellers.
2. Once we pick one: **a full design system**. Colour tokens (light and dark), type scale, spacing, radii, elevation, motion, iconography and illustration style.
3. **A component library** with every state (default, hover, pressed, focus, disabled, loading, error, empty, offline).
4. **Every screen in section 4**, at **360 px mobile** and **1280 px desktop**, light and dark, with real sample content (section 7). Show English, plus Marathi (Devanagari) on at least the Discover, Place and QR screens.
5. **Map style colours** for our own vector map (section 4.4), light and dark.

Fresh, modern and confident, but grounded in the place: red laterite stone, the Arabian Sea, coconut and mango groves, sea forts, fishing boats, kokum and Malvani food. **Avoid generic "travel app blue" and stock-photo hero layouts.** Our current palette is laterite red, sea teal and mango on sand, and our current fonts are Baloo 2 and Mukta. Please move away from all of these so the new design actually feels new.

---

## 1. Product context

**What Crabwalk is:** a trustworthy local guide for the Konkan coast. Every place, stay and eatery is visited and photographed by our own field team ("verified"). Ratings come from visitors who can prove they were there. The app plans trips, navigates offline, warns about tides and monsoon closures, and has an AI guide called **Crabby** that answers only from our verified data.

**Region:** launching with Ratnagiri district (9 talukas). It will later expand to the whole Konkan coast, so the design must not be built around one town's name.

**Who uses it:**
- **Travellers (main audience):** families, couples, friend groups and solo travellers, mostly from Mumbai and Pune, often first-timers to the coast. Mid-range Android phones, patchy 4G and **no signal at many beaches, forts and ghat roads**. Many prefer Marathi or Hindi.
- **Group members** who get a link to vote on a trip plan without signing in.
- **People scanning a QR plaque** at a fort, beach or temple, often on 2G, wanting the story, safety info and what's nearby.
- **Field team (verifiers/reviewers):** staff adding listings on site with a phone (GPS, camera, offline drafts) and approving content, reports, reviews and claims.
- **Owners** of stays and eateries who claim their listing and keep facts (photos, prices, menu, hours) up to date.

**Brand personality:** a friendly local who knows the coast. Warm, honest, practical, a little playful. Never salesy. Trust is the product: we always show where data comes from and how fresh it is.

**Mascot:** **Crabby**, a small crab who is the AI guide. A placeholder is fine; propose a direction (flat, simple, works at 24 px). Crabby walks sideways as a loading indicator and waves a claw on success. **Crabby never appears on emergency or safety UI.**

---

## 2. Hard constraints (functional, not stylistic)

These are not about taste. The app breaks or loses trust if they're ignored.

**Languages and fonts**
- Three UI languages: **English, Hindi, Marathi**. Hindi and Marathi use **Devanagari**. Every font you choose **must include full Devanagari** (or come with a matching Devanagari companion), and **Marathi must look native, not like an afterthought.**
- Fonts must be **free and open-licensed** (SIL OFL or similar) and **self-hostable**. No paid fonts and no runtime Google Fonts CDN. Keep it to **at most 4 font files** (weights) in the app. Families with Devanagari that may help: Anek Devanagari/Latin, Hind, Noto Sans/Serif Devanagari, Tiro Devanagari Marathi, Poppins, Martel/Martel Sans, Eczar, Gotu, Yatra One, Rozha One, Kalam, Laila, Khand, Rajdhani, Sura. Choose freely, including others.
- **No letter-spacing on Devanagari.** Marathi text runs about 30–40% longer than English, so **every layout must survive the longest Marathi string** without clipping. Devanagari needs a taller line-height (around 1.6).
- Bilingual place names: primary language on top, other script below in secondary text.
- Indian number formatting: ₹1,25,000.

**Devices and layout**
- Mobile-first: **360 px is the base.** Breakpoints 640 / 1024 / 1280. Desktop max content width around 1200 px; reading width around 680 px.
- Touch targets **≥ 44×44 px**. Keep primary actions within thumb reach (bottom of the screen) on mobile.
- Respect phone safe areas (notches, home bar).

**Accessibility**
- WCAG 2.2 AA contrast for all text, in **both light and dark** themes. Visible focus rings.
- **Colour is never the only signal.** Every status pairs colour with an icon and a text label.
- `prefers-reduced-motion`: replace movement with fades or nothing.

**Themes:** light and dark are both first-class. Dark follows the phone by default, with a manual override (Match phone / Light / Dark). Navigation suggests dark mode after sunset.

**Performance (the app must stay light)**
- Initial app JS under 200 KB gzipped, and the app must load fast on mid-range Android over 4G. **Avoid designs that need heavy effects:** large blurred backdrops everywhere, video backgrounds, big decorative images or parallax.
- **Photos come only from our field team.** There are **no stock photos**, and many listings will have one photo or none. **Every card and hero must look good with no photo.** Design a graceful no-photo treatment (illustration, pattern or category glyph). Photo ratios: cards 4:3, heroes 16:9.
- The **QR scan page** (4.3) must work with **no web fonts (system fonts only)**, no images beyond one photo, and under 100 KB total. Design it to look good in system fonts.

**Honest-UI rules (show on every relevant screen)**
- Every crowd or "busy now" value is labelled **Live** or **Typical**.
- Every place page shows **"Verified {date}"** (last field-team visit).
- Every price shows its **source** (owner, Agoda live, booking site).
- Alerts show **reported time and expiry**.
- Unknown opening hours say **"Hours not known yet"**. Never imply a place is open.
- **Sponsorship** ("Supported by X") is a small grey line only. It is **never near ratings or rankings** and never looks like an endorsement.
- **Emergency red is reserved** for the emergency card and the QR emergency button only. Low ratings must **not** be red.
- The AI (Crabby) shows a **preview card with Apply / Discard** before it changes anything.

**Copy tone:** sentence case, friendly local guide, verbs first on buttons ("Add to trip", "Call 112", "Ask Crabby"). No "please", no "successfully", no exclamation marks in system text, and no ALL CAPS.

---

## 3. Global shell and patterns

**Navigation**
- **Mobile:** bottom nav with 5 items: **Discover · Map · Crabby (centre, visually raised) · Plan · Me.**
- **Desktop:** a left rail replaces the bottom nav, and Crabby becomes a right-side panel.
- **Top bar:** back button (on inner pages), page title, language switch (EN / हि / म, one tap), search.
- **Crabby bubble:** a floating "Ask Crabby" button bottom-right above the nav on every page, with context prompt chips. **Hidden on emergency and safety UI.**
- Skip-to-content link.

**Global states and overlays (design all of these)**
- **Offline banner:** "You're offline — showing saved data" plus which taluka packs are saved.
- **Toasts:** bottom, above the nav, about 4 s.
- **Skeleton loaders** (static under reduced motion).
- **Empty states:** illustration + one-line invitation + one call to action.
- **Error page:** "This page didn't load" plus "Try again". **404 page:** "We couldn't find this page" plus "Go to Discover".
- **Not-allowed state** for staff-only pages.
- **"Not here yet"** placeholder for features without data.
- **Sign-in wall** (inline card) for features that need an account.
- **Emergency card** (4.12): a full-width sheet that can open over anything.

**Auth:** sign in with Google, or email plus a 6-digit code. No passwords.

---

## 4. Page inventory: every screen, its job and its features

Format: **Route** — who sees it — purpose, then the sections in the order they should generally appear (you may re-order within a page if it's clearly better, but keep every item).

### 4.1 Discover — `/` — public
Home screen and inspiration.
- Search bar ("Search places, stays, food").
- **In season** strip: live seasonal highlights (e.g. Mango season, Turtle nesting, Fireflies, Waterfall season), driven by data.
- **Explore categories:** 11 categories with icons: beach, fort, temple, waterfall, viewpoint, backwater, cave, museum, village, market, orchard.
- **Hidden gems** carousel.
- **Ready-made trips** (itineraries by Crabwalk or by travellers).
- **Taste Konkan** dish carousel.
- **Popular with travellers** (trending routes) and **Underrated spots** ("Rated highly, but rarely on trips yet").
- **Near me:** asks for location; handles "Location is off" gracefully; shows distance.
- **All places** list. Empty state: "No verified places here yet."

### 4.2 Place page — `/place/:slug` — public
The most important content page.
- Hero photo (16:9, or the no-photo treatment) with a save (heart) button.
- Name in English and Marathi, category, badges (Hidden gem, Verified, crowd Live/Typical, tide, monsoon).
- **Audio guide player:** play/pause, back 15 s, speed (0.75–1.5×), show transcript. Language follows the UI.
- **Verdict gauge** ("What visitors say"): a segmented 4-level bar (**Skip · Timepass · Worth it · Must visit**) with the winning label, %, vote count, and a filter by group (All · Family · Couple · Solo · Friends). A **"New"** state below 10 votes. A "No votes yet. Be the first." state.
- **Vote:** 4 big verdict buttons, "Travelling as" group picker, optional sub-scores (0–5 bars), optional text and photos. Sign in to vote.
- **Quick facts grid:** timings (today's hours, "Closed today" or "Hours not known yet"), entry fee, best time, how to reach, nearest station, nearest bus stop. Unknown values show "Not known yet".
- **Story / History / Why it matters.**
- **Do / Don't / Safety** lists.
- **Status now:** monsoon (Open / Risky / Closed in monsoon, with reason) and **tide** ("Access depends on the tide" plus today's tide times and a **time-of-day slider** showing Passable / Cut off by tide).
- **Nearby:** stays and food cards, and services (hospital, ATM, fuel and so on).
- **Less crowded today** and **Similar places** (alternatives).
- **Food delivery here:** which delivery apps reach this spot, or "No delivery apps reach here".
- **Reviews:** AI summary, then individual reviews. "Your review appears after a quick check."
- **Report a problem:** QR broken / garbage / unsafe spot / wrong information, plus details.
- **"Verified {date}"** footer.
- Crabby context chips: "Best time to visit {place}?" and "Add {place} to my trip".

### 4.3 QR scan page — `/q/:code` — public, ultra-light
Opened by scanning a plaque on site, often on 2G. **System fonts only, under 100 KB, plain HTML.**
- Name and one photo, audio guide, short story, do's and don'ts, safety and status (tide/monsoon).
- **Verify your visit:** "I'm here — verify" (GPS within 200 m), with states: checking, verified, too far ("You are about {m} m away"), sign in first, GPS off.
- **Near me now:** nearby spots with distance and drive time.
- **Leave a review**, **Open full page in Crabwalk**, **Report a problem**.
- **Emergency button pinned to the bottom:** **Call 112**, **Share my location**.
- Language auto-detect plus a switch.
- Small grey **"Supported by {name}"** line at the very bottom (sponsor).
- An "inactive code" state: "This QR code is not active. For emergencies call 112."
- Variant for **railway station or bus stand** codes, which redirect to `/start`.

### 4.4 Map — `/map` — public
Full-screen vector map (MapLibre, our own tiles; we only need the colours from you).
- **Top:** search ("Search places"); our data first, then address results from a maps provider (with its attribution). Filter chips: Places, Stays, Food, Open now, Services, plus category, vibe, verdict, veg and price filters. "Open now" excludes pins with unknown hours and marks them "hours unknown".
- **Pins:** places, stays and food each in a distinct colour with a category glyph; clusters with a count. Grey utility pins (11 types: fuel, ATM, hospital, pharmacy, police, toilet, EV charging, mechanic, bus, rail, ferry).
- **Map layers panel** (floating button): **Busy now** heatmap (legend: "Live: N spots · Typical: N spots" plus an explanation), **Road & safety alerts** (road condition, ghat road, landslide, closure; caution/danger; "Reported 2 h ago · expires in 22 h"), **Tides** (tide-time slider recolours beach access: Passable / Cut off / Not known; "Tides today" high/low times; attribution), **Trails** (Easy / Moderate / Hard with definitions, source "From OpenStreetMap — not yet checked by our team" or "Checked by the Crabwalk team", **Download GPX**).
- **Bottom sheet** with 3 snap points: peek (name + key badge) → half (details + actions) → full (place page).
- Map controls: find my location, zoom, always-visible attribution ("© OpenStreetMap contributors").
- Offline: the map builds from downloaded taluka packs.
- **We need from you:** land, water, coastline, parks/forest, major roads + casing, ghat/warning roads, planned route line, label colour + halo, pins, clusters, heatmap gradient, in light and dark.

### 4.5 Stays list — `/stays` — public
- Filters: vibe (Traditional Konkani home, Family, Luxury, Business, Backpacker, Couple-friendly, Pet-friendly, Beachfront, Orchard stay), service style (Homely / Professional), max price, amenities.
- **Stay cards:** photo, name, up to 3 vibe tags then "+N", price range with source ("₹1,800–2,500 · from Agoda"), mini verdict, service style icon, heart.
- Empty: "Nothing matches these filters yet."

### 4.6 Stay detail — `/stays/:slug` — public
- Photos, name, vibe tags, verdict gauge (**Avoid · Okay · Good stay · Perfect stay**) and sub-scores (Cleanliness 🔒 *verified visitors only*, Host, Location, Value for money).
- Amenities checklist (AC, Hot water, Wi-Fi, Parking, Power backup).
- **Mobile network strength by operator** (No signal / Weak / Good).
- Food at the stay (Veg, Non-veg, Malvani, Jain, home-cooked meals included).
- **Price comparison table:** each row shows its **source** (Owner's price, Agoda live, booking site) with "See price" deep links, **Call** and **WhatsApp** buttons, or "No prices yet. Call the owner."
- "Ask Crabby to compare prices" tip.
- Hours, contact, nearby, reviews, report a problem, "Verified {date}", **"Own this place? Claim it"**.
- **Upload booking or bill** (to become a verified visitor; "image deleted within 30 days").

### 4.7 Food list — `/food` — public
- Filters: diet (Veg / Non-veg / Jain), style (Home-style, Local legend, Tourist-oriented), max price.
- **Eatery cards:** photo, name, authenticity tag, signature dish, price for two, veg/non-veg/Jain dots, mini verdict, heart.

### 4.8 Eatery detail — `/food/:slug` — public
- Photos, name, authenticity, verdict gauge (**Skip · Okay · Go for it · Local legend**) and sub-scores (Taste, Authenticity, Hygiene 🔒, Value).
- Signature dishes, menu (lines like "Surmai thali — ₹350"), weekly hours (Mon–Sun, Closed).
- **Order on Swiggy / Zomato / other** deep-link buttons.
- Call, WhatsApp, price for two, nearby, reviews, booking/bill proof, claim, report, "Verified {date}".

### 4.9 Taste Konkan — `/taste-konkan` and `/taste-konkan/:dish` — public
- Grid of Konkan dishes.
- Dish page: **What it is**, **Story**, **Where it's best** (linked verified eateries), or "No verified places serve this yet."

### 4.10 Ready-made trips — `/itineraries` and `/itineraries/:slug` — public
- List of itineraries labelled **By Crabwalk** or **By a traveller**, with day count and number of places.
- Detail: day-by-day stops, map, and **"Plan this trip"** (sign in first).

### 4.11 Start your trip — `/start` — public
Landing page for QR codes at railway stations and bus stands.
- "Start your Konkan trip": short intro, **Plan my trip** CTA, **Ready-made trips**, **Near this stop**.

### 4.12 Emergency card — overlay, everywhere (and pinned on the QR page)
Calm, unbranded, no mascot, no bounce.
- Header in emergency red: **Call 112** (huge).
- **Nearest hospital:** distance, **Call hospital**, **Directions**. States: "Finding your location…", "No hospital found nearby in our data. Call 112."
- **Share my location** (prefilled message with coordinates).
- Works offline from cached hospital lists.
- Also opens when emergency words are typed to Crabby (before anything is sent to the AI).

### 4.13 Plan a trip (planner input) — `/plan/new` — signed in
A stepped form.
- **Days** (stepper), **start date**, **start point** (railway station or bus stand, or "Use my location"), **who's travelling** (Family / Couple / Solo / Friends + number of people), **budget** (₹ slider or "No budget limit"), **interests** (category chips; empty = everything), **food preference**, **pace** (Relaxed / Balanced / Packed), **Standout mode** toggle ("Prefer hidden gems and calm, uncrowded spots") → **Generate plan**.
- Sign-in wall: "Sign in to plan, save and share trips."

### 4.14 Plan view — `/plan/:id` — owner
The trip itself.
- Editable trip name. **Day tabs.**
- **Timeline of stops** per day: arrival time, drive time between stops ("25 min drive"), **reason chip** (Visitors love it, Low crowd, Hidden gem, Sunset, Tide-safe time, Festival nearby — expect crowds, Monsoon: take care, Heavy rain now, Hours not confirmed, May be closed at this time). Reorder (drag or move up/down), remove, **Add a stay or meal**. "Updating times…" state.
- **Suggest a better order** ("This order saves about 18 min of driving" or "already in a good order").
- **Budget card:** stay, food, fuel (fuel price + mileage inputs, or "Enter fuel price"), entry fees ("2 unknown"), activities, **total** and **per person**.
- **Share:** copy share link, **copy group-vote link**, **Download PDF**, **Open in Google Maps** per day.
- Group vote results ("5 people voted") and **"Ask Crabby to merge votes"** (preview + Apply/Discard).
- **Live trip** entry ("Start live trip") and **offline readiness** ("Routes saved on this device for offline navigation").
- **Publish as a route** (team reviews it; statuses: Waiting for review / Published / Not published) and, for staff, "Make ready-made itinerary".
- Delete trip (with confirm).

### 4.15 Shared plan (read-only) — `/plan/share/:token` — public
Read-only version of the plan view (days, stops, times, budget). Call to action: "Plan your own".

### 4.16 Group vote — `/plan/vote/:token` — public, no sign-in
- "Help plan '{title}': vote on the spots you want."
- Your name field. Each spot is a card with **Yes / Skip** and current counts ("3 yes · 1 skip").
- **Send votes.** Validation: "Please add your name", "Vote on at least one spot". Thank-you state.

### 4.17 Live trip — `/trip/live/:id` — owner, used on the road
Glanceable while travelling.
- Live mode on/off ("Live mode is on today: leave-time reminders are active").
- **You are at:** current stop card ("Planned until 4:30 pm").
- **Next stop:** planned arrival, drive time, **Start navigation**.
- **Nudge banners:** "Running 20 min late — skip {place}?" with **Skip it** / **Why?** (asks Crabby), and "Time to leave for {place}."
- End-of-day state: "That was the last stop for today."
- Push reminders on/off (iPhone note: add to Home Screen first).

### 4.18 Navigation — `/navigate` — public, works fully offline
- Full map with the route line.
- **Big next-turn card:** turn icon + instruction (Turn left, Keep right, U-turn, roundabout exit 2…) + distance ("in 400 m"). Distance and time to go ("12 km to go · about 25 min").
- Voice on/off, **screen-stays-on indicator** (wake lock), off-route warning ("You are off the route. Head back to the line."), arrival ("You have reached {place}"), next stop.
- **Limits notice:** GPS pauses when the app is minimised; iPhone restrictions.
- **"Open in Google Maps"** for long highway drives and legs without our route data ("{d} away in a straight line").
- Dark-mode suggestion after sunset ("It is dark outside. Switch to dark mode for night driving?").

### 4.19 Crabby chat — `/crabby` — signed in (desktop: right panel)
- Greeting: "Ask me about places, food, stays or your trip. I only answer from Crabwalk's verified data."
- Starter chips: "Plan a 2-day trip for me", "Show me hidden gems", "Where can I eat Malvani food?"
- User bubbles vs Crabby bubbles (with avatar). Inline **place/stay/food cards** in answers.
- **Action preview card:** a proposed plan or edit with **Apply** / **Discard** ("Done." / "Discarded. Nothing changed.").
- **Mic button** (speech input; recording state).
- States: thinking ("Crabby is checking…"), honest "I don't know" + "Verified places you could try instead", refused, unavailable, **daily limit** ("That's 20 questions for today…"), "{n} questions left today", sign-in wall, link to "How Crabby uses your messages".
- Emergency words open the Emergency card instead of sending.

### 4.20 Me — `/me` — guest or signed in
- Guest: "Sign in to save trips and places."
- Signed in as {email}, sign out.
- **My trips**, saved places.
- **Preferences** (diet, budget level Budget / Mid-range / Premium, group). "Crabby uses these as defaults. Nothing else about you is remembered."
- **Language**, **Theme** (Match phone / Light / Dark).
- **Offline taluka packs:** list of 9 talukas with size (MB), version, "update available", **Download / Delete**.
- **Privacy choices:** Share anonymous visit times (on/off, explained), Leave-time reminders (push, on/off).
- Links: **Field team tools** (staff), **My listings** (owners), Privacy policy.

### 4.21 Sign in — `/login` — public
- Continue with Google · or · email → **Send code** → 6-digit code → **Verify code**.
- Errors: OAuth didn't finish, missing email, send failed, too many codes, wrong code.

### 4.22 Privacy policy — `/privacy` — public
A long-form reading page (EN/HI/MR) with a DRAFT label, table of contents, and sections on data collected, AI use, consent, retention and rights. It needs a comfortable reading layout.

### 4.23 Owner: my listings — `/owner` — owner
- List of claimed listings with **Edit facts**. Empty: "No listings yet. Claim yours from its page."

### 4.24 Owner: claim a listing — `/owner/claim/:type/:id` — signed in
- Explanation ("We'll call the number on this listing to confirm you own it"), **Send claim**, and pending/sent states.

### 4.25 Owner: edit listing — `/owner/:type/:id` — owner
- Edit **facts only**: photos, prices, menu (one item per line), opening hours, phone/WhatsApp. **Save changes.**
- Read-only ratings/reviews with the note "Owners can't edit ratings or reviews."

### 4.26 Admin (field team) — staff only
Tool screens, used mostly on phones in the field and on laptops for review. Dense, efficient and calm, with the same design system and a clearly "internal" feel. Each needs list, empty and success states.

| Route | Screen | Features |
|---|---|---|
| `/admin` | Field team home | Tiles/links to every tool with pending counts; **Due for re-check** list with "Mark verified today". |
| `/admin/field` | Add a listing (big form) | Type (Place/Stay/Eatery); names EN + MR; category; **GPS "Use my location"** with accuracy (±m) or manual lat/lon; **camera photo capture**; field notes; hidden gem; tide dependency; monsoon status + reason; **typical crowd by day** grid; opening hours / hours unknown; entry fee; typical visit time; delivery apps; stay prices, phone, WhatsApp; eatery price for two, signature dishes, food-app links. **Offline queue:** "Saved offline — it will send when you're back online", "{n} waiting to send". |
| `/admin/review` | Review queue | Drafts waiting for approval. |
| `/admin/review/:type/:id` | Review editor | Edit name/description per language (EN/HI/MR); **"Draft missing text with AI"** (with a "check every fact" warning); field notes; booking links (provider, deep link, affiliate network); audio guide upload; add dish; **Save drafts** / **Approve and publish**. |
| `/admin/reports` | Report triage | User reports with status New / Checking / Fixed / Not a problem. |
| `/admin/claims` | Owner claims | Approve/reject, with the reminder "Call the listed number before approving." |
| `/admin/proofs` | Booking proofs | View the uploaded bill/booking image → approve/reject. |
| `/admin/moderation` | Review moderation | Pending reviews with an AI check label ("looks fine" / "flagged — reason") → approve/reject. |
| `/admin/qr` | QR codes | Create a code (points to place/stay/eatery/railway station/bus stand); **printable plaque** ("Scan for audio guide, safety and help nearby"); permission (pending/granted, from whom), installed date, sponsor. |
| `/admin/routes` | Route review | Traveller-submitted routes → Publish / Reject. |
| `/admin/events` | Festivals & events | Add/edit: name, type (Festival / Jatra / Season), dates, taluka or all, crowd effect, closures. |
| `/admin/alerts` | Road & safety alerts | Report an alert at a map point (type, severity, reason); list with "Still there — extend" / "Cleared — remove". |
| `/admin/planner` | Planner settings | Default fuel price, mileage, visit minutes per category. |

---

## 5. Component inventory (design all of these, with states)

- **Buttons:** primary (one per screen), secondary, ghost/text, icon button, **emergency** (only for emergency). Loading state keeps the label (Crabby loader).
- **Chips:** filter chip (selected state with check), vibe tag, reason chip, "+N" overflow.
- **Cards:** PlaceCard, StayCard, EateryCard, DishCard, ItineraryCard, compact list row, map bottom-sheet card. Each needs **with-photo and no-photo** versions.
- **Verdict gauge** (4 segments, label, %, votes, group filter, "New" state, tie state), **mini verdict** (for cards), **verdict vote** buttons, **sub-score bars** (with a locked "Verified visitors only" state).
- **Status badges:** tide accessible / cut off, monsoon open / risky / closed, crowd empty / calm / busy (+ Live/Typical), hidden gem, verified, "Verified {date}".
- **Alert banners:** caution and danger with reported/expires text. **Nudge banner** (live trip). Offline banner.
- **Bottom sheet** (3 snap points). **Modal/dialog**, **confirm dialog**, **toast**.
- **Inputs:** text, textarea, search with suggestions, stepper, segmented control, slider (₹ budget, tide time), toggle, checkbox, select, date, 6-digit code input, file/photo upload, GPS location field.
- **Audio guide player.** **Tide time slider + tide curve.** **Map layer panel + legends.** **Turn-by-turn card.**
- **Plan components:** day tabs, stop timeline item, travel connector ("25 min drive"), budget card, share sheet.
- **Crabby:** floating bubble, chat bubbles, action preview card (Apply/Discard), typing indicator, mic recording state.
- **Price comparison table** (with source per row). **Hours table.** **Quick facts grid.** **Reviews list + AI summary.** **Report-a-problem form.**
- **Offline pack row** (size, version, download progress, update, delete).
- **Category icons (11)** and **utility icons (11)**, matching the map pins. Propose the icon style; outline UI icons are fine (we use Lucide today).
- **Navigation:** bottom nav (raised centre Crabby), desktop left rail, top bar, language switch (EN / हि / म), theme switch.
- **Skeletons, empty states, error states** (with illustration style).

---

## 6. Interaction and motion

- Quick, purposeful motion: about 120 ms press, 200 ms state change, 300 ms sheets/pages. Natural easing.
- Crabby walks sideways as the loader and waves a claw on success. **No bounce or playfulness on safety or emergency UI.**
- No parallax. Respect reduced motion.
- Map bottom sheet drags and snaps. Plan stops can be reordered by drag (plus buttons for accessibility).

---

## 7. Sample content to use in mockups

Use realistic Ratnagiri content, not lorem ipsum:
- **Places:** Ganpatipule Beach & Temple (गणपतीपुळे), Ratnadurg Fort (रत्नदुर्ग किल्ला), Thibaw Palace (थिबा पॅलेस), Aare-Ware Beach (आरे-वारे), Jaigad Fort (जयगड), Velneshwar Beach, Marleshwar Waterfall (मार्लेश्वर), Kanakaditya Temple.
- **Dishes:** Solkadhi (सोलकढी), Ukadiche modak (उकडीचे मोदक), Malvani fish thali, Kombdi vade, Aambopoli, Kokum sharbat.
- **Stay names:** "Sagar Kinara Homestay", "Amrai Orchard Stay"; prices like ₹1,800–2,500 / night.
- **Seasons:** Mango season (Apr–Jun), Turtle nesting (Feb–Apr, Velas/Kolthare), Fireflies (May–Jun), Waterfall season (Jul–Sep).
- **Tide example:** "Accessible till 4:30 pm" / "Cut off — next safe 6:10 pm".
- **Alert example:** "Landslide · Danger · Reported 2 h ago · expires in 22 h".
- **Marathi strings for length testing:** "आमच्या टीमने तपासलेली ठिकाणे, राहण्याची सोय आणि जेवण येथे दिसेल." and "भरतीमुळे प्रवेश बंद — पुढील सुरक्षित वेळ संध्याकाळी ६:१०".

---

## 8. Deliverable checklist

- [ ] 3 visual directions → we choose one
- [ ] Design tokens: colours (light + dark, with contrast checked), semantic colours (ok, caution, danger, emergency-only, sponsor-grey), type scale (Latin + Devanagari), spacing, radii, elevation, motion
- [ ] Font pairing (OFL, Devanagari-complete, ≤ 4 files) and a system-font fallback look for the QR page
- [ ] Icon set direction (UI + 11 categories + 11 utilities) and the no-photo placeholder treatment
- [ ] Crabby mascot direction (small sizes, loader pose, success pose)
- [ ] Component library with all states
- [ ] Every screen in section 4 at 360 px and 1280 px, light and dark, plus empty/loading/error/offline variants for the main ones
- [ ] Marathi versions of Discover, Place and QR screens
- [ ] Map style colours (light + dark) and pin/cluster/heatmap designs
- [ ] App icon and PWA splash direction (name: Crabwalk)
