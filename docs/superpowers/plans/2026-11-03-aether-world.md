# Aether World (H01 + H02) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Aether, the Curious Mind, as the fourth OctoVerse world on the extracted engine. This covers her character, the gold satellite ring whose beads become arm-tip pendants, the synapse head effect, the drowned observatory and her curious motion. Nox and Veyra stay unchanged.

**Architecture:** Aether is a `WorldBundle` under `src/worlds/aether/`, with assets under `public/aether/` and `blender/aether/`. She reuses Veyra's engine variants (jelly surfaces, frill cups, `pendant` helpers, `armLift`, membrane, props, live-element table) with her own values. She adds closed variants of her own, each in one engine change with a test, reviewed by the engine owner:
- `PLACEMENTS.satellite`, `APPEARS.twinkle`, `HEAD_EFFECTS.synapse`;
- `LIVE_ELEMENTS.jellyfish`;
- `artifacts.orbStyle`;
- `Personality.idleTilt` and `StagePose.lookPoints`.

Aether never forks shared code.

**Tech Stack:** React 19, TypeScript, three 0.186.1, R3F 9, drei 10, postprocessing 3, Theatre.js 0.7.2, Vite 8, Vitest, Playwright (Edge), Python (Pillow, numpy) check tools, Blender 5.2 headless.

**Spec:** `docs/superpowers/specs/2026-11-03-aether-3d-design.md` (approved 2026-11-03; cited as "spec 7.5" and so on). Also read:
- the engine contract with amendment A1 (`docs/superpowers/specs/2026-11-03-octoverse-engine-design.md` on `claude/engine-contract-9ac935`, especially sections 9.2 and 18.2: "A1 18.2");
- the E02 plan (`docs/superpowers/plans/2026-11-03-engine-extraction.md`), whose produced names this plan uses;
- Veyra's plan (`docs/superpowers/plans/2026-11-03-veyra-world.md` on `claude/veyra-design-3b1c3c`), whose engine variants Aether reuses ("Veyra Task 13" and so on).

## Start condition

**Do not start until E02 has landed and been approved, and Veyra's engine tasks have landed.** The table says which Veyra task each Aether milestone waits on. Cut the branch from the tip that holds them: `git switch -c claude/aether-world-<suffix> <tip>`. Task 1 records every engine name as landed. Where it differs from this plan, the landed name wins.

| Aether milestone | Needs from Veyra's work |
|---|---|
| 1 (P2 gate) | Task 3 (jelly `surfaces`, `JellySettings`, sparkle), Task 4 (`SuckerStyle`), Task 5 (`resolveExpressions`) |
| 2 (world) | Task 8 (`WorldLayout.groups`, `LIVE_ELEMENTS`, `props`), Task 10 (`KIT_MATERIAL_VARIANTS.membrane`), the fish live element |
| 3 (statics) | Task 13 (`assignPendants`, `tetherCurve`, `pendantSwing`, `threadClearance`, `TetherStyle`) |
| 5 (motion) | Task 16 (`settle`, `glideBias`, `flourishRate`, `flourish.ts`), Task 17 (`EntranceShape` with `spiral: false`), Task 18's `kitDrives` |
| 6 (technologies live) | Task 19 (`armLift`, `armLiftTarget`) |

If a needed Veyra task has not landed, stop that milestone and report. Do not build Veyra's variant inside Aether's work.

## Global Constraints

- Exactly eight arms, T1 to T8. Technology count never sets anatomy; at most two orbs per arm (16 slots); the rest go to the tray.
- Physics is cancelled. Ring sway, pendant float and the flight are driven procedural curves.
- No videos. Evidence is stills, numbers and tests. The owner checks motion live at a local URL.
- No tone mapping; `flat` canvas; colours are sRGB hex in config, never in engine shaders (`boundary.test.ts`).
- `src/engine/**` imports nothing from `src/worlds/**`. Each engine change is its own commit, reviewed by the engine owner (master plan section 2).
- Nox and Veyra outputs are frozen. After every engine change:
  - the E02 baseline stills compare clean (`python scripts/still_compare.py <baseline> <current> --floor <floor.json>` exits 0);
  - Veyra's own still set compares clean the same way;
  - the six Nox e2e specs pass unmodified.
- Frame rate is measured only with the browser pane closed, back to back, at 1536 x 1024, pixel ratio 1. Budgets at tier low (spec 2.4):
  - intro at least 40 fps median;
  - overview with 15 pendants at least 36;
  - head swell at least 36;
  - entrance at least 32.

  Nox and Veyra may not drop more than 3%.
- Colour targets: the spec 2.1 tables, CIE76 delta E 10 per sample, plus the spec 2.1 global checks:
  - face-glow red at least 120 above the upper-dome red;
  - face glow R − G ≥ 25 and G ≤ 235;
  - arm body B ≥ 200 and B − R ≥ 90;
  - mid water B ≥ 60 and B − R ≥ 55.
- References: sample only from `<main checkout>/docs/design/references/Aether/native-panels/`. View and trace from the 3x panels in `Aether/`. Never take colour or detail from `Aether/regenerated/`.
- Never edit, reset or restore the main checkout. No bare `git stash`. No push. Do not merge.
- The owner approves each milestone live before the next starts. Commit per approved milestone. Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Model tiering: Opus for the 3D look (Tasks 3, 4, 6, 9, 10, 11, 12, 21 and the look steps of 5 and 20). Cheaper models for wiring, data and tests.
- No working AI feature on the site. AI Playground is content only (master plan H02).

## Review Focus

1. **Fewer technologies than beads, and more than 16.**
   - With 3 technologies, three beads each split into one orb. The other two beads fade at the flare and send nothing.
   - With 20, 16 orbs fly and 4 go to the tray. No arm ever carries a third.
   - Tests: Task 12, `dealToBeads` and `assignPendants`.
2. **Closing the head mid-flight** (swell reverses at 0.6). Orbs fly back from where they are, with no jump. Flight positions are a pure function of swell, so reversal is continuous. Test: Task 12, `flightPoint` continuity.
3. **Keyboard and pointer in the intro.**
   - No focusable orb or bead exists; the first stop after the skip link is Explore.
   - A `FOCUS_TECH` sent in the intro is ignored (`choosableIn: ['overview']`).
   - Clicking the head opens the overview.
   - Tests: Task 19, unit and e2e.
