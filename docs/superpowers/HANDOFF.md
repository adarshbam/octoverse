# Nox 3D build: handoff

Updated 2026-11-03. Read this first in a new session, then the files it points to.

## Current direction (2026-10-26, governs over everything below)

- **Spec:** `docs/superpowers/specs/2026-10-26-nox-world-and-motion-design.md`. It sets the approach and detail for the next phase:
  - Nox's look in a real 3D world (first priority);
  - the Option 2 world (Blender kit near Nox, painted distance);
  - water physics on the arms, the swim stroke and the new entrance;
  - technology bubbles, the head swell, variants;
  - the process rules.
- **Older docs:** the 2026-10-23 spec and plan below only list what to build; where they disagree with the new spec, the new spec wins.
- **Test scene (throwaway reference):** its code was deleted after Milestone 2; the stills are in `docs/superpowers/reviews/assets/world-test-scene/`.
- **No videos:** do not record review clips or frame sequences (`scripts/stepped-capture.mjs`, `spike-env/clip.mjs`). Check with stills, screenshots and measurements. The owner watches motion live.
- **Superseded:** Entrance v1 (Task 23) is replaced by the spec's entrance; the gate plate (Task 24) is replaced by the 3D world.
- **Plan:** `docs/superpowers/plans/2026-10-26-nox-world-and-motion.md`: 28 tasks in the spec's nine milestones, each milestone ending in the owner's live review. The owner approved the spec and the plan on 2026-10-26 and chose subagent-driven execution.
- **Ledger:** `.superpowers/sdd/2026-10-26-nox-world-and-motion/progress.md` (git-ignored) holds every task's completion line, every ruling (R1 onwards), the owner's verdicts verbatim and the deferred minor findings. Trust it and `git log` over memory.
- **Milestone 1 (Tasks 1–5) is closed, 2026-10-27.**
  - The world ran behind `?world` at the time; it is always on since Task 12.
  - Nox has capped world accents, an aura, a glow light that also tints particles, and an in-scene local grade that never touches his own layers.
  - The owner approved a new body palette: violet arm tops, a deep red underside band (`glow.underside` 1.6) and a red-pink rim. The face glow ramp was restored to the approved one.
  - Accepted misses: intro saturation 0.837, cheek glow 9.5, arm rim 40.9. The record is in `docs/superpowers/reviews/nox-world.md`.
- **Task 6 is complete** (e045bc1..7de3e24): `layout.json` is the single source for placements, the kit is compressed with meshopt and KTX2 (KTX-Software v4.4.2 at `C:\Program Files\KTX-Software\bin`; prepend it to PATH), and LODs swap at 16 units (R28).
- **Tasks 7 to 11 are complete** (ledger has every completion line, R36 to R44 and the deferred minors).
  - **7:** baked light, relics 1.2x. Stone relief comes from a per-texel dominant-direction map beside each lightmap (one fetch, no light loop): +2.0 to 2.6 ms, 4.0 to 5.7% of the intro frame; relief within 1.8% of real-time in the 2x crop. `near.glb` 3.85 MB.
  - **8:** default camera hover and live HTML anchors; `?hover=x,y,z` pins it for stills (ignored when `view=` is set).
  - **9:** three transparent far-plate layers (z -16, -27, -45; 171 KB); live pieces beyond z -12 are cut. A failed layer leaves fog only (R41).
  - **10:** look fixes: lens shift (`WorldConfig.camera.tilt` 0.07), more lava and embers (x2.2), brighter top opening, ambient bubbles, lava pulse and coral sway (off under reduced motion and freeze, e2e `worldMotion.spec.ts`).
  - **11:** quality tiers (`WORLD_TIERS`, render scale 1 / 0.8 / 0.6, floor noise baked on the GPU, relief gate, contact shadows on at every tier), `scripts/perf.mjs`.
