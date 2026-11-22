# Crabwalk design audit

Phase 1 of the design elevation brief. No code was changed.

**Method.** I read the briefs and decisions (`CLAUDE.md`, `docs/DECISIONS.md`, `docs/design/CLAUDE_DESIGN_BRIEF.md`,
`docs/reports/02-ui-redesign-tideline.md`, `docs/crabwalk-handoff/{PLAN,HANDOFF,CRABBY_BRIEF}.md` and the
landing brief `CRABWALK_PROMPT.md`), `app.css`, `journal.css` and the page and component code. I ran the
dev server against the local Supabase stack and local tiles, then used Playwright to screenshot every user-facing
route at 390 × 844 and 1440 × 900 (above the fold and full page). I also took each landing section on its own, walked
the onboarding as a guest, and shot Marathi versions of the landing, Discover and Place pages. The screenshots are in
`design/screenshots/audit/` (138 files).

**Limits of this pass.**
- The local database is full of e2e leftovers ("E2E Cove mwq4obbx", "P7 Station …"), so content looks worse than it
  will in production. I judge the design here, not the data.
- The temporary access gate is on, so "signed-in" pages were captured as a guest.
- Onboarding steps 4 and 5 and the postcard flip were read in code, not captured. The script could not tick the
  interest chips.
- Full-page captures show fixed bars (nav, action bar, Crabby chips) halfway down tall pages. That comes from the
  capture method; the above-the-fold shots are the true view.
- Lighthouse was not re-run. The latest numbers are in `docs/crabwalk-handoff/HANDOFF.md`: landing mobile **Perf 66,
  LCP 5.4 s**, onboarding **Perf 75, LCP 4.3 s**. The brief's LCP target is under 2.5 s, **so the current build already
  misses it.**

---

## 0. The single biggest problem: two products wearing one name

The landing page and onboarding use the **field journal** look: navy ink on beige paper, Gloock serif headlines,
Instrument Sans, Tiro Devanagari, a laterite accent, paper grain, hard offset "print" shadows, ink-line art and a
fiddler-crab Crabby. **Every other page** uses **Tideline**: cool grey-white `#f5f7fa`, a bright sky-blue action
`#0270ae` (still named `--kokum` in code), EB Garamond and Figtree, soft blurred shadows, Lucide icons, a lowercase
blue `crabwalk` wordmark and pill-shaped grey chips.

So you tap "Discover" in a hand-printed travel journal and land in a generic SaaS travel app. The handoff calls this
choice deliberate (DECISIONS LJ-4, "the app keeps Tideline"). That was a reasonable call while the journal look was
unproven. Now that it exists, it is the main thing stopping Crabwalk from feeling like one designed product. Most of
the per-page notes below are symptoms of this.

The app still has strengths: a clear information hierarchy, an honest-UI vocabulary, careful dark mode tokens,
contrast tests, motion tokens and a reduced-motion rule. It has **no identity**. If you take away the crab logo, Discover,
Place, Map, Crabby chat, Plan and Me could belong to any travel startup.

---

## 1. Landing (`/`)

### Keep
- **The hero diorama** has layered hills, sea, a laterite cliff, a lighthouse and a sky that follows Ratnagiri time.
  The dotted coastal route from Jaigad to Pawas, with Crabby walking it, is the right idea and the best moment on the site.
- **The giant Gloock "Ratnagiri"** is confident, editorial and real HTML text. It paints in the first frame.
- **The real OSM taluka map** with leader lines, the dotted Arabian Sea, the watercolour wash on the selected taluka and
  the **taluka postage stamp**. This is the most "unmistakably here" artefact in the codebase.
- **The categories editorial index** (numbered rows with serif names) is a good escape from icon-card grids.
- **The offline map panel** with the "Turn off network" demo. It proves the product's main selling point in two seconds.
- **The self-playing trip planner** with reason chips. It is honest, labelled "Demo plan · sample stops" and has a
  mini route map.
- **The water-filled कोकण watermark** and Crabby on the tide line in the footer.
- **The honesty discipline**: `[n]` placeholders, "Sample split until votes arrive" and no invented numbers.
- **The `j-btn` print-shadow pill**: a hard 3 px ink offset instead of soft blur.

