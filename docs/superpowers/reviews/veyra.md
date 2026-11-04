# Veyra world review log

Spec: `docs/superpowers/specs/2026-11-03-veyra-3d-design.md`. Plan: `docs/superpowers/plans/2026-11-03-veyra-world.md`.

## Engine as landed

Task 1, step 1: `rg "export (const|type|interface|function) (WorldBundle|validateBundle|faceAnchor|HEAD_EFFECTS|PLACEMENTS|APPEARS|SELECTS|WORLDS|resolveWorld|themeVars|clampCharacterConfig)" src/engine src/worlds`, run as written, on base f52804f. Every name exists under the name the plan uses; the plan gives no file paths, so only the locations are recorded.

| Name | Kind | File |
|---|---|---|
| `WorldBundle` | interface | `src/engine/types/bundle.ts` |
| `validateBundle(bundle, worlds = [])` | function | `src/engine/types/bundle.ts` |
| `faceAnchor(bundle, stage)` | function (takes `Pick<WorldBundle, 'character' \| 'poses'>`) | `src/engine/types/bundle.ts` |
| `HEAD_EFFECTS` (`none`, `glyphs`) | const | `src/engine/character/headEffects/index.ts` |
| `PLACEMENTS` (`orbit`) | const | `src/engine/artifacts/strategies.ts` |
| `APPEARS` (`blow`) | const | `src/engine/artifacts/strategies.ts` |
| `SELECTS` (`suctionHold`) | const | `src/engine/artifacts/strategies.ts` |
| `WORLDS` (`Record<WorldId, WorldBundle>`, today `{ nox }`) | const | `src/worlds/index.ts` |
| `resolveWorld(search)` (returns `{ bundle, warning? }`) | function | `src/worlds/index.ts` |
| `themeVars(theme)` | function | `src/engine/ui/theme.ts` |
| `clampCharacterConfig(config)` | function | `src/engine/config/validate.ts` |

No name differs from the plan. Notes for later tasks: `WORLDS` is typed by the `WorldId` union, so adding Veyra means widening that union with `'veyra'`; `validateBundle` also takes the list of other world ids (for the unique `sequences.projectId` rule).

Reference tooling as landed (read from `scripts/check_stage.py`):

