# Veyra in 3D: Character, Vault World and Motion Design

Date: 2026-11-03
Status: approved by the owner, 2026-11-03.
Branch: `claude/veyra-design-3b1c3c` (docs only)
Packets: master plan F01 (Veyra static) and F02 (Veyra behaviour and engine validation).
References (read-only, main checkout): `docs/design/references/Veyra.jpeg` (panels P1 to P5), `girlfriend-reference.jpg` (character DNA), `docs/design/── DESIGN-SPEC.md` (Veyra: cyan, teal, emerald, underwater ruins, secure vault, soft bioluminescence; "Veyra — The Keeper of Files").
Method model: `2026-10-23-nox-3d-design.md` and `2026-10-26-nox-world-and-motion-design.md`. Where this document and those disagree for Veyra, this document wins. Physics is cancelled for every world; nothing here uses it.
Engine: Veyra is built on the shared engine described in `2026-11-03-octoverse-engine-design.md` (written in parallel on its own branch), after Nox's extraction. Section 9 lists what Veyra needs from it.

## 1. Intent

Veyra is the second OctoVerse host and the proof that the engine makes a genuinely different world, not a recoloured Nox. She keeps the vault of the Vault OS project, a cloud storage platform. Her identity is "secure, clean, magical": a calm, graceful guardian made of glassy teal jelly, with a warm glowing face, cream-gold cups, and technologies she keeps as pendants hanging from her arms.

If the engine can make Veyra from data, small registered modules and her own assets, without forking shared code, the engine is proven and Flux and Aether can follow.

## 2. Acceptance criteria

These come first because every work item is judged against them. All colours are sRGB, sampled from `Veyra.jpeg` P2 (panel crop x 512 to 1000, y 0 to 494 of the 1536 x 1024 file). The reference is a composite at about 488 px per panel, so sample areas are small and the tolerance is wider than Nox's.

### 2.1 Colour targets (P2, intro, frozen, at P2's camera and size)

Each region sample within CIE76 delta E 10 of the reference value. The region samples come from a 4 to 10 px area-average at the listed `Veyra.jpeg` pixel.

| Region | Ref pixel (x, y) | Target RGB |
|---|---|---|
| Head crown (bright cyan) | 767, 215 | 2, 179, 193 |
| Head middle (darker, see-through) | 767, 250 | 0, 93, 102 |
| Head side | 690, 260 | 14, 130, 163 |
| Face glow, below the eyes | 777, 333 | 207, 218, 144 |
| Chin, where the glow meets the body | 777, 348 | 43, 151, 124 |
| Blush | 726, 328 | 245, 189, 138 |
| Mouth line highlight | 780, 318 | 242, 227, 160 |
| Arm top surface | 613, 308 | 9, 184, 167 |
| Arm body | 647, 323 | 12, 188, 178 |
| Sucker cup rim (cream-gold) | 610, 322 | 224, 220, 156 |
| Water just outside the head (aura) | 672, 235 | 2, 42, 54 |
| Mid water behind her | 562, 225 | 3, 18, 25 |
| Upper water (lit) | 870, 100 | 3, 75, 108 |

Plus two global checks:
- **Mean colour inside Veyra's silhouette:** measured on the P2 mask (made the same way as Nox's) when F01 starts. The target is recorded in the review log then, with tolerance 12 RGB per channel and saturation within 0.04.
- **Warm-on-cool contrast:** the face glow sample is at least 60 points higher in red than the head-middle sample. This keeps her face warm; a recoloured-Nox failure shows up here first.

### 2.2 Shape targets (P2)

1 world unit = 100 panel px, origin at the P2 panel centre, as for Nox.
- **Head:** dome half-width 0.92 ± 0.04 (Nox 0.752), top at y 0.48 ± 0.04 (Nox 0.255). No visible cheek lobes.
- **Eyes:** centres at about y -0.50; mouth at about y -0.70; face glow centre at about y -0.86.
- **Arm span** at rest: 3.9 ± 0.15 units.
- **Silhouette:** mask overlap (IoU) with the P2 mask at least 0.85.

