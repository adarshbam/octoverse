# Flux: owner review log

Newest entries last. Spec: `docs/superpowers/specs/2026-11-03-flux-3d-design.md`.

## Engine as landed (re-checked 2026-11-04 at 575fe40, E02 merged; fix wave B and E02b items still to come)

Run: `rg "export (const|type|interface|function) (<names>)" src/engine src/worlds`. Re-run when the engine moves again.

| Name | Landed in | Note |
|---|---|---|
| `WorldBundle` (interface) | `src/engine/types/bundle.ts` | `{ id, character, poses, swim, artifacts, sequences, place, stage: { frames, panels, introTitle }, content, theme }` |
| `validateBundle` | `src/engine/types/bundle.ts` | `(bundle, worlds = [])`; `worlds` is the shipped ids, only the registry knows them. See the requirements list below |
| `faceAnchor` | `src/engine/types/bundle.ts` | `(bundle, stage) => Vec3`, derived per character from `head` and `poses` |
| `WorldId` | `src/engine/types/bundle.ts` | plain `string`; rule `^[a-z][a-z0-9-]{1,31}$`, `u-` prefix reserved for creator bundles |
| `WORLDS` | `src/worlds/index.ts` | `Record<WorldId, WorldBundle> = { nox: NOX_BUNDLE }`. The engine's id list `WORLDS` in `bundle.ts` is gone; Flux is added here |
| `resolveWorld` | `src/worlds/index.ts` | `(search) => { bundle, warning? }`; reads `?world=`, unknown id falls back to the default with a warning |
| `WorldHost` | `src/engine/host/WorldHost.tsx` | `({ bundle, options, mode = 'page' | 'preview', ui = 'engine' | 'none', preview?, initialStage?, onStageChange?, stageRequest?, exit?, children? })`. A bad bundle shows a plain message and logs the `BundleError`; keep the bundle object stable (a new object remounts) |
| `PreviewOptions` | `src/engine/host/options.ts` | `{ stage, tierCap?, motion: 'still' | 'ambient', place: 'full' | 'backdrop', artifacts: 'settled' | 'hidden' }` |
| `useInstanceApi` | `src/engine/host/useInstanceApi.ts` | the page-facing API (`back`, `skip`, `attend`, ...); throws outside a `WorldHost` |
| `useInstance`, `InstanceState` | `src/engine/host/instanceContext.ts`, `src/engine/host/instance.ts` | engine-internal instance state, as before |
| `HEAD_EFFECTS` | `src/engine/character/headEffects/index.ts` | `{ none, glyphs }` |
| `PLACEMENTS` / `APPEARS` / `SELECTS` | `src/engine/artifacts/strategies.ts` | `{ orbit }` / `{ blow }` / `{ suctionHold }` |
| `resolveExpressions` | `src/engine/behavior/expressions.ts` | already landed (the plan lists it with the Veyra names) |
| `clampCharacterConfig` | `src/engine/config/validate.ts` | takes `LegacyCharacterConfig`, returns `CharacterConfig` |

Not landed yet (expected; Veyra/Aether work): `LIVE_ELEMENTS`, `KIT_MATERIAL_VARIANTS`, `SurfaceLook`, `JellySettings`,
`SuckerStyle`, `assignPendants`, `pendantSwing`, `tetherCurve`, `threadClearance`, `bloomState`, `armLiftTarget`.

Differences from the plan's names: the engine id list `WORLDS` is gone (registry only); `useInstanceApi` and `WorldHost`
are the page-facing names; `resolveExpressions` is already there.

### What `validateBundle` requires (for Task 2)

A bundle that lacks any of these throws a `BundleError` naming the field:

