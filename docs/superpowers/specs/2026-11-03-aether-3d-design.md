# Aether in 3D: Character, Cosmic Realm and Motion Design

Date: 2026-11-03
Status: draft for the owner's approval.
Branch: `aether-design`, cut from `claude/engine-contract-9ac935` (docs only).
Packets: master plan H01 (Aether static) and H02 (Aether behaviour).
References (read-only, main checkout):
- `docs/design/references/Aether/native-panels/01 … 05 - *.png`: pixel-exact panel crops. **All colours and shapes in this document are sampled from these.**
- `docs/design/references/Aether/01 … 05 - *.png`: the same panels enlarged 3x (Lanczos), for viewing.
- `docs/design/references/Aether/regenerated/`: AI reconstructions. Used only to read fine forms (cup scallops, the ring's path, orb caps); never colour or detail truth.
- Crop boxes and checksums: `docs/design/references/reference-panel-exports.json`. Provenance: `Aether/README.md`, `REFERENCE-EXPORTS.md`.
- `Aether.jpeg` (the original board), `girlfriend-reference.jpg` (character DNA), `docs/design/── DESIGN-SPEC.md` (Aether: indigo, violet, cyan, pink, warm luminous highlights, cosmic underwater atmosphere; "Aether — The Curious Mind").

Method model: `2026-10-23-nox-3d-design.md`, `2026-10-26-nox-world-and-motion-design.md`, and the approved Veyra spec (`2026-11-03-veyra-3d-design.md` on `claude/veyra-design-3b1c3c`). Where they disagree for Aether, this document wins.
Engine: Aether is a `WorldBundle` on the shared engine (`2026-11-03-octoverse-engine-design.md`), built after E02 (extraction) and F01/F02 (Veyra). Section 8 lists what Aether needs from the engine. Physics is cancelled for every world; nothing here uses it.

## 1. Intent

Aether is the AI world: the host of the "AI Playground" project. Her identity is **curious, cosmic and soft**. She is a small, round, lavender jelly creature with a pink-white glow in her face, big violet eyes, and a thin gold orbit ring of glass "seed" beads circling her head like tiny planets. When she opens her head to show the project, her ideas leave the ring and fly out to her arms: the technologies arrive as glowing orbs at her arm tips. When something interests her, an arm reaches for it and she looks at it with an open-mouthed "ooh".

She must read as Aether, not as a purple Nox or a purple Veyra. Her differences are a round periwinkle jelly body with pink-white light inside, the gold satellite ring, the constellation-to-tentacle technology story, a curious head-tilting personality, and a world of floating ruins, jellyfish and a brain-glyph portal.

## 2. Acceptance criteria

These come first; every work item is judged against them. Colours are sRGB, sampled as 5 x 5 area averages from `Aether/native-panels/02 - Aether Arrives and Introduces AI Playground.png` (514 x 504; native x = `Aether.jpeg` x − 511). The panel is the board's own resolution, so the tolerance is Veyra's: **CIE76 delta E 10**.

### 2.1 Colour targets (P2, intro, frozen, at P2's camera and size)

| Region | Native P2 pixel (x, y) | Target RGB |
|---|---|---|
| Crown sheen (blue-white) | 269, 245 | 145, 168, 247 |
| Upper dome (deep blue-violet) | 269, 263 | 91, 78, 243 |
| Forehead (violet) | 269, 280 | 155, 108, 247 |
| Between the eyes (pink-lavender) | 269, 308 | 250, 184, 242 |
| Face glow, below the eyes | 272, 328 | 253, 212, 232 |
| Face glow, below the mouth | 272, 352 | 254, 217, 240 |
| Chin, where the glow meets the body | 272, 365 | 193, 139, 250 |
| Head side (left) | 214, 292 | 139, 104, 234 |
| Head side (right) | 314, 270 | 128, 117, 247 |
| Blush | 221, 344 | 250, 183, 206 |
| Arm top rim | 117, 327 | 227, 211, 251 |
| Arm body (upper arm) | 154, 347 | 94, 138, 228 |
| Arm body (lower arm) | 160, 387 | 69, 81, 229 |
| Arm underside glow | 145, 357 | 238, 198, 250 |
| Cup (glowing scallop) | 142, 364 | 222, 208, 245 |
| Inside a tip spiral | 95, 357 | 90, 63, 144 |
| Gold seed bead (ring, right) | 363, 265 | 217, 153, 130 |
| Glass seed bead (ring, left) | 153, 255 | 147, 105, 153 |
| Water just outside the head | 179, 250 | 16, 26, 99 |
| Mid water | 129, 230 | 5, 19, 75 |
| Upper water (lit, top right) | 469, 20 | 2, 36, 100 |
| Jellyfish bell (left) | 81, 155 | 163, 123, 225 |
| Ruin window light (left) | 46, 225 | 198, 138, 134 |

Further panels, same tolerance (native coordinates of each panel's own crop):

| Region | Panel, pixel | Target RGB |
|---|---|---|
| Open-mouth tongue (tech focus) | P4, 287, 239 | 253, 135, 143 |
| Open-mouth inside | P4, 295, 231 | 119, 29, 73 |
| Focused orb rim | P4, 385, 110 | 228, 217, 248 |
| Dome interior, upper (overview) | P3, 243, 125 | 59, 94, 226 |
| Dome rim (overview) | P3, 133, 190 | 73, 106, 209 |
| Dome top sheen (overview) | P3, 263, 108 | 164, 202, 253 |
| Portal membrane (entrance) | P1, 435, 235 | 15, 56, 167 |
| P1 mid water | P1, 250, 120 | 2, 26, 74 |

Global checks:
- **Mean colour inside Aether's silhouette** on the P2 mask (made with `silhouette.py` as for Nox and Veyra), recorded when H01 starts; tolerance 12 RGB per channel, saturation within 0.04.
- **Warm core on cool body:** face glow below the eyes is at least 120 points higher in red than the upper dome (P2: 253 vs 91).
- **Pink, not white:** the face glow keeps R − G ≥ 25 and G ≤ 235. Bloom washing the face to white fails here.
- **Periwinkle arms, not pink arms:** arm body samples keep B ≥ 200 and B − R ≥ 90.
- **Indigo water, not black:** mid water B ≥ 60 and B − R ≥ 55.

### 2.2 Shape targets (P2)

1 world unit = 100 panel px. Origin at the P2 native panel centre (257, 252), +y up.
- **Head:** centre x +0.07 ± 0.04; dome half-width 0.73 ± 0.04 (Nox 0.752, Veyra 0.92); top at y +0.18 ± 0.04. A round ball, slightly wider than its height to the chin. **Small cheek lobes** at the face sides, no more than 0.06 outside the dome line (Nox's are larger; Veyra has none).
- **Face:** eye centres at y −0.68 ± 0.04, ±0.345 from the head centre; brows at y −0.29; mouth at y −0.90; face-glow centre at about y −0.95.
- **Arm span** at rest: 3.84 ± 0.15.
- **Gold ring:** centre y −0.28 ± 0.05, projected half-width 1.25 ± 0.1, right side about 8° higher than the left. Seen almost edge-on.
- **Silhouette:** mask IoU with the P2 mask at least 0.85 (ring and beads excluded from both masks).
- **Overview dome (P3):** half-width 1.38 ± 0.06, top at panel y 105 ± 6. Orb diameter about 0.6 units.

### 2.3 Close-up detail

Checked at 3x zoom against the 3x panels, and in an orbit view (front, three-quarter, side, back):
- **Eyes:** violet irises, dark at the top and glowing magenta-pink at the bottom; black pupils; two white catchlights (large upper, small lower); a dark lash line with two short lashes at each outer corner; thin dark brows set high; soft pink blush ovals; a small closed smile as a thin dark line.
- **Mantle:** a blue-white crescent sheen on the upper left of the crown; deep blue-violet upper dome turning violet, then pink-white low in the face; a bright lavender-white rim; star specks (at least 15 visible on the front of the head at P2 size).
- **Arms:** periwinkle translucent jelly with a thin cyan-blue top rim; star specks along the arms (at least 60 across all arms at P2 size); a lavender-pink glow on the underside.
- **Cups:** glowing pink-white rounded scallops along each arm's underside, separate cups at the edge, shrinking toward the tip; the inside of curls a darker mauve.
- **Spirals:** at least four of the eight arms show a full curl at rest (P2: the side arms roll upward and outward).
- **Ring:** a thin gold line (at most 1.5 px at P2 size) with five glass seed beads, each with a warm gold rim and a soft highlight. The ring never crosses the eyes or the mouth.
- **Orbs (P3, P4):** the shared glass orb with logo, plus a rim of small glowing beads and a small gold cap where the thread attaches.
- **Back view:** round and glassy, the specks and rim continue round the back, and the ring circles behind the head.

### 2.4 Frame rate (owner's laptop, Intel UHD)

Measured with `scripts/perf.mjs` at 1536 x 1024, pixel ratio 1, back to back, browser pane closed, as for Nox and Veyra:
- **Intro at tier low:** at least 40 fps median.
- **Overview with 15 pendants at tier low:** at least 36 fps.
- **Head swell (synapse effect running) at tier low:** at least 36 fps median.
- **Entrance at tier low:** at least 32 fps median.
- **Nox and Veyra unchanged:** neither drops by more than 3% after Aether's engine changes land.
- **Baseline:** Nox measures 38 to 49 fps in the intro at tier low (Veyra spec, 12.2), so 40 fps is near the floor, not far below it. The budget is therefore measured at milestone 1, on the graded backdrop, before the world is built, and again at milestone 2.

### 2.5 Behaviour

- Exactly eight arms, T1 to T8, in every stage. Technology count never changes anatomy.
- At most two orbs per arm (16 slots); more technologies go to the tray.
- No orb, bead or thread overlaps the face (eyes, mouth, blush), the title or the nameplate in any frozen stage.
- Every sequence is skippable, plays once per session, and honours reduced motion.
- Switching worlds resets stage, timers, selection and sequences; Nox's and Veyra's output is unchanged.

## 3. Goals, non-goals, anti-goals

**Goals**
1. Aether reads as Aether in every stage: character, palette, composition and glow match P1 to P5 by measurement (section 2) and to the owner's eye.
2. She is clearly neither Nox nor Veyra: different head, material, face colour, cups, ring, technology story, world and motion.
3. Her world feels like deep water that is also deep space: indigo dark, star motes, jellyfish drifting like nebulae, ruins floating in it.
4. Her motion is curious and soft: she notices things, tilts her head, reaches out gently, and reacts with wonder.
5. She is built from data, closed-table variants and her own assets, with no fork of engine code.

**Non-goals**
- Physics of any kind.
- Any working AI feature on the site. "AI Playground" is the project being shown; the site generates nothing (master plan H02: no unsolicited AI-generation features).
- Sound.
- Matching the painted brush texture.
- Flux, the platform and the creator.

**Anti-goals** (failure even if it works)
- A recoloured Nox or Veyra: Nox's red band and head bubbles, or Veyra's pendants appearing the way hers do.
- A white-washed face: bloom turning the pink-white glow to flat white.
- Pink arms: the body drifting from periwinkle to pink.
- Muddy water: indigo going grey or pure black.
- A busy "AI fantasy" scene: glow everywhere, no focal point, jellyfish competing with her.
- Fidgety curiosity: twitching or darting. Her curiosity is slow and soft.
- The ring crossing her face, or orbs hiding the title.
- Videos as evidence. The owner checks motion live.

## 4. Constraints

- **Stack:** as Nox. React 19, TypeScript, Vite 8, three 0.186.1, R3F 9, drei, postprocessing, Theatre.js 0.7.2. No tone mapping; bloom handles highlights.
- **Engine first:** Aether starts after E02 lands and Veyra's F01/F02 variants exist (jelly skin, sparkle, frill cups, `pendant`, `armLift`, membrane, fish, `sand` floor, props). Aether code lives in `src/worlds/aether/`.
- **Engine changes** go through the engine owner, one closed variant at a time, in the same change as Aether's first use, with a test (contract section 9).
- **Blender:** headless, kit and bake scripts in `blender/aether/`, as `blender/security/`.
- **Workspace:** never edit the main checkout; copy references only.
- **Process:** targets before building; check the reference first; no videos; the owner approves each component; performance measured honestly; commit per approved milestone.
- **Model tiering:** Opus effort goes to the 3D look (mantle, face, cups, ring, synapse effect, world light). Routine wiring goes to cheaper models.
- **Content:** no AI Playground data exists in the repo. Storyboard text is used as marked placeholders until the owner supplies real facts.

## 5. Reading the reference

- **P1, entering.** Aether swims in from the left, three-quarter side view, head leading, arms streaming behind in long wavy ribbons like a jellyfish's trail, cups glowing along them. She heads toward a ruined stone arch on the right. The arch holds an oval cyan-blue energy membrane with a neon violet-blue brain glyph, and amber lanterns sit along its rim. Around it:
  - floating and broken stone towers with warm amber window lights;
  - light rays from the upper right;
  - pink-violet jellyfish with cyan filaments;
  - manta-like violet fish in the mid water;
  - magenta coral fans and small amber corals in the foreground;
  - a lit, rocky path;
  - star-like specks everywhere.
- **P2, intro.** Front view, centred, below the title. The head is a round lavender-periwinkle jelly ball with a blue-white crown sheen, deep blue-violet above, violet in the middle and a pink-white glow low in the face. Small cheek lobes. Big violet eyes with two lashes at each outer corner, thin high brows, pink blush and a small closed smile. A thin gold ring circles her head almost edge-on at brow height, carrying glass beads, two of them gold-lit, joined by faint gold constellation lines. Her arms:
  - the two upper side pairs spread wide at shoulder height and roll their tips up and outward;
  - the lower pairs spread lower and curl;
  - the two front arms hang down the centre.

  The title has a ringed-planet icon. "OCTOVERSE" sits above "Aether", then "AI Playground" and an intro line. The nameplate reads "Aether, The Curious Mind". The towers frame both sides; the portal is not in view.
- **P3, overview.** The head swells into a wide, glossy blue-violet glass dome holding the project panel (screenshot, "AI Playground", text, View Project, GitHub). The face sits at the bottom of the dome with an open happy smile. The ring is gone. Twelve glass orbs, each with a bead-dotted rim and a small cap and hook, hang at the arm ends and mid-arms in a horseshoe around her. The caption says up to 15: "The tentacles reveal the main technologies … Each icon glows and floats at the end of a tentacle."
- **P4, tech focus.** Hovering an orb makes its arm rise toward the cursor; the tip curls over the top of the orb, holding it. The orb grows and glows with a bright lavender-white rim and a cyan halo. Aether turns her eyes to it with an open "ooh" smile showing a pink tongue. A tooltip lists how the technology is used. The other arms and orbs keep floating.
- **P5, detail.** Aether moves to the left edge, partly cropped, still alive and smiling, and the ring and beads circle her head again. A large panel holds the title with its icon, section navigation (Overview, Features, Tech Stack, Architecture, Experiments, Challenges, What I Learned), a screenshot carousel (1/3), the project overview, Live Demo (lavender gradient) and GitHub, technology chips and key feature cards.
- **DNA** (`girlfriend-reference.jpg`): a round head, big eyes with lashes, a simple smile and eight flowing arms with teardrop technologies at their tips. Aether's arm-tip orbs follow it.

## 6. Approaches

| Approach | Verdict |
|---|---|
| **A. Satellites become pendants.** In intro and detail, five seed beads ride the gold ring (P2, P5). When the head opens, they flare and split into the technology orbs, which fly along gold arcs to the arm tips (P3). Hover uses `armLift` (P4). | **Chosen by the owner, 2026-11-03.** Tells the "curious mind" story, matches every panel, and reuses Veyra's pendant and lift code. Costs two new closed variants: placement `satellite` and appear `twinkle`. Technologies are choosable from the overview on, not in the intro. |
| B. Reuse Veyra as is (`pendant`, `bloom`, `armLift`), ring as decoration only. | No new artifact modules, but her technologies behave exactly like Veyra's: the generic-recolour risk. Rejected. |
| C. Nox-style orbiting: all orbs circle the head at every stage. | Matches P2's ring but contradicts P3 and P4, and 15 orbs crowd the title. Rejected. |

Building approach (as for Veyra): Aether is engine data plus closed-table variants plus her own kit. Copying the engine or recolouring by config alone are ruled out by the master plan.

## 7. The design

### 7.1 Character geometry

- **Head:** a round ball (section 2.2), about Nox's width and smaller than Veyra's. The lower outline narrows into the neck through small cheek lobes (`head.cheeks` small, not null). The face sits low; the face anchor is per character.
- **Arms:** exactly eight, T1 to T8, with webs at the roots.
  - **Thickness:** a soft, fairly even taper, slightly plumper than Veyra's, so the arms read as jelly ribbons.
  - **Tips:** authored curls rolling up and outward, looser than Veyra's tight coils.
- **Suckers:** rounded scallop cups along the underside, packed so their edges read as a glowing beaded frill. Each cup has a bright pink-white rim and a slightly darker lavender hollow, shrinking toward the tip. No red underside band.

### 7.2 Materials and look

Aether has her own lighting, as Nox and Veyra do: her glow, rim and cups are emitters the world never dims or tints. The world may add only the accents allowed in Nox spec 9.1 (at most 10% brightening, at most 5% caustic shimmer on top surfaces). It never tints her face.

- **Jelly mantle** (Veyra's `skin.mode: 'jelly'`, single pass, no transmission target), with Aether's values:
  - **Rim:** bright lavender-white all round the silhouette.
  - **Crown sheen:** a blue-white crescent highlight on the upper left, as in P2.
  - **Depth term:** the upper dome facing the camera is deep blue-violet, turning violet toward the middle.
  - **Pink core:** a pink-white glow inside the lower face, centred just below the mouth. It is near-white pink at its heart, lavender-pink at the eye line and fades into violet at the brows. This is the "warm luminous highlight" of the design spec.
  - **Star specks:** fine bright specks, a few larger with a tiny four-point glint, twinkling slowly (each fades over 2 to 5 s, out of phase).
- **Arms:** the same jelly look, set thinner: periwinkle body, a thin cyan-blue top rim, lavender-pink underside glow from the cups, star specks along their length. The pink core warms the arm roots.
- **Halo and aura:** a soft violet-blue glow round the silhouette, pinker under the face. The aura in the water is indigo-violet near her.
- **Local grade:** water within about 3 units of her is a little darker and bluer than the lit water at the top, so her rim reads against it.
- **Dome (overview):** a wide glossy glass capsule, blue-violet inside (darker toward the bottom), a lavender-blue rim and a blue-white sheen across the top (P3 samples).
- **Ring:** a thin gold emissive line. Seed beads are small glass spheres (the orb glass look, no logo) with a warm gold rim; two of the five glow gold-amber (P2), the rest lavender glass. Faint gold constellation lines join neighbouring beads.

### 7.3 Face

Same parametric face canvas as Nox, with Aether's layout and palette:
- **Eyes:** large and round. Violet irises, near-black at the top grading to glowing magenta-pink at the bottom. Black pupils, two white catchlights, warm white sclera.
- **Lids and lashes:** a dark lash line and two short lashes at each outer corner.
- **Brows:** thin dark arcs, set high, slightly raised: open and interested by default.
- **Mouth:** a small closed smile, a thin dark line. Open forms have a dark plum inside and a pink tongue (samples in 2.1).
- **Blush:** soft pink ovals under the outer corners of the eyes.
- **Expression presets**, tuned to Aether:
  - soft smile (intro);
  - happy open smile (overview, P3);
  - **wonder** (tech focus, P4): eyes a little wider, brows up, mouth open in an "ooh"-smile with the tongue showing;
  - attentive smile (detail);
  - restful (idle, reduced motion).

### 7.4 Poses

Each stage pose is Aether's own (arm curves, body position, scale, yaw, expression, look-at points), authored in the traced plane from her panels:
- **Entrance:** three-quarter side view, head leading, arms streaming behind in long waves (P1).
- **Intro:** traced from P2.
  - T1 and T8 (upper side) spread at shoulder height and roll their tips up and outward.
  - T2 and T7 spread a little lower and curl.
  - T3 and T6 spread low and curl.
  - T4 and T5 hang down the centre.
- **Overview:** traced from P3. The arms spread into a wide horseshoe around the body so their tips and mid-arms carry the orbs clear of the dome. The face sits at the dome's bottom.
- **Tech focus:** as the overview, with the owning arm lifted (section 7.5).
- **Detail:** traced from P5. Aether at the left edge, three-quarter facing right toward the panel, with the ring back round her head.

### 7.5 Technologies: satellites become pendants

**The ring (intro and detail).**
- A thin gold ring circles the head at brow height, almost edge-on (section 2.2), carrying five seed beads.
- **Beads librate, they do not circulate.** Each bead has a home angle in the ring's rear 270°, the five spaced evenly (about 54° apart). Each sways ±12° about its home with its own period (6 to 9 s, out of phase) and bobs gently. Beads never pass each other.
- **Face keep-out:** the ring's front sector (±45° around the camera direction) holds no bead at any time. The ring line fades to nothing where it crosses the head's front, as in P2. Beads on the rear arc pass behind the head and are seen through the jelly, dimmed by it, as any object behind her is.
- Faint gold constellation lines join neighbouring beads and flicker slowly.
- The beads are not choosable. In the intro, the visitor opens the overview (Explore, or a click on the head) to see the technologies. P3's caption has the tentacles "reveal" them.

**The ring forming (after the entrance settles).** This is the `twinkle` appear. It runs when the entrance settles, the same moment Nox's blow and Veyra's bloom run, so the contract needs no new trigger. The gold line draws round her head in about 0.6 s. Then the five beads light one after another, like stars appearing, over about 0.8 s.

**The flight (head swell into the overview).** The flight belongs to the `satellite` placement. It is driven by swell progress, the way Nox's `orbit` placement already reads the swell (`swellPush`). No appear trigger is involved:

| Swell | What happens |
|---|---|
| 0 to 0.2 | The beads brighten and the ring line glows. |
| 0.2 to 0.35 | Each bead flares and splits into its share of orbs (N technologies on the arms, dealt to the 5 beads in slot order: 15 gives 3 each; 10 gives 2 each). The ring line fades. |
| 0.35 to 0.9 | The orbs fly out along gold arcs, bowed outward and slightly up, to their arm slots. Each leaves a fading gold trail. They land in a ripple from the upper arms down, each landing with a small dip of its arm (the arm "catches" it) and its logo brightening. |
| 0.9 to 1.0 | The threads settle and the orbs begin their idle float. |

Closing reverses the flight in about half the time: the orbs fly back, merge into the beads, and the ring line redraws.

**Pendants (overview and tech focus)** use Veyra's `pendant` slot and tether code with Aether's style:
- Each orb hangs on a short gold thread (0.12 to 0.2 units) with a small gold cap and hook. The orb has a rim of small glowing beads (P3).
- Slots sit at arm tips and mid-arms, at most two per arm (16 slots). P3 shows twelve; more follow the same horseshoe rhythm.
- Slot order follows the project's technology order, so the most important sit on the upper arms.
- More technologies than slots go to the "more" tray. Never extra arms.
- **Float, not swing:** the orbs are buoyant. The swing is driven by the attach point's motion, at most 15° from vertical, and settles in about 1.4 s. On top of it, each orb bobs about 0.03 units over 3 to 5 s, out of phase. Threads never cross arms or the face (checked in tests per pose).

**Choosing an orb** (hover, keyboard focus or tap) uses Veyra's `armLift`, with Aether's tuning:
1. The owning arm rises toward the pointer (straight up and forward with keyboard or touch) in about 500 ms, root first, tip last. The tip curls over the top of the orb and holds it (P4).
2. The orb grows 1.3x, its rim beads brighten to lavender-white and a soft cyan halo appears.
3. Aether turns her eyes and head to it with the wonder expression.
4. The tooltip shows how the technology is used (P4).
5. Other orbs dim about 20% and keep floating; other arms keep only ambient motion.
6. Releasing, or choosing another, lowers it back with a soft settle.

One choice at a time. Every orb has a real HTML button that follows it. On a phone, the tray stays, and choosing from it plays the same lift.

**Stages:**
- **Entrance:** no ring, no orbs.
- **Intro:** the ring forms as she settles (section 7.9) and stays.
- **Overview and tech focus:** orbs on the arms; no ring.
- **Detail:** orbs fly back to the ring (as on close); the technologies show as chips in the panel.

### 7.6 Head swell: the synapse effect

The swell keeps the shared mechanics: anticipation (a small squeeze), a swell with overshoot, then a settle. Aether's effect (`synapse`, a head-effect module) sits inside the dome and runs alongside the flight:

| Swell | What happens |
|---|---|
| 0 to 0.3 | Star nodes light up inside the dome: 20 to 30 small points, as if the specks were waking. |
| 0.3 to 0.65 | Gold lines wire the nodes together in a wave rising from the face to the crown, like a thought spreading. |
| 0.65 to 0.8 | The network pulses once (a brief, soft brightening). |
| 0.8 to 1.0 | The lines thin and the nodes dissolve into the dome's sheen as the project panel fades in. |

Closing plays it in reverse at about twice the speed. It is driven only by swell progress and the dome frame.

### 7.7 The world: the drowned observatory

Built like Nox's world (Nox spec 9.2): a real 3D kit near Aether, a painted far plate behind, baked light on still stone, and live elements in front.

**Kit** (`blender/aether/`):
- **The brain portal:**
  - a ruined stone arch with stone steps leading up to it and amber lantern nodes along its rim;
  - an oval energy membrane in cyan-blue (the shared membrane material, Aether's colours);
  - a neon violet-blue brain glyph as a separate node, driven by the `'emissive'` prop drive.
- **Ruin towers:** broken stone towers and walls with small arched windows lit warm amber from inside.
- **Floating rubble:** a few stone fragments hanging in the mid water. Near ones bob slowly (see section 8, item 13); far ones are in the far plate.
- **Coral and rocks:** magenta-violet coral fans and small amber corals in the foreground corners; dark seabed rocks; a faint, lit path.

**Layout** (data):
- Towers frame both sides of the stage, as in P2.
- The portal stands to the right and back, on the entrance path (P1). It is out of the P2 framing in the intro, so the intro stays as clean as P2.
- The path runs from the left distance toward the portal.
- The foreground is dark rocks and coral.

**Light:**
- **Rays:** cool blue-white rays from the upper right.
- **Windows:** warm amber window and lantern light spills on nearby stone (baked). These are the warm highlights the master plan asks for.
- **Portal:** cyan spill on the arch (baked); the brain glyph pulses.
- **Coral:** a soft magenta glow (baked).
- **Aether:** her own pink-violet glow lights the path below her.
- **No lava** and no red light.

**Water:** deep indigo fog (samples in 2.1), near-black indigo low down, brighter blue toward the top right where the rays enter.

**Live elements:**
- **Jellyfish** (new live element): pink-violet bells with cyan filaments, pulsing and drifting slowly upward; 6 to 10 in view, fewer at tier low.
- **Star motes:** tiny blue-white specks that twinkle (the shared motes, Aether's colours and a twinkle). This is the "space" in her water.
- **Bubbles:** a few small glassy bubbles rising, separate from her beads.
- **Fish:** violet manta-like silhouettes crossing slowly far off (the shared fish element, Aether's shape and colours); off at tier low.
- **Rays, membrane flow and glyph pulse:** the rays move gently; the membrane flows; the brain glyph pulses every 6 to 9 s, a light travelling across its folds.

**Relic intensity:** the portal is the strongest world light and never competes with Aether. Its brightest pixel stays below her face glow during the entrance, and it is out of frame in the intro.

**Camera:**
- **Framing:** her own per stage; in the intro the title sits above her and the nameplate below (P2).
- **Hover:** the shared camera hover, a touch floatier than Nox's; full in the intro, half in the overview, still while an orb is chosen, off in detail.
- **Tilt:** a slight upward lean, about Veyra's.

### 7.8 Motion personality: the curious mind

Starting values, tuned live with the owner:

| Setting | Nox | Veyra | Aether (start) | Why |
|---|---|---|---|---|
| Blink interval (s) | 2.6 to 7.0 | 3.5 to 8.5 | 2.8 to 6.5 | bright and attentive |
| Double blink chance | 0.2 | 0.12 | 0.25 | the "huh?" blink |
| Gaze response | 16 | 10 | 14 | quick to notice, soft to follow |
| Head turn | 3.2 | 2.4 | 2.8 | turns toward what interests her |
| Sway | 0.5 | 0.4 | 0.55 | floaty |
| Curl | 1.1 | 1.4 | 1.25 | rolled, not coiled |
| Float amplitude / period | 0.045 / 6.2 s | 0.06 / 7.5 s | 0.07 / 6.8 s | buoyant, drifting |
| Breath period | 4.6 s | 5.4 s | 5.0 s | soft |
| Stroke: recovery / power / glide | 0.52 / 0.21 / 0.6 s | 0.65 / 0.26 / 1.0 s | 0.6 / 0.24 / 0.85 s | jellyfish-like pulse and glide |
| Settle overshoot | as approved | 60% of Nox's | 80% of Nox's | a little bounce |
| Curious head tilt | none | none | ±6°, every 5 to 9 s | her signature |
| Gaze wander | none | none | to a look-at point every 4 to 8 s | she notices things |

**Character moments** (shared micro-animations, Aether's tuning):
- **Curious tilt:** idle, the head tilts slowly to one side, holds, and returns, sometimes with a blink at the top of the tilt.
- **Gaze wander:** her eyes, then her head, drift to a point of interest (a jellyfish passing, a mote, the corner of the title) and back to the visitor. In the intro the pointer wins: if it moves, she looks at it.
- **Reach to touch:** every 10 to 16 s, one upper arm uncurls its tip a little toward a nearby point of interest, then rolls back.
- **Spark of an idea:** when the pointer rests near her for over 1.5 s, a wave of star-speck twinkle runs from her face to her crown and one gold bead flickers.
- **Happy wiggle on arrival:** Nox's size, softer timing.

None of these may read as nervous: no motion faster than the head-turn rate, and never more than one moment at a time.

### 7.9 The entrance

| Time | Beat |
|---|---|
| 0 to 1 s | A pink-violet glimmer in the haze on the left becomes Aether, glow first. |
| 1 to 4.2 s | She glides in with two or three soft pulse strokes, arms streaming in long waves behind her, along the path toward the portal (P1). |
| ~3.2 s | As she passes in front of the portal's left side, the brain glyph fires: a light runs across its folds and the membrane brightens. She turns her head to look at it as she goes by: the curious look-back. |
| 4.2 to 5.3 s | She curves away from the portal, toward the camera and the stage centre. She turns about 90°, from three-quarter side to front, tilting her head about 12° as she first sees the visitor, then straightening. |
| 5.3 to 6.3 s | Settle: the arms open into the intro pose and the tips roll up. Then the P2 caption's beats in order: she **looks at you, blinks, and smiles**. |
| 6.3 to 7.7 s | The ring forms (the `twinkle` appear, section 7.5). |

- **Camera:** the `entering` stage frame is wider and turned to the right so the portal is in view (P1). The shared stage transition blends it into the intro frame during the turn (4.2 to 5.3 s). The intro frame leaves the portal out of view (P2). The entrance ends at the intro pose's body position.
- The path clears the arch, towers and floating rubble with arms open or closed (a unit test checks clearance against the layout).
- Skippable at any moment; plays once per browser session.
- With reduced motion she is simply present in the intro pose with the ring shown.
- The title and nameplate appear as she settles.
- The entrance is a Theatre.js sheet owned by the Aether world. The glyph firing is a `kitDrive` on the glyph prop.

### 7.10 Stages and content

The stage set is shared (entrance, intro, overview, tech focus, detail), with Nox's transitions and priorities. The interface is the shared HTML, themed per world. In the intro there is nothing to choose, so the first keyboard stop after the skip link is Explore.

**Content** (`src/worlds/aether/content/`), storyboard text as marked placeholders:
- Name and epithet: "Aether", "The Curious Mind".
- Project: "AI Playground", tagline "A collection of AI-powered tools and experiments.", intro line "Experimenting with AI, building intelligent tools and exploring what's next."
- Overview text from P5.
- Links: Live Demo and GitHub (P5), View Project (P3).
- Screenshots: three carousel slides (P5 "1/3").
- Technologies: the ten P5 chips ship as placeholders: React, Next.js, TypeScript, Python, OpenAI, PostgreSQL, Redis, Docker, AWS and Vector DB. Five more icons appear in P3 and P4 without names: an atom-like mark, a golden block mark, a white animal mascot, a gold-and-violet mark, and Vite's "V". They are not shipped until the owner names them. Everything that depends on the count (bead split, slot table, tray) works for any count from 1 to 16 and beyond. Tests cover 1, 10, 15, 16 and 20. Logos use the shared logo cache; a technology without a mark uses its lettered fallback.
- Usage notes per technology (P4's OpenAI list is the model).
- Detail sections: Overview, Features, Tech Stack, Architecture, Experiments, Challenges, What I Learned (P5).
- Key features: AI Chat Interface, Image Generation, Document Analysis, Experiment Hub (P5). These are text about the project, not site features.

**Theme tokens:**
- **Accent:** lavender-violet, with a lavender-to-violet gradient for View Project and Live Demo (P3, P5), sampled at build time.
- **Panels:** deep indigo glass surfaces.
- **Focus ring:** cyan-lavender.
- **Icon:** a ringed planet beside the title (P2).
- **Title:** "OCTOVERSE" letter-spaced above it.

### 7.11 Responsive and accessibility

As Nox and Veyra:
- **Desktop and tablet:** the storyboard composition.
- **Phone:** Aether in the upper screen, orbs in the tray, panels as bottom sheets. The ring stays but shrinks with her.
- **Every size:** 44 px targets, full keyboard path, skip link, reduced motion (no float, drift, swim, tilt or wander; ring static; the flight becomes a crossfade from beads to orbs; the synapse effect becomes a crossfade), and a no-WebGL poster of the intro.

### 7.12 Performance plan

The budget is section 2.4. The levers are the shared quality tiers (render scale, particles, rays, shadow map, far plate size, bloom resolution). In addition:
- **Jelly material:** one pass, as Veyra's.
- **Jellyfish:** instanced, vertex-shader pulse and drift; 4 at tier low.
- **Fish:** instanced; off at tier low.
- **Ring, threads and constellation lines:** one line batch for all.
- **Seed beads and orbs:** one material, instanced where possible; logos through the shared cache.
- **Synapse effect:** one points draw and one line draw inside the dome, allocated once.
- **Flight trails:** a fixed pool of trail segments, no per-frame allocation.

## 8. Engine-dependent pieces

Sent to the orchestrator on 2026-11-03 (full note: `aether-engine-needs.md` in the shared session notes). Each is data or a closed-table variant under contract section 9.

**Who builds what.** The master plan says one worker owns shared engine changes. That is the engine owner (the orchestrator assigns it). Aether's plan therefore has two kinds of task:
- **Engine tasks:** each new variant or parameter below, built in `src/engine/` with its test. Each is reviewed by the engine owner before Aether code uses it, and each lands in its own commit.
- **World tasks:** everything in `src/worlds/aether/` and `blender/aether/`.

If Veyra's F01/F02 already built an item with the parameters Aether needs, its engine task shrinks to a check and a test. If the engine owner refuses an item, Aether uses the fallback given with it.

**New closed variants (built in H01/H02, with tests):**
1. **Placement `satellite`.** Its rest form is a ring around the head (radius, tilt, bead count, home angles, sway, face keep-out, line style), used in intro and detail. Its active form is pendant slots (overview, tech focus). **Swell progress drives the flight between them inside the placement**, as Nox's `orbit` placement already reads the swell, so no new trigger is needed. It composes the orbit-shell maths (Nox) and the pendant slot, tether and swing code (Veyra). **Asks F01** to build that pendant code as reusable functions. Fallback: if the pendant code is Veyra-bound, the `satellite` engine task first extracts it into shared functions, with Veyra's tests unchanged.
2. **Appear `twinkle`.** The ring forms after the entrance settles: the same trigger Nox's blow and Veyra's bloom use. This withdraws the `appearOn` gap first sent to the orchestrator.
3. **Head effect `synapse`.** Fits contract 9.1 as is.
4. **Live element `jellyfish`.** Contract 12.3 anticipated it.

**Veyra-built variants that must be parameterised, not Veyra literals:**

5. **Jelly skin and sparkle:**
   - crown, depth, rim and core colours, and the core's position, as config;
   - they must also apply to the arms, which are jelly for Aether.

   This blocks milestone 1. Fallback: arms keep the `'skin'` mode with Aether's colours, high translucency and the sparkle term only. The owner judges that at the P2 gate.
6. **Frill cup style:** colours, glow and size as config. Blocks milestone 1; no fallback is needed, since the colours are plain data.
7. **Portal membrane:** a shared world material with colour params. Fallback: an Aether-owned kit material with the same look.
8. **Expression table per character:** Aether needs "wonder". `armLift` reads the focus expression id from the table. Fallback: the tech-focus pose's own expression (poses already carry one) is used for the lift.
9. **Fish:** silhouette and colours as data. Aether's are manta-like. Fallback: Veyra's fish shape in Aether's colours.
10. **Floor:** reuses `'sand'` with Aether's palette.

**Small data additions:**

11. **`artifacts.orbStyle`:** rim beads (count, colour) and cap, on the shared orb glass. 0 beads keeps today's look for Nox and Veyra. Fallback: the beads are drawn as part of the `satellite` module's pendant decoration.
12. **Personality:** curious head tilt (amplitude, period), and gaze wander to a per-pose list of look-at points. A later, richer option lets attention read named live-element positions; Aether does not need it. Fallback: none acceptable. The tilt and the wander are her personality (master plan H02), so a refusal goes to the owner.
13. **Prop drive `'bob'`:** a slow vertical sine for the near floating rubble. Fallback if refused: the near rubble stays still and only the far plate shows floating ruins.
14. **A stage with zero choosable artifacts (intro):** buttons, keyboard path and tray must work. This is likely already true; it needs a test.

If the engine owner changes or refuses any item, the plan adapts Aether to the decision and lists the gap. Aether never forks engine code.

## 9. Verification

- **Unit tests (Vitest):**
  - config validation and clamping for Aether's character and world;
  - ring keep-out: no bead or visible line segment in the face sector, sampled over 60 s of libration; beads never pass each other;
  - satellite slot assignment for 1, 10, 15, 16 and 20 technologies: dealt over 5 beads and 16 slots, overflow to the tray, never more arms;
  - flight positions against swell progress (ring at 0, slots at 1), and the reverse on close;
  - twinkle timing after the entrance settles;
  - pendant float bounds (swing at most 15°, settling within 1.4 s);
  - threads clear of arms and face in each pose;
  - synapse phase timing;
  - entrance path clearance;
  - world switch resets state;
  - zero choosable artifacts in the intro.
- **Look checks:**
  - `check_stage.py --world-id aether` on frozen frames at P2's camera for the section 2.1 targets;
  - side-by-side stills against the native panels P1 to P5 at the same size;
  - the close-up list in 2.3 at 3x zoom;
  - the orbit view for the back.
- **Motion checks without video:** stills at chosen times (`?t=` with `?freeze`, `?swell=` for the flight and synapse), numeric traces from tests, and the owner's live check with three to six things to look at per item.
- **Performance:** `scripts/perf.mjs` with `world=aether`, back to back, browser pane closed, against section 2.4. Nox and Veyra are re-run in the same session.
- **Three-world regression:** Nox's and Veyra's look checks and tests pass unchanged after every Aether milestone.

## 10. Delivery order

Each milestone ends with the owner's live review, then a commit. H01 covers milestones 1 to 4; H02 covers 5 to 8.

1. **Aether on the P2 stage (gate):** character, geometry, jelly material with pink core, face, cups, ring (static) and the P2 pose, on a graded backdrop fitted to P2's water samples. Colour, shape and close-up targets met. The owner approves P2 before anything else (H01: "P2 first").
2. **The drowned observatory:** kit, bake, far plate, live elements (jellyfish first), light and camera. Aether's P2 targets still met in the world; frame-rate budget met.
3. **Static P3, P4 and P5:** overview pose with dome and orbs on their slots, tech focus pose, detail composition with the ring, and responsive variants.
4. **Back view:** orbit review.
5. **Motion personality and the entrance**, with the glyph firing and the ring forming.
6. **Technologies live:** ring sway, ring forming (`twinkle`), the flight, pendant float, arm lift, tooltip, buttons and tray.
7. **Head swell with the synapse effect.**
8. **Pass across all stages:** responsive, phone, reduced motion, accessibility, performance, and the three-world regression report.

### 10.1 Starting conditions and fallbacks

- **Start point:** after E02 and Veyra's F01/F02 variants land. The plan is written against the engine contract and E02's interfaces, not against `src/nox3d`.
- **Plan depth:** milestones 1 and 2 are planned task by task; 3 to 8 at task level, revisited after the owner approves P2.
- **Missing the frame-rate floor:** cut levers in this order, at tier low only:
  1. fish;
  2. jellyfish count (never below 3);
  3. light rays;
  4. motes and bubbles;
  5. far-plate size;
  6. constellation-line flicker;
  7. star-speck count (never below section 2.3).

  Her own look (face, rim, core, cups, ring) is never cut. If the floor is still missed, the numbers go to the owner first.
- **Entry point:** `?world=aether` only, until the landing page phase. Aether gets her own no-WebGL poster.
- **Tools:** `check_stage.py`, `silhouette.py`, `compare.py` and `perf.mjs` take the world id (contract 11.6). The P2 mask is made from the native P2 panel.
- **Placeholder images:** crops of the storyboard's own AI Playground screens (P3, P5), clearly marked, until the owner supplies real screenshots.

## 11. Left to the builder

- Exact jelly, pink-core, star-speck and synapse shader maths, within the targets.
- The ring's libration curve and the flight arc shape, within the timings.
- The pendant float formula and constants, within the bounds.
- Kit modelling details, lightmap resolution, compression and LOD distances.
- Exact pose traces, slot positions and sequence timings within the ranges, tuned live.
- File structure inside `src/worlds/aether/`.
- Tests beyond section 9.

## 12. Calls I made (for the owner to check)

1. **Colour tolerance is delta E 10,** as Veyra's, because the panels are the board's own resolution.
2. **The frame-rate floor** is 40 fps at tier low for the intro, plus a 36 fps floor for the head swell (the synapse effect and flight run together).
3. **Five seed beads** on the ring, as P2 shows. The technologies are dealt among them when the head opens (15 gives 3 each).
4. **The beads sway about fixed homes in the rear 270° of the ring;** they never circulate, never pass each other, and never enter the ±45° in front of her face.
5. **The flight belongs to the placement** (driven by the swell). The appear (`twinkle`) is only the ring forming after the entrance, so the contract needs no new trigger.
6. **Content uses storyboard text** as placeholders. Ten technologies ship (the P5 chips); the five unnamed icons from P3/P4 wait for your names.
7. **Technologies are not choosable in the intro.** Explore (or the head) opens them.
8. **The tech-focus face is "wonder"** (open "ooh"-smile with tongue), from P4.
9. **The portal is out of frame in the intro;** it is the entrance's landmark (P1), and P2 shows only the towers.
10. **The brain glyph fires and Aether looks back at it** as she passes: a curiosity beat, not a gate opening.
11. **The world's name is "the drowned observatory"**, a working name for files and talk only, never shown in the UI.
12. **Personality starting values** are the table in 7.8, tuned live. The curious tilt and gaze wander are new engine fields (section 8, item 12).
13. **Floating rubble bobs** only if the engine accepts a `'bob'` prop drive; otherwise it is still.
14. **Engine items have fallbacks** (section 8), except the curious tilt and gaze wander. If those are refused, the question comes to you.
