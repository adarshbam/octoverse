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

## Task 9: baked pipeline world (provisional, PENDING OWNER REVIEW)
- Dropped or deviating from the plan, each logged in `docs/superpowers/MORNING-REVIEW-flux.md`: glyph motes dropped (motes take no sprite set, spec 12.6); bubbles are uniform, not denser to the left (the engine has no density field); the far plate is KTX2, not webp (the engine loads only KTX2).
- Engine-owner item: per-arc `portal_arc_<q>_inlay` membrane nodes solve the shared-stone emissive problem world-side; Task 15 props must name the `_inlay` nodes.
- Not seen: packets were reported as not visible in any stage frame (corrected in Task 10: they are visible in the intro).

## Milestone 2 (Task 10): pipeline world look, PENDING OWNER REVIEW (2026-11-05)

Ruled provisionally overnight; the owner was asleep. Nothing here is approved until the owner looks.
Live: `/?world=flux&stage=intro` (add `&freeze` for the frozen pose, `&solo` to hide the Task 2 placeholder orbs). Entering frame: `/?world=flux&stage=entering&freeze&solo`.

### Stills (`docs/superpowers/reviews/assets/flux/`)

- `world-t10-intro.webp`: the page, intro, frozen, 1280x720 (placeholder orbs on).
- `world-t10-intro-solo.webp`: the same with `&solo`.
- `world-t10-overview-solo.webp`: overview, frozen, solo.
- `world-t10-p2-sbs.webp`: P2 (native) beside the world at P2's frame, page and solo.
- `world-t10-p1-sbs.webp`: P1 (native) beside the entering frame, at P1's square frame and at 16:9.
- `world-t10-portal.webp`: the portal disc, Task 9 (left) and Task 10 (right).
- `world-t10-packets.webp`: live intro, the bridge stretch left of the left tower, two moments 2 s apart.

### Step 1: Flux's samples in the world (frozen intro, `tier=high&solo&kitwait=60000`)

`check_stage.py --world --stage intro --world-id flux`: FAIL with the same 3 misses as Task 6 (engine gaps, not world).
Flux's samples did not move: every Flux region is within 0.1 delta E of the Task 6 stage capture (headRim 2.7 to 2.8, cupGlow 25.8 to 25.7, the rest equal). No world value was changed for him.

| Region | Task 6 stage | World (Task 10) |
|---|---|---|
| crown / headMiddle / headSide / headRim | 4.2 / 3.6 / 7.1 / 2.7 | 4.2 / 3.6 / 7.1 / 2.8 |
| faceGlow / chin / blush | 3.2 / 4.2 / 4.6 | 3.2 / 4.2 / 4.6 |
| armBody | 8.5 | 8.5 |
| auraWater / midWater / upperWater | 3.5 / 8.2 / 9.0 | 5.8 / 6.8 / 7.1 |
| mouthInside (engine: tongue size) | **MISS** 35.2 | **MISS** 35.2 |
| armTopHighlight | **MISS** 31.8 | **MISS** 31.8 |
| cupGlow | **MISS** 25.8 | **MISS** 25.7 |

Mean (114, 93, 231), saturation 0.623, brightness 0.913: all ok, the same as Task 6.
Without `&solo` (the page): 5 misses, the same set as Task 6's page capture (saturation 0.610, cupGlow 85.7 and upperWater 20.1 from the placeholder orbs; Task 12 replaces them).

### Step 2: side by side with P1 and P2

- **Towers:** both sides framed as in P2; ours are darker and sparser than P2's (thin LED strips on near-black racks, where P2 has many lit windows and blue edge light).
- **Portal:** right and back, partly behind the right rack (16:9); off-frame at P2's and P1's square frames. The disc's flow lines read as cracks up close; tamed (below).
- **Bridge:** a dark walkway-pipe at screen height of his arms; the packets are visible: one or two at a time, left of the left tower and between it and his left arms (Task 9 thought none were). In the entering frame the near arch is a tall violet hoop behind where he stops.
- **Shaft:** blue shafts from the upper right, as P2.
- **No red light:** 0 red pixels (hue within 15 degrees of red, saturation > 0.45, value > 0.3) outside Flux and the title, in the intro, intro solo and entering stills. The flame title icon is the R13 placeholder (UI, not world).
- **Portal vs face (intro):** portal region 99th-percentile luminance 73 (Task 9: 89), his face glow median 188.

