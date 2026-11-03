# Veyra World (F01 + F02) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Veyra, the Keeper of Files, as the second OctoVerse world on the extracted engine: her own character, vault world, pendants, vault dial and calm motion, with Nox unchanged.

**Architecture:** Veyra is a `WorldBundle` under `src/worlds/veyra/` plus her assets under `public/veyra/` and `blender/vault/`. Where she needs something the engine lacks, she adds one closed variant to an engine table (`skin.mode: 'jelly'`, `HEAD_EFFECTS.vaultDial`, `PLACEMENTS.pendant`, `APPEARS.bloom`, `SELECTS.armLift`, a floor material, live elements, kit props), in the same change, with a test. Engine edits go through the engine owner (master plan section 2). Veyra never forks shared code.

**Tech Stack:** React 19, TypeScript, three 0.186.1, R3F 9, drei 10, postprocessing 3, Theatre.js 0.7.2, Vite 8, Vitest, Playwright (Edge), Python (Pillow, numpy) check tools, Blender 5.2 headless.

**Spec:** `docs/superpowers/specs/2026-11-03-veyra-3d-design.md` (cited as "spec 7.5" and so on). Also read the engine contract `docs/superpowers/specs/2026-11-03-octoverse-engine-design.md` ("contract 9.2") and the E02 plan `docs/superpowers/plans/2026-11-03-engine-extraction.md`; this plan uses the names E02 produces.

## Start condition

**Do not start until E02 has landed and the owner has approved it.** Cut the branch from the tip that holds E02: `git switch -c claude/veyra-world-<suffix> <E02 tip>`. Task 1 re-reads the engine as it landed and records any name that differs from this plan.

## Global Constraints

- Exactly eight arms, T1 to T8. Technology count never sets anatomy; extra technologies go to the tray.
- Physics is cancelled. No node chains, springs-as-physics or drag. Pendant swing is a driven procedural motion (contract 9.2).
- No videos. Evidence is stills, numbers and tests; the owner checks motion live at a local URL.
- No tone mapping, `flat` canvas. Colours are sRGB hex in config.
- `src/engine/**` imports nothing from `src/worlds/**` (`boundary.test.ts`); no hex literals in engine shader or material sources.
- Nox output is frozen: after every engine change, the E02 baseline stills compare clean (`python scripts/still_compare.py <baseline> <current> --floor <floor.json>` exits 0) and the six Nox e2e specs pass unmodified.
- Frame rate is measured only with the browser pane closed, back to back, 1536 x 1024, pixel ratio 1. Veyra budgets (spec 2.4): intro tier low at least 40 fps median; overview with 12 pendants at least 36; entrance at least 32. Nox may not drop more than 3%.
- Colour targets: spec 2.1 table, CIE76 delta E 10 per sample; the face-glow red is at least 60 above the head-middle red.
- Never edit, reset or restore the main checkout. No bare `git stash`. No push.
- The owner approves each milestone live before the next starts. Commit per approved milestone. Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Model tiering: Opus for the jelly material, face, cups, world light and look tuning (Tasks 3, 4, 6, 7, 10, 11, 12); cheaper models for wiring, data and tests.

## Review Focus

1. **Fewer technologies than slots, and more than 16.** With 3 technologies, only 3 pendants show, on the top arms; with 20, 16 hang and 4 go to the tray. No arm ever carries a third (Task 13, `assignPendants` tests).
2. **Pointer over a pendant while its arm is mid-swing or mid-lift.** The HTML button must follow the orb and the hover must not flicker between two pendants (Task 20, hover-intent test with a moving anchor).
3. **Reduced motion.** No swing, no float, no bloom wobble, no dial spin; pendants are simply present, and the dial becomes a crossfade (Tasks 13, 19 and 21 tests with `reducedMotion: true`).
4. **A world switch mid-sequence** (entrance, bloom or swell running) from Veyra to Nox and back resets everything, and Nox's entrance flag is untouched (Task 22, extends `worldSwitch.spec.ts`).
5. **Phone portrait.** Pendants go to the tray, and choosing from the tray plays the same arm lift; no pendant or thread overlaps the face at 390 x 844 (Task 14 `threadClearance` at the phone frame; Task 20 tray e2e).

## File structure (end state)

- `src/worlds/veyra/bundle.ts`: `VEYRA_BUNDLE: WorldBundle`.
- `src/worlds/veyra/character.ts`: `VEYRA: CharacterConfig` (geometry, palette, face, suckers, skin, personality, lighting).
- `src/worlds/veyra/poses.ts`: `VEYRA_POSES: Record<StageId, StagePose>`, traced from P1 to P5.
- `src/worlds/veyra/swim.ts`: `VEYRA_SWIM: SwimPoseSet`.
- `src/worlds/veyra/artifacts.ts`: `VEYRA_ARTIFACTS: ArtifactConfig` (pendant slots per stage, tether style).
- `src/worlds/veyra/sequences/defaults.ts`, `sequences/state.theatre.json`: entrance, bloom, swell, arrival.
- `src/worlds/veyra/place/config.ts`, `place/layout.json`, `place/far.json`: `VAULT_WORLD: WorldConfig`.
- `src/worlds/veyra/content/`: `veyraProject.ts`, `veyraTechnologies.ts`, `placeholders.ts`.
- `src/worlds/veyra/theme.ts`, `src/worlds/veyra/review/{stage,world}_samples.json`, `review/targets.json`.
- `src/engine/character/skinMaterial.ts`: gains the `'jelly'` branch and the sparkle term.
- `src/engine/character/headEffects/vaultDial.ts`: `HEAD_EFFECTS.vaultDial`.
- `src/engine/artifacts/pendant.ts`, `bloom.ts`, `armLift.ts`, `tether.ts`: Veyra's three strategy modules and the thread mesh.
- `src/engine/world/`: the moss floor variant, `Kelp.tsx` live element, kit props.
- `blender/vault/build_kit.py`, `bake_world.py`, `render_far.py`; `public/veyra/world/*`.
- `docs/superpowers/reviews/veyra.md`: the owner's review log.
- `docs/superpowers/evidence/veyra/`: still sets and the regression report.