4. **Phone portrait 390 x 844.** The ring shrinks with her and still keeps out of the face; orbs go to the tray, and choosing from the tray plays the same arm lift. Tests: Task 13, `ringKeepOut` at the phone frame; Task 19, tray e2e.
5. **Reduced motion.**
   - No float, sway, tilt, wander or swim.
   - The ring is static.
   - The flight and the synapse effect become crossfades.
   - The twinkle shows the ring complete at t 0.
   - Tests: Tasks 15, 18 and 20, with `reducedMotion: true`.

## File structure (end state)

- `src/worlds/aether/bundle.ts`: `AETHER_BUNDLE: WorldBundle`.
- `src/worlds/aether/character.ts`: `AETHER: CharacterConfig` (head, arms, `surfaces`, `suckers.style`, face, `expressions`, personality, lighting, `headEffect: 'synapse'`).
- `src/worlds/aether/poses.ts`: `AETHER_POSES: Record<StageId, StagePose>`, traced from P1 to P5, with `lookPoints`.
- `src/worlds/aether/swim.ts`: `AETHER_SWIM: SwimPoseSet` (traced from P1).
- `src/worlds/aether/artifacts.ts`: `AETHER_ARTIFACTS: ArtifactConfig` (satellite ring, slots per stage, tether, `orbStyle`, `twinkle`, `armLift`, `choosableIn: ['overview']`).
- `src/worlds/aether/sequences/defaults.ts`, `sequences/state.theatre.json`: entrance, twinkle, headSwell, arrival.
- `src/worlds/aether/place/config.ts`, `place/layout.json`, `place/far.json`: `OBSERVATORY_WORLD: WorldConfig` (and `OBSERVATORY_STAGE` for milestone 1).
- `src/worlds/aether/content/`: `aetherProject.ts`, `aetherTechnologies.ts`, `placeholders.ts`.
- `src/worlds/aether/theme.ts`; `src/worlds/aether/review/{stage,world}_samples.json`, `review/targets.json`.
- `src/engine/artifacts/satellite.ts`, `satellite.test.ts`: the placement and its pure helpers.
- `src/engine/artifacts/twinkle.ts`, `twinkle.test.ts`: the appear.
- `src/engine/artifacts/orbStyle.ts`: rim beads and cap on the shared orb glass.
- `src/engine/character/headEffects/synapse.ts`, `synapse.test.ts`.
- `src/engine/world/live/Jellyfish.tsx`, `jellyfish.test.ts`.
- `src/engine/behavior/idleTilt.ts`, `lookPoints.ts` and tests.
- `blender/aether/build_kit.py`, `bake_world.py`, `render_far.py`, `empty_kit.py`; `public/aether/world/*`, `public/aether/ref/*`, `public/aether/poster.webp`.
- `docs/superpowers/reviews/aether.md`: the owner's review log.
- `docs/superpowers/evidence/aether/`: still sets and the three-world report.

---

## Milestone 1: Aether on the P2 stage (the gate, H01)

### Task 1: Re-read the engine and set up Aether's reference checks

**Files:**
- Create: `src/worlds/aether/review/stage_samples.json`, `review/world_samples.json`, `review/targets.json`, `public/aether/ref/p1.png` … `p5.png`, `public/aether/ref/p2-mask.png`, `docs/superpowers/reviews/aether.md`
- Test: `src/worlds/aether/review/targets.test.ts`

**Interfaces:**
- Consumes: `check_stage.py --world-id <id>` (reads `src/worlds/<id>/review/{stage,world}_samples.json`), `silhouette.py` (E02 Task 11).
- Produces: `targets.json` = `{ samples: { name, panel, x, y, size, rgb }[], deltaE: 10, checks: { warmCore: 120, pinkNotWhite: { minRminusG: 25, maxG: 235 }, periwinkle: { minB: 200, minBminusR: 90 }, indigoWater: { minB: 60, minBminusR: 55 } }, head: { centreX: [0.03, 0.11], halfWidth: [0.69, 0.77], top: [0.14, 0.22] }, eyesY: [-0.72, -0.64], armSpan: [3.69, 3.99], ring: { centreY: [-0.33, -0.23], halfWidth: [1.15, 1.35] }, dome: { halfWidth: [1.32, 1.44] }, iou: 0.85, meanInside: { rgb, tolerance: 12, satTolerance: 0.04 } }`. `x, y` are native panel pixels (spec 2.1); `size` is 5.

- [ ] **Step 1: Engine drift check.** Run:

  `rg "export (const|type|interface|function) (WorldBundle|validateBundle|faceAnchor|HEAD_EFFECTS|PLACEMENTS|APPEARS|SELECTS|LIVE_ELEMENTS|KIT_MATERIAL_VARIANTS|WORLDS|resolveWorld|themeVars|clampCharacterConfig|resolveExpressions|choosableNow|assignPendants|tetherCurve|pendantSwing|threadClearance|armLiftTarget|layoutOrbits|orbitPoint|SurfaceLook|JellySettings|SuckerStyle|EntranceShape)" src/engine src/worlds`

  Write each name and its file under "Engine as landed" at the top of `aether.md`. A1 18.2 names the pendant helpers `assignSlots`, `tetherPath` and `tetherSwing`, while Veyra's plan names them `assignPendants`, `tetherCurve` and `pendantSwing`. Record whichever landed; this plan's names mean those.
- [ ] **Step 2: Copy the panels.** Copy the five `<main checkout>/docs/design/references/Aether/native-panels/0N - *.png` to `public/aether/ref/pN.png` (copy only). Make `p2-mask.png` with `scripts/silhouette.py` as for Veyra. The mask excludes the title, nameplate, ring and beads; check it by eye beside the crop.
- [ ] **Step 3: Write samples and targets.** Take all 23 P2 samples and the 8 P1, P3 and P4 samples from spec 2.1, each with its `panel`. Measure the mean colour inside the mask into `meanInside.rgb`.
- [ ] **Step 4: Write `targets.test.ts`:**
  - `targets.json` has 31 samples;
  - each `rgb` equals the 5 x 5 area mean of its `public/aether/ref/p{panel}.png` within 1 per channel (use the PNG helper the Nox and Veyra review tests use);
  - every sample in the `checks` block passes on the reference itself (for example face glow red 253 − upper dome red 91 ≥ 120).
- [ ] **Step 5: Run** `npx vitest run src/worlds/aether/review`; expected PASS. Run `python scripts/check_stage.py public/aether/ref/p2.png --stage intro --world-id aether`; expected delta E 0.0 on every P2 sample and exit 0.
- [ ] **Step 6: Commit** `chore(aether): reference panels, P2 mask, samples and targets`.

