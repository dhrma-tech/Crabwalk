# Crabwalk improvement plan

Phase 2 of the design elevation brief. Read with `design/DESIGN_AUDIT.md`. No code has been changed. **Approval
needed before Phase 3:** the plan as a whole, and each item in §9 "Proposals".

---

## 1. Art direction

> **The verifier's field kit: everything in Crabwalk looks like something our team carried along the coast, such as
> a notebook, a rubber stamp, a bus ticket, a station board, a mango-crate label or a tide table, printed in navy ink
> on Konkan paper, with one laterite-red mark of life.**

This is an evolution of the existing "Konkan field journal", not a replacement. The palette, fonts, paper grain,
ink-line art and print shadows stay. What changes is that **every component becomes a real object from the world of
travelling the Konkan**, the way a bill-splitting app can be built from receipts and stamps. Today the journal is
mostly a style (paper and serif). The kit makes it a world.

### What the quality-bar reference teaches, applied here (no copying)

| Lesson | Crabwalk version |
|---|---|
| Visuals come from the real objects of the topic | Station nameboards, ST bus tickets, highway milestones, inland letters and postmarks, mango-crate stencils, tide tables, rubber stamps, the verifier's ruled notebook |
| A confident local voice | Short Konkan-flavoured lines from Crabby ("भरती येतेय: the tide's coming in, wait till 4:30"), never cute, never salesy |
| Bilingual type as design | Three-script station boards (English, हिंदी, मराठी stacked like a real railway board), Devanagari set **as large as** Latin, with the hierarchy flipping in HI and MR |
| Each section tells a small story | Each page section is a moment of the trip: arrive at the station, read the board, buy the ticket, walk the coast, stamp the notebook, post the card home |

### The Konkan source library

These are the motifs every page draws from. Each is used where it carries meaning, never as wallpaper.

| Object or pattern | Where it comes from | Used for |
|---|---|---|
| **Railway station nameboard** (yellow board, black three-script lettering) | Konkan Railway stations across the district | Page and place headers, route stops, the `/start` page, Devanagari-first headlines |
| **Highway milestone** (white stone, yellow cap, town and km) | NH-66 and the coastal roads | Distances ("Ganpatipule · 25 km"), Near me, drive times in plans |
| **MSRTC "Lal Pari" ticket** (narrow printed slip, perforated edge) | ST buses everywhere on the coast | Plan day cards, itinerary stops, share links, the ready-made trip card |
| **Inland letter and postcard, postmark** (pale blue fold, round date stamp with town) | India Post | Onboarding postcard, share sheet, saved trips, "sent" confirmations |
| **Rubber stamp** (inked, slightly uneven, rotated) | Every office and every verifier's kit | The verdict ("MUST VISIT"), "Verified on foot · 12 Nov", owner claim states |
| **Mango-crate stencil** (spray stencil lettering, crate slats, hay) | Ratnagiri Hapus packing season | Category labels, the In season strip, Taste Konkan section labels |
| **Tide table** (printed columns, a tide curve) | Newspaper tide tables, fishermen | Tide slider, place status, map tide layer, "भरती / ओहोटी" labels |
| **Laterite block** (pitted red stone, chisel marks) | Forts, walls and houses | Section edges, stamp texture, Crabby's shell grain, the no-photo "heritage" scene |
| **Mangalore tile roofline** (scalloped terracotta rows) | Konkan houses | Section edges for village and stay content, the Stays header |
| **Sand-bubbler crab pellets** (sand balls radiating from a burrow) | Every Konkan beach at low tide | Loaders, empty states and Crabby's burrow (a pattern made by real crabs) |
| **Crab tracks** (sideways dotted prints) | Beaches | Route lines, the scroll-progress trail, page-transition wipes |
| **Rangoli dot grid** | Thresholds at homes and temples | Empty grids, the stamp album's empty slots, the onboarding chip field |
| **The verifier's ruled notebook** (punched holes, margin rule, handwritten date) | Our own field team | Place "Story" and field notes, privacy reading pages, the review queue (staff) |
| **Kokum, solkadhi, banana leaf** | Konkani kitchens | The no-photo "kitchen" scene for food and dishes (replaces the fort wall) |

---

## 2. Refined tokens

These extend `journal.css`. Nothing here replaces an existing journal value; tints and shades are added around the
owner's palette. The app gets these values only if Proposal **P1** is approved. Otherwise Tideline keeps its tokens
and receives only the motifs (see §9).

### 2.1 Colour

| Ramp | 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 |
|---|---|---|---|---|---|---|---|---|---|---|
| **Navy (ink)** | `#F1F5F9` | `#E3ECF3` | `#C8D9E6` sky | `#A9C2D4` mist | `#8AA7B9` haze | `#567C8D` teal | `#436475` muted | `#3A5068` | `#2F4156` **navy** | `#1F2C3B` ink |
| **Paper** | `#FBF8F5` | `#F5EFEB` **beige** | `#ECE3DC` | `#DCD3CC` line | `#C4B6AA` | `#9C8B7E` | | | | |
| **Laterite** | `#FBEDE8` | `#F4DDD4` | | | `#D9785A` soft | | `#B5462B` **laterite** | `#8E3520` | | |
| **Station yellow** (new supporting accent) | `#FDF3DC` | | | | `#F4B740` **station** | | `#C98E12` | | | `#3D2A00` on-station |

- **Station yellow `#F4B740`** is the one supporting accent the brief allows. It is the colour of station boards,
  milestone caps and Hapus mangoes. It is the same value as Tideline's `--alphonso`, so the two systems already share
  it. It is used **as a fill only, never as text**. Navy on station is 5.8:1 (AA).
- **Laterite** stays the "one mark of life per screen": Crabby, one highlight, the active stamp. It is never used for
  ratings (a low verdict is never red) and never for big areas.
- **Emergency red `#C8102E`** (app) and `#D32F2F` (journal) are reserved for 112 and SOS. P1 unifies them on the app
  value, which is already contrast-tested.
- **Verdict inks** (navy family only, never red): Must visit `#2F4156`, Worth it `#567C8D`, Timepass `#A9C2D4`, Skip
  `#C4B6AA` with a pattern fill, so colour is never the only signal.
- **Night tide (dark, needed only if P1):** bg `#111A24`, surface `#18232F`, surface-2 `#203040`, line `#2C3D4F`,
  text `#F5EFEB`, text-2 `#B8C6D2`, laterite `#F08E6E`, station `#F6C35E`, focus `#F6C35E`. Paper grain at 3 %. Every
  pair goes through `contrast.test.ts` before shipping.

### 2.2 Type

The faces stay as they are: **Gloock** (display), **Instrument Sans** (UI and body) and **Tiro Devanagari Marathi**
(Devanagari display). Under P1 the app adds its existing **Anek Devanagari** text file for Devanagari body copy. That
makes 4 files in total, within the limit.

