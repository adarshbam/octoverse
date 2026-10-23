# Nox in 3D: Full Experience Design

Date: 2026-10-23
Branch base: `spike/nox-3d-panel2` (commit `58cf458`)
References: `docs/design/references/Nox.jpeg` (five panels), `docs/design/references/Security-labs-original.png`, `instructuions/instruction.md` (master specification)

## 1. Intent

OctoVerse turns a developer's projects into living underwater worlds, each hosted by an expressive octopus. Nox, the crimson-violet host of the Security Lab project, is the first world and the proof that the whole product can work.

The earlier SVG implementation failed on the thing that matters most. Each tentacle was a frozen, hand-traced shape that rotated by about one degree as a rigid piece, so the creature never felt alive. The heavy review process spent most of the effort on evidence rather than on the octopus.

A throwaway 3D spike (2026-10-23) settled the approach. Nox is built entirely in code with Three.js. It matches storyboard panel 2 closely and moves like a creature: arms bend along their whole length, the eyes blink and follow the cursor, and the nearest arm reaches toward the pointer. The project owner reviewed the result and approved committing to 3D.

This build turns the spike into the complete five-panel Nox experience. It is structured so that later characters (Veyra, Flux, Aether and creator octopuses) come from configuration, not new code.

Evidence: `assets/2026-10-23-nox-3d/first-spike.png` (first attempt), `assets/2026-10-23-nox-3d/panel2-match.png` (tuned rest pose beside panel 2) and `assets/2026-10-23-nox-3d/motion-frames.png` (idle drift, blink, cursor reach, smile).

## 2. Goals

1. **Nox looks like Nox at every stage.** Each of the five storyboard panels is matched perceptually: same character, palette, composition and glow. Pixel identity with an AI painting is not the target.
2. **Nox feels alive.** Continuous organic motion, with attention that responds to the visitor and expressions tied to meaningful events. It never looks like a static image sliding around.
3. **The five-stage journey is complete:** entrance, introduction, project overview inside the head, technology interaction and full project view.
4. **It works as a portfolio.** Project information, links and the screenshot are reachable quickly by mouse, touch and keyboard, and every animation can be skipped.
5. **It is smooth:** 60 fps on a typical laptop and at least 30 fps on a mid-range phone.
6. **The engine boundary is real.** Palette, head shape, eyes, arm poses, personality and world are data. A second octopus should need a new configuration file and new plates, not new rendering code.

## 3. Non-goals for this build

- Other worlds (Veyra, Flux, Aether), the OctoVerse landing page, explore page, customizer, accounts, publishing and billing. These are later phases that reuse this engine.
- Sound.
- Matching the painted brush texture of the references.
- A full physics simulation of the water or tentacles.

## 4. Anti-goals

- Tentacles that move as rigid pieces, or motion that loops visibly.
- Tentacle count tied to technology count. Nox always has exactly eight arms, T1 to T8.
- A generic SaaS page with a mascot pasted on.
- Animations that block or delay reaching project information.
- Review ceremony that costs more than the work: hash-frozen evidence bundles, per-pixel approval records, or multi-agent routing for every change.

## 5. Constraints

- **Stack:** React 19, TypeScript, Vite, Three.js r186 through `@react-three/fiber` 9 and `@react-three/postprocessing` 3. HTML/CSS for all text and controls. The project owner approved replacing SVG with WebGL on 2026-10-23.
- **Colour pipeline:** no tone-mapping pass. Calibration (`calib.html`) showed the Neutral tone mapper crushing dark channels. Without it the chain is colour-exact, and bloom handles the highlights.
- **Workspace:** the main checkout (`codex/nox-storyboard`) holds a dirty tree with the old SVG work and 28 legacy deletions. It must not be reset, restored or edited by this build. All work happens in the `worktrees.local/nox-3d-spike` worktree on a new branch. Content files are copied from the main checkout, never moved.
- **Painted plates need image generation.** The OpenAI key is set, but the account has no credits (`credit_balance_exhausted` on 2026-10-23). Until credits are added, plates are inpainted from the reference panels locally, or supplied by the owner from ChatGPT.
- **Content:** `src/data/nox.ts`, `noxProject.ts`, `noxTechnologies.ts`, `projectTypes.ts`, `validateProject.ts` and `public/images/projects/*.webp` exist only as uncommitted files in the main checkout. They hold the name, epithet, tagline, introduction, two links, the screenshot and 15 technologies. There are no per-technology usage notes and no detail sections yet.