- `id` matching the rule above; every one of the stages' poses with exactly eight arms; `stage.frames.<stage>` with width and height above 0.
- `stage.panels.overview` and `stage.panels.detail`: four finite numbers `[left, top, right, bottom]` with left < right, top > bottom.
- `stage.introTitle`: `halfWidth` above 0 and a finite `top`. `swim.stretch` and `swim.bodyX` finite.
- `place` parts present as objects or lists: `kit`, `layout`, `camera`, `post`, `relics`, `palette`, `lights`, `glow`, `water`, `live`; lists `kit.pieces`, `layout.pillars|rocks|corals|chains|coralLights`; and `place.camera.hover`, `place.water.colours`, `place.water.environment`, `place.palette.floorGlow`, `place.live.colours`, `place.post.contactShadow|bloom|vignette`, `place.lights.surface|fill|points[]`, each layout item, `place.farPlate` when used.
- Every number finite; every string in `character` and `place` a parseable colour unless its name ends in `id|depth|headEffect|url|kind|piece` (`skinAccent`, `floorGlow.*`, `character.palette.rimHot|domeRimHot|suckerSpecular|orbGlass.*` may use `color(srgb-linear r g b)`).
- `theme`: every colour token (`THEME_COLOURS` in `src/engine/ui/theme.ts`) is a colour. The set is 25 tokens (the coordinator's note said 17): `accent, accentHot, surface, surfaceEdge, buttonFrom, buttonTo, focusRing, nameplateLabel, titleAccent, liveFrom, liveTo, ink, markRing, selected, glow, glowInner, accentGlow, markGlow, buttonGlow, titleGlow, plateGlow, plateGlowInner, line, linePale, lineHover`. Plus `theme.titleIcon` (a key of `TITLE_ICONS`), `theme.poster` `{ src, alt, width, height }` (all set, size above 0) and `theme.pageTitle` (non-empty).
- `artifacts.placement.kind|appear.kind|select.kind` are engine kinds (`orbit`, `blow`, `suctionHold` today); `choosableIn` holds choosing stages; `sequences.defaults` has `entrance`, `headSwell`, `arrival` and the appear's sheet.
- `validateWorld(place)` clean and `validateProject(content.project, catalog)` valid.

### Finding: `check_stage.py` hard-codes Nox's image for the silhouette reference

`scripts/check_stage.py` `main()` (about line 205) builds `ref` from `public/spike/Nox.jpeg` cropped to Nox's panel and
computes the `silhouetteRows` reference widths from that image, whatever `--world-id` says. For Flux the width rows
compared against Nox's panel, not `p2.png` (2 MISS on `width y=0.15` and `y=0.10`). The colour samples are not affected
(they read `hq.image`). Engine owner to make the silhouette reference world-generic. Until then Flux's
`stage_samples.json` has no `silhouetteRows` (or `widthTolerance`); shape is covered by the P2 mask and the IoU target in
`targets.json`.

## Reference checks (P2)

Source: `docs/design/references/Flux/native-panels/02 - Flux Arrives and Introduces GitHub Pipeline Engine.png`
(511 x 510), copied to `public/flux/ref/p2.png`. The `regenerated/` set is not used.

- **Mask:** `public/flux/ref/p2-mask.png` (48,753 px), built by `python scripts/ref_mask.py public/flux/ref/p2.png public/flux/ref/p2-mask.png`.
  `scripts/silhouette.py` only prints head edge rows from the bright rim line; it does not write a mask, and Nox's
  masks came from 3D captures. So the mask is a colour threshold (lum > 82, blue-violet, largest blob, holes filled),
  with boxes for the title block, the nameplate and the bubble beside the left arm's curl. Checked by eye at full
  size and at 3x on both arm curls: racks, bubbles, title and nameplate are out; the mask hugs the painted rim and
  includes about 1 to 2 px of rim glow. Arm tips that dip behind the nameplate are cut at its top edge (y 440).
- **Samples:** the 14 spec 2.1 points, 5 x 5 area means from `p2.png`. Largest difference from the spec table is 1 per
  channel (arm top highlight: measured 109.8, 125.9, 246.8 against 109, 125, 246). Stored `rgb` is the rounded measurement.
  Nothing differs by more than 3. `cupGlow` (81, 326) sits one pixel off the mask edge (the curl's hollow starts at x 82);
  its colour is the cup glow as the spec says.
- **Mean colour inside the mask:** (108, 93, 225), tolerance 12 per channel. Mean per-pixel HSV saturation 0.657
  (tolerance 0.04), mean value 0.893. Same measure as `check_stage.py`'s `silhouette_stats`.
- **Arm span, measured on the mask:** x 55 to 451, so 3.97 units (1 unit = 100 px). Inside [3.8, 4.2], so the spec range stands.
- **Head on the mask (for reference, not a check):** the mask's top is y 224 (0.31 units, includes rim glow; the spec's
  top 0.26 +- 0.04 is read at the rim). Half-width at y 0.0 is 0.63 on the mask row.
- **IoU baseline:** not applicable yet (no render). Target stays 0.85.

Files: `src/worlds/flux/review/targets.json`, `stage_samples.json`, `world_samples.json`, `targets.test.ts`.
`stage_samples.json` (key `"2"`) uses Nox's schema with the `hq` registration (image, frame, origin, pxPerUnit) so the
reference is read through world units; points are world units (`x = (px - 255.5) / 100`, `y = (255 - py) / 100`).
`world_samples.json` uses Nox's `target` / `regions` schema, with the mean, saturation and brightness measured above
(saturation and brightness bands are measured +-0.04; the spec sets only the saturation band) and the same 14 regions,
water samples included. `check_stage.py --world-id flux` now reads them (see the finding above).

## Task 1: reference checks set up (2026-11-04)

Early, partial. Done: engine drift check, P2 copy, mask, samples, targets, `targets.test.ts` (6 tests green).
Follow-up (E02 landed): `check_stage.py public/flux/ref/p2.png --stage intro --world-id flux` exits 0 with all 14 colour
samples at delta 0, after dropping `silhouetteRows` from `stage_samples.json` (finding above). Engine names re-checked.

## Milestone 1 (P2 gate): PENDING OWNER REVIEW (Task 6, 2026-11-04)

Ruled provisionally overnight; the owner was asleep. Nothing here is approved until the owner looks.
Live: `/?world=flux&stage=intro` (add `&freeze` for the frozen pose, `&solo` to hide the Task 2 placeholder orbs and bubbles).

### Stills (`docs/superpowers/reviews/assets/flux/`)

- `p2-gate-sbs.webp`: P2 (left) beside the frozen render (right), same framing.
- `p2-gate-head-3x.webp`: head and face, P2 at 3x beside the render at 3x.
- `p2-gate-pulse.webp`: the two pulse stills, `pulse=t2@0.35` (left) and `pulse=t2@0.6` (right), at P2 size.
- `p2-gate-pulse-3x.webp`: the T2 curl at 3x, at rest, @0.35 and @0.6.

### Numbers (frozen intro, `tier=high&solo`)

`check_stage.py --world --stage intro --world-id flux`: FAIL with 3 misses (baseline: 10 misses).
- Mean (114, 93, 231), target (108, 93, 225) +-12: ok.
- Saturation 0.623, band 0.617 to 0.697: ok, but the margin is thin.
- Brightness 0.913: ok.

Region delta E (the limit is 10):

| Region | Before | After |
|---|---|---|
| crown | 9.7 | 4.2 |
| headMiddle | | 3.6 |
| headSide | 14.1 | 7.1 |
| headRim | 24.7 | 2.7 |
| faceGlow | 13.6 | 3.2 |
| chin | 19.2 | 4.2 |
| blush | 10.3 | 4.6 |
| armBody | 34.7 | 8.5 |
| auraWater | | 3.5 |
| midWater | | 8.2 |
| upperWater | 12.1 | 9.0 |
| mouthInside | 26.7 | **MISS** 35.2 |
| armTopHighlight | 23.4 | **MISS** 31.8 |
| cupGlow | 75.8 | **MISS** 25.8 |

Shape and gradients:
- IoU against `p2-mask.png`: 0.852 (baseline 0.805; target 0.85).
- Arm span: 4.00 units.
- Head top: 0.29.
- Half width at y 0: 0.62.
- Gradient mid.r - crown.r: 90 (>= 70).
- Warm face: face.r - crown.r 198 (>= 150), face.r - face.g 88 (>= 40).

Pulse:
- At P2 size, on the brightest pulsed cup (3x3 mean):

  | Pulse | Colour | Brightest | Brightest - smallest |
  |---|---|---|---|
  | T2 @0.35 | (153, 146, 206) | 206 | 60 |
  | T2 @0.6 | (152, 116, 246) | 246 | 130 |
  | T7 @0.6 | (151, 124, 250) | 250 | |

- At 3x:
  - T2 @0.6 is (162, 139, 250).
  - T7 @0.6 is (169, 160, 254). The resting curl cup there is already 254, so the 250 cap holds at P2 size but not at 3x.
- Lit cups above half level: 3 at @0.6 (inside the 3 to 5 target). At @0.35 only 1 to 2, below the 3 to 5 target, because T3 crosses T2's root cups.
- The hue walks cyan, lavender, pink along the band.

Perf (under load: the GPU is shared with other sessions), `scripts/perf.mjs --secs=8 "stage=intro&tier=low"`, two runs:

| Run | Median | Slowest 10% |
|---|---|---|
| 1 | 73.0 fps | 34.2 fps |
| 2 | 79.4 fps | 43.7 fps |

The floor of 40 is met, so the spec 10.1 fallback was not applied.

### Close-up at 3x (`p2-gate-head-3x.webp`, `.tmp/t6/closeup-*.png`)

| Item | Result |
|---|---|
| eyes, lashes, brows, blush | yes |
| mouth | partial: the D is shallower than P2's and the tongue is a sliver (engine gap below) |
| rim, crown, middle, core | yes |
| sparkles on the head front | yes: 73 at P2 size, 153 at 3x (need 40) |
| cups per visible arm (need 10 each) | T1 about 10, T2 about 14, T3 about 12, T8 about 10, T7 about 9 to 10, T6 about 8 (borderline/no); T4 and T5 are partly behind the nameplate |
| open tip curls | yes: 6 (T1, T2, T3, T6, T7, T8) |

### Five things to look at

1. Is the gradient blue crown, then violet, then a warm pink face? (Numbers say yes. Is the pink warm enough round the mouth?)
2. Is it glassy, not plastic? Look at the rim and the core glow under the face.
3. Are the cups separate and glowing? Look at the right-side arms, where fewer cups show than in P2.
4. Does the pulse read as living light, not LEDs? Watch it live; @0.35 lights only 1 to 2 cups (below the 3 to 5 target), where T3 crosses T2.
5. Is he neither Nox nor Veyra? The round blue head, big eyes and pink face are his own.

### Remaining weaknesses

- A blue collar of arm roots sits under the mouth, with a bright rim line round the bottom of the head. P2 has a pink-violet skirt there.
- The arms are a more saturated, darker blue than P2's luminous periwinkle, so armTopHighlight misses. A lower arm crown cap lifts it but pushes the overall saturation below its band.
- The T2 curl is smaller than P2's. P2's big bright scallops in that curl are what cupGlow samples.
- Fewer cups show on the right arms (T6 about 8).
- The head sparkles are coarser and more numerous than P2's fine specks.
- The intro placeholder orbs show without `&solo`, giving 5 misses on the page capture. This is the Task 2 placeholder; Task 12 fixes the intro orbs.
- The saturation margin is thin: 0.623 against a floor of 0.617.
- Pulse @0.35 lights only 1 to 2 cups, below the 3 to 5 target: T3 crosses T2's root cups and hides them.
- At 3x the resting T7 curl cup is already 254, above the 250 brightness cap (it holds at P2 size: T7 @0.6 is 250).

### Engine-owner gaps (bundle values cannot fix these)

- **Tongue size.** The tongue is fixed at rx 0.32 of the mouth width and a third of the opening. P2 needs about 0.6 of the width and 0.45 of the opening. This is the mouthInside miss.
- **Jelly rim at the bottom of the head.** The rim cannot be suppressed at the head/neck bottom, which makes the bright line under the face.
- **Core and ramp interaction.** The jelly core blends with `max(col, ramp(core))`. A core weaker than faceGlow pulls the ramp's violet-blue into the face and lifts the darks (pupil, mouth). Worked round here by centring the core under the mouth at warmth 1.
- **Chin and face glow.** Both met with coreCenter, coreWarmth, the ramp and reachDown. No world light was added and the engine was not forked.
- **Existing gaps.** Sparkle twinkle speed; the hard-coded silhouette reference in `check_stage.py`.
