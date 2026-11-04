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