### 2.3 Close-up detail

Checked at 3x zoom against P2, and in an orbit view (front, three-quarter, side, back):
- **Eyes:** green irises with dark pupils and two catchlights, one lash at each outer corner, thin dark raised brows, soft pink blush, and a small closed smile.
- **Jelly mantle:** a bright rim, a brighter crown, a darker centre, and fine sparkle specks (at least 40 visible on the front of the head at the P2 size). No blotchy "skin" texture.
- **Cups:** a scalloped cream-gold frill along each arm's underside, the edge reading as separate cups, smaller toward the tips.
- **Spirals:** tip spirals read as rolled coils, not hooks. At least five of the eight arms show a full turn at rest, as in P2.
- **Back view:** round and glassy. The sparkles and rim continue round the back.

### 2.4 Frame rate (owner's laptop, Intel UHD)

Measured at 1536 x 1024, pixel ratio 1, back to back, browser pane closed, the same way as Nox:
- **Intro at tier low:** at least 40 fps median.
- **Overview with 12 pendants at tier low:** at least 36 fps.
- **Entrance at tier low:** at least 32 fps median.
- **Nox unchanged:** Nox's own numbers do not drop by more than 3% after Veyra's engine changes land.

### 2.5 Behaviour

- Exactly eight arms, T1 to T8, in every stage. Technology count never changes anatomy.
- Pendants never overlap the face, the title or the nameplate.
- Every sequence is skippable, and reduced motion is honoured.
- Switching worlds resets the stage, timers, selection and sequences. Nox's output is unchanged (F02).

## 3. Goals, non-goals, anti-goals

**Goals**
1. Veyra reads as Veyra at every stage: same character, palette, composition and glow as P1 to P5, judged by measurement (section 2) and by the owner.
2. She is clearly not Nox: different head shape, material, face colour, cups, pose, technology treatment, world and motion.
3. Her world feels like a real underwater vault: ruins, a portal, plants and light from above.
4. Her motion is secure, clean and magical: calm, smooth, deliberate, with small moments of sparkle and things clicking into place.
5. The engine is validated: Veyra is data, registered modules and her own assets, with no fork of shared code.

**Non-goals**
- Physics of any kind.
- Flux, Aether, the landing page and the customiser.
- Sound.
- Matching the painted brush texture.

**Anti-goals** (failure even if it works)
- A recoloured Nox: same head shape, same red-band arm look, same orbiting bubbles.
- A cold face: the face glow drifting to cyan or grey.
- Muddy colour: teal going grey-green, or cyan washing out to white in bloom.
- Busy or fidgety motion; anything that looks nervous rather than calm.
- Pendants that tangle, cross arms, swing wildly or hide the face.
- A generic "AI fantasy" scene: random glow everywhere, with no clear focal point.
- Videos as evidence. The owner checks motion live.

## 4. Constraints

- **Stack:** as Nox. React 19, TypeScript, Vite 8, three 0.186.1, R3F 9, drei, postprocessing, Theatre.js 0.7.2. No tone mapping; bloom handles highlights.
- **Engine first:** Veyra starts only after the engine contract is approved and Nox's extraction (E02) lands. Veyra code lives in her own world folder on top of the engine.
- **Blender:** headless, with kit and bake scripts kept in the repo, as Nox's `blender/security/` scripts are.
- **Workspace:** never edit, reset or restore the main checkout. Copy reference files only.
- **Process:** as in Nox spec section 8:
  - targets come before building;
  - check the reference first;
  - no videos;
  - the owner approves each component;
  - performance is measured honestly;
  - commit per approved milestone.
- **Model tiering:** Opus effort goes to the 3D look (mantle material, face, cups, world light). Routine wiring goes to cheaper models.
- **Content:** no Vault OS project data exists in the repo. The storyboard text is used as marked placeholders until the owner supplies real facts (F01: "actual project facts remain required").

## 5. Reading the reference