| Token | Latin | Devanagari (same token, `:lang(hi/mr)`) | Use |
|---|---|---|---|
| `--t-hero` | Gloock clamp(64px, 14vw, 200px) / 0.9, −0.035em | Tiro clamp(56px, 13vw, 176px) / 1.15, 0 | One per site (the hero) |
| `--t-d1` | Gloock clamp(40px, 6vw, 80px) / 1.0, −0.025em | Tiro ×0.92 / 1.2 | Section headlines |
| `--t-d2` | Gloock clamp(30px, 4vw, 48px) / 1.05 | Tiro / 1.25 | Page titles |
| `--t-d3` | Gloock 24–28px / 1.15 | Tiro / 1.35 | Card titles, place names |
| `--t-lead` | Instrument 18–20px / 1.6 | Anek / 1.75 | Intros |
| `--t-body` | Instrument 16px / 1.6, weight 450 | Anek / 1.7 | Body |
| `--t-small` | Instrument 14px / 1.45 | Anek / 1.6 | Metadata (never below 14) |
| `--t-caps` | Instrument 12px / 1.2, 600, +0.22em, uppercase | Anek 14px / 1.4, 600, no tracking, no caps | Eyebrows, stamps |
| `--t-board` | Instrument 600, +0.04em, uppercase | Anek 600, no tracking | Station-board and ticket lettering |
| `--t-stencil` | Gloock with dashed counters via mask, 0.06em | Tiro, plain | Crate-label category names (decorative words only) |

**Bilingual rule (new):** when the UI language is HI or MR, the Devanagari name is the **primary** line at full
display size and the Latin name becomes the secondary line. On EN pages, Devanagari is set at **at least 60 %** of the
Latin size, never as a 14 px afterthought.

### 2.3 Space, radii, shadows

- **Space:** 4-pt base: 4, 8, 12, 16, 24, 32, 48, 64, 96, 128. Section padding `clamp(64px, 10vw, 128px)`. Gutter stays
  `clamp(16px, 4vw, 40px)`.
- **Radii, by object instead of one card radius:**

| Object | Shape |
|---|---|
| Ticket | 6 px corners and **semicircle notches** (CSS `mask: radial-gradient`) on both sides at the tear line |
| Postcard and inland letter | 2 px, ±1.5° rest rotation |
| Station board | 4 px, 2 px ink border, a thin inner rule |
| Stamp | Perforated edge (existing `Stamp.svelte`) or round postmark |
| Notebook page | 2 px, a punched-hole column, a red margin rule (laterite 30 %) |
| Panel (map, sheets) | 24 px |
| Pill buttons and chips | 999 px (keep) |
| Milestone | 50 % top, 4 px bottom |

- **Shadows:** keep the print offset. `--print-1: 2px 2px 0 var(--ink)`, `--print-2: 4px 4px 0 var(--ink)`,
  `--print-press: 1px 1px 0 var(--ink)`. One soft shadow exists for things that float over a map or a photo:
  `--lift: 0 12px 32px rgb(31 44 59 / .16)`. There are no other soft shadows.

### 2.4 Textures (all inline SVG or CSS, shared from one sprite, no images)

| Texture | Build | Weight |
|---|---|---|
| Paper grain | Existing fixed `feTurbulence` layer, 4.5 % | Existing |
| Laterite pits | `feTurbulence` plus a threshold `feComponentTransfer` giving sparse dark pits, as a mask on laterite fills | About 0.4 KB |
| Riso halftone | 3 px dot `pattern` used for illustration shading instead of flat tints | About 0.2 KB |
| Misregistration | Accent shapes drawn twice, the fill offset 1.5 px from the ink line (Crabby already does this) | 0 |
| Tide curve | One `path` symbol reused on edges, tide UI and loaders | About 0.3 KB |
| Tile scallop, laterite block, wave, torn paper | `Edge.svelte` variants, **each tied to content**: wave = sea sections, tile = stays and villages, laterite block = forts and history, torn paper = Crabby and notes | Existing plus 2 |
| Sand-pellet burst | Radial dots, randomised by seed, for loaders and empty states | About 0.3 KB |

### 2.5 Motion

| Token | Value | Use |
|---|---|---|
| `--dur-press` | 120 ms | Press-in on buttons and chips |
| `--dur-state` | 200 ms | Toggles, tabs, colour changes |
| `--dur-enter` | 320 ms | Element entrances |
| `--dur-sheet` | 360 ms | Sheets, dock, panels |
| `--dur-page` | 420 ms | Page transitions |
| `--dur-stamp` | 260 ms in + 120 ms settle | Rubber-stamp hits |
| `--dur-draw` | 900–1400 ms, by path length | Routes, outlines, ink icons |
| `--dur-step` | 140 ms per step | Crab walk cycle (two-beat gait) |
| `--dur-tide` | 8–12 s | Ambient water and tides |
| `--ease-out` | `cubic-bezier(.16, 1, .3, 1)` | Default entrances ("the tide going out") |
| `--ease-inout` | `cubic-bezier(.65, 0, .35, 1)` | Page and route movement |
| `--ease-spring` | existing `linear()` spring | Chips, stamps settling, Crabby hops |
| `--ease-stamp` | `cubic-bezier(.5, 0, .75, 0)` in, then `--ease-spring` | The stamp thunk |
| `--ease-scuttle` | `steps(2, jump-none)` on legs plus `--ease-inout` on the body | The sideways walk |

**Rules.**
1. **Sideways = forward.** Lateral movement means progress (crab logic): steps, tabs, pages and loaders. Vertical
   movement is reserved for water (tides rise and fall).
2. **Routes draw, never pop.** Any line between places is drawn with `stroke-dashoffset`.
3. **Stamps thunk.** Confirmations are stamps (scale 1.4 → 0.96 → 1, rotation −8° → −3°, a 4 % ink spread).
4. **Reduced motion:** everything ends in its final state, with crossfades of 120 ms or less. Ambient loops stop.
   Crabby holds still poses (each state has a designed still, §3).
5. **`html[data-lite]`** (Save-Data, or 4 cores or fewer): no ambient loops, no parallax, and route draws shorten to 400 ms.

### 2.6 Technology for motion (no new libraries)

- **CSS scroll-driven animations** (`animation-timeline: view()`) for "start when seen" effects. They run on the
  compositor and cost no JS. Chrome for Android supports them. Elsewhere the existing `inview` IntersectionObserver
  action is the fallback.
- **The View Transitions API** through SvelteKit's `onNavigate` for page transitions and shared elements (no library).
  Browsers without it get a normal navigation.
- **Web Animations API and `svelte/motion`** for Crabby and the interactive pieces, as now.
- **No GSAP, Lenis or Rive.** Every effect here is either "when seen", "follows scroll" or a state change. The landing
  already misses its LCP budget, so we can't afford another 45–150 KB. (Rive stays the route for **final** Crabby art,
  see P8.)

---

## 3. Crabby: from placeholder to character

Keep: fiddler crab, laterite shell, beige belly, navy ink, tall eye stalks, the named parts and the `<Crabby state>` API.
Same crab, better drawn, grounded in how real fiddler crabs behave.

### 3.1 Silhouette

