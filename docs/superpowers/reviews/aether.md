# Aether world: review notes

## Engine as landed

Scan run 2026-11-04 on branch `claude/aether-world-overnight` (HEAD 4abdaf7), command from Task 1 step 1:
`rg "export (const|type|interface|function) (WorldBundle|validateBundle|faceAnchor|HEAD_EFFECTS|PLACEMENTS|APPEARS|SELECTS|LIVE_ELEMENTS|KIT_MATERIAL_VARIANTS|WORLDS|resolveWorld|themeVars|clampCharacterConfig|resolveExpressions|choosableNow|assignPendants|tetherCurve|pendantSwing|threadClearance|armLiftTarget|layoutOrbits|orbitPoint|SurfaceLook|JellySettings|SuckerStyle|EntranceShape)" src/engine src/worlds`

Found (name: file):

| Name | File |
|---|---|
| `WorldBundle` (interface) | `src/engine/types/bundle.ts` |
| `validateBundle` | `src/engine/types/bundle.ts` (second argument `worlds` now defaults to `[]`) |
| `faceAnchor` | `src/engine/types/bundle.ts` |
| `EntranceShape` (interface) | `src/engine/sequences/keys.ts` |
| `HEAD_EFFECTS` | `src/engine/character/headEffects/index.ts` (`none`, `glyphs`) |
| `PLACEMENTS` | `src/engine/artifacts/strategies.ts` (`orbit`) |
| `APPEARS` | `src/engine/artifacts/strategies.ts` (`blow`) |
| `SELECTS` | `src/engine/artifacts/strategies.ts` (`suctionHold`) |
| `choosableNow` | `src/engine/artifacts/strategies.ts` |
| `layoutOrbits` | `src/engine/artifacts/bubbleOrbits.ts` |
| `orbitPoint` | `src/engine/artifacts/bubbleOrbits.ts` |
| `resolveExpressions` | `src/engine/behavior/expressions.ts` |
| `clampCharacterConfig` | `src/engine/config/validate.ts` |
| `themeVars` | `src/engine/ui/theme.ts` |
| `WORLDS` (const) | `src/worlds/index.ts`: `Record<WorldId, WorldBundle>`, `{ nox: NOX_BUNDLE }` |
| `resolveWorld` | `src/worlds/index.ts` |

