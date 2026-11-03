# Engine extraction baseline

Taken on the final Nox tip, branch `feat/nox-3d`, base commit `5045956` (docs only above the code tip `910bb11`). The baseline commit is the commit that adds this file (ruling R-E2): "unmodified" for the e2e specs means byte-identical to it. Every later task compares against what is here.

**Recaptured at Task 1b (R-E7).** The stills, `floor.json` and `check_stage.txt` in this folder are a second capture of the same commit (`a8fc1b9`, taken from a detached worktree of it), made with a gate that waits for the page to be ready instead of a fixed 4.5 s. The first capture (in git history at `a8fc1b9`) raced the world kit under load: the same code gave stills with and without the pillars, and `techFocus` differed by 3 to 26 mean from one capture to the next. Section 3 and 4 below describe the new capture; everything else (tests, lint, perf, drift rows) is unchanged and still dated at `a8fc1b9`.

Machine state: other Claude sessions were building on 5195 and 5196 the whole time, so everything below was taken "under load" (R-E3). CPU is the mean of five 1-second samples from `.superpowers/sdd/2026-11-03-nox-perf/cpu.ps1`.

## 1. Test count (vitest)

`npx vitest run --reporter=json --outputFile=.tmp/vitest-baseline.json` (the JSON stays untracked in `.tmp/`; the per-file table is below).

| Measure | Value |
|---|---|
| Test files | 73, all passed (0 failed) |
| Test cases | **442** |
| Passed | **441** |
| Skipped | 1 (`src/nox3d/config/variant.test.ts`: the "production build has no fixtures" check, which only runs on request) |
| Failed | 0 |

**Every later task must report at least 442 cases and 441 passed.** Every test lives under `src/nox3d/`. The heavy files `suckerRow` and `entrance.test` pass at this load.

