# Flux World (G01 + G02) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Flux, the Pipeline Runner, as the third OctoVerse world on the extracted engine. This covers his blue-violet jelly body, the travelling cup pulse, tip-hung orbs, the `pipelineRun` head effect, the sunken server city and his energetic motion. Nox and Veyra stay unchanged.

**Architecture:** Flux is a `WorldBundle` under `src/worlds/flux/`, with assets under `public/flux/` and `blender/pipeline/`.
- **Reuses**, with his own values:
  - from Veyra: jelly surfaces, cup style, expression overrides, the pendant helpers, `bloom`'s grow, `armLift`, kit props, the flourish layer, the non-spiral entrance;
  - from Aether: `orbStyle`, and the shared `sand` floor if it has landed.
- **Adds** the closed variants of contract 18.1, each in one engine change with a test, reviewed by the engine owner:
  - `suckers.pulse` and the instance's pulse trigger (F1);
  - `APPEARS.pulse` (F2);
  - `HEAD_EFFECTS.pipelineRun` (F3);
  - `LIVE_ELEMENTS.packets` with layout paths (F4a);
  - `KIT_MATERIAL_VARIANTS.led` (F4b).

Flux never forks shared code.

**Tech Stack:** React 19, TypeScript, three 0.186.1, R3F 9, drei 10, postprocessing 3, Theatre.js 0.7.2, Vite 8, Vitest, Playwright (Edge), Python (Pillow, numpy) check tools, Blender 5.2 headless.

