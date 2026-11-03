# Flux in 3D: Character, Pipeline World and Motion Design

Date: 2026-11-03
Status: approved by the owner, 2026-11-03.
Branch: `flux-design` (docs only), cut from `claude/engine-contract-9ac935` at `b8f2fcb` (engine contract with amendment A1 approved).
Packets: master plan G01 (Flux static) and G02 (Flux behaviour).
References (read-only, main checkout, `docs/design/references/`):
- `Flux.jpeg`: the storyboard, panels P1 to P5.
- `Flux/native-panels/01 … 05 - *.png`: pixel-exact crops of `Flux.jpeg` at source resolution (crop boxes in `reference-panel-exports.json`; P2 is `[509, 0, 1020, 510]`). **All colour samples come from these.**
- `Flux/01 … 05 - *.png`: the same crops enlarged 3x (Lanczos). Used for viewing only.
- `Flux/regenerated/*.png`: AI reconstructions (provenance in `REFERENCE-EXPORTS.md`). Used only to read fine forms (cup shapes, lash count, sparkle density); never colour or detail truth.
- `girlfriend-reference.jpg`: the character DNA.
- `── DESIGN-SPEC.md`: Flux is "GitHub Pipeline / CI/CD world"; blue, violet, purple, electric cyan; futuristic underwater infrastructure; "Flux — The Pipeline Runner".
Method model: `2026-10-23-nox-3d-design.md`, `2026-10-26-nox-world-and-motion-design.md`, and Veyra's approved spec (`2026-11-03-veyra-3d-design.md`, branch `claude/veyra-design-3b1c3c`). Where this document and those disagree for Flux, this document wins.
Engine: `2026-11-03-octoverse-engine-design.md` (final, A1 approved). Flux's engine additions are its section 18.1 (F1 to F7). Physics is cancelled for every world; nothing here uses it.

## 1. Intent

Flux is the third OctoVerse host. He presents the GitHub Pipeline Engine, a self-hosted CI/CD platform. His identity, from master plan G01 and G02, is **"energetic but aquatic; no mechanical pipeline-like anatomy"**: a bright, bouncy blue-violet octopus in a sunken server city.

His signature is the **pulse**. Light waves run along his cup rows from root to tip, the way comb jellies flicker along their bodies. It is real ocean biology, and it reads as data flowing down a pipeline. The pipeline lives in his light and his world, never in his body: no pipes, ports, rings or LEDs on the octopus.

Flux also tests the engine a third time. He should come almost entirely from data and modules Veyra and Aether already build, plus four small closed variants (section 8).

## 2. Acceptance criteria

These come first because every work item is judged against them. All colours are sRGB, sampled from `Flux/native-panels/02 - Flux Arrives and Introduces GitHub Pipeline Engine.png` (P2, 511 x 510 px). Coordinates below are pixels in that file (full-board x = native x + 509). The reference is a composite at about 510 px per panel, so tolerances match Veyra's.

### 2.1 Colour targets (P2, intro, frozen, at P2's camera and size)

Each region sample is a 5 x 5 px area average, within CIE76 delta E 10 of the reference value.

| Region | Native P2 pixel (x, y) | Target RGB |
|---|---|---|
| Head crown (electric blue) | 241, 243 | 48, 68, 239 |
| Head middle (violet) | 243, 275 | 156, 87, 239 |
| Head side | 191, 272 | 46, 65, 229 |
| Head rim (bright edge) | 181, 282 | 61, 116, 233 |
| Face glow, between and below the eyes | 243, 316 | 254, 171, 207 |
| Chin, where the glow meets the arms | 246, 355 | 214, 125, 243 |
| Blush | 203, 335 | 249, 156, 207 |
| Mouth inside (tongue) | 256, 339 | 246, 96, 127 |
| Arm body | 151, 340 | 55, 74, 241 |
| Arm top highlight | 116, 325 | 109, 125, 246 |
| Cup glow (lavender-pink) | 81, 326 | 243, 175, 239 |
| Water just outside the head (aura) | 168, 250 | 0, 24, 80 |
| Mid water beside him | 103, 200 | 0, 16, 45 |
| Upper water (lit, toward the shaft) | 393, 90 | 1, 74, 136 |

Plus three global checks:
- **Mean colour inside Flux's silhouette:** measured on the P2 mask (made with `silhouette.py`, as for Nox and Veyra) when G01 starts. The target is recorded in the review log then, with tolerance 12 RGB per channel and saturation within 0.04.
- **Blue-to-violet gradient:** the head-middle sample's red is at least 70 above the crown's (reference: 108). A flat blue head, the "recoloured Veyra" failure, shows up here first.
- **Warm face:** the face-glow sample's red is at least 150 above the crown's (reference: 206), and its green stays at least 40 below its red (reference: 83), so the face reads pink-white, never grey or white.

### 2.2 Shape targets (P2)

