# Engine Extraction (E02) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move Nox's shared mechanics into `src/engine/` behind the approved `WorldBundle` contract, with Nox as `src/worlds/nox/`, so a second world is data plus named variants, and so instances are isolated.

**Architecture:** Refactor inside-out and keep every step bisectable. First fix isolation and move hard-coded values into config **in place** (`src/nox3d/`), proving each step with stills and tests. Then assemble the bundle and host, then do the file moves as pure renames in their own commits, then `?world=` and tooling. Nox's rendered output never changes.

**Tech Stack:** React 19, three 0.186.1, R3F 9, drei 10, postprocessing 3, Theatre.js 0.7.2, Vite 8, Vitest 5, Playwright (Edge), Python (Pillow, numpy) for the existing check tools.

**Spec:** `docs/superpowers/specs/2026-11-03-octoverse-engine-design.md` (sections cited below as "spec 8.2" and so on). Read it first, with `2026-10-23-nox-3d-design.md` and `2026-10-26-nox-world-and-motion-design.md`.

## Acceptance criteria (the plan is done only when all hold)

1. **Rendered output is equivalent before and after.** The baseline still set (Task 1) is recaptured on the final commit and matches within the measured noise floor, for every stage and review still; `check_stage.py` colour and silhouette numbers for Nox are equal within the same tolerance.
2. **The existing Nox test suite passes.** All vitest files from `src/nox3d/**` pass in their new locations, the case count is at least the baseline count recorded in Task 1, and the six e2e specs (`detail`, `entrance`, `keyboard`, `world`, `worldMotion`, `worldTiers`) pass **unmodified**.
3. **Multiple instances keep isolated state.** The new isolation specs (Task 3) pass: two Nox instances on one page share no selection, timers, bubble positions, anchors, listeners or DOM ids; a preview instance registers no `window` listener.
4. **Boundary holds.** `src/engine/**` imports nothing from `src/worlds/**`; no hex colour literals remain in engine shader and material sources outside the logo allow-list.
5. **No slower.** `scripts/perf.mjs` on the final commit is within noise of the Task 1 baseline numbers (same machine, pane closed, back to back).
6. **Owner approves the engine foundation** (master plan E02). Veyra work (F01) does not start before that.

## Global Constraints

- Stack versions as in the header; no new runtime dependency.
- **Exactly eight arms, T1 to T8.** Technology count never sets anatomy.
- **Physics is cancelled.** Add no physics layer; withdraw nothing else.
- No tone mapping; `flat` canvas; colour pipeline unchanged.
- **No videos.** Evidence is stills, numbers and tests.
- Shared systems may use different authored geometry per character and pose; do not homogenise any Nox geometry or pose.
- **No speculative plugin systems:** variants are closed tables inside the engine (spec 9). Nothing in "deferred to F01" (spec 14.1) is added to code.
- Do not edit approved Nox values. Where a literal moves to config, the config value equals the literal.
- Never touch the main checkout; never `git stash` bare; never push; do not merge.
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Performance and any rendering measurement: pane closed, 1536 x 1024, pixel ratio 1, back to back, owner's Intel UHD laptop.
- **Start only after** Nox's final verification has landed on `feat/nox-3d`. Cut the working branch from that tip.

## Review Focus

Inputs and conditions the spec implies but the tasks' main tests would not catch; each is pinned by a named test in the task that owns it.

1. **`?world=<unknown>`** must fall back to `nox` with a console warning, not a blank page (Task 10, `resolveWorld` test).
2. **React StrictMode mount, unmount, mount** must not double-register listeners, ids or the Theatre project (`getProject` throws on a duplicate id) (Task 3 and Task 5 tests).
3. **A returning visitor's session flag** `octoverse.nox.entranceSeen` keeps its name so the entrance does not replay after the migration (Task 3 test).
4. **A legacy Nox config with none of the new fields** validates and reads defaults that reproduce today's output (Task 4 tests).
5. **Unmounting a preview while the page instance runs** leaves the page's Escape and skip handlers working and leaks no listener (Task 3 e2e).

---

## File structure (end state)

See spec 6.1 for the full tree. New files this plan creates:

