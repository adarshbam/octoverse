# Nox 3D build: handoff

Updated 2026-10-23. Read this first in a new session, then the files it points to.

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
- **Phase B, character upgrade (Tasks 7–16):** in progress. The owner has approved Tasks 7 (body–arm junction), 8 (eyebrows), 9 (eyes, then mouth and blush) and 10 (mantle, with round cheeks and bigger lashes added after their 2026-10-24 note). Each verdict is in the review log. **Next: Task 11, arms (`arms-left`, then `arms-right`).** Then come Tasks 12 to 15 and the Task 16 sign-off, each ending with the owner's approval.
- **Owner notes still open, raised on junction v1 (see "Change requests" in the review log):**
  - Arm volume and glow: the arms look flat (Tasks 11 and 14).
  - Skin colour variation and fine texture: the model looks flat (Task 13).
  - Suckers on every arm everywhere (Task 12). T4/T5 already carry theirs along the V.
- **Phase C, stages (Tasks 17–26):** not started. It is gated on the owner signing off the whole character in Task 16.

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
  - The suckers are beads, not cups (Task 12).
  - The painting's face is not quite symmetric: its left brow sits lower and its left eye is wider. Ours are symmetric.
- **Perspective:** face features land about 4% further out in the render than in head-local units, because of the face's depth in the camera. The brow, eye, mouth and blush values compensate for this, so trace in render space.
- **Dev server:** if port 5191 is taken by an older Vite on the same worktree, `preview_start` moves to another port. The capture scripts still use 5191, which serves the same files.