World changes made (config only; none of these values is in near.glb's record, so no rebake):
- Portal disc membrane `#70a8e8` / edge `#3a6898` (was `#1e4a7a` / `#6aa8e0`): the edge was about 17 times the body, so the fan-bent flow lines read as cracks; a line now peaks near 1.4 times the body. Brightest 0.52, below the face core 0.547.
- Bridge arch glow `tips` 1.5 to 5: the legs and feet fall dark.
- `relics.coral` 0.6 to 0.4: the coral fans no longer read as flat pink cut-outs.
- Packets: lighter colours (`#5ef0ff`, `#c4b0ff`), length 0.55: streaks of light through the fog.

Not changed, and why:
- Light, fog and LED intensity: all are in the bake record (config.test) or the far plate; a change means a 10-minute rebake (and a far re-render for fog) while Flux's water samples already pass. Left for the owner's call.
- Bridge layout: moving it would mean rebake, layout tests and corridor clearance; the packets already show in the intro.

### Step 3: perf (under load: three sessions share one Intel UHD GPU), `WORLD=flux node scripts/perf.mjs "stage=intro&tier=low" "stage=intro&tier=high"`

| Run | Tier low median | slow10 | Tier high median | slow10 |
|---|---|---|---|---|
| 1 | 67.6 fps | 29.9 fps | 26.2 fps | 18.9 fps |
| 2 | 58.5 fps | 27.0 fps | 23.7 fps | 13.8 fps |

Tier low meets the 40 fps floor on the median in both runs, so no spec 10.1 cut was made. Tier high has no floor in spec 2.5.

### Five things to look at

1. A sunken data centre, still underwater? Navy water, the shaft, racks with blinking strips. (Weak: the racks are much darker and sparser than P2's.)
2. The portal is focal but quieter than his face? Portal 99th-percentile 73 against his face 188. Is it now too quiet to be focal?
3. LEDs and packets alive but not busy? Watch live: one or two packets at a time on the left, LEDs at 0.4 to 2.5 blinks a second.
4. No tech clutter? Look at the left edge (an arch crown sliver) and the bottom-left coral chunk.
5. The camera hover is lively? Shared hover, Nox's amount at 1.2 times his pace.

### Remaining weaknesses

- The racks are darker and sparser than P2's (P2: many lit windows, blue edge light). Fixing needs denser LEDs in the kit or a brighter fill, each a rebake.
- The disc's lines still show faintly as straight pieces at 3x (the disc's fan triangles); a finer disc mesh in the kit would make them smooth curves (kit rebuild and rebake).
- The disc's centre now reads as a faint darker halo.
- In the entering frame the near bridge arch is a tall flat violet hoop; P1's arches are small rings on the deck.
- The portal is off-frame at the square P1 frame, where P1 shows it centre-right.
- Packets are flat bars (engine box mesh, no glow below the bloom threshold).
- Bubbles uniform (no density field); glyph motes dropped (engine gaps, as Task 9).

## Task 11: overview pose and dome (P3), PENDING OWNER REVIEW (2026-11-05)

Ruled provisionally overnight; the owner judges the look live.

### What changed
- `src/worlds/flux/poses.ts`: `OVERVIEW_TRACED` (eight arms, T1 to T8, traced in world units on the 3x P3 under a world grid), overview body (0.02, 0.13), scale 1 (P3's eyes are as far apart as P2's). The tech focus keeps the overview's arms and body with the head closed until Task 12 lifts T8.
- `src/worlds/flux/character.ts`: `dome` fitted to P3's rim (head space centre (0, 0.405), 1.52 by 0.975, power 2.6, mantleTop -0.32); dome palette: tint `#02188e` (deep navy blue), rim `#4a9cff` (electric blue), crown rim `#b0f0ff` (blue-white), sheen `#80c8ff`.
- `src/worlds/flux/bundle.ts`: overview panel box `[-1.22, 1.04, 1.26, -0.04]` (was the Task 2 guess `[-1.22, 1.15, 1.63, -0.07]`, whose right edge lay outside the dome).
- Review set: `public/flux/ref/p3.png` (native panel, copy), `p3-mask.png` (`python scripts/ref_mask.py public/flux/ref/p3.png public/flux/ref/p3-mask.png --panel 3`: arms and face; dome above the head top and the 12 orbs excluded), `src/worlds/flux/review/p3_targets.json` (9 samples, dome fit, panel content box, eyes), `stage_samples.json` key `"3"` (so `check_stage.py <capture> --panel 3 --world-id flux` runs).

### Stills (`docs/superpowers/reviews/assets/flux/`)
- `overview-t11-p3-sbs.webp`: P3 beside `?world=flux&stage=overview&freeze` (1536 x 1024 capture cropped to P3's 5.15 x 5.1 frame).
- `overview-t11-wide.webp`: the whole 1536 x 1024 capture.
- `overview-t11-dome-bottom-2x.webp`: the dome's bottom, the sunk head top and the face at 2x.
- `overview-t11-mask-diff.webp`: silhouette against P3's mask (white both, red P3 only, green render only).

### Numbers
- Dome fit to P3's outer rim line: 12 points, rms 0.0115, max 0.019 units (power 2.6; 2.8 to 3.5 fit worse, rms 0.014 to 0.036). In the render the rim peaks at x -1.48 / +1.48 and y 1.48 (P3 1.50); the config is 0.015 larger than the fit to bring the peak out.
- Face anchor (overview) y -0.41; dome bottom y -0.44: 0.03 apart (test: within 0.1). P3's irises at y -0.415.
- Panel box with a 0.04 margin inside the dome's z = 0 outline at 1536 x 1024, 1024 x 1024 and 1280 x 720 (test).
- Every arm of the solved chain within 0.03 of its P3 trace (test).
- Silhouette IoU against `p3-mask.png` (dome region and orbs excluded on both): 0.726. P3 paints ten tentacles (two more in the centre); the misses are those two, the rim glow at the dome's lower corners in P3's mask, and the render's lower arms a few px thicker.
- `check_stage.py .tmp/t11/ov-r1.png --panel 3 --world-id flux` (506 x 504 capture, colour max-channel tolerance 24): 6 misses of 9. ok: domeRimBottom 19, domeInsideSide 12, faceGlow 12. MISS: domeRimTop 37 (thin line, render #6e98bb vs #58ade1), domeRimLeft 80 (render rim 1-2 px inside the patch), domeInsideTop 47 (P3 bright #073fb2, render #1a3583), domeInsideBottom 45 (P3 navy #0a1550, render bluer #15237e), headTop 52, chin 53. First pass (Task 2 palette) was 6 misses with domeRimTop 84, domeRimLeft 120, domeInsideTop 74.

### Five things to look at
1. The dome reads as a wide blue glass capsule with a bright electric-blue rim, round-cornered as P3's.
2. The face sits at the dome's bottom with the open smile; the head top under the glass.
3. The arms ring the dome: T1 and T8 climb beside it and curl out at about y 0.8; T2 and T7 reach out level and curl up; T3/T6 and T4/T5 curl lower.
4. The HTML panel sits inside the glass, its buttons just above the face.
5. Nothing of the dome crosses his eyes or the arms below it.

### Remaining weaknesses
- The dome's body is one tint (engine: no gradient), so it cannot be bright blue under the crown and navy at the bottom as P3 is: the top is darker and the bottom bluer than P3 (the two inside misses).
- The sunk head top reads as a cut cup lip with a blue band (the engine's sunk mantle rim, as in Nox's overview); P3's head top is round under the glass.
- The panel's copy (Flux's 22-character title and 82-character summary) wraps in the engine's 40%-wide copy column and its last line touches the GitHub button at 1536 x 1024; at 506 x 504 the panel is the phone sheet. P3's text column is wider. Engine layout (ui/overview.css) or shorter copy; a taller box makes it worse.
- No project screenshot yet (content), so the panel's left half is empty glass.
- The orbs are still the placeholder orbit (Task 12 hangs them on the arms).
- IoU 0.726: the lower arms are a few px thicker and less spread than P3's.
- The tech focus now uses the overview's arms (head closed); before it used the intro's.

## Task 12: P3 to P5 statics (pendant orbs, tech focus, detail), PENDING OWNER REVIEW (2026-11-05)

Ruled provisionally overnight; the owner judges the look live.

### What changed
- `src/worlds/flux/artifacts.ts`: `FLUX_SLOTS` (16 a stage, intro and overview the same): the tips (`at` 1) in order 0-7 as T1, T8, T2, T7, T3, T6, T4, T5, then the mids (`at` 0.55) on T1, T8, T2, T7 (8-11) and T3, T6, T4, T5 (12-15). `FLUX_ARTIFACTS.placement`: kind `pendant`, `maxPerArm` 2, sizes intro 0.001 / overview 0.28, tether length 0, sag 0, width 0.001, colour and cap `#b58fd0`. `orbStyle`: no rim beads, rim `#bec0e8`, cap `#b58fd0` size 0.05. `choosableIn: ['overview']`. Appear and select stay `blow` and `suctionHold` until Task 16.
- Colours sampled from native P3: cap = mean of the violet-pink cap pixels (181, 143, 208) on four caps; rim = brightest quarter of the rim on six orbs (190, 192, 232).
- `src/worlds/flux/poses.ts`: the overview arms were redesigned round the orbs (Task 11's traced arms put the mid orbs 0.14-0.37 into the next arm, and the T3/T6 tips at about 0). T1/T8 climb beside the dome and hook out at y 0.9; T2/T7 run out level (their mid orbs hang off the level run) and hook down; T3/T6 and T4/T5 curl under. Mirrored about x = 0.02. `TECH_FOCUS`: the overview with T8 rising straight up at x about 2.0 to a hook at y 1.6, tip orb at (1.68, 1.21), expression focused, orbs 1. `DETAIL`: the intro arms, body (-3.33, 0.69) scale 1.04 yaw 0.35, tilt 0.08, look (0.3, 0.1), attentive (P5: eyes at (-3.71, 0.165) and (-2.94, 0.10), head x -4.03 to -2.63, top 1.02).
- `src/worlds/flux/slotCriteria.ts` (test support only): the face rect in arm space, the HTML boxes per viewport (desktop panel; phone sheet 168 px plus the tray), clearance (engine `threadClearance` per box), perspective-seen orbs, orb gaps, dome distance.
- `src/worlds/flux/artifacts.test.ts`: 16 tests (written first: 15 of 16 failed before the data).

### Stills (`docs/superpowers/reviews/assets/flux/`)
- `overview-t12-p3-sbs.webp`: P3 beside `?world=flux&stage=overview&freeze` (1536 x 1024, cropped to P3's frame).
- `overview-t12-wide.webp`: the whole 1536 x 1024 overview.
- `overview-t12-slots-on-p3.webp`: geometry plot: the arms as the rig draws them and the twelve orbs over P3.
- `overview-t12-phone-390x844.webp`: the overview at 390 x 844.
- `techfocus-t12-p4-sbs.webp`: P4 beside `?stage=techFocus&tech=github-actions&freeze` (what the engine draws: see weaknesses).
- `techfocus-t12-pose-on-p3.webp`: geometry plot of the tech focus pose data (T8 up) over P3.
- `detail-t12-p5-sbs.webp`: P5 beside `?stage=detail&freeze`.
- `intro-t12-caps.webp`: the intro with the orb caps showing at the slots.

### Numbers
- Clearance (engine `threadClearance`, other arms + face + HTML; test needs > 0.05), twelve shown:

  | Case | Value |
  |---|---|
  | Desktop at rest, panel | 0.089 |
  | Swing +-18 deg | 0.029 |
  | Swing +-25 deg | 0.001 |
  | 390 x 844, arms and face | 0.089 |
  | 390 x 844, with sheet and tray | -0.280 (T3-T6 tips covered; test pins this) |
  | Tech focus pose | 0.064 |
  | Least orb-to-orb gap | 0.243 |
  | Least orb-to-face | 0.463 |
  | Least orb to dome outline | 0.017 (T8 mid; T1 mid 0.037) |

- Sixteen shown (13 or more technologies): -0.100 clearance, -0.200 orb gap (the T3-T6 mids). Content has 12.
- Orb centres (stage): tips T1 (-1.95, 0.49), T8 (2.00, 0.51), T2 (-2.14, -1.23), T7 (2.16, -1.23), T3 (-1.71, -1.91), T6 (1.77, -1.93), T4 (-0.66, -2.02), T5 (0.70, -2.01); mids T1 (-1.54, -0.28), T8 (1.56, -0.27), T2 (-1.35, -1.14), T7 (1.37, -1.11). Seen radius 0.266-0.293 (perspective).
- Detail face anchor on screen at the left (x under 30% of the width) at 1536 x 1024, 1280 x 720 and 390 x 844 (test).
- `check_stage.py .tmp/t12/ov.png --panel 3 --world-id flux` (506 x 504): 6 misses of 9. ok: domeRimBottom 6, domeInsideSide 16, headTop 24. MISS: domeRimTop 37, domeRimLeft 81, domeInsideTop 47, domeInsideBottom 45, faceGlow 28, chin 53. (Task 11: also 6, with headTop a miss at 52 and faceGlow ok at 12.)
- Intro `check_stage --panel 2` (no solo): 5 misses (Task 10: 5).
- Perf, under load (131 node/msedge processes, shared Intel UHD GPU), `WORLD=flux node scripts/perf.mjs "stage=overview&tier=low"`: median 37.5 / 43.3 / 40.0 fps over three runs (slowest 10%: 15.4 / 33.4 / 23.5). Intro tier low in the same load: 39.4.

### Five things to look at
1. The overview reads as P3: twelve glass orbs in a ring, each hanging off an arm tip or the level run of an upper arm.
2. The redesigned arms: do they still read as Flux's arms (T1/T8 hooks, T2/T7 level runs, curled lower arms) and not as wire?
3. The orb glass and the small violet-pink cap where it meets the arm.
4. The detail: Flux at the left, eyes where P5 puts them.
5. The phone overview: the lowest four orbs sit behind the tray.

### Remaining weaknesses
- The tech focus: the engine draws the overview pose there (`WorldHost`: `shown = returnTo`) and never reads `poses.techFocus`, so `techfocus-t12-p4-sbs.webp` shows the overview, the dome open, a suction hold and the tooltip. GitHub Actions is order 0, so it hangs on the T1 tip, not T8 as P4 paints it. The T8-up pose is data only until Task 16's arm lift.
- The intro: the engine refuses size 0 and width 0 (`checkPendants`), so 0.001 is used; the orb style's cap is sized from its own 0.05 with depth test off, so 12 lavender cap dots show at the slots, and the blow appear runs on invisible orbs.
- The phone: the sheet and tray cover the T3-T6 tip orbs (spec 7.11 wants Flux in the upper screen or the hanging orbs hidden where the tray lists them).
- The swing: at +-18 deg the clearance drops to 0.029 (+-25: 0.001); Task 16 must hold the swing under that or retune.
- 13 or more technologies collide (the lower mids, -0.10).
- The overview arms are a redesign of Task 11's P3 trace; their silhouette IoU against `p3-mask.png` was not re-measured (Task 11: 0.726).
- The T1/T8 mid orbs sit 0.017-0.037 inside the dome's rim line; the orbs overlap their own arm at the hook tips (by design: they hang off it).
- check_stage `--panel 3` stays at 6 misses (dome tint: engine gradient).
- The detail head reads a little wider than P5's; the attentive smile is closed where P5's is open.
- Logos are blank for githubactions, aws and bash (R17).

### Engine-owner items
- `checkPendants`: allow `sizes.intro` 0 and `tether.width` 0.
- `createOrbStyle`: scale or hide the cap with the orb (size 0 means no cap).
- Tech focus: draw `poses.techFocus` (or the arm lift) and let the focused tech hang from the lifted arm.
- Phone overview layout for pendant worlds (spec 7.11).

## Milestone 4: Task 13, back view (orbit review) (PENDING OWNER REVIEW)

**Ruling (provisional, overnight):** no change needed to `character.ts`. Nothing was edited; the front look is untouched.

**Stills** (`docs/superpowers/reviews/assets/flux/`): `back-t13-yaw-0-45-90-180.webp`, `back-t13-yaw180-2x.webp`. Captured with `NOX_URL=http://localhost:5195 NOX_PORT=5195 WORLD=flux node scripts/stage-capture.mjs intro <out.png> "yaw=<n>&solo&tier=high&kitwait=180000"` (506 x 504, scale 2).

**What was checked, and the numbers**
- Round and glassy: at yaw 180 the head is a complete round dome with a soft specular glassy look and a violet middle fading to pink at the lower back (the core shows through the jelly).
- Blue crown: sample at the top, 3x3 mean, (71, 107, 236) at yaw 180 against (72, 108, 236) at yaw 0.
- Rim: left and right edge (77, 122, 244) and (86, 112, 254) at 180 against (83, 128, 244) and (85, 111, 253) at 0; the blue rim runs round the whole back outline.
- Sparkles: blob count of specks over the same head area (a 135 px disc on the head, cut off below the face) 58 at yaw 0, 93 at 45, 91 at 90, 61 at 180. The arms carry sparkles on their backs too.
- Cups: cup-pink pixels outside the head 8322 (yaw 0), 7421 (45), 3324 (90), 1217 (180).
- Front unchanged: `python scripts/check_stage.py .tmp/t13/w0.png --world --stage intro --world-id flux` (capture by `world-capture.mjs intro` with `tier=high&solo&kitwait=180000&yaw=0`): FAIL with the 3 known misses (mouthInside 35.2, armTopHighlight 31.8, cupGlow 25.7), no new ones. The plain page still (`stage-capture`, not the check the world gate uses) reads 5 misses, as in Tasks 10 and 12, by its different framing.
- The earlier killed attempt's experiment (rear arms `z: [0, -0.8]`) was not applied and not needed.

**Honest weaknesses**
- The cups do not read from behind: they sit on the underside, which a camera behind and above does not see. Only the pink underside edge light and a hint on the lower tip curls show. This is the one brief item not met. Fixing it means wrapping the cups further round the arm (`suckers.tilt`, `rowAngle`), which changes the front (Task 6 rejected tilt 12 for hiding root cups); left for the owner to rule whether to trade it.
- The two lower centre arms meet at the back in a hard seam with a dark notch under the head.
- The core's glow is a strong magenta-pink hotspot at the lower back (255, 171, 255), pinker than the front's pink-white.
- The pink fin behind the head belongs to the world kit and also shows at yaw 0.

**Check:** `/?world=flux&stage=intro&freeze&yaw=180` (and 45, 90).

## Milestone 5: Task 15, the entrance with the portal run (PENDING OWNER REVIEW)

**Ruling (provisional, overnight):** owner reviews motion live; stills and numbers only, no video.

**What changed:** `src/worlds/flux/swim.ts` (open and trail poses read from P1, Veyra's method copied: umbrella open, a loose wavy bundle, stretch 1.15), `sequences/defaults.ts` (entrance: `{ turn: Math.PI, spiral: false }`, 5.0 s sheet; arrival quicker), `sequences/state.theatre.json` (seeded: entrance, arrival), `sequences/index.ts` (`kitDrives` portalArc1..4, portalDisc), `sequences/clearance.ts` (footprints from kit.glb bounds, arm reach), `place/config.ts` (`props`: `portalArc<q>` on `portal_arc_<q>_inlay`, `portalDisc` on `portal_disc`, all `emissive`), `character.ts` (`gentle` = the intro smile). Tests: `swim.test.ts`, `sequences/entrance.test.ts`.

**Numbers**
- Clearance (ground plane, footprints of towers, rack modules, piers, decks, plinth): swimming to 3 s with the umbrella's reach 2.3: frame 0.35, open 0.35, closed 1.10 (rack module at (-2.4, -2.4)); arriving 3 to 5 s with the intro's 2.05: frame 0.27, open 0.20, closed 0.70 (rack module at (2.3, -2.0)). The spot itself is 2.32 from that module: the umbrella would not fit there, the intro does.
- Surges 0.59, 1.11, 1.63, 2.15, 2.67 s; peak speed 4.0 units/s (2.77 s), about 1 in the glides.
- Arcs peak 2.30 / 2.45 / 2.60 / 2.75 s (150 ms apart), disc 2.95 s. Overshoot 0.250 at 3.32 s. Peak yaw rate 402 deg/s at 3.83 s. Bounce 0.14.
- Ring region (1280 x 720, luminance p99): lower arcs 70 dark, 118 at the flash (2.6 s), 93 lit; upper 61 / 88 / 74. Face glow median 182: the portal never competes.

**Stills:** `entrance-t15-stills.webp` (`NOX_URL=http://localhost:5195 WORLD=flux VIEW=1280x720 SCALE=1 node scripts/stage-capture.mjs entering <out> "t=<s>&kitwait=180000"`).

**Honest weaknesses:** the portal run is subtle and blue (no green), half the ring off-frame at 16:9, the disc flash too small to see; the brake's arm flare reads as arms dropping; mid-twirl back view at 3.3 s; surge pulse strong. Levers: `ARC_LIT`/`ARC_DARK`, the inlay `edge` colour (config.test caps its brightness under the face core), `surge`, `YAW_SWIM`.

**Engine-owner items:** none required. Noted: the entrance's settle face is hard-wired to 'gentle' (Flux overrides it to his intro face); the `armHalfSpan` check takes one open reach for the umbrella and the intro (the test splits the swim from the arrival); the stroke lead uses the stroke's own period, so a clock faster than the timing amplifies `surge`.
- **Also weak:** no body bob in the arrival (the engine's arrival has only roll and armWave); `settle` 1 lets the arms open about 4 percent past the intro pose around 4.4 to 4.6 s, which the clearance check does not model (smallest gap 0.20 against 0.15).
- **Check live:** 1) energetic, not frantic; 2) the portal run reads as a pipeline going green; 3) the overshoot and spring-back feel playful; 4) the turn and pop-open land on the smile; 5) skippable.

## Task 16: pulse appear, lift pulse, swell reveal, swing (PENDING OWNER REVIEW; engine commit PENDING ENGINE-OWNER REVIEW)

Ruled provisionally overnight; motion is checked live (no video).

### What changed
- Engine (`00d26e5`): `APPEARS.pulse` (`artifacts/pulseAppear.ts`, no sheet), `ArmLiftSelect.pulse`, `fireLiftPulse` (at most three arms pulsing), the swell-progress reveal (`revealSize`), bundle checks by name, TechBubbles and Octopus wiring.
- Flux (`a6521a1`): `appear { kind: 'pulse', step: 0.18 }`; `select { kind: 'armLift', ease: 0.3, scale: 1.25, threadShorten: 0, pulse: true }`; `placement.reveal { start: 0.35, span: 0.3, step: 0.03 }` (head-swell progress); `placement.swing { maxAngle: 18 deg, settle: 0.8 }`.

### Numbers
- Appear 1.79 s; swing within 18 deg for a 3 units/s step, settled under 1 deg by 0.8 s.
- Clearance of the twelve from other arms and the face (arms' plane), all at rest radius 0.28: 0.0893 rest, 0.0376 at 15 deg, 0.0286 at 18 deg, 0.0006 at 25 deg.
- **Chosen orb at scale 1.25 (radius 0.35), worst of the twelve:** scale alone -0.039 rest (T8 mid), -0.088 at 15 deg, -0.098 at 18 deg (T7 mid); with the arm lifted as well (keyboard or tap lift) -0.313 rest, -0.391 at 15, -0.406 at 18 deg (T5 tip), the other eleven against the lifted arm -0.334. In the arms' plane only (depth ignored, so it overstates). Orb to orb: 0.171 at rest (0.243 at rest radius). Pinned as known-limit tests in `src/worlds/flux/artifacts.test.ts`.

### Check live
1) pulses run out along the arms in pairs in the intro, no orbs and no caps; 2) Explore: tip orbs grow first, then the mids, also when pressed mid-appear; 3) hover an orb: arm snaps up in 0.3 s with a pulse and the 1.25x glow; 4) a six-orb sweep gives at most three bands; 5) the swing is lively but tight; 6) reduced motion: cups light 0.3 s, orbs there, no swing; 7) **watch a chosen orb overlapping a neighbour** (arm, orb or face), with the swing running.