- `--stage intro` is only read in world mode (`--world`). Without `--world` the script runs the panel mode, which ignores `--stage`, reads `stage_samples.json["2"]` and compares against the high-quality image named in it. Veyra's `stage_samples.json` therefore carries an `hq` block that points at `public/veyra/ref/p2.png`, so the brief's command (`--stage intro --world-id veyra`, no `--world`) is a real self-check of the 13 sample points (it prints max channel delta, not delta E).
- World mode (`--world --stage intro --world-id veyra`) needs `world_samples.json`, `world_reference.json` (not in the plan's file list; added, it is `{ image, origin, pxPerUnit, size }`) and `<capture>-mask.png` beside the capture. It prints delta E. It compares fixed 7 x 7 px patches, not the sample `size`, and the capture must be the same size as the reference image (488 x 495 for Veyra: a later world capture has to be registered to that size).
- Sample points in `stage_samples.json` and `world_samples.json` are world units: x = (px - 244) / 100, y = (247.5 - py) / 100 (1 unit = 100 px, origin at the panel centre).

## Task 1: the P2 reference

Files: `public/veyra/ref/p2.png` (copy of the native P2 panel, 488 x 495, byte for byte; nothing written in the main checkout), `public/veyra/ref/p2-mask.png`, `src/worlds/veyra/review/{targets,stage_samples,world_samples,world_reference}.json`, `src/worlds/veyra/review/targets.test.ts`.

### Mask

`scripts/silhouette.py` only prints head widths from the bright rim line (it reads `Nox.jpeg`); it does not write a mask. Nox's world mask comes from a render capture, which does not exist for a painting. The P2 mask was therefore made by colour segmentation with OpenCV (scratch script, not committed):

1. Candidate pixels: G >= 95, G - R >= 40, B >= 0.7 G, or a warm bright pixel (R > 150 and G > 150: face glow, blush, mouth, cups). Rows above y = 192 and below y = 428 are dropped (title, caption, nameplate), and a circle of radius 17 at (432, 392) removes the bubble beside the right arm.
2. 3 x 3 close, keep the largest connected component, fill interior holes (eyes, dark centre of the dome).

The result was checked by eye in a dimmed overlay: it covers the head, face and all eight arms, excludes the title, the lock, the nameplate, the bubbles and the kelp. Known looseness: a 2 to 3 px glow halo is included around the outline; the two darkest tentacle tips at the lower left (near x 150 to 165, y 410 to 425) are partly missing; the lower arms stop at y 427 where they meet the nameplate. Mask area 46713 px; bbox x 50 to 425, y 196 to 427.

### Samples (13)

Area = a square of `size` px whose centre pixel is the listed (x, y) (columns x - floor(size/2) up to x - floor(size/2) + size - 1). `rgb` in `targets.json` is the measured mean of the native panel at that area, rounded; the test holds every sample to that within 1 per channel.

The measured values differ from the spec 2.1 table in places. Coordinates were kept as the spec lists them; the table's rgb is not what the panel reads there. The spec value and the measured value:

| Region | Spec rgb | Measured rgb | Max channel gap |
|---|---|---|---|
| Head crown | 4, 170, 188 | 5, 171, 188 | 1 |
| Head middle | 1, 95, 103 | 1, 96, 103 | 1 |
| Head side | 0, 112, 144 | 7, 124, 154 | 12 |
| Face glow | 194, 213, 147 | 192, 211, 147 | 2 |
| Chin | 44, 151, 122 | 49, 156, 126 | 5 |
| Blush | 249, 190, 138 | 250, 188, 136 | 2 |
| Mouth line highlight | 254, 244, 189 | 211, 202, 146 | 43 |
| Arm top surface | 21, 183, 158 | 25, 185, 162 | 4 |
| Arm body | 11, 189, 171 | 11, 180, 170 | 9 |
| Sucker cup rim | 237, 237, 168 | 240, 234, 172 | 4 |
| Water outside head | 1, 43, 55 | 1, 43, 55 | 0 |
| Mid water | 5, 21, 31 | 4, 23, 33 | 2 |
| Upper water | 3, 74, 107 | 3, 73, 106 | 1 |

Searching within 8 px of each point shows the gap is not a one-pixel slip in the coordinates for the mouth (best 3 x 3 match nearby is still 15 off: the highlight is a thin line, averaging 3 x 3 pixels dilutes it). For Head side and Chin the spec value appears a few pixels away. This is the spec author's rounding, recorded here for the owner; it is not corrected. The mouth sample in particular is a weaker target than its name suggests.

Mid water: the fixed 7 x 7 patch in `check_stage.py` reads (1, 9, 14) at that point, the 16 px area reads (4, 23, 33): the point sits on the edge of the dark rock. A render checked with `check_stage.py` is therefore judged on the darker 7 x 7 value.

Global checks: face glow red 192 minus head middle red 1 = 191 (target at least 60).

### Mean inside the mask (spec 2.1 global check)

Mean (69, 161, 144), mean per-pixel HSV saturation 0.695, mean HSV value 0.651. Recorded in `targets.json` `meanInside.rgb` (tolerance 12 per channel, saturation 0.04). `world_samples.json` uses the same mean and brightness 0.651 +- 0.04. This is a segmentation mean; the halo and the missing dark tips move it by a few RGB points.

### Shape numbers measured on the P2 mask (spec 2.2)

Targets are carried unchanged in `targets.json`; these are what the painting gives, for later tasks to know.

- Top of the head: the bright rim is at y = 199.5 px (world 0.48, target 0.44 to 0.52). The mask top is 0.515 because of the halo.
- Arm span: mask width 3.76 units (x 50 to 425); target 3.75 to 4.05. It is at the bottom of the band.
- Dome half-width: the head is tilted and merges with the arms below y = -0.1, so the widest clean row is y = -0.125, width 0.84 half-width (x 163 to 330). The spec says 0.92 +- 0.04 (0.88 to 0.96). The painting reads narrower than the spec on that row. Reported in the Task 1 report.

### Self-checks run

- `npx vitest run src/worlds/veyra/review`: 6 tests pass.
- `python scripts/check_stage.py public/veyra/ref/p2.png --stage intro --world-id veyra`: 13 colour samples, delta 0, PASS, exit 0.
- `python scripts/check_stage.py public/veyra/ref/p2.png --world --stage intro --world-id veyra`: mean, saturation, brightness ok; 13 regions delta E 0.0, PASS, exit 0.

## Task 2: the bundle on a stage backdrop

Files: `src/worlds/veyra/{bundle,character,poses,swim,artifacts,theme}.ts`, `place/config.ts` (`VAULT_STAGE`), `sequences/{defaults,index}.ts` + `state.theatre.json`, `content/*`, `bundle.test.ts`; `public/veyra/world/stage.glb` (from `blender/vault/empty_kit.py`), `public/veyra/poster-intro.webp`; registry entry in `src/worlds/index.ts`. Engine changes (each with a test): `Padlock` title icon (`ui/titleIcons.ts`), `layoutOrbits` with no shells returns no orbits and `TechBubbles` draws and offers none (`artifacts/bubbleOrbits.ts`, `TechBubbles.tsx`), `Kit.tsx` builds the chain geometry only when the layout has chains (an empty kit has no `chain` piece), `react` and `cloudflare` logo slugs (`artifacts/logoTexture.ts`), `scripts/theatre-seed.mjs --world=<id>`.

### Empty kit
The engine needs no node name or extra for a kit with nothing in it, except that `Kit.tsx` asked for `chain` and `chain_lod1` unconditionally (a throw: "kit piece missing: chain"); that is now guarded by `layout.chains.length`. No `nox_bake` extras are needed (read only from a `near.glb`, and the world has none: the kit level without a baked near world is the real-time-lit level). `stage.glb` is 140 bytes: one empty scene.

### Look (step 5, no owner gate)
Stills (stage-capture, `intro`, frozen, 506 x 504 at scale 2): `docs/superpowers/reviews/assets/veyra/t2-intro.png`; beside P2: `docs/superpowers/reviews/assets/veyra/t2-intro-vs-p2.png` (left P2, right the render). A 1536 x 1024 capture is the no-WebGL poster, `public/veyra/poster-intro.webp`.

What the render shows against `p2.png`: an eight-armed teal octopus in roughly the P2 pose, head leaning about ten degrees with the viewer's-left eye lower, large green-iris eyes with upper-left catchlights, peach blush on small cheek lobes, a small smile, a warm cream-green glow under the face, cream-gold cups on the arm undersides, T1 rising to the left with a hook, T2/T7 and T3/T6 spiralling out, T4/T5 hanging at the centre, title with a padlock and the nameplate in place, on a graded dark teal-blue water with light shafts and ambient bubbles. What it does not yet match, honestly:
- **Material:** the head and arms are the matte opaque skin shader (Nox's), not jelly: no translucent depth term, no dense sparkles (a handful of specks), no soft wet highlight. Task 3.
- **Arms:** slimmer and a little longer than P2's, so the span reads wider; the cups are small and sparse against P2's large scalloped cream frill; the tips are hooks of about three quarters of a turn, not rolled coils; the two centre arms are short and crowd the chin. P2 shows nine or ten arms; the eight clearest are traced. Tasks 4 and 7.
- **Water:** one flat graded dark teal; P2 has dark rocks, kelp, plants, green glints and a darker, bluer mid water. Milestone 2.
- **Colours** (my read of the capture at P2's sample positions on a rough registration, CIE76 against the measured native values): upper water 6.8, mid water 5.6, water outside the head 8.3 (all within 10); head crown 13.4 and arm top 10.6 (over 10: the head is matte and darker than the jelly crown); the face glow reads over-exposed (255, 255, 199 against 192, 211, 147 at the spot I sampled). Not a checked pass: the registration is approximate and `check_stage.py --world` needs a capture at 488 x 495. Task 7 does the real fit.
- **Title block:** the engine's intro title shows the two-line introduction under the tagline, which P2 does not; the lock is smaller than P2's.

### Decisions and flags for later tasks
- `faceAnchor` returns `[x, y, z]`; the plan's `.y` test reads `[1]`.
- `resolveWorld('?world=veyra')` and the unique project id are tested in `src/worlds/index.test.ts`: a world's files may not import the registry (boundary test).
- Artifacts: zero shells and `choosableIn: []` (no orbs, no buttons) until Task 14; a single placeholder shell would have drawn 12 orbs over the face.
- Entrance: a placeholder sheet with nothing keyed: she is present in the intro pose from the first frame (length 1 s). `spiral: true` is the engine's only path (Task 17). The head swell, blow and arrival sheets are Nox's keys, seeded into `state.theatre.json`.
- Swim poses are copies of the intro arms (stretch 1).
- AWS has no mark in `simple-icons`; its orb will show no logo (Task 14 decides).
- Link addresses are placeholders (`example.com`); the screenshot media joins with the detail view. The poster is a capture of this backdrop, to be retaken with the finished look.
- `check_stage.py` samples: the P3 and P5 panel boxes in `stage.panels` are read off the native panels at 100 px a unit from each panel's centre; Milestone 3 registers them on her face.

## Task 3: jelly skin mode and sparkles (engine variant)

Engine: `SkinDetail.surfaces?: { mantle, arms }` of `SurfaceLook { mode: 'skin' | 'jelly', jelly?, sparkle }` (`config/types.ts`, beside `SkinDetail`; `SKIN_MODES` is the closed table). The jelly code and the sparkle code are spliced into the skin fragment shader only for a surface that has them, each behind its own define (`JELLY`, `SPARKLE`); a plain skin surface compiles the very program it did before (sha256 of Nox's fragment and vertex text pinned in `skinMaterial.test.ts`, taken before the edit). Every jelly colour and the core's centre are per-material uniforms from the config; the sparkles take `palette.wet`; the shimmer `uSparkleWave` (0 to 1, for Task 18) and the twinkle clock `uSkinTime` are shared by every surface. One pass, no render target. The clamp keeps `sparkle` in [0, 400], an unknown mode reads `'skin'`, and a missing or unreadable jelly colour reads the character's own (`rimTop`, `headEdge`, `blotch`, `glow.core`); `validateBundle` names an unknown mode and an unreadable jelly colour.

Veyra's start values (`src/worlds/veyra/character.ts`, Task 7 tunes): mantle rim `#3ee6f0` (power 4), crown `#04b4c8` above normal-up 0.5, depth `#015f67` at strength 1, core `#f0eca0` at 0.35, 50 sparkles per square unit; arms rim `#46e8ec` (power 4), crown `#30dcc8`, depth `#0a9a8c` at 0.35, core 0.3, 35 sparkles. The skin detail under it is turned down (no blotches, tint 0.25, fewer droplets).

Stills (stage-capture `intro`, frozen, 506 x 504 at scale 2): `docs/superpowers/reviews/assets/veyra/t3-intro.png`; the head at 3x beside P2's: `docs/superpowers/reviews/assets/veyra/t3-head-closeup-vs-p2.png` (left P2, right the render, registered by eye on the head); the back (`yaw=180`): `docs/superpowers/reviews/assets/veyra/t3-back.png`: round and glassy, the rim and the sparkles continue round it (spec 2.3), and the warm core shows faintly through the dome from behind.

Numbers (render down the head's middle, 7 x 7 px at scale 2, against the P2 column at x 256): crown (36, 195, 213) vs P2 (3, 199, 206); middle (23, 107, 114) and (28, 110, 114) vs (1, 90, 112) and (0, 96, 103); before the jelly (Task 2) the middle read (31, 135, 147), milky. About 85 bright specks inside the head's front ellipse (91 bright points less the eyes' catchlights), against the close-up checklist's 40.

What reads right: the dome now has a bright cyan fresnel rim all round, a lighter cyan crown cap, a darker denser middle facing the viewer, and fine specks scattered over head and arms, a few larger; it reads as glassy rather than matte. The arms are a more saturated aqua with a cyan top edge.

What is not there yet, honestly:
- **A grey cast:** every jelly sample carries 20 to 35 points of red that P2 does not (crown 36 vs 3, middle 23 to 28 vs 0 to 1): it greys the teal a little. Not from the jelly colours (their red is 1 to 4); it comes from what lies over the jelly (bloom from the over-bright face glow, the halo, the skin's grazing reflections). Crown delta E is over 10 on that red alone. Task 7.
- **Face glow over-exposed** (255, 255, 197 at its heart against P2's 249, 228, 151), as in Task 2; the jelly's own core is kept low (0.35) so it does not add much. The face glow's spread is the skin's ramp (Task 7).
- **Crown shape:** P2's crown is a broad soft cap; the render's is a little narrower and its lower edge is visible as a band. `crownHeight` 0.5 is a start.
- **Rim width:** the jelly rim plus the halo give a thicker glowing edge than P2's thin bright line, on the arms most.
- **Wet highlight:** spec 7.2's one soft broad specular from above left is not part of this task; the skin's own wet glints remain where the detail shows.
- **Inner depth:** the "thick" middle is a darker colour, not real parallax: there is nothing seen through the jelly.
- Twinkle and the shimmer wave are motion: not judged in stills (owner checks live).

### Task 3 fix round 1 (review: the core rides the head frame; the crown edge stays soft)

- The warm core was placed in world axes (face glow position plus an unrotated, unscaled offset): turned round, the "behind the face" core landed in front of the far-side face, and idle head turns slid it. Now each jelly surface's `uJellyCorePos` is written each frame as (`glow.center` + `coreCenter`) through the head's world matrix (`jellyCoreWorld`, one preallocated vector per surface, no per-frame allocation), the same frame the face glow rides. Tested with a turned, scaled and moved head.
- The crown fades in over a fixed soft width (0.4 of the normal's up component) above `crownHeight`, which is now held at 0.9 at most, so the cap never gets a hard edge (the old `min(h + 0.3, 1)` narrowed it toward the top and was undefined at 1).
- The face glow's spread and reach are held above zero (the shaders divide by them); `validateBundle` names one that is not.
- The no-colour check covers the sparkle code as well as the jelly code.
- Stills retaken (same paths: `t3-intro.png`, `t3-head-closeup-vs-p2.png`, `t3-back.png`). Front samples barely move (middle (25, 107, 114), crown (38, 191, 208)); the crown's lower band is softer (at 450 px: 150 green, was 165). The back view shows the cause of the grey cast: the same dome from behind reads (10, 105, 113) in the middle, red about 10, against 25 on the front: the extra red on the front comes from the face glow's light (bloom), not from the jelly. Task 7.

## Task 4: cup frill style (engine variant)

Engine: `SuckerSettings.style?: SuckerStyle { rimWidth, scallop, edge, rim, hollow, glow }` (`config/types.ts`). With a style, `createSuckerCup(detail, style)` lathes a raised frill cup: a round hollow, a rim `rimWidth` wide whose crest stands `scallop` cup radii above the skin, and a wall that falls from the rim's lip to below the skin (no gap under the cup). The placements and bends are untouched: the frill sits on the same skin as Nox's discs. `createSuckerMaterial(palette, light, style)` swaps the frill's colour into a copy of Nox's program at fixed anchors (an anchor that is not found once throws): the colours and glow are uniforms from the config (`uFrillEdge`, `uFrillRim`, `uFrillHollow`, `uFrill`), the frill glows at `glow` in place of Nox's boost, and edge-on cups are no longer flattened toward their face (the frill is meant to break the arm's outline). Absent `style` is Nox's: sha256 of his cup geometry at all three tiers' detail (32, 24, 16), the shadow ring, every arm's layout, placements and bends, and both cup programs' text were taken at aaf1158 before the edit and are pinned in `suckerRow.test.ts` and `suckerMaterial.test.ts`. Two styles differing only in colours give the same geometry and the same program text (tested). The clamp holds rimWidth to [0.05, 0.5], scallop to [0, 1], glow to [0, 3]; a missing or unreadable colour reads the character's own `suckerEdge`, `suckerHot`, `suckerHollow`; `validateBundle` names an unreadable one (`character.suckers.style.hollow`). The tier detail (`suckerScale`) still sets the cup's segments.

Measured on a straight round test arm: frill cups at scallop 0.6 reach 0.64 to 0.76 cup radii past the arm's radius (brief: at least 0.3); Nox's discs reach 0.16 to 0.27 (the measure is not vacuous).

Veyra's values (`src/worlds/veyra/character.ts`): rimWidth 0.22, scallop 0.6, glow 1.3 (as the plan sets them); edge `#ece4a4` and rim `#fcf4c4` (a little brighter than the P2 cup sample (224, 220, 156), since the key light and bounce darken them), hollow `#5e8a6c` (darker teal-cream). Beyond the plan's list, also tuned while looking: size 0.26 to 0.3, spacing 2.2 to 2.05 (packed nearly touching, so the row reads as a band), tilt 26 to 22 (a little more edge-on, so the row reads along the edge), contact shadow 0.6 to 0.3 (P2's band has no dark under it).

Stills: `docs/superpowers/reviews/assets/veyra/t4-intro.png` (stage intro, 506 x 504 at scale 2); `t4-cups-closeup-vs-p2.png` and `t4-cups-right-vs-p2.png` (3x, left P2, right the world capture at P2's registration, 488 x 495); `t4-yaw40.png` (turned 40 degrees: the frill from three-quarters).

Numbers: cream pixels on the arms (R and G over 150, B 25 below both, the face excluded): render median (221, 224, 165) vs P2 (227, 225, 170), mean (219, 223, 165) vs (221, 223, 172); before this task (t3) (216, 215, 162). The `sucker cup rim` sample of check_stage lands in the water just under T2's frill (#2d3f40): the arms do not register with P2's yet (pose and span are Task 7's), so it says nothing about the cups' colour.

What reads right: the cups are cream with a brighter rim and a darker teal-cream centre, in the family of P2's; on the lower arms and seen from three-quarters they stand proud of the outline as a scalloped edge, smaller toward the tips, and they glow without a dark band under them.

What is not there yet, honestly:
- **Band width:** P2's frill is a wide continuous cream band with small scallops on its outer edge; the render's is a row of touching cups, narrower, with the arm's teal between them on the upper arms (T2, T7 near the root read as a thin scalloped line). The cream underside glow between cups is the skin's (`glow.underside`, `belly`): Task 7.
- **Root cups:** Nox's rule makes the first cups small next to the body (0.35 of full size); P2's cups are large right up to the root.
- **Which edge:** on P2's right arms the frill runs along the arms' upper inner edges; the render's runs along the lower edges (the arms' sucker side and pose, Task 7).
- **Hollows:** P2's dark notches are partly the water seen between scallops; the render's hollows are inside each cup and read lighter.
- Cup colour within 6 points per channel of P2 on the medians, but P2's band is a touch warmer (more red and blue).

## Task 6: the face (with Task 5's focused override)

No engine change (ruling R-V4: `resolveExpressions` and `CharacterConfig.expressions` landed in E02). Veyra's `face`, `facePalette` and `expressions` (`src/worlds/veyra/character.ts`) re-traced from the 3x P2 panel, comparing a `?view=` zoom of the frozen intro at 3x (300 px a unit, the box x -1..1, y 0.14..-1.19, the same box as the P2 crop (432, 700)-(1032, 1100) of the 3x panel) beside the crop. Every face feature in spec 7.3 already had a field in the engine's face config: nothing was added.

Changed from Task 2's first fit, each to close a gap seen beside P2:
- **Eyes:** a little narrower than tall (rx 0.17, ry 0.19); the iris larger (0.82 x 0.93 of the eye) and less far toward the nose (inset 0.2), so P2's narrow pale crescent shows on the outer side; the pupil large (0.74) and raised (drop -0.08), so the iris is near black round it and the green is a thick crescent at the bottom with a gold-green pool (P2, and P3 for the same eye); the iris glows only low down. Two catchlights, the large one at the upper left and a small one high on the right (P2's right eye, P3's both eyes). A dark border all round (P2), the bottom no longer teal.
- **Sclera:** warm cream (P2's crescent sample 252, 228, 187) instead of a pinkish edge.
- **Brows:** the arc higher (ends up 0.015, middle up 0.04; with the shorter eye the gap over the lid grows by about 0.05: P2 has about an eye's radius of face between brow and lid), centred over each eye, thinner (0.02, was 0.022; Nox 0.028), dark teal (P2's brow 0, 39, 47).
- **Mouth:** up 0.065 (centre y -0.255) and narrower (halfWidth 0.105), a little deeper (0.06) and thicker (0.017): P2's closed smile sits between the eyes' lower edges and is 73 to 77 px wide at 3x (render 73).
- **Blush:** up 0.075 and in 0.03 (centres x 0.49, y -0.285), a little smaller (0.125 x 0.062); peach (`#ffc092`). Sample at the spec's blush pixel (native 215, 328): render (250, 194, 149) vs P2 (248, 190, 138).
- **Focused (Task 5):** `expressions.focused` = browLift 0.55, browTilt 0.1, lidRest -0.05, mouthCurve 0.5, mouthOpen 0.12, blush 0.25: brows up, eyes a touch wider, a small smile, in place of Nox's narrowed open grin. Every other id is the base table (tested). The clamp leaves her values unchanged (tested).

Tilt: the intro keeps 0.18 rad (10.3 degrees). Measured on the render's catchlights the eye line leans 9.9 degrees (0.6 degrees the other way with the tilt set to 0, so the head turns rigidly); P2's eye line, on its pupils, leans 11.8 degrees. Within the spec's "about 10"; left as is, since Task 2 placed the crown with it.

Nox: all seven of his expression stills (`?expression=<id>`, intro) captured before and after are bit-identical (mean 0, max 0); a unit test draws his seven faces through `resolveExpressions(NOX)` and the base table and gets the same draw calls.

Stills (`docs/superpowers/reviews/assets/veyra/`): `t6-face-vs-p2.png` (left the P2 crop at 3x, right the render at the same box), `t6-eyes-vs-p2.png` (the eyes and mouth at 4.5x), `t6-expressions.png` (gentle, focused, happy at 3x), `t6-intro.png` (the stage intro).

What reads right: big round eyes with near-black irises, a green-gold crescent low in each, two white catchlights, a cream crescent on the outer side, two lashes at each outer corner, thin high brows, a small dark smile with dimples, peach ovals under the outer corners; the focused face reads interested, not narrowed.

Not there yet, honestly:
- **Pupils and lid lines are not black in the render:** the scene's light, haze and bloom over the head lift them to dark grey-teal (P2's are pure black). That is the head's material and the bloom (Task 7), not the face canvas. **Task 7:** fixed by the bloom cut (see Task 7, "Task 6's gaps").
- **The right blush is dim:** the viewer's-right cheek is in shade (render about 187, 152, 119 there; P2 250, 212, 157). The face light is Task 7's. **Task 7:** fixed by the face glow re-fit (see Task 7).
- **The right eye:** P2's head turns a little toward the viewer's right, so its right eye is narrower than its left; the render's face is frontal (the head's yaw is the pose's, Task 7). **Task 7:** tried and left frontal (see Task 7).
- **Face glow:** still over-exposed round the mouth (Task 3's note; Task 7). **Task 7:** face glow delta E 20.2 to 7.8, chin 52.5 to 9.0.
- **Deviation from the spec text (the painting wins, ruling R-V8):** the happy face's open smile is dark maroon inside with a pink tongue, as P3 paints it; spec 7.3's text says warm pink inside. One colour holds it: `facePalette.mouthInside` (`#7a3a40`; the tongue `#f08a8e`).

## Task 7 - Milestone 1 gate: PENDING OWNER REVIEW

Look at it live: http://localhost:5191/?world=veyra&stage=intro (moving) and http://localhost:5191/?world=veyra&stage=intro&freeze (the frozen frame the numbers are taken on). Under the overnight rules this gate is recorded as pending your review (ruling R-V2); nothing after it assumes you have passed it.

Stills (`docs/superpowers/reviews/assets/veyra/`, left P2, right the render, the same box):
- `t7-intro-vs-p2.png`: the whole P2 frame beside the frozen intro (1.5x).
- `t7-face-closeup-vs-p2.png`, `t7-dome-closeup-vs-p2.png`: the face and the dome at 3x (the native 3x panel beside a 3x capture of the same view box).
- `t7-arms-left-vs-p2.png`, `t7-arms-right-vs-p2.png`: the arms, cups and curls at 3x.
- `t7-intro.png`: the render alone (488 x 495, P2's frame); `t7-page.png`: the whole page with the title and the nameplate.

### Numbers (frozen intro, `check_stage.py --world --stage intro --world-id veyra`: exit 0)

Delta E (CIE76) of each 7 x 7 patch against P2, before Task 7 (r0, the Task 6 commit) and now:

| Sample | P2 | Before | Now |
|---|---|---|---|
| Head crown | #04a7b9 | 1.4 | 4.0 |
| Head middle | #016067 | 5.0 | 3.4 |
| Head side | #087997 | 16.7 | 6.8 |
| Face glow | #b9d192 | 20.2 | 7.8 |
| Chin | #32997c | 52.5 | 9.0 |
| Blush | #fbbd89 | 6.9 | 4.9 |
| Mouth line highlight | #c3b781 | 17.8 | 7.6 |
| Arm top surface | #17baa1 | 3.1 | 8.2 |
| Arm body | #12aba3 | 13.5 | 8.0 |
| Sucker cup rim | #e5e6a9 | 72.0 | 5.6 |
| Water outside head | #012c38 | 7.3 | 2.1 |
| Mid water | #01090e | 12.2 | 9.5 |
| Upper water | #054d6d | 6.0 | 7.1 |

All 13 within 10 (before: 7 misses). Inside the engine's silhouette: mean (71, 162, 142) against (69, 161, 144) +-12 (before (86, 170, 145), a miss); saturation 0.661 against 0.655 to 0.735 (before 0.576, a miss); brightness 0.649 against 0.611 to 0.691 (before 0.675).

Shape, measured like for like (the same colour segmentation on the render as made `p2-mask.png`, rows 196 to 427; the recipe and tolerances are in `targets.json` `measured`). Re-run with `WORLD=veyra node scripts/world-capture.mjs intro .tmp/veyra-intro.png` then `python scripts/veyra_shape.py .tmp/veyra-intro.png` (exit 0 when the held numbers pass). Its output on the committed frame:

```
recipe on P2 vs p2-mask.png: IoU 0.992
p2 mask  top 0.515 span 3.75 halfwidth@y[0.175, 0.075, -0.025, -0.125] [0.72, 0.77, 0.8, 0.835]
render   top 0.505 span 3.72 halfwidth@y[0.175, 0.075, -0.025, -0.125] [0.69, 0.755, 0.815, 0.85]  IoU 0.830, excluding the extra arms 0.855
engine   top 0.485 span 3.71 halfwidth@y[0.175, 0.075, -0.025, -0.125] [0.665, 0.735, 0.79, 0.83]  IoU 0.832, excluding the extra arms 0.857
ok   p2 half-widths are the recorded ones
ok   visible half-width within 0.03
ok   span within 0.05 of 3.75
ok   IoU excluding the extra arms >= 0.85
PASS
```


| | P2 | Before | Now |
|---|---|---|---|
| Visible head half-width at y 0.175 / 0.075 / -0.025 / -0.125 | 0.72 / 0.77 / 0.80 / 0.835 | 0.73 / 0.805 / 0.86 / 0.905 | 0.69 / 0.755 / 0.815 / 0.85 (all within 0.03) |
| Head top (segmented) | 0.515 | 0.505 | 0.505 |
| Arm span (segmented) | 3.75 | 3.73 | 3.72 (within 0.05) |
| IoU with the P2 mask | | 0.781 | 0.830; 0.855 with the two extra P2 arms left out of both |

The config head is halfWidth 0.88, top 0.5 (spec ranges 0.88 to 0.96 and 0.44 to 0.52 hold). The spec's 0.88 to 0.96 is the config dome; the visible dome is narrower because the rim fades into the water, so the comparison with the painting is made on the picture, not the config. P2's 3.75 span includes its arms' halo glow; segmented the same way the render reaches 3.72. P2 paints nine or ten arms and Veyra has eight (spec 2.5): the two boxes where the extra arms hang are left out for the second IoU figure.

### The five things to look at, with my verdict

1. **The face reads warm: yes.** The warm-on-cool contrast is there (face glow 7.8, chin 9.0, blush 4.9): a soft yellow-green glow from the mouth up to the eyes, peach cheeks, a cool dome above. The glow is a touch yellower and brighter than P2's at its centre.
2. **The head reads as glassy jelly, not plastic: mostly.** A bright cyan rim, a lighter crown, a darker clear middle and twinkling flecks; nothing reads as a hard plastic highlight. It is cleaner glass than P2's painterly wet jelly: P2 has soft streaks and a broad sheen inside the dome that the render has not, and the render's flecks are larger and more even (48 counted on the head's front at 3x; P2's are finer). A wet-highlight engine addition was tried and dropped (below).
3. **The cups read as a frill: partly.** A cream band of touching raised cups along each arm (the rim 5.6), smaller toward the tips. P2's band is wider and continuous with small scallops on its edge; on the right arms P2's frill runs along the upper edge where the render's runs along the lower.
4. **The spirals are tidy: yes for five.** T2, T3, T6, T7 and T8 end in a full turn on the traces (421, 383, 384, 391 and 375 degrees); T1, T4 and T5 end in hooks (236, 186, 242 degrees), as P2's rising and hanging arms do. Checked on the rendered 3x stills (`t7-arms-left-vs-p2.png`, `t7-arms-right-vs-p2.png`), not only the traces: all five close their coil, the tip coming back inside its own arm. T2's had read about three quarters closed on the render (the tip's taper hides the last part of the trace), so fix round 1 lengthened its curl by one point (364 to 421 degrees on the trace). All curls roll the same way on each side and none crosses another arm.
5. **She is not a recoloured Nox: partly.** Her material (jelly glass, flecks, cream frill), palette, face and pose are her own. The construction still shows Nox: a round dome on a short neck with the arms leaving from under it. P2's head base flows into the arm roots, lit warm from the face glow; in the render a teal neck shows between the arms under the chin.

### Task 6's gaps handed to Task 7

Measured on the frozen intro at 3x (P2's view box, 1464 x 1485) against the 3x panel; darkest 7 x 7 (pupil) or 3 x 3 (lid) patch, warmest 9 x 9 (blush):
- **Pupils and lid lines: fixed** (the bloom cut). Pupils render (4, 8, 6) and (4, 9, 6), P2 (0, 3, 3) and (0, 0, 5); the upper lid lines (9, 14, 12) and (8, 12, 10), P2 (0, 0, 0) on its left eye.
- **The right blush: fixed** (the face glow re-fit). Both cheeks render (251, 191, 146) at their warmest; P2 (254, 183, 131) left and (251, 202, 146) right.
- **Face glow over-exposed: fixed** (face glow delta E 20.2 to 7.8, chin 52.5 to 9.0).
- **The head's turn to the viewer's right: tried, left frontal.** The intro pose has no head-only yaw; its yaw (`body.yaw`, 0 in `poses.ts`) turns the arms with the head. At 0.15 rad either way the gate broke: 7 and 3 sample misses, the cups and the blush off their samples, the IoU without the extra arms 0.79 and 0.81. Matching P2's turn needs the traces and the face re-fitted together at the new yaw; it is in the weaknesses below.

### Remaining weaknesses (mine)

- **The neck and the arm roots** (point 5): the biggest difference from P2 at a glance. It is the shared body construction, not a value in her bundle.
- **The face sits a little high on the dome** and the eyes are a little larger than P2's at 3x (Task 6's fit, made before Task 7 moved the head); the dome continues below the cheeks where P2's head ends.
- **Flecks larger and more even than P2's** (the sparkle size is an engine constant).
- **No broad sheen inside the dome:** P2 has a soft wide wet sheen and streaks inside the dome's upper left; the render has none. The wet-highlight engine addition meant to give it was dropped (see "What changed": it either washed the head milky or did not show).
- **The face is frontal:** P2's head turns a little to the viewer's right (its right eye narrower); hers does not (see "Task 6's gaps").
- **The frill band** is narrower than P2's (point 3).
- **Thin margins:** saturation 0.661 (floor 0.655); mid water 9.5, chin 9.0, arm top 8.2 (was 3.1) and arm body 8.0 (limit 10); the head crown 4.0 (was 1.4); the visible half-width at y 0.175 is 0.69 against P2's 0.72, exactly at the 0.03 tolerance; the IoU without the extra arms 0.855 against 0.85, and those exclusion boxes were chosen after measuring. The arms are a little brighter and more cyan than P2's.
- **The backdrop is plain** (Milestone 2: the vault kit and far plate are not built).
- **The intro text touches the dome:** the last line of the two-line introduction ("secure access control.") sits on the dome's halo at the full page (`t7-page.png`). P2 shows only the tagline, no introduction, so the painting does not say where the paragraph goes. The introduction is storyboard placeholder text (`content/veyra.ts`); a shorter one, none, or the engine's title block moved up are your choice. Not changed here.
- **The nameplate** was Nox's violet-black glass; it is now a theme token (`plate`) and hers is P2's dark teal glass.

### What changed, by group (the plan's order)

1. **Head shape:** centerX 0.25 to 0.19, halfWidth 0.92 to 0.88, top 0.48 to 0.5.
2. **Arm traces:** every trace re-fitted against the P2 mask by measuring band middles and widths at each trace point (render against painting); the root radii set per arm (0.15 to 0.24; P2's upper arms are thick at the root, which wins over spec 7.1's slimmer roots); T7's curl one point longer to a full turn (and T2's in fix round 1, so it reads closed on the render).
3. **Jelly rim, crown and depth:** mantle rim `#3ee6f0` to `#28e2f2`; arms crown `#30dcc8` to `#3ae0d4`, depth `#0a9a8c` to `#0a9c98`.
4. **Core glow:** the face glow's centre moved up and in ([0.3, -0.88, 0.6] to [0.27, -0.66, 0.6]), its spread narrowed (spreadX 0.52, reachUp 0.4, reachDown 0.3) and its ramp re-graded from teal through mint to a pale yellow; the underside glow 0.8 to 1.1; the key light 1.0 to 0.85.
5. **Arms:** body `#14b8a8` to `#18c4b8`; taperPower 1.8 to 0.9 (P2's arms stay thick to the curl); armBend 0.2.
6. **Cups:** size 0.3 to 0.34, spacing 2.05 to 1.85, tilt 22 to 12, glow 1.3 to 1.5.
7. **Aura and grade:** the halo thinner (head 0.05 to 0.03, arms 0.035 to 0.022); the local grade darker and stronger (`#05202c`, 0.8 to `#020e16`, 0.9). The bloom was the grey cast's cause (with it off, the mean and saturation pass): threshold 0.66 to 0.8, smoothing 0.25 to 0.2, intensity 1.05 to 0.4, radius 0.85 to 0.6.
8. **Water:** far colour `#031219` to `#020b10`, zenith `#033452` to `#043c5e`.

No world light was added to her (spec 7.2): the key light went down, not up.

Engine: one addition, the nameplate fill as a theme token (`UiTheme.plate`, `--oct-plate`, Nox's `rgba(12, 6, 18, 0.78)` as its value and the stylesheet's fallback; tested in `ui/theme.test.ts`). A wet highlight (`JellySettings.wet`: colour, direction, strength, sharpness, off by default) was built and tested, then dropped: at the key light's direction it washed the head milky (head middle 15.3, saturation 0.609); from above left at a strength the numbers allow it changed at most 33 levels on a small patch and could not be told apart from the frame without it, while the crown moved further from P2. No cup config field was needed.

Nox after the engine commit (`83c40c7`): vitest 717 passed, both tsc builds clean, lint 0 errors and 50 warnings, the build ok, the still gate PASS (every still bit-identical but techFocus's known residual, within its floor). His e2e passed 52 of 56 in one run on a loaded machine; the four misses are timing: three pass run alone, and isolation (f) (listener counts under StrictMode) fails the same way with the token change reverted.

### Perf (`node scripts/perf.mjs "stage=intro&tier=low"`, 1536 x 1024, headless Edge, interleaved on the same tree; CPU is the machine's average over 5 s before and after each run)

| Run | CPU before | Median fps | Slow10 fps | Mean fps | CPU after |
|---|---|---|---|---|---|
| Veyra 1 | 22.9% | 64.5 | 28.6 | 50.6 | 30.1% |
| Nox | 41.5% | 55.9 | 27.8 | 46.2 | 24.1% |
| Veyra 2 | 35.8% | 74.6 | 49.5 | 71.1 | 49.1% |
| Nox 2 | 25.0% | 64.5 | 32.5 | 58.8 | 32.9% |

Veyra is at least as fast as Nox on every pairing and well over 40 fps (the criterion is within 10% of Nox or 40 fps). No sparkle on/off run was needed.

### Close-up at 3x (Step 3)

Captured at P2's view box at 3x (1464 x 1485) beside the 3x panel:
- **Eyes:** big, round, near-black irises and pupils (pupils (4, 8, 6)) with the green-gold crescent low and two catchlights; a cream crescent on the outer side. A little larger and higher than P2's.
- **Lashes:** two at each outer corner (as Task 6; the count stays 2).
- **Brows:** thin dark-teal arcs, high over each eye.
- **Mouth:** a small dark smile with dimples, centred between the eyes' lower edges.
- **Blush:** peach ovals under the outer corners; the right one dimmer than P2's (it is in the head's shade).
- **Jelly rim:** a continuous bright cyan rim all round the dome, thinner and brighter than P2's soft glow.
- **Crown and centre:** a lighter crown band over a darker clear middle; no hard edge.
- **Sparkles:** 48 flecks on the head's front (outside the eyes, brows and mouth), at least 40 needed (counted on r19; fix round 1 changed only T2's curl).
- **Cup frill:** cream raised cups in a touching row, smaller toward the tips, with darker hollows.
- **Curls:** five arms with a full turn (T2, T3, T6, T7, T8), each seen closed on the rendered stills.

## Task 9: the vault kit (no gate, geometry and layout only)

`blender/vault/build_kit.py` builds `public/veyra/world/kit.glb` headless (about 25 s, 634 KB). Pieces (each also `_lod1`, about a quarter of the triangles): `arch`, `block_a` to `block_d`, `wall_broken`, `steps`, `rock_a` to `rock_c`, `coral_orange`, `glowplant_a`, `glowplant_b`. Other nodes: `membrane` (two UV sets: UV0 planar, UV1 the flow map, u round the doorway edge and v 0 at the edge to 1 in the middle), `padlock_body` (body, dial seat, shackle) and `padlock_ring` (origin at the ring's centre, so `rotateZ` turns it in place). The portal's four nodes share the arch's frame: a world places them with the arch's placement. Stone carries moss as a green vertex tint on up-facing faces (the page's stone colour multiplies it). Geometry is meshopt-compressed like Nox's (the kit loader decodes meshopt only; the plan's "Draco" is not what Nox does or what the loader reads). Each placed piece carries its ground-plane bounding radius as a node extra (`radius`), which `layout.test.ts` reads.

`layout.json` (groups `portal`, `stone`, `rocks`, `corals`, `plants`; `floorY` -2.45): the arch at (4.2, -8.6) turned toward the stage; walls, blocks and steps both sides; foreground dark rocks at z 2 to 4; two orange corals low right (on the rocks); nine glow plants. `kit.ts` lists the pieces and nodes (the config will take them in Task 10) and the corridor: 2.4 wide, from (-10, -10) bending to the stage spot (0, 0), then on toward the doorway. `config.ts` is unchanged: the bundle is still the stage backdrop until Task 10 swaps in the kit.

Stills (Workbench, not the world's look): `docs/superpowers/reviews/assets/veyra/t9-kit-contact-sheet.png` (every piece, seen from a little above; the portal's membrane and padlock bottom right) and `t9-layout-from-stage.png` (the layout from the stage camera, no light or colour).

Things to know for Task 11:
- Glow plants and the blocks, walls, steps and arch are plain stone to the engine (only the groups `pillars`, `rocks` and `corals` are dressed): plants will not glow until the engine or the look gives them a look.
- The engine's kelp and seagrass flank both sides (|x| 2.6 to 9, z 2 to -26; seagrass from 1.4), so they stand through the arch, steps, walls and blocks and over the left half of the path. The kit does not avoid them; tune the strand count or `clear` in the look task.
- Foreground rocks sit at |x| 2 to 5 (inside the frame, which is only about +-3.8 wide at z = 0).

## Task 12: notes carried in

- The overview's opened dome (Task 3 review, minor 2): `jellyLook` runs after the HEAD shader's `capped` darkening and ignores `uMorph`, so in the overview the sunk mantle top still gets the full crown band and rim. Check it there and fix it if it shows.
