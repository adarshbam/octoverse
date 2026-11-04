# Flux: owner review log

Newest entries last. Spec: `docs/superpowers/specs/2026-11-03-flux-3d-design.md`.

## Engine as landed (provisional, E02 fix wave pending)

Checked 2026-11-04 on branch `claude/flux-world-overnight` at 3de528a (E02 merged), with
`rg "export (const|type|interface|function) (<names>)" src/engine src/worlds`. Re-run it when the E02 fix wave lands.

| Name | Landed in | Note |
|---|---|---|
| `WorldBundle` (interface) | `src/engine/types/bundle.ts` | as planned |
| `validateBundle` | `src/engine/types/bundle.ts` | `(bundle, worlds = WORLDS)`; checks against the id list below |
| `faceAnchor` | `src/engine/types/bundle.ts` | `(bundle, stage) => Vec3`, derived per character from `head` and `poses` |
| `WORLDS` (id list) | `src/engine/types/bundle.ts` | `['nox'] as const`; a second world id must be added here |
| `WORLDS` (bundle map) | `src/worlds/index.ts` | `Record<WorldId, WorldBundle> = { nox: NOX_BUNDLE }`; same name, two files, two meanings. `WorldId` is plain `string` |
| `resolveWorld` | `src/worlds/index.ts` | `(search) => { bundle, warning? }`; reads `?world=`; unknown id falls back to the default with a warning |
| `useInstance` | `src/engine/host/instanceContext.ts` | as planned |
| `InstanceState` (interface) | `src/engine/host/instance.ts` | as planned |
| `HEAD_EFFECTS` | `src/engine/character/headEffects/index.ts` | `{ none, glyphs }` |
| `PLACEMENTS` | `src/engine/artifacts/strategies.ts` | `{ orbit }` |
| `APPEARS` | `src/engine/artifacts/strategies.ts` | `{ blow }` |
| `SELECTS` | `src/engine/artifacts/strategies.ts` | `{ suctionHold }` |
| `resolveExpressions` | `src/engine/behavior/expressions.ts` | `(config) => Record<ExpressionId, ExpressionParams>`. Already landed (the plan lists it with the Veyra names) |
| `clampCharacterConfig` | `src/engine/config/validate.ts` | takes `LegacyCharacterConfig` (no `lighting`, `glow`, `palette`), returns `CharacterConfig` |

Not landed yet (expected; they belong to the Veyra/Aether work): `LIVE_ELEMENTS`, `KIT_MATERIAL_VARIANTS`,
`SurfaceLook`, `JellySettings`, `SuckerStyle`, `assignPendants`, `pendantSwing`, `tetherCurve`,
`threadClearance`, `bloomState`, `armLiftTarget`. A looser `rg` over `src` (any form, not only `export ...`) finds none of them.

Names that differ from the plan: none. Two things to know: `WORLDS` exists twice (above), and the plan's
`resolveExpressions` is already in the engine.

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
water samples included. Both are provisional until E02's `check_stage.py --world-id flux` lands.

## Task 1: reference checks set up (2026-11-04)

Early, partial. Done: engine drift check, P2 copy, mask, samples, targets, `targets.test.ts` (6 tests green).
Not run: `check_stage.py --world-id flux` (E02's rewrite has not landed). Open: the engine names above are provisional
until the E02 fix wave lands.
