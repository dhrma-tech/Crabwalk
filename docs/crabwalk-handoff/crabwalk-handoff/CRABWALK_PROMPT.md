# Crabwalk: build the landing page and onboarding as award-level, artistic web pages

You are a senior creative developer and art director: the kind of person whose sites win Awwwards Site of the Day. Your job is to turn the design references in `design-reference/` into a production website for **Crabwalk**, and to raise them well beyond what they are now.

Read this whole file and every file in `design-reference/` before writing code.

---

## 1. What Crabwalk is

Crabwalk is a single platform for exploring the Konkan coast of Maharashtra, starting with Ratnagiri district. It has:
- verified place guides
- stays sorted by vibe
- authentic local food
- an offline-ready map
- an AI trip planner and guide called **Crabby**

Instead of stars, it rates places with an honest one-word verdict (Must visit, Worth it, Timepass, Skip), split by family, couple, solo and friends. Users browse in English, Hindi and Marathi.

The audience is Indian travellers (Pune, Mumbai, Kolhapur, Bangalore) on mid-range Android phones, often on weak 4G or 2G near the coast.

## 2. The honest problem with the current designs

The reference files are a correct **wireframe**: the right sections, order, content and palette. They are not yet beautiful. Specifically:
- **Crabby looks generic.** It is a clip-art oval crab with no personality or silhouette, and it could belong to any app.
- **Everything is flat and static.** There are no meaningful animations, no scroll storytelling and no moment that makes someone say "wow".
- **The illustrations are placeholders.** The flat SVG hills, houses and avatars look like templates, not like Ratnagiri.
- **Layouts are safe.** Card grids and centred headings make it read like a typical travel startup, not something designed by a skilled studio.

**Your mandate:** keep the structure and content, and rebuild the craft. The site should feel artistic, hand-made, rooted in the Konkan and full of considered "wow" moments, while staying fast and accessible.

## 3. Reference files and how to read them

`design-reference/` holds six `.dc.html` files. They are design-tool files. Read them as **reference markup** for layout, copy, data and interactions. Do not run them, and do not copy their inline styles or their `<x-dc>`, `<sc-for>` and `support.js` runtime.
- `landing.dc.html`: the full landing page. Its links to `Main.dc.html` mean this landing page.
- `ob1-login.dc.html` to `ob5-food.dc.html`: five mobile onboarding screens, 390×844.

The data arrays inside each file's `renderVals()` hold the real content: categories, hidden gems, taluka data, Crabby points, verdict distributions and onboarding options. Move that data into typed content files. Do not hard-code it inside components.

## 4. Brand foundations (keep these)

### Palette
These are the base colours; they are what the site owner chose.

| Token | Hex | Use |
|---|---|---|
| `--navy` | `#2F4156` | Primary text, primary buttons, dark sections |
| `--teal` | `#567C8D` | Secondary, the sea, accents |
| `--sky` | `#C8D9E6` | Light sections, sky, soft fills |
| `--beige` | `#F5EFEB` | Page background, paper |
| `--white` | `#FFFFFF` | Cards, raised surfaces |

Supporting shades already used in the files: `#436475` (muted text), `#A9C2D4`, `#8AA7B9`, `#DCD3CC` (borders), `#E6DED8`.