- **P1, entering.** Veyra swims in from the left in three-quarter view, arms trailing in a loose bundle, toward a stone arch on the right. The arch is filled with a cyan energy membrane with a white padlock. Around it:
  - mossy stone blocks;
  - a worn path;
  - green and teal glowing plants, kelp and a few orange-yellow corals;
  - blue-violet fish;
  - glowing cyan bubbles on the left;
  - light rays from the surface.
- **P2, intro.** Front view, centred. The head is a tall, round, translucent teal dome with a bright crown and a darker middle. The face sits low with a warm cream-yellow glow. The green-eyed face has a lash at each outer corner, thin brows, pink blush and a small smile. The arms are mint-aqua with big cream-gold scalloped cups:
  - the top pair rises beside the head and curls outward;
  - the side arms spiral out at shoulder height;
  - two front arms hang down the centre and curl at the tips.

  The title has a padlock icon. The nameplate reads "Veyra, The Keeper of Files".
- **P3, overview.** The head swells into a wide translucent jelly dome with the project panel inside (screenshot, title, text, Live Demo, GitHub). The face drops to the bottom of the dome with an open happy smile. The arms spread wide. Technology orbs hang from the arms on short cords with small caps, like lanterns or ornaments. Some arms carry two (one at the tip, one midway). Twelve are visible; the panel text says up to 15.
- **P4, tech focus.** Hovering an orb makes its arm move toward the cursor. The orb grows and glows, and a tooltip lists how it is used. The other arms keep floating.
- **P5, detail.** Veyra moves to the left edge, partly cropped, still alive and smiling. A large panel holds the padlock title, section navigation, the screenshot carousel, the overview, Live Demo (mint gradient) and GitHub, technology chips and key feature cards.
- **DNA** (`girlfriend-reference.jpg`): a round head, big eyes with lashes, a simple smile and eight flowing arms with teardrop pendants on them. Veyra's pendants are closer to the DNA than Nox's orbits are.

## 6. Approaches

| Approach | Verdict |
|---|---|
| **A. Veyra as engine data plus registered modules plus her own kit** | **Chosen.** This is the master plan's own test: the engine is validated only if a second world comes from configuration. Her new behaviour (jelly material, pendants, vault dial, vault kit) enters through engine extension points, which Flux and Aether will also need. Trade-off: it waits for the engine extraction. |
| B. Copy `src/nox3d/` into `src/veyra3d/` and change it | Fast at first, but the master plan forbids it (whole-engine duplication) and it proves nothing. Rejected. |
| C. Recolour Nox through config only, with no new modules | Cheapest, but it cannot produce the jelly head, pendants or vault dial. It is the anti-goal. Rejected. |

**Technology treatment:** the owner chose pendants on arms (2026-11-03) over reusing Nox's orbiting bubbles.

## 7. The design

### 7.1 Character geometry

- **Head:** a tall, round dome, wider than Nox's (section 2.2). The lower outline narrows smoothly into the neck with no cheek lobes; the engine allows cheeks "off". The face sits low on the dome, so the face anchor is per character.
- **Arms:** exactly eight, T1 to T8, with webs at the roots as for Nox.
  - **Thickness:** slightly slimmer than Nox at the root and tapered longer, so the spirals stay tidy.
  - **Tip curl:** a per-character curl amount and spiral tightness. Veyra rolls her tips into tight, full coils, at least one turn on most arms at rest.
- **Suckers:** cream-gold cups, larger relative to the arm than Nox's, packed so their outer edges form a scalloped frill along the underside. Each cup has:
  - a raised glowing rim;
  - a slightly darker teal-cream hollow;
  - a size that shrinks toward the tip.

  There is no red underside band.

### 7.2 Materials and look

Veyra has her own lighting, as Nox does: her glow, rim and cups are emitters the world never dims or tints. The world may add only the accents allowed in Nox spec 9.1: at most 10% brightening in total and at most 5% caustic shimmer on top surfaces. It never tints her face.

