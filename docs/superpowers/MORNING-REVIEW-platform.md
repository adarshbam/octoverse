# Platform overnight build: morning review

Branch: `claude/platform-overnight`. Everything below is PENDING OWNER REVIEW. Frame rates are "under load" (four sessions shared one Intel UHD GPU). Nothing pushed.

Each entry: item, still paths, numbers, what to check.

(Entries added as milestones land.)

## PENDING OWNER REVIEW: M1 gate, the host's look on the P2 stage (Task 3)

Commits on `claude/platform-overnight`: `feat(octoverse): host jelly, peach-amber cups and face presets`, `chore(platform): kitless capture and host delta E check`, `feat(octoverse): host look (P2 gate, pending owner review)`.

Stills (`docs/superpowers/evidence/platform/m1/`):
- `task3-host-intro.png` (frozen intro at P2's frame, 512 x 508 at scale 2) and `task3-host-intro-mask.png`;
- `task3-side-by-side.png` (render left, P2 right, both at P2's size);
- `task3-closeup-face.png`, `task3-closeup-cups-right.png`, `task3-closeup-arms-left.png` (3x zoom, render left, the 3x panel right);
- `task3-host-back.png` (`?yaw=180`);
- `task3-iou-overlay.png` (white both, red P2 only, cyan render only).
The engine's own title and nameplate show on the stills (the dev page's `ui: 'engine'`); the platform draws its own later.

Numbers (CIE76 delta E against spec 2.1, `python scripts/host_delta_e.py <still>`):
- 12 of 17 P2 samples within delta E 10 (max of those 9.3, forehead). Misses: head side left 13.3, head side right 19.7, arm upper 18.8, arm underside 14.5, upper water 11.0. (Corrected after review: the first entry said 13 of 17, and the check read each sample a half pixel off spec 2.1's window; fixed, P2 itself now reads delta E 0.0 on every sample.)
- Every global check passes: face B - G 10.1 (<= 15), face R - B 62.1 (>= 60), crown B - R 153.6, upper head R - G 34.1, core over head R 122.0, cup R - B 108.2, mid water B 92.7, B - R 72.9.
- Silhouette IoU 0.856 (>= 0.85; Task 2 was 0.714). Mean inside the P2 mask (165, 118, 199), saturation 0.484 (target (164, 116, 204) +- 12, 0.518 +- 0.04: passes, saturation near its floor).
- Arm span 4.61 on the render, head top 0.35, head half-width 0.80, eyes (+-0.40, -0.54), mouth opening centre -0.85.
- Sparkle specks counted on the still: head 109, arms 702 (>= 30, >= 50).
- Frame rate (round 1, before the colour and shape round 2): 53.2 fps median, slow10 28.4, tier low, production build, under load (four sessions on one Intel UHD; floor 40). Round 2 changed colours and the lathe profile only, not geometry counts; not re-measured.

What to check, live at `?world=octoverse&stage=intro` (and `&freeze`):
1. Reads as its own character, not Aether: peach face (not pink-white), amber cups, blue crown over a violet dome.
2. Peach face and amber cups: the face glow from the eyes to below the chin; the cup frill along each underside.
3. The wide welcoming arms: eight, spread 4.6 wide, the side arms curled, thicker than Task 2's.
4. The open smile: a wide D, plum inside, coral tongue, at rest and in the intro.
5. The glassy jelly: lavender rim, crown light, fine specks; the back view round and glassy.

Known gaps for the owner to rule on:
- P2 lights the head's right side (134, 131, 253) and shades its left (95, 80, 237), delta E 28.7 apart; the engine's mantle has no directional light, so a symmetric head can get no nearer than about 14.5 to both (BLOCKED on E02b / owner).
- The arm upper sample (58, 55, 213) is P2's deep blue gap beside the head. Round 2 moved T1 onto it (it had read the arm's rim light) and made the lit arms violet-lavender as P2's are, so the sample now reads the shaded arm root (90, 69, 196), delta E 18.8; nearer needs bluer arms all over.
- Round 2 made the head rounder (top 0.35, topPower 1.7, bottomPower 2.45) and the cups amber-orange; the arms are still a little bluer and darker than P2's, whose tops run pink-lavender.

## PENDING OWNER REVIEW: M2, the reef world around the host (Task 5)

Commit on `claude/platform-overnight`: `feat(octoverse): reef world (pending owner review)`.

Stills (`docs/superpowers/evidence/platform/m2/`, frozen, 512 x 508 at scale 2, kit and far plate loaded):
- `task5-reef-intro.png` and `-mask.png`: the frozen intro at P2's frame;
- `task5-reef-entrance.png` and `-mask.png`: `?stage=entering&t=3&freeze`. The entrance is a placeholder until Task 12, so this frame is the intro pose, not P1's.

Numbers:
- P2 (`python scripts/host_delta_e.py`): 12 of 17 samples within delta E 10, the same 12 as Task 3. No passing sample regressed. Changes: upper head 8.6 to 8.9, face glow 7.5 to 5.8, water outside head 8.7 to 8.6, mid water 8.6 to 3.3. The five misses are Task 3's, unchanged (head sides 13.3 and 19.7, arm upper 18.8, arm underside 14.5, upper water 11.0). Every global check passes; IoU 0.856.
- The gate as a greeting (`python scripts/reef_check.py intro <still> --reference m1/task3-host-intro.png`): the brightest pixel in the gate's box is 0.230 relative luminance, against 0.712 on the host's face glow (ratio 0.32). That pixel is the surface water seen through the ruin, not the gate. The gate's own surfaces are dimmer: membrane and glyph 0.135, windows 0.10. Without the reference, the brightest is a bubble highlight at 0.684 (still below the face).
- P1 samples on the entrance still (placeholder frame): membrane 79.4, floor path 32.3, mid water 34.6. These read the intro pose, so they say nothing yet. The membrane variant's body is 0.32 x its colour, so P1's bright violet membrane is out of reach (BLOCKED on E02b: membrane body brightness).
- Frame rate, production build, intro, tier auto (production ignores the `tier` parameter), under load: 40.2, 29.0 and 37.5 fps median on the final build (earlier runs 32.6 to 80.6). The reef costs about 4.5 ms of GPU per frame over Task 3's kitless host. The 40 fps floor is marginal under load.
- Gate plinth on the dunes: the sand under the gate's footprint runs -2.528 to -2.252 against the plinth at -2.45. At the front edge the gap is at most 0.012, so the plinth sits in the sand and does not float.

What to check, live at `?world=octoverse&stage=intro`:
1. Reef light: violet stone, magenta and orange corals that differ, glass cards, path glow on sand.
2. Water colour: indigo near the host, cyan-blue toward the top right. The brief's fog `#021648` and surface glow `#1081db` were tried and measured worse on P2 (mid water 12.9, upper water 17.4). Task 3's `#141e5f` and `#20a8ff` are kept.
3. The gate as a greeting, not glare: it stands right of the head and is clearly visible in the intro. The static layout cannot hide it per stage; Task 6's frames own that.

Known gaps for the owner to rule on:
- Ruling R14 is closed (Task 5b): the eight glass cards bob (each a `bob` prop, 0.04 to 0.08 units, 5 to 9 s, own phase) and five small orange-and-violet jellyfish (three at medium, two at low) drift at the left edge of the intro frame, behind the cards (`docs/superpowers/evidence/platform/m2/task5b-reef-intro.png`). The glyph's `emissive` prop still waits on Task 12. The jellyfish are one swarm in one box, so they sit on the left edge only: the gate holds the right edge.
- Magenta corals take a glow material, so they lose the engine's coral sway and rest drop; their heights are set by hand. A per-node coral colour (E02b) would fix this.
- Cards are a glow approximation of glass.
- Under load the production kit sometimes took longer than the engine's 15 s wait, and the world fell back to level 1.

## PENDING OWNER REVIEW: M2, the entering and How It Works poses (Task 6)

Commit on `claude/platform-overnight`: `feat(octoverse): entering and How It Works poses (pending owner review)`.

Stills (`docs/superpowers/evidence/platform/m2/`, frozen, kit and far plate loaded):
- `task6-overview-vs-p3.png`: `?world=octoverse&stage=overview&freeze` (1022 x 1016, P3's 511 x 508 frame) beside P3. `task6-overview-cards.png`: the same still with the five card boxes drawn in.
- `task6-entering-t3-vs-p1.png`: `?stage=entering&t=3&freeze` (P1's 510 x 508 frame) beside P1. The entrance sheet is still the held-landed placeholder (Task 12), so this frame shows the intro pose on the stage spot, not P1's swim.
- `task6-swim-sheet.png`: the host's new swim shapes (`?pose=swim-open`, `?pose=swim-trail`, and the trail at `&yaw=90`, the profile P1 shows).
- `task6-intro.png`: the intro re-captured after the crown change below (P2 regression check).

Fix round 1 (commit `fix(octoverse): overview arms spread like P3`): the overview arms are re-traced, and the presenting mouth is the open smile (mouthOpen 0.6 to 0.85, mouthCurve 0.85 to 0.9). The stills above are re-captured.

Numbers:
- Overview head on the still (`python scripts/host_panel_check.py p3 <still>`): top -0.20, half-width 0.79, centre x -0.01 (spec -0.24, 0.81, +0.03, each ± 0.05). The head is turned 10.9 degrees: its top leans to the viewer's right, so the eye line falls to the right as P3's does (about 11 degrees).
- P3 samples: upper head 9.4, face glow 5.8 (both within delta E 10).
- Arm span on the still: x -2.20 to 1.82 (4.02 stage units). Tips (x, y): T1 (-1.15, -0.45), T2 (-1.92, -2.26), T3 (-1.07, -2.33), T4 (-0.45, -2.16), T5 (0.48, -2.16), T6 (0.72, -2.35), T7 (1.66, -2.41), T8 (1.29, -0.41). T2 fans out under Aether; T7 runs under the gold card's bottom edge and curls below it.
- P2 after the crown change: still 12 of 17 within 10, the same five misses; crown 3.2 to 5.3, upper head 8.9 to 8.3; crown B - R 140.2 (floor 140); IoU 0.856.
- Gate in the intro: unchanged (0.230 against the face's 0.712). It cannot leave the intro frame: see the gaps below.

What to check, live at `?world=octoverse&stage=overview`:
1. Head turned and low: the host sits low and a little smaller, its head leaning right as P3's.
2. T1 and T8 rising beside the cards: they leave the body low and wide, rise more than a unit and curl outward near y -0.4.
3. Clear space for five cards: the lower six arms fan wide under the face (T2 under Aether, T7 under the gold card), and no arm tip sits on a card box (the overlay still).
4. The presenting face: an open smile, close to the welcome's.
5. Face clear: no card box covers the face.

Known gaps for the owner to rule on:
- "Turned 8 to 15 degrees right" is built as a lean of the head about its neck (the eye line's fall in P3). P3 shows no turn about the vertical; if anything its face sits left of the dome's middle. Say if a turn about the vertical was meant.
- The host's face (P2's layout) sits lower and wider on its dome than P3 paints it. To land P3's face-glow sample on the chin and not the lip, the body sits 0.03 left and 0.04 higher than centred. That leaves the measured top at -0.20, 0.01 inside the tolerance.
- The crown cap starts higher (crownHeight 0.45 to 0.58): P3's upper dome is violet nearer the top than P2's. P2's crown B - R margin is now 0.2.
- The arms now spread as wide as P3's (span 4.02). The host's head is still larger relative to its arms than P3 paints it: the arm length is the config's, unchanged here.
- The gate stands fully visible behind the Nox and gold cards in How It Works (P3 shows no gate). In the intro it stays soft beside the host: the engine's stage frame is a size only, centred on the stage, so it cannot move the view off the gate (E02b or owner: a frame offset, or a per-stage layout).
- P1's head position at 3 s (spec 2.2: -0.36, -0.36, profile right) belongs to the entrance sheet (Task 12). Today the head sits at the intro spot (about 0, -0.2).

## PENDING OWNER REVIEW: M2, the landing compositions (Task 8)

Commit on `claude/platform-overnight`: `feat(platform): landing compositions (pending owner review)`.

Stills (`docs/superpowers/evidence/platform/m2/`, frozen with `?freeze`, entrance skipped, the host's reef live behind): `landing-intro-<w>x<h>.png` and `landing-how-<w>x<h>.png` at 1536x1024, 768x1024 and 390x844. Review each beside `public/octoverse/ref/p2.png` (intro) and `p3.png` (How It Works). Live at `/` and `/how-it-works` (set `sessionStorage['octoverse.octoverse.entranceSeen'] = '1'` to skip the entrance).

Numbers (`tests/e2e/platform-landing.spec.ts`, 9 of 9, Edge, `--workers=1`): the nearest card, button or text rectangle to the host's eye and mouth rectangles, in CSS px, with the camera's live hover included:

| Size | Intro | How It Works |
|---|---|---|
| 1536 x 1024 | 199 (the pill) | 64 (the gold card) |
| 768 x 1024 | 145 (See how it works) | 49 (the gold card) |
| 390 x 844 | 81 (the description) | 127 (the Veyra card) |

No horizontal scroll at any size; every button and link at least 44 px high. The face rectangles are the eyes (0.22 radius about each eye centre) and the mouth, from `faceAnchor` and the face layout, turned and scaled with the pose; checked by eye against the renders (they enclose the eyes and mouth in all six stills).

What to check:
1. Not a SaaS page: the intro is P2's own layout (wordmark with P2's gradient, tagline, description, two buttons, the pill) over the live host, with no hero block, feature grid or panel. Say if the two buttons should sit somewhere else: P2 has no room for them, so they stand between the description and the dome.
2. Text clear of the face: nothing crosses the eyes or the mouth; on the intro the whole text block is above the dome.
3. Cards in P3's places: five glass cards with accent borders (teal, blue, crimson, violet, gold), picture 70% and name and epithet 30%, stills of each world's intro; Your Octopus is the gold glyph card (a hand-drawn gold line octopus, no render). The epithets are the worlds' own ("The Keeper of Files", "The Pipeline Runner", ...), not the storyboard's.
4. Phone: host in the upper 55%, title above the host, the two buttons and the pill below it; How It Works shows a snap row of the five cards under the host, with Back at the top left and "Explore all portfolios" under the row.
5. Navigation bar: hidden until the intro text is in; wordmark, Explore, Create only.

Known gaps for the owner to rule on:
- The pill wraps to two lines on a phone ("Your Ideas. Your / Octopus. Your Universe."): 16 px text is as wide as the screen.
- Hover or focus on a card lifts it and brightens the border; the live preview and the host's look at the card come with Task 13.
- `/explore`, `/create` and the profiles are an honest "not open yet" page until their tasks.
- The phone's host box (55%) leaves the lower part of the intro empty; the overview's empty water above the host holds only Back.

## Rulings and open gaps to check (controller notes, M2)
- Card epithet text is 13px (name 16px): spec 7.15 says body text >= 16px, but 14px wraps Veyra's epithet at 768 x 1024. Kept as a caption; owner rule.
- The face-clearance e2e measures against a geometry model (`window.__platform.faceRect`), not pixels; the six landing stills were overlaid by hand. A pixel or probe check is planned for the final pass (Task 21).
- Bare `/` is now the landing; Nox's own specs open `/?world=nox` (commit 312361a, test files only).
- Reef: the glass cards now bob and five jellyfish drift at the left edge (Task 5b, R14 closed; the host look is unchanged: 12 of 17 P2 samples within delta E 10, the same five misses). The gate glyph reads like an atom/React-style mark, not the octopus logo. fps under load (production build, `stage=intro&tier=low`, which production ignores, so auto tier): 43.1 / 43.1 / 40.5 median with the jellyfish and bob, against 40.2 / 29.0 / 37.5 at Task 5; the floor is 40, so it is still marginal on the shared GPU. GPU per frame 22.8 ms (Task 5: 22.5 to 23.4), so the jellyfish and bob cost nothing measurable.

## PENDING OWNER REVIEW: M3, profile, Explore and not found (Task 9)

Commits on `claude/platform-overnight`: `feat(platform): profile, explore and not-found compositions (pending owner review)` (and its fix commits, if any, after it). Static compositions with engine stills; the live previews (hero, tile hover) are Task 13 and the real routes are Task 14. Reach them now at `/?page=profile&handle=veyra` (also `flux`, `nox`, `aether`), `/?page=explore` and `/?page=notfound` (a temporary switch in `src/platform/App.tsx`, removed in Task 14).

Stills (`docs/superpowers/evidence/platform/m3/`, 1536 x 1024, 768 x 1024, 390 x 844): `profile-<handle>-<w>x<h>.png` for all four handles, `explore-<w>x<h>.png`, `notfound-<w>x<h>.png`. Compare beside P5 (`docs/design/references/Octoverse/native-panels/05 - ...png`). Captured by `scripts/platform-pages-capture.mjs`.

Numbers: unit 39 tests in 5 files (`showcase.test.ts`, `tabKeys.test.ts`, `profile.test.tsx`, `explore.test.tsx` and the boundary test with its new allowlist cases); e2e `tests/e2e/platform-pages.spec.ts` 37 of 37 (each of the 7 pages at 360, 390, 768, 1024 and 1536: no horizontal scroll and every link, button and tab at least 44 x 44; the tabs by arrow keys, Home and End; the tile and Enter-button reading order). Whole suite 135 files, 1099 passed, 3 skipped; typecheck clean (src/platform and its tests checked through a temporary tsconfig too).

What to check:
1. Profile against P5: the hero card (rounded glass, an engine still with the world's accent border) left, identity right (name, "Showcase" badge where P5 has "Pro", epithet, the project tagline, "Enter <name>'s world"), the tab pills Projects (1), About, Tech Stack, and the project card (screenshot or the dashed "No screenshot yet" placeholder, title, tagline, first five technology chips). Gone from P5 on purpose: Follow, location, link, counts, search, Sign in, Get Started.
2. Explore: five glass tiles with each world's accent border and still, in the order Veyra, Flux, Nox, Aether, Your Octopus (the gold glyph card); each world tile says name, epithet, project title, the first three chips and "Showcase". The page reads calm, not a dashboard: one heading, the grid, the footer line.
3. Not found: "This part of the ocean is unexplored" in the title gradient on a glass card, with Back to OctoVerse and Explore.
4. Tabs by keyboard: Tab to the tab list, Left and Right wrap, Home and End jump, one tab stop.

Known gaps for the owner to rule on:
- The reef's water behind these pages is CSS (indigo, a cyan glow top right, a violet glow low left, soft light shafts), not a captured still of the reef's far water: no such still exists in the pipeline yet. The not-found page has no host picture for the same reason (Task 14 wires the real host).
- Nothing in the content supplies a profile link or a location, so the profile shows neither. Veyra and Flux have no screenshot, so their project card shows the placeholder; Nox's screenshot (the owner's supplied content) shows a site headed "VAULT" under the title Security Lab, and Aether's is the storyboard's placeholder screenshot (its alt text says so).
- Tech Stack notes: only three technologies have a usage note in the content (GitHub Actions, Kali Linux, OpenAI, each the storyboard's panel 4 text flagged as a placeholder); the others show their category only, nothing invented. About is the content's introduction and summary, which the content flags as storyboard placeholder text.
- Tile pictures are the 738 x 614 stills cropped a little; at 1536 the five tiles are about 245 px wide, so the page leaves a lot of empty water below them.

## PENDING OWNER REVIEW: M3, the creator composition (Task 10)

Commit on `claude/platform-overnight`: `feat(platform): creator composition; I01 statics (pending owner review)`. A static composition over a sample draft (Aether, peach, one placeholder project); edits live in memory only, no storage (Task 18), and the picture is the gold glyph card, not a live octopus (Task 13). Reach it at `/?page=create` (a temporary switch in `src/platform/App.tsx`, removed in Task 14).

Stills (`docs/superpowers/evidence/platform/m3/`): `creator-1536x1024.png`, `creator-768x1024.png`, `creator-390x844.png`. Compare beside P4 (`docs/design/references/Octoverse/native-panels/04 - Octoverse Create Your Own Portfolio.png`). Captured by `scripts/platform-pages-capture.mjs` (`ONLY=creator`).

What to check:
1. Not a form dashboard: two floating glass panels with a soft glow around the picture, the actions under it, as P4. Say if the right panel (four text fields, chips, an images box, a Profile fold) reads too much like a form.
2. No colour picker anywhere: template thumbnails, nine round swatches (Original plus P4's eight, sampled from P4: table in `src/platform/creator/swatchColours.ts`), four personality pills, Name. Swatches are 44 px round buttons (P4's are 18 px).
3. Publish clearly unavailable: a dashed, disabled pill with the text "Publishing arrives with accounts", never in the focus order. "See live preview" opens `/create/preview` (not routed yet: the "not open yet" page until Task 14).
4. Phone (390 x 844): the picture and its caption in a sticky top 40% (below the navigation bar), then the tabs Octopus and Projects, then the actions at the bottom of the page.
5. Tablet (768 x 1024): the picture on top, the two panels side by side; wide (1536 x 1024): left panel, picture, right panel, all in one screen.

Known gaps for the owner to rule on:
- The template thumbnails are the four world stills (the creator stills, 4 x 9, come with Task 18); the picture slot is the gold glyph, so choosing a swatch or template changes the caption and the pressed states, not the picture.
- The technology picker (searchable), project reorder, delete with undo, section text and image uploads are the editor's (Task 19): technologies show as chips and images as an empty box. Add (+) works in memory.
- The "Original" swatch is a ring of the four worlds' hues (a stand-in: Original is the template's own colours).
- The page is its own scroller (`.oct-page` is 100dvh with overflow auto), because `index.html` fixes html, body and #root at the window's height with overflow hidden. The Task 9 pages (profile, Explore) do not do this: on a phone they are clipped at the window's height and cannot be scrolled. Needs a fix before the platform ships (Task 14).

Numbers: unit 25 tests in `creatorPage.test.tsx` (and the boundary test); e2e `tests/e2e/platform-creator.spec.ts` 11 of 11 (five widths: no horizontal scroll, 44 px controls, the Profile fold opened; phone tabs and sticky 40%; keyboard order and the lavender focus ring; both panels at 1536 and 768).


## PENDING OWNER REVIEW: M4, How It Works alive (Task 13)

Commit on `claude/platform-overnight`: `feat(platform): How It Works alive (pending owner review)`. Owner review could not happen overnight; the live landing end to end is yours. What is built: the card ripple (five cards in over 600 ms, reading order, instant with reduced motion), hover or keyboard focus on a card (desktop and tablet) lifts it 4%, brightens the border and cross-fades its still to a live preview of that world within 400 ms of the preview's first frames; the host looks at the card and the nearest arm reaches toward it (`attend`); leaving fades the preview out at once and unmounts it 300 ms later. Click or Enter opens the profile; Your Octopus stays the gold glyph card and never goes live (the host still looks at it). Explore's world tiles come alive the same way; the profile hero is a live preview (artifacts settled). Phones, touch screens and reduced motion get stills only. The platform holds ONE live preview at a time (`previews/previewSlot.ts`), so the page has at most two WebGL canvases: the host (or none, on Explore and the profile) and one preview.

Reach it: `/how-it-works` (hover a card, or Tab to it), `/explore` (hover a tile), `/@veyra` (the hero). Orbit stills of the host (front, three-quarter, side, back) are in `docs/superpowers/evidence/platform/m4/host-orbit-{0,45,90,180}.png` (yaw in degrees, with `-mask` silhouettes), captured with `scripts/platform-capture.mjs intro <out> yaw=<n>`.

What to check:
1. Hover Veyra, Flux, Nox quickly: only the last one comes alive. Move between neighbours: no flash back to the still.
2. The crossfade: the preview should not jump against the still (it is laid out in the same crop). The first hover of a world loads its chunk: the still stays until the preview has drawn 3 frames. Say if the wait feels long.
3. Keyboard: Tab into a card; the host's eyes and the nearest arm turn toward it. Does the reach look right, and does it let go when you leave?
4. The live picture is a small water-only backdrop (`place: 'backdrop'`, no kit) at tier low: it is not the full world. Say if a card wants more.
5. Profile hero: the live preview should settle after the page has faded in (it starts only once the route fade is over and the page is idle; the still shows until then).
6. The host's back (`host-orbit-180.png`): round glowing mantle with the specks continuing, the arms' orange sucker rims continuing along their edges, the rim light all round. Side view (`-90`) shows one arm curling forward like an ear. Say if either bothers you.

Numbers (production build, 1536 x 1024, pixel ratio 1, 8 s each, shared Intel GPU with other sessions running: 'under load'; the tier is the device's, picked and stepped down by the engine, since `?tier=` is ignored in production):
- How It Works with one card live (Flux): medians 36.0, 29.7, 32.6 fps (3 runs; median 32.6); two more runs 34.4 and 26.5. Floor 36: MISSED under load. The same page with no card live: 33.7, 49.0, 50.0. The load alone swings the host by 15 fps, so the preview's share cannot be separated cleanly; it is roughly 10 to 15 fps.
- Profile with its live hero: 68.0, 64.9, 68.0 fps (median 68.0). Floor 40: met.
- Cuts (spec 7.16) in the platform's own power: the preview is already `tierCap: 'low'` and `place: 'backdrop'`; none further was applied because the load's noise is larger than any cut I could measure. Untried: laying the card's canvas out at 75% and scaling it up. Needs a quiet GPU, or your call.

Known gaps:
- The engine's preview still mounts its closed detail panel (buttons and links) in the DOM; the platform draws the layer beside the card's button and the tile's link (not inside them) and marks it `inert`, `aria-hidden`. An E02b item: a `ui: 'none'` preview should not render it.
- A preview takes no input and plays no entrance (E02b item 1); previews run their frame loop always (E02b item 3).
- No-WebGL browsers: the preview shows the engine's poster of the world in place of its still (the host's own fallback).


## PENDING OWNER REVIEW: M5, the visitor experience (Task 16)

Commits on `claude/platform-overnight`: `test(platform): resources and payload; visitor experience measured (pending owner review)` and the small ones before it. This task adds tests and measurements only (no feature work): `tests/e2e/platform-resources.spec.ts`, `playwright.platform-prod.config.ts`, a `SEEN` switch in `scripts/perf.mjs`, evidence in `docs/superpowers/evidence/platform/m5/`. Full tables and run lists: `docs/superpowers/reviews/platform.md`, section "Task 16". Everything was measured on a production build, on a GPU and CPU shared with other sessions ('under load'), at HEAD f54c3cc.

What to check live (the machine's numbers cannot judge feel):
1. World visits and Back walks: landing, Explore, a profile, Enter a world, Back, Back, Back, ten times, in a production build (`npx vite build` then `npx vite preview`). Does any visit stutter, flash, or leave a frozen or blank page? Does the second visit to the same world feel as quick as the first?
2. Stutter at the moments the preview and the host mount: hover a How It Works card, open a profile (the hero goes live after the page has faded in), enter a world from it.
3. First load: the host should be on screen about 1.5 to 2.7 s after a cold load with reduced motion (measured 1451, 1993, 2719 ms); without reduced motion the entrance plays.
4. Page changes between Explore, profiles and the creator should feel instant (about 150 ms, one 265 ms).

Numbers (under load; run lists in the review log):
- 20 round trips: contexts never above 1 live (limit 2); window listeners 28 after every trip (equal to trip 1); payload clean (the landing and How It Works load no other world's chunk, Theatre state or kit; a world route loads its own only); route change 144 to 265 ms (limit 500); first frame 1451 to 2719 ms (limit 3000).
- MISS: the JS heap grows about 1.3 MB per trip (CDP: 24.8 to 50.9 MB over 20 trips, +105%; performance.memory +62% in the last run, +203% in an earlier one) against the 15% limit. Each engine mount and unmount (host, preview, world) keeps roughly 0.4 to 1 MB of JS objects; the world visit is the largest single segment, but all three leak. No context, listener or canvas leaks. The test is recorded as an expected failure (`test.fail`) so the suite stays green; it turns red when fixed. All three segments of a trip leak (CDP MB per cycle: landing and Explore 0.82, Explore and profile 0.44, profile and world 1.08); their sum does not match the 1.3 MB per trip, which is unexplained. The next diagnostic (not run) is in the review log under "Open issue: heap growth". I did not touch engine or world code. The spec was changed after the measurements without a re-run (first-frame limit now asserted by default, exact context peak, CDP heap assertion): it will be re-run in Task 21.
- Frame rates (median fps, 2 runs): landing intro median 55.9, 28.2 but mean 30.2, 29.5 (floor 40: undecided under load); entrance 41.5, 41.2 (32, met); How It Works with one live card 32.6, 36.4 (36, missed on average at 34.5; the preview's own cost is not measured: the GPU timer sees only the host's context and no main-thread cost, so the card's share is undecided); profile with live hero 90.1, 81.3 (40, met); creator with live preview: pending Task 19.
- Each world through the platform against `?world=`: pooled over 11 pairs the platform is 0.97 of the review page (2.6% to 3.2% lower), with single ratios from 0.75 to 1.24: the 3% rule is not decidable under this noise (run-to-run spread 20 to 30%). Per world (median of runs): Nox 0.93, Veyra 1.00, Flux 0.88 (five pairs), Aether 1.24. Needs a quiet GPU run before anyone calls it.

Misses to rule on: the heap (above); How It Works one-card floor (a quiet-GPU run, as Task 13 said); the 3% rule (undecided).

## PENDING OWNER REVIEW: M6, the 36 creator stills (Task 18, stills half)

Commits on `claude/platform-overnight`: `feat(creator): the 36 creator stills through the engine pipeline`, `feat(creator): stills.ts resolves the 36 creator keys; tests for every file`, `feat(creator): thumbnails, the creator's picture and the Your Octopus card use the creator stills`. Evidence: 8 of the 36 in `docs/superpowers/evidence/platform/m6/` (two per template: veyra original and rose, flux original and teal, nox original and peach, aether peach and violet); all 36 are in `public/platform/stills/creator-<template>-<palette>.webp` (738 x 614, 42 to 57 KB each, engine-rendered by `SET=creator node scripts/platform-stills.mjs` through the dev-only `?creator=<template>.<palette>` page; no painting, no canvas snapshot at run time). A still shows no personality: each template wears its own world's.

What to check (the stills are the engine's picture of the assembled bundle, so a miss here is a palette or template miss, not a capture miss):
1. Faces readable in every one of the 9 palettes of each template (eyes, mouth and cheeks stand out from the head). I looked at contact sheets of all 36: none unreadable, none blank, none the wrong template.
2. The palette recolours bodies and not faces: the face glow, eyes and cups stay each template's own by design. Does it look like one octopus in nine colours, or does a colour clash with the warm or cool face?
3. Nox looks right (below).
4. In the creator: the template thumbnails are the Original stills; the centre picture follows the draft's template and palette. On Explore and How It Works the Your Octopus card shows the sample (Aether, peach) labelled "Sample octopus" when this browser holds no draft, and the visitor's own draft still with its name (or "Your draft") when it does; the gold glyph shows only for the instant the draft is being read.

Nox findings (his slots were chosen by analogy and never render-verified until now): the palette does visibly move his skin, but only a little. Original is a deep blue-violet body with a magenta-violet rim; Violet and Teal give an indigo or navy body with a blue or teal rim line; Peach gives a plum body with an orange rim line. The nine Nox stills look close to each other next to the other three templates, whose bodies change colour clearly. What stays in the original hue whatever the palette: the arms' orange-red sucker rims, the hot red-orange glow under the head, the warm face glow and blush, the red glyph pillars. So there are clashes of a mild kind: teal or violet arms carry orange-red suckers (reads as a deliberate Nox look, not an error), and the face stays warm in every palette (readable in all nine). If you want Nox's palettes to read as stronger, the slots need to reach more of his skin (the arm undersides and the sucker rims), which is a Task 17 template decision, not a stills one.

Other things I saw: Veyra's palettes mostly tint the dome and the arm rims; her arms stay pale green-cream in all nine, and Teal is close to her Original. Flux and Aether change body colour clearly and Lavender is close to their Original (Original and Lavender are near twins on both).

## PENDING OWNER REVIEW: M7, the creator's editor (Task 19a)

Commits on `claude/platform-overnight`: `feat(creator): editor helpers (reorder, delete and undo, technologies, links, media), picker search, discard guard`, `feat(creator): the projects editor (reorder, delete with undo, technology picker, links, images, inline validation)`, `feat(creator): visible save status and Discard draft with confirmation, retry on a failed clear`, then the e2e spec `tests/e2e/platform-creator-editor.spec.ts`. The live preview and the reactions (Task 19b) are NOT in this one: the centre is still the creator still.

What to check live at `/create` (the tests prove the rules; they cannot judge feel):
1. Projects: add (+) puts the cursor in the new project's Title; an untitled one reads "Untitled project" in the list. Up and Down move the selected project (they stay focusable at the ends). Delete shows a toast with Undo for 5 seconds; Undo puts it back where it was; after 5 seconds it is gone for good. Does five seconds feel long enough on a phone?
2. Technologies: type in "Search technologies" (name, case ignored). Pick buttons toggle a technology; chips show the order picked, each with an optional usage note and a remove button. The list shows 8 at a time, with a count and "Type to narrow the list". Is 8 right, and is the category beside each name useful or noise?
3. Links: type `example.com` or `http://...` in Live link. The text stays, a warm line says "This link must start with https://. It is kept, but shown as plain text.", and it is not a link. An https one shows as a link below the field. Is the flag too quiet or too loud?
4. Images: Add image (PNG, JPEG, WebP, up to 2 MB, up to 4). Previews are local; the section says "Saved in this browser only". A file that is not an image by its bytes, or over 2 MB, gets a plain message.
5. Status line (bottom bar, always on screen, also on a phone): Saving…, Saved in this browser, Can't save in this browser (try a private window, where IndexedDB may be blocked), Loading…, Discarding….
6. Discard draft: asks "Discard this draft? This clears it from this browser." with Confirm and Cancel (Escape cancels). After Confirm the sample is back, and a reload shows the sample. If the browser refuses to clear, the draft STAYS and the bar says "Could not clear this browser's copy. Your draft is still here. Try again." with Retry (tested by making the clear fail; a real refusal is rare). Is the bottom bar in the right place, and is the question clear enough?
7. Validation: clear the octopus name (a warm line under it; the caption reads "Your Octopus"); open Profile and type a bad handle or link (inline lines; the Profile summary says "needs a look"). Nothing blocks saving.

Decisions to rule on: the editor offers one free-text section ("Description", stored as the section `overview`); more sections or a title per section are not built. Removing an image drops it from the draft but the blob stays in the browser's store until Discard (storage has no single-image delete). The status line is aria-hidden; one polite line for screen readers speaks only on change (saving reads as saved).