### Task 2: Aether's bundle on a stage backdrop

**Files:**
- Create:
  - `src/worlds/aether/bundle.ts`, `character.ts`;
  - `poses.ts`: intro traced, other stages reuse intro until milestone 3;
  - `swim.ts`: intro arms as placeholders;
  - `artifacts.ts`: placeholder `orbit` with zero shells until Task 5;
  - `sequences/defaults.ts`, `sequences/state.theatre.json`: empty state;
  - `place/config.ts` (`OBSERVATORY_STAGE`), `theme.ts`, `content/*`;
  - `blender/aether/empty_kit.py`, `public/aether/world/stage.glb`.
- Modify: `src/worlds/index.ts` (register `aether`)
- Test: `src/worlds/aether/bundle.test.ts`

**Interfaces:**
- Consumes: `WorldBundle`, `validateBundle`, `faceAnchor`, `WORLDS`, `resolveWorld`, `clampCharacterConfig`.
- Produces: `AETHER_BUNDLE` with `id: 'aether'`; `AETHER: CharacterConfig`; `AETHER_POSES.intro`.
- `OBSERVATORY_STAGE: WorldConfig`:
  - kit `stage.glb` and an empty layout;
  - water and fog fitted to P2's mid water `(5, 19, 75)` and lit upper water `(2, 36, 100)`;
  - `camera.tilt` 0.04;
  - `camera.hover: { amount: 1.0 x Nox's, pace: 0.85 x Nox's }` (spec 7.7: a touch floatier).
- `AETHER_THEME: UiTheme`:
  - lavender-violet accent, sampled from P3's View Project button at build time and recorded in the review log;
  - lavender-to-violet `buttonFrom` / `buttonTo`;
  - deep indigo surfaces;
  - cyan-lavender focus ring;
  - `titleIcon: 'ringedPlanet'`;
  - `nameplateLabel: 'The Curious Mind'`.
- Content per spec 7.10:
  - the ten P5 technologies in this order: OpenAI, Python, TypeScript, React, Next.js, PostgreSQL, Redis, Docker, AWS, Vector DB (most important first, for the upper arms);
  - every storyboard string wrapped in Nox's placeholder marker.

- [ ] **Step 1: Write failing tests in `bundle.test.ts`:**
  - `validateBundle(AETHER_BUNDLE)` does not throw;
  - `Object.keys(AETHER_POSES.intro.arms)` equals `ARM_IDS`;
  - `AETHER.head.halfWidth` is in `[0.69, 0.77]` and `AETHER.head.top` in `[0.14, 0.22]`;
  - `AETHER.head.cheeks.radius` is in `[0.04, 0.08]` (small lobes, spec 2.2);
  - `faceAnchor(AETHER_BUNDLE, 'intro').y` is within 0.05 of −0.68;
  - `resolveWorld('?world=aether').bundle.id === 'aether'` with no warning;
  - `clampCharacterConfig(AETHER)` deep-equals `AETHER`;
  - `AETHER_BUNDLE.content.technologies.length === 10`.
- [ ] **Step 2: Run** `npx vitest run src/worlds/aether`; expected FAIL.
- [ ] **Step 3: Author `character.ts`** from spec 7.1, 7.3 and 7.8:
  - **Head:** `halfWidth` 0.73, `top` 0.18, cheeks radius 0.06, `faceOrigin` so the eyes land at y −0.68 and ±0.345 apart.
  - **Personality** (spec 7.8): blink `[2.8, 6.5]`, double blink 0.25, `gazeOmega` 14, `headOmega` 2.8, sway 0.55, curl 1.25, float 0.07 / 6.8 s, breath 5.0 s, swim 0.6 / 0.24 / 0.85.
  - **Skin:** `'skin'` on both surfaces until Task 3.
  - **Intro pose:** trace P2's arms (spec 7.4) as `Point2` polylines from the 3x P2 panel, root first, with tip curls as authored points.
- [ ] **Step 4: Register** `aether` in `WORLDS`. Run the tests; expected PASS. `npm run typecheck` and `boundary.test.ts` clean.
- [ ] **Step 5: Look.** With `npx vite --port 5191 --strictPort`, capture `WORLD=aether node scripts/stage-capture.mjs intro .tmp/aether-intro.png freeze`. Beside `public/aether/ref/p2.png`, expected: an eight-armed octopus in roughly the P2 pose on indigo water. Log the path; stop vite.
- [ ] **Step 6: Regression.** Nox baseline and Veyra stills compare clean; the six Nox e2e specs pass.
- [ ] **Step 7: Commit** `feat(aether): bundle, character, intro pose and stage backdrop`.

### Task 3: Jelly surfaces, star specks and pink-white cups (Aether's values on Veyra's variants)

**Files:**
- Modify: `src/worlds/aether/character.ts`
- Test: `src/worlds/aether/character.test.ts`; `src/engine/character/skinMaterial.test.ts` (one added case)

**Interfaces:**
- Consumes: `SkinDetail.surfaces: { mantle: SurfaceLook; arms: SurfaceLook }`, `JellySettings` (`rim, rimPower, crown, crownHeight, depth, depthStrength, core, coreCenter, coreWarmth`), `sparkle`, `SuckerStyle` (`rimWidth, scallop, edge, rim, hollow, glow`) (Veyra Tasks 3 and 4).
- Produces Aether's values. Start values come from spec 2.1; Task 6 tunes them.
  - **Mantle:** `mode: 'jelly'`, rim `#ebe2fb`, crown `#91a8f7`, depth `#5b4ef3`, core `#fdd4e8` at `coreCenter` just below the mouth (y −0.95 in body space), sparkle so that at least 15 specks show on the head front.
  - **Arms:** `mode: 'jelly'`, rim `#e3d3fb` (top rim), depth `#5e8ae4`, core `#eec6fa` (underside glow), sparkle for at least 60 specks across the arms.
  - **Cups:** `scallop` 0.6, rim `#ded0f5`, hollow `#5a3f90`, edge `#eec6fa`, glow 1.0.
  - No red underside band (`glow.underside` strength 0).