### Generic, flat or unfinished
- **The hero has no call to action.** The first screen is a poster with no way in. The only paths onward are the nav
  links and scrolling.
- **The phone hero loses its story.** At 390 px the route, the stops and the walking Crabby are gone. रत्नागिरी is gone
  in English. About 200 px of empty sky sits between the subtitle and the hills. What's left is a stock "flat landscape
  vector".
- **Collisions in the hero.** The sun sits on the eyebrow line ("…ON FOOT" runs into the halo at 1440, and "FOOT"
  wraps into the sun at 390). The GANPATIPULE and RATNADURG labels are struck through by the dotted route. In
  Marathi, रत्नागिरी collides with the birds and the sun, and it stays small while the Latin "Ratnagiri" stays huge. That
  is the wrong way round for a Marathi reader.
- **Dev copy is shown to users.** "PHOTO SLOT · AARE WARE COASTAL ROAD AT GOLDEN HOUR · DAYTIME IN RATNAGIRI" is
  printed over the sea.
- **The illustration vocabulary is thin.** Every scene uses the same parts: a pale sun disc, a navy hill, a teal sea
  with sine waves, a palm and a tiny sailboat. The hero, the six gem cards, the three Why cards and the onboarding
  scenes all look like one template with different crops. The fort is a crenellated rectangle and the hotel is a
  four-window block. None of it shows laterite texture, Mangalore tile roofs, fishing boats, mango crates or the real
  Ratnadurg silhouette.
- **Map labels.** Taluka names cross the boundaries they label (Mandangad, Sangameshwar and Rajapur). On phones the
  12 place labels are about 10 px, and "Dhoot-Papeshwar" is cut off at the right edge.
- **The Hidden gems coverflow** is the most template-like section: a 3D carousel of interchangeable flat landscapes
  with heavy blur on the side cards. Nothing on a card tells Velneshwar from Bhandarpule. Two hundred pixels of page
  margin sit above and below it.
- **Why Crabwalk** has a three-line headline with the right half of the page empty. The three cards below it (Hotels,
  Stays, Places) are identical rounded cards with clip-art buildings. On phones they stack into roughly 1,100 px of
  repetition. On phones the map panel also crops its labels ("IPATIPULE", "Ratnagi…").
- **Meet Crabby** has four identical white cards, each with a Lucide icon in a beige square. That is exactly the
  "uniform icon card grid" the brief bans. The tilted question bubbles float in a lot of empty sky-blue.
- **The Verdict avatar wall** uses generic flat "people" avatars of the Humaaans or Open Peeps kind. They read as
  template stock illustration, which undercuts a section about real travellers.
- **Section rhythm.** Every section opens with the same pattern: small caps eyebrow, then a giant Gloock headline, then
  a lead paragraph. It works once. Nine times in a row, it becomes the template.
- **The scroll-progress crab** draws a dotted line across the bottom of the viewport on every screen, crossing card
  text (seen over "Speaks your language" and the Why cards).
- **Categories at 1440** have a large empty area at the top right and an unexplained white band behind the right column.

### UX friction
- There is no primary conversion path until the planner section (about 6 screens down) and the footer.
- On phones, "Discover Ratnagiri" puts nine taluka chips and the detail card **above** the map. The map, the thing you
  want to tap, is pushed one full screen down.
- The hidden gems arrows are 48 px, but the cards themselves do nothing when tapped on mobile except through the small
  ↗ button.
- "Explore Ratnagiri · [n] verified places" wraps awkwardly in the card at 1440.

### Missing states
- Hover is good on desktop, but there is no **pressed** state on the taluka map paths, gem cards or category rows.
- When Devanagari fonts are late, the swap is visible (रत्नागिरी pops from the system face to Tiro mid-animation).
- The offline demo has no "back online" moment. The toggle just reverses.
- The section-edge variety is fine but arbitrary (torn paper, then wave, then scallop) with no logic tying them to place.

---

## 2. Onboarding (`/onboarding`)

### Keep
- The **one continuous scene** idea: dawn beach, village, fort, waterfall and orchard, then market.
- **Crabby as a shared element** that reacts to choices (holds a baby crab, a gem, a leaf; walks faster when the pace
  is "Packed").
