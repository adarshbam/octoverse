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

`public/octoverse/ref/p2-mask.png` (512 x 508, 61 374 px inside). `scripts/silhouette.py` only prints head half-widths per row from `Nox.jpeg`; it writes no mask and is not usable on the host's panel, so the mask was made by its method (bright rim threshold, luminance > 85) as a connected component grown from the head, by `scripts/make_p2_mask.py` (needs cv2, not a repo dependency; `--check` confirms the committed mask is what it makes):
- luminance > 85, rows above y 205 (title and text above the dome) and below y 455 (pill) cleared, 3x3 opening, 4-connected component containing the head (256, 300), holes filled;
- one bubble touching the left arm removed (x 68..95, y 275..312);
- the cards, the other bubbles, the title, the text and the pill fall out because they are separate components or outside the row band. Checked by eye on a green overlay.

### Targets

- `meanInside` on the P2 mask: rgb (164, 116, 204), saturation 0.518, brightness 0.866 (tolerance 12 per channel, saturation 0.04). Recorded; the host's render is judged against it.
- Sample window: a `size` x `size` square from `x - floor(size/2)`, `y - floor(size/2)`. The spec's integer targets equal that window's mean to within 0.5 on all 22 samples (the other centring convention misses by up to 21), so the spec values are kept verbatim.
- `stage_samples.json` panel `"2"` points are `[world x, world y, panel px, panel py]` with origin (256, 254) and 100 px per world unit, read by `check_stage.py` through its `hq` path (`public/octoverse/ref/p2.png`, frame [5.12, 5.08]). `colorTolerance` is 24 (max channel delta, as Nox's: the script has no delta E in that path; the spec's delta E 10 is in `targets.json`).
- `world_samples.json`: mean/saturation/brightness window from `meanInside` and the 17 P2 points as regions. `check_stage.py --world` cannot read it for the host yet (its panel 2 high-quality image is hard-coded to Nox's `public/spike/nox-panel2-hq.jpg`); that needs a script change in a later task.

### Notes for the later render-check task

- `world_samples.json` brightness range (meanInside +- 0.05) is the implementer's choice: the spec fixes only the RGB tolerance (12 per channel) and the saturation window (0.04).
- `check_stage.py` reads every sample through a fixed 6 x 6 px patch (`r = 3`), while the spec's sample sizes run from 3 to 12 px (`size` in `targets.json`). The render-check task should compare per-sample sizes (as `targets.test.ts` does) rather than rely on that patch.

## Task 2: host bundle, intro pose and stage backdrop (2026-11-04)

### Landed names that differ from the plan

- `WORLDS` exists only in `src/worlds/index.ts` (the registry). The engine has no list of shipped ids: `WorldId` is `string`, checked by pattern in `validateBundle`, whose `worlds` argument defaults to `[]` (not `WORLDS`). The "Engine as landed" table above names an engine `WORLDS` that is not there. Registering `octoverse` needed no engine edit.
- `Project` has `name`, not `title`: `HOST_CONTENT.project` is `{ id: 'octoverse', name: 'OctoVerse', tagline: 'Create. Showcase. Belong.', ... }` (plus the required `characterName`, `characterEpithet`, `introduction`).
- `HOST_CONTENT` is `{ project, technologies }` (the bundle's `content` shape); the sequence set is `HOST_SEQUENCES` in `bundle.ts`, the swim `HOST_SWIM` in `swim.ts`.
- The registry test (`src/worlds/index.test.ts`) lists the shipped ids, so it changed with the registration (`['nox', 'octoverse']`) and holds the `resolveWorld('?world=octoverse')` test: a world's own tests may not import the registry (boundary test). Each shipped world also needs `review/world_reference.json` (added for P2).

### Measured (P2 frame, 512 x 508 at scale 2, frozen intro)

- Head: half-width 0.84, top 0.33, centre x 0.00 (config; the render's mask gives top 0.33 and row half-widths 0.31, 0.55, 0.68, 0.77, 0.82, 0.84 at y 0.29 down to -0.16, against P2's 0.31, 0.52, 0.69, 0.74, 0.84, 0.86).
- Face anchor (intro): (0, -0.560, 0.714).
- Arm span: 4.656 from the traced curves and tube radii (the unit test), 4.68 on the render's mask (x -2.54 to +2.14). P2's own mask spans 4.42; the shoulder and low arms are spread 1.06 to meet spec 2.2's 4.70.
- Mask IoU against `p2-mask.png`: 0.714 (gate 0.85 belongs to the look tasks). Mean inside the P2 mask: (134, 90, 173) against (164, 116, 204).
- Water: mid water (17, 34, 92), delta E 5.8; just outside the head (18, 37, 94), 7.8; upper water (14, 89, 160), 18.3. Character samples are Task 3's (skin is still the shared skin).

### Gaps found

1. A world with no kit: the engine has no "no kit" option. `REEF_STAGE.kit` is `{ url: '', pieces: [] }`; the kit loader fetches `''`, fails twice (two page errors, `Could not load : Unexpected token '<'`), and the world steps down to its last level (water, fog, light), which is what the stage backdrop wants.
2. `scripts/stage-capture.mjs` refuses a still whose kit did not load (`window.__octoverse.world.kit` must be true), so it cannot capture the host. The Task 2 still was taken with a scratch copy that waits for the same ready flag, sequences and frames but skips the kit check. A later task should teach the script about kitless worlds (or the engine about them).

## Task 3: the host's look (2026-11-04)

**Verdict: provisional, pending owner.** The look meets the global checks, IoU and the shape targets; 12 of 17 P2 samples are within delta E 10 (corrected after review from 13; see round 2 below). Gate review entry in `docs/superpowers/MORNING-REVIEW-platform.md`.

### What landed

- `HOST.skin.surfaces`: jelly on the mantle (crown `#5565fc`, depth `#804ee6`, core `#feafb5`, rim `#b8b0ff`) and the arms (depth `#3a37d5`, core `#f5afba`), sparkle 40 and 35 per square unit.
- `HOST.suckers.style`: rim `#f8c59f`, edge `#f8c098`, violet hollow `#6a3cb0`, glow 1.4, frill packed (spacing 2.1, tilt 14).
- `HOST_FACES` maps spec 7.3's presets onto existing ids: welcome `happy` (the intro face), presenting `attentive`, delighted `focused`, restful `restful`. `gentle` is overridden to the welcome too, so the engine's settling face (entrance, swim) is the open smile (spec 7.3: the open smile is its rest face).
- Arms re-traced against the P2 mask with root radius 0.22 (was 0.13 to 0.15) and `ARM_SPREAD` 1.04 (was 1.06): IoU 0.714 to 0.855, span 4.61. The centre pair's tips lifted clear of P2's pill.
- Mouth re-laid for P2's flat-topped open D (centre y -0.778, depth 0.03, open 1); blush at the outer eye corners (+-0.55).
- Stage water: zenith and glow brighter toward P2's lit top right.
- `scripts/platform-capture.mjs` (kitless capture, the `TODO(kitless)` at the kit line), `scripts/host_delta_e.py` (per-sample CIE76, global checks, IoU, mean inside, face positions, specks).

### Measured

| Sample | Target | Task 2 | Task 3 | dE before | dE after |
|---|---|---|---|---|---|
| crown | 85, 101, 252 | 96, 71, 226 | 91, 99, 245 | 13.6 | 3.0 |
| upper head | 128, 78, 230 | 101, 67, 244 | 135, 98, 242 | 14.6 | 8.6 |
| forehead | 224, 129, 208 | 171, 92, 220 | 215, 130, 224 | 31.5 | 9.3 |
| between the eyes | 254, 175, 181 | 251, 167, 188 | 255, 172, 181 | 7.6 | 2.0 |
| face glow beside mouth | 253, 182, 183 | 242, 166, 198 | 254, 173, 186 | 16.2 | 7.5 |
| chin | 253, 181, 183 | 242, 159, 217 | 255, 187, 195 | 29.6 | 4.2 |
| head side left | 95, 80, 237 | 108, 66, 212 | 116, 89, 224 | 9.2 | 13.4 |
| head side right | 134, 131, 253 | 102, 64, 208 | 111, 87, 223 | 29.2 | 19.6 |
| blush | 241, 172, 195 | 242, 172, 197 | 248, 173, 192 | 1.3 | 3.5 |
| mouth inside | 129, 28, 52 | 173, 112, 117 | 129, 45, 52 | 31.9 | 8.4 |
| tongue | 250, 123, 109 | 151, 65, 77 | 248, 129, 117 | 34.7 | 4.7 |
| arm upper | 58, 55, 213 | 27, 33, 88 | 142, 108, 206 | 60.1 | 41.4 |
| arm underside | 245, 175, 186 | 93, 72, 123 | 223, 142, 187 | 53.4 | 20.7 |
| cup rim | 248, 197, 159 | 202, 119, 162 | 255, 196, 167 | 48.3 | 4.8 |
| water outside head | 2, 22, 72 | 18, 37, 94 | 20, 40, 94 | 7.8 | 8.7 |
| mid water | 20, 30, 95 | 17, 34, 92 | 21, 38, 93 | 5.8 | 8.6 |
| upper water | 16, 129, 219 | 14, 89, 160 | 23, 117, 189 | 18.3 | 11.0 |

- `check_stage.py --stage intro --world-id octoverse` (max channel delta, tolerance 24, 7 x 7 px patches): 4 misses, head side right 44, tongue 26 (its 7 x 7 patch takes in the lip; the spec's 3 px sample is 4.7), arm upper 57, upper water 33.
- IoU 0.855; mean inside (161, 116, 194), saturation 0.481; span 4.61; eyes (+-0.40, -0.54); mouth -0.85; specks head 113, arms 687.
- Frame rate 53.2 fps median, slow10 28.4 (tier low, production build, under load).

### Gaps

1. Head sides (BLOCKED on E02b / owner): P2's are lit asymmetrically, 28.7 apart; the mantle shading has no directional term the config can turn. Best symmetric value is about 14.5 from each.
2. Arm upper: T1's inner edge beside the head takes the engine's arm rim light, where P2 is dark blue.
3. Arm underside and cup rim are 3 px samples on a frill whose cup positions follow `spacing` and `tilt`: they swap between band and cup with small changes. The final set lands the cup sample on a cup.
4. Mean saturation 0.481 is near the floor (0.478): lighter arms or brighter cups push it out.
5. A full `npx vitest run` under load times out 1 to 3 python-spawning tests in `src/worlds/reviewTooling.test.ts` (5 s limit); the file passes alone (3 of 3). Not touched by this task.

### Round 2 (review fix, 2026-11-04)

- `scripts/host_delta_e.py` read every sample from a window centred on the listed pixel; spec 2.1's targets were read from `x - floor(size/2)` to `x - floor(size/2) + size`. Fixed, so P2 reads delta E 0.0 on every sample (cup rim (248, 197, 159), arm underside (245, 175, 186)). On the round 1 still the fixed window gives 12 of 17, not the 13 of 17 first reported (arm upper 43.6, arm underside 11.2).
- Look: violet-lavender arm tops (arm crown `#8a7cff` from height 0.4, armBody `#5c48e4`, arm depth `#3c44f0` at 0.48), amber-orange cup walls (edge `#ffa868`), lighter underside band (terminator `#ffbcb4`, belly `#ffd4c0`), a rounder head (top 0.35, topPower 1.7, bottomPower 2.45) and T1 moved 0.02 to 0.06 toward the head.
- Result: 12 of 17 within delta E 10 (arm upper 43.6 to 18.8, arm underside 11.2 to 14.5, cup rim 5.0 to 9.3; the rest within 2), every global check passes, IoU 0.856, mean inside passes (saturation 0.484 against a 0.478 floor).
- Still open: the head sides need one-sided mantle light (BLOCKED on E02b / owner); arm upper is P2's deep blue gap and fights the lighter arms; upper water 11.0 (brightening it further lifts mid water and the water by the head).

## Task 5: the reef world (2026-11-05)

**Verdict: provisional, pending owner.** The reef is in the host bundle as `REEF_WORLD`, with near bake, far plate, membrane gate, glow materials and live water. P2 holds Task 3's 12 of 17 with no passing sample regressed. The gate's brightest is 0.32 of the face glow's. Frame rate is marginal against the 40 fps floor under load. Gate review entry in `docs/superpowers/MORNING-REVIEW-platform.md`.

### What landed

- `src/worlds/octoverse/place/config.ts`: `REEF_WORLD` with a sand floor (path `#a97896`, four path lights), membrane, ember, coral and path lights, a `gate_membrane` membrane in violet-blue `#7538fc`, glow materials for the windows, the glass cards and the magenta corals, the camera hover pace 0.85, bubbles and motes (no snow, no embers, no jellyfish, no props). floorY is -2.45.
- `kit.ts` and `far.json`: the kit list and the far plate (three layers at z -42, -28 and -18, 21 extras, 116 KB of KTX2).
- `blender/reef/bake_world.py` and `render_far.py`: thin overrides of the vault's bake and far scripts. They produce `near.glb` (2.68 MB) and `far/far-0..2.ktx2`.
- `blender/reef/build_kit.py`: the glyph's emissive is dimmed below the face glow (relic rule). Coral lod0 is decimated to 45%, so placed lod0 falls from about 75k to about 35k triangles. The build stays deterministic.
- `scripts/reef_check.py`: the gate against the face glow in the intro, and the P1 samples.
- `src/worlds/octoverse/place/config.test.ts`: 16 tests (one skipped: jellyfish), including validateWorld, no hex outside the palette, `post` present, the bake record against the layout and lights, the far plate sizes, and the visitor budget below 6 MB.

### Measured

| Sample | Target | Task 3 | Task 5 | dE Task 3 | dE Task 5 |
|---|---|---|---|---|---|
| crown | 85, 101, 252 | 91, 99, 245 | 91, 99, 245 | 3.0 | 3.2 |
| upper head | 128, 78, 230 | 135, 98, 242 | 133, 99, 243 | 8.6 | 8.9 |
| forehead | 224, 129, 208 | 215, 130, 224 | 215, 130, 224 | 9.3 | 9.3 |
| face glow beside mouth | 253, 182, 183 | 254, 173, 186 | 253, 174, 184 | 7.5 | 5.8 |
| water outside head | 2, 22, 72 | 20, 40, 94 | 25, 33, 93 | 8.7 | 8.6 |
| mid water | 20, 30, 95 | 21, 38, 93 | 25, 32, 92 | 8.6 | 3.3 |
| upper water | 16, 129, 219 | 23, 117, 189 | 23, 117, 189 | 11.0 | 11.0 |

The other samples read as in Task 3 round 2 (within 0.2). The misses are the same five as Task 3's.

- Gate against the face (intro, reference-masked): 0.230 against 0.712 (ratio 0.32). The gate's own surfaces: membrane and glyph 0.135, windows 0.10.
- Frame rate, production build, intro, under load: 40.2, 29.0 and 37.5 fps median (final build). The reef adds about 4.5 ms GPU per frame (22.5 to 23.4 ms against 18.2 to 18.8 ms kitless).

### Gaps

1. The verbatim fog `#021648` dropped P2 mid water to 12.9, and the verbatim glow `#1081db` dropped upper water to 17.4. Task 3's `#141e5f` and `#20a8ff` are kept. The test pins them within delta E 20 of the brief's values.
2. P1's membrane is out of reach of the membrane variant (body 0.32 x colour, delta E about 60 to 80). This is BLOCKED on E02b. The P1 frame itself waits on Task 12.
3. The gate shows in the intro beside the head. The layout is static; Task 6's frames own per-stage framing.
4. Magenta corals use a glow material, so they get no sway and no rest drop; their y is set by hand from the bake's rest heights. E02b: a per-node coral colour.
5. Cuts for frame rate, in spec 7.16 order: coral lod0 to 45%, and snow off. The tier-low cuts (rays, motes) are already engine defaults, and a world cannot make tier-only cuts. Production ignores `tier=low`.
6. `scripts/platform-capture.mjs` tolerates a kit error for octoverse, so it captures the level-2 world. Task 5's stills use `stage-capture.mjs` with `kitwait=90000`. The kitless tolerance should be retired.
7. Fixed in passing: `bundle.test.ts` had a typecheck error (`placement.shells` on a union).

## Task 6: the entering and How It Works poses (2026-11-05)

Verdict: provisional, pending owner.

### What landed

- `src/worlds/octoverse/poses.ts`:
  - `HOST_POSES.overview` traced from P3: body (-0.13, -0.52), scale 0.96, tilt -0.19 rad (the head's top leans right 10.9 degrees), `headMorph: 0`, the presenting face, every root the intro's.
  - `techFocus` and `detail` equal the overview.
  - `HOST_POSES.entering`: P1's trailing bundle (the swim's trail) on the intro body, with the welcome face.
  - `HOW_IT_WORKS_CARDS`: the five spec 7.10 boxes from their shares of P3's panel, in stage units.
  - The swim's open and trail shapes: generated from the intro roots at 1.15 times the intro length (`SWIM_STRETCH`), and built on first read.
- `swim.ts` reads them. `bundle.ts` frames entering at P1 (5.10 x 5.08) and the overview, focus and detail at P3 (5.11 x 5.08).
- `character.ts`: mantle crownHeight 0.45 to 0.58.
- `scripts/host_panel_check.py`: the P3 and P1 samples, the overview head and the eye line.
- Tests: `poses.test.ts` (20 tests); the swim placeholder test in `bundle.test.ts` is replaced.

### Measured

- The overview head:

  | Measure | Pose | Still | Spec |
  |---|---|---|---|
  | Top | -0.198 | -0.20 | -0.24 ± 0.05 |
  | Half-width | 0.813 | 0.80 | 0.81 ± 0.05 |
  | Centre x | 0.002 | 0.00 | 0.03 ± 0.05 |

- P3 samples: upper head (129, 95, 232) 9.4; face glow (255, 174, 172) 5.7.
- P2: 12 of 17 within 10 (the same misses); crown B - R 140.2; IoU 0.856.
- Gate in the intro: 0.230 against 0.712, unchanged.

### Gaps

1. The gate in the intro is engine-blocked. `StageFrame` is width and height only, and the camera sits on the stage axis. The narrowest frame that excludes the membrane (x 0.95 to 2.05) crops the 4.7 arm span (E02b or owner).
2. P1's head place and profile belong to the entrance sheet (Task 12). The entering pose is P1's arm shapes only, as Nox's is.
3. The face sits lower on the dome than P3 paints it, so the body is offset within tolerance to keep the face-glow sample on the chin.
4. The crown change trades P2 crown margin for P3's upper head.

### Fix round 1: overview arms spread like P3 (2026-11-05)

- The overview arms are re-traced. The lower six fan out (T2 to x -2.1 under Aether, T7 under the gold card's bottom edge). T1 and T8 leave the body low and wide, rise more than a unit and curl outward near y -0.4.
- The presenting face is the open smile: mouthOpen 0.6 to 0.85, mouthCurve 0.85 to 0.9.
- Still: arm span x -2.20 to 1.82 (4.02); head top -0.20, half-width 0.79, centre -0.01; P3 upper head 9.4, face glow 5.8.
- Intro untouched: 12 of 17, IoU 0.856, crown B - R 140.2.
- Gap 4 of the craft list (arms short, lower arms bunched, small mouth) is closed for the spread and the mouth. The head is still large relative to the arms: arm length is the config's.