1 world unit = 100 panel px, origin at the P2 panel centre (native 255.5, 255), +y up.
- **Head:** dome half-width 0.74 ± 0.04 (Nox 0.752); top at y 0.26 ± 0.04 (Nox 0.255). Soft cheek lobes at eye level (radius about 0.08, smaller than Nox's).
- **Face:** eye centres at about y -0.54 and x ±0.37; mouth at about y -0.81; face-glow centre at about y -0.70.
- **Arm span** at rest: 4.0 ± 0.2 units, measured on the mask at G01 start.
- **Silhouette:** mask overlap (IoU) with the P2 mask at least 0.85.

### 2.3 Close-up detail

Checked at 3x zoom against P2 (`Flux/02 - …png`, with `regenerated/02` for fine forms only), and in an orbit view (front, three-quarter, side, back):
- **Eyes:** large; navy-black upper iris turning violet-lavender at the bottom; a dark pupil; two white catchlights (one large upper-left, one small); two short lashes flicking out at each outer corner; short, thick, dark brows set high and arched.
- **Mouth:** an open "D" smile with a dark rim and a pink tongue (the intro face, P2). Pink blush ovals under the outer eye corners.
- **Mantle:** smooth glassy jelly with a bright blue rim, blue crown, violet middle and a pink-white glow round the face. Fine white-cyan sparkle specks: at least 40 visible on the front of the head at P2 size, and specks on the arms. No blotches.
- **Cups:** separate glowing lavender-pink ovals along each arm's underside, at least 10 visible on every fully visible arm, shrinking toward the tip. They are not a continuous band and not a frill.
- **Tips:** open curls of half a turn to one turn. At least five of the eight arms show one at rest. They are not tight coils (Veyra) and not straight.
- **Back view:** round and glassy. The sparkles, the rim and the blue crown continue round the back.

### 2.4 Pulse targets

- **Travel:** one pulse crosses an arm root to tip in 0.6 to 0.9 s, and lights 3 to 5 cups at once.
- **Brightness:** the resting cup is already near the top of the range (243, 175, 239), so the pulse reads mostly as a **hue shift**: the cup turns cyan, then lavender, then back to pink as the wave passes. It brightens only a little, and the cup's halo widens. At its peak, a pulsed cup stays coloured: its brightest channel is at most 250, and its smallest channel is at least 40 below its largest. The pulse never blooms to white.
  - **Where it is measured:** on the final composited frame after bloom, in a frozen still (`?freeze&t=…`), as a 3 x 3 px average at the centre of the brightest cup in the wave. Bloom on the cups is a tuning knob inside this cap.
- **Restraint:** at rest, at most one idle pulse runs at a time. On average one runs every 6 to 10 s (section 7.8 sets the rate).

### 2.5 Frame rate (owner's laptop, Intel UHD)

Measured at 1536 x 1024, pixel ratio 1, back to back, browser pane closed, with `scripts/perf.mjs` and `?world=flux`, the same way as Nox and Veyra:
- **Intro at tier low:** at least 40 fps median.
- **Overview with 12 pendants at tier low:** at least 36 fps.
- **Entrance at tier low:** at least 32 fps median (packets and LEDs on).
- **Nox and Veyra unchanged:** neither world's numbers drop by more than 3% after Flux's engine additions land.

### 2.6 Behaviour

- Exactly eight arms, T1 to T8, in every stage. Technology count never changes anatomy.
- Orbs never overlap the face, the title or the nameplate.
- Every sequence is skippable, and reduced motion is honoured.
- Switching worlds resets the stage, timers, selection, sequences and pulse triggers.

## 3. Goals, non-goals, anti-goals

**Goals**
1. Flux reads as Flux at every stage: the same character, palette, composition and glow as P1 to P5, judged by measurement (section 2) and by the owner.
2. He is clearly neither Nox nor Veyra: a blue-to-violet-to-pink body, open curls, separate pink cups, a big open smile, the pulse, a server city, and quick, bouncy motion.
3. His world feels like a real sunken data centre: server towers grown over with reef, a GitHub ring portal, a glowing pipeline bridge, and light shafts from above.
4. His motion is energetic: quick, bright and springy, never nervous.
5. Flux is data, the engine's tables and his own assets, with no fork of shared code.

**Non-goals**
- Physics of any kind.
- Sound.
- Aether, the landing page and the customiser.
- Matching the painted brush texture.
- Real CI/CD data. The pipeline nodes and run states are decoration, not live status.

**Anti-goals** (failure even if it works)
- **Mechanical anatomy:** pipe segments, joints, ports, cables, LED dots or hard rings on the octopus. The master plan forbids it.
- **A recoloured Veyra:** a flat blue jelly with bloom pendants.
- **A recoloured Nox:** a red-band arm look or orbiting bubbles.
- **Neon overload:** cyan or pink blooming to white, or the world brighter than Flux.
- **Twitchy motion:** energetic must read as joyful, not nervous. Fast is fine; jitter, constant fidgeting and simultaneous pulses on many arms are not.
- **Generic "tech" clutter:** floating code everywhere, holograms, HUD lines. Code glyphs stay few, far and dim.
- **Videos as evidence.** The owner checks motion live.

## 4. Constraints

- **Stack:** as Nox. React 19, TypeScript, Vite 8, three 0.186.1, R3F 9, drei, postprocessing, Theatre.js 0.7.2. No tone mapping; bloom handles highlights.
- **Engine first:** Flux starts after E02 (Nox extraction) lands. He reuses modules Veyra (F01/F02) and Aether (H01/H02) build. The plan's start table names each dependency.
- **Engine contract is fixed** (A1 approved). Flux's additions are exactly 18.1 F1 to F7. Anything new goes to the engine owner as a gap; Flux never forks shared code.
- **Blender:** headless, with kit and bake scripts in the repo under `blender/pipeline/`, as Nox's `blender/security/` and Veyra's `blender/vault/`.
- **Workspace:** never edit, reset or restore the main checkout. Copy reference files only.
- **Process:** as Nox spec section 8:
  - targets come before building;
  - check the reference first;
  - no videos;
  - the owner approves each component;
  - performance is measured honestly;
  - commit per approved milestone.
- **Model tiering:** Opus effort goes to the 3D look (mantle colour, face, cups and pulse, world light). Routine wiring goes to cheaper models.
- **Content:** no GitHub Pipeline Engine data exists in the repo. Storyboard text is used as marked placeholders until the owner supplies real facts.

## 5. Reading the reference

- **P1, entering.** Flux swims in from the left in three-quarter view, arms trailing in a loose bundle, with a trail of bubbles. The scene contains:
  - On the right, a large round portal: a segmented blue ring on a stepped plinth around a white-blue disc with the GitHub mark.
  - A long bridge, or pipeline, leading to it with glowing violet-pink ring arches.
  - Server towers rising like ruined buildings, with small violet, blue and amber LED lights.
  - Dark rocks and a little coral in the foreground, with pink and orange specks.
  - Fish schools far off.
  - A strong light shaft from the upper right, and bubbles on the left.
  - The caption names "floating servers, pipelines and code fragments".
- **P2, intro.** Front view, centred.
  - **Head:** round, about Nox's size, glassy. Electric blue at the crown and rim, violet in the middle, glowing pink-white round the face.
  - **Face:** big violet eyes with two lashes at each outer corner, short thick raised brows, an open smile with a pink tongue, and pink blush.
  - **Arms:** blue-violet, sparkled, with glowing lavender-pink cups. T1 and T8 rise beside the head and curl outward. The middle arms reach out wide and curl down. The lower arms curl at the sides. T4 and T5 hang in the centre.
  - **No technology orbs are shown.**
  - **Interface:** a small "OCTOVERSE" above the gear-icon title "GitHub Pipeline Engine", the tagline below, and the nameplate "Flux, The Pipeline Runner". Server racks frame both sides.
- **P3, overview.** The head swells into a wide blue glass capsule holding the project panel: screenshot, title, text, Live Demo (cyan) and GitHub. The face sits at the bottom with an open smile. The arms spread in a ring. Twelve glass orbs hang at the arm ends and some mid-arm, like ornaments with small caps. The caption says "its tentacles reveal the main technologies (up to 15). Icons glow and float at the end of each tentacle."
- **P4, tech focus.** Hovering an orb makes its tentacle move toward the cursor. T8 stands tall and holds the GitHub orb high at its tip. The orb glows, Flux looks at it and opens his mouth slightly, and a tooltip lists its uses. The other orbs keep hanging.
- **P5, detail.** Flux moves to the left edge, partly cropped and still alive. A large panel holds:
  - the gear title, section navigation, "1 / 3" paging;
  - a "Pipeline Runs" table with a four-node graph (build, test, deploy, notify);
  - the overview text, Live Demo (teal-cyan) and GitHub;
  - tech chips and key feature cards.
- **DNA** (`girlfriend-reference.jpg`): a round head, big lashed eyes, a simple smile and eight flowing arms with teardrop pendants at the tips. Flux's tip-hung orbs follow the DNA directly.

## 6. Approaches

| Approach | Verdict |
|---|---|
| **A. Flux as engine data, plus four closed variants (pulse cups, `pulse` appear, `pipelineRun`, `packets`) and the `led` kit material, plus his own kit** | **Chosen.** It matches the contract's rule (data plus closed tables) and reuses the jelly, pendant, arm-lift, sand and prop-drive work Veyra and Aether build. The four variants carry his identity. Trade-off: it waits for E02 and for those reused modules. |
| B. Copy the engine or Nox into a Flux folder | Forbidden by the master plan (whole-engine duplication), and it proves nothing. Rejected. |
| C. Data only: Veyra's `bloom` and her jelly in blue, with no pulse | Cheapest, but Flux becomes a blue Veyra (an anti-goal). The owner chose the pulse motif (2026-11-03). Rejected. |

## 7. The design

### 7.1 Character geometry

- **Head:** a round dome about Nox's size (section 2.2), with soft cheek lobes at eye level, smaller than Nox's. The face sits in the lower half, so the face anchor is derived per character (contract 6.2).
- **Arms:** exactly eight, T1 to T8, with webs at the roots, as Nox's.
  - **Thickness:** a touch thicker at the root than Veyra's, tapering steadily.
  - **Tips:** open curls of half a turn to one turn, authored as pose points (contract 14.1: tip shapes are pose data).
- **Suckers:** separate oval cups along the underside, set as Aether's `suckers.style` build constraint allows (colours, glow and size are config).
  - **Rim:** a glowing lavender-pink rim.
  - **Hollow:** a deeper violet-pink hollow.
  - **Size:** shrinking toward the tip.
  - **Band:** no continuous underside band, and no frill.

### 7.2 Materials and look

Flux has his own lighting, as Nox and Veyra do. His glow, rim, cups and pulse are emitters the world never dims or tints. The world adds only the accents allowed in Nox spec 9.1: at most 10% brightening in total and at most 5% caustic shimmer on top surfaces. It never tints his face.

- **Mantle and arms:** the engine's `jelly` mode on both surfaces. Veyra builds it (her plan's Task 3): `SkinDetail.surfaces: { mantle, arms }`, each with its own `JellySettings` (`rim, rimPower, crown, crownHeight, depth, depthStrength, core, coreCenter, coreWarmth`) and `sparkle`, with no hue constant in the shader (contract F6, A6). Aether is the first to set the arms surface to jelly; Flux is the second.
  - **Mantle `JellySettings`** (start values; tuned to section 2.1):
    - `crown`: electric blue, about `#3044ef`;
    - `depth`: violet, about `#9c57ef`, the middle of the head facing the camera;
    - `rim`: bright blue, about `#3d74e9`;
    - `core`: pink-white, about `#feabcf`, with `coreCenter` just below the mouth and a high `coreWarmth`, so the glow fills the lower face and washes the chin pink-violet (the chin target, 214, 125, 243).
  - **Arms `JellySettings`:**
    - `rim`: blue, about `#6d7df6` (the top highlight, 109, 125, 246);
    - `depth`: blue, about `#374af1` (arm body, 55, 74, 241);
    - `core`: violet-pink, about `#c070f0`, the underside and root wash.
  - There is no core-width field. "Lower and wider than Veyra's" is reached through `coreCenter` and `coreWarmth`. If the chin and face-glow targets cannot both be met that way, it goes to the engine owner as a gap, with the numbers, not as a fork.
