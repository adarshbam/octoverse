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

## Task 5b: reef cards bob, jellyfish (2026-11-05)

**Verdict: provisional, pending owner.** Closes ruling R14 now that the engine has the `bob` drive and the `jellyfish` element (Aether Task 7).
- `REEF_WORLD.props`: `card_glass_01..08`, each a `bob` prop with its own id (the engine derives the phase from it), amplitude 0.04 to 0.08 units, period 5 to 9 s, eight different pairs. The cards keep their glow material: `validateWorld` only refuses an `emissive` drive beside a glow, so `bob` and glow coexist.
- `REEF_WORLD.live.elements.jellyfish`: count 5 / 3 / 2 (high / medium / low; the 7.16 floor of two holds), bell `#ff8a3a` (palette coral), filament `#b48cff` (palette glyph), size 0.14 to 0.26, pulse 3 to 6 s, drift 0.04, region x -3.5 to -2.3, y 1.4 to 3.6, z -7.5 to -5.5: behind the cards, upper left of the intro frame, away from the face (tests).
- Tests: the two `TODO(Aether Task 7)` skips are real (`config.test.ts`: jellyfish values, and the region off the face anchor and in the outer part of the frame; `layout.test.ts`: the cards on `bob`). Red first (3 failing), then green.
- Host look: unchanged. The new frozen intro reads the same 17 delta E values as the engine-synced HEAD without the change (12 of 17 within 10, the same five misses: head side left and right, arm upper, arm underside, upper water). Against the Task 5 still, the engine sync moved the crown (3.2 to 5.3; crown B-R 153.6 to 140.2, at the 140 line) and upper head (8.9 to 8.3): not this task.
- Frame rate under load: 43.1 / 43.1 / 40.5 median (slow10 27.9 / 27.2 / 25.6); GPU 22.76 ms per frame. Task 5: 40.2 / 29.0 / 37.5. No cut taken.
- Still: `docs/superpowers/evidence/platform/m2/task5b-reef-intro.png`.

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

## Task 8: platform shell and landing compositions (2026-11-05)

**Verdict: provisional, pending owner.** `/` is the intro (P2) and `/how-it-works` is How It Works (P3), one host page instance (`ui: 'none'`) that stays mounted from one to the other. Unit 17 of 17 (`landing.test.tsx`), e2e 9 of 9 (`platform-landing.spec.ts`), no card, button or text rectangle meets the host's eyes or mouth at 1536 x 1024, 768 x 1024 or 390 x 844 (nearest 199 / 64, 145 / 49, 81 / 127 px, intro / How It Works). Gate review entry in `docs/superpowers/MORNING-REVIEW-platform.md`.

### What landed

