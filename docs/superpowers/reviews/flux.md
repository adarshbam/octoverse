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