**Spec:** `docs/superpowers/specs/2026-11-03-flux-3d-design.md` (approved 2026-11-03; cited as "spec 7.5" and so on). Also read:
- the engine contract with amendment A1, `docs/superpowers/specs/2026-11-03-octoverse-engine-design.md` ("contract 9.2", "A1 F1"; section 18.1 is Flux's);
- the E02 plan, `docs/superpowers/plans/2026-11-03-engine-extraction.md`, whose produced names this plan uses;
- Veyra's plan, `docs/superpowers/plans/2026-11-03-veyra-world.md` on `claude/veyra-design-3b1c3c` ("Veyra Task 13");
- Aether's plan, `docs/superpowers/plans/2026-11-03-aether-world.md` on `aether-design` ("Aether Task 12").

## Start condition

**Do not start until E02 has landed and been approved.** Each milestone also waits on the Veyra and Aether tasks listed below. Cut the branch from a tip that holds them: `git switch -c claude/flux-world-<suffix> <tip>`. Task 1 records every engine name as landed; where it differs from this plan, the landed name wins.

| Flux milestone | Waits on |
|---|---|
| 1 (P2 gate) | E02 Tasks 2 to 11 (`useInstance`, `InstanceState`, `strategies.ts`, `WORLDS`, `resolveWorld`, `--world-id`, `WORLD=` capture); Veyra Task 3 (`SurfaceLook`, `JellySettings`, sparkle), Task 4 (`SuckerStyle`), Task 5 (`resolveExpressions`) |
| 2 (world) | Veyra Task 8 (`WorldLayout.groups`, `LIVE_ELEMENTS`, `props`), Task 10 (`KIT_MATERIAL_VARIANTS` with `membrane`, `place.materials`), the fish live element. Aether Task 7(d) `sand`, or Flux adds it (Task 7) |
| 3 (statics) | Veyra Task 13 (`assignPendants`, `pendantSwing`, `tetherCurve`, `threadClearance`, `TetherStyle`, `sizes`, and from A2 `pendant.swing?: { maxAngle, settle }` and `pendant.reveal?: { start, span, step }`); Aether Task 12 (`orbStyle`); E02 `choosableIn` (A1 A3) |
| 5 (motion) | Veyra Task 16 (`settle`, `glideBias`, `flourishRate`, `flourish.ts`, and from A2 `instance.flourish.subscribe(cb)`), Task 17 (`EntranceShape`, `spiral: false`), Task 18 (`kitDrives` on `'emissive'`) |
| 6 (orbs live) | Veyra Task 19 (`bloomState`, `armLift`, `armLiftTarget`, `{ liftMs, overshoot, expression }`, and the shared `reveal` reader used by `bloom` and `pulse`) |

The A2 items (contract 19.1, X1 to X3) are accepted by the engine owner and pending the owner's A2 approval. If A2 is declined, use the fallbacks in the "Gaps" section.
| 7 (head swell) | Milestone 3 approved; nothing further from other worlds |

If a needed task has not landed, stop that milestone and report. Never build another world's variant inside Flux's work. The one exception is `'sand'` (A1 A15): whichever of Flux or Aether needs it first adds it.

## Global Constraints

- **Anatomy:** exactly eight arms, T1 to T8. Technology count never sets anatomy: at most two orbs per arm (16 slots), and the rest go to the tray.
- **No mechanical anatomy:** no pipes, ports, rings, cables or LED dots on the octopus. Pipeline imagery lives in light and in the world only (master plan G02).
- **No physics:** pendant swing, packets and pulses are driven procedural curves.
- **No videos.** Evidence is stills, numbers and tests. The owner checks motion live at a local URL.
- **Colour pipeline:** no tone mapping; `flat` canvas; colours are sRGB hex in config, never in engine shaders (`boundary.test.ts`).
- **Engine boundary:** `src/engine/**` imports nothing from `src/worlds/**`. Each engine change is its own commit, reviewed by the engine owner.
- **Frozen worlds:** Nox and Veyra outputs are frozen. After every engine change:
  - the E02 baseline stills compare clean (`python scripts/still_compare.py <baseline> <current> --floor <floor.json>` exits 0);
  - Veyra's still set compares clean the same way, and Aether's too if it has landed;
  - the six Nox e2e specs pass unmodified.
- **Frame rate** is measured only with the browser pane closed, back to back, at 1536 x 1024, pixel ratio 1. Budgets at tier low (spec 2.5):
  - intro at least 40 fps median;
  - overview with 12 orbs at least 36;
  - entrance at least 32.

  Nox and Veyra may not drop more than 3%.
- **Colour targets:** the spec 2.1 table, CIE76 delta E 10 per sample, plus:
  - head-middle red at least 70 above crown red;
  - face-glow red at least 150 above crown red;
  - face-glow green at least 40 below its red.
- **Pulse targets** (spec 2.4):
  - root to tip in 0.6 to 0.9 s, with 3 to 5 cups lit;
  - at peak, the brightest channel is at most 250 and the smallest channel at least 40 below it, measured after bloom;
  - at most one idle pulse at a time.
- **References:** sample only from `<main checkout>/docs/design/references/Flux/native-panels/`. View and trace from the 3x panels in `Flux/`. Never take colour or detail from `Flux/regenerated/`.
- **Workspace:** never edit, reset or restore the main checkout. No bare `git stash`. No push. Do not merge.
- **Approval and commits:** the owner approves each milestone live before the next starts. Commit per approved milestone. Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Model tiering:** Opus for the 3D look (Tasks 3, 4, 5, 6, 9, 10, 11, 18, and the look steps of 12 and 16). Cheaper models for wiring, data and tests.

## Review Focus

1. **Technology counts at the edges.** With 3 technologies, only 3 orbs show, at the T1, T8 and T2 tips. With 20, 16 hang and 4 go to the tray. No arm ever carries a third (Task 12, `assignPendants` with `FLUX_SLOTS`).
2. **Explore pressed while the pulse appear is still running.** If the swell starts mid-appear, every orb still ends at its overview size by swell 1, never grows twice, and never flickers to 0 (Task 16, `revealSize` and appear interplay test).
3. **Fast hover sweeps across orbs.** Each select fires a pulse. A sweep over six orbs in 600 ms never runs two pulses on one arm at once, and never shows more than three arms pulsing (Task 5 `firePulse` guard; Task 16 test).
4. **Reduced motion.** No idle pulses, no LED blink, no packets moving, no swing. The appear lights the cups for 300 ms, then they are still; `pipelineRun` becomes a crossfade (Tasks 5, 7, 14, 16 and 18 tests with `reducedMotion: true`).
5. **A world switch mid-pulse, mid-entrance or mid-swell** from Flux to Nox and back. Pulse trigger times reset, Nox's cups show no pulse (strength 0), and Nox's entrance flag is untouched (Task 19, extends `worldSwitch.spec.ts`).

## File structure (end state)

- `src/worlds/flux/bundle.ts`: `FLUX_BUNDLE: WorldBundle`.
- `src/worlds/flux/character.ts`: `FLUX: CharacterConfig` (head, arms, `skin.surfaces`, `suckers.style`, `suckers.pulse`, face, `expressions`, personality, lighting, `headEffect: 'pipelineRun'`).
- `src/worlds/flux/poses.ts`: `FLUX_POSES`. `src/worlds/flux/swim.ts`: `FLUX_SWIM`.
- `src/worlds/flux/artifacts.ts`: `FLUX_ARTIFACTS` and `FLUX_SLOTS`.
- `src/worlds/flux/sequences/defaults.ts`, `sequences/state.theatre.json`: entrance, headSwell, arrival.
- `src/worlds/flux/place/config.ts` (`PIPELINE_STAGE`, then `PIPELINE_WORLD`), `place/layout.json`, `place/far.json`.
- `src/worlds/flux/content/`: `fluxProject.ts`, `fluxTechnologies.ts`, `placeholders.ts`. `src/worlds/flux/theme.ts`.
- `src/worlds/flux/review/{stage,world}_samples.json`, `review/targets.json`.
- `src/engine/character/cupPulse.ts`: the pulse maths and the trigger; `suckerMaterial.ts` gains the pulse term.
- `src/engine/artifacts/pulseAppear.ts`: `APPEARS.pulse`.
- `src/engine/character/headEffects/pipelineRun.ts`: `HEAD_EFFECTS.pipelineRun`.
- `src/engine/world/live/Packets.tsx`: `LIVE_ELEMENTS.packets`.
- `src/engine/world/kitMaterials/led.ts`: `KIT_MATERIAL_VARIANTS.led`.
- `src/engine/world/floors/sand.ts`: only if not yet landed.
- `blender/pipeline/build_kit.py`, `bake_world.py`, `render_far.py`; `public/flux/world/*`, `public/flux/ref/*`, `public/flux/poster.webp`.
- `docs/superpowers/reviews/flux.md`: the owner's review log. `docs/superpowers/evidence/flux/`: still sets and the regression report.

---

## Milestone 1: Flux on the P2 stage (the gate, G01)

### Task 1: Re-read the engine and set up Flux's reference checks

**Files:**
- Create: `src/worlds/flux/review/stage_samples.json`, `review/world_samples.json`, `review/targets.json`, `public/flux/ref/p2.png`, `public/flux/ref/p2-mask.png`, `docs/superpowers/reviews/flux.md`
- Test: `src/worlds/flux/review/targets.test.ts`

**Interfaces:**
- Consumes: `check_stage.py --world-id <id>` (E02 Task 11), `silhouette.py`.
- Produces: `targets.json` = `{ samples: { name, x, y, size: 5, rgb }[14], deltaE: 10, gradient: { from: 'crown', to: 'headMiddle', minRed: 70 }, warm: { minRedOverCrown: 150, minRedOverGreen: 40 }, head: { halfWidth: [0.70, 0.78], top: [0.22, 0.30] }, armSpan: [3.8, 4.2], iou: 0.85, meanInside: { rgb, tolerance: 12, satTolerance: 0.04 } }`. Coordinates are native P2 pixels (spec 2.1).

- [ ] **Step 1: Engine drift check.** Run `rg "export (const|type|interface|function) (WorldBundle|validateBundle|faceAnchor|useInstance|InstanceState|HEAD_EFFECTS|PLACEMENTS|APPEARS|SELECTS|LIVE_ELEMENTS|KIT_MATERIAL_VARIANTS|WORLDS|resolveWorld|resolveExpressions|SurfaceLook|JellySettings|SuckerStyle|assignPendants|pendantSwing|tetherCurve|threadClearance|bloomState|armLiftTarget|clampCharacterConfig)" src/engine src/worlds`. Write each name and its file under "Engine as landed" in `docs/superpowers/reviews/flux.md`. Where a name differs from this plan, use the landed one and note it.
- [ ] **Step 2: Copy P2.** Copy `<main checkout>/docs/design/references/Flux/native-panels/02 - Flux Arrives and Introduces GitHub Pipeline Engine.png` to `public/flux/ref/p2.png` (copy only). Make the mask with `python scripts/silhouette.py` as for Nox's panel 2, excluding the title, nameplate, bubbles and racks. Check it by eye beside the crop.
- [ ] **Step 3: Write the samples and targets** from spec 2.1 and 2.2. Measure the mean colour inside the mask into `meanInside.rgb`, and the arm span on the mask. If the span is outside `[3.8, 4.2]`, record the measured value and use ±0.2 around it.
- [ ] **Step 4: Write `targets.test.ts`:**
  - `targets.json` has 14 samples;
  - every sample's `rgb` equals the 5 x 5 area mean of `p2.png` at its point within 1 per channel;
  - head-middle red minus crown red ≥ 70;
  - face-glow red minus crown red ≥ 150;
  - face-glow red minus face-glow green ≥ 40.
- [ ] **Step 5: Run** `npx vitest run src/worlds/flux/review`; expected PASS. Run `python scripts/check_stage.py public/flux/ref/p2.png --stage intro --world-id flux`; expected every sample delta E 0.0, exit 0.
- [ ] **Step 6: Commit** `chore(flux): P2 reference crop, mask, samples and targets`.

### Task 2: Flux's bundle on a stage backdrop

**Files:**
- Create in `src/worlds/flux/`:
  - `bundle.ts`;
  - `character.ts`;
  - `poses.ts` (intro only; the other stages reuse it until Milestone 3);
  - `swim.ts` (intro arms as placeholders);
  - `artifacts.ts` (placeholder: `orbit` with zero shells until Task 12);
  - `sequences/defaults.ts`;
  - `sequences/state.theatre.json` (empty);
  - `place/config.ts` (`PIPELINE_STAGE`);
  - `theme.ts`;
  - `content/*`.
- Create: `public/flux/world/stage.glb` (empty scene, `blender/pipeline/empty_kit.py`)
- Modify: `src/worlds/index.ts` (register `flux`)
- Test: `src/worlds/flux/bundle.test.ts`

**Interfaces:**
- Consumes: `WorldBundle`, `validateBundle`, `faceAnchor`, `WORLDS`, `resolveWorld`, `clampCharacterConfig`.
- Produces:
  - `FLUX_BUNDLE` (`id: 'flux'`), `FLUX`, `FLUX_POSES.intro`.
  - `PIPELINE_STAGE: WorldConfig`: empty kit; water and fog fitted to P2's mid water (0, 16, 45) and upper water (1, 74, 136); `camera.tilt` as Nox's; `camera.hover: { amount: <Nox's>, pace: 1.2 }`.
  - `FLUX_THEME: UiTheme`: accent `#4aa6d0`; Live Demo gradient `#4aa6d0` to `#25ada8`; surfaces `#031e3b`; electric-cyan focus ring; `titleIcon: 'gear'`.
  - Content per spec 7.10: 12 technologies, every storyboard string wrapped in the placeholder marker Nox uses.

- [ ] **Step 1: Failing tests in `bundle.test.ts`:**
  - `validateBundle(FLUX_BUNDLE)` does not throw;
  - `Object.keys(FLUX_POSES.intro.arms)` equals `ARM_IDS`;
  - `FLUX.head.halfWidth` is in `[0.70, 0.78]`, `FLUX.head.top` in `[0.22, 0.30]`, and `FLUX.head.cheeks.radius` in `[0.06, 0.10]`;
  - `faceAnchor(FLUX_BUNDLE, 'intro').y` is within 0.05 of -0.54;
  - `resolveWorld('?world=flux').bundle.id === 'flux'` with no warning;
  - `clampCharacterConfig(FLUX)` deep-equals `FLUX`;
  - `FLUX_BUNDLE.content.technologies.length === 12`;
  - `FLUX_BUNDLE.artifacts.choosableIn` deep-equals `['overview']`.
- [ ] **Step 2: Run** `npx vitest run src/worlds/flux`; expected FAIL (module missing).
- [ ] **Step 3: Author `character.ts`** from spec 7.1 and 7.8:
  - **Head:** `halfWidth` 0.74, `top` 0.26, cheeks radius 0.08 at eye level, `faceOrigin` so the eyes land at y -0.54.
  - **Personality** (the spec 7.8 table): blink `[2.0, 5.0]`, double blink 0.3, gaze 22, head turn 4.2, sway 0.6, curl 0.9, float 0.05 / 4.8 s, breath 3.6 s, swim 0.38 / 0.16 / 0.32.
  - **Skin:** `'skin'` on both surfaces until Task 3.

  Author `poses.ts` intro by tracing P2's eight arms (spec 7.4) as `Point2` polylines, root first. The open tip curls of half to one turn are authored points.
- [ ] **Step 4: Register** `flux` in `WORLDS`. Run the tests, `npm run typecheck` and the boundary test; expected clean.
- [ ] **Step 5: Look.** Start `npx vite --port 5191 --strictPort`. Run `WORLD=flux node scripts/stage-capture.mjs intro .tmp/flux-intro.png freeze` and compare with `public/flux/ref/p2.png`. Expected: eight arms, roughly the P2 pose, on dark water. Log the still. Stop vite.
- [ ] **Step 6: Regression** (Global Constraints, frozen worlds).
- [ ] **Step 7: Commit** `feat(flux): bundle, character, intro pose and stage backdrop`.

### Task 3: Flux's jelly body, sparkles and cups (values on Veyra's variants)

**Files:**
- Modify: `src/worlds/flux/character.ts` (`skin.surfaces`, `suckers.style`, `glow`)
- Test: `src/worlds/flux/bundle.test.ts`

**Interfaces:**
- Consumes: `SurfaceLook`, `JellySettings` (Veyra Task 3), `SuckerStyle` (Veyra Task 4).
- Produces (spec 7.2, start values; Task 6 tunes them):
  - **Mantle:** `mode: 'jelly'`, crown `#3044ef`, depth `#9c57ef`, rim `#3d74e9`, core `#feabcf`, `coreCenter` just below the mouth, `coreWarmth` high. Sparkle gives at least 40 specks on the head front.
  - **Arms:** `mode: 'jelly'`, rim `#6d7df6`, depth `#374af1`, core `#c070f0`, with sparkle.
  - **Cups:** `scallop` 0.1 (separate ovals, no frill); `edge` and `rim` `#f3afef`; hollow a deeper violet-pink; `rimWidth` 0.18; `glow` 1.2; size falling toward the tip.
  - **Glow:** `glow.light` colour `#d070ff`.

- [ ] **Step 1: Failing tests:**
  - both surfaces are `'jelly'`;
  - each jelly and cup colour with a spec 2.1 sample is within delta E 25 of it: crown, depth (head middle), core (face glow), arm rim (highlight), arm depth (body) and cup rim;
  - `FLUX.suckers.style.scallop <= 0.15`;
  - no `FLUX` colour has red above both green and blue except the core, blush, mouth and cups (no stray red).
- [ ] **Step 2: Run**; FAIL. **Step 3: Author** the values. **Step 4: Run**; PASS. Capture the intro and compare with P2.
- [ ] **Step 5: Commit** `feat(flux): jelly body, sparkles and cups`.

### Task 4: Flux's face and expressions

**Files:**
- Modify: `src/worlds/flux/character.ts` (`face`, `facePalette`, `expressions`)
- Test: `src/worlds/flux/bundle.test.ts`

**Interfaces:**
- Consumes: `resolveExpressions` (Veyra Task 5; A1 G1).
- Produces:
  - **Expression overrides of existing ids only.** "Eager" is Flux's override of `focused`: eyes wider, brows up, mouth slightly open. The intro and overview faces are the open smile.
  - **`FLUX.face.eye.lashes`:** two short outer lashes per eye.
  - **Brows:** thickness above Nox's.

- [ ] **Step 1: Failing tests:**
  - `FLUX.face.eye.lashes.length === 2`;
  - `FLUX.face.brow.thickness > NOX.face.brow.thickness`;
  - the iris has a navy top (blue above red, and every channel below 60) and a violet bottom (blue above green, red above green);
  - `resolveExpressions(FLUX).focused` has mouth open greater than 0 and lid-open greater than `resolveExpressions(NOX).focused`'s;
  - the intro expression's mouth open is at least 0.6;
  - blush red is at least 240.
- [ ] **Step 2: Author** the face from spec 7.3, traced from the 3x P2 panel: two catchlights, the open "D" smile with a pink tongue, pink blush ovals.
- [ ] **Step 3: Run**; capture the intro face at 3x and compare with the P2 face crop.
- [ ] **Step 4: Commit** `feat(flux): face and expressions`.

### Task 5: Engine variant: cup pulse and the instance trigger (A1 F1)

Raise this with the engine owner before starting. Contract 18.1 F1 accepts it.

**Files:**
- Create: `src/engine/character/cupPulse.ts`, `cupPulse.test.ts`
- Modify:
  - `src/engine/types/` (`SuckerSettings.pulse?: CupPulse`);
  - `src/engine/character/suckerRow.ts` (per-cup `aArc` arc-fraction and `aArm` index attributes);
  - `suckerMaterial.ts` (pulse term, `uPulseTimes[8]`, `uPulseColours[3]`);
  - `src/engine/host/instance.ts` (`InstanceState.pulse`);
  - `src/engine/config/validate.ts`;
  - the URL review options (`?pulse=<armId>@<seconds>`, dev only, for frozen stills).
- Modify: `src/worlds/flux/character.ts`

**Interfaces:**
- Produces:
  - `CupPulse = { speed: number /* arc fractions per second */; wavelength: number /* arc fraction */; strength: number; colours: readonly [string, string, string] }`. Absent, or `strength` 0, reproduces today's cups exactly.
  - `PulseTriggers = { times: Float32Array /* 8, seconds; -Infinity = idle */ }`.
  - `createPulseTriggers(): PulseTriggers`.
  - `firePulse(t: PulseTriggers, arm: ArmId, clock: number, cfg: CupPulse): boolean`. It returns false, and changes nothing, when that arm's pulse is under 50% of its travel (the Review Focus 3 guard).
  - `cupPulseAt(arc: number, since: number, cfg: CupPulse): { level: number; hue: number }`. `level` is 0 to 1; `hue` is 0 to 1 across the three colours (cyan at the head, lavender in the middle, pink at the tail).
  - `InstanceState.pulse: PulseTriggers`, reset on remount by construction.
- Flux values: `speed` 1.33 (0.75 s root to tip), `wavelength` 0.17, `strength` tuned in Task 6, `colours` [electric cyan, lavender, the cup pink].

- [ ] **Step 1: Failing tests (`cupPulse.test.ts`):**
  - With Flux's config, the time for `level > 0.5` to cross from arc 0.05 to 0.95 is in `[0.6, 0.9]` s.
  - On a 24-cup arm, between 3 and 5 cups have `level > 0.5` at any time mid-travel.
  - `level` is 0 before firing and after `since > 1 / speed + wavelength / speed`.
  - `firePulse` at 20% travel returns false; at 60% travel it returns true and restarts.
  - Reduced motion: the module's `reducedLevel(since)` is 1 for 0 to 0.3 s and 0 after.
  - A Nox config (no `pulse`) gives the sucker fragment source and uniforms identical to the pre-change snapshot.
  - `createInstanceState` twice gives distinct `pulse.times` arrays.
- [ ] **Step 2: Run** `npx vitest run src/engine/character/cupPulse.test.ts`; expected FAIL.
- [ ] **Step 3: Implement.**
  - **Shader:** the pulse term reads `uPulseTimes[aArm]`, computes `since = uTime - t`, and evaluates the same `cupPulseAt` maths. It mixes the cup emissive toward the hue colour and adds at most 15% brightness. The hue shift dominates (spec 2.4).
  - **No new pass and no per-frame allocation;** the uniform array is updated in place.
  - **Review hook:** `?pulse=t1@0.4` fires T1's pulse at clock 0, freezes at 0.4 s, and is dev only.
- [ ] **Step 4: Run** the tests, boundary (no hex literals), typecheck; regression (frozen worlds).
- [ ] **Step 5: Commit** `feat(engine): cup pulse and per-arm trigger (for Flux)`.

### Task 6: Look tuning to the P2 targets and the gate review

**Files:**
- Modify: `src/worlds/flux/character.ts`, `poses.ts` (intro), `place/config.ts` (water), `docs/superpowers/reviews/flux.md`

- [ ] **Step 1: Measure.** Run `WORLD=flux node scripts/world-capture.mjs` at P2's camera, frozen. Then run `python scripts/check_stage.py <capture> --world --stage intro --world-id flux`. Record:
  - every delta E;
  - the three global checks;
  - the mean inside the mask, the IoU, the head and the span.
- [ ] **Step 2: Tune** bundle values only, one group at a time, re-measuring after each, until `check_stage.py` exits 0 and the IoU is at least 0.85. Tune in this order:
  1. head;
  2. arm traces;
  3. mantle crown, depth and rim (the blue-to-violet gradient);
  4. core (face warmth and chin);
  5. arms;
  6. cups;
  7. aura and grade;
  8. water.

  If the chin and face-glow targets cannot both be met with `coreCenter` and `coreWarmth`, stop and send the engine owner the numbers (spec 7.2). Never add world light to him.
- [ ] **Step 3: Pulse check.** Capture `?world=flux&stage=intro&freeze&pulse=t2@0.35` and `@0.6`. On the brightest pulsed cup (3 x 3 px), the brightest channel is at most 250 and the smallest channel at least 40 below it. Count the cups above half level: 3 to 5. Tune `strength` and the cup bloom.
- [ ] **Step 4: Close-up check** (spec 2.3) at 3x zoom, each item logged:
  - eyes, lashes, brows, mouth and blush;
  - rim, crown, middle and core;
  - at least 40 sparkles on the head front;
  - separate cups, at least 10 per visible arm;
  - at least five open tip curls.
- [ ] **Step 5: Perf.** Close the pane. Run `WORLD=flux node scripts/perf.mjs "stage=intro&tier=low"` twice. Expected median at least 40 fps. If it is missed, apply the spec 10.1 order (on the backdrop only sparkle count applies) and report.
- [ ] **Step 6: Owner gate.** Give the owner `/?world=flux&stage=intro` and `&freeze`, the P2 crop side by side, the pulse stills, the numbers, and five things to look at:
  1. blue crown to violet to a warm pink face;
  2. glassy, not plastic;
  3. separate glowing cups;
  4. the pulse reads as living light, not LEDs;
  5. he is neither Nox nor Veyra.

  Name the remaining weaknesses yourself. Repeat until approved, and log the owner's words.
- [ ] **Step 7: Commit** `feat(flux): P2 look approved`.

---

## Milestone 2: The pipeline world (G01)

### Task 7: Engine variants: packets, LED kit material, and sand if missing

Raise this with the engine owner before starting (A1 F4a, F4b, A15).

**Files:**
- Create: `src/engine/world/live/Packets.tsx`, `packets.test.ts`, `src/engine/world/kitMaterials/led.ts`, `led.test.ts`
- Modify:
  - the `LIVE_ELEMENTS` table and the `KIT_MATERIAL_VARIANTS` table;
  - `src/engine/world/types.ts` (`WorldLayout.paths?: Record<string, readonly Vec3[]>`);
  - `validateWorld.ts`;
  - only if `'sand'` has not landed: `src/engine/world/floors/sand.ts` and `floor.test.ts`.

**Interfaces:**
- Produces:
  - `LIVE_ELEMENTS.packets: { path: string; count: Record<Tier, number>; speed: number; length: number; colours: readonly [string, string] }`. It draws one instanced mesh, at most 12. `packetArc(i: number, t: number, count: number, speed: number): number` returns 0 to 1 along the path, evenly spaced and wrapping.
  - `KIT_MATERIAL_VARIANTS.led: { intensity: number; rate: readonly [number, number]; duty: number }`. The colour comes from the glTF `COLOR_0`, the phase from the custom attribute `_PHASE`. `ledLevel(t: number, phase: number, rate: number, duty: number): number` is 0 or 1 with a 40 ms soft edge. A world assigns it to kit nodes by name in `place.materials`, as `membrane` is.
  - `'sand'` (only if absent): `floor.material: 'sand'`, dark rock and sand from palette keys `sand` and `rock`.

- [ ] **Step 1: Failing tests:**
  - `packetArc` is periodic and evenly spaced;
  - a `packets` element naming a missing path fails validation with the path name;
  - `count.low > count.high` fails;
  - reduced motion: `packetArc` frozen;
  - `ledLevel` averages `duty` over 10 s within 0.05; reduced motion gives a constant `duty`;
  - a world assigning `led` to a missing node fails with the node name;
  - for sand, if built: a config with it validates and Nox's `lava-cracks` output is unchanged.
- [ ] **Step 2: Run**; FAIL. **Step 3: Implement.** **Step 4: Run**; regression (e2e `world`, `worldMotion`, `worldTiers`).
- [ ] **Step 5: Commit** one per variant: `feat(engine): packets live element (for Flux)`, `feat(engine): led kit material (for Flux)`, and `feat(engine): sand floor (for Flux and Aether)` if built.

### Task 8: The pipeline kit and layout (Blender, headless)

**Files:**
- Create: `blender/pipeline/build_kit.py`, `public/flux/world/kit.glb`, `src/worlds/flux/place/layout.json`
- Test: `src/worlds/flux/place/layout.test.ts`

**Interfaces:**
- Produces these kit pieces:
  - `tower_a` to `tower_c` (stacked rack modules, some leaning or broken, with barnacle and coral growth);
  - `rack_module`;
  - `portal_plinth`, `portal_disc`;
  - `portal_arc_1` to `portal_arc_4` (separate nodes, named for `props`);
  - `bridge_deck`, `bridge_pier`, `bridge_arch`;
  - `rock_a` to `rock_c`;
  - `coral_a`.

  LED faces on the towers and modules carry `COLOR_0` (mostly blue and cyan, some violet, under 10% amber) and `_PHASE` (random 0 to 1), in a material slot named `led`. The layout has `paths.bridge`: the packet spline along the deck to the portal.

- [ ] **Step 1: Failing test:**
  - `layout.json` names only kit pieces;
  - the portal is right of and behind the stage (x > 1.2, z < -2);
  - towers frame both sides (at least one with x < -2.2 and one with x > 2.2);
  - `paths.bridge` ends within 0.5 of the portal centre;
  - a clear corridor 2.4 units wide runs from the far left to the stage spot (path polyline against each placement's bounding radius).
- [ ] **Step 2: Write `build_kit.py`** in the style of `blender/vault/build_kit.py`. Run `blender -b -P blender/pipeline/build_kit.py -- public/flux/world/kit.glb`. Expected: the file is written and the piece list printed, with `COLOR_0` and `_PHASE` present on the `led` slot.
- [ ] **Step 3: Write `layout.json`** per spec 7.7.
- [ ] **Step 4: Run**; PASS. **Step 5: Commit** `feat(flux): pipeline kit and layout`.

### Task 9: Bake, far plate and world configuration

**Files:**
- Create: `blender/pipeline/bake_world.py`, `render_far.py`, `public/flux/world/near.glb`, `public/flux/world/far/*.webp`, `src/worlds/flux/place/far.json`
- Modify: `src/worlds/flux/place/config.ts` (`PIPELINE_WORLD` replaces `PIPELINE_STAGE` in the bundle)
- Test: `src/worlds/flux/place/config.test.ts`

- [ ] **Step 1: Failing tests:**
  - `validateWorld(PIPELINE_WORLD)` passes;
  - no light has red above both green and blue (no red light, spec 7.7);
  - the `led` intensity times the brightest LED colour is below the cup glow's luminance;
  - the portal disc's emissive is below the face core's brightness (the relic rule);
  - `packets` uses `paths.bridge` with `count.high` ≤ 12.
- [ ] **Step 2: Bake** headless: portal white-blue spill, LED spill on rack faces, violet-pink bridge-ring spill, cool surface fill, ambient occlusion. Render the far plate in two or three depth layers (distant towers, fish silhouettes, shaft).
- [ ] **Step 3: Configure `PIPELINE_WORLD`:**
  - **Light and water:** the surface spot from the upper right with caustics; deep navy fog.
  - **Materials:** `materials: { led: { node: 'led', variant: 'led', intensity, rate: [0.4, 2.5], duty: 0.6 } }`.
  - **Live elements:**
    - `packets` (cyan and lavender);
    - blue-violet bubbles, denser to the left;
    - fish (off at tier low);
    - rays;
    - glyph motes only if motes take a sprite set as data. Otherwise none, and log that they were dropped (spec 12.6).
  - **Floor and post:** `floor.material: 'sand'`; `skinAccent` cool blue; bloom tuned so cyan and pink do not clip.
- [ ] **Step 4: Run**; PASS. **Step 5: Commit** `feat(flux): baked pipeline world and far plate`.

### Task 10: World look, Flux's colour in the world, budget, and review

- [ ] **Step 1:** Re-run Task 6 Step 1 in the world; exit 0. If Flux's samples moved, fix the world, never his emitters.
- [ ] **Step 2: Side by side** with the P1 and P2 crops: towers, portal, bridge, shaft, no red light.
- [ ] **Step 3: Perf**, pane closed: `WORLD=flux node scripts/perf.mjs "stage=intro&tier=low" "stage=intro&tier=high"` twice. Expected tier low at least 40. If it is missed, cut in the spec 10.1 order and re-measure; if still missed, stop and report.
- [ ] **Step 4: Owner review**, live, five things:
  1. a sunken data centre, still underwater;
  2. the portal is focal but quieter than his face;
  3. LEDs and packets are alive but not busy;
  4. no tech clutter;
  5. the camera hover is lively.

  Log the result.
- [ ] **Step 5: Commit** `feat(flux): pipeline world approved`.

---

## Milestone 3: Static P3, P4 and P5 (G01)

### Task 11: Overview pose and dome

- **Files:** `src/worlds/flux/poses.ts` (overview, traced from P3), `character.ts` (`dome`, dome palette: electric-blue rim, navy bottom), and `src/worlds/flux/review/` (P3 crop).
- **Tests** (`bundle.test.ts`):
  - eight overview arms;
  - the dome projected at the overview frame contains the HTML panel box with 0.04 margin;
  - the face anchor sits at the dome bottom (within 0.1).
- **Check:** `?world=flux&stage=overview&freeze` beside P3. Commit `feat(flux): overview pose and dome`.

### Task 12: Flux's slots, orbs, tech-focus and detail statics, responsive

**Files:**
- Modify: `src/worlds/flux/artifacts.ts`, `poses.ts` (`techFocus`, `detail`), `character.ts` (frames), `src/worlds/flux/review/` (P4, P5 crops)
- Test: `src/worlds/flux/artifacts.test.ts`

**Interfaces:**
- Consumes: `assignPendants`, `pendantSwing`, `tetherCurve`, `threadClearance`, `TetherStyle` (Veyra Task 13); `orbStyle` (Aether Task 12).
- Produces:
  - `FLUX_SLOTS: Record<'intro' | 'overview', PendantSlot[]>`:
    - tips (`at: 1`) on all eight arms, with `order` 0 to 7 as T1, T8, T2, T7, T3, T6, T4, T5;
    - mid slots (`at: 0.55`) on T1, T8, T2 and T7 with `order` 8 to 11;
    - four more mid slots (T3, T6, T4, T5 at 0.55) with `order` 12 to 15.
  - `FLUX_ARTIFACTS.placement`: `{ kind: 'pendant', slots: FLUX_SLOTS, maxPerArm: 2, sizes: { intro: 0, overview: 0.28 }, tether: { length: 0, color: <cap violet-pink>, width: 0, sag: 0, cap: <cap violet-pink> } }`.
  - `orbStyle: { rimBeads: 0, rimColour: <orb rim>, cap: { colour: <cap violet-pink>, size: 0.05 } }`.
  - `choosableIn: ['overview']`.
  - `techFocus` pose: the overview with T8 straight up, its tip orb held high (P4). `detail` traced from P5.
- [ ] **Step 1: Failing tests:**
  - 16 slots, at most 2 per arm;
  - `assignPendants(12, FLUX_SLOTS.overview)` places all 8 tips plus mid slots on T1, T8, T2 and T7;
  - `assignPendants(3, …)` uses the T1, T8 and T2 tips;
  - `assignPendants(20, …)` places 16 and trays 4 (Review Focus 1);
  - `threadClearance` above 0.05 for the overview at desktop and at the 390 x 844 frame;
  - no orb overlaps the face rect, the title or the nameplate box at the overview frame;
  - the detail pose keeps the face anchor on screen.
- [ ] **Step 2: Run**; FAIL. **Step 3: Author** the values. **Step 4: Run**; PASS.
- [ ] **Step 5: Check** frozen stills beside P3 to P5: overview with 12 orbs, techFocus (`tech=github-actions`), detail and the phone viewport. **Perf:** overview at tier low at least 36 fps.
- [ ] **Step 6: Owner review** of P3, P4 and P5; log; commit `feat(flux): P3 to P5 statics approved`.

## Milestone 4: Back view (G01)

### Task 13: Orbit review

- **Check:** `?world=flux&stage=intro&freeze&yaw=0|45|90|180`. The back is round and glassy; the blue crown, rim and sparkles continue round it; the cups read from behind. Fix in `character.ts` only.
- **Owner review**, log, commit `feat(flux): back view approved`.

---

## Milestone 5: Motion personality and the entrance (G02)

### Task 14: Flux's personality and the idle pulse

**Files:**
- Modify: `src/worlds/flux/character.ts` (`settle` 1.4, `glideBias` 0.55, `flourishRate` 10, `flourishPulse` 0.75)
- Modify: `src/engine/types/` (`Personality.flourishPulse?: number`, 0 to 1, default 0), `src/engine/config/validate.ts`, `src/engine/character/cupPulse.ts` (the subscription)
- Test: `src/worlds/flux/motion.test.ts`, `src/engine/character/cupPulse.test.ts`

**Interfaces:**
- Consumes: `flourish.ts`, `flourishRate`, `settle`, `glideBias`, `instance.flourish.subscribe(cb: (e: { arm: ArmId; clock: number }) => void): () => void` (Veyra Task 16, A2 X1); `firePulse` (Task 5).
- Produces: `subscribeIdlePulse(instance: InstanceState, cfg: CharacterConfig): () => void`. On each flourish event, with probability `flourishPulse`, it calls `firePulse` on the event's arm and suppresses that event's tip unroll; otherwise Veyra's unroll runs. It returns the unsubscribe function, which is called on unmount. `flourishPulse` 0 or absent subscribes nothing, so Nox and Veyra are unchanged.

- [ ] **Step 1: Failing tests:**
  - over 600 s of simulated time, idle pulses average one every 6 to 10 s;
  - never two idle pulses overlap;
  - none fires on an arm that is lifting;
  - with `reducedMotion`, no idle pulse fires;
  - Nox's and Veyra's flourish fixtures are unchanged.
- [ ] **Step 2 to 4:** run (FAIL), implement, run; regression.
- [ ] **Step 5: Commit** `feat(engine): flourish pulse share (for Flux)`, then `feat(flux): motion personality and idle pulse`.

### Task 15: Flux's entrance with the portal run

**Files:**
- Create: `src/worlds/flux/sequences/state.theatre.json` (entrance, arrival), `swim.ts` (open and trail traced from P1)
- Modify:
  - `sequences/defaults.ts` (`entrance: { turn: Math.PI, spiral: false }`);
  - `place/config.ts`: `props` = `portalArc1` to `portalArc4` on `portal_arc_1` to `portal_arc_4`, and `portalDisc` on `portal_disc`, all with drive `'emissive'`;
  - the `kitDrives` entries.
- Test: `src/worlds/flux/sequences/entrance.test.ts`

- [ ] **Step 1: Failing tests:**
  - the path clears towers, piers and portal with arms open and closed;
  - five strokes between 0.5 and 3.0 s;
  - the arcs peak in order 1 to 4 within 2.2 to 3.0 s, at least 120 ms apart;
  - the disc peaks once after arc 4;
  - the body x passes the stage spot by 0.15 to 0.35 units between 3.0 and 3.6 s, then returns;
  - the turn is π between 3.6 and 4.2 s;
  - the intro pose and the intro expression are reached by 5.0 s;
  - the key is `octoverse.flux.entranceSeen`;
  - reduced motion: intro pose at t 0 with all arcs lit.
- [ ] **Step 2 to 4:** run (FAIL), author the sheet to spec 7.9, run. Capture stills at `t=` 0.3, 1.5, 2.6, 3.3, 4.0, 5.0.
- [ ] **Step 5: Owner live review**, five things:
  1. energetic, not frantic;
  2. the portal run reads as a pipeline going green;
  3. the overshoot and spring-back feel playful;
  4. the turn and pop-open land on the smile;
  5. skippable.

  Log; commit `feat(flux): entrance approved`.

---

## Milestone 6: Orbs live (G02)

### Task 16: Engine variant: pulse appear, lift pulse and swell reveal (A1 F2)

Raise this with the engine owner before starting (F2).

**Files:**
- Create: `src/engine/artifacts/pulseAppear.ts`, `pulseAppear.test.ts`
- Modify:
  - `strategies.ts` (`APPEARS.pulse`, with no `sheet`, A1 G5);
  - `armLift.ts` (optional `pulse?: boolean` param: fires `firePulse` on lift).
- Modify: `src/worlds/flux/artifacts.ts` (`swing` and `reveal` values)

**Interfaces:**
- Consumes:
  - `bloomState`'s orb channel (Veyra Task 19) for the grow;
  - `firePulse`, `cupPulseAt` (Task 5);
  - `armLiftTarget` (Veyra Task 19);
  - `pendant.swing` and `pendant.reveal` (Veyra Task 13, A2 X2 and X3), and the shared `reveal` reader (Veyra Task 19), which `pulse` uses exactly as `bloom` does.
- Produces:
  - `pulseSchedule(step: number): { arm: ArmId; fireAt: number }[]`: pairs (T1, T8), (T2, T7), (T3, T6), (T4, T5) at 0, `step`, 2·`step`, 3·`step`.
  - `orbGrowStart(slot: PendantSlot, schedule, speed: number): number = fireAt(slot.arm) + slot.at / speed`.
  - Flux configs:
    - `appear: { kind: 'pulse', step: 0.18 }`;
    - `select: { kind: 'armLift', liftMs: 300, overshoot: 0.12, expression: 'focused', scale: 1.25, threadShorten: 0, pulse: true }`;
    - `placement.reveal: { start: 0.35, span: 0.3, step: 0.03 }` (orb *i* grows over swell `start + step·i` to that plus `span`);
    - `placement.swing: { maxAngle: 18°, settle: 0.8 }`.

- [ ] **Step 1: Failing tests:**
  - `pulseSchedule(0.18)` has 4 pairs, mirrored, ascending;
  - an orb never starts growing before its pulse reaches its slot;
  - with `sizes.intro` 0, the appear leaves every intro orb at size 0, and no button exists in the intro (A3);
  - with Flux's `reveal`, the shared reader's size is monotonic in swell, 0 at swell ≤ 0.35 and `0.28` at swell 1 for all 16;
  - with Flux's `swing`, `pendantSwing` stays within 18 degrees for a 3 units/s velocity step and settles within 0.8 s;
  - a swell begun mid-appear still ends every orb at 0.28, and none drops back to 0 (Review Focus 2);
  - a select fires one pulse on the owning arm;
  - a six-orb hover sweep in 600 ms never doubles a pulse on one arm and never has more than three arms pulsing (Review Focus 3);
  - reduced motion: the appear lights the cups for 0.3 s, orbs are present at once, and there is no swing;
  - Nox's `blow` and Veyra's `bloom` and `armLift` fixtures are unchanged.
- [ ] **Step 2 to 4:** run (FAIL), implement, run; regression.
- [ ] **Step 5: Commit** `feat(engine): pulse appear and lift pulse (for Flux)`.

### Task 17: Orbs in Flux's stages: buttons, tooltip, tray

- **Files:** `src/worlds/flux/artifacts.ts`, `content/` (usage notes as placeholders, P4's GitHub Actions list as the model), `tests/e2e/flux.spec.ts`.
- **Tests (e2e):**
  - on `?world=flux`, after settle there are 0 `.orb-button`s in the intro;
  - after Explore, there are 12 with unique ids;
  - tabbing to one shows its tooltip, and Escape clears it;
  - the hover-intent test with a moving anchor does not flicker;
  - on the phone viewport the tray lists 12, and choosing from it lifts the arm (`aria-pressed`);
  - reduced motion shows the orbs with no swing.
- **Owner live review**, five things:
  1. the pulses run out along the arms in the intro;
  2. orbs grow at the tips as the head opens;
  3. the lift is snappy with a pulse;
  4. the face looks eager;
  5. the swing is lively but tight.

  Log; commit `feat(flux): orbs approved`.

## Milestone 7: Head swell with `pipelineRun` (G02)

### Task 18: `pipelineRun` head effect (A1 F3)

- **Files:** `src/engine/character/headEffects/pipelineRun.ts` (added to `HEAD_EFFECTS`), `pipelineRun.test.ts`, `src/worlds/flux/character.ts` (`headEffect: 'pipelineRun'`, palette `effect` colours: cyan, lavender, pink), the swell sheet in Flux's Theatre state.
- **Interface:** implements `HeadEffectModule` (contract 9.1). `pipelineRunState(swell: number): { ring: number[4]; fill: number[4]; bead: number; ripple: number; fade: number }`, with phases from spec 7.6:
  - rings appear 0 to 0.3;
  - the bead runs and the nodes fill in order 0.3 to 0.75;
  - the ripple and fade run 0.75 to 1.
- **Tests:**
  - every value is 0 at swell 0, and `fade` is 1 at swell 1;
  - node i fills before node i + 1;
  - exactly four fill peaks;
  - `dispose()` is idempotent;
  - reduced motion gives a crossfade with no bead travel;
  - no hex literal in the module;
  - Nox's `glyphs` and Veyra's `vaultDial` output is unchanged.
- **Check:** stills at `?swell=` 0.2, 0.45, 0.7, 0.9, 1. **Owner live review**, log, commit `feat(flux): pipelineRun approved`.

## Milestone 8: Pass across all stages (G02)

### Task 19: Responsive, accessibility, poster, performance and three-world regression

- **Files:** `public/flux/poster.webp`, `tests/e2e/worldSwitch.spec.ts` (extend), `docs/superpowers/evidence/flux/REPORT.md`.
- **Tests:**
  - `worldSwitch.spec.ts` gains Flux to Nox to Flux while the entrance, then the pulse appear, then the swell is running;
  - each switch resets stage, selection, timers, sequences and `pulse.times`;
  - Nox's cups show no pulse;
  - the listener count is unchanged;
  - `octoverse.nox.entranceSeen` is untouched (Review Focus 5);
  - the keyboard reaches every stage, orb and link;
  - 44 px targets at the phone viewport;
  - no-WebGL shows the poster with working links;
  - reduced motion: no LED blink and no packet motion.
- **Perf**, pane closed, back to back, twice: `WORLD=flux node scripts/perf.mjs "stage=intro&tier=low" "stage=overview&tier=low" "stage=entering&tier=low"` against 40, 36 and 32. Re-run Nox's and Veyra's numbers; at most a 3% drop.
- **Report:** `REPORT.md` holds:
  - Flux's numbers, and Nox's and Veyra's before and after;
  - the still-compare results;
  - the engine variants Flux added;
  - the gaps' outcomes;
  - the remaining weaknesses.
- **Owner approval** of Flux (G02); log; commit `feat(flux): G02 complete, three-world regression report`.

---

## Gaps found against the engine contract (to the orchestrator; not edited into the contract)

All three are accepted by the engine owner into the A2 draft (contract 19.1), pending the owner's A2 approval. The fallbacks apply only if A2 is declined.

- **X1: idle pulses through the flourish layer.** Veyra's Task 16 emits `instance.flourish.subscribe(cb)`. `Personality.flourishPulse` and the cup-pulse subscription are Flux's own work (Task 14).
  - **Fallback:** an idle schedule inside Flux's `cupPulse` module, `CupPulse.idle?: { every: readonly [number, number] }`, with `flourishRate` 2.5 for tip flicks only.
- **X2: pendant swing bounds as data.** Veyra's Task 13 builds `pendant.swing?: { maxAngle, settle }`, defaulting to 25 degrees and 1.2 s. Flux sets 18 degrees and 0.8 s (Task 16).
  - **Fallback:** Veyra's constants; tell the owner the 18-degree bound is not met.
- **X3: per-slot reveal stagger on the swell.** Veyra's Task 13 adds `pendant.reveal?: { start, span, step }`; Task 19's reader is shared by `bloom` and `pulse` (Task 16).
  - **Fallback:** all orbs grow together over swell 0.35 to 0.65.
- **Aligned:**
  - the `armLift` `pulse` flag is the select module calling the F1 trigger, inside F1;
  - "eager" is an override of the existing `focused` id (A1 G1);
  - the glyph motes are dropped unless motes already take sprites (spec 12.6).