- `src/engine/host/EngineInstance.tsx`, `instance.ts`: the per-instance state and context.
- `src/engine/host/WorldHost.tsx`: mounts a bundle; replaces `App.tsx`.
- `src/engine/types/bundle.ts`: `WorldBundle` and its parts.
- `src/engine/character/headEffects/index.ts`, `glyphs.ts`: `HEAD_EFFECTS`.
- `src/engine/artifacts/strategies.ts`: the `PLACEMENTS`, `APPEARS` and `SELECTS` tables (Nox's `orbit`, `blow`, `suctionHold` only).
- `src/engine/ui/theme.ts`: `UiTheme` to CSS custom properties.
- `src/worlds/nox/bundle.ts` and the Nox files moved under `src/worlds/nox/`.
- `src/worlds/index.ts`: `WORLDS: Record<WorldId, WorldBundle>`, `resolveWorld(search)`.
- `src/app/main.tsx`: reads `?world=` and mounts `WorldHost`.
- `scripts/still_compare.py`: compares two still sets within a tolerance.
- `tests/e2e/isolation.spec.ts`, `tests/e2e/worldSwitch.spec.ts`, `src/app/multi.html` + `multi.tsx` (dev-only page mounting two instances).
- `src/engine/boundary.test.ts`: import-boundary and hue-literal checks.

---

### Task 1: Re-baseline on the final Nox tip

**Files:**
- Create: `scripts/still_compare.py`
- Create: `docs/superpowers/evidence/engine-extraction/BASELINE.md` and `baseline/*.png`
- Modify: none

**Interfaces:**
- Produces: the baseline set under `docs/superpowers/evidence/engine-extraction/baseline/`, the recorded test-case count, the noise floor, and perf numbers, all in `BASELINE.md`. Every later task compares against these.

- [ ] **Step 1: Cut the branch and re-read the spec against it.** `git fetch` nothing (no push). From `feat/nox-3d`'s final tip: `git switch -c claude/engine-extraction-<suffix>`. Run `rg "from '.*(nox\.character|nox\.poses|nox\.swim|noxProject|noxTechnologies|world/security/config)'" src/nox3d -g '!*.test.*'`, `rg "window\.(add|remove)EventListener|sessionStorage|__nox|^export const [a-z]+ = new " src/nox3d -g '!*.test.*'`, and `rg "^let |^const [a-zA-Z_]+ = (new |\{)" src/nox3d -g '!*.test.*'`. Compare with spec 4.1 to 4.3. Add every new coupling or singleton as a row at the end of `BASELINE.md` under "Drift since 6009863"; the later tasks read that list.
- [ ] **Step 2: Record the test count.** Run `npx vitest run --reporter=json --outputFile=.tmp/vitest-baseline.json`; write the files, cases and pass counts into `BASELINE.md`. Run `npm run typecheck`, `npm run lint`: both must be clean before you start; if not, stop and report.
- [ ] **Step 3: Write `scripts/still_compare.py`.** CLI: `python scripts/still_compare.py <dirA> <dirB> [--floor floor.json]`. For each same-named PNG: mean absolute difference per channel (0 to 255) and the fraction of pixels differing by more than 8; prints one line per file; exit 1 if any file exceeds the tolerance in `--floor` (or, with no floor file, if its mean difference exceeds 0.5 or its pixel fraction exceeds 0.2%). Check it by running it on a directory against itself: expected exit 0.
- [ ] **Step 4: Capture the baseline set.** Start `npx vite --port 5191 --strictPort`. With `node scripts/stage-capture.mjs <stage> <out.png> [extra]` capture, into `baseline/`: `intro`, `overview`, `techFocus` (`tech=kali`), `detail`; `entering` with `t=2` and `t=4`; `intro` with `blow=0.25`, `blow=0.5`, `swell=0.4`, `hold=500&tech=kali`, `pose=swim-open`, `pose=swim-trail`, `yaw=180`, and `intro` at `VIEW=390x844`. Each also writes its `-mask.png`. Also run `node scripts/world-capture.mjs` as its header says for the panel-2 world capture, and `python scripts/check_stage.py <capture> --world --stage intro`; save its output to `baseline/check_stage.txt`.
- [ ] **Step 5: Measure the noise floor.** Capture the whole set a second time into `baseline-b/`; run `still_compare.py baseline baseline-b`; write each file's differences into `floor.json` as `max(measured * 2, 0.05)` mean difference and `max(measured * 2, 0.0005)` pixel fraction. Expected: exit 0.
- [ ] **Step 6: Perf baseline.** Close the browser pane. `node scripts/perf.mjs "stage=intro&tier=high" "stage=intro&tier=low"`; record median and slow10 in `BASELINE.md`. Run it twice back to back and record both.
- [ ] **Step 7: Commit.** `git add scripts/still_compare.py docs/superpowers/evidence/engine-extraction && git commit -m "chore(engine): baseline stills, test count and perf for the extraction"`.

---

### Task 2: Per-instance state (singletons out), in place

**Files:**
- Create: `src/nox3d/host/instance.ts`, `src/nox3d/host/EngineInstance.tsx`, `src/nox3d/host/instance.test.ts`
- Modify: `src/nox3d/artifacts/bubbleLive.ts`, `stage/liveAnchors.ts`, `world/cameraHover.ts`, `character/armChain.ts`, `world/bakedLight.ts`, `artifacts/TechBubbles.tsx`, `character/Octopus.tsx`, `ui/OrbButtons.tsx`, `ui/TechTooltip.tsx`, `App.tsx` and every file that imports `bubbleLive`, `liveAnchors`, `bubblePointer`, `RELIEF_GATE`.

**Interfaces:**
- Produces:
  - `interface InstanceState { id: string; mode: 'page' | 'preview'; bubbleLive: BubbleLive; liveAnchors: LiveAnchors; hover: { bubble: boolean }; reliefGate: { value: number } }`
  - `function createInstanceState(id: string, mode: 'page' | 'preview'): InstanceState` in `instance.ts`.
  - `const InstanceContext: React.Context<InstanceState | null>` and `function useInstance(): InstanceState` (throws a named error outside a provider) in `EngineInstance.tsx`; `function EngineInstance({ id, mode, children })` creates the state once per mount.
- `ArmChain` owns its own reach spring (no module scratch). `setReliefGate`/`RELIEF_GATE` take the gate object from the instance.

- [ ] **Step 1: Write failing tests in `instance.test.ts`.** `createInstanceState` called twice returns objects sharing no reference: assert `a.bubbleLive !== b.bubbleLive`, `a.liveAnchors !== b.liveAnchors`, `a.hover !== b.hover`, `a.reliefGate !== b.reliefGate`; writing `a.bubbleLive.resize(3)` leaves `b.bubbleLive.spots.length === 0`; two `ArmChain` instances stepped with different reach targets keep different reach spring values (add to `armChain.test.ts`: `reach on chain A does not move chain B's tip`).
- [ ] **Step 2: Run** `npx vitest run src/nox3d/host src/nox3d/character/armChain.test.ts`; expected FAIL (module missing; shared scratch moves both chains).
- [ ] **Step 3: Implement** `instance.ts` and `EngineInstance.tsx` per Interfaces. Move `reachState` from module scope into an `ArmChain` field. Delete the module singletons `bubbleLive`, `liveAnchors`, `bubblePointer`, `RELIEF_GATE`; every reader takes the object from `useInstance()` (components) or an argument (pure functions). Keep `BubbleLive` and `LiveAnchors` classes as they are. `App.tsx` wraps its tree in `<EngineInstance id="nox" mode="page">`.
- [ ] **Step 4: Run** the full vitest suite and `npm run typecheck`; expected all pass, count not below baseline.
- [ ] **Step 5: Stills.** With vite running, recapture the whole baseline set into `current/` and run `python scripts/still_compare.py baseline current --floor baseline/floor.json`; expected exit 0.
- [ ] **Step 6: Commit** `refactor(nox3d): per-instance bubbleLive, anchors, hover, relief gate`.

---

### Task 3: Scoped listeners, ids, storage, URL options, debug hooks, and the isolation specs

**Files:**
- Create: `src/app/multi.html`, `src/app/multi.tsx` (dev-only page mounting one page instance and one preview instance, or two page-less previews), `tests/e2e/isolation.spec.ts`
- Modify: `src/nox3d/App.tsx`, `behavior/useStage.ts`, `behavior/urlState.ts`, `character/Octopus.tsx`, `stage/useQuality.ts`, `ui/ProjectDetail.tsx`, `ui/OrbButtons.tsx`, `ui/TechTooltip.tsx`, `ui/OrbTray.tsx`, `ui/IntroOverlay.tsx`, `ui/OverviewPanel.tsx`, `ui/SkipEntrance.tsx`, `ui/useStageBox.ts`

**Interfaces:**
- Consumes: `useInstance()` from Task 2.
- Produces:
  - `type ReviewOptions = UrlState` unchanged in shape, but **parsed once by the host and passed as a prop**; no engine module reads `location`.
  - `entranceSeenKey(worldId: string): string` returning `octoverse.${worldId}.entranceSeen` in `useStage.ts`.
  - `useWindowListeners(mode: 'page' | 'preview', handlers)`: attaches only when `mode === 'page'`; removes on unmount.
  - Debug hooks: the instance writes `window.__octoverse = { ready, entrance }` for the page instance; for world id `nox` it also writes the legacy `window.__noxReady` and `window.__noxEntrance` exactly as today.

- [ ] **Step 1: Write failing unit tests.** In `useStage.test.ts` (new): `entranceSeenKey('nox') === 'octoverse.nox.entranceSeen'`; a second key for `'veyra'` differs. In `urlState.test.ts`: `parseUrlState` is pure (no `location` access; run it with `globalThis.location` deleted). New `listeners.test.ts`: `useWindowListeners` with `'preview'` calls `window.addEventListener` zero times (spy), with `'page'` once per type and removes on cleanup, and survives a mount, unmount, mount cycle with exactly one registration live.
- [ ] **Step 2: Write `tests/e2e/isolation.spec.ts`** against `/src/app/multi.html`: (a) two instances have no duplicate `id` attributes in the document and each `aria-controls` points inside its own root; (b) choosing a technology in instance A leaves instance B's `.orb-button[aria-pressed]` all false and B's tooltip absent; (c) key and pointer input while A is in `entering` does not skip B's entrance; (d) unmounting the preview (a button on the page) leaves the page's Escape closing its own detail and `getEventListeners`-equivalent count for `keydown` on `window` equal to before the preview mounted (assert through a `window.__listenerCount` counter the page installs by wrapping `addEventListener`, dev-only); (e) a `mode: 'preview'` instance never writes `sessionStorage` or touches `location`.
- [ ] **Step 3: Run both** (`npx vitest run ...` and `npx playwright test -c playwright.nox3d.config.ts tests/e2e/isolation.spec.ts`); expected FAIL.
- [ ] **Step 4: Implement.** Replace the module-level `url` in `App.tsx` with the parsed options passed from `main.tsx` through props; move `ENTRANCE_SHEET`, `BLOW_SHEET`, `SWELL_SHEET`, `ORDER`, `TECH`, `USAGE`, `ORBS` and the `loadSequences` kicks into the instance (created in a `useMemo`/ref keyed on the bundle inputs, with the loaders started in an effect, idempotent under StrictMode). Scope `closest('.orb-button, .tech-tooltip')` to the instance root ref. Replace fixed `TOOLTIP_ID` with `useId()`. Replace the `window` listeners listed in spec 4.3 with `useWindowListeners`. `entranceSeenKey` replaces the constant. Keep the `__nox*` hooks per Interfaces. Theatre: `loadSequences` keeps one project but its loader is parameterised in Task 5; here only make it idempotent under double mount.
- [ ] **Step 5: Run** the unit tests, then the isolation spec, then the full vitest and the six existing e2e specs unmodified; expected all pass.
- [ ] **Step 6: Stills** as in Task 2 Step 5; expected exit 0.
- [ ] **Step 7: Commit** `refactor(nox3d): scope listeners, ids and storage per instance; add isolation specs`.

---

### Task 4: Hard-coded hues and expression overrides into config

**Files:**
- Modify: `src/nox3d/config/types.ts`, `config/nox.character.ts`, `config/lighting.ts`, `config/validate.ts`, `character/glowLight.ts`, `character/Octopus.tsx`, `character/auraMaterial.ts`, `character/skinMaterial.ts`, `character/headGlyphs.ts`, `character/headGeometry.ts`, `artifacts/orbMaterial.ts`, `behavior/expressions.ts`, `behavior/poseBlend.ts`, `behavior/urlState.ts`, and their tests.
- Test: `behavior/expressions.test.ts`, `config/validate.test.ts`, `config/nox.character.test.ts`, `character/auraMaterial.test.ts`, `character/glowLight.test.ts`.

**Interfaces:**
- Produces on `CharacterConfig`: `lighting: StageLighting`; `glow.core: string`; `glow.light: { color: string; intensity: number; distance: number; decay: number }`; `glow.aura.belowStart: number`; `palette.orbFocus: string`; `palette.effect: { halo: string; stroke: string; core: string }`; `expressions?: Partial<Record<ExpressionId, Partial<ExpressionParams>>>` (amendment A1, G1) with `resolveExpressions(config: CharacterConfig): Record<ExpressionId, ExpressionParams>` in `behavior/expressions.ts`; `PoseBlender`, `Octopus` and `urlState` read the resolved table instead of the `EXPRESSIONS` constant (`PoseBlender` takes the table at construction).
- Nox values: `lighting = INTRO_LIGHTING`; `glow.core = '#ff4a2a'`; `glow.light = { color: '#ff4a30', intensity: 5, distance: 6, decay: 2 }`; `glow.aura.belowStart = 0.75`; `palette.orbFocus = '#ff2e5a'`; `palette.effect = { halo: 'rgba(255,24,44,0.5)', stroke: '#ff2c3c', core: '#ffb49c' }`.
- Absent fields read these Nox values as defaults in `clampCharacterConfig`, so a legacy config validates.

- [ ] **Step 1: Write failing tests.** `validate.test.ts`: `clampCharacterConfig` of `NOX` with `lighting`, `glow.core`, `glow.light`, `aura.belowStart`, `palette.orbFocus`, `palette.effect` deleted equals `clampCharacterConfig(NOX)` (deep equal). `glowLight.test.ts`: the light's colour comes from the config argument, not a module constant. A new `boundary` precursor test in `character/hue.test.ts`: reads the sources of `skinMaterial.ts`, `auraMaterial.ts`, `glowLight.ts`, `Octopus.tsx`, `orbMaterial.ts` and `headGlyphs.ts` with `fs`, and fails if any matches `/#[0-9a-fA-F]{6}\b|rgba\(\d/` outside comments (the logo allow-list lives in `logoTexture.ts`, not checked here).
Also in this step: `expressions.test.ts`: `resolveExpressions(NOX)` deep-equals the base `EXPRESSIONS`; a config with `expressions: { curious: { browLift: 0.5 } }` changes only `curious.browLift` and no other key or expression; `urlState` still accepts every base id.
- [ ] **Step 2: Run** `npx vitest run src/nox3d/behavior src/nox3d/config src/nox3d/character`; expected FAIL.
- [ ] **Step 3: Implement.** Add the fields and defaults; thread each from the config to its reader (replace `GLOW_LIGHT`, the `'#ff4a2a'` core glow, `RED_BELOW`, `ORB_FOCUS_COLOUR`, the glyph stroke colours, and the `INTRO_LIGHTING` default in `skinMaterial.ts` with `config.lighting`).
- [ ] **Step 4: Run** the full suite and typecheck; expected pass.
- [ ] **Step 5: Stills**; expected exit 0 (values are identical).
- [ ] **Step 6: Commit** `refactor(nox3d): move hard-coded hues and lighting into the character config; expression overrides`.

---

### Task 5: World config values and the sequence loader take data

**Files:**
- Modify: `src/nox3d/world/types.ts`, `world/security/config.ts`, `world/validateWorld.ts`, `world/WorldScene.tsx`, `world/SurfaceLight.tsx`, `post.ts`, `App.tsx`, `sequences/theatre.ts`, `sequences/keys.ts`, `sequences/entrance.ts`, `sequences/bubbleBlow.ts`, `world/cameraHover.ts` and tests.
- Test: `world/validateWorld.test.ts`, `sequences/theatre.test.ts`, `sequences/bubbleBlow.test.ts`, `sequences/entrance.test.ts`.

**Interfaces:**
- Produces:
  - `WorldConfig.skinAccent: string` (Nox: the colour of `SKIN_WARMTH`); `water.causticStrength: number` (Nox: `0.005`); `post: { contactShadow: ContactShadowSettings; bloom: {...}; vignette: {...} }` (Nox: today's `POST`); `camera: { tilt: number; hover: { amount: number; pace: number } }` (Nox hover: `{ amount: 1, pace: 1 }`; `cameraHover(t * pace, amount)`; amendment A1, G3).
  - `WorldLight.kind: string` (was a three-way union); `validateWorld` still accepts `'glyph' | 'coral' | 'lava'`.
  - `loadSequences(spec: { projectId: string; state: unknown; defaults: Record<SequenceId, SequenceDefaults> }): Promise<Sequences>`, memoised **per `projectId`**; `Sequences.sample` documented as synchronous (set position then read).
  - `blowMouth(head: HeadShape, face: FaceLayout): Vec3` replacing the module constant `BLOW_MOUTH` (computed at instance creation).
  - `type SequenceId = 'entrance' | 'headSwell' | 'arrival' | AppearSheet`, with `AppearSheet` derived from the appear table in Task 7 (`'bubbleBlow'` for Nox; amendment A1, G5); `SequenceSet = { projectId; state; defaults: Partial<Record<SequenceId, SequenceDefaults>>; entrance: EntranceShape }`.
  - `interface EntranceShape { turn: number; spiral: true }` (radians; `spiral` widens to `boolean` in F01; amendment A1, G2). Nox: `{ turn: 2 * Math.PI, spiral: true }`; the entrance yaw and arc read `turn` instead of the fixed full turn.
  - `entranceFrame` and its clearance helper take `{ swim: StrokeTiming; armHalfSpan; pillarHalf }` and the world layout as arguments, not `NOX`.

- [ ] **Step 1: Write failing tests.** `theatre.test.ts`: `loadSequences` called twice with the same `projectId` returns the same promise; with a different `projectId` it creates a second project without throwing; a StrictMode-style double call does not throw `getProject` duplicate. `bubbleBlow.test.ts`: `blowMouth(NOX.head, NOX.face)` equals the old `BLOW_MOUTH` value (hard-code the numbers from the current module). `entrance.test.ts`: existing clearance test passes with `swim` and layout passed in; a second call with a different `StrokeTiming` changes the stroke time. `validateWorld.test.ts`: the security config still validates; a light with `kind: 'portal'` validates. `entrance.test.ts` also: `entranceFrame` outputs for Nox at `t` = 0, 2, 4, 5, 5.5 and 6.5 equal fixtures hard-coded from the current implementation; an `EntranceShape` with `turn: Math.PI` ends with half the yaw. `cameraHover.test.ts`: `cameraHover(t * 1, 1)` equals today's output, and `pace: 0.5` equals `cameraHover(t * 0.5, amount)`.
- [ ] **Step 2: Run** `npx vitest run src/nox3d/world src/nox3d/sequences`; expected FAIL.
- [ ] **Step 3: Implement.** Move the literals into `security/config.ts`; read them from the world in `WorldScene`; `App.tsx` reads `place.post` instead of the global `POST` (delete `post.ts` once nothing imports it; update `post.test.ts` to test the Nox world's values). Parameterise the loader and the sequence functions as above. `keys.ts` keeps Nox's defaults but exports them as data for the bundle; its "may not import the config" comment and agreement test stay.
- [ ] **Step 4: Run** the full suite and typecheck; expected pass.
- [ ] **Step 5: Stills**; expected exit 0.
- [ ] **Step 6: Commit** `refactor(nox3d): world post, accent and caustics as data; sequence loader and entrance take data`.

---

### Task 6: Content-contract cleanup

**Files:**
- Modify: `src/nox3d/content/projectTypes.ts`, `content/validateProject.ts`, `content/noxProject.ts`, `content/content.test.ts`, `config/types.ts`
- Create: `src/nox3d/config/arms.ts`

**Interfaces:**
- Produces: `config/arms.ts` exporting `ARM_IDS`, `ArmId`, `TOTAL_ARM_COUNT`, `isArmId` (the one definition); `projectTypes.ts` and `config/types.ts` re-export from it. `STAGE_PANELS: Record<StageId, 1 | 2 | 3 | 4 | 5>` replaces `SCENE_STATES` and `SCENE_STATE_DEFINITIONS`. `Project` loses `placements`; `ArtifactPlacement`, `PosePlacementMap` and `PlacementPosition` are deleted.

- [ ] **Step 1: Update `content.test.ts` first.** Remove the placement-reference cases; add `Project has no coordinates`: `Object.keys(noxProject)` contains no `placements`, and `ARM_IDS` imported from both old paths are the same array reference (`===`); `STAGE_PANELS.intro === 2`, `STAGE_PANELS.entering === 1`, `STAGE_PANELS.detail === 5`, `STAGE_PANELS.overview === 3`, `STAGE_PANELS.techFocus === 4`.
- [ ] **Step 2: Run** `npx vitest run src/nox3d/content`; expected FAIL.
- [ ] **Step 3: Implement** per Interfaces; delete `placements: {}` from `noxProject.ts` and the placement checks from `validateProject.ts`.
- [ ] **Step 4: Run** the full suite and typecheck; expected pass. No stills needed (no rendering code), but run one `intro` capture as a smoke check.
- [ ] **Step 5: Commit** `refactor(nox3d): one ARM_IDS, no coordinates in content, StageId is the stage vocabulary`.

---

### Task 7: Head effect and artifact strategy tables (placement, appear, select)

**Files:**
- Create: `src/nox3d/character/headEffects/index.ts`, `headEffects/glyphs.ts`, `artifacts/strategies.ts`, `artifacts/strategies.test.ts`, `character/headEffects/headEffects.test.ts`
- Modify: `character/headGlyphs.ts` (becomes `headEffects/glyphs.ts`), `character/Octopus.tsx`, `artifacts/TechBubbles.tsx`, `artifacts/bubbleOrbits.ts`, `config/types.ts`

**Interfaces:**
- Produces:
  - `HEAD_EFFECTS = { none: noneEffect, glyphs: glyphsEffect } as const` and `type HeadEffectId = keyof typeof HEAD_EFFECTS` in `headEffects/index.ts`; `interface HeadEffectModule { create(dome: DomeShape, palette: Palette): HeadEffectRuntime }`; `interface HeadEffectRuntime { update(swell: number, frame: DomeFrame, clockSeconds: number): void; dispose(): void }`; `DomeFrame` is the dome placement the swell already computes (`HeadDraw`).
  - In `strategies.ts`: three tables, `PLACEMENTS = { orbit: orbitPlacement }`, `APPEARS = { blow: blowAppear }` (each entry carries `sheet: SequenceId`; `blowAppear.sheet = 'bubbleBlow'`), `SELECTS = { suctionHold: suctionSelect }`, each `as const`, with `type PlacementKind = keyof typeof PLACEMENTS`, `type AppearId = keyof typeof APPEARS`, `type SelectId = keyof typeof SELECTS`.
  - `type PlacementConfig = { kind: 'orbit'; shells: readonly Shell[]; sizes: Record<'intro' | 'overview', number>; centreY: number; halfHeight: number; squareness: number; swellPush: number }` (the union gains `pendant` in F01); `interface ArtifactConfig { placement: PlacementConfig; appear: { kind: AppearId; on: 'settle' }; select: { kind: SelectId }; choosableIn: readonly ('intro' | 'overview')[] }` (`on` admits only `'settle'` until Aether's work; `choosableIn` is amendment A1, Aether A3) (appear and select are configs so a later `kind` can carry parameters: amendment A1, F5). `NOX_ARTIFACTS: ArtifactConfig` holds today's `NOX_SHELLS`, `SIZE`, `CENTRE_Y`, `HALF_HEIGHT`, `SQUARENESS`, `SWELL_PUSH` values with `appear: { kind: 'blow', on: 'settle' }`, `select: { kind: 'suctionHold' }`, `choosableIn: ['intro', 'overview']`. `stageReducer` takes the set of stages in which `FOCUS_TECH` is accepted (`choosableIn`).
  - The blow (`sequences/bubbleBlow.ts`) and suction hold (`artifacts/suctionHold.ts`) stay shared modules; `TechBubbles` and `Octopus` call them through the tables, not by name.

- [ ] **Step 1: Write failing tests.** `headEffects.test.ts`: `Object.keys(HEAD_EFFECTS)` equals `['none','glyphs']`; the glyph module's `create(NOX.dome, NOX.palette)` returns a runtime whose `update(0.5, frame, 1)` writes without throwing and whose draw output equals the pre-change `createHeadGlyphs` output for the same inputs (reuse the existing `headGlyphs` test's fixture); `dispose()` is idempotent. `strategies.test.ts`: `layoutOrbits(count, NOX_ARTIFACTS.placement.shells, 'intro')` equals the old result (hard-code a 5-bubble fixture from the current output); `Object.keys(PLACEMENTS)`, `Object.keys(APPEARS)` and `Object.keys(SELECTS)` equal `['orbit']`, `['blow']` and `['suctionHold']`; `stageReducer.test.ts`: with `choosableIn: ['overview']`, `FOCUS_TECH` in `intro` leaves the state unchanged and in `overview` focuses; with Nox's config both focus (the existing cases unchanged). `OrbButtons` and `OrbTray` render nothing for a stage not in `choosableIn` (component-logic test on the helper that decides it, `choosableNow(stage, config)`). An artifact config naming `placement.kind: 'pendant'`, `appear: 'bloom'` or `select: 'armLift'` is a type error (`// @ts-expect-error`: they arrive in F01).
- [ ] **Step 2: Run**; expected FAIL.
- [ ] **Step 3: Implement.** Move the glyph code into the table module with colours from `palette.effect`; `Octopus` looks up `HEAD_EFFECTS[config.headEffect ?? 'none']`; `TechBubbles` reads its placement constants from the bundle's `ArtifactConfig` (passed as a prop) instead of importing `NOX_SHELLS` and `NOX.head`, and picks the appear and select behaviours from `APPEARS[config.appear.kind]` and `SELECTS[config.select.kind]`; `bubbleLive.sides` uses the face origin passed in.
- [ ] **Step 4: Run** the full suite and typecheck; expected pass.
- [ ] **Step 5: Stills** including `swell=0.4`, `blow=0.25`, `hold=500`; expected exit 0.
- [ ] **Step 6: Commit** `refactor(nox3d): head-effect and artifact-strategy tables`.

---

### Task 8: `WorldBundle`, theme tokens, and the host

**Files:**
- Create: `src/nox3d/types/bundle.ts`, `src/nox3d/bundle.nox.ts`, `src/nox3d/host/WorldHost.tsx`, `src/nox3d/ui/theme.ts`, `src/nox3d/types/bundle.test.ts`, `src/nox3d/ui/theme.test.ts`
- Modify: `App.tsx` (becomes a thin re-export of `WorldHost` for Nox until Task 10), `stage/liveAnchors.ts`, `ui/OrbButtons.tsx`, `stage/framing.ts`, `ui/*.css`, `ui/IntroOverlay.tsx`, `ui/ProjectDetail.tsx`, `ui/OverviewPanel.tsx`

**Interfaces:**
- Produces: the `WorldBundle` of spec 6.2, trimmed to what E02 builds (spec 14.1): `{ id: WorldId; character: CharacterConfig; poses: Record<StageId, StagePose>; swim: SwimPoseSet; artifacts: ArtifactConfig; sequences: SequenceSet; place: WorldConfig; stage: { frames: Record<StageId, StageFrame> }; content: { project: Project; technologies: readonly Technology[] }; theme: UiTheme }`.
  - `function validateBundle(bundle: WorldBundle): WorldBundle` (clamps the character, validates the world and project, checks `poses` has all five stages and every pose has exactly the eight `ARM_IDS` keys, throws a named error otherwise).
  - `function faceAnchor(bundle: WorldBundle, stage: 'intro' | 'overview' | 'detail'): Vec3`: derived from `bundle.character.head` and `bundle.poses[stage].body` by today's formula, so it is per character without a second authored table; the one shared function, replacing the duplicated code in `liveAnchors.ts` and `OrbButtons.tsx`.
  - `interface UiTheme { accent: string; accentHot: string; surface: string; surfaceEdge: string; buttonFrom: string; buttonTo: string; focusRing: string; titleIcon: string; nameplateLabel: string }` and `themeVars(theme: UiTheme): Record<string, string>` mapping to CSS custom properties (`--oct-accent`, ...).
  - `NOX_BUNDLE: WorldBundle` in `bundle.nox.ts`, assembled from `NOX`, `NOX_POSES`, `SWIM_POSES`/`swimShapes`, `NOX_ARTIFACTS`, the Theatre state and defaults, `SECURITY_WORLD`, `STAGE_FRAMES`, `noxProject`, `noxTechnologies`, and the Nox theme.
  - `<WorldHost bundle options mode />` mounts `EngineInstance`, canvas, overlays and effects, reading **only** the bundle and `options`.

- [ ] **Step 1: Write failing tests.** `bundle.test.ts`: `validateBundle(NOX_BUNDLE)` returns without throwing; a copy with `poses.intro.arms.T8` deleted throws a message containing `T8`; a copy with a ninth arm key throws; `faceAnchor(NOX_BUNDLE, 'intro')` equals the old `noxFaceAnchor('intro')` value (hard-code from current output) and the same for `overview` and `detail`. `theme.test.ts`: `themeVars(NOX_BUNDLE.theme)` yields every `--oct-*` key and the Nox values equal the colours currently written in `ui/*.css` (parse them from the CSS files in the test, so the theme cannot drift from the shipped styling).
- [ ] **Step 2: Run**; expected FAIL.
- [ ] **Step 3: Implement.** Build the types and `NOX_BUNDLE`; replace every direct `NOX`, `NOX_POSES`, `noxProject`, `noxTechnologies`, `SECURITY_WORLD`, `STAGE_FRAMES` import in the files listed in spec 4.1 with bundle reads (props or `useInstance()`); `WorldHost` is `App.tsx`'s body generalised. Set the theme variables on the host root and have the CSS read `var(--oct-*)` with the Nox value as the fallback.
- [ ] **Step 4: Verify the leak list is empty:** `rg "nox\.character|nox\.poses|nox\.swim|noxProject|noxTechnologies|security/config" src/nox3d -g '!*.test.*' -g '!bundle.nox.ts' -g '!**/content/**' -g '!**/poses/**' -g '!**/config/nox*'` returns only the files that define those values. Add the result to the commit message.
- [ ] **Step 5: Run** the full suite, typecheck, the six e2e specs and the isolation spec; expected pass. Stills; expected exit 0.
- [ ] **Step 6: Commit** `refactor(nox3d): WorldBundle, shared face anchor, UI theme tokens, WorldHost`.

---

### Task 9: Move the files (pure renames)

**Files:**
- Move: per spec 6.1 and the migration map (spec 11). Engine modules to `src/engine/<same subfolder>/`; Nox data to `src/worlds/nox/`: `config/nox.character.ts`, `poses/nox.poses.ts`, `poses/nox.swim.ts`, `content/nox*.ts`, `content/placeholders.ts`, `world/security/**`, `sequences/state/**`, the Nox defaults in `sequences/keys.ts`, `bundle.nox.ts`. Tests move beside their modules.
- Modify: `vitest.config.ts` (`include`), `tsconfig.nox3d.json` (`include`), `index.html` (entry), `scripts/*` that name paths, `blender/security/*.py` where they read `layout.json` (paths only), `.oxlintrc` if present.
- Create: `src/engine/boundary.test.ts`

**Interfaces:**
- Produces: the end-state tree; `src/engine/**` imports nothing from `src/worlds/**`.

- [ ] **Step 1: Write the boundary test first** (`boundary.test.ts`): walks `src/engine/**/*.{ts,tsx}` with `fs` and fails on any import specifier resolving into `src/worlds/`; walks `src/worlds/**` and fails on any import resolving into another world's directory; scans `src/engine/**` non-test sources for `/#[0-9a-fA-F]{6}\b/` and fails unless the file is `artifacts/logoTexture.ts`. Run it before moving anything: expected FAIL (the engine directory is empty or imports worlds).
- [ ] **Step 2: Move in four commits, each one pure `git mv` plus import rewrites, no logic edits**, running `npm run typecheck` and the full vitest between each: (a) `character/`, `motion/`, `behavior/`, `config/` (types and validation) to `src/engine/`; (b) `artifacts/`, `sequences/` (engine parts), `stage/`, `world/` (engine parts), `ui/`, `host/`, `types/` to `src/engine/`; (c) the Nox data files to `src/worlds/nox/`; (d) config updates (`vitest.config.ts`, `tsconfig.nox3d.json`, `index.html`, scripts, Blender script paths). Commit message each: `refactor(engine): move <group> (rename only)`.
- [ ] **Step 3: Check `git log --follow`** on three moved files (`Octopus.tsx`, `nox.poses.ts`, `headGeometry.ts`): history continues across the rename.
- [ ] **Step 4: Run** the boundary test, the full vitest (case count at least baseline), typecheck, lint, the six e2e specs and isolation; expected all pass. Stills; expected exit 0.

---

### Task 10: `?world=` host, world registry and switching

**Files:**
- Create: `src/worlds/index.ts`, `src/app/main.tsx`, `src/worlds/index.test.ts`, `tests/e2e/worldSwitch.spec.ts`
- Modify: `index.html` (entry `/src/app/main.tsx`), `src/engine/host/WorldHost.tsx`

**Interfaces:**
- Produces: `WORLDS: Record<WorldId, WorldBundle>` (only `nox`); `resolveWorld(search: string): { bundle: WorldBundle; warning?: string }`: reads `world`, falls back to `nox` with a `warning` string for an unknown id; `main.tsx` mounts `<WorldHost key={bundle.id} ...>`; `window.__octoSwitchWorld(id)` (dev only) re-renders with a new key for the switch test.

- [ ] **Step 1: Write failing tests.** `index.test.ts`: `resolveWorld('')` returns `nox` with no warning; `resolveWorld('?world=nox')` returns `nox`; `resolveWorld('?world=nope')` returns `nox` with a warning containing `nope`. `worldSwitch.spec.ts`: using a test-only bundle registered when `?testworld=1` (the Nox bundle cloned with `id: 'nox-b'`, **not shipped**, behind `import.meta.env.DEV`), start in `intro`, select a technology (stage `techFocus`), call `__octoSwitchWorld('nox-b')`, and assert: stage is `intro`, no technology selected, `window` `keydown`/`pointerdown` listener count equals the count before the switch, a new entrance clock (set `sessionStorage` to the unseen state first and assert the entrance plays for `nox-b` with its own key `octoverse.nox-b.entranceSeen`), and no console errors. Also `?world=nope` loads Nox and logs the warning.
- [ ] **Step 2: Run**; expected FAIL.
- [ ] **Step 3: Implement** per Interfaces.
- [ ] **Step 4: Run** all unit and e2e specs; expected pass. Stills; expected exit 0.
- [ ] **Step 5: Commit** `feat(engine): ?world= host, world registry, full-remount switching`.

---

### Task 11: Tooling takes a world id

**Files:**
- Modify: `scripts/check_stage.py`, `scripts/perf.mjs`, `scripts/stage-capture.mjs`, `scripts/world-capture.mjs`; move `scripts/stage_samples.json` and `world_samples.json` to `src/worlds/nox/review/` (and update the readers).

**Interfaces:**
- Produces: `check_stage.py ... --world-id <id>` (default `nox`) reading `src/worlds/<id>/review/{stage,world}_samples.json`; the existing `--world` flag keeps meaning "world scene mode". `perf.mjs`, `stage-capture.mjs`, `world-capture.mjs` accept `WORLD=<id>` in the environment, adding `world=<id>` to the query when set (default adds nothing).

- [ ] **Step 1:** Run `python scripts/check_stage.py baseline/<intro capture> --world --stage intro` (the Task 1 command) against the moved samples file path; expected: output identical to `baseline/check_stage.txt`.
- [ ] **Step 2:** Implement the option and the environment variable; run the same command with `--world-id nox`; expected identical output. Run `WORLD=nox node scripts/perf.mjs "stage=intro&tier=low"` and expect a normal result line.
- [ ] **Step 3: Commit** `chore(engine): scripts take a world id`.

---

### Task 12: Final verification and handover

**Files:**
- Create: `docs/superpowers/evidence/engine-extraction/FINAL.md`

- [ ] **Step 1:** `npx vitest run` (count at least the baseline), `npm run typecheck`, `npm run lint`, `npm run build`; all clean.
- [ ] **Step 2:** `npx playwright test -c playwright.nox3d.config.ts`: the six existing specs plus `isolation` and `worldSwitch` pass; the six are byte-identical to baseline (`git diff <baseline-commit> -- tests/e2e/{detail,entrance,keyboard,world,worldMotion,worldTiers}.spec.ts` is empty).
- [ ] **Step 3:** Recapture the full still set into `final/`; `python scripts/still_compare.py baseline final --floor baseline/floor.json` exits 0; run `check_stage.py` as in Task 1 and diff its output against `baseline/check_stage.txt`.
- [ ] **Step 4:** With the browser pane closed, run `node scripts/perf.mjs` exactly as in Task 1, twice back to back; record the numbers beside the baseline in `FINAL.md`. If either median falls by more than the baseline's own run-to-run spread, stop and report the numbers; do not tune.
- [ ] **Step 5:** Write `FINAL.md`: the commit list, the criteria with the evidence for each, the numbers, anything deferred (spec 14.1), and the drift items from Task 1 with how each was resolved.
- [ ] **Step 6: Commit** and report to the owner for the E02 approval. Do not merge; do not start F01.