- [ ] **Step 1: Failing tests.**
  - `character.test.ts`:
    - both surfaces are `'jelly'`;
    - each jelly and cup colour that has a spec 2.1 sample is within delta E 25 of it: mantle crown, depth and core; arm rim, depth and core; cup rim and hollow. This is a start-value sanity check; Task 6 meets delta E 10 on the render. The mantle rim has no sample and is judged by eye in Task 6;
    - `glow.underside` strength is 0.
  - `skinMaterial.test.ts` adds: an arm material built from `AETHER.skin.surfaces.arms` has `uJellyDepth` equal to `#5e8ae4` and `uSparkle > 0`. That shows the arms path is live for a second world.
- [ ] **Step 2: Run**; expected FAIL. **Step 3: Set the values.** If the landed `SurfaceLook` lacks something Aether needs (for example a separate arm rim), stop and raise it with the engine owner. Do not patch the shader in Aether's work.
- [ ] **Step 4: Run**; expected PASS. Capture the intro still; log it.
- [ ] **Step 5: Commit** `feat(aether): jelly mantle and arms, star specks, pink-white cups`.

### Task 4: Aether's face and expressions

**Files:**
- Modify: `src/worlds/aether/character.ts` (`face`, `palette`, `expressions`), `src/worlds/aether/poses.ts` (intro expression `gentle`)
- Test: `src/worlds/aether/face.test.ts`

**Interfaces:**
- Consumes: `resolveExpressions(config)` (E02 Task 4 / Veyra Task 5); base ids `gentle | happy | focused | attentive | curious | restful | blow`.
- Produces: `AETHER.expressions` overrides only (no new ids, A1 G1):
  - `curious` is "wonder" (spec 7.3): `{ browLift: 0.55, browTilt: 0.1, lidRest: 0, mouthCurve: 0.85, mouthOpen: 0.7, blush: 0.35 }`.
  - `gentle` is the soft closed smile: `mouthOpen: 0`.
  - `happy` is the open happy smile (P3).
- Face layout and palette:
  - violet iris, near-black top to magenta-pink bottom;
  - two catchlights;
  - `EyeLayout.lashes` two outer lashes per eye;
  - `brow.thickness` thin, brows high;
  - blush `#fab7ce`;
  - tongue `#fd878f`;
  - mouth inside `#771d49`.

- [ ] **Step 1: Failing tests:**
  - `resolveExpressions(AETHER).curious.mouthOpen === 0.7` and `.browLift === 0.55`;
  - `resolveExpressions(AETHER).focused` deep-equals the base `focused`;
  - lash count 2;
  - the face palette's tongue and mouth-inside colours are within delta E 10 of the P4 samples.
- [ ] **Step 2: Run**; FAIL. **Step 3: Author.** **Step 4: Run**; PASS.
- [ ] **Step 5: Look.** Capture `intro` and `intro&expr=curious` frozen. Compare at 3x with P2's face and P4's open mouth: lashes, catchlights, iris gradient, tongue visible. Log both.
- [ ] **Step 6: Commit** `feat(aether): face, lashes and wonder expression`.

### Task 5: Engine variant: `satellite` placement, ring form (static)

Raise this with the engine owner before starting (A1 18.2, A1).

**Files:**
- Create: `src/engine/artifacts/satellite.ts`, `satellite.test.ts`
- Modify: `src/engine/artifacts/strategies.ts` (add `satellite` to `PLACEMENTS`), the `PlacementConfig` union; `src/worlds/aether/artifacts.ts`
- Test: `satellite.test.ts`