- **Sparkles:** `skin.sparkle` on both surfaces: fine white-cyan specks, denser than Veyra's, twinkling faster (each fades in and out over 1.5 to 3 s, out of phase).
- **Wet highlight:** one soft broad specular, upper-left on the crown.
- **Cups and pulse:** see 7.5.
- **Halo and aura:** a soft blue glow round the silhouette, turning violet below the arms. The aura in the water is deep blue near him (the aura target, 0, 24, 80).
- **Local grade:** the water within about 3 units of him is darker and bluer than the lit water near the shaft, so his rim reads against it.
- **Glow light** (`glow.light`): violet-pink, about `#d070ff`, lighting the floor and nearby racks softly.
- **Dome (overview):** a wide blue glass capsule with a bright electric-blue rim, a soft inner sheen, and a faint gradient to deeper navy at the bottom (P3).

### 7.3 Face

The same parametric face canvas, with Flux's layout and palette:
- **Eyes:** large and round. The irises are navy-black at the top, turning violet-lavender at the bottom, with a black pupil and two white catchlights. The sclera is white with a faint lavender edge.
- **Lashes:** a dark lash line, plus two short lashes at each outer corner (`EyeLayout.lashes`).
- **Brows:** short, thick, dark navy arcs, set high (`FaceLayout.brow.thickness`).
- **Mouth:** a wide open "D" smile with a dark rim and a pink tongue. Closed, it is a wide upturned line.
- **Blush:** pink ovals under the outer eye corners, stronger than Veyra's.
- **Expressions** (overrides per contract A1 G1, existing ids only):
  - **intro:** a big open smile (P2), the default greeting;
  - **overview:** an open smile;
  - **tech focus ("eager"):** eyes slightly wider, brows up, mouth a little open (P4: "opens its mouth slightly"). This is the `armLift` expression (F5);
  - **detail:** an attentive smile;
  - **restful:** the closed wide smile.