| Part | Now | Evolved |
|---|---|---|
| **Big claw** | A ball with a pale cone on top | A real **chela**: a broad laterite "palm" (about 1.2× carapace height) with a pale ivory **fixed finger** and a hinged **dactyl** that opens and closes, tips slightly darker, with a row of small teeth. Held diagonally up and out from the viewer's right. **This is the logo.** |
| **Carapace** | A round dome | A **trapezoid**, widest at the front edge, with softened corners and a faint H-groove. It reads as "fiddler", not "generic crab". |
| **Eyes** | Two round eyes on stalks | Matchstick stalks rising from the front corners, eyes at the tips with heavy lids. The stalks **fold flat** into the shell edge (real fiddler behaviour), which gives the `sleep` state its own silhouette. |
| **Mouth** | A tiny smile | Removed. Expression comes from the lids, pupils, stalk angle and claw. |
| **Legs** | 3 + 3 | Keep 3 + 3. Lengthen slightly with a clear "knee" so the sideways gait reads. |
| **Small claw** | Small pincer | Keep. It is Crabby's "hand" for fussy actions (tapping, scooping sand, holding a pen). |
| **24 px mark** | A busy mini-drawing | A **solid laterite silhouette**: trapezoid, two stalks and the big raised claw. It passes the squint test as a fiddler crab. The same mark is used in the nav, the launcher, loaders and the favicon. |

### 3.2 Personality (from real behaviour)
- **Waves to say hello.** Male fiddlers wave the big claw in a slow arc as a display. Crabby's wave **is** that
  display, so it is one big slow arc, not a cartoon hand-flap.
- **Scoops sand when thinking.** Fiddlers feed with the small claw, scooping sand to the mouth. `think` = small-claw
  scoops, plus tiny sand pellets that collect into a little ring. The pellets become the loading indicator.
- **Retreats to its burrow when unsure.** Used for "I don't know" and empty results: Crabby half-sinks, eyes peeking
  out, never sad, just honest.
- **Walks sideways, two beats then a pause.** This is the scuttle rhythm.

### 3.3 States

Each state has a **designed still** (for stickers, reduced motion and the empty-state illustrations) and a motion.

| State | Still pose | Motion | Duration and easing | Reduced motion |
|---|---|---|---|---|
| `idle` | Claw resting low, eyes forward, lids at 80 % | Breath (shell 1.5 % scale-y), blink every 3–6 s at random, pupils follow the pointer within 2 px | 3.2 s breath `--ease-inout`; 120 ms blink | Still, eyes forward |
| `wave` | Claw raised high, dactyl open | The claw sweeps a 50° arc out and back, the dactyl snaps shut at the top, eyes lift | 2 arcs × 700 ms, `--ease-inout`, the snap on `--ease-spring` | Still with claw raised |
| `walk` (was `scuttle`) | Mid-stride, body tilted 3° in the walking direction | Leg groups alternate (`steps(2)`), body bobs 1.5 px, claw sways; moves along x only, two beats and then a 90 ms pause | 140 ms per step; `speed` multiplier | Hidden on decorative paths; a still on loaders |
| `point` | Claw straight out at the target, dactyl closed, stalks leaning toward it | The claw swings out with overshoot and holds, the eyes look along the claw | 420 ms `--ease-spring` | Still pointing |
| `think` | Small claw at the "mouth", eyes rolled up, one lid lower | The small claw scoops 3×, a sand pellet drops and the ring grows | 600 ms per scoop | Still with 3 pellets |
| `celebrate` | Both claws up, stalks spread | A squash-and-stretch hop (y −14 px), a claw clack, then **station-yellow** sand pellets burst in a ring | 520 ms hop, `--ease-spring`; 600 ms burst | Still with both claws up |
| `sleep` | Stalks folded flat, a lid line, claw tucked | Slow 5 s breath, a small "z" drawn in ink | 5 s | Still, folded |
| `burrow` *(new, P7)* | Half-sunk in a sand mound, eyes peeking | Sinks 60 %, the pellet ring settles, eyes glance left and right | 500 ms | Still, peeking |
| `hold` prop | `baby`, `gem`, `leaf`, plus new `ticket`, `postcard`, `stamp` *(P7)* | Swapped into the big claw with a 200 ms scale-pop | 200 ms | Still holding |

**Rules:** Crabby never appears on emergency or safety UI. It appears at most once per viewport (plus the 24 px mark
in the nav). It is never a loader inside a destructive confirm.

### 3.4 Delivery
- `Crabby.svelte` is redrawn in place (same parts, same props). `CrabbyMark.svelte` takes the new 24 px silhouette.
  `/crabby/sheet` shows both, with stills and motion side by side, plus the 24, 32, 48 and 200 px sizes.
- Size budget: the full component stays under 9 KB gz and stays out of the app shell (L-1). The shell keeps `CrabbyMark`.
- `CRABBY_BRIEF.md` is updated with the new silhouette for the final illustrator or Rive pass (P8).

---

## 4. Landing page (`/`)

Order unchanged: Hero → Discover Ratnagiri map → Categories → Hidden gems → Why → Meet Crabby → Planner → Verdict →
Closing. Section transitions follow §2.4: each edge comes from what the next section is about.

### 4.1 Hero, "Arriving at Ratnagiri"
**What changes and why:** the hero is a poster with no way in, loses its route on phones and has collisions (audit §1).
It becomes an *arrival*: a station board and the coast behind it.

**Visual:**
- An **eyebrow station board**: a yellow board reading `RATNAGIRI · रत्नागिरी · रत्नागिरी` in `--t-board`, replacing the
  small caps line and the floating Devanagari word. That fixes the sun collision and makes the trilingual promise visible
  in one object. In HI and MR the giant headline itself becomes **रत्नागिरी** in Tiro and the Latin moves to the board
  (bilingual rule).
- **The diorama is redrawn with real silhouettes:** Ratnadurg's headland and lighthouse, laterite cliff with pitted
  texture and riso shading, Mangalore-tile roofs among the palms on the near hill, a fishing **hodi** with a pennant in
  place of the generic sailboat. Same six layers, no added weight (shared symbols).
- The **route** keeps its six stops, but the labels move off the line on leader ticks so nothing is struck through. On
  phones the route is kept and **re-laid vertically** down the right side of the coast (Jaigad at the top, Pawas at
  the bottom) so it fits 390 px.
- The **"PHOTO SLOT" caption** is removed from view and stays as a `data-` attribute.
- The **tag** "9 TALUKAS · 3 LANGUAGES · 1 COAST" becomes a perforated **ST ticket** slip.

**UX:** add a primary CTA pair under the subtitle, **"Plan my trip"** (to `/onboarding`, or `/plan/new` when signed
in) and **"Explore the coast"** (to `/discover`). This is copy and flow, so it is **P4**. Until P4 is approved, the
ticket slip links to `/discover`.

**Motion:**

| Trigger | What moves | Duration and easing | Reduced motion |
|---|---|---|---|
| Load | The station board **flips down** from its top edge, like a hinged sign (rotateX 90° → 0) | 520 ms `--ease-spring` | Shown |
| Load + 200 ms | The "Ratnagiri" letters rise from behind the wave mask (existing) | 60 ms stagger, 700 ms `--ease-out` | Shown |
| Load + 900 ms | The route draws Jaigad → Pawas, stops stamp in as small postmarks, Crabby **walks sideways** along it and stops at Pawas, then waves | 1400 ms draw `--ease-inout`; stamps 260 ms | Final state, Crabby idle at Pawas |
| Pointer and scroll | Six parallax layers (existing); on scroll the sea layer **rises** 24 px over the cliffs (the tide coming in) as the hero leaves | Scroll-linked | No parallax, no tide |
| Night (IST) | The lighthouse beam sweeps, stars, lit windows in the tile-roof houses | 8 s sweep | Static golden hour |