## 6. Approaches considered

| Approach | Verdict |
|---|---|
| **2D procedural rig** (keep SVG or Canvas, rebuild arms as bending chains) | Motion would be fixed, but the references are glossy, translucent, rim-lit and glowing. In 2D that look is faked with gradients and goes flat as soon as an arm bends. The old SVG output showed this ceiling. Rejected. |
| **Procedural 3D in Three.js** | **Chosen.** No 3D artist or model files: every shape is generated from parameters. The spike matched panel 2 by measurement (section 7) and showed lighting following every bend. Risks: cuteness of the face and phone performance, both handled below. |
| **Rive** (skeletal 2D animation tool) | Excellent results for mascots, but it needs a human animator working in Rive's editor. Neither the owner nor Claude can author it. Rejected. |
| **Pre-rendered video or sprites** | Perfect look, but it cannot react to the cursor, hold technology orbs or change colours per creator. Rejected. |

## 7. What the spike established (carried forward as decisions)

- **Units:** 1 world unit = 100 panel pixels. The origin is the centre of a 506 x 504 storyboard panel, +y is up, and the camera frames 5.04 units vertically (perspective, fov about 24 degrees, camera z = 12).
- **Tentacles:** each arm is a forward-kinematic chain of 64 segments, built from a Catmull-Rom rest curve traced from the panel.
  - **Each frame:** small joint rotations accumulate from root to tip: travelling waves, a zero-mean tip curl, and a trail against the body's vertical velocity. A tapered 18-sided tube is then rebuilt around the chain.
  - **Sucker side:** set by which way the tip curls.
  - **Reach:** cyclic coordinate descent over the outer 70% of the chain lets an arm reach for a target, blended in and out with a critically damped spring.
- **Mantle:** a lathe of a silhouette fitted to the reference rim line. The dome is a circle (radius 0.778, centre y -0.508, top 0.27) and the lower half a superellipse (power 2.6). Silhouette widths match the reference within about 0.01 units.
- **Skin shader:**
  - **Head:** coloured from a glow ramp sampled down the reference centre line, plus a lower-cheek magenta tint, a thin bright rim and a soft crown sheen.
  - **Arms:** lit from above (dark violet to lit violet), with root colour taken from the same glow ramp so the face glow flows into them, a red sucker-side band, and bright top-edge rims.
  - **Accuracy:** head sample points match the reference within about 16 RGB.
- **Suckers:** instanced glowing beads with jittered size, spaced along the sucker side.
- **Face:** drawn in 2D on a 1024 px canvas texture and projected onto the mantle front.
  - **Eyes:** tall ovals with the iris toward the nose (a pale crescent on the outer side), a dark red iris with a warm pool at the bottom, two catchlights and a heavy upper lid with two lashes.
  - **Blinking:** clips the eye, so the lit 3D skin shows through.
  - **Brows, mouth and blush** are part of the same canvas.
- **World:** a painted plate on a plane behind Nox, feathered into a gradient beyond the square stage. Live bubbles, embers and a slow light shimmer sit in front. Bloom: threshold 0.66, intensity 1.05, mipmap blur. Light vignette.
- **Tooling:**
  - **URL modes:** `?freeze` (rest pose, no motion) and `?mask` (white silhouette).
  - **Capture and compare:** `compare.html` (live side-by-side), `scripts/spike-capture.mjs` and `spike-frames.mjs` (Playwright on Edge).
  - **Measurement:** `scripts/compare.py`, `profile.py`, `silhouette.py`, `zoom.py` and `ref_grid.py`.
  - **Plate inputs:** `plate_inputs.py` and `inpaint_plate.py` (local), plus `gen-plate.mjs` (OpenAI image edit).