- **Jelly mantle** (a new material mode in the engine, single pass, no transmission render target):
  - **Fresnel rim:** a bright cyan edge all round the silhouette.
  - **Crown:** a soft bright cyan cap toward the top.
  - **Depth term:** the centre of the dome, facing the camera, is darker and more saturated teal, so the dome reads as thick translucent jelly.
  - **Warm core:** the face glow sits inside, under the face. It is cream-yellow at its heart, turns green-cream at its edge and fades into teal by the eyes' top line.
  - **Sparkles:** fine bright specks, a few slightly larger, scattered over head and arms. They twinkle slowly (each fades in and out over 2 to 6 s, out of phase).
  - **Wet highlight:** one soft broad specular from above-left, as in P2.
- **Arms:** mint-aqua, brighter along the top edge (a cyan rim). The face glow warms the arm roots. The undersides take a soft cream glow from the cups.
- **Halo and aura:** a soft cyan-teal glow round the silhouette, slightly greener below the arms. The aura in the water is teal near her and deep blue-green below.
- **Local grade:** the water within about 3 units of her is darker and bluer than the brighter, greener water near the plants, so her rim reads against it.
- **Dome (overview):** a wide translucent teal-cyan capsule with a bright cyan rim, a soft inner sheen and a faint inner gradient to darker teal at the bottom (P3).

### 7.3 Face

The face uses the same parametric canvas as Nox, with Veyra's own layout and palette:
- **Eyes:** large and round, with green irises (dark green top to bright green-gold bottom), a black pupil and two white catchlights. The sclera is warm white.
- **Lid and lashes:** a dark lash line and one lash flicking up at each outer corner.
- **Brows:** thin dark arcs, set high and slightly raised. Her default reads friendly and open.
- **Mouth:** a small closed smile in dark teal-brown with tiny dimples. The open smile (overview) has a warm pink inside.
- **Blush:** soft peach-pink ovals under the outer corners of the eyes.
- **Expression presets**, tuned to Veyra:
  - gentle smile (intro);
  - happy open smile (overview);
  - interested look (tech focus): brows up, eyes slightly wider, small smile. This differs from Nox's narrowed "focused grin";
  - attentive (detail);
  - restful.

### 7.4 Poses

Each stage pose belongs to Veyra (arm curves, body position, scale and yaw, expression). The engine's pose blender moves between them.
- **Entrance:** three-quarter side view, arms bundled and trailing (P1).
- **Intro:** traced from P2. T1 and T8 rise beside the head and curl outward above shoulder height. T2 and T7 spiral out at shoulder height. T3 and T6 spiral out lower. T4 and T5 hang down the centre and curl at the tips.
- **Overview:** traced from P3. The arms spread wider and higher to carry the pendants clear of the dome. The face sits at the dome's bottom.
- **Tech focus:** as the overview, with one arm lifting (section 7.5).
- **Detail:** traced from P5. Veyra at the left edge, smaller, three-quarter facing right toward the panel.

### 7.5 Technology pendants

**Look.** Each technology is a glass orb with the approved orb glass look and logo, as Nox's are. Each hangs from a short glowing thread (cyan, thin, slightly sagging) with a small cream-gold cap where the thread meets the orb.

**Slots.**
- Pendants hang at arm arc-length slots: the tip or a mid-arm point. A slot table belongs to each pose.
- Each arm carries at most two, so there are 16 slots. P3 shows 12 orbs; the rest go in the same rhythm.
- More technologies than slots go to the compact "more" tray. Never extra arms.
- Slot order follows the project's technology order, so the most important sit at the top arms.

**Swing.** Each pendant hangs below its attach point and swings as the arm moves. The swing is a damped pendulum driven by the attach point's motion, with a small idle sway. It is procedural motion with fixed constants and no physics engine:
- the swing is at most 25 degrees from vertical;
- it settles in about 1.2 s;
- threads never cross arms or the face (slots are checked in tests).

**Appearing** (after the entrance settles):
1. The cup at each slot brightens.
2. A small cream-gold pearl grows out of it, the thread draws down, and the pearl swells into the glass orb with a soft wobble.
3. Pendants appear in a ripple from the top arms down, about 1.2 s in all.