---

## Milestone 1: Veyra on the P2 stage (the gate, F01)

### Task 1: Re-read the engine and set up Veyra's reference checks

**Files:**
- Create: `src/worlds/veyra/review/stage_samples.json`, `review/world_samples.json`, `review/targets.json`, `public/veyra/ref/p2.png`, `public/veyra/ref/p2-mask.png`
- Create: `docs/superpowers/reviews/veyra.md`
- Test: `src/worlds/veyra/review/targets.test.ts`

**Interfaces:**
- Consumes: E02's `check_stage.py --world-id <id>` (reads `src/worlds/<id>/review/{stage,world}_samples.json`), `silhouette.py`.
- Produces: `targets.json` = `{ samples: { name, x, y, size, rgb }[], deltaE: 10, warmContrast: 60, head: { halfWidth: [0.88, 0.96], top: [0.44, 0.52] }, armSpan: [3.75, 4.05], iou: 0.85, meanInside: { rgb, tolerance: 12, satTolerance: 0.04 } }`. Sample coordinates are in P2-crop pixels (crop origin x 512, y 0 of `Veyra.jpeg`).

- [ ] **Step 1: Engine drift check.** Run `rg "export (const|type|interface|function) (WorldBundle|validateBundle|faceAnchor|HEAD_EFFECTS|PLACEMENTS|APPEARS|SELECTS|WORLDS|resolveWorld|themeVars|clampCharacterConfig)" src/engine src/worlds`. Write each name and its file at the top of `docs/superpowers/reviews/veyra.md` under "Engine as landed". If any differs from this plan, use the landed name throughout and note it there.
- [ ] **Step 2: Crop P2.** `ffmpeg -i <main checkout>/docs/design/references/Veyra.jpeg -vf "crop=488:494:512:0" public/veyra/ref/p2.png` (copy only; never write to the main checkout). Make the mask with `python scripts/silhouette.py` as for Nox's panel 2, then check it by eye beside the crop; the mask excludes the title, nameplate and bubbles.
- [ ] **Step 3: Write the samples and targets** from spec 2.1 and 2.2, converted to crop pixels (subtract 512 from x). Measure the mean colour inside the mask and write it to `meanInside.rgb`.
- [ ] **Step 4: Write `targets.test.ts`:** `targets.json` has 13 samples; every sample's `rgb` equals the area mean of `p2.png` at its point within 1 per channel (decode the PNG with the same helper the Nox review tests use); the face-glow red minus the head-middle red is at least 60.
- [ ] **Step 5: Run** `npx vitest run src/worlds/veyra/review`; expected PASS. Run `python scripts/check_stage.py public/veyra/ref/p2.png --stage intro --world-id veyra`; expected every sample delta E 0.0 and exit 0. This is the self-check.
- [ ] **Step 6: Commit** `chore(veyra): P2 reference crop, mask, samples and targets`.

### Task 2: Veyra's bundle on a stage backdrop

**Files:**
- Create: `src/worlds/veyra/bundle.ts`, `character.ts`, `poses.ts` (intro only; the other stages reuse intro until Milestone 3), `swim.ts` (copies of the intro arms as placeholders), `artifacts.ts` (orbit placement with zero shells until Task 14), `sequences/defaults.ts`, `sequences/state.theatre.json` (empty Theatre state), `place/config.ts` (`VAULT_STAGE`), `theme.ts`, `content/*`
- Create: `public/veyra/world/stage.glb` (a glTF with one empty scene, made by `blender/vault/empty_kit.py`)
- Modify: `src/worlds/index.ts` (register `veyra`)
- Test: `src/worlds/veyra/bundle.test.ts`