## 8. The design

### 8.1 Structure

The spike is promoted from `src/spike/` into a real module tree. The spike stays in place as a reference until the new build reaches parity, then it is deleted.

```
src/nox3d/
  config/        CharacterConfig, WorldConfig, nox.character.ts, nox.world.ts
  character/     Octopus (R3F component), ArmRig, mantle geometry, skin and sucker shaders, FaceCanvas
  poses/         authored rest poses per stage (arm curves, body transform, face expression)
  behavior/      stage state machine, ambient motion layers, attention (gaze), pose blender
  artifacts/     TechOrb (glass orb with logo), orb slots attached to arms
  world/         plate layers, particles, bubbles, shimmer, glyph pulse, plate crossfade
  stage/         camera framing per breakpoint, quality tiers, screen-space anchors for HTML
  ui/            title block, nameplate, overview panel, tech tooltip, project detail view, skip control
  content/       copied Nox project data and validation, plus new usage notes and sections
  App.tsx        entry; index.html points here
```

The old SVG components on this branch are left untouched and unimported. Deleting them is a separate decision, made when the branches are merged.

### 8.2 Character configuration

`CharacterConfig` holds everything that makes Nox Nox. The renderer reads only this, never hard-coded colours:

- **Palette:** glow ramp stops, cheek tint, arm shadow/mid/lit colours, rim colours, sucker colours, iris gradient, sclera, blush.
- **Head:** superellipse parameters, depth, glow-field shape.
- **Face layout:** eye centres and size, brow, mouth and blush positions, lash style.
- **Arms:** count fixed at 8, with per-arm root radius, taper and depth (rear, middle or front).
- **Personality:** blink interval range, gaze response speed, sway amplitude, curl amplitude, float period and amplitude, reaction delay. Nox's personality is "observant": slower sway, quick attentive gaze.

`nox.character.ts` contains the measured spike values. Validation clamps every number to a safe range, so no combination can produce a broken creature.

### 8.3 Stages and behaviour

Stage state machine: `entering`, then `intro`, which leads to `overview`, then `techFocus(id)`, then `detail`.

- **Transitions:** `overview` and `detail` can both return to `intro`. Leaving `detail` returns to `overview` without replaying the entrance.
- **Ambient layers** run in every stage, scaled per stage: breathing, buoyant float, arm drift, blinking and attention.
- **Priority** follows the specification (section 72): stage transition, then explicit selection, then hover or focus, then idle, then rest.

Each stage has an authored pose: arm rest curves, body position, scale and yaw, and a face expression. Changing stage blends from the current pose to the target pose:

- **Arms:** interpolate their joint angle arrays, per arm, with a slight stagger.
- **Body:** springs to its new transform.
- **Face:** expression parameters ease over 250 to 500 ms.

Ambient motion keeps running on top of the blend, so a transition never looks like a cut.

| Stage | Reference | What happens |
|---|---|---|
| Entering | Panel 1 | Nox swims in from the left in a three-quarter side view toward a glowing shield gate. The mantle pulses in a jet rhythm; the arms are bundled and trail behind, flaring on each pulse. It slows and turns to face the visitor, about 2.5 s in all. Skippable by click, key or the skip control. It plays once per browser session. Reduced motion: Nox is simply present in the intro pose. |
| Intro | Panel 2 (matched) | The rest pose from the spike. Title block above, nameplate below. Gentle smile; eyes follow the pointer; idle glances when the pointer is still. |
| Overview | Panel 3 | Opened by clicking Nox or the "Explore" control, or pressing Enter on it.<br>**Head:** the mantle widens into a translucent glass dome, and the HTML project panel (screenshot, title, short text, View Project, GitHub) appears inside the dome's projected rectangle. The face moves to the bottom of the dome with a happy open smile.<br>**Arms:** they spread to the panel 3 pose, and the technology orbs appear on their slots. |
| Tech focus | Panel 4 | Triggered by hovering, focusing or tapping an orb.<br>**Nox's reaction:** the orb's arm reaches toward the pointer (or lifts the orb when using keyboard or touch), the orb grows and glows, and Nox looks at it with a focused expression (narrowed lids, angled brows, small grin).<br>**Tooltip:** shows how that technology was used in this project.<br>**Everything else:** the other orbs dim slightly and the other arms keep only ambient motion.<br>Only one technology is active at a time. |
| Detail | Panel 5 | Opened by View Project. Nox moves to the left edge, smaller and partly cropped, still idling and glancing at the panel. A large panel on the right holds the section navigation, the screenshot carousel (1/3), the overview text, Live Demo and GitHub, technology chips and key feature cards. Closing returns to the overview. |