**Choosing a pendant** (hover, keyboard focus or tap):
1. The owning arm lifts the pendant toward the pointer (or straight up and forward with keyboard or touch) with a smooth ease-out of about 450 ms. The root moves first and the tip arrives last.
2. The orb grows 1.25x and glows brighter. Its thread shortens a little, so it sits snug under the tip.
3. Veyra looks at it with the interested expression.
4. The tooltip shows how the technology is used (P4).
5. The other pendants dim slightly and keep their idle sway. The other arms keep only ambient motion.
6. Releasing, or choosing another pendant, lowers it back with a small settle.

Only one is chosen at a time. Every pendant has a real HTML button that follows it, as Nox's bubbles do. On a phone, the approved tray stays, and choosing from the tray plays the same lift.

**Stages:**
- **Entrance:** none.
- **Intro:** pendants appear as she settles and can be chosen.
- **Overview:** pendants on the overview slots, clear of the dome.
- **Detail:** hidden, shown as chips.

### 7.6 Head swell: the vault dial

The swell keeps the shared mechanics: anticipation (a small squeeze), a swell with overshoot, then a settle. Veyra's effect sits inside the dome:

| Swell progress | What happens |
|---|---|
| 0 to 0.35 | Three concentric rings of cyan light appear inside the dome, each with small notch marks, like a vault dial. |
| 0.35 to 0.65 | The rings turn in alternating directions and lock into line with a soft click flash (a brief brighter pulse). |
| 0.65 to 1.0 | The rings open outward and dissolve into sparkles, which drift and fade as the project panel fades in. |

Closing reverses it quickly (rings reform and fade) over about half the time. The effect is a registered head-effect module (`vaultDial`). It is driven only by swell progress and the dome frame.

### 7.7 The vault world

Built like Nox's world (Nox spec 9.2): a real 3D kit near Veyra, a painted far plate behind, baked light on still stone, and live elements in front.

**Kit** (a Blender script under `blender/vault/`):
- **Vault portal:** a stone arch with a recessed doorway. The doorway holds a cyan energy membrane: an animated shader with slow flowing light lines, brighter at the edges. A padlock in the middle is a separate piece with a separately animatable shackle and dial ring.
- **Mossy stone:** large blocks, broken walls and steps, with green moss on top faces.
- **Plants:** kelp strands (tall, swaying), seagrass clumps and glowing green-teal plants (small bioluminescent sprigs). A few orange-yellow corals give the only warm accents (P1, P2 lower right).
- **Rocks:** dark seabed rocks for the foreground.

**Layout** (data): the portal stands to the right and slightly back of the stage, as in P1, and stays visible behind her in the intro, softly lit and off to the side. Walls and kelp frame both sides. A worn path runs from the left distance toward the portal. The foreground is dark rocks and plants.