### Honest weaknesses
- The lifted-orb clearance above is negative in the plane; unverified live. A lift on an arm with no traced lift (every arm but T8) turns it rigidly up to 0.9 rad about its root.
- The pulse (0.88 s) outlasts the lift (0.3 s); in a fast sweep later orbs get no pulse while three bands run.
- Engine-owner items: the lift geometry (above); `placement.reveal` is seconds for the bloom and swell progress for the pulse; sizes.intro 0 is still refused (0.001 used).

## Task 17: orbs in the stages, e2e (PENDING OWNER REVIEW)

Ruled provisionally overnight; motion is checked live (no video). No source or content change: `tests/e2e/flux.spec.ts` only (5 tests). The usage notes were already placeholders (GitHub Actions has P4's four lines; the other eleven read "text to come").

### Check live
1) the pulses run out along the arms in the intro (no orbs, no caps); 2) the orbs grow at the tips as the head opens; 3) the lift is snappy with a pulse; 4) the face looks eager; 5) the swing is lively but tight (and no orb through an arm when one is chosen: Task 16 item 7).

### What the e2e covers
- Intro settled: 0 `.orb-button`s. Explore: 12, unique names, all tabbable, no tray on desktop.
- Tab to GitHub Actions: tooltip with P4's list, `aria-describedby`, the orb moves about 310 px (the arm lifts; idle sway is 46 px at most), Escape clears the tooltip and keeps focus.
- Hover intent with a moving anchor: a pass chooses none, a rest chooses one, the tooltip is the same for 2 s of sampling (no flicker).
- Phone 390x844: tray lists 12 (48 px), a tap sets `aria-pressed` and opens the tooltip, a second choice moves the press, a third tap lets go.
- Reduced motion: 12 live buttons, no skip control, drift bounded (step under 60 px per 0.5 s, widest under 120 px; does not separate reduced from normal motion), a choice lifts far beyond that.

### Honest weaknesses
- "No swing" is indirect: the engine's swing is zero in reduced motion (unit-tested) but the arm tip curl is not gated by reduced motion, so orbs still drift up to about 45 px; the test bounds it, it does not show zero.
- No lift or swing probe in the engine; the lift is read from the orb button's place and the tray's `aria-pressed`.
- The phone tooltip covers the tray's first row, so the phone test's second tap is on the second row. The phone test does not check the orbs are uncovered (Task 12 known limit).
- Nothing in the e2e judges the five looks above.
- The reduced-motion test bounds the drift but the bound cannot separate reduced motion from normal motion; the engine has no swing probe; the no-swing guarantee is the unit test of pendantSwing plus the ungated curl engine-owner item. The test claims only live buttons, bounded drift and a lift far beyond it.
- Lifted-orb overlap (Task 16, still open): the chosen orb at 1.25x and its lifted arm overlap neighbours in the arms' plane (-0.31 to -0.41 against the 0.05 threshold); the e2e does not look at it.
- Engine-owner items: gate the arm tip curl with reduced motion (`curl: moving * ...`), a lift/swing probe, the phone tooltip over the tray.
