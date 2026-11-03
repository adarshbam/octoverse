# The OctoVerse Platform in 3D: Host, Landing, Visitor Routes and Creator

Date: 2026-11-03
Status: draft for the owner's approval.
Branch: `platform-design`, cut from `claude/engine-contract-9ac935` and fast-forwarded to `1fccbfd` (A2 final; docs only).
Packets: master plan I01 (platform static experience), I02 (visitor experience) and J01 (local creator). K00 to K05 (backend) come later and are out of scope.
References (read-only, main checkout, `docs/design/references/Octoverse/`):
- `native-panels/01 … 05 - Octoverse *.png`: pixel-exact panel crops (P1 510 x 508, P2 512 x 508, P3 511 x 508). **All colours and shapes here are sampled from these.**
- `01 … 05 - Octoverse *.png`: the same panels enlarged 3x (Lanczos), for viewing only.
- `regenerated/`: AI redraws. Used only to read layout (card order, panel structure); never colour or detail truth.
- `Octoverse.jpeg` (the board), `girlfriend-reference.jpg` (character DNA), `docs/design/── DESIGN-SPEC.md` (UI philosophy: floating glass panels, soft glow, never a SaaS landing page or a dashboard).
Method model: the approved Veyra and Aether specs (`2026-11-03-veyra-3d-design.md`, `2026-11-03-aether-3d-design.md`) for shape and numeric acceptance, and the engine contract (`2026-11-03-octoverse-engine-design.md`) with amendment A1 and amendment A2 (section 19, drafted from this design; approved by the owner 2026-11-03, final on `claude/engine-contract-9ac935` at `1fccbfd`). Where they disagree for the platform, this document wins, except that it never edits the contract.
Physics is cancelled for every world; nothing here uses it.

## 1. Intent

OctoVerse is the place where the four octopus worlds live and where a developer makes their own. The platform has its own octopus, **the OctoVerse host**: a warm, glowing lavender octopus who swims in toward a glowing portal, turns to the visitor, blinks and smiles, and introduces OctoVerse. Then it opens its arms and presents the worlds as mini octopuses: Veyra, Flux, Nox, Aether, and "Your Octopus".

From there a visitor explores showcase profiles and enters each world as its own full-page experience, and a creator builds an octopus of their own from approved presets, with a live preview rendered by the same engine that renders the worlds.

The host is not a fifth world host with a project. It is the platform's face: welcoming, larger than life, and the one octopus with no technologies of its own.

## 2. Acceptance criteria

These come first; every work item is judged against them.

All colours are sRGB, area averages of the listed size centred on the listed pixel of the native panel. Panel origin for shapes: the native P2 centre (256, 254), +y up, 1 world unit = 100 native px, as for the worlds. Tolerance is **CIE76 delta E 10**, as Veyra's and Aether's, because the panels are the board's own resolution.

### 2.1 Host colour targets (P2, intro, frozen, at P2's camera and size)

| Region | Native P2 pixel (x, y), area | Target RGB |
|---|---|---|
| Crown (blue rim light) | 256, 238, 6 px | 85, 101, 252 |
| Upper head (violet) | 256, 258, 6 px | 128, 78, 230 |
| Forehead (violet turning pink) | 256, 280, 6 px | 224, 129, 208 |
| Between the eyes (face glow) | 256, 305, 5 px | 254, 175, 181 |
| Face glow, beside the mouth | 300, 335, 5 px | 253, 182, 183 |
| Chin, below the mouth | 256, 365, 6 px | 253, 181, 183 |
| Head side, left (shadow side) | 188, 280, 4 px | 95, 80, 237 |
| Head side, right (lit side) | 325, 275, 4 px | 134, 131, 253 |
| Blush | 210, 332, 4 px | 241, 172, 195 |
| Open mouth, inside | 256, 338, 3 px | 129, 28, 52 |
| Tongue | 256, 345, 3 px | 250, 123, 109 |
| Arm, upper surface (blue-violet) | 165, 305, 3 px | 58, 55, 213 |
| Arm underside glow | 175, 410, 3 px | 245, 175, 186 |
| Cup rim (peach-amber) | 392, 400, 3 px | 248, 197, 159 |
| Water just outside the head | 165, 235, 6 px | 2, 22, 72 |
| Mid water | 120, 240, 8 px | 20, 30, 95 |
| Upper water (lit, top right) | 450, 30, 12 px | 16, 129, 219 |

Further panels, same tolerance:

| Region | Panel, pixel, area | Target RGB |
|---|---|---|
| Host upper head (How It Works) | P3, 262, 300, 5 px | 141, 78, 212 |
| Host face glow (How It Works) | P3, 262, 395, 5 px | 255, 170, 179 |
| Portal membrane (entrance) | P1, 372, 330, 4 px | 117, 56, 252 |
| Floor path glow (entrance) | P1, 270, 445, 6 px | 169, 120, 150 |
| Mid water (entrance) | P1, 230, 120, 8 px | 1, 18, 54 |