| File | Cases | Passed | Not passed |
|---|---|---|---|
| src/nox3d/artifacts/bubbleOrbits.test.ts | 9 | 9 | 0 |
| src/nox3d/artifacts/logoTexture.test.ts | 5 | 5 | 0 |
| src/nox3d/artifacts/orbMaterial.test.ts | 1 | 1 | 0 |
| src/nox3d/artifacts/suctionHold.test.ts | 6 | 6 | 0 |
| src/nox3d/behavior/ambient.test.ts | 13 | 13 | 0 |
| src/nox3d/behavior/entrance.test.ts | 1 | 1 | 0 |
| src/nox3d/behavior/expressions.test.ts | 9 | 9 | 0 |
| src/nox3d/behavior/focusChoreography.test.ts | 6 | 6 | 0 |
| src/nox3d/behavior/poseBlend.test.ts | 12 | 12 | 0 |
| src/nox3d/behavior/reach.test.ts | 5 | 5 | 0 |
| src/nox3d/behavior/stageMachine.test.ts | 21 | 21 | 0 |
| src/nox3d/behavior/urlState.test.ts | 15 | 15 | 0 |
| src/nox3d/character/armChain.test.ts | 18 | 18 | 0 |
| src/nox3d/character/armTube.test.ts | 8 | 8 | 0 |
| src/nox3d/character/armWeb.test.ts | 4 | 4 | 0 |
| src/nox3d/character/auraMaterial.test.ts | 3 | 3 | 0 |
| src/nox3d/character/browShape.test.ts | 4 | 4 | 0 |
| src/nox3d/character/domeMaterial.test.ts | 3 | 3 | 0 |
| src/nox3d/character/eyeShape.test.ts | 12 | 12 | 0 |
| src/nox3d/character/faceRedraw.test.ts | 1 | 1 | 0 |
| src/nox3d/character/faceUpload.test.ts | 3 | 3 | 0 |
| src/nox3d/character/glowLight.test.ts | 7 | 7 | 0 |
| src/nox3d/character/haloMaterial.test.ts | 3 | 3 | 0 |
| src/nox3d/character/headGeometry.test.ts | 10 | 10 | 0 |
| src/nox3d/character/headMorph.test.ts | 1 | 1 | 0 |
| src/nox3d/character/localGradeMaterial.test.ts | 4 | 4 | 0 |
| src/nox3d/character/mouthShape.test.ts | 3 | 3 | 0 |
| src/nox3d/character/skinMaterial.test.ts | 6 | 6 | 0 |
| src/nox3d/character/suckerMaterial.test.ts | 3 | 3 | 0 |
| src/nox3d/character/suckerRow.test.ts | 17 | 17 | 0 |
| src/nox3d/character/worldAccent.test.ts | 9 | 9 | 0 |
| src/nox3d/config/lighting.test.ts | 3 | 3 | 0 |
| src/nox3d/config/nox.character.test.ts | 6 | 6 | 0 |
| src/nox3d/config/stage.test.ts | 1 | 1 | 0 |
| src/nox3d/config/validate.test.ts | 9 | 9 | 0 |
| src/nox3d/config/variant.test.ts | 4 | 3 | 1 |
| src/nox3d/content/content.test.ts | 3 | 3 | 0 |
| src/nox3d/motion/micro.test.ts | 3 | 3 | 0 |
| src/nox3d/motion/microTriggers.test.ts | 6 | 6 | 0 |
| src/nox3d/motion/stroke.test.ts | 8 | 8 | 0 |
| src/nox3d/motion/swimArms.test.ts | 5 | 5 | 0 |
| src/nox3d/poses/nox.poses.test.ts | 9 | 9 | 0 |
| src/nox3d/poses/nox.swim.test.ts | 3 | 3 | 0 |
| src/nox3d/post.test.ts | 2 | 2 | 0 |
| src/nox3d/review/components.test.ts | 3 | 3 | 0 |
| src/nox3d/sequences/armClearance.test.ts | 1 | 1 | 0 |
| src/nox3d/sequences/bubbleBlow.test.ts | 6 | 6 | 0 |
| src/nox3d/sequences/entrance.test.ts | 12 | 12 | 0 |
| src/nox3d/sequences/headSwell.test.ts | 6 | 6 | 0 |
| src/nox3d/sequences/theatre.test.ts | 5 | 5 | 0 |
| src/nox3d/stage/framing.test.ts | 5 | 5 | 0 |
| src/nox3d/stage/liveAnchors.test.ts | 2 | 2 | 0 |
| src/nox3d/stage/quality.test.ts | 6 | 6 | 0 |
| src/nox3d/ui/bootVeil.test.ts | 13 | 13 | 0 |
| src/nox3d/ui/detailContent.test.ts | 8 | 8 | 0 |
| src/nox3d/ui/hoverIntent.test.ts | 6 | 6 | 0 |
| src/nox3d/ui/tooltipContent.test.ts | 4 | 4 | 0 |
| src/nox3d/ui/tooltipPlacement.test.ts | 7 | 7 | 0 |
| src/nox3d/world/bakedLight.test.ts | 4 | 4 | 0 |
| src/nox3d/world/cameraHover.test.ts | 3 | 3 | 0 |
| src/nox3d/world/contactShadowEffect.test.ts | 4 | 4 | 0 |
| src/nox3d/world/farPlate.test.ts | 5 | 5 | 0 |
| src/nox3d/world/kitLoader.test.ts | 2 | 2 | 0 |
| src/nox3d/world/lensShift.test.ts | 3 | 3 | 0 |
| src/nox3d/world/liveMotion.test.ts | 3 | 3 | 0 |
| src/nox3d/world/particleMaterials.test.ts | 12 | 12 | 0 |
| src/nox3d/world/placement.test.ts | 2 | 2 | 0 |
| src/nox3d/world/textures.test.ts | 1 | 1 | 0 |
| src/nox3d/world/useDisposables.test.ts | 5 | 5 | 0 |
| src/nox3d/world/validateWorld.test.ts | 19 | 19 | 0 |
| src/nox3d/world/worldLevel.test.ts | 3 | 3 | 0 |
| src/nox3d/world/worldTiers.test.ts | 5 | 5 | 0 |
| src/nox3d/world/worldTime.test.ts | 3 | 3 | 0 |