**Light:**
- **Surface:** cool cyan light from the surface, with rays and caustics; the one moving shadow (Veyra's) falls on the path.
- **Portal:** cyan light spills on the nearby stone (baked).
- **Plants:** green light from the plants (baked).
- **Veyra:** her own glow lights the path below her.
- **No lava** and no red light anywhere.

**Water:** deep blue-teal fog, brighter and greener toward the plants, and dark blue overhead away from the rays.

**Live elements:**
- kelp and seagrass sway;
- glowing cyan bubbles rising (separate from pendants);
- green motes;
- small blue-violet fish crossing slowly far off;
- the portal membrane flow;
- plant glow pulsing slowly.

**Relic intensity:** the portal is the one strong light in the world and must never compete with Veyra. Its brightest pixel stays below her face glow's brightness in the intro.

**Camera:**
- **Framing:** her own per stage, with the intro framed so the title sits above her and the nameplate below (P2).
- **Hover:** the shared camera hover, a little slower than Nox's (calmer); full in the intro, half in the overview, still while a pendant is chosen, off in detail.
- **Tilt:** a slight upward lean (smaller than Nox's).

### 7.8 Motion personality: the calm guardian

Personality values are starting points, tuned live with the owner:

| Setting | Nox | Veyra (start) | Why |
|---|---|---|---|
| Blink interval (s) | 2.6 to 7.0 | 3.5 to 8.5 | calmer |
| Double blink chance | 0.2 | 0.12 | less fidgety |
| Gaze response | 16 | 10 | soft, unhurried attention |
| Head turn | 3.2 | 2.4 | smooth |
| Sway | 0.5 | 0.4 | clean, quiet |
| Curl | 1.1 | 1.4 | tighter coils |
| Float amplitude / period | 0.045 / 6.2 s | 0.06 / 7.5 s | buoyant, slow |
| Breath period | 4.6 s | 5.4 s | slow |
| Stroke: recovery / power / glide | 0.52 / 0.21 / 0.6 s | 0.65 / 0.26 / 1.0 s | fewer strokes, long glides |
| Settle overshoot | as approved | 60% of Nox's | arrives cleanly |

**Character moments** (shared micro-animations, Veyra's tuning):
- **Idle flourish:** every 12 to 20 s, one arm slowly unrolls and re-rolls its spiral.
- **Sparkle shimmer:** when she settles or a pendant appears, a soft wave of sparkle twinkle runs over her head from crown to face.
- **Happy wiggle on arrival:** smaller and slower than Nox's.

### 7.9 The entrance

| Time | Beat |
|---|---|
| 0 to 1 s | She appears out of the blue haze, far down the path on the left, glow first. |
| 1 to 4.5 s | Three long strokes with long glides along the path toward the visitor, passing in front of the portal on its left. |
| ~3.5 s | As she passes, the padlock's dial ring turns a quarter turn and clicks, with a soft cyan flash on the membrane. It is the vault recognising its keeper. |
| 4.5 to 5.5 s | A slow, graceful turn to face the visitor, a three-quarter to front turn of about 200 degrees, not Nox's quick spin, as she glides to the stage spot. |
| 5.5 to 6.5 s | Settle: the arms open into the intro pose, the spirals roll in, the face lands on the gentle smile, and a sparkle shimmer runs over the head. Then the pendants appear (section 7.5). |

The path stays clear of the arch and walls with arms open or closed (a unit test checks the clearance against the layout). The rules are as Nox's:
- skippable at any moment;
- plays once per browser session;
- with reduced motion she is simply present in the intro pose with pendants shown.

The title and nameplate appear as she settles. The entrance is a Theatre.js sheet owned by the Veyra world.

### 7.10 Stages and content

The stage set is shared: entrance, intro, overview (head swell), tech focus (pendant lift) and detail. Transitions and priorities follow Nox. The interface layer (title, nameplate, overview panel, tooltip, detail view, skip control) is the shared HTML, themed per world.

**Content:** a Veyra content file with:
- name and epithet ("Veyra", "The Keeper of Files");
- project "Vault OS", tagline "A secure cloud storage platform.";
- the overview text from P3/P5;
- links (Live Demo, GitHub), screenshots;
- technologies: React, TypeScript, JavaScript, Node.js, Express, MongoDB, Redis, Docker, Linux, AWS, Cloudflare and GitHub (12, from P3);
- usage notes;
- detail sections: Overview, Features, Tech Stack, Architecture, Challenges, What I Learned (P5);
- key features (P5).

Storyboard text is used as clearly marked placeholders. The owner supplies real facts and links before launch.

**Theme tokens:**
- **Accent:** teal-mint (about `#3fe0c5`), with a mint-to-cyan button gradient for Live Demo.
- **Panels:** dark teal surfaces.
- **Focus ring:** cyan.
- **Icon:** a padlock beside the title.
- **Title:** small "OCTOVERSE" letter-spaced above it.

### 7.11 Responsive and accessibility

As Nox:
- **Desktop and tablet:** the storyboard composition.
- **Phone:** Veyra in the upper screen, pendants in the tray, panels as bottom sheets.
- **Every size:** 44 px targets, full keyboard path, skip link, reduced motion (no float, drift or swim; pendants shown still; dial effect becomes a crossfade), and the no-WebGL poster of the intro.

### 7.12 Performance plan

The budget is section 2.4. The levers are the same quality tiers as Nox (render scale, particles, rays, shadow map, far plate size, bloom resolution). In addition:
- **Jelly material:** one pass, no transmission, no extra render targets.
- **Kelp sway:** vertex shader only, instanced.
- **Fish:** instanced; off at tier low.
- **Pendant threads:** one instanced line or thin tube batch for all 16.
- **Orbs:** one material, instanced where possible; logo textures shared through the existing cache.

## 8. Engine-dependent pieces (what Veyra needs from the shared engine)

Sent to the engine-contract session on 2026-11-03. Veyra assumes each of these is data or a registered module:

1. **Character geometry config:** cheek lobes optional; per-character face anchor; tip-curl amount and spiral tightness; sucker style (colours, rim, frill, size), with no hard-coded red underside band.
2. **Material modes:** Nox "skin" and Veyra "jelly glass" (single pass), plus a sparkle term. No shader assumes a red or magenta hue.
3. **Face:** fully config-driven (lash count and style, brow thickness, iris colours); expression presets per character.
4. **Head effects:** a registry; Veyra registers `vaultDial`. An effect receives swell progress and the dome frame.
5. **Technology artifacts:** placement, appear and select are per-world strategies.
   - Nox: `orbit`, blow, suction hold.
   - Veyra: `pendant`, bloom-from-cup, arm lift.

   The glass look, logos, buttons, tooltip and tray are shared.
6. **Poses:** stage poses owned by the character, with slot tables; the pose blender is shared.
7. **World config:**
   - per-world kit and Blender scripts;
   - layout, palette, lights, bake and far plate;
   - open light and relic kinds;
   - live-element set and colours;
   - floor material, fog, camera framing, tilt and hover.
8. **Personality:** extended with settle overshoot, stroke and glide bias, and idle flourish rate.
9. **World-owned sequences:** Theatre.js sheets (entrance, appear, swell), with entrance clearance tests against the world's layout.
10. **Instance isolation and switching:**
    - every runtime singleton per instance;
    - `?world=veyra`;
    - switching resets the stage, timers, selection, sequences and anchors.
11. **Tooling:** `check_stage.py --world <id>` and the perf script take a world id with its own reference panel, sample points and targets.
12. **UI theme tokens and per-world content.**

If the approved engine contract differs from this list, the plan (step 6) adapts Veyra to the contract and lists any gap for the engine owner. Veyra never forks shared code to close a gap.

## 9. Verification

- **Unit tests (Vitest):**
  - config validation and clamping for Veyra's character and world;
  - pendant slot assignment (16 slots, overflow to the tray, never more arms);
  - pendant swing bounds and settling;
  - threads clear of arms and face in each pose;
  - entrance path clearance;
  - vault dial phase timing;
  - world switch resets state.
- **Look checks:**
  - `check_stage.py --world veyra` on frozen frames at P2's camera, for the section 2.1 targets;
  - side-by-side stills against P1 to P5 at the same size;
  - the close-up list in section 2.3 at 3x zoom;
  - the orbit view for the back.
- **Motion checks without video:** stills at chosen times (`?t=` with `?freeze`), numeric traces from tests, and the owner's live check with three to six things to look at per item.
- **Performance:** the perf script with `?world=veyra`, back to back, browser pane closed, against section 2.4. Nox's numbers are re-run in the same session.
- **Two-world regression (F02):** Nox's look checks and tests pass unchanged after every Veyra milestone.

## 10. Delivery order

Each milestone ends with the owner's live review, then a commit. F01 covers milestones 1 to 4; F02 covers 5 to 8.

1. **Veyra on the P2 stage (gate):** the character, its geometry, jelly material, face, cups and P2 pose. Colour, shape and close-up targets met. The owner approves P2 before anything else (F01: "Approve V/P2 first").
2. **The vault world:** kit, bake, far plate, live elements, light and camera; Veyra's look still meeting P2 targets in the world; frame-rate budget met.
3. **Static P3, P4 and P5:** overview pose with dome and pendants, tech focus pose, and detail composition, with responsive variants.
4. **Back view:** orbit review.
5. **Motion personality and the entrance**, with the portal click.
6. **Pendants live:** appear, swing, lift, tooltip, buttons and tray.
7. **Head swell with the vault dial.**
8. **Pass across all stages:** responsive, phone, reduced motion, accessibility, performance, and the two-world regression report.

### 10.1 Starting conditions and fallbacks

- **Start point.** The plan is written against the approved engine contract, not against today's Nox-shaped `src/nox3d` code. Milestone 1 is blocked until E02 (Nox extraction) lands. No adapter or spike phase is written against the old code.
- **Plan depth.** Milestones 1 and 2 are planned task by task. Milestones 3 to 8 are planned at task level and revisited after the owner approves P2, since that review may change them.
- **Milestone 1 backdrop.** Before the vault world exists, Veyra is checked on a graded stage backdrop: a vertical gradient fitted to P2's water samples (upper water, mid water), with her aura and local grade on. All section 2.1 samples are checked there. They are checked again in the world at milestone 2, and the world must keep them.
- **Missing the frame-rate floor.** If a budget in section 2.4 is missed, the quality levers are cut in this order, at tier low only:
  1. fish;
  2. light rays;
  3. motes and ambient bubbles;
  4. kelp count;
  5. far-plate size;
  6. sparkle count (never below what section 2.3 needs).

  Veyra's own look (face, rim, cups, glow) is never cut. If the floor is still missed, the numbers go to the owner before anything else changes.
- **Reference resolution.** No HQ Veyra panel exists (only `Veyra.jpeg`). The colour samples use the composite at delta E 10. The close-up items in section 2.3 are judged by the owner against the reference at 3x zoom. The sparkle count is counted on the render, not the reference.
- **Entry point.** `?world=veyra` is the only entry until the landing page phase. Veyra gets her own no-WebGL poster of the intro.
- **Tools.** `scripts/check_stage.py`, `silhouette.py`, `compare.py`, `perf.mjs` and `blender/security/` exist on the branch. They are extended to take a world id (engine item 11), and `blender/vault/` is written alongside the security scripts. The P2 mask is made with `silhouette.py` from `Veyra.jpeg`.
- **Placeholder images.** The project screenshot and carousel use crops of the storyboard's own Vault OS screen (P3, P5), clearly marked as placeholders until the owner supplies real screenshots.

## 11. Left to the builder

- Exact shader maths for the jelly depth term and sparkles, within the targets.
- The pendant swing formula and constants, within the bounds.
- Kit modelling details, lightmap resolution, compression and level-of-detail distances.
- Exact pose traces, slot positions and sequence timings within the ranges, tuned live.
- File structure inside the Veyra world folder.
- Tests beyond section 9.

## 12. Calls I made (for the owner to check)

1. **Colour tolerance** is delta E 10 (Nox: 8), because Veyra's reference is a 488 px composite panel, not an HQ panel. If the owner supplies an HQ Veyra P2, the tolerance drops to 8.
2. **The frame-rate floor** is 40 fps at tier low for the intro (Nox measures 38 to 49 there).
3. **The padlock clicks during the entrance** (the vault recognising its keeper); the portal does not open.
4. **Veyra's turn on arrival** is a slow 200-degree glide-turn, not Nox's quick 360 spin, to keep her calm.
5. **The tech-focus face** is "interested" (brows up, eyes wide), not Nox's narrowed focused grin.
6. **Pendants appear by blooming from her cups**, not by being blown.
7. **The portal stays visible** behind her in the intro, softly lit and off to the right.
8. **Content uses storyboard text** as marked placeholders until the owner supplies Vault OS facts.
9. **Personality starting values** are the table in section 7.8, tuned live.
10. **The frame-rate fallback order** is in section 10.1. Veyra's own look is never cut to meet a budget.
11. **Milestone 1 uses a graded stage backdrop** fitted to P2's water, before the world exists.
