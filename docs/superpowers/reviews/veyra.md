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