- **Task 12 and Milestone 2 are approved (owner, 2026-11-02, "Approve M2").** Milestone commit cad8f8a `feat(nox3d): every stage in the 3D world`.
  - The world is always on (`?world` is ignored). `?tilt=<rad>` overrides the lean (default 0.07). Fallback chain: baked `near.glb`, then `kit.glb` live-lit, then no kit; Nox and the non-GLB water stay up while assets fail or hang (`KIT_WAIT_MS` 15 s; dev-only `?kitwait=<ms>`).
  - The spike code (`src/spikeEnv/`, `spike-env.html`, `spike-env/{capture,clip,perf}.mjs`, `public/spike-env/`) is deleted (backup: `spike-env-backup-2026-11-02.tgz` in the side-session notes folder). `spike-env/out/` (with the mp4s) and `spike-env/blender/` stay untracked. The test-scene stills are in `docs/superpowers/reviews/assets/world-test-scene/`.
  - **Milestone 3 (arm water physics, Tasks 13–14) is cancelled (owner, 2026-11-03: "we don't need to add physics"; ledger R45, R52).** Do not build `ArmPhysicsRig`. Tasks 22, 23 and 25 drive the pose directly.
  - **Milestone 4 (Task 15, back view) is approved (owner, 2026-11-02, "Approve M4").** Milestone commit `feat(nox3d): Nox reads round and cute from behind` (checkpoint 7621c08; ledger R46-R47). `?yaw=<deg>` rotates the body for stills; `review.html?component=back` shows 0/45/90/180.
  - **Milestone 5 (Tasks 16-19, stroke cycle, swim, entrance) is approved (owner, 2026-11-03, "Approve M5").** Milestone commit `feat(nox3d): swimming entrance with spin` (checkpoints 5e8fb44, 7ee7227, 64bb559, 76c1e99, e431b0a; ledger R48-R53). Three whole strokes at Nox's 1.33 s rate to 4.5 s, a 1.0 s hold, a golden-spiral spin 5.5 to 6.5 s, settle to 7.5 s (`ENTRANCE_SECONDS` 7.5). Theatre.js: `src/nox3d/sequences/` (`keys.ts` defaults, `theatre.ts`, repo state `state/octoverse.theatre.json`, seed with `node scripts/theatre-seed.mjs <sheet>`); core is a lazy chunk, studio only in dev with `?studio`. `swimDrive(frame, settle)` is the arm drive. Known weaknesses are in `docs/superpowers/reviews/nox-world.md` (dark silhouette at t=0.5, pillar clearance 0.158, reload replay in the settle, Skip-intro e2e failing on this machine).
  - **Milestone 6 (Tasks 20-23, technology bubbles) is approved (owner, 2026-11-03, "Approve M6").** Milestone commit 9f9a61d `feat(nox3d): suction hold for technology bubbles` (commits 2bc7a05, 359d9c1, c0b1f53, 5ebd9f6). Fifteen orbiting bubbles blown from the mouth after the entrance, nearest-arm suction hold, no physics (R56). Colour parity with bubbles at rest is the new baseline (R58); focus from the overview keeps the dome open (R59).
  - **Milestone 7 (Task 24, head swell) is approved (owner, 2026-11-03, "Approve M7").** Nox's effect is glowing red glyphs (`headEffect: 'glyphs'`, R57); no camera moves (R60). Commits da0e343, 5999708, plus the milestone commit `feat(nox3d): head swell with Nox's effect`. Known: keyboard e2e Kali and every-bubble tests flake under load (3/5 on the base too); a second click right after the swell settles can be ignored (swell 1.5 s vs STAGE_TRANSITION 1800 ms).
  - **Lane A is finished.** Next: lane B (Tasks 25, 27) and lane C (bubbles in front of Nox, no hover camera moves, entrance spin retime) merge only on the owner's word; then Task 26 (needs `headEffect`), then Task 28.
  - **Known weaknesses given to the owner:** pillar lean 1.2 degrees vs panel 2's 8 to 12 (R39: a stronger lean means leaning the pillars in the layout, bake plus far rerun, or a larger tilt that changes Nox); lower-third pattern (corner rocks too red, centre lava weak, stone lost most of its blue sheen: R40); tier high 16.8 fps vs the 27 fps floor on this Intel UHD (R43; render scale 0.75 gives about 23, 0.6 about 32 fps); the adaptive logic settles on tier low (about 38 fps) after about 8 s; far layer failure = fog only (R41); framed-mode Nox colour at tilt 0.07 not measured; overview panel edges drift about 12 px at hover extremes.
  - Open minors worth a glance: `keyboard.spec.ts` flakes under parallel Playwright load; `bake_world.py` ALBEDO table is stale; the `world-capture.mjs` `view=` freezes the camera so `hover=` stills need a framed capture.

## No arm physics (owner, 2026-11-03, ledger R52)

- Milestone 3 is cancelled, not deferred. Arm follow-through comes only from stroke drives (`spread`, `sweep`, `straighten`, `ArmDrive.pitch`, `swimDrive`).
- **Milestones 6 and 8:** Tasks 22, 23 and 25 mention physics follow-through. Without physics, their motions drive the pose directly. Ignore every `ArmPhysicsRig`, `snap` and `__physicsMs` mention in the plan.

## Parallel lanes (owner, 2026-11-03, ledger R54)

The owner asked to speed up by running unrelated tasks at the same time. Two lanes run at once, each with its own controller session.

- **Lane A (this worktree, `feat/nox-3d`, port 5191):** Milestone 6 (Tasks 20–23), then Milestone 7 (Task 24). These are a chain: Task 24's swell pushes the Task 21 orbits. Lane A owns `behavior/stageMachine.ts`, `behavior/reach.ts`, `artifacts/*`, `ui/OrbButtons.tsx`, `ui/hoverIntent.ts`, `ui/TechTooltip.tsx`, `behavior/expressions.ts`, `character/FaceCanvas.ts`, `character/suckerMaterial.ts`, and `sequences/headSwell.ts`. Ruling numbers continue R55, R56 and so on.
- **Lane B (its own worktree, branched from `feat/nox-3d`, port 5192):** Task 25 (micro-animation library, Opus high), then Task 27 (phone, accessibility and WebGL fallback, Sonnet medium; the owner checks it on their real phone). Lane B owns `motion/micro.ts`, `behavior/ambient.ts`, `behavior/attention.ts`, `ui/Poster.tsx`, `ui/OrbTray.tsx`, `ui/OverviewPanel.tsx`, `ui/ProjectDetail.tsx`, `world/worldTiers.ts`, and the new e2e specs. It keeps its own ledger in its worktree, with rulings B1, B2 and so on.
- **Shared files** (`App.tsx`, `character/Octopus.tsx`, `config/types.ts`, `config/nox.character.ts`, `sequences/keys.ts`, `sequences/state/octoverse.theatre.json`): both lanes may touch them. Keep edits small and additive, and never reformat or reorder. At the merge, re-seed the Theatre state with `node scripts/theatre-seed.mjs <sheet>` rather than hand-merging the JSON.
- **Ports:** lane B runs Vite on 5192 and sets `NOX_URL=http://localhost:5192` for every capture script. Its first commit makes `playwright.nox3d.config.ts` read `NOX_PORT` (default 5191), because `reuseExistingServer` would otherwise test lane A's server.
- **Frame rate:** numbers taken while the other lane is busy are skewed on this laptop. Label them as such. The honest performance pass is Task 28.
- **After both lanes:** lane B merges into `feat/nox-3d` only on the owner's word. Task 26 (variant path) follows, needing Task 24's `headEffect`; the dummy drops "heavier water feel", since there is no physics. Task 28 comes last.

## Deferred owner fixes (do not start until the owner asks)

- **Intro start (owner, 2026-11-02):** "It starts with a black screen and then octopus appears, so I'm not able to see anything properly." The owner wants the intro readable from the first frame and a better frame rate, later, not now. Likely causes: the world waits on the kit and plate while tier detection settles on tier low after about 8 s.

## Token plan (owner-approved 2026-11-02, governs how the work runs)

The owner kept hitting usage limits. Task 7 used about 0.95M subagent tokens, 45% of it in fix rounds caused by requirements added after dispatch.

- **Model and effort by difficulty.** Set both on every subagent.
  - **Haiku, low:** captures and measurements, Blender bakes from committed scripts, git, the ledger, re-reviews of small fixes, Task 12's spike deletion, Task 28's test runs.
  - **Sonnet, medium:** ordinary code and tests, and the one review per task. Tasks 7 (finish), 8, 9, 11, 12, 17, 20, 21, 26 and 27. Task 10 runs at high effort and moves to Opus only if the owner rejects the look at Milestone 2.
  - **Opus, high:** Tasks 14, 15, 18, 19, 22, 23, 24 and 25, and the final whole-branch review. **Opus, max:** Task 13 (physics core) and Task 16 (stroke cycle).
- **A fresh controller session per milestone.** Start from this file and the ledger, with the controller on Sonnet.
- **Acceptance criteria in the first brief:** frame budget, close-up detail, colour numbers. A ruling added after dispatch costs a fix round.
- **Fewer reviews.**
  - One review per task. A re-review runs only when a fix changes logic, and it runs on Haiku.
  - Simple tasks are reviewed together at the end of their milestone.
  - The owner's gates are unchanged.
- **No blocking waits.** Long Blender jobs run headless in the background (`blender -b -P <script>`), not as one blocking MCP call.
- **Images and dispatches.** Judge from numbers. Look at images only at owner gates or when a number cannot answer. Hand subagents file paths, not pasted text.
- **OmniRoute (optional, text only).** MCP server `omniroute` on localhost:20128, with NVIDIA NIM, Gemini, Mistral, Groq and Kimi. `omniroute_route_request` with `groq/openai/gpt-oss-120b` works. Use it for plain web markup, boilerplate, test-case lists and copy. Never use it for 3D, animation or Nox's look. Check everything it returns. Code sent there goes to that provider.

## Where the work lives

- **Worktree:** `C:/Users/Dell/Desktop/Vibe-coding/OctoVerse/worktrees.local/nox-3d-spike`
- **Branch:** `feat/nox-3d`. Check `git log` for the latest commit; each approved component ends in a `feat(nox3d): ...` commit.
- **Main checkout:** `C:/Users/Dell/Desktop/Vibe-coding/OctoVerse` (branch `codex/nox-storyboard`). It holds the old SVG work, a dirty tree and 28 legacy deletions. Never edit, reset or restore it; only copy files from it.
- **Spec:** `docs/superpowers/specs/2026-10-23-nox-3d-design.md`. Section 8.0, the character upgrade, governs the current phase.
- **Plan:** `docs/superpowers/plans/2026-10-23-nox-3d.md`. 26 tasks, executed natively (`superpowers:executing-plans`, with TDD).
- **Ledger:** `.superpowers/sdd/2026-10-23-nox-3d/progress.md` (git-ignored). It holds every task's completion line and every `Ruling:`. Trust it and `git log` over memory.
- **Review log:** `docs/superpowers/reviews/nox-character.md`, with captures in `docs/superpowers/reviews/assets/`.

## Status

- **Phase A, foundation (Tasks 1–6):** complete. 29 Vitest tests pass and `npm run typecheck` is clean.
- **Phase B, character upgrade (Tasks 7–16):** in progress. The owner has approved Tasks 7 to 15 (junction, eyebrows, eyes, mouth and blush, mantle, arms, suckers, skin, glow and material, motion). Each verdict is in the review log. The eyes were rebuilt from the owner's high-quality face reference (v4); the owner asked to keep them while sending a whole-character critique. Task 14 (glow, lighting and material) was approved at v3, which answered the owner's 12-point final-polish brief. Task 15 (motion) was approved at v1 (`scripts/motion-capture.mjs` records it). **Task 16: the owner signed off the base Nox on 2026-10-25.** Phase C: Tasks 17 (stage machine, pose blending) and 18 (framing, quality tiers) are done; Task 19 (overview, glass dome) was approved at v2 after the owner asked for a slower, smoother transition (they want the experience to feel calm, immersive and butter smooth). Task 20 (technology orbs) was approved at v2 after the owner's glass critique (sharp rim highlights, dark centres, vivid filled logos). Task 21 (tech focus) was approved at v2, which answered the owner's ten-problem motion brief on v1 (review log, "Tech focus v2"; its known gaps are listed there). Task 22 (detail stage) was approved at v1 (review log, "Detail v1"; its known gaps are listed there, with one decision still open for the owner: which side each arm's cups face). **Task 23 (entrance) is presented as Entrance v1 and awaits the owner's verdict; see the resume point at the end.** Panel 3 is traced from its high-quality image through `scripts/hq3.py`; the detail is captured at the HQ panel 5's own size (`node scripts/stage-capture.mjs detail <out>`, 1672x941; `VIEW=WxH SCALE=n` for other sizes) and checked with `python scripts/check_stage.py <out> --panel 5`. Record motion with `scripts/stepped-capture.mjs <scenario> <out> [w h]` (frame-exact on the page's clock; scenarios focus, rapid, idle, keys, phone, open, detail, journey; `REDUCED=1` for reduced motion), which replaces the real-time screencast for review videos because that drops frames under load.
- **High-quality references:** `docs/design/references/Nox/` (the owner's HQ panels) and `docs/design/references/Nox-face-hq.png`. The review page compares against the HQ panel 2 by default (`&ref=panel` for the old one). In scratch tooling, world (x, y) maps to HQ px (783.6 + 204.5 x, 495.4 - 204.5 y).
- **Owner critique (2026-10-24, review log "Whole-character critique"):** all ten points are addressed and approved with Task 14.
- **Performance:** on this laptop's Intel UHD, the moving intro ran at ~40 fps at DPR 1 and ~11-13 at DPR 2 (headless Edge) under light load; with other apps busy (CPU ~55%) it reads ~19-32 and ~9-11, so compare A/B back to back. Task 18's tiers must cap DPR, bloom resolution and the contact-shadow pass on integrated GPUs. Never use canvas `filter` in `FaceCanvas`: it redraws every frame and costs most of the frame rate. Keep the browser pane off the live stage while measuring: it renders too.

## How each character component is done (plan: "Pattern: character component tasks")

1. **Trace** the reference with `python scripts/ref_grid.py <x0> <y0> <x1> <y1> out.png`.
2. **Implement**, with unit tests for any pure logic.
3. **Check for regressions:** `node scripts/stage-capture.mjs intro spike-out/<c>.png`, then `python scripts/check_stage.py spike-out/<c>.png --panel 2`. It must exit 0.
4. **Owner review:** open `http://localhost:5191/review.html?component=<id>` in the browser pane, and send `node scripts/review-capture.mjs <id> out.png` plus a reference/before/now strip. Ask the owner to approve, or to say what to change. **Never start the next component before approval.**
5. **Record** the verdict in the review log, then commit.

**Useful tools:**
- `scripts/zoom.py`, `profile.py`, `silhouette.py` and `compare.py`, all taking `--panel N`.
- URL switches: `?freeze`, `?mask`, `?view=x0,y0,x1,y1`, `?orbit`, `?stage=`.
- **Dev server:** `preview_start` with the name `nox-3d-spike`. Its config is in the main checkout's `.claude/launch.json`, and it serves the worktree on port 5191.
- **Captures:** Playwright runs on system Edge (`channel: 'msedge'`).

## Owner preferences that matter

- **The base character is the foundation of everything.** The owner reviews every component, bit by bit, and wants the best possible look, not "good enough". The spike was approved for feasibility only.
- **Lightweight process:** commit per milestone, side-by-side captures, review in the browser. Do not follow the old Astra/Sol/Luna process in the main checkout's `AGENTS.md`.
- **Content:** storyboard text is used as marked placeholders until the owner supplies the real text.
- **Image generation:** the OpenAI key exists as a user-scope environment variable. The account had no credits on 2026-10-23, and the owner said they would add them. Load the key without printing it: `$env:OPENAI_API_KEY = [Environment]::GetEnvironmentVariable('OPENAI_API_KEY','User')`.
- **Known gaps for later tasks:**
  - Arms right under the head read heavier and flatter than the reference, and the long arms lie too horizontal (Task 11). Each cheek lobe meets T2/T7 where the painting has T1.
  - The last cup at each tip can hang past the rounded end of the arm, and at a steep 70-degree orbit an arm seen end-on shows a large pale highlight (rim terms add up at grazing angles).
  - The painting's face is not quite symmetric: its left brow sits lower and its left eye is wider. Ours are symmetric.
- **Perspective:** face features land about 4% further out in the render than in head-local units, because of the face's depth in the camera. The brow, eye, mouth and blush values compensate for this, so trace in render space.
- **Dev server:** if port 5191 is taken by an older Vite on the same worktree, `preview_start` moves to another port. The capture scripts still use 5191, which serves the same files.

## Resume point: Task 23 (entrance, panel 1), 2026-10-26

Presented to the owner as "Entrance v1" in the review log, on two checkpoint commits (base `d5ea0f3`); not yet approved or task-done. Green on the presented tree: `npm test` (37 files, 231 passed), `tsc -p tsconfig.app.json` and `tsc -p tsconfig.nox3d.json`, oxlint on the changed files (no new warnings), e2e 7/7, `check_stage` panels 1, 2, 3 and 5 PASS. Panel 4's cheek-blush sample sits on its tolerance, as it did before Task 23, so an occasional capture misses it by a point or two. Rulings are in the ledger as `Task 23: Ruling:` lines. Panel 1 still: `node scripts/stage-capture.mjs entering <out>`, then `python scripts/check_stage.py <out> --panel 1`. Motion: `node scripts/stepped-capture.mjs entrance <out> 1280 720` (`KEEP=<dir>` keeps the frames).

Waiting on the owner:
1. A verdict on Entrance v1. On approval, commit `feat(nox3d): swim-in entrance` and run `task-done PLAN 23 d5ea0f3 -- npm test`. Task 24 (the gate plate) comes after that approval, not before.
2. Still unanswered: should each arm's cup side be fixed from the intro pose?