Global checks (these are what keep the host from reading as Aether, the nearest world in colour):
- **Peach face, not pink-white:** every face-glow sample keeps B − G ≤ 15 and R − B ≥ 60. (Aether's face glow, 253, 212, 232, fails both: that is the point.)
- **Blue crown over a violet head:** crown B − R ≥ 140; upper head R − G ≥ 30.
- **Warm core on a cool body:** between-the-eyes R is at least 100 higher than upper-head R.
- **Warm cups:** cup rim R − B ≥ 60. (Aether's pink-white cups fail; Veyra's cream-gold cups are cooler in G.)
- **Indigo water, not black:** mid water B ≥ 60 and B − R ≥ 55.
- **Mean colour inside the host's silhouette** on the P2 mask (made with `silhouette.py` as for the worlds): recorded when I01 starts, tolerance 12 RGB per channel, saturation within 0.04.

### 2.2 Host shape targets

**P2 (intro):**
- **Head:** centre x 0.00 ± 0.04; dome half-width 0.84 ± 0.04 (Nox 0.752, Veyra 0.92, Aether 0.73); top at y +0.33 ± 0.04. A broad, slightly flattened ball, wider than its height to the chin. No cheek lobes beyond 0.04 outside the dome line.
- **Face:** eye centres at y −0.56 ± 0.04, x ±0.39 ± 0.03 from the head centre; mouth centre at y −0.86 ± 0.04; the face glow fills from the brow line to below the chin.
- **Arm span** at rest: 4.70 ± 0.20 (Veyra 3.9, Aether 3.84): the widest of all octopuses, arms spread in welcome.
- **Silhouette:** mask IoU with the P2 mask at least 0.85.

**P3 (How It Works):**
- **Head:** centre x +0.03 ± 0.05; half-width 0.81 ± 0.05; top at y −0.24 ± 0.05 (the host sits low, the cards above it). The head turns toward the viewer's right by 8 to 15 degrees.
- **Arms:** T1 and T8 rise outward beside the cards, tips curling up near y −0.5; the lower six spread below.

**P1 (entering, at about 3 s):** head centre at x −0.36 ± 0.08, y −0.36 ± 0.08 in P1's frame; profile facing right; arms trailing left in a loose bundle. The portal stands right of centre (its membrane spans about x +0.95 to +2.05, y −1.35 to +1.0).

### 2.3 Close-up detail

Checked at 3x zoom against the 3x panels, and in an orbit view (front, three-quarter, side, back):
- **Eyes:** large and round; plum-violet irises dark at the top with a pink-lit lower half; large black pupils; two white catchlights (large upper left, small lower right); a dark lash line with two short lashes at each outer corner; thin dark brows set high.
- **Mouth:** in the intro a big open smile with a dark plum inside and a coral-pink tongue (P2), never the small closed smile of Veyra or Aether.
- **Blush:** soft pink ovals under the outer corners of the eyes.
- **Mantle:** translucent jelly; a blue crown light, violet upper dome, pink-violet forehead, peach glow through the lower face; a bright lavender rim all round; fine sparkle specks (at least 30 visible on the front of the head at P2 size).
- **Arms:** blue-violet jelly on top, a peach-pink glow on the underside; sparkle specks along the arms (at least 50 across all arms at P2 size).
- **Cups:** glowing peach-amber scalloped rims along each arm's underside, separate cups at the edge, shrinking toward the tip. Brighter and warmer than any world's cups.
- **Spirals:** at least four of the eight arms show a full curl at rest (P2: the side arms roll upward and outward).
- **No crown, no ring, no technology orbs, no head effect.**
- **Back view:** round and glassy; the specks and rim continue round the back.

### 2.4 Frame rate, load and resources (owner's laptop, Intel UHD)

Frame rates with `scripts/perf.mjs` at 1536 x 1024, pixel ratio 1, back to back, browser pane closed, on a production build (`vite build` then `vite preview`), as for the worlds:

| Scene | Floor (median fps, tier low) |
|---|---|
| Landing intro (host in the reef) | 40 |
| Landing entrance | 32 |
| How It Works with one live card preview | 36 |
| Profile with its live hero preview | 40 |
| Creator with its live preview | 36 |
| Each world entered through the platform | its own spec's floor, and within 3% of its number at `?world=<id>` |

Resources (dev-only counters, as the engine's isolation tests use):
- **At most two live WebGL contexts at once**, anywhere in the platform: the page instance plus one preview.
- **20 round trips** (landing, explore, profile, world, back to profile, back to landing) leave: at most two live contexts; the `window` listener count equal to its count after the first trip; JS heap within 15% of its size after the first trip.
- **Landing payload:** the landing route loads no other world's code or kit. Each world bundle, its kit and its Theatre state load only when its route is entered (dynamic import).
- **First intro frame** (reduced motion, cold cache, production build, local preview server): visible within 3.0 s of navigation start.
- **Route change** between platform pages (not into a world) with the chunk cached: the new page is interactive within 500 ms.
- **Stills:** each card or tile still is at most 60 KB (WebP).

### 2.5 Visitor behaviour (I02)

- Exactly eight arms, T1 to T8, on every octopus, in every scene, preview and still. Technology count never sets anatomy.
- Every route in section 7.8 loads directly from a typed or pasted URL, and browser Back and Forward walk the history of section 7.9 exactly; the route tests cover each listed transition.
- Unknown paths and unknown handles show the not-found scene (7.8) with a working way home; `?world=<unknown>` follows the engine's rule (falls back to Nox with a console warning).
- Fixture data is identified on screen: every showcase profile and tile carries a "Showcase" badge, and the profile footer says the portfolios are showcase examples by the OctoVerse team.
- Nothing in the platform invents a fact: missing links, locations and screenshots stay honestly absent.
- No feeds, follows, comments, messaging, search, pricing, sign-in or custom domains are shown or reachable.
- No card, title, button or tooltip overlaps the host's eyes or mouth in any frozen scene at 1536 x 1024, 768 x 1024 or 390 x 844.
- Every sequence is skippable, plays once per browser session, and honours reduced motion.
- Every control is reachable by keyboard in reading order; targets are at least 44 px; focus is always visible; closing or going back restores focus to the control that opened the view.
- No horizontal page scroll at 360, 390, 768, 1024 and 1536 px widths.

### 2.6 Creator behaviour (J01)

- The creator edits only presets and content: template (4), palette (8 per template), personality (4), name and profile text, projects and technologies. No geometry, curve, pose or colour picker exists.
- Every combination of template x palette x personality (4 x 8 x 4 = 128) yields a bundle that passes `validateBundle`, keeps eight arms, and keeps the face rule of 7.13 (checked by a unit test over all 128).
- A palette change updates the live preview without remounting it, in under 200 ms; a template change remounts the preview, and the preview is showing again within 1.5 s with the template's bundle chunk cached (the preview shows the backdrop, not the kit).
- Incomplete drafts stay editable and previewable; validation messages name the field and never block saving the draft.
- Save, discard and reload behave as 7.14 says; the draft survives a page reload and a browser restart; discard asks for confirmation and leaves no trace in storage.
- The preview can never change a showcase fixture: tests prove the fixture objects are frozen and the draft is a separate copy.
- Publishing is visibly unavailable: the Publish button is disabled with the text "Publishing arrives with accounts", and no code path writes anywhere but local storage.

## 3. Goals, non-goals, anti-goals

**Goals**
1. The landing feels like P1 to P3: an underwater reef where a warm, living octopus welcomes you, not a website with a 3D toy on it.
2. The host is clearly its own character: warmer, bigger and more open than any world octopus, and never mistaken for Aether.
3. The worlds stay sovereign: entering one gives it the whole page, exactly as at `?world=<id>`; the platform adds only a way back.
4. Every route is shareable and every Back press does what a visitor expects.
5. A creator's octopus is made from the same engine data a world renders, so what they see in the preview is what visitors will see.

**Non-goals**
- Accounts, persistence beyond the browser, uploads to a server, publication, pricing, billing (K00 to K05).
- Social features: follows, feeds, comments, messaging, search, creator rankings.
- Custom geometry, freehand colours, custom poses, custom worlds or kits.
- Cross-fading two worlds or two canvases (contract 8.3).
- Sound.

**Anti-goals** (failure even if it works)
- A conventional SaaS landing page: hero text over a gradient, feature grid, pricing table (design spec section 16).
- A purple Aether or a purple Nox as the host.
- A platform that dims, frames or overlays a world so it no longer looks like its own spec.
- Five live octopuses at once making the laptop stutter.
- Fixture data passed off as real people or real projects.
- A creator that can make an ugly octopus: a cold grey face, a washed-out white glow, unreadable eyes.
- Videos as evidence. The owner checks motion live.

## 4. Constraints

- **Stack:** as the engine. React 19, TypeScript, Vite 8, three 0.186.1, R3F 9, drei 10, postprocessing, Theatre.js 0.7.2. No tone mapping. **No new runtime dependency** (the master plan bans unjustified dependencies): routing and draft storage are small platform modules.
- **Engine first:** the host is a `WorldBundle` on the extracted engine (E02), and uses variants built by the worlds (section 8). Nothing in the platform forks or edits shared engine code; a gap goes to the engine owner.
- **Order:** I01 starts after G02 and H02 (master plan); I02 after I01's approvals; J01 after I02.
- **Blender:** headless, with the reef kit script kept in the repo (`blender/reef/`), as the worlds do.
- **Workspace:** never edit, reset or restore the main checkout. Copy reference files only.
- **Process:** targets before building; check the reference first; no videos; the owner approves each component and each major scene; performance measured honestly; commit per approved milestone.
- **Model tiering:** Opus effort goes to the host's look (jelly, face, cups), its poses and motion, and the reef's light. Routes, forms, storage and tests go to cheaper models.
- **Content:** the platform has no facts of its own beyond the storyboard copy. Showcase profiles reuse each world's own content files; profile fields the owner has not supplied are left out, never invented.

## 5. Reading the reference

- **P1, entering.** The host swims in from the left in profile, facing right, arms trailing in a long glowing bundle. Its cups glow orange-gold. Ahead, right of centre, a ruined stone gateway of dark blocky masonry with ember-lit windows holds a violet-blue energy membrane with a white octopus-logo glyph (the OctoVerse mark). Glass portfolio cards (image frames, list screens) float in the water around it. The floor is dark rock with a softly lit violet-orange path; magenta and orange coral frame the corners; light rays fall from the surface at top right.
- **P2, intro.** Front view, centred low. Large lavender jelly head with a blue crown light and a peach glow in the face; big violet eyes with lashes; a wide open smile. All eight arms spread wide, curling at the tips, cups glowing peach-amber. Above: the OCTOVERSE wordmark in a peach-to-pink-to-blue-to-lavender gradient, "Create. Showcase. Belong.", and a one-line description. Below: a glass pill, "Your Ideas. Your Octopus. Your Universe." Floating glass cards at the sides, orange jellyfish, bubbles.
- **P3, How It Works.** The host sits low and slightly turned, mouth open, upper arms rising beside five cards in an arc above and around it: Veyra (Cloud Builder), Flux (Pipeline Runner, centre and largest), Nox (The Watcher), Aether (The Curious Mind, left) and a golden "Your Octopus / Your Story" card (lower right). Each card holds a mini octopus on its own seabed in its world's colours, with a glowing border in that world's accent. Handwritten notes ("Different users, different octopus, different stories") are storyboard annotation, not interface.
- **P4, create.** A creator's octopus (here blue-violet with a crown, winking) centred, technology icons in glass bubbles fanned below its arms. Left glass panel: "Choose Your Octopus" (three thumbnails), eight colour swatches, Personality (Calm, Energetic, Mysterious, Playful), Name. Right glass panel: "Add Your Projects" (project title, short description, upload images, a + button). Bottom: a "See Live Preview" pill.
- **P5, live.** A browser-style page: an OctoVerse wordmark nav (Explore, Pricing, Create, search, Sign In, Get Started), a hero card with the creator's octopus, name with a "Pro" badge, tagline, location and link, a Follow button, tabs (Projects 4, About, Tech Stack) and project cards with screenshots and technology chips. Pricing, search, sign-in, Pro and Follow are out of scope (master plan, section 1 and I02).
- **DNA** (`girlfriend-reference.jpg`): a round head, big eyes with lashes, a simple smile and eight flowing arms. The host keeps the DNA's openness: it is the friendliest face in OctoVerse.

## 6. Approaches

| Approach | Verdict |
|---|---|
| **A. The host is an engine world; the platform is an HTML layer around engine instances** | **Chosen by the owner (2026-11-03).** The host is a `WorldBundle` (`octoverse`) mounted as the page instance on the landing with `ui: 'none'`; the platform draws its own title, buttons and cards from the instance API. Mini octopuses are engine stills plus at most one live preview instance. Worlds are entered as full page instances on their own routes. Gains: the host gets the face, blinks, swim, entrance, skip, reduced motion and quality tiers from the engine for free; one rendering path; the engine's isolation does the hard work. Costs: waits on E02 Task 8b (A2, approved); the host carries tech-focus and detail stages it never reaches. |
| B. One custom platform canvas built from engine parts (drei `View`s for the mini octopuses) | Rejected. One WebGL context and 3D cards in the reef, but it bypasses `WorldHost`, rebuilds stage control and isolation by hand, and needs a public "parts" API the contract does not have: the fork the contract's anti-goals name. |
| C. A mostly flat HTML platform with pre-rendered host stills | Rejected. Lightest and fastest, but it loses the living, welcoming host P1 to P3 are built around and reads as an ordinary website (design spec section 16). |

**Showcase model:** the owner chose **four showcase profiles** (2026-11-03): each world is one profile with one octopus and its one project. A creator likewise has one octopus per profile; their projects are shown by that octopus.

## 7. The design

### 7.1 Host geometry

- **Head:** a broad jelly dome, wider than tall to the chin (2.2). The face sits low on the dome with a generous forehead; no cheek lobes to speak of (the engine's `head.cheeks` is kept at its smallest valid radius, under 0.04 outside the line).
- **Arms:** exactly eight, T1 to T8, with webs at the roots. Long and full at the root, tapering into rolled spiral tips. In the intro they spread wide and low in welcome (span 4.7); the upper pair curl outward above shoulder height.
- **Cups:** large, round, glowing peach-amber rims with a darker violet hollow, packed into a scalloped frill on each underside, shrinking toward the tip.

### 7.2 Materials and look

The host has its own lighting, as each world octopus does: its glow, rim and cups are emitters the reef never dims or tints (at most 10% brightening and 5% caustic shimmer from the world, Nox spec 9.1).

- **Jelly mantle and arms** (`skin.mode: 'jelly'`, surfaces `['mantle', 'arms']`, A6):
  - **Crown:** a cool blue light cap (85, 101, 252), as if lit from the surface.
  - **Depth:** violet (128, 78, 230) in the upper dome, turning pink-violet at the forehead.
  - **Warm core:** a peach glow (254, 175, 181) under the face, centred just below the eyes, filling the lower face and chin and warming the arm roots.
  - **Rim:** a bright lavender fresnel edge all round.
  - **Sparkles:** fine specks over head and arms, twinkling slowly (2 to 6 s each, out of phase).
  - **Wet highlight:** one soft specular from above-left.
- **Arms:** blue-violet on top, a peach-pink glow on the underside from the cups.
- **Cups:** peach-amber emissive rims (248, 197, 159), the warmest light on the character after the face.
- **Halo and aura:** a soft lavender glow round the silhouette; the water just outside the head stays deep indigo (2, 22, 72).
- **No head effect, no dome:** the host never opens its head.

### 7.3 Face

The shared parametric face canvas with the host's layout and palette:
- **Eyes:** large and round; iris plum-violet, dark at the top, lit pink at the bottom; large black pupils; two white catchlights; warm white sclera.
- **Lids and lashes:** a dark lash line, two short lashes flicking up at each outer corner.
- **Brows:** thin, dark, high, slightly raised: an open, glad look.
- **Mouth:** a wide open smile is its rest face (P2): dark plum inside, coral-pink tongue, soft dimples.
- **Blush:** soft pink ovals under the outer eye corners.
- **Expression presets** (A1 `expressions` overrides):
  - **welcome** (intro): the wide open smile;
  - **presenting** (How It Works): open smile, brows up, eyes a little wider, looking toward the attended card;
  - **delighted** (arrival beat): eyes squeezed into happy arcs for a moment, mouth wide;
  - **restful**: a soft closed smile, used only by the idle layer, never as a rest face.

### 7.4 Poses (authored, never derived from a world's)

- **entering:** profile facing right, arms trailing in a bundle (P1).
- **intro:** traced from P2. T1 and T8 rise beside the head and curl outward above shoulder height; T2 and T7 spiral out at shoulder height; T3 and T6 sweep out low; T4 and T5 hang down the centre and curl at the tips. Body centred low; the title and text sit above the head, the pill below the arms.
- **overview** (How It Works): traced from P3, with `headMorph: 0` so the head never swells (contract 19, P2). Body lower and smaller, head turned 8 to 15 degrees to the viewer's right; T1 and T8 rise beside the left and right card columns; the lower arms spread under the cards. The pose leaves clear space for the five cards (7.10).
- **techFocus**, **detail:** required by the bundle type; set equal to the overview pose. They are unreachable: the host has no choosable artifacts (`choosableIn: []`) and no detail view.
- **Swim:** the host's own open and trail shapes, long and graceful.

### 7.5 Motion personality: the welcoming host

Starting values, tuned live with the owner:

| Setting | Nox | Veyra | Host (start) | Why |
|---|---|---|---|---|
| Blink interval (s) | 2.6 to 7.0 | 3.5 to 8.5 | 3.0 to 7.5 | attentive, friendly |
| Double blink chance | 0.2 | 0.12 | 0.18 | lively |
| Gaze response | 16 | 10 | 14 | it notices you |
| Head turn | 3.2 | 2.4 | 2.8 | warm, not hurried |
| Sway | 0.5 | 0.4 | 0.45 | relaxed |
| Float amplitude / period | 0.045 / 6.2 s | 0.06 / 7.5 s | 0.05 / 6.8 s | buoyant |
| Breath period | 4.6 s | 5.4 s | 5.0 s | calm |
| Stroke: recovery / power / glide | 0.52 / 0.21 / 0.6 s | 0.65 / 0.26 / 1.0 s | 0.58 / 0.24 / 0.8 s | graceful, purposeful |
| Settle overshoot | as approved | 60% of Nox's | 80% of Nox's | a happy landing |
| Idle flourish | none | every 12 to 20 s | every 14 to 22 s: one upper arm gives a small wave | welcoming |
| Idle tilt (A12) | none | none | 0.03 rad over 9 s | listening |

**Character moments:**
- **Arrival:** as it settles in the intro, T1 lifts and gives two small waves while the face shows **delighted** for 0.6 s, then returns to **welcome**. This is the host's arrival sheet, data in its own Theatre state.
- **Presenting:** in How It Works the host looks at the card the visitor points at or focuses and the nearest arm reaches a little toward it (`attend`, 8.1 P8).

### 7.6 The entrance (P1 to P2)

| Time | Beat |
|---|---|
| 0 to 1 s | The host's glow appears out of the haze on the left among drifting glass cards. |
| 1 to 3.4 s | Two long strokes and glides toward the portal on the right, in profile. |
| about 3 s | As it passes, the portal's octopus glyph brightens and the membrane ripples once (the `'emissive'` prop drive): the gate greets its keeper. |
| 3.4 to 4.4 s | A graceful turn of about 200 degrees to face the visitor (the non-spiral entrance path, A1 G2), gliding to the stage spot. |
| 4.4 to 5.4 s | Settle into the intro pose, then the arrival wave. The title, tagline and description fade in over 400 ms as it settles; the pill last. |

Rules, as for every world: skippable at any moment (Skip control, any key, a click on the scene); plays once per browser session (`octoverse.octoverse.entranceSeen`); with reduced motion the host is simply present in the intro pose and the text is shown. The path stays clear of the gateway and rocks (a unit test checks clearance against the reef layout).

### 7.7 The reef (the host's world)

Built like the worlds (Nox spec 9.2): a real 3D kit near the host, a painted far plate behind, baked light on still stone, live elements in front.

**Kit** (`blender/reef/`, `public/octoverse/world/reef/`):
- **The gateway:** a ruined arch of dark blocky masonry with small ember-lit windows. The doorway holds the shared `membrane` material (A8) in violet-blue, with the OctoVerse octopus glyph as a separate kit node on the `'emissive'` prop drive.
- **Rocks:** dark seabed rocks, foreground and sides.
- **Coral:** magenta and orange branching coral, in clumps at the corners.
- **Glass portfolio cards:** six to eight thin glass frames (picture, list, profile icons, as P1 and P2), each a kit node on the `'bob'` prop drive (A13) with its own phase. They are scenery, never interface: no text, no links.

**Layout** (data): the gateway stands right and back of the stage in the entrance; in the intro it is out of frame or a soft shape at the right edge (P2 shows rock walls, not the gate). Rocks frame both sides; the path runs from the left distance toward the gate.

**Floor:** the shared `'sand'` variant (A15) with a warm violet-orange path glow (169, 120, 150 in P1).

**Light:** cool blue light and rays from the surface (top right); violet spill from the membrane (baked); warm ember points from the masonry windows and orange coral (baked); the host's own glow lights the path below it. The gateway's brightest pixel stays below the host's face glow in the intro.

**Water:** deep indigo fog (2, 22, 72 near the host; 1, 18, 54 mid water in P1), brightening to cyan-blue toward the surface light (16, 129, 219).

**Live elements:** rising bubbles; violet motes; three to five small orange and violet jellyfish (the `jellyfish` element, A5) at the edges; the membrane flow.

**Camera:** framing per stage; hover drift between Veyra's and Nox's (`pace` 0.85); full in the intro, half in How It Works, off while a card is live; a slight upward tilt.

### 7.8 Platform shell and routes

A small platform module (`src/platform/`) owns routes, pages, fixtures and the creator. It mounts at most one engine page instance and at most one preview instance at a time.

| Route | What it shows | Engine instances |
|---|---|---|
| `/` | Landing: entrance (first visit), then intro (P2) | host page instance, `ui: 'none'` |
| `/how-it-works` | Landing opened on How It Works (P3), no entrance | host page instance, `initialStage: 'overview'`; one card preview when a card is live |
| `/explore` | The showcase grid | one tile preview when a tile is live |
| `/@<handle>` | A profile (P5) | the profile's hero preview |
| `/@<handle>/<project>` | The world, full page, as at `?world=<id>` | the world's page instance, with `exit` |
| `/@<handle>/<project>?view=overview` / `?view=detail` | The same world opened on its overview or detail | same, `initialStage` |
| `/create` | The creator (P4) | the draft's preview |
| `/create/preview` | The draft as a full world | the draft's page instance, with `exit` back to `/create` |
| anything else | Not found: the host in the reef, "This part of the ocean is unexplored", a link home and to Explore | host page instance at `intro`, no entrance |

Rules:
- **Handles:** the showcase handles are `nox`, `veyra`, `flux`, `aether`. Reserved words (`explore`, `create`, `how-it-works`, `about`, `pricing`, `signin`, `api`, `assets`) can never be handles. Creator handles exist only in the draft (J01); drafts are never routable publicly.
- **Project slugs** come from the world's content (`vault-os` for Veyra, and so on), lower-case, `^[a-z0-9-]{1,40}$`.
- **`?world=<id>`** keeps working for review: on `/` it mounts that world as the engine does today, with every review flag (`freeze`, `stage`, `t`, `tier`, ...) passed through. It is not linked from anywhere in the platform.
- **Unknown handle or project:** the not-found scene, status shown in the page title.
- **Deployment note for K05:** a static host must serve `index.html` for every route (SPA fallback); Vite's dev and preview servers already do.

**Navigation bar** (glass, top, small): the OctoVerse wordmark (home), Explore, Create. Nothing else (no Pricing, search, Sign In or Get Started). On the landing it appears only after the intro text has faded in. Inside a world it is **never shown**: the world's own `exit` control is the only platform affordance.

### 7.9 History and reset rules

- **Push** a history entry for every platform route change and for a world's stage change to `overview` or `detail` (through `onStageChange`, as `?view=`). `techFocus` is never in the URL. Landing intro to How It Works pushes `/how-it-works`.
- **Back inside a world** walks the entries in order: detail, then overview, then the world's intro (the entry that entered the world), then the page that opened it (profile or explore), with its scroll restored and focus on the control that opened the world. Each step inside the world is a `stageRequest`; the engine's own back moves the same way, so the two never disagree. Example: profile, then intro, then overview, then detail is four entries, and three Backs return to the profile.
- **The world's exit control** (`exit: { label: 'Back to <name>'s profile' | 'Back to OctoVerse', href }`) does the same as Back when the previous entry is that page, and otherwise pushes the href.
- **Deep links:** `/@veyra/vault-os?view=detail` opens Veyra straight on detail with no entrance; Back goes to `/@veyra`.
- **Entering a world unmounts the landing and every preview.** World to world only happens through platform pages, never directly; each is a full remount (contract 8.3).
- **Entrances:** each world's (and the host's) plays once per browser session, by its bundle id. A deep link to `overview` or `detail` counts as seen.
- **Escape** inside a world is the engine's (close detail, dismiss a technology) and never changes the platform route.
- **Route transitions:** a 250 ms HTML fade through the reef's deep indigo; with reduced motion, an instant cut. Canvases are never cross-faded.

### 7.10 Landing scenes (I01)

**Intro (P2)**, over the live host:
- Wordmark **OCTOVERSE**, letter-spaced, with a gradient sampled from P2's title: peach (249, 218, 212) on the first O, pink (255, 170, 238), pink-violet (255, 163, 250), violet (234, 141, 245), blue (103, 179, 240) from the V, blue-lavender (130, 166, 253), lavender (157, 153, 243) on the last E.
- "Create. Showcase. Belong." beneath it, then the line "A platform to create your own animated developer portfolio with unique octopus characters, themes and project showcases."
- Two buttons under the text, glass pills: **See how it works** (primary, opens How It Works) and **Create yours** (opens `/create`).
- Bottom: the glass pill "Your Ideas. Your Octopus. Your Universe." (text, not a button).
- The text block is laid out for the rest camera and follows the live camera through the instance's live shift (as the engine's own overlays do).

**How It Works (P3):** the host moves to its overview pose; the intro text fades out; five cards appear in a ripple over 600 ms, in reading order:

Card places are taken from P3's native boxes. They are stored as **stage units** (native px / 100 from the panel centre, +y up), as every world places things, not as shares of the window. The engine's framing fits the stage to any window without cropping (`fovFor`, contract 10): a 3:2 or wider window shows more water at the sides, a tall one more above and below. The cards follow the stage through the rest camera and the live shift, as the text does. Colour and shape checks run at P2's and P3's own camera and size, as the worlds' do. The table gives the boxes as shares of the panel for reading; the stage-unit values are derived from them.

| Card | Place (P3 native box, as a share of the panel) | Border accent |
|---|---|---|
| Veyra, "Cloud Builder" | upper left (x 0.12 to 0.31, y 0.28 to 0.52) | teal |
| Flux, "Pipeline Runner" | top centre, largest (x 0.36 to 0.60, y 0.21 to 0.51) | blue |
| Nox, "The Watcher" | upper right (x 0.65 to 0.84, y 0.27 to 0.52) | crimson |
| Aether, "The Curious Mind" | left (x 0.05 to 0.24, y 0.57 to 0.82) | violet |
| Your Octopus, "Your Story" | lower right (x 0.68 to 0.91, y 0.66 to 0.93) | gold |

The card epithets are the storyboard's; where a world's own spec names its host differently (Veyra's nameplate reads "The Keeper of Files"), the card follows the world's spec and the storyboard text is not used.

Each card: a glass panel with its world's accent border; the top 70% is the octopus picture, the bottom 30% the name and epithet.
- **At rest** the picture is an engine still of that world's intro (7.15).
- **Hover or keyboard focus** (desktop and tablet): the card lifts 4%, its border brightens, and within 400 ms its still cross-fades to a live preview instance of that world (`stage: 'intro'`, `motion: 'ambient'`, `place: 'backdrop'`, `artifacts: 'hidden'`, `tierCap: 'low'`). The host looks at the card and the nearest arm reaches toward it (`attend`, P8). Leaving the card unmounts the preview after 300 ms (so moving between neighbours does not thrash).
- **Click, Enter or tap:** opens the profile (`/@veyra` and so on). "Your Octopus" opens `/create`.
- **The "Your Octopus" picture:**
  - Before J01 (I01, I02): a gold glass card holding the OctoVerse octopus glyph in gold line, with no rendered octopus. It is honest; nothing is faked.
  - From J01 milestone 6: the still for the visitor's own draft (its template and palette, from the creator still set, 7.14) when a draft exists locally; otherwise the sample creator octopus (Aether template, peach palette).
  - On hover, a live preview of the same bundle.
- Below the cards: a small text link **Explore all portfolios** to `/explore`, and **Back** (or Escape, or browser Back) to the intro.

### 7.11 Explore (I02)

A calm glass grid over a still of the reef's far water (no live host here, to keep the context budget for the tiles):
- One tile per showcase profile, in the order Veyra, Flux, Nox, Aether, plus a **Your Octopus** tile last.
- Each tile: the world's still, the octopus name and epithet, the project title, the first three technology chips from the project's declared order, and the "Showcase" badge.
- Hover or focus brings the tile to life as How It Works does (one live preview at a time). Click or Enter opens the profile; the Your Octopus tile opens `/create` (drafts are never public routes), with the same picture as the How It Works card.
- Footer: "Showcase portfolios by the OctoVerse team."

### 7.12 Profile (P5, I01 static, I02 live)

Layout from P5, without the out-of-scope parts:
- **Hero:** a rounded glass card on the left with the octopus as a live preview (`stage: 'intro'`, `motion: 'ambient'`, `place: 'backdrop'`, `artifacts: 'settled'`, `tierCap: 'low'`), so its technologies show as in its world.
- **Identity**, right of the hero: the octopus name with the "Showcase" badge (where P5 has "Pro"), the epithet, the project tagline, and a link only where the world's content supplies one. No location unless supplied.
- **Primary action:** **Enter <name>'s world** (opens `/@<handle>/<project>`).
- **Tabs** (an accessible tab list): **Projects (n)**, **About**, **Tech Stack**.
  - Projects: one card per project (each showcase has one): screenshot if the content has one, otherwise an honest placeholder labelled as such; title, tagline, technology chips. Click opens the world.
  - About: the world's own overview text.
  - Tech Stack: all technologies with their usage notes, in declared order.
- No Follow, no counts, no social links.

### 7.13 Creator (P4, J01)

**Data.** A draft is one versioned object:

```ts
interface CreatorDraft {
  version: 1;
  octopus: { template: TemplateId; palette: PaletteId; personality: PersonalityId; name: string };
  profile: { handle: string; tagline: string; about: string; location?: string; link?: string };
  projects: DraftProject[]; // 0 to 8
  updatedAt: string;
}
interface DraftProject {
  id: string; slug: string; title: string; tagline: string;
  sections: { id: SectionId; body: string }[];
  links: { live?: string; repo?: string };         // https only
  technologies: TechnologyId[];                     // from the shared catalog, declared order, 0 to 30
  usage: Partial<Record<TechnologyId, string>>;
  media: DraftMediaRef[];                           // local images, 0 to 4
}
```

- **Templates** (`TemplateId`: `'nox' | 'veyra' | 'flux' | 'aether'`): one file per template under `src/platform/creator/templates/`, owned by J01. Each imports its world's bundle read-only and adds:
  - the template id;
  - its palette slots: the `CharacterConfig` colour fields a palette may move, named by path;
  - its face-glow reference colour, read from the bundle.

  World folders are not edited. The host is not a template; it stays the platform's own.
- **Palettes** (`PaletteId`): "Original" (the template's own colours) plus the eight P4 swatches: lavender, teal, mauve, rose, coral, peach, violet and lilac-grey.
  - The swatch colours are sampled from the native P4 panel when J01 starts and recorded in the catalogue with their pixel coordinates.
  - Palettes are computed, never hand-authored per template. A palette moves each body slot (crown, depth, rim, arm top, halo) to the swatch's OKLCH hue, keeping that colour's own lightness and chroma, so the template's light stays authored.
  - The face glow, eyes, mouth and blush never change, and cups keep their template colours.
- **Face rule** (replacing any absolute warmth number, since Aether's approved face glow is pink-white):
  - in every combination the face glow is exactly the template's approved face glow;
  - its CIE76 delta E from the upper-head colour is at least 40;
  - it stays at least 30 higher in OKLCH lightness (×100) than the upper head.
  - Where a swatch hue would break this for a template (a pink body around a pink face), `applyPalette` lowers that palette's body lightness for that template until the rule holds. The 128-combination test proves it.
- `applyPalette(config, slots, palette)` is a pure function over `clampCharacterConfig` (contract 19, P6).
- **Personalities** (`PersonalityId`): **Calm** = Veyra's personality block, **Energetic** = Flux's, **Mysterious** = Nox's, **Playful** = Aether's (motion only: blink, gaze, sway, float, breath, stroke, settle, flourish, idle tilt; never expressions or poses).
- **Technologies** come from one shared catalog, the union of the four worlds' technologies plus the approved common set; each has its approved icon. No free-text technology in v1. More than the template's slots go to the tray, as in every world.
- **Name:** 1 to 24 characters, letters, numbers, spaces, `-`, `.` and `'`; shown on the nameplate. **Handle:** `^[a-z][a-z0-9-]{1,23}$`, not reserved; the bundle id is `u-<handle>` (contract 19, P4).
- `assembleBundle(template, presets, content)` (the contract's signature, 19 P4) builds one `WorldBundle` per project. `presets` is `{ palette, personality, name, handle }`; `content` is the engine's `{ project, technologies }` for one draft project, converted from the draft by a separate pure `draftToContent(draft, projectId)`. It keeps `sequences.projectId` from the template, so creator bundles share the template's Theatre project. Pure and tested.
- **Storage:** IndexedDB, one database `octoverse-creator`, a `draft` store (the JSON) and a `media` store (image blobs, at most 2 MB each, PNG, JPEG or WebP, checked by signature, not extension). Versioned with a migration hook. Media are local only and say so ("Saved in this browser only").
- **Save, discard:** edits autosave to the draft 800 ms after the last change; a visible state ("Saved in this browser" / "Saving…"); **Discard draft** asks for confirmation and clears both stores.

**Screen (P4):**
- **Left glass panel, "Your Octopus":** four template thumbnails (the creator stills of each template at its Original palette, 7.14), the eight swatches (each a round button showing the swatch colour, labelled for screen readers), personality as four pill buttons, and Name.
- **Centre:** the live preview (`stage: 'intro'`, `motion: 'ambient'`, `place: 'backdrop'`, `artifacts: 'settled'`, the chosen project's technologies; `tierCap: 'low'`). A small toggle shows the overview pose.
  - On every preset change the octopus reacts: **palette** plays a sparkle shimmer and a small happy wiggle; **personality** makes it show the new personality's idle for a few seconds; **name** gives a blink and a smile.
  - A **template** change remounts the preview with a 200 ms fade.
  - The preview shows the octopus exactly as visitors will see it, on its template's backdrop (water, fog and light; no kit). The template's full world, kit included, is what **See live preview** shows.
- **Right glass panel, "Your Projects":** a list of projects with add (+), reorder, delete (with undo for 5 s); the selected project's title, tagline, links, sections, technologies (a searchable picker over the catalog) with optional usage notes, and images (local previews).
- **Profile** fields (handle, tagline, about, optional location and link) in a collapsible section of the right panel.
- **Bottom:** **See live preview** (opens `/create/preview`, the selected project in the full world) and **Publish** (disabled: "Publishing arrives with accounts").
- **Validation:** inline, per field, never blocking save: an empty name previews as "Your Octopus"; an untitled project as "Untitled project"; a bad link is kept but not linked and flagged.

### 7.14 Previews and stills

- **Live previews** are engine `mode: 'preview'` instances with the options above. They take no input, no URL and no storage (contract 8.2); the platform's own HTML handles focus and clicks around them.
- **The context budget:** a single platform-level slot holds the one live preview; asking for a second unmounts the first. The page instance (host or world) is the other context.
- **Stills** are rendered by the engine itself with the existing capture scripts, at 2x the largest card size. They are saved as WebP under `public/platform/stills/`, with a manifest recording bundle, commit and date. They are regenerated whenever a world's look is approved, and never hand-edited or painted. Reference art is never shown as a still. There are two sets:
  - **World stills** (4): `stage-capture.mjs` with `world=<id>&stage=intro&freeze&solo`.
  - **Creator stills** (36: 4 templates × 9 palettes, Original included; personality does not show in a still). A dev-only review entry `?creator=<template>.<palette>` mounts `assembleBundle(template, { palette, personality: default, name: '', handle: 'review' }, emptyContent)`, and the same script captures it. The template thumbnails, the visitor's draft card and the sample card all use this set. Nothing snapshots a canvas at runtime.
- **Phones** show stills only: no live card, tile or hero previews (the hero is a still on phones).

### 7.15 Responsive and accessibility

- **Desktop and tablet:** the storyboard compositions. Tablet keeps all five How It Works cards with the host smaller.
- **Phone (390 x 844):** the host in the upper 55% of the screen, the title above it, the buttons below. How It Works shows the five cards as a horizontal snap row below the host, stills only, with the host's overview pose framed for portrait. Profile stacks hero, identity, tabs. The creator puts the preview in a sticky top 40% and the two panels as tabs ("Octopus", "Projects") below.
- **Everywhere:** 44 px targets, a skip link, visible focus in the host's lavender, full keyboard paths, reduced motion (no entrance, no float, drift or swim, card previews as stills, route fades as cuts), and a no-WebGL poster of the host's intro with every route still usable.
- **Text:** the platform uses the engine UI's existing font so the worlds and the platform match; body text at least 16 px; contrast at least 4.5:1 on glass.

### 7.16 Performance plan

The budget is section 2.4. The levers are the engine's quality tiers plus:
- the one-live-preview slot (7.14);
- previews at `tierCap: 'low'` and `place: 'backdrop'` (no kit);
- dynamic import of every world bundle and of the creator;
- stills as small WebP.

If a floor is missed, cut at tier low only, in this order:
1. the reef's jellyfish (never below 2);
2. light rays;
3. motes and bubbles;
4. bobbing glass cards (they become still);
5. far-plate size;
6. sparkle count (never below section 2.3).

The host's own look (face, rim, core, cups) is never cut. If the floor is still missed, the numbers go to the owner first.

## 8. Engine dependencies

### 8.1 Amendment A2 (contract section 19, approved by the owner 2026-11-03)

Every A2 item is final and built in E02 Task 8b (unconditional), unless the table says otherwise. The platform has no fallbacks for them.

| Item | Use here | Built in |
|---|---|---|
| P1 `ui: 'none'` and `useInstanceApi()` | Landing text, buttons and cards around the host | E02 Task 8b |
| P2 overview with `headMorph: 0` | How It Works pose without a swell | already data; E02 test |
| P3 `PreviewOptions` (`stage`, `tierCap`, `motion`, `place`, `artifacts`) | Cards, tiles, profile hero, creator preview | E02 Task 8b |
| P4 `WorldId` validation, `u-` prefix, Theatre keyed by `projectId` | Creator bundles | E02 Task 8; `assembleBundle` in J01 |
| P5 `initialStage`, `onStageChange`, `stageRequest` | Shareable stages, Back closes detail | E02 Task 8b |
| P6 palette slots | `applyPalette` | J01 |
| P7 `exit` slot | "Back to …" inside worlds | E02 Task 8b |
| P8 `attend(target, { reach })` | The host looks at the live How It Works card (pointer or keyboard focus) and its nearest arm reaches toward it. `target` is in canvas CSS pixels (the card's centre minus the canvas's top-left); `null` releases it. | E02 Task 8b, reusing Nox's attention and reach |

### 8.2 Variants the host reuses from the worlds (no new engine work)

`skin.mode: 'jelly'` with `surfaces: ['mantle', 'arms']` and `sparkle` (F01, A6); `suckers.style` colours (F01, A7); the non-spiral entrance path (F01, A1 G2); `expressions` overrides (E02, A1 G1); the flourish layer (F01, A1 G4); `idleTilt` (H01, A12); `place.props` with the `'emissive'` drive (F01) and `'bob'` (H01, A13); the `membrane` kit material (A8); the `jellyfish` live element (H01, A5); the `'sand'` floor (G01 or H01, A15); `choosableIn: []` (E02, A3).

## 9. Verification

- **Unit tests (Vitest):**
  - the host bundle validates, with zero technologies and `choosableIn: []`;
  - the host's overview never swells (headMorph 0);
  - the entrance path clears the reef layout;
  - the route table: parse and build for every route; reserved handles; unknown paths; slugs;
  - the history model: every transition in 7.9, including deep links and the exit control;
  - the preview slot: never more than one live preview;
  - `applyPalette` and `assembleBundle` over all 128 template x palette x personality combinations (valid, eight arms, face rule);
  - draft validation, migration from version 1, save and discard;
  - fixtures frozen.
- **End-to-end (Playwright, the worlds' config):**
  - landing entrance skip;
  - intro to How It Works and back (keyboard and pointer);
  - card to profile to world to Back, Back with focus restored;
  - a deep link to `?view=detail`;
  - not found;
  - the 20-round-trip context, listener and heap check;
  - the creator: CRUD, reload persistence, discard, the preview fixture-isolation check, Publish disabled.
- **Look checks:**
  - `check_stage.py --world-id octoverse` on frozen frames at P2's camera for 2.1;
  - side-by-side stills against P1, P2 and P3 at the same size;
  - the close-up list in 2.3 at 3x zoom;
  - the orbit view for the back.
  - Static composition stills of every route at 1536 x 1024, 768 x 1024 and 390 x 844.
- **Motion checks without video:** stills at chosen times (`?t=` with `?freeze`), numeric traces from tests, and the owner's live check with three to six things to look at per item.
- **Performance:** `scripts/perf.mjs` on the production build for each row of 2.4, back to back, browser pane closed; each world's own numbers re-run in the same session.
- **World regression:** each world's look checks pass unchanged when entered through the platform.

## 10. Delivery order

Each milestone ends with the owner's live review, then a commit. I01 is milestones 1 to 4, I02 is 5, J01 is 6 to 8.

1. **The host on the P2 stage (gate):** geometry, jelly, face, cups, the intro pose, on the graded backdrop (`place: 'backdrop'`), meeting 2.1 to 2.3. The owner approves the host before anything else.
2. **The reef and the landing statics:** kit, bake, far plate, live elements, light and camera; the entrance pose (P1) and the How It Works pose (P3) as stills; the landing intro and How It Works HTML compositions with stills in the cards; desktop, tablet and phone. The owner approves each scene.
3. **Static profile, explore and creator compositions:** fixture data, stills, glass panels, responsive variants; still pipeline and manifest. The owner approves each scene.
4. **The host alive:** personality, entrance with the gate greeting, arrival wave, How It Works ripple, live card previews with attend and reach, back view, reduced motion; frame-rate floors for the landing.
5. **The visitor experience:** router, all routes, history and reset rules, world visits with `exit` and `?view=`, not found, dynamic imports, the resource checks; the visitor experience approval.
6. **Creator data:** templates, palettes, personalities, `applyPalette`, `assembleBundle`, catalog, draft storage and migration, with the 128-combination test.
7. **The creator screen:** panels, live preview with reactions, project CRUD, media previews, `/create/preview`, Publish unavailable.
8. **Pass across everything:** responsive, phone, reduced motion, accessibility, performance, the world regression report; the creator and backend-readiness approval.

### 10.1 Starting conditions and fallbacks

- **Start point:** after G02 and H02 (master plan), so every variant in 8.2 exists. If the owner wants the host earlier, milestone 1 can start after F02 with `place: 'backdrop'`, since it needs only Veyra's `jelly`, `suckers.style`, `expressions` and Aether's `surfaces: ['arms']` (H01); otherwise it waits.
- **Plan depth:** milestones 1, 2 and 5 are planned task by task; the others at task level, revisited after the owner approves the host (milestone 1).
- **Tools:** `check_stage.py`, `silhouette.py`, `compare.py`, `perf.mjs` and `stage-capture.mjs` take the world id (contract 11.6). The P2 mask is made from the native P2 panel.
- **Placeholder images:** the world's own marked placeholders (each world spec 10.1); the platform adds none.

## 11. Left to the builder

- The exact jelly, core and sparkle values within the targets.
- Pose traces, entrance timing and arrival wave within the ranges, tuned live.
- Kit modelling details, lightmap resolution, compression and LOD distances.
- The router's internals and file layout inside `src/platform/` and `src/worlds/octoverse/`.
- The OKLCH maths in `applyPalette`, within the face rule.
- The catalog's file format and the technology picker's search.
- Tests beyond section 9.

## 12. Calls I made (for the owner to check)

1. **The host is unnamed** ("the OctoVerse host"; `octoverse` in code): P1 says the octopus *is* OctoVerse. The pill "Your Ideas. Your Octopus. Your Universe." takes the nameplate's place.
2. **The host's differences from Aether** are fixed by numbers (2.1 global checks): a peach face, not pink-white; amber cups; a bigger head and the widest arm span; an open smile at rest; no ring, no crown, no technologies.
3. **The landing is one continuous scene** (entrance, intro, How It Works), not a scrolling page; How It Works has its own shareable path.
4. **Two buttons on the intro**, "See how it works" and "Create yours"; P2 shows none, but the master plan asks for click, tap and keyboard navigation.
5. **Stills plus one live preview** for cards and tiles; phones show stills only.
6. **The navigation bar** has only Explore and Create, and disappears inside a world, where the world's `exit` control is the only way back besides the browser's.
7. **Card epithets follow each world's spec** where it differs from the storyboard (Veyra: "The Keeper of Files", not "Cloud Builder").
8. **"Your Octopus" shows the visitor's own draft** when one exists in the browser.
9. **Four templates** (the four world octopuses), not the host; **eight palettes plus Original**, computed as OKLCH hue moves of each template's body colours with the face fixed (a relative face rule, since Aether's approved face is pink-white); **four personalities** as the four worlds' motion blocks. Template files live in the platform and import the worlds read-only.
10. **Creator drafts live in IndexedDB**, images included (local only, 2 MB each, 4 per project), with autosave.
11. **No free-text technologies** in v1: the shared catalog only, so every technology has an approved icon.
12. **The reef's glass cards are scenery** with no text or links, so the world is never mistaken for interface.
13. **Frame-rate floors** follow the worlds' (40 intro, 32 entrance) with 36 for scenes carrying a second live context.
14. **Explore has no live host**, so the context budget goes to the tiles.
15. **Back walks every stage inside a world** (detail, overview, intro), then leaves to the page that opened it, matching the engine's own back.
16. **Creator stills are made at build time** (36 template x palette stills through a dev-only `?creator=` entry); nothing snapshots a canvas at runtime. Until J01, the "Your Octopus" card is a gold glyph card, not a rendered octopus.
17. **Layout lives in stage units**, so the square panels fit any window through the engine's existing framing; checks run at the panels' own camera and size.
