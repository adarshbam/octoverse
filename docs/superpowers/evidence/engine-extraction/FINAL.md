# Engine extraction (E02): final verification

Branch `feat/nox-3d`, head `a816d72` (the code is unchanged by this task; only docs are added above it). Plan `docs/superpowers/plans/2026-11-03-engine-extraction.md`, spec `docs/superpowers/specs/2026-11-03-octoverse-engine-design.md`, baseline `BASELINE.md` in this folder (commit `a8fc1b9`). Verified 2026-11-04 on the Intel UHD laptop, dev server on :5191 (`vite.perf.config.ts`), other Claude sessions running on other ports: everything timed below is "under load" (ruling R-E3) and CPU is logged.

**Fix wave A** (after the whole-branch review; `7127381`..`f7dc4cc`, then a docs commit) moved Nox's world look out of engine literals into place, character and theme data, Nox's values verbatim. Criteria 1, 2 and 4 below carry its numbers (marked "fix wave A"); criteria 3, 5 and 6 and the sections after 2 are as verified at `a816d72`.

## Verdict

| Criterion | Status |
|---|---|
| 1. Rendered output equivalent | **Met.** Two full recaptures pass the floor; check_stage output identical. Fix wave A: two more full recaptures pass, bit-identical except `techFocus`. |
| 2. Existing Nox suite passes | **Met.** 621 cases (baseline 442; 638 after fix wave A), six protected specs unchanged (worldTiers: one import-path line, R-E12), all e2e pass. |
| 3. Instances keep isolated state | **Met.** Isolation and embedding specs pass (isolation (f) is a known load flake: passes alone). |
| 4. Boundary holds | **NOT fully met, narrowed by fix wave A.** The import boundary holds. Nox's water, environment map, floor glow, particles, shader tints and UI reds are data now; 138 colour literals remain in the engine (162 before, counted honestly), pinned in `KNOWN_HUE_DEBT` (R-E13): kit art, legacy defaults, artwork, the mask black, and the stylesheets' theme fallbacks and near-neutral colours. |
| 5. No slower | **Met, measured under load.** Interleaved against `e171d03`: level or faster at tier low, 0.4 fps (2%) lower at tier high, inside the old tree's own spread. |
| 6. Owner approves the foundation | **PENDING OWNER REVIEW.** Ruled provisionally approved by the orchestrator's overnight rules; the owner confirms or rejects. |

## 1. Commits