- The **trip postcard** that builds up and flips. It is the right wow moment and grounded in a real object.
- The desktop split screen, the liquid progress segments, the 6-box code input with `one-time-code` and the honest
  "Sign-in opens at launch" note.

### Generic, flat or unfinished
- **The login screen is a standard auth form** under a stock-looking beach. The first impression of the app is the same
  form as every product.
- **On phones the scene is squeezed into the top 300 px**, and Crabby's speech bubble covers the scene's focal point.
  On step 2 the bubble ("So I can split verdicts…") sits on the fort.
- **The option cards** (Solo, Couple, Family, Friends) are four identical rounded boxes with Lucide-style people icons:
  the template look again.
- **Step 3 at 1440 has about 200 px of dead space** between the hidden-gems switch and the Continue button.
- **The postcard is too small and parked off to the side** (top right of the scene at 1440, over the sun). Its stamps
  are generic, and it does not yet look like an Indian postcard or inland letter.
- **The disabled Continue** is a flat grey pill that reads as broken, not "almost there".

### UX friction
- On phones, Continue is pinned to the bottom, but long chip lists scroll underneath it with no fade.
- "Skip" sits next to the progress bar with the same weight as Back.
- "Explore without an account" is a quiet text link below a dashed box. Yet it is the only path that works while the gate
  is on.

### Missing states
- Code input: "resend" and "wrong code" exist, but there is no success beat before the step advances.
- There is no reduced-motion screenshot evidence for the postcard flip (fades exist in code).

---

## 3. Discover (`/discover`)

### Keep
- The content model and section order (search, In season, categories, places, stays, food, ready-made trips, Taste
  Konkan, Near me) and the honest "Photo coming soon" label.
- The category tiles with real photos (`static/categories/*.webp`, credited).
- The scroll-progress indicator under sideways rows.

### Generic, flat or unfinished
- **This is the most generic screen in the product**, and it is the home of the app. Grey-white background, a bright
  blue logo, Figtree, grey pills and white rounded cards: the default Tailwind look the brief bans.
- **Broken no-photo treatment on place cards:** at the tall 240–272 px crop the coast scene renders as a **solid maroon
  slab with two giant white chevrons ("< >")**. It looks like a code icon, not a beach. It is also maroon in a blue
  palette (an old kokum value leaking through).
- **The stay placeholder repeats** the same sun and palm on every card. A list of five homestays looks like one card
  copied five times.
- **Taste Konkan dishes use the fort-wall "heritage" scene.** A dish shows a crenellated laterite wall. `NoPhoto` maps
  `dish` to heritage, as the brief's §4.9 says, but it reads as a bug.
- **There are two search bars** on desktop (top bar and page) and on mobile (top bar icon and page field). On mobile the
  page search field **overflows the right edge**.
- **"Stays by vibe" chips come before the categories**, and they are stay filters on a page about places.
- **The empty "In season" strip** shows only a dashed peach divider with nothing in it.
- The headline's "wavy underline" is a faint teal sine wave that looks like a rendering artefact.

### UX friction
- Nothing tells you where you are on the coast (taluka or season), although the landing page has a full taluka map.
- Every sideways row has the same rhythm and weight, so nothing leads.
- "On the map" and "See all" are tiny teal links at the right edge, far from the thumb.

### Missing states
- There is no skeleton for rows while data loads (a skeleton component exists).
- Near me has a button but no designed "location off" illustration.
- There is no offline variant showing which taluka packs are saved.

---

## 4. Map (`/map`)

### Keep
- Our own vector tiles with an always-visible attribution, category filter chips with glyphs, a left list on desktop,
  a layers button and locate and zoom controls.

### Generic, flat or unfinished
- **The basemap is the stock Protomaps light style.** It is beige-grey with thin blue water and could be any city. The
  coast, the product's subject, has no weight.
- **Clusters are black circles with white numbers.** They are heavy, carry no brand and cover Ratnagiri town (one
  "111" bubble).
- **Desktop list rows** are identical pastel icon-in-circle rows.
- **The error state** ("This page didn't load / The map didn't load. Check your connection") is a bare line of text with
  no retry button. It does not say "your offline packs still work", and it is empty for 800 px. That matters because
  offline is the core promise.

