# Nox 3D build: handoff

Updated 2026-10-23. Read this first in a new session, then the files it points to.

## Where the work lives

- **Worktree:** `C:/Users/Dell/Desktop/Vibe-coding/OctoVerse/worktrees.local/nox-3d-spike`
- **Branch:** `feat/nox-3d`. Latest commit `15f750d` ("wip(nox3d): body-arm junction ready for owner review").
- **Main checkout:** `C:/Users/Dell/Desktop/Vibe-coding/OctoVerse` (branch `codex/nox-storyboard`). It holds the old SVG work, a dirty tree and 28 legacy deletions. Never edit, reset or restore it; only copy files from it.
- **Spec:** `docs/superpowers/specs/2026-10-23-nox-3d-design.md`. Section 8.0, the character upgrade, governs the current phase.
- **Plan:** `docs/superpowers/plans/2026-10-23-nox-3d.md`. 26 tasks, executed natively (`superpowers:executing-plans`, with TDD).
- **Ledger:** `.superpowers/sdd/2026-10-23-nox-3d/progress.md` (git-ignored). It holds every task's completion line and every `Ruling:`. Trust it and `git log` over memory.
- **Review log:** `docs/superpowers/reviews/nox-character.md`, with captures in `docs/superpowers/reviews/assets/`.

## Status

- **Phase A, foundation (Tasks 1–6):** complete. 29 Vitest tests pass and `npm run typecheck` is clean.
- **Phase B, character upgrade (Tasks 7–16):** in progress. **Task 7, the body–arm junction, is built and waiting for the owner's verdict.** The evidence is `docs/superpowers/reviews/assets/junction-v1*.png`. When the owner answers:
  - **Approved:** fill in the junction row of the review log, quoting the owner's words. Make the final Task 7 commit, `feat(nox3d): webbed body-arm junction`. Run `task-done` for Task 7 with base `df72210`, then start Task 8 (eyebrows).
  - **Changes requested:** keep iterating on Task 7 and re-review.
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
  - Arms right under the head read heavier and flatter than the reference, and the long arms lie too horizontal (Task 11).
  - The suckers are beads, not cups (Task 12).
  - The eyebrows are too faint to read (Task 8).