**One warm accent is allowed**, used sparingly for moments of life: laterite red `#B5462B` (Ratnagiri's red stone forts and earth) or mango `#E8A33D`. Use it for Crabby's shell, a single highlight per screen, and hover sparks. Never use it for large areas.

Emergency red `#D32F2F` is reserved for 112/SOS only.

### Type
- **Display:** Gloock, for big editorial serif headlines.
- **UI and body:** Instrument Sans.
- **Devanagari:** Tiro Devanagari Marathi.

You may propose a more expressive display face if it is clearly better, for example Fraunces with its soft and wonk axes. Explain why before switching.

Self-host all fonts as subset WOFF2 files, use `font-display: swap`, and load at most 4 font files.

Devanagari text gets about 10% more line height, no letter-spacing and no all-caps.

### Voice
- Friendly local guide: short, plain, sentence case.
- No exclamation marks in system text, no emojis anywhere and no lorem ipsum.
- Keep the placeholder brackets (`[n] votes`, `₹[total]`) until real data exists. Never invent statistics.

## 5. Art direction: "Konkan field journal"

Aim for one nameable aesthetic: **a coastal field journal crossed with a vintage Indian travel poster.**
- **Paper and print:** a warm paper-grain texture over the whole page at 3–6% opacity. Risograph-style grain inside illustration fills. Slight misregistration on accent shapes.
- **Ink-line illustration:** hand-drawn-feeling line art with confident strokes, slightly imperfect and with tapered ends. Use it for icons, map, coastline, forts, the lighthouse, boats and palms. Avoid geometric clip-art.
- **Layered cut-paper depth:** hills, sea and cliffs as stacked layers that move at different speeds. This gives a diorama feel without WebGL.
- **Editorial typography:** big confident serif headlines with tight tracking and generous whitespace. Small all-caps Latin labels with wide letterspacing, and handwritten-style Devanagari accents.
- **Collectible details:** postal-stamp style badges per taluka, tide-chart line motifs, dotted coastal route lines and map leader lines. These make the site feel crafted.
- **Photography (when real photos arrive):** apply a consistent duotone or palette-graded treatment (navy shadows, beige highlights) so photos of mixed quality look like one set. Hover reveals the full-colour photo.

**Do not use:**
- glassmorphism everywhere
- purple or blue gradient blobs
- generic three-column icon cards
- drop shadows on everything
- stock 3D illustrations
- emoji
- the default Tailwind look

If something looks like a template, redo it.

## 6. Crabby: redesign the mascot first

Crabby is the brand's soul and the name's pun: a crab walks sideways. Build Crabby **before** the pages, because every wow moment uses it.

**Character brief:**
- **Species:** a **fiddler crab**, common in Konkan mangroves. Its one oversized claw and one small claw give it an instantly recognisable, ownable silhouette, unlike a generic round crab.
- **Colour:** laterite-orange shell with a beige belly, navy ink outlines and a little risograph grain.
- **Face:** tall eye stalks with big expressive eyes. Eyes carry 80% of the emotion. No human mouth unless it is tiny.
- **Personality:** curious, a bit cheeky, knows every hidden beach, slightly proud of the big claw (uses it to point, wave and hold things).
- **Line quality:** matches the field-journal illustration style.

**Build:**
- Make it an SVG with named, separately animatable parts: `body`, `eyeL`, `eyeR`, `stalkL`, `stalkR`, `bigClaw`, `smallClaw`, and `leg1` to `leg6`.
- Rive is also acceptable, with a state machine.
- Give it these states:

| State | What it does |
|---|---|
| `idle` | Breathing, blinking every 3–6 s at random |
| `wave` | Big claw wave |
| `scuttle` | Sideways walk cycle, alternating leg groups |
| `point` | Big claw points at something |
| `think` | Small claw taps |
| `celebrate` | Hop and claw clack |
| `sleep` | Eyes droop; used for offline states |

- The eyes follow the cursor (desktop) or device tilt (mobile, only when permission exists), within a small radius.
- Export one `<Crabby state="…" />` component used everywhere.
- Show a character sheet of all states on a hidden `/crabby` route so it can be reviewed.

If you cannot reach a high-quality result in code, say so plainly. Build the best version you can, and write `CRABBY_BRIEF.md` so a human illustrator or Rive animator can produce the final art. Do not settle for a generic crab silently.

## 7. Landing page: sections, in this exact order, with the upgrade for each

Build a single page in this order. For every section, keep the reference content and add the craft described.

### 1. Hero

**Keep from the reference:**
- nav: logo, Discover / Map / Plan / Taste Konkan / Stays, EN/हि/म switch, Sign in
- eyebrow "The Konkan coast, verified on foot"
- रत्नागिरी over a huge "Ratnagiri" headline, plus the subtitle
- dotted coastal route Jaigad → Ganpatipule → Aare Ware → Ratnadurg → Bhatye → Pawas
- the "9 TALUKAS · 3 LANGUAGES · 1 COAST" tag

There is deliberately no search or AI bar here.

**Wow moments:**
- **Living coast diorama:** 5–7 illustrated parallax layers (sky, far hills, near hills, sea with animated wave lines, Ratnadurg cliff with the lighthouse, foreground palms or rocks). The mouse and scroll shift the layers.
- **Real-time sky:** the sky colour and sun position follow the current time in Ratnagiri (IST): dawn, day, golden hour and night. At night the lighthouse beam slowly sweeps and a few stars appear. Fall back to golden hour if `prefers-reduced-motion` is set.
- **Headline entrance:** "Ratnagiri" reveals letter by letter, rising from behind a wave mask. रत्नागिरी writes itself as a stroke animation.
- **Route draws itself** after the headline. Each stop pops in with its label, and a tiny Crabby scuttles along the route and stops at Pawas.
- **The headline and route are real HTML text**, not images. Respect the reduced-motion setting.

### 2. Scroll notch, then "Discover Ratnagiri" taluka map

**Keep:**
- the hanging notch with the down-arrow circle between the hero and the map
- left: "Discover Ratnagiri" copy, buttons for the 9 talukas and a detail card (EN and MR names, description, key spots, "Explore … · [n] verified places")
- right: an outline map of the 9 talukas with a dotted Arabian Sea, 12 labelled places with leader lines and a north arrow. Ratnagiri is selected by default.

**Upgrade:**
- **Use real geometry.** Get the taluka boundaries from OpenStreetMap or official data, simplify them, and output as SVG paths. The reference map is a hand-drawn approximation and must not ship.
- **Scroll-linked draw-in.** The district outline draws first (stroke-dashoffset), then the taluka borders, then the markers drop with a small ink splash, then the leader lines and labels type in.
- **Interaction.** Hovering a taluka or button floods it with a watercolour-style wash: an SVG turbulence filter or a pre-made texture mask, not a flat fill. The detail card cross-fades. A postal-stamp badge for that taluka "stamps" onto the card with a slight rotation.
- The notch arrow pulses gently every few seconds until the user scrolls.

### 3. "Eleven ways into the coast" (categories)

**Keep:** the 11 categories (Beach, Fort, Temple, Waterfall, Viewpoint, Backwater, Cave, Museum, Village, Market, Orchard).

**Upgrade:**
- Replace the round icon chips with **hand-drawn ink icons that draw themselves** on hover or in view.
- Lay them out as an editorial index or a gently drifting horizontal ribbon, not a uniform grid.
- Hovering a category shows a small floating preview: a photo in duotone and a count of verified places.

### 4. "The quiet side of Ratnagiri" (hidden gems coverflow)

**Keep:**
- the centre-focus carousel with taluka filter chips, arrows and the 01 / 06 counter
- the caption under the active card: category, taluka, EN and MR name, verdict bar, `[n] votes`
- the six gems: Velneshwar, Bhandarpule, Marleshwar, Kolthare, Pawas, Ladghar

**Upgrade:**
- **Physical feel:** drag or swipe with inertia and snapping, plus keyboard arrows. Side cards are slightly rotated in 3D, depth-blurred and dimmed.
- The image inside each card has its own subtle parallax as it moves.
- When a card becomes active, its verdict bar animates its fill and the caption text crossfades with a short slide.
- Gentle autoplay that pauses on hover, focus and reduced-motion.
- Use real photo slots. Until real photos arrive, illustrated placeholders in the new art style.

### 5. "Why Crabwalk" (big offline map + Hotels / Stays / Places cards)

**Keep:**
- a large dark map panel with the copy "A map that works where the network doesn't"
- layer chips: Places, Stays, Hotels, Fuel, ATM, Hospital
- buttons: "Open the map" and "Get offline pack"
- a legend
- three cards below it: Hotels, Stays, Places

**Upgrade:**
- **An "offline demo" moment.** A small toggle labelled "Turn off network". When pressed:
  - the signal bars drop
  - a "No network" chip appears
  - the map stays fully alive: pins remain and the trip route keeps drawing
  - Crabby (in the `sleep` state, then `wave`) says it still works

  This proves the USP in two seconds.
- Pins drop in a staggered order as the section enters. The planned route draws as a dotted line.
- On the three cards, illustration layers shift on hover and the arrow button rotates 45°.

### 6. "Meet Crabby"

**Keep:**
- the sky-blue section, "Say hello to your Konkan local", the नमस्कार greeting bubble
- floating sample questions in English, Marathi and Hindi, plus the voice one
- four cards: Speaks your language, Does not just answers, Honest by design, Safety comes first
- buttons: "Chat with Crabby" and "See how it plans a trip"

**Upgrade:**
- **This is the signature moment.** As the section enters, Crabby **scuttles in sideways** from off-screen, stops at centre stage, turns its eyes to the viewer, and waves with the big claw.
- The question bubbles then float up around it one by one with a typing effect, each in its own script. Clicking a bubble makes Crabby `point` at it.
- **Recurring crab walk:** a tiny Crabby walks along the bottom edge of the viewport as the page scroll-progress indicator. It scuttles in the direction of scroll and stops (idle) when scrolling stops. Keep it subtle, hide it on very small screens if it gets in the way, and drop it entirely under reduced-motion.

### 7. "Trip planner"

**Keep:**
- copy "Tell it your trip. Get a plan with reasons."
- buttons and ready-made route chips
- the chat mock: user message "3 days, family with kids, veg, low budget", Crabby's Day 1 plan with D1/D2/D3 tabs, a timeline of 4 stops each with a reason chip, "Estimated for 4 people · ₹[total]", Apply and Discard

**Upgrade:**
- **The demo plays itself when in view:** the user message types out, Crabby `think`s, then the plan assembles stop by stop. Reason chips pop in.
- A mini map beside the timeline draws the day's route as each stop appears.
- The D1, D2 and D3 tabs really switch the content. Replay on click.

### 8. "The verdict"

**Keep:**
- the traveller wall: 9 staggered columns of portrait tiles, some carrying verdict tags, plus a tilted featured traveller with its "Must visit · Velneshwar · family trip" card
- the headline "Rated by travellers, in one honest word"
- the verdict gauge card for Ratnadurg Fort: Family / Couple / Solo / Friends switch, "Must visit [%] of [n] votes", the 4-colour bar and legend
- the "Read traveller verdicts" button

**Upgrade:**
- **Wall in motion:** the columns scroll infinitely and vertically, alternating up and down at slightly different speeds, with the top fade mask. Hovering pauses the wall.
- Portraits use illustrated avatars in the new style until real, consented photos exist. Never use AI or stock faces presented as real travellers.
- **Gauge:** switching the traveller group animates the bar segments with spring physics, and the percentage counts up.

### 9. Closing call to action and footer

**Keep:** "Start your Konkan trip", the two buttons, the giant कोकण watermark, and the footer columns (Explore, Plan, For hosts) with the OpenStreetMap credit.

**Upgrade:**
- कोकण is **filled with animated water**: a clipped wave fill that slowly rises and sways.
- The footer's top edge is a tide line that ripples.
- Crabby sits on the tide line and waves goodbye when the footer enters the viewport.

### Section transitions

Do not use flat colour cuts between sections. Use wave edges, torn-paper edges and the notch, varied across the page, so the scroll feels like moving along a coastline.

## 8. Onboarding: five screens, plus the missing OTP step

**Keep the content and flow** of `ob1` to `ob5`:
1. Login / sign up: phone + OTP, Google, email, "Explore without an account"
2. About you: name, language as 3 cards with sample lines, starting city
3. Who's coming: Solo / Couple / Family / Friends, extra-care chips, how you travel
4. Interests (14 options with a "picked" count), pace, "Prefer hidden gems" switch
5. Food, daily budget, stay type, privacy note, "Start exploring"

**Add:** a proper OTP screen between login and step 1. It has 6 digit boxes, `autocomplete="one-time-code"`, paste support, a resend timer and an error state.

**Upgrade:**
- **One continuous scene.** The top area of every step is the same living coast illustration, which changes per step:
  - login: beach at dawn
  - about you: village lane
  - who's coming: Ratnadurg fort
  - interests: waterfall and orchard
  - food and budget: evening market and thali

  Use a crossfade with parallax between steps, not a hard cut.
- **Crabby is a shared element.** It moves between steps and **reacts to choices**:
  - picking Family makes it hold a small crab
  - choosing Packed pace makes it scuttle faster
  - toggling hidden gems makes it hold a gem
  - picking Veg makes it hold a leaf

- **Trip postcard.** A small postcard builds up as the user answers: their name, a stamp per interest, the group icon and the budget. The final step flips the postcard to reveal "Your Konkan is ready, [name]" before going to the landing or home page. This is the onboarding's wow moment.
- **Steps slide sideways**, the way a crab walks.
- **Micro-interactions:**
  - chips press with a spring
  - the progress bar segments fill with a liquid motion
  - the language cards re-render the whole step's sample text in that script instantly
- **Layout:**
  - mobile-first at 390 px
  - on desktop, a split screen with the scene on the left (about 55%) and the form on the right
- Keep every input real and accessible (labels, radio and switch roles, 44 px targets).
- Store the answers in one onboarding state, persisted to localStorage, so a refresh does not lose progress.
- Use Google's official sign-in button assets.

## 9. Tech approach

- **Inspect the repo first.** If a framework already exists, use it. If not, use **Next.js (App Router) + TypeScript + Tailwind CSS**, with design tokens as CSS variables mapped into the Tailwind theme.
- **Motion:**
  - GSAP + ScrollTrigger for scroll storytelling (GSAP and its plugins, including SplitText, DrawSVG and MorphSVG, are free to use)
  - Lenis for smooth scrolling, disabled under reduced-motion
  - Motion (Framer Motion) for onboarding UI transitions and springs
  - Rive for Crabby if you choose that route
- **Performance:**
  - code-split each section's animation and lazy-init it when near the viewport
  - target **LCP under 2.5 s on 4G on a mid-range Android** and initial JS under 200 KB gzipped
  - images in AVIF/WebP with `srcset`, lazy loading and blurred placeholders
  - no WebGL unless there is a static fallback and it is lazy-loaded
  - on low-end devices (`navigator.hardwareConcurrency <= 4` or Save-Data), reduce parallax layers and particle effects
- **Accessibility:**
  - WCAG 2.2 AA, with visible focus rings and semantic HTML
  - all decorative SVG `aria-hidden`
  - every animation respects `prefers-reduced-motion` (fade or no motion)
  - carousels are keyboard-operable and pausable
  - colour is never the only signal
- **i18n:** structure all copy for EN/HI/MR from day one (for example next-intl). Marathi and Hindi strings can stay as they are in the references for now. Mark machine-written ones for native review.
- **Content:** typed data files for categories, gems, talukas, verdicts, Crabby points and onboarding options. Use `[ ]` placeholders where the real data is unknown.

## 10. How to work

1. **Read** this file and all reference files.
2. **Write `PLAN.md`:**
   - stack and folder structure
   - asset list (illustrations, Crabby parts, photo slots)
   - motion inventory per section
   - performance budget
   - anything you would change in the design, with reasons

   Then proceed without waiting.
3. **Build in this order:**
   1. tokens, fonts and paper texture
   2. Crabby with its `/crabby` character sheet
   3. landing sections in page order
   4. onboarding

   Commit after each section with a clear message.
4. **Check your own work after every section:**
   - Use Playwright to screenshot at 390, 768 and 1440 px, with and without reduced motion. Look at the screenshots.
   - Ask: "Would a top studio ship this? Is there a wow moment? Does it look like Ratnagiri, or like a template?"
   - If the answer is weak, iterate before moving on.
5. **Finish with:**
   - a Lighthouse run (mobile) and an axe accessibility check, fixing what they flag
   - a `HANDOFF.md` listing the photo shots needed, the copy that needs native Marathi/Hindi review, the map data source, and anything still placeholder

## 11. Definition of done

- Every section and screen from the references exists, in the order given, with its content intact.
- Crabby is a distinctive fiddler-crab character with all its states, used consistently across the site.
- At least these wow moments work smoothly:
  - the living hero with real-time sky
  - the self-drawing taluka map
  - Crabby's scuttle-in
  - the scroll-progress crab walk
  - the offline-map demo
  - the self-playing trip planner
  - the moving verdict wall
  - the water-filled कोकण
  - the onboarding postcard reveal
- The site looks hand-crafted, cohesive and unmistakably Konkan, not like a template.
- It is fast on mobile, accessible, respects reduced motion, and has no console errors.
