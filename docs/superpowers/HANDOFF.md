# Nox 3D build: handoff

Updated 2026-10-26. Read this first in a new session, then the files it points to.

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
- **Phase B, character upgrade (Tasks 7–16):** in progress. The owner has approved Tasks 7 to 15 (junction, eyebrows, eyes, mouth and blush, mantle, arms, suckers, skin, glow and material, motion). Each verdict is in the review log. The eyes were rebuilt from the owner's high-quality face reference (v4); the owner asked to keep them while sending a whole-character critique. Task 14 (glow, lighting and material) was approved at v3, which answered the owner's 12-point final-polish brief. Task 15 (motion) was approved at v1 (`scripts/motion-capture.mjs` records it). **Task 16: the owner signed off the base Nox on 2026-10-25.** Phase C: Tasks 17 (stage machine, pose blending) and 18 (framing, quality tiers) are done; Task 19 (overview, glass dome) was approved at v2 after the owner asked for a slower, smoother transition (they want the experience to feel calm, immersive and butter smooth). Task 20 (technology orbs) was approved at v2 after the owner's glass critique (sharp rim highlights, dark centres, vivid filled logos). Task 21 (tech focus) was approved at v2, which answered the owner's ten-problem motion brief on v1 (review log, "Tech focus v2"; its known gaps are listed there). **Now: Task 22, detail stage. v1 is checkpointed and waits for the owner's verdict** (review log, "Detail v1", which lists its known gaps and one open decision: which side each arm's cups face). After approval, commit `feat(nox3d): full project view` with the verdict, then run Task 23 (entrance). Panel 3 is traced from its high-quality image through `scripts/hq3.py`; the detail is captured at the HQ panel 5's own size (`node scripts/stage-capture.mjs detail <out>`, 1672x941; `VIEW=WxH SCALE=n` for other sizes) and checked with `python scripts/check_stage.py <out> --panel 5`. Record motion with `scripts/stepped-capture.mjs <scenario> <out> [w h]` (frame-exact on the page's clock; scenarios focus, rapid, idle, keys, phone, open, detail, journey; `REDUCED=1` for reduced motion), which replaces the real-time screencast for review videos because that drops frames under load.
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