## 2. Typecheck and lint

- `npm run typecheck` (`tsc -p tsconfig.nox3d.json --noEmit`): clean, exit 0.
- `npm run lint` (`oxlint`): **not clean, exit 1, before any change.** 52 warning lines and 1 error.
  - The error: `<unknown>: error: Failed to open file ...\src\nox3d\world\validateWorld.test.ts with error "stream did not contain valid UTF-8"`. The file holds one Windows-1252 byte (0x92, a curly apostrophe in "relief maps' scale", offset 11754) in a test title. It predates this work (last touched in f684647). Not changed here: it is outside this task's scope and the controller rules on it.
  - Warnings by rule: react(immutability) 27, react(only-export-components) 8, react(refs) 7, react-hooks(exhaustive-deps) 4, react(set-state-in-effect) 3, react(purity) 2, oxc(erasing-op) 1.
  - Warnings by file: `character/Octopus.tsx` 12, `App.tsx` 7, `world/Water.tsx` 6, `world/Kit.tsx` 6, `ui/OrbButtons.tsx` 4, `artifacts/TechBubbles.tsx` 3, `world/SurfaceLight.tsx` 2, `review/main.tsx` 2, one each in `world/WorldScene.tsx`, `world/Particles.tsx`, `world/Motes.tsx`, `world/Floor.tsx`, `ui/useStageBox.ts`, `ui/OverviewPanel.tsx`, `config/stage.test.ts`, and three old `src/components/` files (`telemetry/LiveTelemetryPill.tsx`, `octopus/useIdleTimer.ts`, `octopus/TentacleSystem.tsx`).
  - Later tasks must not add to these counts (52 warning lines, 1 error); a file move changes the path, not the rule count.

## 3. Still set

Command, from the worktree root, with the dev server on :5191 and no browser pane open:

```
bash docs/superpowers/evidence/engine-extraction/capture-set.sh <outdir>
```

`capture-set.sh` runs `scripts/stage-capture.mjs`, `scripts/world-capture.mjs` and `check_stage.py` exactly as listed below. Compare with:

```
python scripts/still_compare.py docs/superpowers/evidence/engine-extraction/baseline <outdir> --floor docs/superpowers/evidence/engine-extraction/floor.json --boxes docs/superpowers/evidence/engine-extraction/face-boxes.json
```