### UX friction
- The chip row on mobile is a single strip of 15+ chips. "Open now" has no visual separation from the categories.
- The bottom sheet peek state is not visible at all on first load. You have to know to tap a pin.

### Missing states
- A loading state for the tiles (just grey now), "no results in this area", and the offline-pack-only view.

---

## 5. Crabby AI (`/crabby` and the desktop dock)

### Keep
- The honest disclaimer, the starter chips, camera and mic in the composer, the "On this page: Plan" context pill in
  the dock, and the Apply / Discard preview cards (in code).

### Generic, flat or unfinished
- **The empty state is a ChatGPT clone:** a small logo, one centred paragraph, three grey chips and a pill composer on
  a blank page. The mascot that carries the whole brand is a 64 px static mark.
- On desktop the full page is about 900 px of nothing with a narrow column.
- **The floating launcher** is a blue circle with a white crab silhouette, in Tideline blue, not Crabby's laterite.

### UX friction
- The starter chips are the only hint of what Crabby can do. Nothing shows it knows tides, verdicts or offline places.
- The "can still be wrong" line is 12 px grey at the very bottom.

### Missing states
- Not captured live (no LLM key), but in code the thinking, streaming, "I don't know", limit and refused states share
  one bubble style. There is no distinct look for "I checked and we have nothing", which is a key honest state.

---

## 6. Trip planner (`/plan/new` → `/plan/:id`)

### Keep
- One-screen trip setup, the steppers, segmented controls, autosave ("Saved"), undo and redo, the share button and
  the sections rail.

### Generic, flat or unfinished
- **On phones, the top 320 px is an empty grey box** (the map slot with no route yet). The first thing a new planner
  sees is nothing.
- **On desktop the middle column is an empty grey slab** about 460 px wide and full height.
- The form is a stack of grey inputs and pills. There is nothing trip-like about it: no route line, no days, no sense
  of the journey being built.
- Itinerary stops (seen on `/itineraries/:id`) are plain white bars on a blue-dot timeline. The "4 min drive ·
  estimated" connectors are the best detail and are under-designed.

### UX friction
- "Save" next to the editable name competes with autosave ("Saved"). It is unclear what Save does.
- Section chips (Trip setup, Overview, Places to visit, Itinera…) are cut off with no affordance.

### Missing states
- A designed empty map ("Your route will draw here").
- A generating state (Crabby thinking while the plan builds).

---

## 7. Profile (`/me`)

### Keep
- Clear, honest sections: guest card, trips, saved, stamps, offline packs, language and theme, privacy, links.

### Generic, flat or unfinished
- **Layout bug at 1440:** the "Me" heading sits at the container's left edge while the content is a centred 680 px
  column. The same bug appears on `/itineraries/:id`.
- **"Stamps"** ("Check in at a place with its QR code to collect its stamp") is a gamified passport idea shown as one
  grey sentence. The landing page already has beautiful taluka stamps, and Me shows none of them, not even as empty slots.
- **Offline taluka packs**, a core promise, are a line of text ("No packs available right now").
- The guest card is a generic avatar-in-circle and a blue button.

### Missing states
- An empty trips illustration; a stamp album with empty slots; pack download progress (in code, not visible here).

---

## 8. Secondary pages