### 8.4 Expressions

The face canvas is parametric: upper and lower lid, brow height and angle, mouth curve, mouth opening, blush strength, and iris offset from gaze. These presets are authored against the panels:

- **Gentle smile:** intro.
- **Happy open smile:** overview.
- **Focused grin:** tech focus.
- **Attentive:** detail.
- **Restful (heavy lids):** after 40 s of inactivity in the intro stage only. Never while a panel is open, text is focused or the visitor is reading.

Changing expression interpolates parameters. It never swaps drawings.

### 8.5 Technology orbs

Each orb is a glass sphere: a fresnel rim, a faint inner refraction tint, a specular glint and the technology logo on an inner plane, lit in the project accent. Logos come from the `simple-icons` package, rendered to textures. Kali Linux, Burp Suite and Express are all included.

**Slots and arms**
- Orb slots are traced from panel 3. Each slot is attached to an arm at an arc-length position: either the tip or partway along. Orbs therefore ride with the arm's motion, and one arm can carry more than one orb.
- Panel 3 shows 13 slots. Two more are added in the same rhythm, so Nox's 15 technologies all have a place.
- If a project has more technologies than slots, the extras go into a compact "more" tray. Never extra arms.

**Controls**
- Every orb has a real HTML `<button>` positioned over its projected screen position, for keyboard, screen readers and touch.
- The button carries the technology name and a visible focus ring.

### 8.6 World

The security realm is built from per-stage painted plates: entrance (panel 1, with the gate), intro, overview and detail (panels 2 to 5).

- **Changing stage** crossfades the plates over about 1.2 s and dollies the camera slightly, so the move feels like travelling through one place.
- **Live elements** sit in front: bubbles, red embers, light shimmer and a slow pulse on the red glyphs.
- **Plate source:** generated with the OpenAI image edit endpoint, with the character and text masked out of each reference panel. Until credits exist, plates are inpainted locally from the panels, and plates for panels 3 to 5, which are mostly covered by the interface, may reuse the overview plate.
- **Wide windows:** plates feather into a matching gradient beyond the square stage.
- **Tall windows:** the camera widens instead of cropping.

### 8.7 Interface layer

All text and controls are HTML on top of the canvas. Positions that follow the 3D scene (the head dome rectangle, orb buttons, tooltip anchor) are projected to the screen each frame and written straight to element styles through refs, not React state.

Content comes from the copied project data. Two things it needs do not exist yet: the per-technology usage notes for the tooltips, and the detail sections (Features, Vulnerabilities, Writeups, Challenges, What I Learned). Section 11 asks how to fill them.