**Wow moment, step by step:**
1. The page opens on a golden (or real-time) Konkan sky. A yellow station board swings down: *RATNAGIRI · रत्नागिरी*.
2. "Ratnagiri" rises out of the sea letter by letter.
3. A dotted crab-track route draws itself along the coast. Each stop lands as a round postmark.
4. Crabby walks the route sideways, stops at Pawas, looks at you and waves its big claw.
5. As you scroll, the tide rises over the cliffs and carries you into the map.

### 4.2 Scroll notch + "Discover Ratnagiri" (taluka map), with the hero as the Phase 3 proof pair
**What changes:** the map is the best artefact, but on phones it sits below nine chips and a card, its labels clip, and
the taluka names cross borders.

**Visual:**
- **Taluka names are placed inside each polygon** by label point (precomputed in `talukaGeo.ts`), Gloock, with no border
  crossings.
- The **selected taluka fills with a laterite-pit watercolour wash** (existing turbulence plus the new pits).
  Hovered ones get a riso halftone.
- **The detail card becomes a postcard** (postcard radius, ±1.5°) with the perforated taluka stamp *franked* by a round
  postmark: `RATNAGIRI · 22 NOV` (today's date, real).
- The notch keeps its wave shape and turns into the **tide line** edge.

**UX:**
- **Phones:** map first, full-width, with labels set ≥ 13 px. The nine talukas become a **horizontal snap strip of
  stamps** under the map (not 3 rows of pills), and the postcard below. Tapping a taluka on the map and on the stamp
  strip are synced.
- The place labels on phones drop to the six most important and appear as leader-line callouts on tap.

**Motion:**

| Trigger | What moves | Duration and easing | Reduced motion |
|---|---|---|---|
| Section 30 % in view | District outline draws, then the borders, then markers drop with an ink splash, then leader lines (existing order) | 1200 ms total `--ease-inout` | Final state |
| Taluka select | The wash *bleeds* in from the click point (a radial mask grows) | 600 ms `--ease-out` | Instant fill |
| Taluka select | The postcard slides **sideways** out and the new one slides in; the stamp **thunks** and a postmark rolls across it | 320 ms + `--dur-stamp` | Crossfade 120 ms |
| Idle 4 s on first view | The notch arrow pulses (existing) | 1.2 s | Static |

**Wow moment:** you tap "Guhagar". The ink wash bleeds across Guhagar from your finger, a postcard slides in from the
right, its stamp slams down and a postmark rolls across it with today's date.

### 4.3 Categories, "Eleven ways into the coast"
**What changes:** a good editorial index, but the icons look like Lucide and the right side is empty.
- **Visual:** each category name is set as a **mango-crate stencil label** (`--t-stencil`) with its number, and the ink
  icons are redrawn by hand from real things (Ratnadurg's bastion for Fort, Marleshwar for Waterfall, a creek ferry for
  Backwater, a Konkan *ghar* with a tile roof for Village, a Hapus crate for Orchard). The empty top right holds a
  **crate end** with the stencil "11 WAYS · RATNAGIRI" and Crabby sitting on it.
- **UX:** the whole row is the link (keep). On phones, a two-column stencil grid (not a list), so all 11 fit in about
  1.5 screens.
- **Motion:** on hover or in view, the icon draws itself (existing, 700 ms) and the stencil letters **spray in** (a mask
  of noise dots, 400 ms). The duotone photo preview stays on desktop. Reduced motion: drawn.
- **Wow moment:** run the pointer down the list and each category sprays onto the crate in turn, like labels being
  stencilled at the packing shed.

### 4.4 Hidden gems, "The quiet side of Ratnagiri"
**What changes:** this is the most template-like section (a 3D coverflow of identical flat scenes).
- **Visual:** gems become **field-notebook pages**: a ruled page with punched holes, a taped-in illustration (or the
  duotone photo later), the place name handwritten-style in Gloock with Devanagari at 60 %, a crowd note in the margin,
  and a **verdict rubber stamp** across the corner. **Each gem gets a distinct illustration** built from §1 motifs
  (Velneshwar's temple by the beach, Bhandarpule's fishing boats, Marleshwar's falls, Kolthare's turtle-nesting beach,
  Pawas's tiled lane, Ladghar's red-sand shore).
- **UX:** replace the coverflow with a **fanned stack** (the active page flat, the next two peeking with rotation).
  Swipe throws the top page aside **sideways**. Keep the arrows, the 01/06 counter, the keyboard, the pause button and
  the taluka chips. Tapping a page opens the place.
- **Motion:** throw out sideways (320 ms `--ease-out` plus rotation), the next page settles (`--ease-spring`), the
  verdict stamp thunks onto the new page (260 ms), and the verdict bar fills (500 ms). Autoplay every 5 s, paused on
  hover, focus and when hidden. Reduced motion: instant swap, no autoplay.
- **Wow moment:** flick a page off the stack like flipping a notebook; the next gem lands and gets **stamped "MUST VISIT"**.

### 4.5 Why Crabwalk
**What changes:** a three-line headline next to empty space, and three identical clip-art cards.
- **Visual:** the headline sits **beside** the map panel at 1440 (two-column), shortened visually by setting "Built
  here, checked here." in laterite italic-free Gloock as the second line. The three cards become **three different
  objects**: Hotels = a **hotel key tag** (the big plastic tag with a room number), Stays = a **handwritten homestay
  card** with a tile-roof scene, Places = a **station board** listing three places. Each object has its own shape.
- **UX:** on phones the three objects sit in a horizontal snap row (not a 1,100 px stack). The map labels are laid out
  for a 360 px panel.
- **Motion:** the offline demo gets an ending. When you toggle the network back, the signal bars climb, Crabby wakes from
  `sleep` to `wave`, and the "No network" chip is **stamped** "Still working". Pins drop with a stagger (existing).
  Reduced motion: final states.
- **Wow moment:** tap "Turn off network". The bars fall, the map stays alive, the route keeps drawing and Crabby dozes
  on the coast. Tap again and Crabby wakes up and a stamp lands: **"Worked offline."**

### 4.6 Meet Crabby
**What changes:** the signature moment works, but the four identical icon cards are template.
- **Visual:** the four promises become **four objects Crabby holds out in turn**: a three-script **station board**
  ("Speaks your language"), a **ticket** with Apply/Discard ("Does, not just answers"), a **rubber stamp** "VERIFIED
  ONLY" ("Honest by design") and a calm, unbranded **112 card** for "Safety comes first". That last one is shown as
  plain text without Crabby beside it, to respect the safety rule. The question bubbles become **chat slips torn from a
  notebook**.
- **UX:** the bubbles are buttons (existing). Tapping one makes Crabby `point` and shows a two-line sample answer that
  cites a source ("From our team's visit, 12 Nov"). This is static copy, marked as a demo.
- **Motion:** the scuttle-in is kept and changed to the two-beat walk. The promises **slide out of Crabby's claw**
  sideways one by one (`hold` → `point`), 320 ms each with 120 ms between. Reduced motion: all shown, Crabby idle.
- **Wow moment:** Crabby walks in, looks up and waves. Then, one at a time, it pulls a station board, a ticket and a
  stamp out from behind its back and points at each.

### 4.7 Trip planner
**What changes:** a solid section. It moves from "chat mock" to a **ticket being printed**.
- **Visual:** each day of the demo plan is a **long ST ticket** with perforations between stops. Each stop shows its
  time and name, and its reason chip as a tiny inked stamp. The mini map becomes a **tide-table-style route strip**
  showing the day's road distance as milestones ("12 km", "18 km").
- **Motion:** the user message types (existing). Crabby `think`s (pellets ring). Then the ticket **feeds out** from the
  top edge stop by stop (translateY with a clip, 220 ms per stop, `--ease-out`), and the route draws in step. D1/D2/D3
  switch **sideways**. Reduced motion: the full ticket.
- **Wow moment:** the plan prints out of Crabby like a bus conductor's ticket machine, stop by stop, and tears off at
  the perforation with a small tilt.

### 4.8 The verdict
**What changes:** the generic avatar wall undercuts "real travellers".
- **Visual:** replace the people avatars with a **wall of verdict slips**: real-looking feedback slips (ruled, with a
  place name, group and the stamped verdict word). They carry **no faces and no invented quotes**, only a place, a
  group and a verdict, all labelled "Sample slips". Real consented traveller photos can be taped onto slips later. The
  Ratnadurg gauge card becomes a **tide-table style column chart** turned on its side: four inked bands with hatching per
  verdict.
- **Motion:** columns drift vertically and alternate (existing loop), pausing on hover and focus. The group switch
  springs the bands (existing) and the stamp re-inks. Reduced motion: a static wall.
- **Wow moment:** switch "Family" to "Solo" and the big verdict word is **re-stamped**: the old ink lifts away and the
  new word slams down.

### 4.9 Closing and footer
- Keep the water-filled कोकण. Raise its contrast (the fill water in teal-500 to sky, the outline in navy-600) so it
  reads as letters before it reads as water.
- The CTA pair becomes **a ticket and a postcard**: "Plan with Crabby" (ticket) and "Install the app" (postcard
  addressed "To: your home screen").
- The footer columns become a **station timetable board** (navy, station-yellow headings). Crabby sits on the tide line
  and waves (existing). The OSM credit stays.
- **Wow moment:** as the footer enters, the tide inside कोकण rises to the brim and Crabby, on the tide line, waves
  goodbye with the big claw.

### 4.10 Landing performance guardrails
LCP stays the HTML headline. Nothing new is above the fold except the board (HTML and CSS). All new art is shared SVG
`<symbol>`s. Each section's code still loads on approach. Target: no regression on today's numbers; reaching LCP under
2.5 s needs **P3**.

---

## 5. Onboarding (`/onboarding`)

### 5.1 Whole flow
- **The scene stays one continuous coast** and gets taller on phones (45 % of the viewport, not 35 %). The form sheet
  overlaps it with a **tide-line top edge**, not a plain rounded rectangle.
- **The progress bar becomes a route:** six stops on a dotted crab-track line. Crabby walks to the next stop on Continue.
- **Steps slide sideways** (existing) with the scene parallaxing at 0.4× the speed.
- **The postcard is the spine of the flow.** On desktop it lives large in the scene's foreground. On phones it is a
  small card pinned top-right that grows on the last step. It is an Indian **inland letter**: a pale blue fold with a
  stamp area and a postmark.

### 5.2 Per screen

| Screen | Visual and UX upgrades | Micro-interactions |
|---|---|---|
| **Login** (dawn beach) | The headline becomes a **station board** "Your Konkan trip starts here". "Explore without an account" is promoted to a full secondary button while the gate is on (presentation only). Google uses its official button. | Board flips down on load (520 ms spring). Crabby walks in from the left and waves. |
| **Email code** | Six boxes styled as **ticket number cells**. | Each digit stamps in (120 ms). On success, a "VERIFIED" stamp thunks over the cells before advancing (260 ms + 400 ms hold). Wrong code: the cells shake **sideways** 3× (240 ms), never red, using the laterite outline and an inline message. |
| **About you** (village lane) | The language cards are **three station boards**. Picking one re-renders the step's text in that script (existing). | The picked board flips over (300 ms). Crabby's speech bubble switches script. |
| **Who's coming** (Ratnadurg) | Solo, Couple, Family and Friends become **four ticket stubs** with distinct punched icons, not four identical boxes. The extra-care and transport chips sit on a rangoli dot grid. | Ticket stub punch: a hole-punch circle appears (200 ms) and the stub rises 2 px. Family makes Crabby hold the baby crab (existing). |
| **Interests** (waterfall + orchard) | The 14 interests are **crate-stencil chips**. The "picked" count is a **tally on the postcard**: each pick adds a mini stamp to it. The empty space under the switch is removed: the switch and Continue sit right under the content. | Chip press uses a spring (existing). Each new stamp **flies** from the chip to the postcard (FLIP, 420 ms `--ease-inout`). Packed pace makes Crabby walk faster (existing). |
| **Food + budget** (evening market + thali) | The scene adds a banana-leaf thali and kokum. The budget is a **milestone slider** (the thumb is a milestone cap). | Veg makes Crabby hold a leaf (existing). The budget thumb ticks at ₹500 steps with a 1 px detent. |
| **Postcard reveal** | A full-screen inland letter. | See the wow moment. |

**Disabled Continue** becomes an outlined ticket with "Pick 3 more" printed on it, not a grey slab.

**Wow moment, step by step:**
1. On the last Continue, the scene's sky turns to golden hour (600 ms).
2. The inland letter slides up to the centre and lies flat. Every stamp collected on the way is on it, along with the
   group icon and the budget.
3. A round postmark **rolls across** the stamps: `RATNAGIRI · {today}`.
4. The letter **folds itself shut** (3 panels, 700 ms) and flips over. The front reads "Your Konkan is ready, {name}"
   in the chosen language, as the main line.
5. Crabby takes the letter in its big claw (`hold: postcard`) and walks **sideways off-screen**, and the page
   transitions to Discover. That transition is the start of the shared journey (§8).
6. Reduced motion: the finished, open letter with all stamps is shown, and a button continues.

---

## 6. App pages

These are written for the **unified identity (P1)**. If P1 is declined, every structural, illustration, motion and UX
item still applies inside Tideline's colours and fonts; only the token swap is dropped (see §9).

### 6.0 App shell (applies to every app page)
- **Top bar:** the serif "Crabwalk" wordmark with the new 24 px mark (P2), paper background with grain, and a hairline
  **tide-curve** bottom edge instead of a flat border. One search entry point: a search field on desktop and an icon on
  phones (the page-level duplicate on Discover is removed; P5).
- **Bottom nav (phones):** a paper bar with a print shadow. The centre Crabby button is a **laterite disc** with the
  new mark (not blue), raised. The active tab gets a **crab-track underline** (three sideways dots).
- **Crabby launcher and dock:** laterite, the same mark. The dock opens with Crabby **walking in** from the edge (360 ms).
- **Cards stop being one shape.** Every list item uses its object (§2.3): places = notebook entries, stays =
  homestay cards, food = menu slips, trips = tickets, settings = plain inset lists (calm).
- **No-photo treatment becomes a scene family:** coast, heritage (laterite fort), land (orchard, falls), **kitchen**
  (thali, kokum; P6) and **stay** (tile-roof ghar). Each is drawn for 4:3, 16:9 and square, so no crop ever shows
  chevrons or a bare brick wall. The scene picks small variations (boat, birds, time of day) by a hash of the slug, so a
  list of five homestays shows five different scenes. "Photo coming soon" stays.
- **Verified date becomes a field stamp:** "Verified on foot · 12 Nov" in a round navy stamp with the verifier's
  initials-style mark. It is placed near the title, not at the page bottom.

### 6.1 Discover (`/discover`)
- **What changes and why:** the most generic screen becomes "today on the coast".
- **Visual:**
  - The page opens with a **live station board**: "Today on the Konkan coast" with the date, the next **भरती / ओहोटी**
    (high and low tide) from our tide data, and sunset time. These are real values from existing `tides.ts` and `sun.ts`.
    When there is no data, the line says "Tide times not available" and nothing is invented.
  - The **In season** strip becomes **crate labels** ("HAPUS · APR–JUN"), shown only when data exists. The strip is
    hidden when empty (no dashed divider).
  - **Categories** keep their photos, inside stencil-framed crate tiles.
  - **Places** become **notebook entries** with the fixed no-photo scenes, a verdict stamp and a crowd note in the margin.
  - **Ready-made trips** become **tickets**. Taste Konkan becomes round **thali plates** with the kitchen scene.
- **UX:** order within sections is kept. The duplicate search goes (P5). Moving "Stays by vibe" below the categories is
  P5. The "See all" links become 44 px buttons at the end of each row (a "more" ticket stub).
- **Motion:**

| Trigger | What moves | Duration and easing | Reduced motion |
|---|---|---|---|
| Load | The station board's tide line **rises** to today's level | 900 ms `--ease-out` | Final |
| Row in view | Cards slide in **sideways** from the right with a 40 ms stagger | 320 ms `--ease-out` | None |
| Save (heart) | The heart is stamped and a mini Crabby mark appears on the saved count | 260 ms stamp | Instant |
| Scroll a row | The crab-track progress under the row walks (existing scroll timeline) | Scroll-linked | Static bar |

- **Wow moment:** the board at the top shows the real tide for today. Its water line rises to the current level, and a
  tiny boat bobs on it. Each day you open the app it looks different, because the coast is different.

### 6.2 Map (`/map`)
- **What changes:** stock basemap, heavy black clusters, bare error state.
- **Visual:**
  - **Basemap restyle** (P9): paper land, sky-to-teal sea with a **dotted shoreline** (the landing's Arabian Sea
    pattern), navy roads with paper casing, NH-66 in station yellow, ghat roads dashed laterite, labels in Instrument
    Sans with paper halos.
  - **Pins:** navy ink pins with a category ink glyph. Stays wear a tile-roof cap and food a plate rim, so type is never
    colour-only.
  - **Clusters:** **postmark circles** (a double ring, the count in Gloock).
- **UX:**
  - The chip strip is grouped as "Open now · Layers" | categories, with a divider and the selected chips first.
  - The bottom sheet shows a **peek with a tip** on first load ("Tap a pin, or swipe up for the list").
  - The error state becomes: "The map didn't load. Your saved taluka packs still work offline." with **Try again** and
    **Open offline packs** buttons, plus Crabby `burrow`. Presentation and copy only; no logic change.
- **Motion:**

| Trigger | What moves | Duration and easing | Reduced motion |
|---|---|---|---|
| Pin select | The pin **stamps** (scale and settle) and the sheet rises to peek | 260 + 360 ms | Instant |
| Tide layer slider | The beach access lines **fill with water** to the selected time | 200 ms per step | Instant |
| Route shown | The route draws (§2.5 rule 2) | 900 ms | Final |
| Locate me | A sand-pellet ring pulses out from your dot (once) | 700 ms | Static ring |

- **Wow moment:** drag the tide slider and the coast **floods and drains**. Beaches that get cut off turn hatched
  laterite with a "Cut off till 6:10 pm" tag, and Crabby walks to the nearest beach that's still open.

### 6.3 Crabby AI (`/crabby` and the dock)
- **What changes:** the ChatGPT clone becomes Crabby's desk on the beach.
- **Visual:**
  - **Empty state:** Crabby at 160 px on a little sand mound, `idle`, eyes following you. Next to it, a **notebook page**
    "What I know" lists real capabilities as ruled lines (verified places, tide times, verdicts, offline places,
    trip edits with Apply/Discard). The starter chips become **question slips**.
  - **Crabby's answers** are set on notebook paper with a **source footer stamp** ("From verified data · 12 Nov"). The
    user's messages are plain navy chat slips.
  - **Inline place cards** are mini notebook entries. **Action preview** is a **ticket**: Apply tears it off along the
    perforation; Discard folds it away.
  - **"I don't know"** is a distinct state: Crabby `burrow` plus "Not in our verified data yet", then "Verified places
    you could try instead" as slips.
- **UX:** move the "can still be wrong" note directly under the composer at 14 px. The mic recording state shows a
  **sand-pellet waveform**.
- **Motion:**

| Trigger | What moves | Duration and easing | Reduced motion |
|---|---|---|---|
| Send | The slip slides **sideways** into the thread | 260 ms `--ease-out` | Instant |
| Thinking | Crabby `think`: the pellet ring grows (replaces the shimmer as the main signal; the text "Crabby is checking…" stays) | Loop 600 ms | Static 3 pellets plus text |
| Stream | Text writes in (existing caret) | Existing | No caret |
| Apply | The ticket tears along the perforation, the stub flies to the plan icon and a "DONE" stamp lands | 420 ms + 260 ms | Instant "Done." |
| Discard | The ticket folds in half and fades | 320 ms | Instant "Discarded. Nothing changed." |

- **Wow moment:** ask "Plan me 2 days". Crabby scoops sand while it checks, then hands you a printed **ticket** with
  the plan. Press Apply: the ticket tears off, flies into your Plan tab, and the tab's icon gets stamped.

### 6.4 Trip planner (`/plan/new` → `/plan/:id`)
- **What changes:** an empty grey map slot and a form stack become a journey being built.
- **Visual:**
  - The **empty map** shows the district outline from the landing (the same `talukaGeo`) with your start point as a
    station board pin, a dotted "Your route will draw here" line and Crabby idle at the start.
  - The **trip setup** form becomes a **ticket booking slip**: days as a big stepper on a perforated stub, the start
    point as a station board, Who's travelling as punched ticket stubs, budget as the milestone slider, pace as three
    walk speeds (Crabby icons with 1, 2 and 3 motion lines).
  - **Day tabs** are **ticket stubs**. **Stops** are entries on a long day ticket. **Drive connectors** are road
    **milestones** ("25 min · 18 km"). Reason chips are small inked stamps (not red for "Hours not confirmed"; laterite
    outline plus icon plus text).
  - **The budget card** is a **receipt-style tally** in tabular numerals, with "2 unknown" shown as ruled blanks.
- **UX:** the explicit "Save" next to the name becomes the trip name's edit affordance, and the autosave state
  ("Saved") becomes a small stamp. Saving still works the same way (labels and placement only). The cut-off section
  chips get an edge fade and a "more" stub.
- **Motion:**

| Trigger | What moves | Duration and easing | Reduced motion |
|---|---|---|---|
| Generate plan | Crabby `think`, then the day tickets **feed out** stop by stop while the map route draws in step | 220 ms per stop; 900 ms draw | Final plan |
| Reorder (drag) | The ticket entry lifts with a print shadow; the milestones recompute and flip | 200 ms | Instant |
| "Suggest a better order" | Stops **walk sideways** into the new order (FLIP); the saved minutes count up | 420 ms `--ease-inout`; 700 ms count | Instant |
| Day switch | The tickets slide sideways | 320 ms | Crossfade |

- **Wow moment:** press Generate. The empty district map wakes up: a dotted crab track draws from the station to each
  stop, and on the side a day ticket prints out entry by entry, each with its reason stamp.

### 6.5 Profile (`/me`)
- **What changes:** a settings list becomes a traveller's **passport**.
- **Visual:**
  - The header is a **passport identity page**: name or "Guest traveller", languages as tiny boards, and the travel
    group and diet stamps from preferences.
  - **Stamps** become a real **stamp album**: nine taluka stamps from the landing (the same `Stamp.svelte`) in empty
    perforated slots on a rangoli dot grid. Collected stamps (from QR check-ins, existing data) are inked; the rest are
    pale outlines.
  - **My trips** are tickets. **Offline taluka packs** become **nine crate labels** with size, version and a
    Download/Delete action. The download progress fills the crate with hay-yellow (station) stripes.
  - Settings (language, theme, privacy) stay a **calm inset list**.
- **UX:** fix the heading alignment bug. The guest card says what's kept on the device in one line and has one Sign in
  button.
- **Motion:** a new stamp in the album (on return from a QR check-in) **thunks** in with a postmark roll (once,
  remembered locally). Pack download: the crate fills (progress-driven); when done, a "READY OFFLINE" stamp.
  Reduced motion: final states.
- **Wow moment:** the stamp album. Nine taluka stamps, the ones you've checked in at inked and dated, the rest waiting
  as outlines. It is the screenshot people share.

---

## 7. Secondary pages and states

| Page or state | Changes | Signature moment (step by step) | Reduced motion |
|---|---|---|---|
| **Place** `/place/:slug` | The hero uses the new scene family at 16:9 (no brick wall). The title block is a **station board** with EN and मराठी (hierarchy per locale). The verified **field stamp** moves next to the title. Quick facts become a **notebook page** ("Not known yet" as ruled blanks). Tide status is a **tide-table strip** with भरती/ओहोटी. Do/Don't/Safety is a calm list (safety without Crabby). The Crabby context chips move inside the page flow (no third floating layer). | 1. The board flips down. 2. The field stamp thunks "Verified on foot · {date}". 3. Drag the tide strip: the beach access line floods or drains and the status words change. | Final states |
| **Stay** `/stays/:slug` | The tile-roof scene hero. Vibe tags become **luggage tags**. The price table becomes a **rate card** with a source column. Network strength by operator is shown as signal bars per operator. | The rate card's rows slide in sideways; each source gets a small stamp ("Owner", "Agoda live"). | Final |
| **Eatery** `/food/:slug` | The kitchen scene hero. The menu becomes a **printed menu card** ("Surmai thali ...... ₹350" with leader dots). Veg and non-veg marks use the Indian food marks (green and brown square-dot), which are a real label system. | The menu card unfolds (two panels, 500 ms). | Open |
| **Stays / Food lists** | Varied scenes by slug. Filter pills become luggage-tag chips. A designed "Nothing matches these filters yet" with Crabby `burrow`. | Crabby peeks from the burrow when results are empty. | Still |
| **Taste Konkan** | Dishes become **thali plates** on a banana-leaf band (P6 for the scene). A centred grid. | Plates slide in sideways like a server laying a table. | None |
| **Dish** | "What it is" and "Story" on notebook paper. "Where it's best" as menu slips linking to eateries. | None beyond entrances. | None |
| **Ready-made trips** | **Tickets** with day count and places, "By Crabwalk" as a stamp, "By a traveller" as a handwritten note. | The ticket tears off when opened (shared element to the detail page). | Instant |
| **Itinerary detail** | Fix title alignment. Day tickets, milestones between stops, the route drawn on the district outline. | The route draws as you scroll down the stops (scroll-linked). | Final |
| **Start** `/start` | A **station arrival page**: a big board "Welcome to {station}" (from QR data) with three ways out (Plan my trip, Ready-made trips, Near this stop) as **departure board rows**. | The board's letters flip in like a split-flap departure board (once, 600 ms). | Static |
| **Navigate** | Big next-turn card on paper with a navy arrow. **Night mode suggestion** in navy. The error state offers "Back to trip" and "Open in Google Maps" (existing links surfaced). | Calm: no wow by design. The route draws once. | None |
| **Live trip** | "You are at" as a **station board**, next stop as a departure row, nudges as **conductor's slips**. | A leave-time nudge slides in sideways with a soft bell-shaped ink mark. | Instant |
| **Shared plan / group vote / join** | Read-only tickets. Votes as a **ballot slip** with Yes/Skip stamps. | The vote stamp thunks on the slip. | Instant |
| **Plan report / journal** | A **postcard and notebook** summary of the trip. | The postcard flips to its back. | Static |
| **Login** | The same station board and tickets as onboarding. | Board flip. | Static |
| **Privacy / Terms** | Notebook reading page, a sticky **TOC as tabbed page markers** on desktop and a top "Contents" sheet on phones. The DRAFT banner as a **rubber stamp** "DRAFT · NOT APPROVED BY LEGAL" (still clear text). | None (reading). | None |
| **QR page** `/q/:code` | System fonts only, under 100 KB (hard rule). A plaque-like header (border and inset rule in CSS) and the "Crabwalk" button relabelled "Open full guide in Crabwalk" (copy; P10). The emergency bar is untouched. | None by design. | None |
| **Emergency card** | **Unchanged in spirit**: calm, unbranded, no mascot, no motion except a 120 ms fade. Only spacing and type tokens. | None by design. | None |
| **404** | A **"wrong platform" station board**: "We couldn't find this page" plus "Go to Discover". The title stops wrapping. | Crabby walks in, looks at the board, shrugs its claw. | Still |
| **Error page** | "This page didn't load" as a **cancelled ticket** (a CANCELLED stamp in navy, not red) with Try again. | The stamp thunks. | Static |
| **Offline banner** | A thin **tide strip** across the top: "You're offline — showing saved data · Ratnagiri, Guhagar packs", with Crabby `sleep` at 24 px. | The strip slides down; it turns to "Back online" briefly when reconnected. | Instant |
| **Toasts** | **Small slips** with a print shadow, sliding in sideways above the nav. | Slide 260 ms, auto-dismiss after 4 s. | Fade |
| **Skeletons** | Paper blocks with a **sand-pellet shimmer** (dots, not a gradient sweep). | Shimmer 1.2 s. | Static |
| **Empty states** | Crabby `burrow` or `sleep` plus one line plus one CTA, drawn on a rangoli dot grid. | Crabby peeks out. | Still |
| **Sign-in wall** | An inline **ticket**: "Sign in to plan, save and share trips". | None. | None |
| **Owner pages, me/requests, me/crabby** | Tokens, objects (rate card, ticket, notebook) and alignment. No wow needed. | None. | None |
| **Admin (staff)** | Tokens and type only, keeping it dense and calm. The review queue uses the notebook page for field notes. | None by design. | None |
| **Focus states** | A 3 px **station-yellow** ring plus a 1 px navy inner ring (visible on paper, navy, photos and maps). Replaces the laterite and lagoon rings. | n/a | n/a |
| **Hover / active** | Hover: lift 1 px plus `--print-2`. Active: push 2 px plus `--print-press`. Touch devices: active only. | n/a | n/a |

---

## 8. Page-to-page transitions: one continuous journey

Built with the View Transitions API through `onNavigate`. Browsers without it navigate normally. Each transition is
420 ms or less and never delays input.

| From → to | Transition | Detail |
|---|---|---|
| Forward navigation (default) | **Crab-walk slide** | The old page slides 32 px left and fades; the new page enters from 32 px right. 420 ms `--ease-inout`. Back navigation reverses the direction. |
| Bottom-nav tab change | **Sideways by tab order** | Discover → Map goes right, Map → Discover goes left (direction from the tab index). |
| Card → detail (place, stay, food, trip) | **Shared element** | The card's image or scene morphs into the hero (`view-transition-name: hero-{slug}`), and its name morphs into the station board title. |
| Map pin → sheet → place page | **Shared element** | The pin's glyph becomes the sheet's icon, then the board's icon. |
| Any page → Crabby | **Crabby as the constant** | The nav's Crabby mark morphs into the chat page's large Crabby (`view-transition-name: crabby`). The dock does the same on desktop. |
| Landing → Discover | **Tide line hand-off** | The hero's tide line edge becomes the Discover top bar's tide-curve edge; the page rises from beneath it. |
| Onboarding → Discover | **Crabby carries the postcard** | Crabby walks off-screen with the letter; Discover slides in from the same side. |
| Plan → Live trip / Navigate | **Ticket to board** | The day ticket morphs into the live trip's station board. |
| Reduced motion | **Crossfade 120 ms**, no movement, no shared-element morphs. | |
| Save-Data / lite | **No transitions.** | |

---

## 9. Proposals that need your approval

Nothing in this list will be built until you say yes. Everything outside it stays inside the brief's limits
(presentation only, the same identity, refined).

| # | Proposal | Why | What it touches | If declined |
|---|---|---|---|---|
| **P1** | **One identity: move the app from Tideline onto the field-journal system** (navy, paper and laterite; Gloock, Instrument Sans and Tiro, with Anek Devanagari kept for Devanagari body text; plus a new "night tide" dark theme). | The two-products seam is the main thing that makes the app feel generic (audit §0). | Changes the main colour (sky-blue action → navy) and fonts (EB Garamond and Figtree → Gloock and Instrument Sans) on app pages. Reverses DECISIONS LJ-4 and T-1. Every contrast pair is re-tested. Light and dark both stay. | The app keeps Tideline colours and fonts and receives all the motifs, objects, Crabby, motion, scenes and transitions in this plan, with laterite and station accents mapped to Tideline's `--laterite` and `--alphonso`. The seam shrinks but stays. |
| **P2** | **One wordmark:** the serif "Crabwalk" with the new 24 px mark everywhere (retiring the lowercase blue `crabwalk`). | One brand. | The logo and app icon (PWA icons regenerated from the mark). | Two logos remain. |
| **P3** | **A lighter shell for the marketing routes** (`/`, `/onboarding`, `/start`): don't load the app shell's JS there. | The landing misses LCP (5.4 s vs 2.5 s). The shell is about 190 KB gz of the 242 KB (LJ-11). | Layout and route structure; an architecture change. | The landing can improve visually but will not meet the LCP target. |
| **P4** | **Hero CTAs** "Plan my trip" and "Explore the coast". | The hero has no way in. | Landing copy and flow (the brief said no search or AI bar; this is neither). | The ticket tag links to Discover. |
| **P5** | **Discover:** one search field (drop the duplicate) and move "Stays by vibe" below the categories. | Duplicate search and a stays filter at the top of a places page. | Section order on Discover. | Both stay; only restyled. |
| **P6** | **A "kitchen" no-photo scene for dishes and eateries** (thali, kokum, banana leaf) instead of the heritage fort wall. | A fort wall for a dish reads as a bug. | `NoPhoto` mapping, against brief §4.9 (dish = heritage). | Dishes keep the fort wall, redrawn. |
| **P7** | **New Crabby state `burrow` and new props `ticket`, `postcard`, `stamp`.** | Honest "I don't know" and empty states need a pose that isn't sad or sleepy. The props carry the objects language. | `Crabby.svelte` API (additive). | Empty states use `sleep`; props are limited to `baby`, `gem` and `leaf`. |
| **P8** | **Commission final Crabby art** from the updated `CRABBY_BRIEF.md` (illustrator or Rive on its free tier). | Code art can be good, not great. | ₹0 rule: needs a volunteer, a free tier, or your call. | The coded Crabby (redrawn per §3) ships. |
| **P9** | **Restyle the MapLibre basemap** to the journal palette (paper land, dotted shore, yellow NH-66, laterite ghats). | The stock basemap could be any city. | FRONTEND §8 map colours (spec'd). | The basemap stays; only pins, clusters and controls change. |
| **P10** | **Copy changes:** the QR "Crabwalk" button → "Open full guide in Crabwalk"; the Map error adds "Your saved taluka packs still work offline"; Discover's "Today on the coast" board line. All three languages need native review. | Clarity. | Strings in EN, HI and MR. | The current strings stay. |
| **P11** | **Discover "Today on the coast" board** shows today's tide and sunset from existing `tides.ts` and `sun.ts`. | It makes the home screen live and specific, honestly. | Adds a small data read to the Discover page load (no new API, no invented values; hidden when there's no data). | The board shows the date and region only. |
| **P12** | **The verdict wall uses slips instead of people avatars** (labelled sample, no faces). | The flat avatar people read as stock illustration. | Landing content. | The avatars are redrawn in the new style. |

---

## 10. Phase 3 proposal (after approval)

Upgrade **the hero (§4.1) and the Discover Ratnagiri map (§4.2)**. Together they show the station board, the redrawn
diorama, the bilingual rule, the route with postmark stops, Crabby's new silhouette walking, the postcard-and-stamp
card and the sideways transitions. Then: before and after screenshots at 390 and 1440 px (plus reduced motion), a
Lighthouse check that nothing regressed, then stop.

## 11. Photos and assets still needed (unchanged from the handoff, plus new)

- Hero: the Aare Ware coastal road at golden hour (3:1 safe).
- Gems (3:4): Velneshwar, Bhandarpule, Marleshwar (monsoon and dry), Kolthare, Pawas, Ladghar.
- Categories (3:2): 11, one per category.
- **New:** a close-up of a laterite wall texture (as reference for the SVG texture, not shipped as an image); a
  Ratnagiri station nameboard and an ST bus ticket (reference only, to get proportions right); a real Hapus crate
  stencil (reference only).
- Traveller photos only with consent; never AI or stock faces.