`git log --oneline a8fc1b9..HEAD` (32 commits above the baseline commit, grouped by task; the plan's Task 1 is `a8fc1b9` itself).

| Task | Commits |
|---|---|
| 2 per-instance state | `b6002bb` replace a stray Windows-1252 byte in a test title (R-E4); `bc3a646` per-instance bubbleLive, anchors, hover, relief gate |
| 1b deterministic gate | `c9cccc0` captures wait for the world to be ready; `6284832` baseline recaptured |
| 3 scoped listeners, ids, storage | `eeaa239` scope listeners, ids and storage per instance; add isolation specs |
| 1c tight gate | `9363216` embers follow the world time under `?freeze`; `dceaa84` dev flag for kit and far plate really loaded; `84e47d8` capture scripts hygiene; `e171d03` baseline recaptured with frozen embers |
| 4 hues and lighting into config | `3f4f1af` hard-coded hues and lighting into the character config; expression overrides |
| 5 world data and clamps | `510ce59` world post, accent and caustics as data; sequence loader and entrance take data; `cbdf60c` particles take reach and decay from `glow.light`; `0c5a9d7` config clamps fall back for non-finite numbers and bad colours; `cde5a85` multi-instance page under StrictMode; `23267ce` notes |
| 6 content contract | `1cb0d99` one `ARM_IDS`, no coordinates in content, `StageId` is the stage vocabulary |
| 7 variation tables | `2d88d3c` head-effect and artifact-strategy tables |
| 8 bundle and host | `8bd8c0a` glyph effect frees GPU objects on every dispose; `02eab0e` one colour grammar; `d42b35c` `WorldBundle`, shared face anchor, UI theme tokens, `WorldHost` |
| 8b embedding | `377fb8c` `validateBundle` names a missing part; `86fb506` host options for embedding (ui, preview, history sync, exit); `66fbaf4` `ui: 'none'` scope fix (R-E11) |
| 9 file moves | `cf7f8aa` Nox sequence defaults and far-plate data leave the engine modules; `7f4353d`, `0f12e12`, `406169d` renames only (248 renames, 93% similar or better); `0fbd174` config and tooling paths, boundary test; `c4ab9cb` worldTiers import path (R-E12) |
| 9c font race | `e3c5f81` captures warm the font before loading a still (R-E14) |
| 10 `?world=` | `f9db6e0` `?world=` host, world registry, full-remount switching |
| 11 tooling | `a816d72` scripts take a world id |
| 12 (this) | `docs(engine): E02 final verification and handover` |
| fix wave A | `7127381` water colours and the environment map; `39eda45` the seabed's glow; `3933bf4` the live elements' colours; `7be5a8b` the character's shader tints; `2b86589` the hue scan sees GLSL, linear and CSS channel triples; `f8fc794` its match list typed; `f7dc4cc` the HTML layer's red and pink tints as theme tokens; then the docs commit |

## 2. Criteria with evidence

### 1. Rendered output is equivalent: MET

`bash docs/superpowers/evidence/engine-extraction/capture-set.sh .tmp/final` and again into `.tmp/final2` (head `a816d72`, dev server :5191, browser pane closed), each compared with
`python scripts/still_compare.py docs/superpowers/evidence/engine-extraction/baseline .tmp/<set> --floor .../floor.json --boxes .../face-boxes.json`: **both exit 0, PASS, 44 lines each, no retries.** Every still, mask and face box measures mean 0.0000 and 0.0000% of pixels over 8 (maximum difference 0; 1 on `detail`, as in the baseline's own three captures), bit-identical to the pre-refactor stills, except `techFocus` (the known focus-motion noise, which the floor carries):

| Set | `techFocus.png` mean / fraction over 8 / max | face box | `techFocus-mask.png` |
|---|---|---|---|
| final | 0.0056 / 0.0281% / 77 | 0.0086 / 0.0208% / 36 | 0.0025 / 0.0010% |
| final2 | 0.0067 / 0.0294% / 87 | 0.0121 / 0.0229% / 36 | 0.0022 / 0.0009% |
| floor | 0.05 / 0.0618% | 0.05 / 0.05% | 0.05 / 0.05% |

**Fix wave A:** `.tmp/fwa-final-1` and `.tmp/fwa-final-2` (head `f7dc4cc`, the same command): both exit 0, PASS. Every still, mask and face box is again mean 0.0000, 0.0000% over 8 (max 0; 1 on `detail`), except `techFocus`:

| Set | `techFocus.png` mean / fraction over 8 / max | face box | `techFocus-mask.png` |
|---|---|---|---|
| fwa-final-1 | 0.0119 / 0.0424% / 133 | 0.0226 / 0.0229% / 36 | 0.0025 / 0.0010% |
| fwa-final-2 | 0.0053 / 0.0274% / 83 | 0.0038 / 0.0000% / 3 | 0.0025 / 0.0010% |

Both sets' `check_stage.txt` are identical to the baseline's (ignoring CRLF). Logs and compare output: `.tmp/fwa-final-{1,2}.log`, `.tmp/fwa-final-{1,2}.compare.txt` (untracked); CPU 14.0% and 15.6% before each.

`check_stage.py`: the `check_stage.txt` of both sets, diffed against `baseline/check_stage.txt` ignoring CRLF, is identical (front-view colour (128, 36, 80), saturation 0.779, brightness 0.568, the 6 by-design misses, exit 1 by design). Stills are 15 images (the 14 stage stills plus `world-intro`), each with its mask.

### 2. The existing Nox suite passes: MET

- **Fix wave A:** `npx vitest run` 96 files, **638 cases, 637 passed, 1 skipped**; `NOX_BUILD_TEST=1` after `npm run build` 638 of 638; `tsc -p tsconfig.nox3d.json --noEmit` and `tsc -b` clean; `oxlint src` 0 errors, 50 warnings; `npx playwright test -c playwright.nox3d.config.ts --workers=1` 54 passed, 1 failed in 10.6 min (CPU 13.3% before): the known `responsive.spec.ts` skip-link load flake, which passes 3 of 3 alone (`--repeat-each=3`), so 55 of 55.
- `npx vitest run`: **94 files, 621 cases, 620 passed, 1 skipped** (the production-build check, which runs on request), 0 failed. Baseline 442 / 441 / 1 (73 files). The case count only went up.
- `NOX_BUILD_TEST=1 npx vitest run` after `npm run build`: 94 files, **621 of 621 passed**, none skipped. It includes the checks that the production bundle holds no fixtures, `nox-b`, `__octoSwitchWorld`, `testworld`, and that it does hold `Unknown world`.
- `npm run typecheck`: clean, exit 0. `npm run build` (`tsc -b && vite build`): clean, exit 0.
- `npm run lint` (`oxlint`): **0 errors, 50 warnings**, within the tracked baseline of 50 (the baseline recorded 52, which fell to 50 along the way; the old `.tmp/base-lint` copy that inflated the count is gone). By file: `engine/character/Octopus.tsx` 11, `engine/host/WorldHost.tsx` 7, `engine/world/Water.tsx` 6, `engine/world/Kit.tsx` 6, `engine/ui/OrbButtons.tsx` 3, `engine/artifacts/TechBubbles.tsx` 3, two each in `worlds/nox/review/main.tsx` and `engine/world/SurfaceLight.tsx`, one each in ten other files (the three old `src/components/` files among them).
- `npx playwright test -c playwright.nox3d.config.ts --workers=1`: **54 passed, 1 failed, in 10.9 min** (CPU 5.5% before). The failure is the known load flake `responsive.spec.ts` "the skip link is the first focusable element" (a Tab press that lands before the page takes focus); rerun alone with `--repeat-each=3`: **3 of 3 pass**. So 55 of 55 on the rule "rerun a known flake alone first". The suite is 12 spec files, 55 tests: `cameraDrift`, `detail`, `embedding` (new, Task 8b), `entrance`, `fallback`, `isolation` (new, Task 3), `keyboard`, `responsive`, `world`, `worldMotion`, `worldSwitch` (new, Task 10), `worldTiers`.
- **The six protected specs against the baseline commit `a8fc1b9`:** `git diff a8fc1b9 -- tests/e2e/<spec>.spec.ts` is empty for `detail`, `entrance`, `keyboard`, `world` and `worldMotion` (blob ids `72236c1f`, `d5042b92`, `992b5b87`, `56a09452`, `15216d7b`, as recorded in `BASELINE.md`). `worldTiers.spec.ts` differs by exactly one line (R-E12: the spec imports a draw-order constant file that the move changed from `src/nox3d/world/drawOrder` to `src/engine/world/drawOrder`; no shim was added):

```
-import { SEABED_ORDER, WATER_SKY_ORDER } from '../../src/nox3d/world/drawOrder';
+import { SEABED_ORDER, WATER_SKY_ORDER } from '../../src/engine/world/drawOrder';
```

  its blob is `44f019d8` -> `128aa261`. Other e2e files changed since the baseline, none of them protected: `cameraDrift.spec.ts` and `responsive.spec.ts` (path and id follow-ups; `responsive` also reads its own tooltip id, Task 3), and the three new specs.

### 3. Multiple instances keep isolated state: MET

`tests/e2e/isolation.spec.ts` (Task 3, run under React StrictMode via the dev page `/src/app/multi.html`) and `tests/e2e/embedding.spec.ts` pass in the full run above: two instances share no selection, timers, bubble positions, anchors, listeners or DOM ids; a preview registers no `window` listener; unmounting a preview leaves the page's Escape and skip working. The unit side: `src/engine/host/isolation.test.ts`, `listeners.test.ts`, `strictMode.test.ts`, `instance.test.ts`. Isolation (f) (StrictMode) is a load flake that has passed alone every time it was rerun; it passed in this full run. `tests/e2e/worldSwitch.spec.ts` shows a full remount on a world switch leaves the same listener counts, no tooltip, no hold, and a per-world entrance flag.

### 4. Boundary holds: NOT FULLY MET, narrowed by fix wave A (ruling R-E13)

- **Met: `src/engine/**` imports nothing from `src/worlds/**`** (engine tests are the one allowed exception: they use Nox as their reference world), and **a world imports nothing from another world**. `src/engine/boundary.test.ts`, 6 tests, non-vacuous (it asserts it sees the engine's files); passes.
- **Not met: colour literals in engine sources.** At `a816d72` the test pinned 150 literals in 16 files, and the count was low: its pattern (hex, `rgb()`/`hsl()`, `0x`) did not see GLSL float colours, 12 more (the floor's reds and puddle sheen, the kit's pores, the skin and dome rims, the cup highlight, the orb glass), so the honest count was **162**. Fix wave A widened the scan to non-grey `vec3`/`vec4` float triples (not all 0/1, not a named constant such as the Rec. 709 luma weights), `color(srgb-linear r g b)` and `var(--oct-*, r, g, b)`, with the rule tested on samples both ways, and moved Nox's world look into data:
  - `place.water.colours` (the water sky, surface glow, opening, rays and far fish) and `place.water.environment` (the environment map's top, horizon and low colours and its seabed glow, which may be `null`: no red band, reflections kept);
  - `place.palette.floorGlow` (the cracks, lava, puddle sheen and the kit's pores; the sheen line is left out of the shader when `glow.floor` is 0);
  - `place.live.colours` (bubbles, embers, motes, marine snow);
  - `character.palette` `rimHot`, `domeRimHot`, `suckerSpecular`, `orbGlass` (a legacy config without them reads Nox's);
  - 17 UI theme tokens for the stylesheets' red and pink glows, lines and fills (`--oct-*-rgb` channel tokens where a stylesheet applies its own alpha, so `rgba(var(--oct-glow-rgb, 255, 40, 90), 0.35)` is the old literal once substituted).

  `validateWorld` and `validateBundle` name each missing or bad field; a world with the glow set to none gets an environment map and a floor shader without red (unit tests in `world/worldLook.test.ts`). The compiled-in colours are emitted as GLSL text identical to the old literals, and the stills are bit-identical (criterion 1). **138 literals in 14 files remain**, pinned in `KNOWN_HUE_DEBT`; the ratchet still fails both ways:
  - Nox's **kit art** (15): `world/textures.ts` 10 (the glyph panels' recess gradient, red rune strokes and seam), `world/Kit.tsx` 5 (rock, pebble, iron and coral bodies, the glyph panels' white multiplier). Veyra's kit work (M2) moves them into kit or place data.
  - **Legacy defaults** that reproduce Nox for a config that sets none, by design (spec 13.3) (18): `config/validate.ts` 13 (6 before, plus the seven shader tints that are palette data now), `config/lighting.ts` 5.
  - **Artwork** (4): `ui/Flame.tsx` 2, `ui/ProjectDetail.tsx` 1, `ui/poster.css` 1.
  - **The stylesheets** (100): 55 are Nox's values as fallbacks inside `var(--oct-*, ...)`, which a world's theme reaches (`ui/theme.test.ts` holds each equal to Nox's theme); 45 are bare near-neutral colours no token reaches yet (white hairlines, violet-black panel and button fills, text greys, black shadows) and the storyboard placeholder badge's amber. By file (fallbacks + bare): `ui/detail.css` 42 (17 + 25), `overview.css` 23 (15 + 8), `intro.css` 11 (7 + 4), `tooltip.css` 10 (5 + 5), `skip.css` 9 (6 + 3), `exit.css` 5 (5 + 0). No bare red or pink is left (`theme.test`). (At `a816d72` this list called all 101 "fallbacks beside the theme variables"; only 28 were.)
  - Black as a `?mask` background (not a hue) (1): `host/WorldHost.tsx`.
- Honest reading: a second world can now set its water, environment, floor glow, particles, character tints and UI reds without editing engine code. What it cannot yet change without engine work is Nox's kit art (textures and kit materials, Veyra M2) and the neutral HTML colours.

### 5. No slower

**Status: MET (not slower beyond noise), measured under load.** The plan asks for a quiet machine and the baseline's `perf.mjs` numbers; other sessions were running (CPU 11 to 29%), so the comparison is interleaved against the code the baseline was taken from (ruling R-E3).

Method: a temporary detached worktree at `e171d03` (the last pre-refactor commit: the same Nox code the baseline stills were captured from, plus Job 1's perf work and the frozen embers; `node_modules` copied, `vite.perf.config.ts` copied) served on port 5201; this worktree (`a816d72`) served on 5191. The same client, this tree's `scripts/perf.mjs --secs=8`, was pointed at each in turn (`NOX_URL`) so both sides ran identical measuring code: headless Edge, 1536x1024, pixel ratio 1, browser pane closed, four queries per run, a 2-second warm-up of each server first. Order: old, new, old, new, old, new. CPU is `cpu.ps1` (mean of five 1-second samples) before / after each run. (Another session's stale Vite on 127.0.0.1:5201 shares the port number; `localhost` resolves to `::1` first, where the old-tree server answered, checked by fetching `/src/nox3d/world/drawOrder.ts` from it: 200, JavaScript.)

Median fps per run (slow10 in the raw file, all within about 1 fps of each other except the quiet-window run 3 of the new tree):

| Run | Tree | CPU before / after | intro low | intro high | overview low | techFocus low |
|---|---|---|---|---|---|---|
| 1 | old `e171d03` | 13.0% / 16.1% | 47.8 | 23.2 | 47.8 | 47.8 |
| 1 | new `a816d72` | 16.7% / 23.2% | 49.5 | 22.7 | 53.8 | 50.0 |
| 2 | old | 14.1% / 14.1% | 48.5 | 23.1 | 52.4 | 50.0 |
| 2 | new | 28.6% / 14.9% | 47.2 | 22.6 | 48.1 | 48.1 |
| 3 | old | 13.2% / 10.8% | 42.9 | 22.5 | 51.3 | 59.2 |
| 3 | new | 11.2% / 24.9% | 68.5 | 26.6 | 68.0 | 65.4 |

Per query, the median of the three per-run medians, the old tree's own run-to-run spread (largest minus smallest of its three) and the difference:

| Query | old median (spread) | new median (range) | new minus old | Within old spread? |
|---|---|---|---|---|
| `stage=intro&tier=low` | 47.8 (5.6) | 49.5 (47.2 to 68.5) | +1.7 | yes |
| `stage=intro&tier=high` | 23.1 (0.7) | 22.7 (22.6 to 26.6) | -0.4 | yes (narrowly) |
| `stage=overview&tier=low` | 51.3 (4.6) | 53.8 (48.1 to 68.0) | +2.5 | yes |
| `stage=techFocus&tech=kali&tier=low` | 50.0 (11.4) | 50.0 (48.1 to 65.4) | 0.0 | yes |

Reading: at tier low the new tree is level or faster in all three stages. At tier high (GPU-bound, the narrowest old spread) the new tree's medians are 0.4 fps (about 2%) lower, inside the old tree's 0.7 spread; in the two like-for-like windows (runs 1 and 2, CPU 13 to 29%) the new tree read 0.5 fps lower both times (22.7 and 22.6 against 23.2 and 23.1), and in run 3, a quieter window for the new tree, it read 4 fps higher. Three pairs cannot separate a possible 2% cost at tier high from noise. The criterion ("the new tree's median is within the old tree's own run-to-run spread") holds, so no bisect was run and nothing was tuned. For reference, the baseline's own numbers (`BASELINE.md` section 5, one tree, three runs under load): intro high 15.2 to 18.2, intro low 37.6 to 39.7 fps, on a busier machine.

Raw output: `.tmp/perf-ab.txt` (untracked). The temporary worktree, its Vite server and every wrapper process were removed afterwards.

### 6. Owner approval: PENDING OWNER REVIEW

The plan's gate. The orchestrator's overnight rules turn an owner gate into "PENDING OWNER REVIEW" and rule it provisionally approved so that other worlds' work can proceed. It is not an approval. What to check, in order: `docs/superpowers/MORNING-REVIEW.md`, "E02 engine extraction". F01 (Veyra) has not been started in this worktree.

## 3. Rulings made along the way (ledger `.superpowers/sdd/2026-11-03-engine-extraction/progress.md`)

R-E1 work on `feat/nox-3d`, no cut branch. R-E2 the baseline commit is Task 1's commit. R-E3 perf and fps are "under load": interleave, log CPU. R-E4 the 0x92 byte (a Windows-1252 apostrophe) in a test title is replaced by ASCII. R-E5 `AppearSheet` literal in Task 5, derived in Task 7. R-E6 worst-of-three noise floor. R-E7 the still gate waits for the world, rebuilt (Task 1b). R-E8 accept the Embers noise for the time being (superseded by R-E9). R-E9 freeze the embers, add the loaded flag, tighten the floor (Task 1c). R-E10 Task 1c's 25-line app diff read by the controller. R-E11 `ui: 'none'` hides only title, nameplate, overview panel and skip controls. R-E12 a path-only edit to `worldTiers.spec.ts`. R-E13 land with the pinned hue debt. R-E14 the `techFocus` drift was a font race in the capture, fixed in the capture scripts only. R-E15 no separate reviewer for the script-only fix.

## 4. Drift rows D1 to D11 and how each was resolved

| Row | Drift (Task 1) | Resolution |
|---|---|---|
| D1 | `ui/bootVeil.ts` module state and the fixed id `boot-veil` | Task 3 (`eeaa239`): kept by design (the veil is `index.html`'s, one per page); only a page instance arms the failsafe, hides the veil and holds the entrance, a preview does none of it. |
| D2 | `ui/useViewport.ts` module cache and `window` resize listener | Task 3: listener gated to page mode (a preview registers none; it reads the size on render); the `last` cache is a pure memo of the window size, commented. |
| D3 | `motion/micro.ts` `settlePeaks` memo keyed by cycle count | Pure memo with no instance data, safe to share; no change (Task 3). |
| D4 | Dev globals `__noxCamera`, `__noxWorldTier` beside `__noxReady`, `__noxEntrance` | Written by the page instance only (Task 3); Task 8 added `window.__octoverse.{camera,worldTier,swell,hold,setTier,...}` and Nox still writes the legacy names, which the protected specs read (`debugHooks.ts`). A stale-after-unmount caveat is in the deferred list. |
| D5 | Fixed DOM id `project-details` (skip link and panel) | Task 3: id per instance (`useId`, passed as the panel id and the skip link's target); the tooltip id likewise, so `responsive.spec.ts` reads its own (a 2-line edit, not a protected spec). |
| D6 | `webglcontextrestored` listener on the canvas element | None needed: scoped by its element. |
| D7 | Test fixtures `dummy.character.ts`, `dummy.world.ts` import `NOX` | Task 4 gave the dummy its own values; Task 8 made the fixtures functions over a given base. They stay test-only (excluded from the boundary scan under `fixtures/`), and the production-build test proves they do not ship. |
| D8 | `world/drawOrder.ts` constants read by the draw-order e2e check | Moved with `world/` to `src/engine/world/drawOrder.ts`; `worldTiers.spec.ts` import path follows (R-E12). |
| D9 | `FaceCanvas.ts` RGBA8 staging upload | No new module state; Task 4's hue test passes with it. |
| D10 | Direct Nox imports from shared code (spec 4.1) | Removed by Tasks 5, 7 and 8 (the bundle: sequences, artifacts, poses, content, place are handed in, not imported); the engine's non-test sources import nothing from `worlds/` (boundary test). `OrbButtons` face-anchor duplicate collapsed into the shared anchor (Task 8). |
| D11 | Module constants, scratch vectors and pure memos not in spec 4.3 | Reviewed as immutable or pure scratch; the WeakMap memos keyed by renderer or instance stay. The spec's rows (`reachState`, `bubbleLive`, `liveAnchors`, `RELIEF_GATE`, `bubblePointer`, theatre `loading`) are per instance (Tasks 2 and 3), except the Theatre project id (one project per world id, StrictMode-safe, Task 5). |

## 5. Deferred

### Spec 14.1 (waits for F01, added to no code)

`skin.mode: 'jelly'` and `skin.sparkle`; cup-frill style fields (`suckers.style`); `vaultDial`; `pendant`, `bloom`, `armLift`; `place.props` and `SequenceSet.kitDrives` (the gate's ring); the generalised layout categories, relic and palette keys (`WorldLayout` is still `pillars / rocks / corals / chains / coralLights`); `floor.material` and extra live elements; personality `settle`, `glideBias`, `flourishRate`; the flourish layer and the non-spiral entrance path; `armCurl.tightness` and new face fields (dropped unless F01 needs them).

### From the ledger (minors deferred by reviewers; each was judged not to block; taken from the ledger, not re-verified at the head unless marked)

- **Hue and look:** the pinned 138 literals (section 4 above; 150 at `a816d72`); Nox's traced UI boxes (`DOME_PANEL_BOX`, `DETAIL_PANEL_BOX`, `INTRO_TITLE`) stay in `engine/ui/`; the neutral CSS colours, the detail shield fill, Flame gradient stops and Poster are not themed (the red and pink glows are, since fix wave A); theme colours use three's colour grammar (documented), so `transparent`, 8-digit hex and `oklch` are refused.
- **Validation:** `NOT_COLOUR` fails closed on key names, so F01's string fields (`skin.mode`, `suckers.style`) must be added to it; `contactShadow` reach/min/max are finite-checked only; `clampLighting` shares the direction array by reference; `toFixed(4)` precision in the clamp; `ValidationOptions` now holds only the catalog (simplify); `config/types.ts` import/export style; no validator test for the remaining issue codes; resolveWorld tests miss repeated `world` params, uppercase ids (`NOX` falls back with a warning) and a very long id; `WORLDS` is a string array in `engine/types/bundle.ts` and a Record in `worlds/index.ts`; farPlate error labels for `null` and non-object layers are cosmetic.
- **Entrance and sequences:** `EntranceShape.turn` is read literally, so the 8-degree end-heading guarantee holds only for the full turn (F01); `theatre.ts` `FULL_TURN` duplicates `NOX_ENTRANCE`; `BlowRun.step` `length` is optional (a caller that forgets never finishes a blow); strategies `sheet?` optional and a conditional `AppearSheet`; the intro/overview vocabulary is hard-coded in three places (`CHOOSING`, `bubblesExist`, `CHOOSABLE_IN_BOTH`); `HOLD_CENTRE` equals the orbit centre only for Nox; entrance sheet loads after the first commit, not at module evaluation (plan-prescribed); `startSheetLoaders` and `capture-ready.mjs` still call `loadNoxSequences` (the bundle's loader serves the engine; the scripts are Nox-specific).
- **Host and embedding:** `ui: 'none'` spec line wanted: the detail panel is mounted and only `stageRequest` or the engine's controls open it; the orb-button assertion in `embedding.spec.ts` runs with the default `artifacts`, not explicit `settled`; page options `view` and `mask` reach a preview; the embedder must keep the bundle object stable (`instanceKey`); a parent re-applying its last `stageRequest` after a bundle remount; `.exit-link` is `position: fixed` (page instance only); `EngineInstance` fixes its mode at mount (comment wanted in `App.tsx`); `window.__octoverse` probes stay stale after an unmount until the next instance overwrites them (dev only, only `setTier` is reported); `nox-b` shares the Theatre project `OctoVerse`, so a second project is never created in the switch test.
- **Tests and tooling:** tests that read source text with regexes (`theme.test`, `bubbleLive.test`, `isolation.test` source scans) are tripwires and porous; `isolation.test.ts` no longer scans `App.tsx`, `src/worlds` or `src/app`; engine tests may import `worlds/nox` without a per-file pin (57 files); the boundary test's cross-world check has no files-found guard and cannot see `import.meta.glob` or `new URL`; `isolation.spec.ts` compares `loadNoxSequences()` with itself (protected, unchanged); isolation (b) cannot fail for a real reason, (c) is timing-prone, (f) is a load flake with a tautological assertion; `strictMode.test` second test cannot fail independently; the `armChain` isolation test passes before the change; the instance-provider test uses `renderToStaticMarkup`; a comment in `worldSwitch.spec.ts` is misleading (`Page.tsx` always adds `testworld=1`); no test for `TechBubbles` `faceOrigin` wiring or the App-level `choiceRemoved`; `still_compare` face boxes run only with `--boxes` (always pass it); the overview floor is tight; `techFocus` residual noise (focus motion on `performance.now`: a loss under about 600 px there could pass; candidate: freeze that clock under `?freeze`); the `kit` flag in `debugHooks` means "the bundle's level 0 loaded in full", doc comment to reword.
- **Tooling for a second world:** `world-capture.mjs` and `check_stage.py --world` still use Nox's HQ panel-2 framing and image (`WORLD_HQ`); `check_stage.py --world-id` as the last argument raises `IndexError`; the env var `WORLD` is generic; `flattenForDepth` stays in `worlds/nox/poses.ts` (spec 11.2 wants it in `engine/poses/`); spec text 6.1 says `engine/arms.ts`, the file is `engine/config/arms.ts`; `ui/theme.ts` comment names `titleIcons.tsx`, the file is `titleIcons.ts`; the spec and plan wording says `<WorldHost key=...>` mounted by main, the key is on `App`.
- **Carried from Job 1 and not part of E02:** tier-high `renderScale` 1 -> 0.9 decision; the `bloomScale` tier value that has no effect at medium or low.