Builder decisions (made in the design, open to the owner's correction):

- **"View Project" opens the full project view.** It follows the storyboard (panel 3's button opens panel 5), not the external URL. The external live URL appears as "Live Demo" in the detail view. The data's `live` link label changes accordingly; GitHub stays external everywhere.
- **Opening the overview from the intro.** Clicking or tapping Nox, or activating the nameplate, opens it. The nameplate becomes a button with a small "Explore" cue, so the action is discoverable and works from the keyboard.
- **Without WebGL** (or if the GPU context is lost), the page shows a static poster of the intro stage. All HTML content and links stay usable.

### 8.8 Responsive behaviour

- **Desktop:** reproduces the storyboard composition on a square stage centred in the window.
- **Tablet:** same layout, smaller orbs.
- **Phone (portrait, width below 768 px):** Nox sits centred in the upper part of the screen. Overview orbs move to a horizontally scrolling tray under Nox, each still highlighting its arm when selected. The overview and detail panels become bottom sheets, and tooltips open on tap instead of hover.
- **Every size:** nothing important is clipped, and controls are at least 44 x 44 px.

### 8.9 Performance

- **Targets:** 60 fps on a laptop, at least 30 fps on a mid-range phone.
- **Quality tiers:** chosen from device signals plus a one-second frame-time probe, and lowered automatically if frames stay slow:
  - device pixel ratio cap
  - tube segment count
  - sucker count
  - bloom resolution
  - particle count
- **Stopping work:** rendering pauses when the tab is hidden or the canvas is off screen, and the face texture is only re-uploaded when it changes.

### 8.10 Accessibility

- **Reduced motion** (`prefers-reduced-motion`): no float or drift and no swim entrance, and stage changes become crossfades. Blinking and a gentle gaze stay, so Nox still feels present.
- **Keyboard:** reaches every stage, every orb and every link, in order, with visible focus.
- **Skip link** jumps straight to the project details.
- **Text:** readable contrast is kept over the plates by giving panels their own dark surfaces.

### 8.11 Verification

- **Unit tests (Vitest) for the pure logic:**
  - chain kinematics and reach
  - pose blending
  - the stage state machine and its priorities
  - orb slot assignment
  - config validation and clamping
  - content validation
- **Visual checks:** each stage can be opened frozen with `?stage=<name>&freeze`. A Playwright capture against the matching reference panel goes through the compare scripts: silhouette and key colour samples, plus a side-by-side image.
- **Motion check:** a frame-sequence capture per stage, plus a frame-time probe.
- **Human review:** the owner looks at the live side-by-side in the browser and on a real phone.
- **Done for a stage** means:
  - its tests pass,
  - its side-by-side has been reviewed by the owner,
  - and it is committed.

## 9. Delivery order

The plan breaks these into tasks. Each milestone is committed on the build branch, then reviewed by the owner in the browser.

1. **Engine extraction:** the module tree, `CharacterConfig` with Nox's values, the stage state machine, the pose blender, stage URL parameters and unit tests. The intro stage reaches parity with the spike.
2. **Overview (panel 3):** glass dome, head panel, panel 3 arm pose, orbs, logos and orb buttons.
3. **Tech focus (panel 4):** reach-to-orb, focused expression, tooltip, keyboard and touch selection.
4. **Detail (panel 5):** Nox moves aside, the detail panel with content, and the return path.
5. **Entrance (panel 1):** swim pose and jet rhythm, the gate plate, skip and once-per-session behaviour.
6. **Responsive, phone tier, reduced motion and accessibility** pass across all stages.
7. **Plates:** final painted plates for every stage. Runs alongside milestones 2 to 6 as soon as image generation is available.

Estimated effort: about one working week for milestones 1 to 6, given prompt reviews from the owner.

## 10. Left to the builder

- Shader details: the glass dome look, the orb glass, the glyph pulse.
- Exact pose traces and timings per stage, within the durations in the master specification.
- Quality-tier thresholds and the frame-time probe design.
- File-level structure inside `src/nox3d/` and how the spike code is split up.
- The test list beyond the areas named in section 8.11.

## 11. Decisions for the owner

These change what gets built. Proposed defaults are in brackets.

1. **Technology usage notes and detail sections.** The tooltips and the full project view need real text. [Use the storyboard text as clearly marked placeholders now; the owner supplies the real text before launch.]
2. **Painted plates.** [Add OpenAI credits so plates can be generated and iterated in place. Otherwise the owner generates them in ChatGPT from prompts and masks that Claude prepares.]
3. **Review process for this build.** [Replace the old evidence process with: commit per milestone, side-by-side captures, owner review in the browser. `AGENTS.md`, `STATUS.md` and the execution docs are left untouched in the main checkout and simply not followed on this branch.]