**Interfaces:**
- Consumes: `orbitPoint`, `layoutOrbits` (Nox's orbit maths, exported per A1 build rule).
- Produces:

```ts
export interface RingStyle {
  radius: number; tilt: number; roll: number; centreY: number; // body space; tilt = pitch from facing the camera, roll = the 8° right-side lift
  beadCount: number; beadSize: number; homes: readonly number[]; // home angles (radians, 0 = toward camera), all outside the keep-out
  sway: { amplitude: number; period: readonly [number, number] }; // radians, seconds
  keepOut: number; // half-angle of the face sector, radians
  line: { color: string; width: number; constellation: string; flicker: number };
  beads: { glass: string; rim: string; lit: readonly number[] }; // indices that glow gold
}
export type PlacementConfig = /* orbit | pendant | */
  | { kind: 'satellite'; ring: RingStyle; slots: { overview: readonly PendantSlot[] }; sizes: { overview: number }; tether: TetherStyle };

export function beadAngles(t: number, ring: RingStyle, reducedMotion: boolean): number[];
export function ringPoint(angle: number, ring: RingStyle): Vec3;          // body space
export function ringLineVisible(angle: number, ring: RingStyle): number;  // 0 inside the keep-out, ramps to 1 over 10°
```

- The placement module implements the shared placement interface. Each frame it receives `{ stage, swell, dt }` (A1 9.2).
- In `intro` and `detail` it draws the ring:
  - one line batch for the ring and the constellation segments;
  - beads as instanced orb-glass spheres with no logo.
- Aether's `RingStyle` (spec 2.2, 7.5): radius 1.25, centreY −0.28 relative to the head, nearly edge-on (`tilt` ≈ 1.36 rad), `roll` 0.14 rad; five homes evenly over the rear 270° (54° apart); sway ±0.21 rad over 6 to 9 s; `keepOut` π/4; line `#d99982` at most 1.5 px at P2 size; beads glass `#93699a`, rim `#d99982`, `lit: [1, 3]`.

- [ ] **Step 1: Failing tests (`satellite.test.ts`):**
  - **`ringKeepOut`:** over t 0 to 60 s at 1/60 s steps, every `beadAngles` value lies outside ±`keepOut` of the camera direction.
  - **Ordering:** beads never change order (they never pass each other).
  - **Reduced motion:** with `reducedMotion`, `beadAngles(t)` equals `homes` for all t.
  - **Line:** `ringLineVisible(0) === 0` and `ringLineVisible(π) === 1`.
  - **Projection:** the projected ring half-width at P2's camera is in `[1.15, 1.35]`.
  - **Tables:** `Object.keys(PLACEMENTS)` includes `satellite`; Nox's orbit fixture (E02 Task 7) is unchanged.
- [ ] **Step 2: Run**; FAIL. **Step 3: Implement.** No per-frame allocation (preallocate the bead and line buffers).
- [ ] **Step 4: Run**; PASS. Nox and Veyra regression.
- [ ] **Step 5: Look.** Intro still: the ring sits at brow height, beads at the sides and behind, nothing over the eyes. Compare with P2 at 3x.
- [ ] **Step 6: Commit** `feat(engine): satellite placement, ring form (for Aether)` (engine) and `feat(aether): gold ring` (world values).

### Task 6: Look tuning to the P2 targets, budget on the backdrop, and the gate review

**Files:**
- Modify: `src/worlds/aether/character.ts`, `artifacts.ts`, `place/config.ts` (stage water only)
- Create: `docs/superpowers/evidence/aether/m1/*`

- [ ] **Step 1: Measure.** Freeze `intro` at P2's camera, then run `python scripts/check_stage.py .tmp/aether-intro.png --stage intro --world-id aether`. Record every delta E and the four global checks in `aether.md`.
- [ ] **Step 2: Tune** jelly, core, cups, face palette, halo, aura and local grade until all 23 P2 samples are within delta E 10 and the four checks pass. Head, eyes and arm span must be within the `targets.json` ranges, and mask IoU at least 0.85. Re-measure after each change; log each round as numbers, not impressions.
- [ ] **Step 3: Close-up.** Check spec 2.3 at 3x zoom, in front and three-quarter views:
  - eyes, lashes, brows, blush, smile;
  - crescent crown sheen;
  - specks counted (at least 15 on the head front, at least 60 on the arms);
  - cups as separate scallops;
  - at least four full curls;
  - ring at most 1.5 px.
- [ ] **Step 4: Budget.** Close the browser pane. Run `WORLD=aether node scripts/perf.mjs "stage=intro&tier=low"` twice back to back. Expected: median at least 40 fps on the backdrop. If it misses, apply spec 10.1's lever order only where it applies here (star-speck count, never below 2.3); otherwise report the numbers to the owner.
- [ ] **Step 5: Owner live review** of P2 against the 3x panel, with the owner looking at: the face glow (pink, not white), the arms (periwinkle), the ring placement, the eyes, and the cups. Log the verdict.
- [ ] **Step 6: Commit** `feat(aether): P2 approved` with the evidence.

---

## Milestone 2: The drowned observatory (H01)

### Task 7: Engine variants: jellyfish, and Aether's world vocabulary

Raise this with the engine owner before starting (A1 18.2, A5). Items (b) to (d) were sent on 2026-11-03 as additions; each has a fallback.

**Files:**
- Create: `src/engine/world/live/Jellyfish.tsx`, `jellyfish.test.ts`
- Modify: the `LIVE_ELEMENTS` table; and, only if accepted, the fish element (silhouette data), the prop-drive union (`'bob'`), and `src/engine/world/floors/` (`sand.ts`)
- Test: `jellyfish.test.ts`, `validateWorld.test.ts`, `floor.test.ts`

**Interfaces:**
- Produces:
  - (a) `LIVE_ELEMENTS.jellyfish`:

    ```ts
    { count: Record<Tier, number>; size: [number, number]; bell: string; filament: string; pulse: [number, number]; drift: number; region: Box3 }
    jellyPulse(t: number, phase: number, period: number): { bellScale: number; rise: number }
    ```

    The bell is instanced, with vertex-shader pulse and filament wave, one draw for bells and one for filaments.
  - (b) If accepted, the fish element takes `silhouette: 'fish' | 'ray'`. Fallback: Aether uses the landed fish shape.
  - (c) If accepted, prop drive `'bob'`: `{ amplitude, period }` vertical sine. Fallback: the rubble is static.
  - (d) If `'sand'` has not landed, `floor.material: 'sand'` (dark rock-sand with light pools from the baked lightmap). Fallback: `'moss'` with Aether's palette and moss tint 0.
- [ ] **Step 1: Failing tests:**
  - `jellyPulse` is periodic in `period`, and `bellScale` stays within `[0.85, 1.1]`;
  - with `reducedMotion`, `rise` is 0;
  - a config with a `jellyfish` element validates, and one with `count.low > count.high` fails with the field name;
  - for each accepted item, its validation case.
- [ ] **Step 2: Run**; FAIL. **Step 3: Implement.** **Step 4: Run**; Nox and Veyra regression (e2e `world`, `worldMotion`, `worldTiers`).
- [ ] **Step 5: Commit** `feat(engine): jellyfish live element (for Aether)`, plus one commit per accepted item.

### Task 8: The observatory kit (Blender, headless)

**Files:**
- Create: `blender/aether/build_kit.py`, `src/worlds/aether/place/layout.json`, `public/aether/world/kit.glb`

**Interfaces:**
- Produces kit pieces (named nodes):
  - `portal_arch`, `portal_steps`, `portal_membrane` (oval), `portal_glyph` (brain, separate node), `portal_lanterns`;
  - `tower_a` to `tower_d` with window emissive faces;
  - `wall_*`, `rubble_float_*`, `rock_*`, `coral_fan_*` (magenta), `coral_amber_*`.
- `layout.json` (groups, A1 / Veyra Task 8):
  - towers frame both sides of the intro frame;
  - `portal` right and back on the entrance path, outside the intro frame (spec 7.7);
  - the path runs from the left distance to the portal;
  - floating rubble sits in the mid water;
  - foreground rocks and coral.

- [ ] **Step 1:** Write `build_kit.py` in the style of `blender/security/` and `blender/vault/`, reading `layout.json`. Run `blender -b -P blender/aether/build_kit.py`; expected: `kit.glb` written, node names as above, triangle count logged.
- [ ] **Step 2:** `validateWorld` passes with the kit: every `props` node exists (`portal_glyph` on the `'emissive'` drive, and the rubble on `'bob'` if accepted).
- [ ] **Step 3:** A clearance unit test (`src/worlds/aether/place/layout.test.ts`): the intro frame contains no `portal_*` node's bounds, and the tower groups lie outside the arm-span box (spec 2.2, 3.84 + 0.3 margin).
- [ ] **Step 4: Commit** `feat(aether): observatory kit and layout`.

### Task 9: Bake, far plate, membrane, glyph and world light

**Files:**
- Create: `blender/aether/bake_world.py`, `blender/aether/render_far.py`, `public/aether/world/near.glb`, `public/aether/world/far/*.webp`, `src/worlds/aether/place/far.json`
- Modify: `src/worlds/aether/place/config.ts` (`OBSERVATORY_WORLD`)

**Interfaces:**
- Consumes: `KIT_MATERIAL_VARIANTS.membrane` with `{ color, edge, flowSpeed, flowScale, flash }` (Veyra Task 10), assigned to `portal_membrane` in `place.materials`.
- Produces `OBSERVATORY_WORLD`:
  - **Membrane:** color `#0f38a7`, edge cyan.
  - **Bakes:** amber window and lantern spill, cyan portal spill, magenta coral glow.
  - **Rays:** cool blue-white from the upper right.
  - **Water:** fog fitted to P1 and P2 water samples.
  - **Live elements:**
    - jellyfish: tiers high 10, medium 7, low 4;
    - star motes: blue-white, twinkling;
    - bubbles;
    - fish: tier low 0;
    - membrane flow;
    - glyph pulse every 6 to 9 s.
  - **Post:** bloom tuned so the face glow keeps G ≤ 235.
  - **No lava, no red light:** a test asserts that no light or palette colour has hue in [−20°, 20°] with saturation above 0.5.
- [ ] **Steps:**
  - run the bake and far-plate scripts;
  - `validateWorld` passes;
  - the hue test passes;
  - capture the P1 framing (`stage=entering&t=3.2&freeze`) and check the membrane and P1 water samples within delta E 10;
  - commit `feat(aether): bake, far plate, membrane and world light`.

### Task 10: Aether in her world: colour kept, relic intensity, budget, review

- [ ] **Step 1:** Re-run Task 6 Step 1 in the world (`--world` mode): all P2 samples within delta E 10 and the global checks pass. The water samples (just outside the head, mid, upper) and the jellyfish and ruin-window samples now count too.
- [ ] **Step 2: Relic intensity:**
  - in the entrance still at t 3.2, the portal's brightest pixel luminance is below the face glow's;
  - in the intro frame, no portal pixel is visible (mask test on the frozen intro).
- [ ] **Step 3: Budget.** Pane closed, twice: `WORLD=aether node scripts/perf.mjs "stage=intro&tier=low"`. At least 40 fps median; otherwise apply spec 10.1 levers in order, then report.
- [ ] **Step 4: Owner live review** of the world:
  - depth and indigo;
  - jellyfish not competing with her;
  - warm windows;
  - the ring reads against the water;
  - the portal off-frame in the intro.

  Log and commit `feat(aether): observatory approved`.

---

## Milestone 3: Static P3, P4 and P5 (H01)

### Task 11: Overview pose and dome

**Files:** `src/worlds/aether/poses.ts` (overview traced from P3), `character.ts` (dome look)

- [ ] **Steps:**
  - Trace the P3 horseshoe arms. Dome half-width 1.38 ± 0.06, top at P3 y 105 ± 6, face at the dome bottom with `happy`.
  - Tests: `AETHER_POSES.overview` has eight arms; `faceAnchor(AETHER_BUNDLE, 'overview')` lies inside the dome's lower fifth.
  - Look: freeze `overview` (`swell=1`) and check P3's three dome samples within delta E 10.
  - Commit `feat(aether): overview pose and dome`.

### Task 12: Engine variant: `satellite` active form, the flight, and `orbStyle`

Raise this with the engine owner before starting (A1 18.2, A1 and A11).

**Files:**
- Modify: `src/engine/artifacts/satellite.ts`, `satellite.test.ts`; `src/engine/types/` (`ArtifactConfig.orbStyle?`)
- Create: `src/engine/artifacts/orbStyle.ts`, `orbStyle.test.ts`
- Modify: `src/worlds/aether/artifacts.ts` (overview slots, tether, orb style)

**Interfaces:**
- Consumes: `assignPendants`, `tetherCurve`, `pendantSwing`, `threadClearance`, `TetherStyle` (Veyra Task 13).
- Produces:

```ts
/** Which bead each placed technology leaves from: placed technologies in slot order, dealt round-robin over the beads. */
export function dealToBeads(placedCount: number, beadCount: number): number[]; // index = placed technology, value = bead
/** Position of one orb during the flight, a pure function of swell (0 ring, 1 slot). */
export function flightPoint(from: Vec3, to: Vec3, swell: number, index: number, count: number): { p: Vec3; scale: number; logo: number; trail: number };
export interface OrbStyle { rimBeads: number; rimColour: string; cap: { colour: string; size: number } | null }
```

- **Flight timing** (spec 7.5):
  - beads brighten over swell 0 to 0.2;
  - flare and split over 0.2 to 0.35;
  - each orb travels inside 0.35 to 0.9, its start staggered by slot order (upper arms first), on an arc bowed outward and up;
  - `logo` ramps in on arrival;
  - threads settle over 0.9 to 1.
- **Float:** `pendantSwing` with Aether's limits (at most 15°, settles within 1.4 s), plus a bob of 0.03 units over 3 to 5 s per orb, out of phase.
- **`orbStyle` absent** reproduces today's orb glass exactly.
- **Aether's values:**
  - `orbStyle`: `{ rimBeads: 16, rimColour: '#e4d9f8', cap: { colour: '#d99982', size: 0.05 } }`;
  - `tether`: length 0.16, gold, sag 0.2;
  - 16 overview slots in the P3 horseshoe, two per arm (tip and mid), `order` 0 on T1 and T8 tips;
  - `sizes.overview` 0.6.

- [ ] **Step 1: Failing tests:**
  - `dealToBeads(15, 5)` gives each bead 3;
  - `dealToBeads(10, 5)` gives each bead 2;
  - `dealToBeads(3, 5)` uses beads 0 to 2 once each and beads 3 and 4 not at all (Review Focus 1);
  - `assignPendants(20, AETHER slots)` places 16 and trays 4, with no arm over 2;
  - `flightPoint` at swell 0 equals `from` and at 1 equals `to`;
  - **continuity (Review Focus 2):** for swell s in 0 to 1 at 0.01 steps, `|p(s + 0.01) − p(s)|` < 0.15;
  - order: orb `index` 0 arrives before orb `count − 1`;
  - with `reducedMotion`, the flight is a crossfade: position is `from` for swell < 0.5 and `to` after, with a scale dip, and no positions between;
  - `threadClearance(AETHER_POSES.overview, slots, face) > 0.05`;
  - `orbStyle.test.ts`: no style gives a material identical to today's (uniform snapshot); 16 rim beads give 16 bead instances per orb.
- [ ] **Step 2: Run**; FAIL. **Step 3: Implement.** The flight trail is a fixed pool of segments; orb positions are written to the instance's `bubbleLive`, so buttons and the tooltip follow.
- [ ] **Step 4: Run**; PASS. Nox and Veyra regression.
- [ ] **Step 5: Look.** Stills at `?swell=` 0.1, 0.3, 0.6 and 1: beads flaring, orbs mid-arc, orbs landed on the horseshoe. Compare `swell=1` with P3: 10 orbs on the upper slots, no orb over the face or the panel.
- [ ] **Step 6: Commit** `feat(engine): satellite flight and orb style (for Aether)` and `feat(aether): overview orbs`.

### Task 13: Tech-focus and detail statics, responsive

- [ ] **Tech focus:** trace P4. The owning arm lifted, its tip curled over the orb (authored pose points), face `curious`. Freeze `techFocus&tech=openai`. Check the P4 tongue, mouth-inside and focused-rim samples within delta E 10.
- [ ] **Detail:** trace P5. Aether at the left edge, three-quarter right, ring back round her head (`satellite` rest form in `detail`), face `attentive`. Panel sections in the spec 7.10 order, including Experiments.
- [ ] **Phone (Review Focus 4):** a `ringKeepOut` test at the 390 x 844 frame; no bead or orb overlaps the face rect, title or nameplate in any frozen stage at that frame. Tray shows the technologies.
- [ ] **Commit** `feat(aether): tech focus, detail and responsive statics`.

## Milestone 4: Back view (H01)

### Task 14: Orbit review

- [ ] Capture `yaw` 0, 45, 90, 135 and 180 for intro and overview. Check spec 2.3 "Back view": round and glassy, specks and rim continue, the ring circles behind the head. Owner review, log, commit `feat(aether): back view approved`. **H01 approval.**

---

## Milestone 5: Motion personality and the entrance (H02)

### Task 15: Engine variants: idle tilt and look points

Raise this with the engine owner before starting (A1 18.2, A12).

**Files:**
- Create: `src/engine/behavior/idleTilt.ts`, `lookPoints.ts` and tests
- Modify: `src/engine/types/` (`Personality.idleTilt?`, `StagePose.lookPoints?`), `src/engine/behavior/ambient.ts`, `attention.ts`

**Interfaces:**
- Produces:

```ts
Personality.idleTilt?: { amplitude: number; period: readonly [number, number] }   // radians; absent or amplitude 0 = none (Nox, Veyra)
StagePose.lookPoints?: readonly Point2[]                                           // the single `look` stays
idleTiltAt(t: number, tilt: { amplitude; period }, seed: number): number          // tilts, holds, returns; never faster than headOmega
pickLookPoint(t: number, points: readonly Point2[], interval: readonly [number, number], seed: number): Point2 | null
```

  Attention priority, highest first: a selected orb, then the pointer (moved within 1.5 s), then the current look point, then `look`.
- [ ] **Step 1: Failing tests:**
  - with Nox's and Veyra's configs, ambient and attention outputs equal the pre-change fixtures;
  - `idleTiltAt` stays within ±`amplitude`;
  - over 60 s with period `[5, 9]`, between 6 and 12 tilts start;
  - `pickLookPoint` changes at intervals inside `[4, 8]` s;
  - a pointer move overrides the look point for 1.5 s;
  - with `reducedMotion`, both return 0 and `null`.
- [ ] **Steps 2 to 5:** run (FAIL), implement, run with Nox and Veyra regression, commit `feat(engine): idle tilt and look points (for Aether)`.

### Task 16: Aether's personality and character moments

**Files:** `src/worlds/aether/character.ts`, `poses.ts` (look points), and a moments test `src/worlds/aether/moments.test.ts`

- [ ] **Values (spec 7.8):**
  - `settle` 0.8, `glideBias` 1.4, `flourishRate` 4.6 (reach-to-touch every 10 to 16 s, using Veyra's flourish layer with the tip uncurling at most 40%);
  - `idleTilt` `{ amplitude: 0.105, period: [5, 9] }`;
  - intro `lookPoints`: two jellyfish drift regions, the title's corner, and the visitor.
- [ ] **Spark of an idea:** the pointer within 1.2 units of her for over 1.5 s triggers `uSparkleWave` (Veyra Task 3) over 1.2 s and flickers one lit bead. Cooldown 8 s.
- [ ] **Tests:**
  - never two moments at once;
  - a spark never fires during a lift or the swell;
  - over 60 s of simulated idle, between 3 and 6 reaches start.
- [ ] **Owner live review** with five things to look at:
  1. the tilt;
  2. the gaze wander;
  3. the reach;
  4. the spark;
  5. that nothing reads as nervous.

  Log and commit `feat(aether): curious personality`.

### Task 17: The entrance with the glyph firing

**Files:** `src/worlds/aether/sequences/state.theatre.json` (entrance, arrival), `sequences/defaults.ts`, `swim.ts` (open and trail traced from P1), `poses.ts` (entering), `stage` frames (entering frame wider, turned right)

**Interfaces:**
- Consumes: `EntranceShape { turn, spiral }` (Veyra Task 17), `SequenceSet.kitDrives` (Veyra Task 18), the entrance clearance helper.
- Produces:
  - `entrance: { turn: Math.PI / 2, spiral: false }`;
  - a kit drive on `portal_glyph` (`'emissive'`): a travelling pulse at 3.2 s;
  - a head look-back toward the portal from 3.0 to 3.8 s;
  - beats per spec 7.9:
    - 0 to 1 s: glimmer in;
    - 1 to 4.2 s: 2 to 3 strokes;
    - 4.2 to 5.3 s: curve and turn about 90° with a 12° tilt;
    - 5.3 to 6.3 s: settle, then look, blink, smile;
    - 6.3 to 7.7 s: twinkle (Task 18).
- [ ] **Tests:**
  - clearance: the path clears the arch, towers and rubble with arms open and closed (`entrance.test`-style, against Aether's layout);
  - the glyph drive peaks once in `[3.0, 3.4]`;
  - the yaw path is monotonic and ends at 0;
  - the order of look, blink and smile inside 5.3 to 6.3 s;
  - skip at any t lands in the intro with the ring complete;
  - the session flag is `octoverse.aether.entranceSeen`;
  - with reduced motion she starts in the intro pose with the ring shown.
- [ ] **Look:** stills at `t` = 0.5, 2, 3.2, 4.8, 6 against P1 (t 2 and 3.2).
- [ ] **Budget:** pane closed, `WORLD=aether node scripts/perf.mjs "stage=entering&tier=low"` at least 32 fps median.
- [ ] **Owner live review;** log; commit `feat(aether): entrance approved`.

---

## Milestone 6: Technologies live (H02)

### Task 18: Engine variant: `twinkle` appear

Raise this with the engine owner before starting (A1 18.2, A2: the ring forms after the entrance settles; same trigger as blow and bloom).

**Files:**
- Create: `src/engine/artifacts/twinkle.ts`, `twinkle.test.ts`
- Modify: `strategies.ts` (`APPEARS.twinkle` with `sheet: 'twinkle'`, so `SequenceId` gains it by derivation, A1 G5); `src/worlds/aether/artifacts.ts`, `sequences/` (twinkle sheet)

**Interfaces:**
- Produces: `twinkleState(t: number, beadCount: number, reducedMotion: boolean): { line: number; beads: number[] }`. The line draws over 0 to 0.6 s; beads light in index order over 0.6 to 1.4 s. Aether: `appear: { kind: 'twinkle', duration: 1.4 }`.
- [ ] **Tests:**
  - every channel is monotonic and complete by 1.4 s;
  - bead i lights before bead i + 1;
  - with `reducedMotion`, complete at t 0;
  - `validateBundle` fails on a bundle naming `twinkle` without a `twinkle` sheet;
  - Nox's `blow` and Veyra's `bloom` fixtures are unchanged.
- [ ] **Commit** `feat(engine): twinkle appear (for Aether)`.

### Task 19: Technologies in Aether's stages: lift, buttons, tooltip, tray

**Files:** `src/worlds/aether/artifacts.ts`, `content/` (usage notes, placeholders), `tests/e2e/aether.spec.ts`

**Interfaces:**
- Consumes: `armLiftTarget` and the `armLift` select config (Veyra Task 19, A1 F5).
- Produces:
  - `select: { kind: 'armLift', liftMs: 500, overshoot: 0.8, expression: 'curious', scale: 1.3, threadShorten: 0.5 }`. A thread shortened by half brings the orb snug under the curled tip;
  - focused orb rim `#e4d9f8` and a cyan halo;
  - other orbs dim 20%;
  - `choosableIn: ['overview']`.
- [ ] **Unit tests:**
  - `choosableNow('intro', AETHER_ARTIFACTS) === false`;
  - `FOCUS_TECH` in the intro leaves the state unchanged (Review Focus 3);
  - a lift reaches its target by 500 ms, root leading the tip at 170 ms;
  - choosing a second orb releases the first.
- [ ] **E2E (`aether.spec.ts`):**
  - **Intro:** after the skip link the first focus stop is Explore, and no `.orb-button` exists in the intro; clicking the head opens the overview.
  - **Overview:** Tab reaches each orb button in slot order; Enter on one shows the tooltip with its usage notes; Escape returns.
  - **Phone (390 x 844):** the tray lists the technologies and choosing one plays the lift.
  - **Overflow:** 20 technologies (test bundle) put 4 in the tray.
- [ ] **Owner live review:** the flight, the float, the lift with the curled tip, the wonder face, the tooltip. Log; commit `feat(aether): technologies live`.

## Milestone 7: Head swell with the synapse effect (H02)

### Task 20: `synapse` head effect

Raise this with the engine owner before starting (A1 18.2, A4).

**Files:** `src/engine/character/headEffects/synapse.ts` (added to `HEAD_EFFECTS`), `synapse.test.ts`; `src/worlds/aether/character.ts` (`headEffect: 'synapse'`, effect palette: node `#c9d6ff`, line `#d99982`); the swell sheet in Aether's Theatre state.

**Interfaces:**
- Implements `HeadEffectModule` (contract 9.1). `create(dome, palette)` allocates one points draw (24 nodes) and one line draw (edges between nearest neighbours, at most 3 per node) once.
- Phases (spec 7.6):
  - nodes light over 0 to 0.3;
  - lines wire in a wave from the face upward over 0.3 to 0.65;
  - one pulse peaks in 0.65 to 0.8;
  - lines thin and nodes dissolve over 0.8 to 1.
- Closing runs at twice the speed.
- [ ] **Tests:**
  - node and line opacity are 0 at swell 0 and at swell 1;
  - exactly one pulse peak in `[0.65, 0.8]`;
  - a lower edge's wire time precedes a higher one's (the wave rises);
  - `dispose()` is idempotent;
  - no allocation in `update` (spy on `Float32Array` construction);
  - reduced motion gives a crossfade (no wave);
  - Nox's `glyphs` and Veyra's `vaultDial` fixtures are unchanged.
- [ ] **Look:** stills at `?swell=` 0.2, 0.5, 0.72, 0.9, 1 beside P3 (dome samples still within delta E 10 at 1).
- [ ] **Budget:** pane closed, a swell run at tier low at least 36 fps median (`WORLD=aether node scripts/perf.mjs "stage=overview&tier=low&swellLoop=1"`, or the swell timing option the landed perf script offers).
- [ ] **Owner live review;** log; commit `feat(aether): synapse effect approved`.

## Milestone 8: Pass across all stages (H02)

### Task 21: Responsive, accessibility, poster, performance and three-world regression

- **Files:** `public/aether/poster.webp` (the intro still), `tests/e2e/worldSwitch.spec.ts` (extend), `docs/superpowers/evidence/aether/REPORT.md`.
- **Tests:**
  - `worldSwitch.spec.ts`: Aether to Nox to Aether while the entrance, the twinkle, then the flight (swell 0.5) is running. Each switch resets the stage, selection, timers and sequences; the listener count is unchanged; neither `octoverse.nox.entranceSeen` nor `octoverse.veyra.entranceSeen` is touched.
  - Keyboard order reaches every stage, orb and link.
  - 44 px targets at the phone viewport.
  - No-WebGL shows the poster with working links.
  - Reduced motion across all stages (Review Focus 5).
- **Perf**, pane closed, back to back, twice: `WORLD=aether node scripts/perf.mjs "stage=intro&tier=low" "stage=overview&tier=low" "stage=entering&tier=low"` against 40, 36 and 32, plus the Task 20 swell run against 36. The overview run uses a 15-technology test bundle. Nox's and Veyra's own runs repeat in the same session, with at most a 3% drop.
- **Report:** `REPORT.md` holds:
  - the Aether numbers;
  - Nox's and Veyra's before and after numbers;
  - the still-compare results for both;
  - the engine variants Aether added;
  - the fallbacks taken (if any);
  - remaining weaknesses.
- **Owner approval** of the Aether experience (H02). Log; commit `feat(aether): H02 complete, three-world regression report`.
