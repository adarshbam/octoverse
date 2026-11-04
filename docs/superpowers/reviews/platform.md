# Platform host (OctoVerse) review log

Reference checks for the host world (`octoverse`), from `docs/superpowers/specs/2026-11-03-platform-3d-design.md` sections 2.1 and 2.2.
Files: `src/worlds/octoverse/review/{stage_samples,world_samples,targets}.json`, `targets.test.ts`, `public/octoverse/ref/{p1,p2,p3,p2-mask}.png`.

## Task 1: reference crops, mask, samples and targets (2026-11-04)

### Engine as landed

Found with `grep -rnE "export (const|type|interface|function) (<names>)\b" src/engine src/worlds` (the plan's `rg` is not installed here; same pattern).

| Name | File |
|---|---|
| `WorldBundle` (interface) | `src/engine/types/bundle.ts` |
| `validateBundle` | `src/engine/types/bundle.ts` (`(bundle, worlds = WORLDS)`) |
| `faceAnchor` | `src/engine/types/bundle.ts` |
| `WORLDS` | `src/engine/types/bundle.ts` (`readonly ['nox']`, the shipped ids) and `src/worlds/index.ts` (`Record<WorldId, WorldBundle>`, the registry) |
| `resolveWorld` | `src/worlds/index.ts` |
| `useInstanceApi` | `src/engine/host/useInstanceApi.ts` |
| `PreviewOptions` (interface) | `src/engine/host/options.ts` |
| `previewToReview` | `src/engine/host/options.ts` |
| `capTier` | `src/engine/stage/quality.ts` |
| `screenToStage` | `src/engine/stage/anchors.ts` |
| `ExitLink` | `src/engine/ui/ExitLink.tsx` |
| `resolveExpressions` | `src/engine/behavior/expressions.ts` |
| `EntranceShape` (interface) | `src/engine/sequences/keys.ts` |
| `clampCharacterConfig` | `src/engine/config/validate.ts` |
| `SurfaceLook`, `JellySettings`, `SuckerStyle`, `LIVE_ELEMENTS`, `KIT_MATERIAL_VARIANTS` | pending (Veyra Task 3/4/8/10, Aether Task 7) |

Also relevant: `WorldId` is `string` (`src/engine/types/bundle.ts`); `WorldHost` is exported from `src/engine/host/WorldHost.tsx`, `HostProps` from the same file. `WORLDS` in `bundle.ts` must gain `'octoverse'` (and `src/worlds/index.ts` its entry) when the world is registered; Task 1 does neither.

`WorldHost` props (`HostProps`, `src/engine/host/WorldHost.tsx`):
- `bundle: WorldBundle`
- `options: ReviewOptions`
- `mode?: 'page' | 'preview'` (default `'page'`)
- `ui?: 'engine' | 'none'`
- `preview?: PreviewOptions`
- `initialStage?: LinkStage`
- `onStageChange?: (stage: StageId) => void`
- `stageRequest?: { id: number; stage: LinkStage }`
- `exit?: { label: string; href: string }`
- `children?: ReactNode`

`InstanceApi` members (`src/engine/host/useInstanceApi.ts`):
- `stage: StageId`
- `faceAnchor: Vec3`
- `liveShift(world: Vec3): { dx: number; dy: number }`
- `explore(): void`
- `back(): void`
- `skip(): void`
- `attend(target: { x: number; y: number } | null, opts?: { reach?: boolean }): void`

`PreviewOptions` fields (`src/engine/host/options.ts`):
- `stage: LinkStage`
- `tierCap?: QualityTier`
- `motion: 'still' | 'ambient'`
- `place: 'full' | 'backdrop'`
- `artifacts: 'settled' | 'hidden'`

Platform gaps found (scheduled as a later E02b; not patched here):
1. A preview that takes input and plays the entrance: a preview never plays the entrance (`PreviewOptions.stage` "never the entrance") and its options are read at mount only.
2. HTML layer sizing to the window, not the instance box: the host's overlays follow the viewport (`useViewport`), not the instance's own box.
3. Still previews run `frameloop` always: `<Canvas frameloop={visible ? 'always' : 'never'}>`; `motion: 'still'` freezes the scene (`freeze`) but the render loop still runs.

### Mask

`public/octoverse/ref/p2-mask.png` (512 x 508, 61 374 px inside). `scripts/silhouette.py` only prints head half-widths per row from `Nox.jpeg`; it writes no mask and is not usable on the host's panel, so the mask was made by its method (bright rim threshold, luminance > 85) as a connected component grown from the head, with a script kept outside the repo:
- luminance > 85, rows above y 205 (title and text above the dome) and below y 455 (pill) cleared, 3x3 opening, 4-connected component containing the head (256, 300), holes filled;
- one bubble touching the left arm removed (x 68..95, y 275..312);
- the cards, the other bubbles, the title, the text and the pill fall out because they are separate components or outside the row band. Checked by eye on a green overlay.

### Targets

- `meanInside` on the P2 mask: rgb (164, 116, 204), saturation 0.518, brightness 0.866 (tolerance 12 per channel, saturation 0.04). Recorded; the host's render is judged against it.
- Sample window: a `size` x `size` square from `x - floor(size/2)`, `y - floor(size/2)`. The spec's integer targets equal that window's mean to within 0.5 on all 22 samples (the other centring convention misses by up to 21), so the spec values are kept verbatim.
- `stage_samples.json` panel `"2"` points are `[world x, world y, panel px, panel py]` with origin (256, 254) and 100 px per world unit, read by `check_stage.py` through its `hq` path (`public/octoverse/ref/p2.png`, frame [5.12, 5.08]). `colorTolerance` is 24 (max channel delta, as Nox's: the script has no delta E in that path; the spec's delta E 10 is in `targets.json`).
- `world_samples.json`: mean/saturation/brightness window from `meanInside` and the 17 P2 points as regions. `check_stage.py --world` cannot read it for the host yet (its panel 2 high-quality image is hard-coded to Nox's `public/spike/nox-panel2-hq.jpg`); that needs a script change in a later task.