### 7.4 Poses

Each stage pose belongs to Flux: arm curves, body position, scale and yaw, and expression. The engine's pose blender moves between them.
- **Entrance:** three-quarter side view, arms streaming behind in a loose bundle (P1).
- **Intro:** traced from P2.
  - T1 and T8 rise beside the head and curl outward above head height.
  - T2 and T7 reach out wide at shoulder height and curl down.
  - T3 and T6 curl out lower at the sides.
  - T4 and T5 hang in the centre and curl at the tips.
- **Overview:** traced from P3. The arms spread wider into a ring around the dome, so the orbs hang clear of it. The face sits at the dome's bottom.
- **Tech focus:** as the overview, with the chosen arm lifted (P4: T8 straight up, its orb held high at the tip).
- **Detail:** traced from P5. Flux at the left edge, smaller, three-quarter facing right toward the panel.

### 7.5 Technology orbs and the pulse

**The pulse** (`suckers.pulse`, contract F1):
- **Look:** a band of light travels along an arm's cup row, root to tip. The leading cups flash electric cyan, the middle ones lavender, and the tail fades pink. Section 2.4 sets its speed, width and brightness.
- **Config:** `{ speed, wavelength, strength, colours: [cyan, lavender, pink] }`.
- **Trigger:** each arm has a one-shot trigger, fired by the appear and select modules, by sequences and by the idle flourish.
- **Idle:** one random arm fires every 6 to 10 s (`personality.flourishRate`, contract G4). Never two at once at rest.

**Look of the orbs.** Each technology is a glass orb with the shared orb glass and logo. `artifacts.orbStyle` (contract A11) gives a small violet-pink cap where the orb meets the arm and no rim beads.

**Placement:** `pendant` (built by Veyra), with Flux's data:
- **Tether:** length 0. The orb hangs straight off its cap, so it "floats at the end of the tentacle" (P3).
- **Slots:** tip slots on all eight arms, plus mid-arm slots on T1, T2, T7 and T8: 12 shown, as P3. Arms with two slots carry one at the tip and one about 55% along. The 16-slot maximum and tray overflow are unchanged.
- **Order:** the project's technology order, most important at the top arms.
- **Sizes:** the overview orb radius is 0.28 ± 0.03 units, larger than Veyra's (P3). The intro size is 0 (see "Stages").
- **Swing:** the shared pendant swing, with Flux's constants: a quicker period, at most 18 degrees from vertical, settling in about 0.8 s. It is livelier than Veyra's but tighter, because there is no thread.