How a capture waits (Task 1b): `scripts/stage-capture.mjs` and `scripts/world-capture.mjs` call `waitForReady` in `scripts/capture-ready.mjs`, which waits for `window.__noxReady === true` (set 40 frames after the world's kit and the far plate are in; confirmed set under `?freeze` and `?stage=entering&t=..`), then for the Theatre sequence sheet (`loadSequences()`, which `__noxReady` does not wait for: the entrance, blow and swell stills need it), then a fixed 700 ms settle. Timeout 120 s; a timeout throws and the script exits non-zero. A `?mask` page mounts no `ReadyFlag`, so it waits for the canvas, the sheet and 40 drawn page frames instead. Viewport, scale and query are unchanged. A capture takes about 8 s a page instead of 4.5 s.

Exit 0 is the gate. Each still has its `-mask.png` (white silhouette); the masks are exact geometry and measure a difference of 0 between captures.

| File | Command (`node scripts/stage-capture.mjs <stage> <out> [extra]`) | Size |
|---|---|---|
| `intro.png` | `intro` | 1012x1008 |
| `overview.png` | `overview` | 1012x1008 |
| `techFocus.png` | `techFocus tech=kali` | 1012x1008 |
| `detail.png` | `detail` | 1672x941 |
| `entering-t2.png` | `entering t=2` | 1012x1008 |
| `entering-t4.png` | `entering t=4` | 1012x1008 |
| `intro-blow025.png` | `intro blow=0.25` | 1012x1008 |
| `intro-blow05.png` | `intro blow=0.5` | 1012x1008 |
| `intro-swell04.png` | `intro swell=0.4` | 1012x1008 |
| `intro-hold500-kali.png` | `intro "hold=500&tech=kali"` | 1012x1008 |
| `intro-swim-open.png` | `intro pose=swim-open` | 1012x1008 |
| `intro-swim-trail.png` | `intro pose=swim-trail` | 1012x1008 |
| `intro-yaw180.png` | `intro yaw=180` | 1012x1008 |
| `intro-390x844.png` | `VIEW=390x844 node scripts/stage-capture.mjs intro <out>` | 390x844 |
| `world-intro.png` | `node scripts/world-capture.mjs intro <out> tier=high` (panel-2 world frame) | 1536x1024 |

All fifteen were looked at on a contact sheet: every one shows the loaded scene (no loading veil, no blank frame). Stills use the default quality tier except `world-intro` (`tier=high`, as the script's header gives it).

### Face box

Fixed pixel regions, 240 x 200 = 48000 px (the size the perf work compared), in `face-boxes.json`. `still_compare.py --boxes` prints a second line per box with the mean, the fraction over 8 and the maximum difference:

- `intro`, `intro-blow025`, `intro-blow05`, `intro-swell04`, `intro-hold500-kali`: x 396 to 636, y 560 to 760 (eyes, cheeks and mouth).
- `overview`, `techFocus`: x 402 to 642, y 489 to 689 (shifted by the overview body offset, +6 and -71 px).
- The swim, yaw, entering, detail and phone stills have no box: the face moves too much between them.

### check_stage

`python scripts/check_stage.py baseline/world-intro.png --world --stage intro`, output saved byte for byte (CRLF, as Windows prints it) in `baseline/check_stage.txt`. It exits 1 by design (R46, R58, R66): 6 misses. It reads front-view **(128, 36, 80), saturation 0.779, brightness 0.568**, as the common rules state. Later tasks diff their output against this file (ignore line endings if a shell converts them). Across three captures of this one build only one hex digit of one sample moved (`head middle` capture `#171237` or `#181237`, deltaE 7.7 both ways), so allow that much drift.

## 4. Noise floor

Three captures of the same build (`a8fc1b9`) on the ready-waiting gate, taken one after another under load (CPU 12 to 20% from other sessions): `baseline/`, then `baseline-b` and `baseline-c` (untracked, `.tmp/`). Mean absolute difference (0 to 255) and fraction of pixels over 8 between two captures:

- Masks: 0 (identical), except one `techFocus` mask pair (mean 0.003).
- Whole stills: mean 0.010 to 0.19, fraction 0.05% to 0.54%. Every pair of the three lands in the same band (the largest are `world-intro` 0.54%, `detail` 0.38%, `entering-t2` 0.32%, `techFocus` 0.31%; `overview` is 0.05%). The old gate had two noise levels and, worse, races: `intro` and `overview` 9.8 and 6.5 mean (kit drawn or not), `techFocus` 3 to 26.
- Face box: mean 0.0002 to 0.0033, fraction 0, maximum 1, except `techFocus` (a bubble in the box): mean 0.012 to 0.030, fraction up to 0.035%.

What is left is not random: it is one cause. `Embers` (`src/nox3d/world/Particles.tsx`, `useFrame`) sets `uTime` from the real clock (`state.clock.elapsedTime`), not from the world's clock, so the embers sit at a different point of their drift in every capture even under `?freeze`; the bubbles and everything else in the world use `worldTime`. Checked on a scratch copy of the baseline source (not committed): with that one line pinned to a constant, two `intro` captures are bit-identical (mean 0, 0 pixels, max 0). The diff pixels cluster on the lower third (the seabed, where the low embers are). The app was not changed (Task 1b may not edit `src/`); the fix is one line, `uTime` from the `time` prop the way `Bubbles` does it, and would make every still repeatable exactly. Until then the floor below carries it.

`floor.json` holds, per file (and per face box), `max(measured * 2, 0.05)` mean and `max(measured * 2, 0.0005)` fraction, where `measured` is the largest difference over the three pairs (`still_compare.py --make-floor baseline baseline-b baseline-c --boxes face-boxes.json`). Largest whole-still entries: `world-intro` frac 1.07%, `detail` 0.77%, `entering-t2` 0.64%, `techFocus` 0.63%; mean up to 0.38 (`world-intro`).

Ruling kept from Task 1: the worst of three captures, not one pair (the formula is unchanged). Result: `baseline` against each of `baseline-b`, `baseline-c` and the pair b against c passes the floor, and the verification below (two captures of the Task 2 tip) passes it.

Verification (Task 1b): two captures of the Task 2 tip (`bc3a646`, per-instance state) against this baseline, `still_compare.py baseline <set> --floor floor.json --boxes face-boxes.json`: both exit 0 (`PASS`), no retries, no swapped stills. Whole-still mean 0.0007 to 0.19, fraction 0.002% to 0.54%; face boxes within the floor; `check_stage.txt` identical but for the one hex digit named in section 3 (`#171237` or `#181237`). Three captures of this one build, taken before the baseline was cut (`.tmp/det-1..3`, same code as the verification), differ at the same level (mean 0.005 to 0.18, fraction 0.02% to 0.52%).

## 5. Perf (under load)

`node scripts/perf.mjs "stage=intro&tier=high" "stage=intro&tier=low"` (1536x1024, pixel ratio 1, headless Edge, 6 s each), dev server on :5191 with `vite.perf.config.ts`, browser pane never opened. CPU = `cpu.ps1` before and after the run.

| Run | CPU before / after | intro high median / slow10 | intro low median / slow10 |
|---|---|---|---|
| 1 | 14.5% / 17.3% | 18.2 / 13.0 fps | 38.2 / 27.2 fps |
| 2 | 31.0% / 29.3% | 15.3 / 12.3 fps | 37.6 / 26.7 fps |
| 3 | 28.8% / 22.6% | 15.2 / 11.5 fps | 39.7 / 28.0 fps |

These are lower than the quiet-machine numbers of the perf work (about 23 at high, 48 to 55 at low): other sessions were building. Run-to-run spread under this load: high 15.2 to 18.2, low 37.6 to 39.7. Later tasks compare interleaved against this commit rather than against these numbers (R-E3), and treat a median drop as a finding only when it exceeds this spread and survives a rerun alone.

## 6. Reference state

- The six e2e specs, blob ids at this commit (`git diff <this commit> -- tests/e2e/<spec>` must stay empty): detail `72236c1f`, entrance `d5042b92`, keyboard `992b5b87`, world `56a09452`, worldMotion `15216d7b`, worldTiers `44f019d8`. Three more specs exist (`cameraDrift`, `fallback`, `responsive`), added by Job 1 and the lanes.
- Dev server for stills and perf: `npx vite --config vite.perf.config.ts --port 5191 --strictPort`. The Task 1b baseline was captured from a detached worktree of `a8fc1b9` on a second port (5189; 5199 was in use by another session).

## Drift since 6009863

Found by the three `rg` scans of Step 1 (run with the Grep tool, `rg` is not installed here) and by diffing the same patterns between 6009863 and this tip with `git grep`, against spec 4.1 to 4.3. The spec's lists still hold; these are the additions. Later tasks read this list.

| Row | Where | What | Introduced by | Concerns |
|---|---|---|---|---|
| D1 | `ui/bootVeil.ts` | Module state `released`, `drawn`, `waiting`, `failsafe`; fixed DOM id `BOOT_VEIL_ID = 'boot-veil'` read with `getElementById` on the page's `document`. One boot veil per page: a second instance or a preview would share it. | 363cbca (Job 1, readable first frame) | T3 (instance state) |
| D2 | `ui/useViewport.ts` | Module cache `last: Viewport \| null` and a `window` `resize` listener. | a2c0207 (lane, phone and accessibility) | T3 (listeners), T8 (host) |
| D3 | `motion/micro.ts` | Module `settlePeaks = new Map<number, number>()`, a pure memo keyed by cycle count (no instance data): safe to share, must be stated. | 2667582 (micro-animations) | T3 (state list) |
| D4 | `App.tsx` | New dev-only `window.__noxCamera` (read by `tests/e2e/cameraDrift.spec.ts`) and `window.__noxWorldTier` (read by `tests/e2e/responsive.spec.ts`), beside `__noxReady` and `__noxEntrance`. `__noxReady` is now set in the wait for the far plate's layers, still one window global. `__noxSwell`, `__noxHold` (Octopus.tsx) and `__noxSetTier` (useQuality.ts) already existed at 6009863 but are not in spec 4.3's list. | the lanes, Job 1 | T3 (globals the e2e specs read must stay) |
| D5 | `ui/SkipLink.tsx`, `ui/ProjectDetail.tsx` | Fixed DOM id `project-details` (link `href="#project-details"` and the panel's `id`): a second instance duplicates the id. | a2c0207 | T3 (DOM ids) |
| D6 | `character/Octopus.tsx` | `webglcontextrestored` listener on `gl.domElement`: scoped by its element, not `window`. The `window` and `documentElement` listeners spec 4.3 names are unchanged. | 2199365 (Job 1) | none |
| D7 | `config/fixtures/dummy.character.ts`, `world/fixtures/dummy.world.ts` | Test fixtures. The character fixture imports `NOX` (a new direct Nox import, test only); the world fixture has module consts `palette` and `layout`. A test checks the production build leaves them out. | 2dee4eb, 163f1f0 | T5, T8 |
| D8 | `world/drawOrder.ts` | Constants `WATER_SKY_ORDER`, `SEABED_ORDER`: shared draw-order numbers, not state; the draw-order e2e check in `worldTiers.spec.ts` reads them. | 5b1266f (Job 1) | T9 (moves with world/) |
| D9 | `character/FaceCanvas.ts` | The face texture uploads through an RGBA8 staging texture and a one-draw decode (no CPU readback); no new module state. `FACE_RECT` (a module `Vector4`) is unchanged. | c39e213 (Job 1) | T4's hue test must not trip on it |
| D10 | whole `src/nox3d` | Direct Nox imports from scan 1: `App.tsx` (NOX, noxProject, NOX_POSES, SWIM_POSES/swimShapes, noxTechnologies, SECURITY_WORLD), `artifacts/TechBubbles.tsx`, `sequences/bubbleBlow.ts`, `sequences/entrance.ts`, `stage/liveAnchors.ts`, `ui/OrbButtons.tsx`, `character/Octopus.tsx`, plus the poses and content files. All are in spec 4.1; the only new one is the test fixture (D7). `OrbButtons.tsx` still duplicates the face-anchor maths. | none new | as the spec |
| D11 | module state in scan 3 not in spec 4.3 | Constants and scratch (`HOLD_CENTRE`, `PUFF`, `ROUND_MOUTH`, `OVERVIEW_BODY`, `SIZE`, `INTRO_TITLE`, `SKIN_WARMTH`, `SHAFT_TOP`, `PILLAR_HALF`, `tmp*` vectors in suckerRow, armWeb, anchors) are immutable or pure scratch. Memos of pure results: `spotCache` (OrbButtons), `settledCache` (poseBlend, WeakMap), `ends` (bubbleBlow, WeakMap), `leadTable` (entrance), `built` (nox.swim), `holders` and `releases` (kitLoader, WeakMap by renderer), `pending` (useDisposables, WeakMap). The spec's rows (`reachState`, `bubbleLive`, `liveAnchors`, `RELIEF_GATE`, `bubblePointer`, theatre `loading`) are unchanged. | none new | T2, T3 as the spec |

No row changes the plan's task list; D1, D2, D4 and D5 add to Task 3's list (instance-scoped state, listeners, ids).