- `src/platform/App.tsx` (the shell: `/` and `/how-it-works` are the landing; other routes are an honest "not open yet" page), `pages/Landing.tsx` (the host, the route and the stage kept in step: the route asks for the stage by `stageRequest`, the stage asks for the route by `onStageChange`, so Escape and browser Back agree), `LandingText.tsx`, `HowItWorks.tsx`, `Nav.tsx`, `YourOctopusPicture.tsx`, `geometry.ts`, `hooks.ts`, `ui/tokens.ts`, `ui/glass.css`, `ui/Link.tsx`.
- Placement from the instance API alone: stage units to pixels on the z = 0 plane (`geometry.ts`, checked against the engine's `stageBoxFor`), the hovering camera's shift from `liveShift` written each frame to `translate` (`useShift`). The dev build writes `window.__platform.faceRect` (eyes and mouth, in px, shift included).
- Card epithets come from each world's content module (`worlds/<id>/content/<id>.ts`, a bare data file), never a bundle; a test reads the platform sources and fails on any other world import.
- `src/app/main.tsx`: `?world=` (and `?creator=`) mount `Page` as before. So that the engine's own review pages and Nox's e2e specs keep working, a bare `/` carrying one of the engine's review switches (`stage`, `tech`, `nowebgl`, `view`, ...) is still the engine's page. The platform mount makes the static boot veil neutral (the page's inline script gives bare `/` Nox's "Security Lab" veil; index.html is pinned by `bootVeil.test.ts`, so the platform sets `data-boot-world` itself).

### Workarounds and gaps (E02b where named)

1. The host box on a phone (upper 55%): the engine's canvas is `position: fixed; inset: 0`. A `transform` on an ancestor makes that the containing block, so the canvas and the stage camera's framing (which reads the canvas size) fill the box. The engine's own HTML does not use the box (E02b gap 2: the HTML layer sizes to the window); nothing of it shows under `ui: 'none'`.
2. The overview pose is framed for the whole square on a phone too, so the host sits low in its box with water above (the host bundle's frames are per stage, not per layout). Back sits there.
3. Bare `/` is now the landing: Nox's own specs that load `/` with no query (`entrance.spec.ts`, `fallback.spec.ts` `/`, `world.spec.ts`, `worldSwitch.spec.ts`) reach the landing, not Nox. They need `/?world=nox` (not changed here: the plan's Task 14/final suite says "unchanged").
4. The engine's `ui: 'none'` has no "entrance settling" signal, so the intro's words come in when the stage becomes the intro (the engine's own overlay fades in a beat earlier). The skip control is the platform's own button; any click or key skips too.
5. Stills use `object-fit: cover` at `50% 64%` on a 70% picture; the headroom the stills carry is trimmed, not regenerated.

## Task 9: showcase fixtures, profile, Explore and not found (2026-11-05)

**Verdict: provisional, pending owner.** Static compositions with engine stills (live previews come in Task 13, routes in Task 14). Unit tests pass (`showcase`, `tabKeys`, `profile`, `explore` and the boundary allowlist cases), e2e 37 of 37 (`platform-pages.spec.ts`: no horizontal scroll at 360, 390, 768, 1024 and 1536 and 44 px targets on all seven pages, the tabs by keyboard). Stills in `docs/superpowers/evidence/platform/m3/`; review entry in `docs/superpowers/MORNING-REVIEW-platform.md`.

### What landed

- `fixtures/worldContent.ts` reads each world's own content (`<id>.ts`, `<id>Project.ts`, `<id>Technologies.ts`) into what the pages say; `fixtures/showcase.ts` builds the deep-frozen `SHOWCASE` (veyra, flux, nox, aether, one project each) and `profileFor`. No text is copied: the slugs are the projects' ids (`vault-os`, `github-pipeline-engine`, `security-lab`, `ai-playground`).
- `pages/Profile.tsx` (hero still, identity, `Enter <name>'s world`, an accessible tab list: `Tabs.tsx` with the pure keyboard rule in `tabKeys.ts`), `Explore.tsx`, `NotFound.tsx`, the shared frame in `parts.tsx` and the look in `pages.css`. A temporary `?page=profile&handle=...|explore|notfound` switch in `App.tsx` (Task 14 removes it).
- Boundary: the platform may now also import a showcase world's own `<id>Project.ts` and `<id>Technologies.ts` (test-only edit to the allowlist in `src/engine/boundary.test.ts`, with a comment and cases that still fail on another world's, a bundle or `placeholders.ts`). The content module `<id>.ts` holds no project id, screenshot or technology list.

### Gaps

1. The reef water is CSS, and the not-found page has no host picture: no still of the reef's far water or of the host exists yet.
2. No profile link or location in any content, so none shows. Usage notes exist for three technologies only (storyboard panel 4 text, flagged placeholder).
3. Hero and tiles are stills; the "alive" behaviour (live preview on hover, the arm reaching for the card) waits for Task 13.

## Task 10: creator composition, static (2026-11-05)

**I01 statics: provisional, pending owner.** The creator layout of spec 7.13 over a static sample draft: `creator/CreatorPage.tsx`, `OctopusPanel.tsx`, `ProjectsPanel.tsx`, `creator.css`; types and preset names in `types.ts` (types only, Task 18 adds validation); `sampleDraft.ts`, pure `draftEdits.ts`, `technologies.ts` (the worlds' own technology names, a stand-in for the shared catalogue) and `swatchColours.ts` (eight colours sampled from P4, with pixel coordinates; Task 17 re-records them in palettes.ts). Unit tests pass (`creatorPage.test.tsx`), e2e 11 of 11 (`platform-creator.spec.ts`). Stills `creator-<w>x<h>.png` in `docs/superpowers/evidence/platform/m3/`; review entry in `MORNING-REVIEW-platform.md`.

### Gaps

1. The picture is the gold glyph card, not a render; template thumbnails are the four world stills (creator stills: Task 18).
2. The edits live in memory (the temporary `?page=create` holds the draft in state); no storage.
3. The page scrolls inside `.oct-page` because index.html's boot style hides overflow on html, body and #root. The Task 9 pages lack this and cannot scroll on a phone: a Task 14 fix.


## Task 13: How It Works alive (2026-11-05)

**Provisional, pending owner (the live landing was not reviewed: no owner overnight).** `previews/previewSlot.ts` (one live preview at a time; `usePreviewSlot(owner, wanted, lingerMs)`), `previews/LivePicture.tsx` (still at rest; the world's bundle through `loadWorld`, never imported; `mode: 'preview'` instance cross-faded in once its canvas has drawn 3 frames, the page has settled and the slot is granted; unmounts 300 ms after `live` goes false; stills only on phones (under 768 px), coarse pointers and reduced motion; a failed load or a throwing preview leaves the still), `useHot.ts` (hover or keyboard focus), `useCanPreview.ts`. `HowItWorks.tsx` wires the cards: hover or focus asks the slot and calls `attend(centre in canvas px, { reach: true })`; the last card entered owns the gaze. The ripple was already in the CSS (delay 75 ms x index, 300 ms each, instant under reduced motion): the e2e holds the delays, the event order and the draw order. Profile hero and Explore tiles use `LivePicture` with spec 7.12 and 7.11 options.

Deviations from the brief: `LivePicture` takes the world's id (`world`), not `bundle`, because the platform may not import a bundle statically (spec 2.4); a card and a tile draw the preview's layer beside their button and link through a portal (`into`), because the engine's instance holds buttons and links of its own and nesting them is invalid HTML (React logged an error); `usePreviewSlot` has an optional third argument, the linger. The payload test now expects `loadWorld.ts` in the landing's chunk (a card's preview uses it; each world's bundle is still a separate chunk reached by dynamic import only). Preview start waits for the route fade to be over and the page idle (`useSettled`): started under the fade it held the 250 ms fade for seconds. `scripts/perf.mjs` gained `PATHNAME`, `HOVER` and `READY`.

Numbers: see the morning-review entry (How It Works with one card live missed 36 fps under load: median 32.6; profile hero 68 fps). Orbit stills in `evidence/platform/m4/`.

### Gaps

1. The engine's preview renders its closed detail panel (buttons, links) with `ui: 'none'`; contained by `inert` and the portal. Engine fix (E02b).
2. How It Works with a live card is under its floor on a loaded GPU; a quiet-GPU run is needed before any cut.
3. A preview's first frames cost the main thread (shader compiles); the platform hides this with the still until 3 frames are drawn, not with a lighter start.

## Task 16: resources and performance (under load) (2026-11-05)

**Provisional, pending owner (the visitor experience is the owner's live check).** Measured at HEAD `f54c3cc` (the production build `dist/m5-prod` was built from it; the working tree was not clean in `src/platform/creator/**`, `src/platform/stills/stills.ts` and `src/engine/boundary.test.ts`: Task 17's uncommitted work, none of it in the landing, world or preview paths that were measured). Edge (msedge channel), one Intel UHD GPU shared with other sessions, CPU often at 100%: every number below is 'under load'. Files: `tests/e2e/platform-resources.spec.ts`, `playwright.platform-prod.config.ts` (production `vite preview`, one worker; `npx vite build --outDir dist/m5-prod --emptyOutDir` first; `PLATFORM_PREVIEW_PORT` moves the port), `scripts/perf.mjs` (new `SEEN=<ids|all>` switch). Evidence: `docs/superpowers/evidence/platform/m5/`.

**Review fix round (spec changes NOT re-run).** After review the spec was changed without any browser or Playwright run (another agent holds the single browser slot): the first-frame 3.0 s limit is now asserted by default (`PLATFORM_LOOSE_TIMING=1` is the explicit opt-out, annotated 'UNASSERTED (loose timing)'); the peak context count is exact (taken at every context creation, `loseContext()`, `webglcontextlost` event and DOM change) instead of polled every 50 ms; the heap assertion is on the CDP number; the route-change check also requires the URL to have changed; payload numbers and the first-frame screenshots are saved as evidence. The numbers below were measured with the earlier version of the spec (peak polled every 50 ms; first-frame limit asserted only with `PLATFORM_STRICT_TIMING=1`). The changed spec will be re-run in Task 21 (the final pass).

### Resources: 20 round trips (landing, Explore, profile, world, then Back three times: profile, Explore, landing)

Definition of a live context: a WebGL context made by `getContext('webgl'|'webgl2')` that is not lost (`isContextLost()` false; `loseContext()` sets that at once) and not garbage-collected (a WeakRef, read after a forced collection). `held` counts every such context; `attached` only those whose canvas is in the document. The counters are installed by the test through `page.addInitScript` (no production code changed). Listener count: a test-installed wrapper of the window's `addEventListener` and `removeEventListener` (one entry per type, listener, capture), compared with its count after the first trip as the spec says (so the one-time Theatre `error` and `unhandledrejection` listeners are inside the baseline).

- Contexts: PASS. `held` 1 and `attached` 1 after every trip; peak over the run (polled every 50 ms in the measured version; exact in the current spec, not re-run) held 1, attached 1; mid-trip attached counts 0 (Explore), 1 (profile hero), 1 (world), 0 to 1 (landing, while the host comes back). About 8 contexts are made per trip (probe canvases, the preview, the host, the world) and all are collected or lost.
- Window listeners: PASS. 28 after trip 1 and after every later trip, identical per type (`resize` 5, `pointerdown` 3, `keydown` 2, `touchstart` 2, `error` 1, `unhandledrejection` 1 and so on). Also for 8 trips cycling Veyra, Flux, Nox and Aether (baseline trip 4): 28 throughout.
- JS heap: MISS (known; recorded as `test.fail`, so the suite stays green and the test goes red when the leak is fixed). After forced collections (CDP `HeapProfiler.collectGarbage` x3), trip 1 to trip 20: CDP `Runtime.getHeapUsage` 24.8 to 50.9 MB (+105%, about +1.3 MB per trip, linear); `performance.memory.usedJSHeapSize` 69.7 to 112.9 MB (+62%; an earlier run of the same test and code gave +203%, so that figure is noisy and the CDP one is steady). 8 trips cycling the four worlds: +27% to +34% over trip 4 (performance.memory), CDP 31.1 to 36.1 MB. Spec limit 15%.
  Where it grows (`where the heap grows`: seven cycles of one segment, CDP slope per cycle; the figures of the committed run): landing <-> Explore 0.82 MB, Explore <-> profile 0.44 MB, profile <-> world 1.08 MB (performance.memory 0.68, 0.42, 0.89 MB; 7.8 MB for the world segment in an earlier run). All three segments leak, not the world visit alone. Their sum (2.3 MB) does not add up to the 1.3 MB per whole trip: unexplained (a segment's first cycle pays one-off costs the fit leaves out, and the segments alone do not run the pages in the same order). No context, listener or canvas leaks, so the cause is JS objects kept by something that outlives the page; not identified. Not fixed: engine and world code are outside this task.

  **Open issue: heap growth.** Next diagnostic (not run): run segment A alone (landing <-> Explore, the smallest and platform-only piece); take CDP `HeapProfiler.takeHeapSnapshot` after a forced collection at cycle 5 and at cycle 15; diff the two snapshots by constructor; pick a leaked instance and follow its retainer path to the root that holds it; `renderer.info.memory` (geometries, textures) as a secondary check on the GPU-object side.

### Payload, first frame, route change

- Payload: PASS. The landing and How It Works (pointer moved off the cards) make 32 requests, none for a showcase world's bundle chunk, Theatre state chunk or `/<world>/world/` file (the lists come from the build's manifest). A world route requests its own bundle, state, `near.glb` and far plates and none of the other three worlds'. Found on the way: with the pointer left over a card after "See how it works", the hovered world's preview loads that world's chunk and far plate (by design, a card preview).
- First intro frame (reduced motion, a new browser context per run = cold cache and storage, production preview, 3 runs): the boot veil leaves the DOM at 2719, 1993 and 1451 ms after navigation start (median 1993). The engine removes the veil only after the stage has drawn a frame, so this is the host's first frame; the canvas is not blank (luminance spread 50). First contentful paint 100 to 184 ms; the engine's ready flag (40 frames after the world loaded) 5974 to 7576 ms. Limit 3.0 s: met on all three runs, with little margin on the first (2719). An earlier set of runs on a heavily loaded machine gave 6986, 9912 and 15526 ms. The limit (median of three) is asserted by default; `PLATFORM_LOOSE_TIMING=1` is the explicit opt-out that records the times, does not fail and annotates the run 'UNASSERTED (loose timing)'. The screenshots of the first frame of each run are saved as `first-frame-run<n>.png` by the current spec (not yet produced: spec not re-run).
- Route change with a cached chunk: explore to creator 265, 156, 150 ms; explore to profile 156, 151, 144 ms (limit 500; the maximum is asserted). An earlier loaded run: 469 ms once, then 143 to 175.

### Frame rates (scripts/perf.mjs --gpu, production build, 1536 x 1024, dpr 1, 8 s each, 2 runs per row, back to back)

The production build ignores `?tier=` and `?stage=`: the tier is the engine's own pick for the device (stepped down by its frame probe), so 'tier low' is whatever the device and the load made it. Median fps / mean fps / GPU ms per frame (median, EXT_disjoint_timer_query):

| Row | Floor | Run 1; run 2 | Verdict |
|---|---|---|---|
| Landing intro (`/`, entrance seen) | 40 | 55.9 / 30.2 / 17.2; 28.2 / 29.5 / 21.9 | median fps 55.9 and 28.2 (average 42.1) but mean fps 30.2 and 29.5, both below the floor: undecided under load; GPU ms below is the host's context only |
| Landing entrance (`/`, first visit: measured from 1.5 s after the ready flag for 8 s of it; a placeholder until Task 12) | 32 | 41.5 / 33.0 / 24.0; 41.2 / 32.1 / 24.4 | met |
| How It Works, Flux card live | 36 | 32.6 / 27.7 / 17.6; 36.4 / 25.6 / 23.7 | run 1 below, run 2 at it; mean 34.5: MISSED under load; GPU 17.6 and 23.7 ms (36 fps is 27.8 ms) |
| How It Works, no card live (reference) | | 39.8 / 27.5 / 23.1; 40.7 / 35.8 / 22.6 | |
| Profile, live hero | 40 | 90.1 / 80.3 / 4.2; 81.3 / 81.2 / 4.5 | met |
| Creator, live preview | 36 | pending Task 19 (no live preview on the route yet) | not measurable |

With and without the live card: the preview's cost is NOT measured. `scripts/perf.mjs`'s GPU timer times only the first WebGL 2 context whose canvas is on the page (the host), never the preview's canvas, and GPU time cannot see main-thread cost (shader compiles, a second render loop, React work). The host's own GPU ms (17.6 and 23.7 with the card, 23.1 and 22.6 without) swings by 6 ms between runs under load, and the fps gap (34.5 against 40.2) is inside the same noise, so the card's share is undecided. Task 13's 32.6 median agrees with run 1. A measure of the preview needs a timer on its own context and a main-thread trace on a quiet machine.

Each world through the platform against the same world at `?world=<id>` (SEEN=all, the intro; platform then review, alternating). Median fps per run, platform / review:

| World | Platform | `?world=` | Ratio (median of runs) | GPU ms median, platform / review |
|---|---|---|---|---|
| Nox (`/@nox/security-lab`) | 40.8, 37.7 | 38.6, 45.7 | 0.93 | 19.9, 25.9 / 20.7, 19.5 |
| Veyra (`/@veyra/vault-os`) | 43.3, 39.7 | 42.9, 40.0 | 1.00 | 30.3, 24.2 / 29.7, 24.2 |
| Flux (`/@flux/github-pipeline-engine`) | 35.0, 38.3, and 35.0, 44.2, 35.6 in the re-check | 47.8, 49.8, and 35.6, 41.0, 39.5 | 0.88 over five pairs (0.75 platform first; 0.98, 1.08, 0.90 review first) | 30.3, 26.0, 29.8, 22.1, 30.4 / 21.4, 19.1, 42.1, 22.6, 36.6 |
| Aether (`/@aether/ai-playground`) | 46.3, 51.5 | 41.8, 36.8 | 1.24 | 25.8, 20.0 / 23.8, 28.8 |

The 3% rule cannot be settled on this machine: one page's run-to-run spread is 20 to 30%, far above the limit, and the ratios fall on both sides of 1.0 (0.75 to 1.24) with no world consistently behind. Pooled over all 11 pairs (8 in the table, 3 more Flux): platform mean 40.7 fps, median 39.7; `?world=` mean 41.8, median 41.0; ratio 0.97 on both (2.6% and 3.2% lower): on the edge of the 3% rule, inside the noise, so neither a pass nor a miss. GPU time per frame is not a usable second opinion here: it is the host's context only and under load it swings too, and for Flux the medians of the five pairs are platform 29.8 ms against review 22.6 ms (+32%, with means skewed by outliers such as 42.1 ms); whether the platform path costs Flux GPU time is undecided. A verdict at 3% needs a quiet GPU. Against the intro floor of 40 fps (the worlds' own specs; Aether's is read, the others assumed equal), 5 of 11 platform runs and 7 of 11 `?world=` runs reached it (platform medians of two runs: Nox 39.3, Veyra 41.5, Flux 36.7, Aether 48.9): the floor is not reliably met under load by either path.

## Task 19a: the creator's editor (2026-11-05)

**Provisional, pending owner.** The editor half of Task 19 (the live preview and the reactions are 19b). Pure helpers in `draftEdits.ts` (add, update, reorder, delete with the removed project and index for undo, undoDelete, technologies from the catalog only, usage notes, links as typed with `linkIssues` and `safeHref`, the overview section, media metadata, `mediaErrorMessage`), `techSearch.ts` for the picker, `ProjectsPanel`, `TechnologyPicker`, `LinkField`, `ProjectImages`, `mediaUrls.ts` (object urls made once, revoked when an image leaves the list and on unmount), `DraftBar` (visible status and Discard draft). The route keeps the one polite live region; the visible status line is aria-hidden so nothing is read twice. The inert part is now the editing grid only; the bar sits outside it so a discard stays visible and retryable.

R23 as built: Discard asks first; a clear that fails leaves the draft on screen, shows the controller's `discardError`, offers Retry (no second question), and any later edit clears the message. `draftController.discard()` returns `{ cleared: false }` at once if one is already under way (a refused call never ends the first one's discarding state), with a test. The controller also exposes `putMedia` and `getMedia` for the editor.

Review Focus 3 (IndexedDB blocked): e2e blocks `IDBFactory.open` and checks "Can't save in this browser", that edits, images and Discard still work in memory. Review Focus 5 (zero projects): deleting every project leaves a calm empty state with the Add button focused.

### Gaps

1. The blob of a removed image stays in the media store until Discard (no single-image delete in `storage.ts`). Orphans are bounded by 4 per project and 2 MB each but do exist.
2. An upload that finishes after its project was deleted leaves an orphan blob too.
3. Only one free-text section ("Description", section id `overview`); no section titles.
4. The technology picker shows 8 matches at a time (keyboard trip length); the full catalog is reachable only by typing.
5. The status line is the 800 ms autosave state; it is not a promise about other tabs (two tabs editing one draft overwrite each other, as in Task 18).
