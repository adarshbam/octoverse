# Nox in a Real Underwater World: Look, World, Physics and Motion Design

Date: 2026-10-26
Branch: `feat/nox-3d` (worktree `worktrees.local/nox-3d-spike`)
Supersedes, for approach and detail: `docs/superpowers/specs/2026-10-23-nox-3d-design.md` and its plan.
References: `docs/design/references/Nox/` (the owner's HQ panels), `public/spike/nox-panel2-hq.jpg` (HQ panel 2, 1536 x 1024).
Test scene evidence: `spike-env/out/` (still beside panel 2, light comparison, contact sheets).

## 1. Intent

Nox is the first OctoVerse host, and the product only works if Nox feels like a real creature living in a real place. The owner signed off the base character on 2026-10-25, then said that every stage still felt rigid and unplanned. The motion felt rigid, the lighting looked like a sticker on a painting, and nothing felt underwater.

A throwaway test scene (2026-10-26) put the approved Nox into a real 3D world. That world was built from a Blender kit of pillars, rocks, coral and chains, with live lights, water, light rays and particles. The owner's verdict:

- **The world:** "World looks fantastic." It looks like Nox is in water.
- **Nox:** washed out. "The by default purplish shade and background glow and everything has been completely wiped out." This is the top priority. Nox must match the reference, or look better than it.
- **Motion:** the swim from far down the corridor "looks really good", but the arms do nothing while swimming. Nox must swim with his arms, sweeping them back. The arms must also behave like they are in water at all times ("add physics simulations").
- **Camera:** the slow camera drift "gives us a really cool perspective". It becomes the default idle view.
- **Process:** no more videos. The owner checks motion live on the local server. Work must be precise and planned, so issues like these stop recurring.

This document is the single source for how the next phase is built. Older docs still list what to build (stages, content, accessibility). How each part is built and what detail it needs comes from here; where they disagree, this document wins.

## 2. Goals

1. **Nox looks like panel 2 inside the real world.** He keeps a deep violet body, a saturated magenta rim, a glowing face and the purple glow behind him. He matches panel 2 by measurement (section 9.1) and in the owner's eyes.
2. **The world feels like real water.** Real 3D ruins near Nox and painted distance behind (Option 2). Light falls from the surface, with caustics, rays, drifting particles and glowing relics, and a camera that hovers slowly.
3. **The arms behave like they are in water**, always: drag, follow-through, trailing when Nox moves, settling when he stops.
4. **Nox swims like an octopus.** Strokes have a slow opening and a fast sweep back, then a glide with arms trailing, based on real octopus swimming (section 9.5).
5. **The entrance is the showpiece.** Nox swims out of the murk from the left, deep in the corridor, grows by real perspective, does a quick cute spin and settles at centre.
6. **Every big moment is planned.** The entrance, bubble blowing, bubble hold and head swell are timed sequences with anticipation, action and follow-through, not formula blends.
7. **It scales to other worlds and octopuses.** A world is a kit, a layout, a palette, lights and a far plate. An octopus is a configuration with its own personality, shades, glow and head effect.
8. **It runs on the owner's laptop** (Intel UHD graphics) within the budget in section 9.13.

## 3. Non-goals

- Other worlds and characters (Veyra, Flux, Aether, creator octopuses) beyond the hooks that make them possible.
- Sound.
- Full fluid simulation of the water. The arms get a physics layer; the water itself does not.
- Video recording of any kind, for review or verification.
- Rebuilding Nox as a rigged Blender model (approach B in section 7, rejected).

## 4. Anti-goals

This build fails, even if it technically works, if any of these happen:

- **Nox is washed out by the world:** greyer, paler, less saturated than panel 2, or his rim and glow lost against the background.
- **Rigid arms:** arms that move as one piece, snap between poses, or stay still while Nox swims.
- **Floaty or jittery physics:** arms that stretch, explode, tremble, pass through the head, or never settle.
- **Visible loops or repeated motion** that the eye can catch.
- **A Nox that looks squashed or blank from behind.**
- **Motion that blocks content:** every sequence can be skipped, and project information is never more than one action away.
- **Videos as evidence:** they cost too many tokens, and this laptop cannot record the heavy scenes properly.
- **Tentacle count tied to technology count.** Nox always has exactly eight arms, T1 to T8.
- **A common AI-generated look:** generic glow, generic particles, generic layout.

## 5. Constraints

- **Stack:** React 19, TypeScript, Vite, Three.js r186, `@react-three/fiber` 9, `@react-three/postprocessing` 3, `@react-three/drei` 10.7.9, Theatre.js (`@theatre/core`, `@theatre/studio`). drei and Theatre.js were added on 2026-10-26 and are not committed yet.
- **Colour pipeline:** no tone mapping (canvas `flat`). Bloom handles the highlights, as in the approved stage.
- **Blender:** 5.2 driven through Blender MCP (port 9876, localhost only, telemetry off, no generators or asset libraries). Kit pieces are built by scripts kept in the repo (as `spike-env/blender/build_kit.py` is today), so they can be rebuilt and changed.
- **Owner's laptop:** Intel UHD (ANGLE, D3D11). It is the floor every performance target is measured on.
- **Workspace:** all work happens in the worktree on `feat/nox-3d`. The main checkout (`codex/nox-storyboard`) holds a dirty tree with legacy deletions. It is never edited, reset or restored; files are only copied from it.
- **Approved artwork:** the approved character components (face, eyes, brows, mouth, blush, mantle, arms, suckers, skin, glow, base motion) are kept. Any change to them goes back to the owner for approval, component by component.

## 6. What the test scene established

These are measured facts from 2026-10-26, carried forward as starting points.

**The world (Option 2) works.**
- **Blender kit:** four pillar variants with framed glyph niches, five rocks, three corals and a chain, exported as one glTF file (6.4 MB uncompressed).
- **Light:** a surface spot light with an animated caustic pattern, red glyph and lava point lights, a cool overhead fill, and a water environment map.
- **Water:** exponential fog, a sky dome with the surface glow, light-ray cones, marine snow, red motes with near-lens blur, and a far fish school.
- **Floor:** baked crack texture with emissive lava, plus wet patches.
- **Camera:** panel 2's own camera (position -0.076, -0.081, 12; vertical field 23.57 degrees). Nox lands where panel 2 has him.

**Nox washes out in the world.** Mean colour inside Nox's silhouette, at panel 2's size:

| Render | Mean RGB | Saturation | Brightness |
|---|---|---|---|
| Panel 2 (target) | 119, 23, 79 | 0.88 | 0.53 |
| Approved stage (painted plate) | 137, 41, 95 | 0.76 | 0.58 |
| Test scene, Nox unlit by the world | 138, 42, 97 | 0.75 | 0.58 |
| Test scene, world light added | 158, 50, 104 | 0.71 | 0.64 |

Three causes:

1. **World light added on top** of Nox's own shading makes him lighter and greyer.
2. **The background behind him changed.** Panel 2 and the approved stage have a dark red-violet glow behind Nox. The test scene has blue water there, so his magenta rim and aura have nothing to stand against.
3. **The approved Nox is already less saturated than panel 2** (0.76 against 0.88). His green channel is the main difference (41 against 23).

A first attempt to re-light Nox entirely from the world was worse: it washed out the head and lost the neon rim. The world must never replace Nox's own lighting.

**Swim and depth.** A swim from deep in the corridor to the stage reads well: Nox grows by real perspective. The path must stay in the open middle of the corridor; Nox's arm span (about 4.3 units at rest) does not clear the near pillars elsewhere. The panel 2 camera's narrow lens compresses depth, so a long approach is needed to read the distance.

**Performance.** Measured on the owner's laptop, back to back, 1536 x 1024, pixel ratio 1, browser pane closed:

| Scene | fps |
|---|---|
| Approved stage, quality tier high / low | 32.3 / 41.6 |
| Test scene, everything live | 12.2 |
| Test scene, no shadows, point lights or post | 20.7 |

Earlier lower readings (16 and 5.9 fps) were taken while the live page also ran in the browser pane. Measure only with the pane closed.

## 7. Approaches considered

### 7.1 How Nox's motion is built

| Approach | Verdict |
|---|---|
| **A. Keep the approved code-built Nox, add a water-physics layer on the arms and keyframed sequences for the big moments** | **Chosen by the owner, 2026-10-26.** It keeps every approved component and expression. The arms are already chains of points, so physics fits them directly, and it costs little at runtime. Trade-off: the keyframes are authored as data in code or in Theatre.js, not by an animator in Blender. |
| B. Rebuild Nox as a rigged Blender model with clips made in Blender and spring bones | Proper animation tools, but every approved component (eyes, expressions, suckers, glow) would be rebuilt and re-approved. Weeks of rework. Rejected. |
| C. Hybrid: keyframe motion in Blender on a stand-in rig and play it on the code-built arms | Two systems to keep in sync, and tooling cost before any visible gain. Rejected. |

### 7.2 How worlds are built

| Approach | Verdict |
|---|---|
| 1. Painted plates with parallax layers | Cheap and painterly, but flat: no real light on Nox, no real depth, no camera freedom. |
| **2. Real 3D kit near Nox, painted distance behind** | **Chosen by the owner, 2026-10-26.** Real light, shadows and depth where the eye looks; the far corridor costs little. Kits make many worlds from a few piece sets. |
| 3. Everything live 3D | The test scene shows the look, but at 12 fps on the owner's laptop. Rejected for production; the far part becomes painted (section 9.2). |

## 8. How this phase is run (process)

These rules apply to every work item below. They exist because earlier rounds produced work the owner approved to move on but was not happy with.

1. **Targets before building.** Each work item starts with written acceptance targets:
   - Measurable ones wherever possible: colour and saturation against the HQ panel, frame rate, clearances, physics stability.
   - A short list of what the owner should look for live.
2. **Reference first.** For anything visual, inspect the HQ reference region and the current render at the same size before changing anything.
3. **Old docs list what to build, not how.** The 2026-10-23 design, its plan, the master specification and the packets say which features exist. Method, targets and checks come from this document.
4. **No videos.** No frame-sequence recording, review clips or contact sheets of motion. I check single stills, screenshots in the browser pane and measurements. The owner checks motion live at a local URL, with a short list of what to look at.
5. **The owner approves each component.** Nothing moves to the next component before approval. Approval means "move on", not "perfect": I name the remaining weaknesses myself when presenting.
6. **Measured, honest performance.** Measure back to back with the browser pane closed. Report the numbers even when they are bad.
7. **The test scene is a reference, not production code.** `src/spikeEnv/`, `spike-env.html` and `spike-env/` show what works. Production code is written again in `src/nox3d/` with tests, and the test scene is deleted once production reaches it.
8. **Commit per approved milestone**, on `feat/nox-3d`.

## 9. The design

### 9.1 Nox's look in the world (first priority)

**Principle: Nox has his own lighting** (the owner, 2026-10-26: "I meant both"). Nox is lit by his own glow:
- the neon border round his silhouette;
- the concave suckers, which glow strongly from inside their cups;
- the face glow.

These, with his key, rim, halo and palette, come from his character configuration, exactly as approved. They are emitters, so the world never dims, greys or tints them. The world, its glowing relics included, has its own lights for the stone, the floor and the water. On Nox, the world only adds accents within strict limits. This is how character lighting is done in film: the character's rig travels with the character.

**The suckers must read as in panel 2:** bright glowing rims round darker concave hollows, glowing hardest on the arm undersides. The sucker region sample (below) checks this.

**What the world may add to Nox:**
- **Side and underside warmth** from nearby glyphs and lava, on the arms and lower body. It is capped: no region of Nox gets more than 10% brighter in total from world light.
- **Surface caustics:** a faint moving shimmer on the top of the head and arms, at most 5% brightness.
- **A shadow** on the seabed and rocks below him, from the surface light.

**What the world may not do:**
- Brighten or tint the face, the crown or the neon rim.
- Change his key light, rim colours or halo.
- Fog him at the stage distance. Depth haze applies only while he is far away (beyond 18 units from the camera), and it comes from his own atmospheric term.

**The glow behind Nox (the "background glow").** Panel 2 shows a red-violet glow in the water around Nox, and his magenta rim reads against it. In the world this becomes three parts:
- **An aura:** a soft glow in the water around his silhouette. It is magenta-violet near him and deep red below. It is drawn behind him, uses additive blending and moves with him.
- **His light on the world:** his face glow already lights the seabed through a point light. It also lights nearby particles, bubbles and stone faces.
- **A local grade:** the water within about 3 units of Nox is darker and warmer than the blue far water, as in panel 2.

**Colour targets** (checked by a script at panel 2's size, in the world scene, on a frozen frame):
- **Mean colour inside Nox's silhouette:** within 10 RGB per channel of panel 2's (119, 23, 79). Saturation 0.85 to 0.91, brightness 0.49 to 0.57.
- **Region samples:** each within a colour distance (CIE76 delta E) of 8 from the same point traced on panel 2. The regions are head crown, head middle, cheek glow, upper arm top surface, arm underside red band, arm rim, suckers, and the aura just outside the silhouette.
- **The targets apply to Nox in every stage.** Every stage moves into the 3D world (section 9.12), so there is one look to tune, not two. If the base palette must change to meet them (for example, less green in the arm and head colours), the change goes to the owner once, as a glow-and-material component review. That review shows panel 2, the approved stage and the new version side by side, and the change then applies to every stage.

**Tool:** `scripts/check_stage.py` is extended with a `--world` mode that captures the world scene frozen at panel 2's camera and checks the targets above. It must exit 0 before the owner sees any look change.

### 9.2 The world (Option 2, production)

A world is built from five parts:

1. **Kit:** pieces modelled by a Blender script (rune pillars with their glyph panels, rocks, coral, chains, a panel 1 gate if wanted). They are exported as compressed glTF (Draco or meshopt geometry, KTX2 textures), with levels of detail for far use.
2. **Layout:** where each piece stands, kept as data.
3. **Palette and lights:** stone, glyph, lava and water colours; light positions and strengths.
4. **Far plate:** the corridor beyond about 12 units behind Nox, rendered in Blender from the same kit and lights at high quality. It is split into two or three depth layers so the hovering camera still shows parallax.
5. **Live elements:** caustics, light rays, marine snow, motes, fish, bubbles, floor lava pulse and coral sway.

**Light is baked where it does not move.** Glyph, lava and surface light on stone and floor is baked in Blender into lightmaps (a second UV set) together with ambient occlusion. The stone then needs no real-time point lights. Real-time light is used only for:
- the surface spot light with its caustic pattern, which gives the one moving shadow, cast by Nox;
- Nox's own glow light on the seabed and nearby stone;
- the world-to-Nox accents of section 9.1, which reach his skin through uniforms, not real lights.

**The relics** are the glowing rune pillars and glyph panels (with the glowing coral). The owner likes them and asks for "just a little more" glow than the test scene, still subtle. Their emission, bloom and the red light they spill on nearby stone rise a little, by about 15 to 25%. The change is judged against panel 2 and must never compete with Nox for attention.

**Look fixes found in the test scene** (each checked against panel 2 at the same size):
- **Pillar lean:** the pillars converge toward the top in panel 2 (a low camera looking up). The camera tilts up and its frame shifts down by the same amount (lens shift), so Nox keeps the same screen place and view.
- **Lower third:** much more lava glow, rock heaps lit red from behind, and denser embers, as in panel 2.
- **Top:** a brighter cyan opening at the surface, with more rays fanning down.
- **Stone:** larger carved blocks, not brickwork. Glyph panels vary in size, wear and brightness instead of repeating evenly.
- **Ambient bubbles** drift in the water (separate from technology bubbles).

**Camera.** Each stage keeps its framing, and the slow hover from the test scene is the default:
- full in the intro;
- half in the overview;
- eased to still while the pointer is over a technology bubble or one is held, so a target never slides out from under the pointer (the approved tech-focus rule);
- off in detail, where the visitor reads;
- off with reduced motion.

HTML anchors (title, nameplate, bubble buttons) follow the projected positions every frame, as they do today.

**Reuse:** `WorldConfig` names the kit, layout, palette, lights, far plate and live-element settings. A new world is a new config plus a kit script run, not new rendering code.

### 9.3 Water physics for the arms

Every arm, in every stage, runs through a physics layer that sits between the pose and the drawn tube:

- **Pose (target):** what the arm wants to do. This is the authored stage pose, ambient sway and curl, the swim stroke, or a reach or hold. It comes from today's `ArmChain`.
- **Physics:** where the arm actually is. It is a chain of about 16 nodes per arm. Each node is pulled toward its pose position by a spring, stiff near the root and soft toward the tip. Water drag pushes against motion through the water. Segment lengths are held so the arm never stretches. The root nodes move with the body, so when Nox moves the tips lag behind and trail, then catch up.
- **Drawn arm:** a smooth curve through the nodes, resampled to today's 128-segment chain. The tube, webs, suckers and held bubbles all ride on it unchanged.

**Behaviour required:**
- When Nox moves, his arms trail opposite to his motion, more at the tips. They overshoot slightly when he stops, then settle within about 1 s.
- A stage change or reach shows follow-through: the root moves first, the tip arrives last.
- Arms never pass through the mantle or through each other where they are visible.
- At rest, the physics adds only a slight lag to ambient motion. It never adds jitter or drift away from the approved pose.

**Personality:** drag, stiffness and tip softness are part of `CharacterConfig.personality`, so a heavier or springier octopus is configuration only.

**Robustness:** fixed time steps (for example 120 per second), with long frames split into steps and clamped after a stall (such as a hidden tab). Same input, same motion. Freeze and still modes skip the physics and show the pose exactly. Unit tests cover energy decay, no stretch beyond 2%, trailing direction, settling time, and stability at large time steps.

### 9.4 The back view

The spin (section 9.6) shows Nox from behind, and the far swim shows him at angles. From behind, Nox must read as cute and round, never squashed:
- the mantle's back silhouette is as full as its front;
- the skin speckles and crown sheen continue round the back;
- the arm roots and webs read from behind;
- the glow and aura still frame him.

It is reviewed as its own component with an orbit view (front, three-quarter, side, back) before the spin is built.

### 9.5 Swimming

Real octopus arm-swimming (references in section 13) has three phases:

1. **Recovery (slow):** the arms open outward, like an umbrella opening.
2. **Power stroke (fast):** the arms and the web between them sweep back and close together. The tips straighten late, giving an extra push.
3. **Glide:** the arms trail behind, streamlined, as in jet swimming.

All eight arms move together.

**Nox's stroke cycle:**

| Phase | Duration | What happens |
|---|---|---|
| Recovery | 0.45 to 0.6 s | Arms spread outward and slightly forward. The mantle fills a little (about 4%). Nox slows. |
| Power | 0.18 to 0.25 s | Arms sweep back and together, tips whipping straight at the end. The mantle squeezes (about 6%). Nox surges forward. |
| Glide | 0.4 to 0.8 s | Arms trail behind in a loose bundle, driven by the physics. The body coasts and slows. |

**Body:** Nox leans into his direction of travel, head first, arms behind. While coming toward the camera, the trailing bundle sits behind and below the head and blooms open on each recovery, so it reads from the front. Speed comes from the strokes; the physics turns them into trailing and follow-through.

**Face:** while swimming, Nox looks where he is going, with a determined, happy expression from the approved set. He blinks at a slower rate.

The stroke is a reusable motion, used by the entrance and by any later move between places.

### 9.6 The entrance

**Shape:**
- Nox appears deep in the corridor, on the left and out of the murk.
- He swims toward the visitor and to the centre, growing by real perspective, as in the test swim the owner liked, with real strokes now.
- Just before arriving he does a quick, cute 360-degree turn on a short curling path, so he spirals into place.
- He settles into the intro pose with follow-through in the arms.
- Then he blows the technology bubbles (section 9.8).

**Beats** (to be tuned live with the owner):

| Time | Beat |
|---|---|
| 0 to 1 s | Out of the murk, far down the corridor, left of centre. Glow and aura first, then the shape. |
| 1 to 4.5 s | Four or five strokes toward the visitor, drifting to the centre. Each stroke is a visible surge. |
| 4.5 to 5.5 s | The spin: a full turn about his vertical axis, showing his back, along a short golden-spiral arc into the stage spot. |
| 5.5 to 6.5 s | Settle: arms open into the intro pose and overshoot slightly. The face lands on the gentle smile and looks at the visitor. |

**Path:** the path stays in the open corridor and clears every pillar with Nox's arms open or closed. A unit test checks the clearance against the layout.

**Rules:**
- Skippable at any moment by click, key or the skip control.
- Plays once per browser session.
- With reduced motion, Nox is simply present in the intro pose.
- The title and nameplate appear as he settles.

The old Entrance v1 (Task 23, sideways swim at the stage scale) is replaced by this. The panel 1 gate plate (Task 24) is replaced by the 3D world; a gate can be a kit piece at the far end of the corridor if the owner wants it.

### 9.7 Shared micro-animations

These motions belong to every octopus, with timing and strength from its personality configuration:

- breathing
- buoyant float
- arm drift and curl
- blinking, including the double blink
- gaze and idle glances
- the stroke cycle
- settle and overshoot
- small startle
- bubble blow (section 9.8)
- suction hold (section 9.8)
- head swell (section 9.9)
- happy wiggle on arrival

Each is written once, with tests for its timing logic. Each runs through the physics layer, so arms always follow through.

### 9.8 Technology bubbles

- **Before:** no technology bubbles exist until the entrance has settled.
- **Blowing:** Nox blows them from his mouth. Before each blow his cheeks puff and the mouth rounds, then the bubble pops out and wobbles as it grows to full size.
- **Drifting:** the bubbles drift on slow orbits around him and never overlap the face. Each one has the approved orb glass look (sharp rim highlights, dark centre, vivid logo).

**Choosing a bubble** (hover or tap; keyboard focus does the same):
1. The nearest arm turns toward it. Its suction cups flare.
2. The bubble is pulled along the arm to the tip with a short ease.
3. The arm holds it and lifts it slightly. The physics gives the lift follow-through.
4. Nox's face reacts with the approved focused expression and looks at the bubble.
5. The tooltip shows how the technology was used.
6. Choosing another bubble releases the first back to its orbit.

Only one bubble is held at a time. Every bubble has a real HTML button that follows it, for keyboard, screen readers and touch, as the orbs have today.

**Where the bubbles are, stage by stage:**
- **Entrance:** none.
- **Intro:** blown as Nox settles. They orbit him and can be chosen straight away.
- **Overview (head swell):** they keep orbiting, pushed outward to clear the swollen head, and can still be chosen.
- **Detail:** hidden; the detail panel lists the technologies as chips, as approved.

Choosing a bubble is the tech-focus state, reachable from the intro or the overview. While a bubble is hovered or held, the intro's arm-reaches-for-the-pointer behaviour pauses. The 15 bubbles sit on two or three orbit shells around Nox. They are smaller in the intro framing, and they never cover the face, the title or the nameplate: the HTML boxes are kept clear.

On a phone the approved tray stays, and choosing from the tray plays the same pull and hold.

**From the approved Tasks 20 and 21, these are kept:** the orb glass look, logos, buttons, hover intent, the tooltip and its placement, and the focused expression. Replaced: the fixed arm-tip slots from panel 3 and the reach-to-orb. Orbits and the suction hold take their place.

### 9.9 The head swell

Clicking the head, or its button, makes it swell like a thought: a glassy dome with the project preview inside. This builds on the approved overview dome (Task 19). The swell has anticipation (a small squeeze), a swell with overshoot, then a settle. Closing reverses it.

Each octopus has its own special head effect inside or around the swell, named in its configuration. Nox's is decided with the owner when this item starts.

### 9.10 Variants

A variant octopus (for example Veyra) is a configuration plus a world:
- **Character:** shades (palette), glow and aura colours, expression tuning, personality (motion timing, physics feel) and its head effect.
- **World:** kit, layout, palette, lights and far plate.

Nox is the baseline. No variant needs new rendering code.

### 9.11 Choreography authoring

- **Big sequences** (entrance, bubble blow, head swell, arrival wiggle) are timelines in Theatre.js, saved as JSON state in the repository. They drive pose targets and body transforms; the physics layer adds the follow-through.
- **Studio:** Theatre's editor loads only in development (`?studio`), so the owner can scrub and nudge timings live. Production loads only the core runtime.
- **Small motions** (section 9.7) stay as code with parameters.

### 9.12 Content and stages

The stage set is unchanged: entrance, intro, overview (head swell), tech focus (bubble hold) and detail, with the content and accessibility rules of the 2026-10-23 design. Kept as approved: the detail stage, the HTML interface layer, keyboard and touch access, the skip control, and reduced motion.

**Every stage moves into the 3D world.** The painted-plate backdrop is retired. A static poster of the intro stays as the fallback without WebGL.

**Reference checks:**
- **Panel 2:** its colour targets (section 9.1) apply to Nox in every stage.
- **Panels 3 to 5:** their checks keep only composition (Nox's place, size and pose), re-baselined in the world once milestone 2 lands.
- **Panel 1:** its check is retired, since the new entrance no longer follows it.

### 9.13 Performance budget

**What the owner sees is what gets approved.** The quality probe (`src/nox3d/stage/quality.ts`) picks a tier on each device. Looks are tuned, colour-checked and approved on the tier it picks for the owner's laptop. Today the probe would put that laptop on tier low (it demotes tier high below 50 fps). The probe's thresholds are retuned so a tier is chosen only where it holds smooth motion:
- the tier chosen on the owner's laptop holds at least 30 fps in its normal browser window;
- tier high is chosen only where it holds at least 45 fps.

**Regression measures,** at 1536 x 1024, pixel ratio 1, back to back, browser pane closed, on the owner's laptop:
- **Intro with the full world at tier high:** at least 27 fps, within 15% of today's stage (32.3 fps).
- **Tier low:** at least 36 fps.
- **Physics layer:** at most 1.5 ms per frame for all eight arms.
- **Typical laptops and phones:** the earlier targets (60 fps on a typical laptop, 30 fps on a mid-range phone) still stand. Quality tiers scale particles, ray count, shadow map size, far-plate resolution, bloom resolution and pixel ratio.

## 10. Verification

- **Unit tests** (Vitest) for pure logic:
  - the physics integrator and constraints;
  - stroke timing;
  - the entrance path clearance;
  - bubble orbit spacing and choosing the nearest arm;
  - sequence state;
  - config validation for worlds and personalities.
- **Look checks:** `check_stage.py --world` targets (section 9.1) on frozen frames, plus side-by-side stills against the HQ panels at the same size.
- **Motion checks without video:** stills at chosen moments (`?t=` with `?freeze` or a still mode), numeric traces from tests (for example, how far the tip lags at a given speed), and screenshots in the browser pane.
- **The owner's live check:** a local URL per item and three to six things to look at. The owner's verdict goes in the review log.
- **Performance:** a frame-rate script (like `spike-env/perf.mjs`) in the repo, run against the budget in section 9.13.

## 11. Delivery order

Each milestone ends with the owner's live review and approval, then a commit. The next one starts only after approval.

1. **Nox's look in the world (first priority):**
   - his own lighting with limited world accents;
   - the aura and local grade;
   - colour targets met in the world scene and on the stage;
   - any base palette change reviewed as a component.
2. **The world in production:**
   - the Blender kit with baked light, the far plate and compressed assets;
   - `WorldConfig`, the look fixes (pillar lean, lava, top opening, stone, glyph variety) and the default camera hover;
   - the performance budget met.
3. **Water physics for the arms:** in every stage, with follow-through on stage changes and reaches.
4. **The back view:** orbit review.
5. **Swimming and the entrance:** the stroke cycle, the entrance sequence with the spin, skip and once-per-session behaviour, and reduced motion.
6. **Technology bubbles:** blowing, orbits, suction hold, release, buttons and the tooltip.
7. **The head swell:** with the special-effect hook.
8. **Shared micro-animations and variant hooks:** personality settings, and the variant config path proven with a dummy variant (not shipped).
9. **Pass across every stage:** responsive, phone tier, reduced motion, accessibility and performance.

## 12. Left to the builder

- The physics integrator (position-based dynamics or verlet with pose springs), node count, and spring and drag constants, within the behaviour and budget above.
- The aura's technique (screen-space layer or billboard volume), within the look targets.
- Lightmap resolution, compression settings and level-of-detail distances.
- Exact stroke and entrance timings within the ranges given, tuned live with the owner.
- The file structure inside `src/nox3d/` for the world, physics and sequences.
- The test list beyond section 10.

## 12a. Calls I made (for the owner to check)

1. **Resolved by the owner, 2026-10-26:** "relics could have its own lighting" meant both. Nox has his own lighting (neon border, glowing concave suckers, face glow), and the relics (rune pillars and glyph panels) glow a little more than in the test scene, still subtly.
2. **The entrance** combines the deep-corridor swim the owner liked with coming in from the left, ending at centre, with the 360-degree spin before arrival.
3. **Camera hover** is on in every stage, scaled down while the visitor reads.
4. **The colour target is panel 2, measured.** If the approved base palette must move toward it, that change goes back to the owner as a component review.
5. **Big sequences use Theatre.js,** with its editor available only in development.
6. **A panel 1 gate** becomes an optional kit piece, not a painted plate.
7. **The performance targets** in section 9.13 are set against today's measured stage on the owner's laptop. Looks are approved on the tier the laptop actually runs.
8. **Technology bubbles** orbit in the intro and the overview and can be chosen from either. The phone keeps its tray.
9. **Every stage moves into the 3D world.** The painted-plate stage is retired, apart from a no-WebGL poster.
10. **The camera hover** drifts on its own and is off in detail. A bubble's hover, choice or suction hold never moves it (owner, 2026-11-03: "completely eliminating that camera pan would be better"; lane C ledger C2).

## 13. Research references (octopus swimming)

- FORTH octopus project, arm-swimming background: <https://projects.ics.forth.gr/cvrl/octopus/background.html>
- Scientific American, "New views into the octopus's bizarre moves": <https://blogs.scientificamerican.com/octopus-chronicles/new-views-into-the-octopuse28099s-bizarre-moves/>
- Octopus-inspired eight-arm robotic swimming by sculling movements (Strathclyde, FORTH): <https://pureportal.strath.ac.uk/en/publications/octopus-inspired-eight-arm-robotic-swimming-by-sculling-movements/>
- Multi-arm robotic swimming with octopus-inspired compliant web: <https://research.aber.ac.uk/en/publications/multi-arm-robotic-swimming-with-octopus-inspired-compliant-web/>