Landed under another name than the draft scan: `WORLDS`. The draft showed `export const WORLDS = ['nox'] as const` in `src/engine/types/bundle.ts` (a list of ids). That list is gone from the engine; the shipped worlds now live only in the registry `src/worlds/index.ts`, and `WorldId` is a plain `string` (engine file comment: the registry's test, `src/worlds/index.test.ts`, holds the id rule). Aether's registration therefore touches `src/worlds/index.ts` only, not the engine.

Missing (not landed yet, as expected: they belong to Veyra's engine work): `LIVE_ELEMENTS`, `KIT_MATERIAL_VARIANTS`, `SurfaceLook`, `JellySettings`, `SuckerStyle`, `assignPendants`, `tetherCurve`, `pendantSwing`, `threadClearance`, `armLiftTarget`. A search of `src` for each name, and for `pendant` and `tether`, finds no file under any other name. (`src/engine/character/suckerRow.ts`, `suckerMaterial.ts`, `armChain.ts` and `armTube.ts` exist and are Nox-era arm and sucker code, none of the missing names.) The engine spec adopts Veyra's pendant helper names (`assignPendants`, `pendantSwing`, `tetherCurve`, `threadClearance`, from `pendant.ts` and `tether.ts`; orchestrator, 2026-11-03); this plan uses them. When they land under another name, use the landed name and record it here.

## Reference checks (Task 1)

- Panels: `public/aether/ref/p1.png` to `p5.png`, copied unchanged from `docs/design/references/Aether/native-panels/` (P1 510 x 504, P2 514 x 504, P3 509 x 504, P4 674 x 519, P5 861 x 519). Colour truth is these native panels only.
- P2 mask: `public/aether/ref/p2-mask.png`, made by `src/worlds/aether/review/make_p2_mask.py` (`scripts/silhouette.py` only prints head half-widths; it makes no mask). It covers the head and the eight arms and leaves out the title, nameplate, gold ring, seed beads, jellyfish and ruins. It is a colour-threshold mask (blue channel), not hand-traced: edges are good to about 4 to 6 px. Known flaws: the lowest arms are cut flat at y 439 where the nameplate starts, one spur of ruin glow touches the outer left arm near (75 to 95, 300), and arm-curl interiors are filled.
- `src/worlds/aether/review/targets.json`: the 31 samples (23 on P2, 8 on P1, P3 and P4; each equals the 5 x 5 mean of its panel within 1 per channel), the colour checks, the shape targets and the mean inside the mask.
- Mean colour inside the P2 mask: (153, 132, 227), saturation 0.459, brightness 0.898 (51017 px). Tolerance 12 per channel, saturation 0.04.
- `check_stage.py` files (E02's world-generic form): `stage_samples.json` (panel mode, `--panel 2`, reads `public/aether/ref/p2.png` as its high-quality reference), `world_samples.json` and `world_reference.json` (world mode; registration: origin (257, 252) = the P2 panel centre, 100 px per world unit, +y up).

## Task 2: bundle, character, intro pose and stage backdrop

Still: `.tmp/aether-intro.png` (1012 x 1008, intro frozen, `WORLD=aether node scripts/stage-capture.mjs intro .tmp/aether-intro.png`), and the side by side with `public/aether/ref/p2.png`: `.tmp/aether-intro-vs-p2.png` (both git-ignored). Colours were not tuned here (Task 6 does).

Verdict, by eye, honest:
- **Pose and silhouette: close.** Eight arms, the upper side pair rolling their tips down and in, the second and third pairs curling, the centre pair hanging, span and head size within a few percent of P2. The head reads a little smaller and rounder-topped than P2's; the arms' rest bend is a touch stiffer than the painted ribbons.
- **Colour: not yet Aether.** The dome is dark navy-violet where P2 is pale lavender with a blue-white crown sheen; the arms are saturated royal blue and opaque where P2's are translucent periwinkle with a pink-white glow along the underside; the cups are white rings, not a glowing beaded frill. The face glow (pink-white, below the eyes) and the eyes (violet irises, two catchlights, lashes, blush) are right in kind. Water is indigo (fitted to the P2 mid water), not black, with Nox's rays; no ruins, jellyfish or gold ring yet (later tasks).
- **Title block:** the engine's intro shows the project name ("AI Playground") as the big title and the epithet block under it; P2 has "Aether" large with "AI Playground" under it. The icon is Nox's red flame (the engine has no `ringedPlanet` icon: see below). Both are engine/UI matters outside this task.
- Start values to tune in Tasks 3 and 6: `armBody`, `rimTop`, `glow.ramp` upper stops, `halo`, `domeTint`, suckers, `skin`.

Theme sampling (build time, 3 x 3 means of the native panels): P3's View Project button runs lavender to violet left to right: `#b79bf8`, `#a68ff8`, `#8f73fb`, `#7b62f7` (top row of samples), so `accent` `#9a80f8` (their mean), `buttonFrom` `#b79bf8`, `buttonTo` `#7b62f7`. P5's Live Demo: `#b89ffb` to `#826cf9` (`liveFrom` / `liveTo`). P5's panel surface about `#081132` to `#0e1333` (surface `rgba(10, 16, 48, 0.92)`). The brief's `nameplateLabel: 'The Curious Mind'` is the epithet text; in the engine `nameplateLabel` is a colour (`#d8d0f8` here), and the epithet is `content.project.characterEpithet`.

Not as the brief wrote it (all because `src/engine/**` is not this task's to change):
- **`titleIcon: 'ringedPlanet'`** is refused by `validateBundle`: the engine's `TITLE_ICONS` (`src/engine/ui/titleIcons.ts`) has only `flame`. The theme uses `flame` until the engine gains a ringed planet. Needs an engine entry (a small SVG component and a test).
- **Zero shells** crashes the engine (`layoutOrbits`: `i % shells.length` gives `shells[NaN]`). The placeholder is one shell of radius 0 with bubble size 0, so nothing is drawn; Task 5 replaces it.
- **`kit piece missing: chain`**: `Kit.tsx` looks up the `chain` and `chain_lod1` nodes even when the layout has no chain, so `stage.glb` carries those two names as one-triangle stubs.
- The engine's logo table has no marks for OpenAI, React, Next.js, PostgreSQL, AWS or Vector DB: those orbs will show the lettered fallback until `LOGO_SLUGS` gains them.
