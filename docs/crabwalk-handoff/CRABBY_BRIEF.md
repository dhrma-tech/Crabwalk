# Crabby — brief for the final art

Crabby is now drawn in code (`apps/web/src/lib/components/Crabby.svelte`, review sheet at `/crabby/sheet`). It is
a solid, distinctive placeholder, not final illustration. A human illustrator or Rive animator should produce the
final art from this brief; the component's API stays the same so the swap touches one file.

## Who Crabby is

- **Species:** a Konkan **fiddler crab** (genus *Austruca* / *Uca*, common on Ratnagiri's mangrove mudflats).
  The silhouette is the brand: **one oversized claw, one tiny claw.** Never a symmetric round crab.
- **Personality:** curious, a little cheeky, knows every hidden beach, quietly proud of the big claw. Uses the big
  claw to point, wave and hold things. Never goofy, never panicked, never on emergency screens.
- **Voice in motion:** small, quick sideways steps; pauses to look at you; the eyes do 80 % of the acting.

## Look

| Part | Now (code) | Ask of the final art |
|---|---|---|
| Shell | Laterite `#B5462B`, lighter `#D9785A` highlight stroke, riso dot grain, 1.8 px misregistered fill | Same palette. Real riso texture, slightly uneven fill edges |
| Belly | Beige `#F5EFEB` band under the carapace | Keep |
| Line | Navy `#2F4156`, round caps, 2.6 px at 200 px | Confident ink line with tapered ends, slight wobble |
| Eyes | Tall stalks, 14 px eyes, big pupil + two glints, eyelids | Keep the proportions; richer lids for blink / droop |
| Big claw | Viewer's right; palm ≈ body height; pale fingers with teeth | Keep the size ratio (palm ≈ carapace height) |
| Small claw | Tiny pincer, viewer's left | Keep |
| Legs | Three per side, two segments | Four per side is more correct; three reads better at 24 px — artist's call |
| Mouth | Tiny mouthparts curve only | No human mouth |

Accent rule: laterite is the one warm colour on the site. Crabby carries it; keep backgrounds cool behind him.

## Parts (must stay separately animatable)

`body`, `eyeL`, `eyeR`, `stalkL`, `stalkR`, `bigClaw` (with a hinged `finger`), `smallClaw`, `leg1`–`leg6`,
plus props held in the big claw: `baby` (a little crab), `gem`, `leaf`. In the SVG each part is a group with
`data-part="…"`.

## States

| State | What it does | Used on |
|---|---|---|
| `idle` | Breathing; blinks every 3–6 s at random; pupils follow pointer / tilt | Everywhere |
| `wave` | Big claw swings from the shoulder, finger flicks (2× by default, `loop` repeats) | Meet Crabby, offline demo, footer goodbye, onboarding |
| `scuttle` | Alternating leg groups, body bob, claw sway; `speed` multiplier | Hero route walk, scroll-progress crab, onboarding moves, loaders (`walking`) |
| `point` | Big claw swings out and holds; `flip` mirrors to point left | Meet Crabby bubbles, categories |
| `think` | Small claw taps; eyes look up | Trip planner |
| `celebrate` | Squash-and-stretch hop, claw clack, sparks | Onboarding milestones, postcard reveal |
| `sleep` | Lids droop, stalks lean, slow breath, "z z" | Offline states |

## Sizes

- ≥ 40 px: full drawing.
- < 40 px: a bolder **mark** (thicker lines, no grain, no props) — nav button, button loaders, avatars.
- `tone="white"`: one-colour white silhouette for filled buttons (pupils take the button colour).
- The app shell draws the mark with `CrabbyMark.svelte` (no states, ~1 KB) to stay inside the 210 KB shell
  budget; final art needs a matching static mark.

## Deliverables we need

1. Character turnaround (front, ¾, side) and expression sheet for the seven states.
2. Either layered SVG (same part names) **or** a Rive file with a state machine: inputs `state` (enum of the
   seven), `hold` (none / baby / gem / leaf), `speed` (number), `lookX` / `lookY` (−1…1).
3. A 24 px and 32 px mark that still reads as a fiddler crab.
4. Licence: work-for-hire or exclusive licence to Crabwalk; source files included.

Budget note: ₹0 tooling (Rive free tier is fine; no paid runtime).