**Appearing:** `appear: { kind: 'pulse' }` (contract F2). It runs on the shared trigger, after the entrance settles:
1. Arms fire in pipeline order, two at a time in four steps: T1 and T8, then T2 and T7, T3 and T6, T4 and T5. The steps are about 180 ms apart.
2. A pulse runs root to tip.
3. Where it arrives, the orb grows at its slot (reusing `bloom`'s grow) to the current stage size.

In the intro the stage size is 0, so the visitor sees the four pulse waves run out along the arms ("tentacles slowly spread out… with a beautiful glow", P2) and no orbs.

**Revealing (the head opens):** as the swell opens, the pendant placement grows each orb from 0 to its overview size at its slot. It reads the placement's per-frame swell input (contract 9.2), which carries progress, not time:
- **Stagger:** a swell-range offset per slot. Orb *i* (tip slots first, in slot order) grows over swell 0.35 + 0.03·*i* to 0.65 + 0.03·*i*, clamped to 1.
- **Hidden at size 0:** in the intro the orbs have size 0 and `choosableIn` excludes the intro. Per contract A3, no button, tray entry or keyboard stop exists there.

The `pipelineRun` effect (7.6) runs at the same time.

**Choosing an orb:** `select: { kind: 'armLift', liftMs: 300, overshoot: 0.12, expression: 'eager' }` (contract F5). Hover, keyboard focus or tap:
1. The owning arm snaps its orb up toward the pointer, or up and forward with keyboard or touch. The motion is about 300 ms with a small overshoot and settle. The root moves first and the tip last.
2. A pulse fires along that arm, root to tip.
3. The orb grows 1.25x and glows brighter.
4. Flux looks at it with the "eager" face.
5. The tooltip shows how the technology is used (P4).
6. The other orbs dim slightly and keep their sway.
7. Releasing, or choosing another orb, drops it back with a small bounce.

Only one orb is chosen at a time. Every orb has a real HTML button that follows it. On a phone, the approved tray stays, and choosing from the tray plays the same lift.

**Stages:**
- **Entrance:** none.
- **Intro:** pulses only. No orbs, and nothing to choose (`choosableIn: ['overview']`, contract A3).
- **Overview:** orbs revealed on their slots and choosable.
- **Tech focus:** the chosen orb lifted.
- **Detail:** hidden, shown as chips.

### 7.6 Head swell: `pipelineRun`

The swell keeps the shared mechanics: anticipation (a small squeeze), a swell with overshoot, then a settle. Flux's effect sits inside the dome (contract F3; it receives only swell progress and the dome frame). It echoes P5's four-node graph:

| Swell progress | What happens |
|---|---|
| 0 to 0.3 | Four small rings of light appear in a gentle arc across the dome's lower half, joined by a thin dim line. |
| 0.3 to 0.75 | A bright bead travels the line left to right. Each node it reaches fills: cyan, then lavender, then pink, then cyan, with a small flash. |
| 0.75 to 1.0 | The last node flashes, and a soft ring ripple spreads across the dome. The nodes and line fade as the project panel fades in. |

Closing reverses it quickly, over about half the time: the nodes empty and fade. The node and line colours come from the palette, not literals.

### 7.7 The pipeline world: "Pipeline Deep"

Built like Nox's and Veyra's worlds: a real 3D kit near Flux, a painted far plate behind, baked light on still surfaces, and live elements in front.

**Kit** (`blender/pipeline/`, headless):
- **Server towers:** tall stacks of rack modules, some leaning or broken, like ruined buildings turned reef. Barnacle and coral growth softens the edges. Their face plates carry LED strips on the `led` kit material (contract F4b), with a per-vertex blink phase baked by the script:
  - mostly blue and cyan;
  - some violet;
  - a few amber (the only warm accents with the coral specks).
- **GitHub portal:**
  - a large ring gate on a stepped stone plinth, made of four segmented ring arcs;
  - a white-blue glowing disc with the GitHub mark, which is the project's own integration mark (P1);
  - each ring arc is a separate kit node, so it can be lit on its own (`place.props`, drive `'emissive'`).
- **Pipeline bridge:** a long walkway-pipe on piers, from the left distance toward the portal. Glowing violet-pink ring arches stand along it (P1).
- **Rocks and coral:** dark seabed rocks for the foreground, with small coral clumps flecked pink and orange.

**Layout** (data):
- **Portal:** right and slightly back, as in P1. In the intro it stays dim behind him, off to the right, partly hidden by the right-hand racks.
- **Towers:** frame both sides, as in P2.
- **Bridge:** runs from the left distance to the portal, behind the stage spot.
- **Foreground:** dark rocks.
- **Packet path:** the bridge path is a named spline in the layout (for `packets`).

**Light:**
- **Surface:** cool blue shafts from the upper right, with rays and caustics. The one moving shadow, Flux's, falls on the floor.
- **Portal:** white-blue spill on the plinth and nearby racks (baked).
- **LEDs:** faint coloured spill on the rack faces (baked). The blink itself is emissive only.
- **Bridge rings:** violet-pink spill on the bridge deck (baked).
- **Flux:** his violet-pink glow light lights the floor below him.
- **No red light anywhere.** Amber appears only as small LEDs and coral specks.

**Water:** deep navy fog, brighter blue toward the shaft, near-black at the bottom corners.

**Floor:** `'sand'`, the shared variant (contract A15): dark rock and blue-grey sand, coloured from Flux's palette. Flux's floor task adds it if Aether has not; otherwise it reuses it.

**Live elements:**
- **`packets`** (contract F4a): small elongated light pulses in cyan and lavender travelling along the bridge spline toward the portal. Instanced; at most 12 at once.
- **Bubbles:** glowing blue-violet bubbles rising, separate from orbs; denser on the left, as in P1.
- **Fish:** small dark schools crossing far off (the shared fish element and silhouette).
- **Code glyphs:** at most 10 faint glyph cards (`{ }`, `</>`, `>_`), drifting slowly in the middle distance, dim (the shared motes element with a glyph sprite set, if motes take sprites as data; otherwise dropped, see section 12).
- **Kit emissives:** the LED blink, and the portal disc's slow breathing.

**Relic intensity:** the portal is the strongest world light and must never compete with Flux. Its brightest pixel stays below his face glow's brightness in the intro, and the LEDs stay below the cup glow.

**Camera:**
- **Framing:** his own per stage, with the intro framed so the title sits above him and the nameplate below (P2).
- **Hover:** the shared camera hover, with `camera.hover: { amount: Nox's, pace: 1.2 }` (contract G3), slightly livelier than Nox's. It runs full in the intro, half in the overview, holds still while an orb is chosen, and is off in detail.
- **Tilt:** a slight upward lean, about Nox's.

### 7.8 Motion personality: the eager runner

These values are starting points, tuned live with the owner:

| Setting | Nox | Veyra | Flux (start) | Why |
|---|---|---|---|---|
| Blink interval (s) | 2.6 to 7.0 | 3.5 to 8.5 | 2.0 to 5.0 | bright, awake |
| Double blink chance | 0.2 | 0.12 | 0.3 | playful |
| Gaze response | 16 | 10 | 22 | quick attention |
| Head turn | 3.2 | 2.4 | 4.2 | snappy |
| Sway | 0.5 | 0.4 | 0.6 | lively arms |
| Curl | 1.1 | 1.4 | 0.9 | open curls |
| Float amplitude / period | 0.045 / 6.2 s | 0.06 / 7.5 s | 0.05 / 4.8 s | bouncy |
| Breath period | 4.6 s | 5.4 s | 3.6 s | quicker |
| Stroke: recovery / power / glide | 0.52 / 0.21 / 0.6 s | 0.65 / 0.26 / 1.0 s | 0.38 / 0.16 / 0.32 s | many short strokes |
| Settle overshoot | as approved | 60% of Nox's | 140% of Nox's | springy arrivals |
| Flourish rate | 0 | Veyra's | 10 per minute | the idle pulse and tip flick |

**Character moments:**
- **Idle pulse:** three idle flourishes in four are a pulse (section 7.5). That gives 7.5 pulses a minute, one every 8 s on average, inside section 2.4's 6 to 10 s.
- **Tip flick:** the fourth flourish is a quick curl and uncurl of one arm tip instead of a pulse.
- **Happy bounce on arrival:** a quick vertical bob with the arms flicking out, bigger than Nox's wiggle.

### 7.9 The entrance

| Time | Beat |
|---|---|
| 0 to 0.5 s | He bursts in from the left edge, already moving, trailing bubbles. |
| 0.5 to 3.0 s | Five quick strokes with short glides along the bridge, toward the visitor and the portal. Packets race along the bridge beside him. |
| ~2.2 to 3.0 s | As he passes, the portal's four ring arcs light one by one, about 150 ms apart, like a pipeline run going green, and the disc flashes once. These are prop drives on `'emissive'` (`SequenceSet.kitDrives`). |
| 3.0 to 3.6 s | He overshoots his stage spot a little, brakes with the arms flared forward, and springs back. |
| 3.6 to 4.2 s | A quick turn to face the visitor, about 180 degrees (`EntranceShape.turn = pi`, non-spiral path built with Veyra), with a happy bounce. |
| 4.2 to 5.0 s | Settle: the arms pop open into the intro pose with T1 and T8 up. He looks at the visitor, blinks and lands on the big open smile. Then the pulse appear runs (7.5). |

The path stays clear of the towers, bridge piers and portal with arms open or closed (a unit test checks the clearance against Flux's layout). The rules match Nox's:
- skippable at any moment;
- plays once per browser session (`octoverse.flux.entranceSeen`);
- with reduced motion he is simply present in the intro pose, and the portal is lit.

The title and nameplate appear as he settles. The entrance is a Theatre.js sheet owned by the Flux world.

### 7.10 Stages and content

The stage set is shared: entrance, intro, overview (head swell), tech focus (arm lift) and detail. Transitions and priorities follow Nox. The interface layer (title, nameplate, overview panel, tooltip, detail view, skip control) is the shared HTML, themed per world.

**Content:** a Flux content file with:
- name and epithet ("Flux", "The Pipeline Runner");
- project "GitHub Pipeline Engine", tagline "A self-hosted CI/CD platform for multiple projects with flexible workflows and runners.";
- the overview text from P3 and P5;
- links (Live Demo, GitHub), and screenshots;
- technologies (12, from P3 and P5): GitHub Actions, TypeScript, Node.js, Redis, Docker, Linux, AWS, MongoDB, Express, GitHub API, Bash, Git. P3's unlabelled bar-chart and workflow icons stay unassigned until the owner names them;
- usage notes (P4's GitHub Actions list as the model);
- detail sections: Overview, Features, Tech Stack, Architecture, Challenges, What I Learned (P5);
- key features: Webhook Integration, Workflow Engine, Multiple Runners, DAG Execution (P5).

Storyboard text is used as clearly marked placeholders. The owner supplies real facts and links before launch.

**Theme tokens** (sampled from the P3 and P5 native panels at G01 start; starting values below):
- **Accent:** electric cyan-sky, about `#4aa6d0`, with a cyan-to-teal gradient for Live Demo (P3 about `#4aa6d0`, P5 about `#25ada8`).
- **Panels:** deep navy surfaces, about `#031e3b`.
- **Focus ring:** electric cyan.
- **Icon:** a gear beside the title.
- **Title:** a small letter-spaced "OCTOVERSE" above it.

### 7.11 Responsive and accessibility

As Nox and Veyra:
- **Desktop and tablet:** the storyboard composition.
- **Phone:** Flux in the upper screen, orbs in the tray, panels as bottom sheets.
- **Every size:** 44 px targets, a full keyboard path and a skip link.
- **No WebGL:** a poster of the intro.
- **Reduced motion:**
  - no float, drift or swim;
  - no idle pulses;
  - the appear shows the cups lit for 300 ms, then still;
  - orbs are shown still;
  - `pipelineRun` becomes a crossfade;
  - the LED blink and packets are slowed to near-still.

### 7.12 Performance plan

The budget is section 2.5. The levers are the same quality tiers as Nox (render scale, particles, rays, shadow map, far plate size, bloom resolution). In addition:
- **Pulse:** one term in the sucker shader, with an 8-float trigger-time uniform. No extra pass, no per-frame allocation.
- **LEDs:** emissive kit material with a baked per-vertex phase. No extra draw calls beyond the kit's own.
- **Packets:** one instanced mesh, at most 12.
- **Glyph cards:** part of the motes batch, at most 10, off at tier low.
- **Orbs:** shared material; logo textures through the existing cache.

## 8. What Flux needs from the engine

All of it is in the final contract. Flux builds the first four in G01. The rest is built by Veyra or Aether and reused.

| Need | Contract | Built by |
|---|---|---|
| `suckers.pulse` and the per-arm pulse trigger | 18.1 F1 | Flux (G01) |
| `APPEARS.pulse` (reuses `bloom`'s grow) | 18.1 F2 | Flux (G02) |
| `HEAD_EFFECTS.pipelineRun` | 18.1 F3 | Flux (G02) |
| `packets` live element on layout splines | 18.1 F4a | Flux (G01) |
| `KIT_MATERIAL_VARIANTS.led` | 18.1 F4b | Flux (G01), in the table Aether's `membrane` also uses |
| `jelly` mode with hue-free stops, per-surface `JellySettings` (mantle and arms); `sparkle` per surface | F6, A6 | Veyra (F01, her Task 3); Aether first uses the arms surface |
| `suckers.style` config | A7 | Veyra (F01) / Aether |
| `pendant` placement, tether length 0, sizes, swell input | 9.2, F7 | Veyra (F01); Aether's pure-function export rule |
| `armLift` select with `{ liftMs, overshoot, expression }` | F5 | Veyra (F02) |
| `bloom`'s grow, reused by `pulse` | 9.2 | Veyra (F02) |
| `choosableIn` | A3 | E02 |
| `orbStyle` (cap) | A11 | Aether (H01) |
| Expression overrides | A1 G1 | E02 |
| `EntranceShape` non-spiral turn | A1 G2 | Veyra (F02) |
| `camera.hover.pace` | A1 G3 | E02 |
| Flourish layer (`flourishRate`) | A1 G4 | Veyra (F02) |
| `place.props`, `kitDrives`, `'emissive'` drive | 6.4 | Veyra (F01/F02) |
| Generalised layout, open light and relic kinds | 6.4, 14.1 | Veyra (F01) |
| Floor `'sand'` | A15 | First of Flux or Aether |
| Fish live element | 7 | Veyra (F01); silhouette data from Aether |

The one item not settled by the contract is the code-glyph sprites (7.7). It is optional and is dropped rather than raised as a gap unless motes already take a sprite set as data.

## 9. Verification

- **Unit tests (Vitest):**
  - config validation and clamping for Flux's character and world;
  - pulse timing (travel time, cups lit at once, no two idle pulses together);
  - pulse appear order (four pairs, spacing);
  - pendant slot assignment for Flux's 12 slots, and overflow to the tray;
  - intro size 0 and swell reveal;
  - swing bounds;
  - orbs clear of the face, title and nameplate in each pose;
  - entrance path clearance against Flux's layout;
  - `pipelineRun` phase timing;
  - world switch resets state, including pulse triggers;
  - LED phase present in the kit glTF.
- **Look checks:**
  - `check_stage.py --world-id flux` on frozen frames at P2's camera, for the section 2.1 targets;
  - side-by-side stills against P1 to P5 at the same size;
  - the close-up list in section 2.3 at 3x zoom;
  - the orbit view for the back;
  - pulse stills at fixed times (`?t=` with `?freeze`) for section 2.4's brightness check.
- **Motion checks without video:** stills at chosen times, numeric traces from tests, and the owner's live check with three to six things to look at per item.
- **Performance:** `scripts/perf.mjs` with `?world=flux`, back to back, browser pane closed, against section 2.5. Nox's and Veyra's numbers are re-run in the same session.
- **Three-world regression:** Nox's and Veyra's look checks and tests pass unchanged after every Flux milestone that touches the engine.

## 10. Delivery order

Each milestone ends with the owner's live review, then a commit. G01 covers milestones 1 to 4; G02 covers 5 to 8.

1. **Flux on the P2 stage (gate):**
   - the character, geometry, jelly colours, face, cups, P2 pose and the pulse shader (fired manually for review);
   - colour, shape, close-up and pulse-brightness targets met;
   - the owner approves P2 before anything else (G01: "P2 first").
2. **The pipeline world:**
   - kit, LEDs, bake, far plate, packets, light, floor and camera;
   - Flux's look still meeting the P2 targets in the world;
   - the frame-rate budget met.
3. **Static P3, P4 and P5:** overview pose with the dome and 12 orbs, the tech-focus pose, the detail composition, and responsive variants.
4. **Back view:** orbit review.
5. **Motion personality and the entrance**, with the portal lighting in sequence.
6. **Orbs live:** pulse appear, swell reveal, swing, arm lift, tooltip, buttons and tray.
7. **Head swell with `pipelineRun`.**
8. **Pass across all stages:** responsive, phone, reduced motion, accessibility, performance and the three-world regression report.

### 10.1 Starting conditions and fallbacks

- **Start point:** the plan is written against the final engine contract and the E02 plan's names. Each Flux milestone starts only when the Veyra and Aether tasks that build what it reuses have landed. The plan's start table names them. Milestone 1 waits on E02 and on Veyra's jelly surfaces, sparkle, cup style and expression overrides.
- **Missing dependencies:** if something Flux reuses has not landed, Flux waits for it. Flux never builds another world's variant early, and never forks one. The one exception is the shared `'sand'` floor: by contract A15 the first of Flux or Aether to need it adds it.
- **Milestone 1 backdrop:** before the world exists, Flux is checked on a graded stage backdrop fitted to P2's water samples (upper and mid water), with his aura and local grade on. All section 2.1 samples are checked there, then again in the world at milestone 2, and the world must keep them.
- **Missing the frame-rate floor:** if a budget in section 2.5 is missed, the quality levers are cut in this order, at tier low only:
  1. fish;
  2. glyph cards;
  3. light rays;
  4. ambient bubbles;
  5. packet count (never below 4);
  6. far-plate size;
  7. sparkle count (never below section 2.3's minimum).

  Flux's own look (face, rim, cups, pulse, glow) is never cut. If the floor is still missed, the numbers go to the owner before anything else changes.
- **Reference resolution:** colour samples come from the native P2 crop at delta E 10. The close-up items in section 2.3 are judged by the owner against the 3x panels. The regenerated panels inform form only.
- **Entry point:** `?world=flux` is the only entry until the landing page phase. Flux gets his own no-WebGL poster of the intro.
- **Placeholder images:** the project screenshot and carousel use crops of the storyboard's own screens (P3, P5), clearly marked as placeholders until the owner supplies real screenshots.

## 11. Left to the builder

- The exact pulse shader maths and colours within section 2.4.
- The pendant swing constants within the bounds in 7.5.
- Kit modelling details, LED layout, lightmap resolution, compression and level-of-detail distances.
- Exact pose traces, slot positions and sequence timings within the ranges, tuned live.
- File structure inside the Flux world folder.
- Tests beyond section 9.

## 12. Calls I made (for the owner to check)

1. **No orbs in the intro.** The intro follows P2: the pulse waves run out along the arms, the orbs grow when the head opens (P3: "its tentacles reveal the main technologies"), and they are choosable from the overview on (as Aether). Nox and Veyra show theirs in the intro; Flux follows his reference. If you'd rather Flux show orbs in the intro, it is a one-line data change (intro size and `choosableIn`).
2. **The pulse colours are cyan, lavender and pink** along the wave, from his own palette, not a single colour.
3. **Orbs hang with no thread** (tether length 0, a small cap only). They are bigger than Veyra's, with a tighter swing.
4. **The appear fires the arms in pairs**, four "pipeline stages" from the top arms down, about 180 ms apart.
5. **The world, entrance and motion** in 7.7 to 7.9 are my proposals:
   - the server-city kit, the portal lighting in sequence as he passes, and the overshoot-and-spring-back arrival;
   - the quick 180-degree turn rather than Nox's spiral spin;
   - the personality table.
6. **Code glyphs:** at most 10, faint and far, and only if motes already take sprites. Otherwise they are dropped rather than becoming an engine gap.
7. **Colour tolerance is delta E 10**, as Veyra's, because the reference is a composite panel.
8. **The frame-rate floor is 40 fps** at tier low for the intro. The fallback order is in 10.1, and Flux's own look is never cut.
9. **Content** uses storyboard text as marked placeholders. Two unlabelled P3 icons stay unassigned until you name them.
10. **The GitHub mark on the portal** is kept, as in P1, as the project's integration mark.
11. **The pulse is mostly a hue shift** (pink to cyan to lavender), measured after bloom (2.4), because the resting cups are already near full brightness.
12. **The idle rate is 10 flourishes a minute**, three in four of them pulses, so a pulse runs about every 8 s.
13. **The orb reveal is staggered by swell progress**, not by time (7.5).
14. **Flux waits for missing dependencies** and never builds another world's variant early, except the shared `'sand'` floor (10.1).
15. **Arms get their own jelly stops** on Veyra's per-surface `JellySettings`, with no core-width field. Any target that this cannot meet goes to the engine owner (7.2).