| Page | What's wrong |
|---|---|
| **Place** `/place/:slug` | The no-photo hero is a **giant flat laterite brick wall** with a yellow sun disc. It is crude at 16:9 and fills 460 px on a phone. The name in EB Garamond with no Marathi name visible above the fold. Crabby context chips ("Best time to visit…") float over the verdict card and are cut by the action bar on phones. Three fixed layers stack at the bottom: chips, the action bar and the nav. On desktop the right column cards are generic white boxes. "Visited · 17 Nov 2026" (the trust signal) is tiny grey text at the very end. |
| **Stay** `/stays/:slug` | The same hero problem with the sea and palm scene, cropped so the palm cuts off the frame. The tag "Homely" is a lone grey pill. |
| **Stays / Food lists** | Rows of identical sun-and-palm thumbnails. Filter pills are generic. "37 results" and "Sort" form a native `<select>` row. |
| **Eatery** `/food/:slug` | Same hero and card patterns. The menu lines and price for two are not set as a menu. |
| **Taste Konkan** | Three fort-wall placeholders for dishes, with the grid left-aligned and the right 40 % empty. |
| **Dish** | A plain text page; "Where it's best" has no visual tie to the eateries. |
| **Ready-made trips** | Each card gets three teal dots on a line as decoration. The cards are all identical. |
| **Itinerary detail** | The left-aligned title with a centred body (the layout bug). White bar stops; a native-looking day segmented control. |
| **Start** `/start` | The QR landing for railway stations and bus stands is a mint box with a blue button. It is a missed chance to feel like arriving at a station. |
| **Navigate** | The error state is a bare text line with no way back to the trip and no "open in Google Maps" fallback shown. |
| **Login** | Redirects to `/me` while the gate is on (by design). |
| **Privacy / Terms** | A comfortable reading width, but on phones no table of contents is visible and the DRAFT banner is a generic yellow alert. |
| **QR page** `/q/:code` | System fonts as required. The "inactive" state is decent and calm, with Call 112 pinned in emergency red. The **"Crabwalk" button** gives no hint of what it does (it opens the app). |
| **404** | A small fort illustration and a blue button: decent but generic. The top bar title "We couldn't find this page" wraps to two lines. |
| **Crabby sheet** `/crabby/sheet` | The states are barely distinguishable as stills: idle, wave and think look the same. |
| **Owner, me/requests, me/crabby** | Standard Tideline forms and lists. Nothing wrong, nothing ownable. |

---

## 9. Crabby the mascot

**Keep:** the fiddler-crab concept, laterite shell with riso grain, navy ink, tall eye stalks and named animatable parts.

**Fix:**
- **The big claw does not read as a claw.** It is a red ball with a pale cone or shell on top, like holding an ice cream.
  At 24 px (nav, launcher) it reads as "crab with a balloon". The asymmetric claw is supposed to be the ownable
  silhouette, and it is the weakest part.
- **The carapace is a generic dome.** Fiddler crabs have a broad, trapezoid shell, widest at the front, with the eyes at
  the front corners.
- **There is a tiny smile on the body.** The brief says no human mouth. It makes Crabby read as a toy, not a character.
- **The states differ only in motion.** As stills (stickers, empty states, social cards) they are near-identical.
- **There are two Crabbies in the product.** `Crabby.svelte` (landing and onboarding) and `CrabbyMark.svelte` (app shell)
  differ in weight and detail. The app's floating launcher shows Crabby as a white silhouette on blue.

---

## 10. Cross-cutting issues

- **Two identities** (§0).
- **Identical rounded cards everywhere** in the app: white, 20–28 px radius and a soft shadow for places, stays, food,
  trips, settings, verdict, facts and so on.
- **Placeholder art is the weakest layer.** One hero is a brick wall, the stays repeat one palm, dishes show a fort
  and place cards become chevrons. Many listings will have no photos for a long time, so the no-photo treatment *is*
  the design for most users.
- **Bilingual typography is treated as a translation, not a design element.** Devanagari appears small, as an
  accent under Latin. In MR and HI the hierarchy should flip.
- **Motion in the app** consists of rise-in, press-scale and a shimmer. None of it carries meaning: no sideways
  movement, no tides, no routes drawing.
- **No page transitions** between app routes. Each page hard-cuts.
- **Performance:** the landing already fails LCP (5.4 s on simulated slow 4G). Any elevation must cost less than it
  adds. The main lever is the shared app shell JS (about 190 KB gz) loaded on marketing routes (LJ-11, an owner decision).

## 11. Found issues (not design; logged, not fixed)

- The Discover place-card no-photo renders as maroon chevrons at tall crops (a `NoPhoto` scene crop and colour bug).
- The `/me` and `/itineraries/:id` page title sits outside the content column at 1440.
- The Discover page search field overflows the 390 px viewport.
- The hero shows dev-only "PHOTO SLOT …" caption text.
- The local DB carries hundreds of e2e leftover rows (affects local review only).