**Interfaces:**
- Consumes: `WorldBundle`, `validateBundle`, `faceAnchor`, `WORLDS`, `resolveWorld`, `clampCharacterConfig`.
- Produces: `VEYRA_BUNDLE` with `id: 'veyra'`; `VEYRA: CharacterConfig`; `VEYRA_POSES.intro`; `VAULT_STAGE: WorldConfig` (kit `stage.glb`, empty layout, water and fog colours fitted to P2's mid and upper water samples, `camera.tilt` 0.04, `camera.hover: { amount: 0.8 x Nox's, pace: 0.75 x Nox's }`); `VEYRA_THEME: UiTheme` (accent `#3fe0c5`, a mint-to-cyan Live Demo gradient, dark teal surfaces, a cyan focus ring, `titleIcon: 'padlock'`); content per spec 7.10 with every storyboard string wrapped in the placeholder marker Nox uses.

- [ ] **Step 1: Write failing tests in `bundle.test.ts`:**
  - `validateBundle(VEYRA_BUNDLE)` does not throw.
  - `Object.keys(VEYRA_POSES.intro.arms)` equals `ARM_IDS`.
  - `VEYRA.head.cheeks === null`.
  - `VEYRA.head.halfWidth` is within `[0.88, 0.96]` and `VEYRA.head.top` within `[0.44, 0.52]`.
  - `faceAnchor(VEYRA_BUNDLE, 'intro').y` is within 0.05 of -0.50.
  - `resolveWorld('?world=veyra').bundle.id === 'veyra'` with no warning.
  - `clampCharacterConfig(VEYRA)` deep-equals `VEYRA`: every authored value is already in range.
  - `VEYRA_BUNDLE.content.technologies.length === 12`.
- [ ] **Step 2: Run** `npx vitest run src/worlds/veyra`; expected FAIL (module missing).
- [ ] **Step 3: Author `character.ts`** from spec 7.1 to 7.3 and 7.8:
  - **Head:** no cheeks; `halfWidth` 0.92; `top` 0.48; `faceOrigin` so the eyes land at y -0.50.
  - **Personality:** the spec 7.8 table: blink `[3.5, 8.5]`, double blink 0.12, `gazeOmega` 10, `headOmega` 2.4, sway 0.4, curl 1.4, float 0.06 / 7.5 s, breath 5.4 s, swim 0.65 / 0.26 / 1.0 with fill 0.04 and squeeze 0.06.
  - **Palette and face palette:** start values from the spec 2.1 samples; Task 7 tunes them.
  - **Skin:** `mode: 'skin'` until Task 4.

  Author `poses.ts` intro by tracing P2's eight arms (spec 7.4) as `Point2` polylines in the traced plane, root first, with tip spirals as authored points (contract 14.1: no `armCurl` field).
- [ ] **Step 4: Register** `veyra` in `WORLDS`. Run the tests; expected PASS. Run `npm run typecheck` and the boundary test; expected clean.
- [ ] **Step 5: Look.** Start `npx vite --port 5191 --strictPort`. Capture `WORLD=veyra node scripts/stage-capture.mjs intro .tmp/veyra-intro.png freeze`. Open it beside `public/veyra/ref/p2.png`. Expected: an eight-armed teal octopus in roughly the P2 pose on dark water. Record the still path in the review log. Stop vite.
- [ ] **Step 6: Nox regression.** Recapture the E02 baseline set into `current/`; `still_compare.py` exits 0; the six Nox e2e specs pass.
- [ ] **Step 7: Commit** `feat(veyra): bundle, character, intro pose and stage backdrop`.

### Task 3: Engine variant: jelly skin mode and sparkles

**Files:**
- Modify: `src/engine/types/` (`SkinDetail.mode: 'skin' | 'jelly'`, `SkinDetail.sparkle: number`, `SkinDetail.jelly?: JellySettings`), `src/engine/character/skinMaterial.ts`, `src/engine/config/validate.ts`
- Modify: `src/worlds/veyra/character.ts` (`skin.mode: 'jelly'`)
- Test: `src/engine/character/skinMaterial.test.ts`, `src/engine/config/validate.test.ts`

**Interfaces:**
- Produces: `JellySettings = { rim: string; rimPower: number; crown: string; crownHeight: number; depth: string; depthStrength: number; coreWarmth: number }`; `skin.sparkle` is specks per square world unit (0 = off; Nox 0); a `uSparkleWave` uniform (0 to 1, the crown-to-face shimmer used in Task 18). Every colour (rim, crown, depth, core) is config read into uniforms, never a shader constant: Flux reuses this mode (amendment A1).

- [ ] **Step 1: Failing tests.**
  - `createSkinMaterial` with `mode: 'jelly'` compiles: run the material through `renderer.compile` in the existing headless GL test harness, or assert the generated fragment source contains the `JELLY` define.
  - It allocates no render target.
  - `mode: 'skin'` produces a fragment source identical to the pre-change string (snapshot taken before the edit).
  - `clampCharacterConfig` keeps `sparkle` in `[0, 400]` and defaults `mode` to `'skin'`.
- [ ] **Step 2: Run** `npx vitest run src/engine/character/skinMaterial.test.ts src/engine/config`; expected FAIL.
- [ ] **Step 3: Implement the jelly branch** as a `#define`, one pass:
  - **Fresnel rim:** `pow(1 - n·v, rimPower)` toward `rim`.
  - **Crown:** a cap above `crownHeight` mixed toward `crown`.
  - **Depth term:** `n·v` toward `depth` by `depthStrength`, so the centre reads darker and thicker.
  - **Core:** the existing glow ramp, scaled by `coreWarmth`.
  - **Sparkles:** a hashed cell noise at `sparkle` density, each speck's brightness on its own 2 to 6 s sine phase.
- [ ] **Step 4: Run** the tests, the boundary test (no hex literals: colours come from uniforms), typecheck; expected PASS.
- [ ] **Step 5: Nox regression** as Task 2 Step 6.
- [ ] **Step 6: Commit** `feat(engine): jelly skin mode and sparkle term (for Veyra)`.

### Task 4: Engine variant: cup frill style

**Files:**
- Modify: `src/engine/types/` (`SuckerSettings.style?: SuckerStyle`), `src/engine/character/suckerRow.ts`, `suckerMaterial.ts`, `src/engine/config/validate.ts`, `src/worlds/veyra/character.ts`
- Test: `suckerRow.test.ts`, `suckerMaterial.test.ts`

**Interfaces:**
- Produces: `SuckerStyle = { rimWidth: number; scallop: number; edge: string; rim: string; hollow: string; glow: number }`. Here `scallop` (0 to 1) is how far each cup's outer edge stands proud of the arm silhouette. Absent `style` reproduces Nox exactly.

- [ ] **Step 1: Failing tests.** In `suckerRow.test.ts`, with `scallop: 0.6` on a straight test arm, every cup's outermost point lies outside the arm radius by at least 0.3 x cup radius, and cup radii fall monotonically toward the tip. With `style` absent, the output equals the current fixture.
- [ ] **Step 2: Run** them; expected FAIL.
- [ ] **Step 3: Implement**, then set Veyra's style: `edge`, `rim` and `hollow` from the sucker sample (224, 220, 156) and a darker teal-cream hollow; `scallop` 0.6; `rimWidth` 0.22; `glow` 1.3.
- [ ] **Step 4: Run** the tests, boundary and typecheck; Nox regression; expected PASS.
- [ ] **Step 5: Commit** `feat(engine): sucker frill style (for Veyra)`.

### Task 5: Engine gap: per-character expression presets

Raise this with the engine owner before starting (gap G1 in the report). `EXPRESSIONS` is an engine constant today, and Veyra's tech-focus face differs from Nox's (spec 7.3).

**Files:**
- Modify: `src/engine/behavior/expressions.ts`, `src/engine/types/` (`CharacterConfig.expressions?: Partial<Record<ExpressionId, Partial<ExpressionParams>>>`), the face consumers that read `EXPRESSIONS`, `src/worlds/veyra/character.ts`
- Test: `expressions.test.ts`

**Interfaces:**
- Produces: `resolveExpressions(config: CharacterConfig): Record<ExpressionId, ExpressionParams>`: the engine presets with the character's overrides merged in. Nox has no overrides.

- [ ] **Step 1: Failing tests.**
  - `resolveExpressions(NOX)` deep-equals `EXPRESSIONS`.
  - `resolveExpressions(VEYRA).focused` has brows higher and lids wider than `EXPRESSIONS.focused` (Veyra's "interested" look); other ids are unchanged.
- [ ] **Step 2: Run**; expected FAIL. **Step 3: Implement**, and route every `EXPRESSIONS[...]` read through `resolveExpressions`. **Step 4: Run** the tests; Nox regression (expression stills for all seven ids unchanged). **Step 5: Commit** `feat(engine): per-character expression overrides (for Veyra)`.

### Task 6: Veyra's face

**Files:**
- Modify: `src/worlds/veyra/character.ts` (`face`, `facePalette`, `expressions`)
- Test: `src/worlds/veyra/bundle.test.ts` (face cases)

- [ ] **Step 1: Failing tests.** `VEYRA.face.eye.lashes.length === 1` per eye (one outer flick); `VEYRA.facePalette.iris` is green (each stop's green above red and blue); the brow thickness is below Nox's; `blush` is peach-pink (red at least 230).
- [ ] **Step 2: Author** the layout and palette from spec 7.3, traced at 3x zoom from `p2.png`:
  - **Eyes:** large round, green iris top to bottom, black pupil, two catchlights, warm white sclera.
  - **Lash:** one outer lash.
  - **Brows:** thin, high, raised.
  - **Mouth:** a small closed smile in dark teal-brown with dimples; the open-smile inside is warm pink.
  - **Blush:** peach ovals.
- [ ] **Step 3: Run** the tests; capture the intro face at 3x; open it beside the P2 face crop. **Step 4: Commit** `feat(veyra): face`.

### Task 7: Look tuning to the P2 targets and the gate review

**Files:**
- Modify: `src/worlds/veyra/character.ts` (palette, glow, halo, aura, grade, jelly and sparkle values, lighting), `poses.ts` (intro), `place/config.ts` (water)
- Modify: `docs/superpowers/reviews/veyra.md`

- [ ] **Step 1: Measure.** Run `WORLD=veyra node scripts/world-capture.mjs` at P2's camera, frozen. Then run `python scripts/check_stage.py <capture> --world --stage intro --world-id veyra`. Record every sample's delta E, the warm-contrast value, the mean inside the mask, the IoU and the head and span numbers.
- [ ] **Step 2: Tune** values in the bundle only, one group at a time, re-measuring after each, until `check_stage.py` exits 0 and the IoU is at least 0.85. Tune in this order:
  1. head shape;
  2. arm traces;
  3. jelly rim, crown and depth;
  4. core glow (face warmth);
  5. arms;
  6. cups;
  7. aura and grade;
  8. water.

  Never tune by adding world light to her (spec 7.2).
- [ ] **Step 3: Close-up check** (spec 2.3) at 3x zoom: eyes, lashes, brows, mouth, blush, jelly rim, crown and centre, sparkle count (at least 40 on the head front, counted on the render), cup frill, and spirals (at least five arms with a full turn). Write each item's result in the review log.
- [ ] **Step 4: Perf.** Close the browser pane. Run `WORLD=veyra node scripts/perf.mjs "stage=intro&tier=low"` twice back to back. Expected median at least 40 fps; record both numbers. If it is missed, apply the spec 10.1 order (on the stage backdrop only sparkle count applies, and never below the close-up need) and report.
- [ ] **Step 5: Owner gate.** Give the owner the local URL `/?world=veyra&stage=intro` and `&freeze`, the P2 crop side by side, the numbers, and five things to look at:
  1. the face reads warm;
  2. the head reads as glassy jelly, not plastic;
  3. the cups read as a frill;
  4. the spirals are tidy;
  5. she is not a recoloured Nox.

  Name the remaining weaknesses yourself. Repeat Steps 2 to 5 until the owner approves. Record the owner's words in the review log.
- [ ] **Step 6: Commit** `feat(veyra): P2 look approved` (owner approval in the message).

---

## Milestone 2: The vault world (F01)

### Task 8: Engine variants: world vocabulary for the vault

Raise this with the engine owner before starting. These are contract 14.1 deferred items, shaped by Veyra's kit.

**Files:**
- Modify: `src/engine/world/types.ts`, `validateWorld.ts`, `WorldScene.tsx`, `Floor.tsx`, `src/engine/world/live/` (table), `src/worlds/nox/place/config.ts` (renamed keys only)
- Create: `src/engine/world/Kelp.tsx`, `src/engine/world/floors/moss.ts`
- Test: `validateWorld.test.ts`, `kelp.test.ts`, `floor.test.ts`

**Interfaces:**
- Produces:
  - `WorldLayout.groups: Record<string, Placement[]>`. Nox's `pillars / rocks / corals` move to groups of the same names; the loader reads groups generically.
  - `palette` and `relics` are string-keyed records validated against the keys `lights` and `relics` declare.
  - `floor.material: 'lava-cracks' | 'moss'`.
  - `LIVE_ELEMENTS` table gains `kelp` (instanced strands, vertex-shader sway, `{ count, height, sway, color }`) and `seagrass` (same module, short).
  - `props: { id: string; node: string; drive: 'rotateZ' | 'emissive' }[]`.
- [ ] **Step 1: Failing tests.**
  - The Nox security config migrated to groups validates.
  - Its loader output (piece list with transforms) deep-equals the pre-change output.
  - A config with `floor.material: 'moss'` and a `kelp` live element validates.
  - `kelpSway(t, phase)` is bounded by `sway` and periodic.
  - A prop naming a missing kit node fails validation with the node name in the message.
- [ ] **Step 2: Run**; expected FAIL. **Step 3: Implement.** **Step 4: Run**; Nox regression (stills, e2e `world`, `worldMotion`, `worldTiers`). **Step 5: Commit** `feat(engine): world groups, moss floor, kelp, kit props (for Veyra)`.

### Task 9: The vault kit (Blender, headless)

**Files:**
- Create: `blender/vault/build_kit.py`, `src/worlds/veyra/place/layout.json`, `public/veyra/world/kit.glb`
- Test: `src/worlds/veyra/place/layout.test.ts`

**Interfaces:**
- Produces kit pieces:
  - `arch` (stone arch with a recessed doorway);
  - `membrane` (a doorway plane with a second UV for the flow shader);
  - `padlock_body`, `padlock_ring` (separate nodes, named for `props`);
  - `block_a` to `block_d` (large mossy blocks);
  - `wall_broken`, `steps`;
  - `rock_a` to `rock_c`;
  - `coral_orange`;
  - `glowplant_a`, `glowplant_b`.

  Kelp and seagrass are live elements, not kit pieces.

- [ ] **Step 1: Failing test.** `layout.json` names only pieces in the kit's piece list; the portal stands right of the stage and behind it (x > 1.2, z < -2); a clear corridor 2.4 units wide runs from the far left to the stage spot. The test samples the path polyline against each placement's bounding radius.
- [ ] **Step 2: Write `build_kit.py`** in the style of `blender/security/build_kit.py`. Run `blender -b -P blender/vault/build_kit.py -- public/veyra/world/kit.glb` (Draco geometry, as Nox's). Expected: the file is written and the script prints the piece list.
- [ ] **Step 3: Write `layout.json`** per spec 7.7: portal right and back; walls and kelp framing both sides; the worn path from the left distance toward the portal; dark foreground rocks; two orange corals low right.
- [ ] **Step 4: Run** the layout test; expected PASS. **Step 5: Commit** `feat(veyra): vault kit and layout`.

### Task 10: Bake, far plate, membrane and world light

**Files:**
- Create: `blender/vault/bake_world.py`, `blender/vault/render_far.py`, `public/veyra/world/near.glb`, `public/veyra/world/far/*.webp`, `src/worlds/veyra/place/far.json`
- Create: `src/engine/world/membraneMaterial.ts` (registered as a kit material variant for nodes named `membrane*`)
- Modify: `src/worlds/veyra/place/config.ts` (`VAULT_WORLD` replaces `VAULT_STAGE` in the bundle)
- Test: `membraneMaterial.test.ts`, `src/worlds/veyra/place/config.test.ts`

- [ ] **Step 1: Failing tests.**
  - `validateWorld(VAULT_WORLD)` passes.
  - Its lights contain no red: every light colour's red is below its green and below its blue, except `coral_orange` accents, which are capped at intensity 0.4.
  - `membraneFlow(t)` stays in `[0, 1]`.
  - The portal's brightest emissive value is below the face core's brightness (`VEYRA.glow`), the spec 7.7 relic rule.
- [ ] **Step 2: Bake** (cyan portal spill, green plant light, cool surface fill, ambient occlusion) and **render the far plate** in two or three depth layers, as `blender/security/` does. Run both headless.
- [ ] **Step 3: Configure `VAULT_WORLD`:**
  - the surface spot with caustics;
  - deep blue-teal fog;
  - live elements: kelp, seagrass, cyan bubbles, green motes, blue-violet fish (off at tier low), rays;
  - `floor.material: 'moss'`;
  - `skinAccent` cool;
  - `post` bloom tuned so cyan does not clip to white.
- [ ] **Step 4: Run** the tests; expected PASS. **Step 5: Commit** `feat(veyra): baked vault, far plate and membrane`.

### Task 11: World look, Veyra's colour in the world, budget, and review

- [ ] **Step 1: Re-run the Task 7 Step 1 check in the world.** Expected exit 0. If Veyra's samples moved, fix the world (grade, accents, fog), never her emitters.
- [ ] **Step 2: Side by side** with the P1 and P2 crops: portal, plants, rays, colour of the water, no red anywhere.
- [ ] **Step 3: Perf.** Close the pane. Run `WORLD=veyra node scripts/perf.mjs "stage=intro&tier=low" "stage=intro&tier=high"` twice. Expected: tier low at least 40. If it is missed, cut in the spec 10.1 order and re-measure; if still missed, stop and report the numbers.
- [ ] **Step 4: Owner review** live with five things to look at:
  1. it feels underwater;
  2. the portal is the focal relic but quieter than her face;
  3. teal is not grey;
  4. no fantasy clutter;
  5. the camera hover is calm.

  Record the result in the log.
- [ ] **Step 5: Commit** `feat(veyra): vault world approved`.

---

## Milestone 3: Static P3, P4 and P5 (F01)

### Task 12: Overview pose and dome

- **Files:** `src/worlds/veyra/poses.ts` (overview, traced from P3), `character.ts` (`dome`, `palette.dome*`), `src/worlds/veyra/review/` (P3 crop and composition samples).
- **Tests** (`bundle.test.ts`):
  - The overview arms are eight.
  - The dome rectangle projected at the overview frame contains the HTML panel box with 0.04 margin.
  - The face anchor sits at the dome bottom (y within 0.1 of `dome.center.y - dome.halfHeight`).
- **Check:** a frozen still `?world=veyra&stage=overview&freeze` beside P3; composition (place, size, pose) by eye. Commit `feat(veyra): overview pose and dome`.

### Task 13: Engine variant: pendant placement and tether

**Files:**
- Create: `src/engine/artifacts/pendant.ts`, `tether.ts`; add `pendant` to `PLACEMENTS` and the `PlacementConfig` union
- Modify: `src/worlds/veyra/artifacts.ts`
- Test: `pendant.test.ts`, `tether.test.ts`

**Interfaces:**
- Produces:
  - `assignPendants(techCount: number, slots: readonly PendantSlot[]): { placed: { techIndex: number; slot: PendantSlot }[]; tray: number[] }`: placed by `order`, at most 2 per arm, the rest to the tray.
  - `pendantSwing(attachVelocity: Vec3, t: number, state: SwingState, reducedMotion: boolean): { angle: number; state: SwingState }`: a driven sine on the attach point's horizontal velocity with an exponential decay envelope (contract 9.2; no physics). `|angle| <= 25°`, and the swing settles to idle within 1.2 s after the arm stops.
  - `TetherStyle = { length: number; color: string; width: number; sag: number; cap: string }`.
  - `threadClearance(pose, slots, faceRect): number`: the minimum distance from any thread or orb to another arm or the face.
- [ ] **Step 1: Failing tests.**
  - `assignPendants(3, slots)` places 3 on the slots with `order` 0 to 2.
  - `assignPendants(20, slots16)` places 16 and trays 4.
  - No arm has more than 2 in any result.
  - `pendantSwing` stays within 25 degrees for a velocity step of 3 units/s, and is within 1 degree of idle sway 1.2 s after the velocity returns to 0.
  - With `reducedMotion` the angle is 0.
  - `threadClearance(VEYRA_POSES.intro, VEYRA_ARTIFACTS.placement.slots.intro, face)` and the same for overview are both above 0.05.
- [ ] **Step 2: Run**; expected FAIL. **Step 3: Implement.** Threads are one instanced thin tube batch for all pendants. Orbs reuse the shared orb glass material and logo cache. Pendant positions are written to the instance's `bubbleLive`, so the buttons, tooltip and tray work unchanged. **Step 4: Run**; Nox regression. **Step 5: Commit** `feat(engine): pendant placement and tethers (for Veyra)`.

### Task 14: Veyra's slots, tech-focus and detail statics, responsive

- **Files:** `src/worlds/veyra/artifacts.ts` (16 slots per intro and overview, traced from P3's 12 plus 4 in the same rhythm, top arms first), `poses.ts` (`techFocus` = overview with the chosen arm raised, `detail` traced from P5), `character.ts` frames, `src/worlds/veyra/review/` crops of P4 and P5.
- **Tests:** slot count 16, at most 2 per arm, `threadClearance` above 0.05 at desktop and at the 390 x 844 frame, and the detail pose keeps the face anchor on screen at the detail frame.
- **Check:** frozen stills of overview with 12 pendants, techFocus (`tech=react`), detail, and the phone viewport, beside P3 to P5. Perf: overview at tier low at least 36 fps. Owner review of P3, P4 and P5 statics; log; commit `feat(veyra): P3 to P5 statics approved`.

## Milestone 4: Back view (F01)

### Task 15: Orbit review

- **Check:** `?world=veyra&stage=intro&freeze&yaw=0|45|90|180`. The back is round and glassy; the rim, sparkles and crown continue round it; the cups read from behind. Fix in `character.ts` or the jelly settings only.
- **Owner review**, log, commit `feat(veyra): back view approved`.

---

## Milestone 5: Motion personality and the entrance (F02)

### Task 16: Engine variants: personality settle, glide bias, flourish

Raise this with the engine owner before starting (contract 14.1 deferred; gap G4 for the flourish layer).

**Files:**
- Modify: `src/engine/types/` (`Personality.settle`, `glideBias`, `flourishRate`), `src/engine/behavior/ambient.ts`, `src/engine/motion/stroke.ts`, the arrival sequence reader
- Create: `src/engine/behavior/flourish.ts`
- Test: `ambient.test.ts`, `stroke.test.ts`, `flourish.test.ts`

**Interfaces:**
- Produces:
  - `settle` (0 to 1, a scale on the approved overshoot; Nox 1);
  - `glideBias` (scale on glide length; Nox 1);
  - `flourishRate` (flourishes per minute; Nox 0);
  - `flourishCurve(t: number, start: number): number`: 0 to 1 to 0 over 3 s. It unrolls one arm's tip curl toward straight by at most 40% and rolls it back.
- [ ] **Step 1: Failing tests.**
  - With Nox's values, ambient and stroke outputs equal the pre-change fixtures.
  - With `flourishRate: 4`, over 60 s of simulated time between 2 and 6 flourishes start, never two at once, never on an arm holding a pendant lift.
  - `settle: 0.6` gives 60% of the overshoot peak.
- [ ] **Step 2 to 5:** run (FAIL), implement, run and Nox regression, commit `feat(engine): settle, glide bias and flourish (for Veyra)`. Then set Veyra's values (`settle` 0.6, `glideBias` 1.6, `flourishRate` 4, at the low end of one every 12 to 20 s) and commit `feat(veyra): motion personality`.

### Task 17: Engine gap: entrance turn amount

Raise this with the engine owner before starting (gap G2). Today the entrance spin is a fixed full turn on a golden spiral.

- **Files:** `src/engine/sequences/entrance.ts`, `SequenceSet` types, `src/worlds/nox/sequences/defaults.ts` (Nox: `turn: 2π`, unchanged).
- **Interface:** `EntranceShape = { turn: number /* radians */; spiral: boolean }` in the bundle's sequence data.
- **Tests:** Nox's entrance outputs at `t` = 0, 2, 4, 5, 5.5 and 6.5 equal the fixtures. With `turn: 200°` and `spiral: false`, yaw at the end is 0 and the yaw path is monotonic. The clearance test runs against the bundle's own layout.
- **Commit:** `feat(engine): entrance turn and spiral as data`.

### Task 18: Veyra's entrance with the padlock click

**Files:**
- Create: `src/worlds/veyra/sequences/state.theatre.json` (entrance, arrival), `src/worlds/veyra/swim.ts` (open and trail traced from P1)
- Modify: `src/worlds/veyra/sequences/defaults.ts`, `place/config.ts` (`props: [{ id: 'lockRing', node: 'padlock_ring', drive: 'rotateZ' }, { id: 'membraneFlash', node: 'membrane', drive: 'emissive' }]`), the `kitDrives` entries
- Test: `src/worlds/veyra/sequences/entrance.test.ts`

- [ ] **Step 1: Failing tests.**
  - The entrance path clears the arch, walls and blocks of `layout.json` with arms open and closed.
  - Three strokes occur between 1 and 4.5 s.
  - `lockRing` turns a quarter turn between 3.3 and 3.7 s, and `membraneFlash` peaks once in that window.
  - The turn is 200 degrees, between 4.5 and 5.5 s.
  - The sparkle wave runs during the 5.5 to 6.5 s settle.
  - The entrance key is `octoverse.veyra.entranceSeen`.
- [ ] **Step 2 to 4:** run (FAIL), author the sheet to spec 7.9, run. Then capture stills at `t=` 0.5, 2, 3.5, 5, 6.5.
- [ ] **Step 5: Owner live review.** Things to look at: calm, long glides; the lock click is noticed but small; the turn is graceful; she settles cleanly; it is skippable. Log, then commit `feat(veyra): entrance approved`.

---

## Milestone 6: Pendants live (F02)

### Task 19: Engine variants: bloom appear and arm lift select

**Files:**
- Create: `src/engine/artifacts/bloom.ts`, `armLift.ts`; add to `APPEARS` (bloom entry declares `sheet: 'bloom'`, so `SequenceId` gains it by derivation) and `SELECTS`; Veyra's configs are `appear: { kind: 'bloom', duration: 1.2 }` and `select: { kind: 'armLift', ease: 0.45, scale: 1.25, threadShorten: 0.3 }`
- Test: `bloom.test.ts`, `armLift.test.ts`

**Interfaces:**
- Produces:
  - `bloomState(t: number, index: number, count: number): { cupGlow: number; pearl: number; thread: number; orb: number; wobble: number }`. It runs over 1.2 s in all, rippling from `order` 0 down.
  - `armLiftTarget(slot, pointer: Vec3 | null, rest: StagePose): ArmTarget`. It eases out over 450 ms, root first and tip last; a keyboard or touch selection lifts up and forward.
  - The chosen orb scales 1.25x, its glow rises, and its thread shortens by 30%.
- [ ] **Step 1: Failing tests.**
  - `bloomState` is monotonic per channel and complete by 1.2 s for 16 pendants.
  - With `reducedMotion` it is complete at t 0 with no wobble.
  - `armLiftTarget` reaches the target by 450 ms; the root's progress leads the tip's at 150 ms.
  - Releasing returns to rest with an overshoot at most `settle` x the approved value.
  - Choosing a second pendant releases the first.
- [ ] **Step 2 to 5:** run (FAIL), implement, run and Nox regression (Nox still `blow` and `suctionHold`), commit `feat(engine): bloom and arm lift (for Veyra)`.

### Task 20: Pendants in Veyra's stages, buttons, tooltip, tray

- **Files:** `src/worlds/veyra/artifacts.ts` (`appear: { kind: 'bloom', ... }`, `select: { kind: 'armLift', ... }`), `sequences/state.theatre.json` (bloom sheet), `content/` usage notes (placeholders).
- **Tests:**
  - e2e `tests/e2e/veyra.spec.ts`: on `?world=veyra`, after settle there are 12 `.orb-button`s with unique ids.
  - Tabbing to one shows the tooltip naming the technology, and Escape clears it.
  - The hover-intent test with a moving anchor (Review Focus 2) does not flicker between two pendants.
  - On the phone viewport the tray lists 12, and choosing from it raises the arm (`aria-pressed`).
  - Reduced motion shows the pendants with no wobble.
- **Owner live review** (things to look at: bloom from cups, swing feels like water not a rope, lift is smooth, the face looks interested), log, commit `feat(veyra): pendants approved`.

## Milestone 7: Head swell with the vault dial (F02)

### Task 21: `vaultDial` head effect

- **Files:** `src/engine/character/headEffects/vaultDial.ts` (added to `HEAD_EFFECTS`), `src/worlds/veyra/character.ts` (`headEffect: 'vaultDial'`), the swell sheet in Veyra's Theatre state.
- **Interface:** implements `HeadEffectModule` (contract 9.1). Phases from spec 7.6:
  - rings appear 0 to 0.35;
  - turn and lock with a click pulse 0.35 to 0.65;
  - open and dissolve to sparkles 0.65 to 1.

  Closing runs at half duration. Colours come from the palette.
- **Tests** (`vaultDial.test.ts`):
  - Ring opacity is 0 at swell 0 and at swell 1.
  - Exactly one click pulse peak in `[0.35, 0.65]`.
  - `dispose()` is idempotent.
  - Reduced motion gives a crossfade (no rotation).
  - Nox's `glyphs` output is unchanged.
- **Check:** stills at `?swell=` 0.2, 0.5, 0.8, 1. **Owner live review**, log, commit `feat(veyra): vault dial approved`.

## Milestone 8: Pass across all stages and the engine validation (F02)

### Task 22: Responsive, accessibility, poster, performance and two-world regression

- **Files:** `public/veyra/poster.webp` (the intro still, for no-WebGL), `tests/e2e/worldSwitch.spec.ts` (extend), `docs/superpowers/evidence/veyra/REPORT.md`.
- **Tests:**
  - `worldSwitch.spec.ts` gains Veyra to Nox to Veyra while the entrance, then the bloom, then the swell is running. Each switch resets the stage, selection, timers and sequences; the listener count is unchanged; `octoverse.nox.entranceSeen` is untouched by Veyra (Review Focus 4).
  - Keyboard order reaches every stage, pendant and link.
  - 44 px targets at the phone viewport.
  - No-WebGL shows the poster with working links.
- **Perf**, pane closed, back to back, twice: `WORLD=veyra node scripts/perf.mjs "stage=intro&tier=low" "stage=overview&tier=low" "stage=entering&tier=low"` against 40, 36 and 32. Nox's own Task 1 numbers re-run, with at most a 3% drop.
- **Report:** `REPORT.md` holds the Veyra numbers, the Nox before and after numbers, the still-compare result for Nox, the list of engine variants Veyra added, and any remaining weaknesses.
- **Owner approval** of Veyra and of the engine validation (F02); log; commit `feat(veyra): F02 complete, two-world regression report`.

---

## Gaps found against the engine contract (sent to the orchestrator, not edited into the contract)

- **G1 (accepted, A1): Expression presets per character.** `EXPRESSIONS` is an engine constant; contract 14.1 dropped new face fields. Veyra's tech-focus "interested" face (spec 7.3) needs `CharacterConfig.expressions` overrides (Task 5).
- **G2 (accepted, A1): Entrance turn amount.** The spin is a fixed 2π golden-spiral turn in `entrance.ts`. Veyra needs a 200-degree glide-turn without the spiral: `EntranceShape { turn, spiral }` in the bundle (Task 17).
- **G3 (accepted, A1 `camera.hover: { amount, pace }`): Camera hover pace.** The contract carries `camera.hover` as an amount. Veyra's calmer hover also wants a slower period. If the engine owner prefers not to add `period`, Veyra uses a lower amount only (Task 2 sets 0.8 x Nox).
- **G4 (accepted, A1, built in F01): Idle flourish layer.** `flourishRate` is in the contract (deferred), but the flourish motion itself is a new shared ambient layer (Task 16).
- **G5 (accepted, A1: derived from the appear table's `sheet`): `SequenceId` is closed** to `entrance | bubbleBlow | headSwell | arrival`. Bloom needs its own sheet: add `'bloom'` (Task 19).
- **G6: Milestone 1 backdrop.** Solved inside the contract: an empty kit glTF plus water colours (Task 2). No engine change.
- **G7: Tip spirals.** Accepted as authored pose points (contract 14.1). If ambient curl unrolls them visibly in Task 7, raise it then.
- **Aligned:** pendant swing follows the contract's "driven sine on the arm's velocity" with a decay envelope, which meets spec 7.5's bounds (25 degrees, 1.2 s settle).
