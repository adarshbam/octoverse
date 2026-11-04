# Flux: morning review list

Branch `claude/flux-world-overnight`. Overnight run: every owner gate was ruled provisionally; each item below is PENDING OWNER REVIEW.
Frame rates are labelled "under load" (three sessions shared one Intel UHD GPU).

## Status
- 2026-11-04 setup done. Waiting on gate: Milestone 1 (E02 + Veyra Tasks 3, 4, 5). Task 8a (kit) built early; everything else waits on the gate.

## Items
### Task 8a: pipeline kit (built early, PENDING OWNER REVIEW)
- Files: `blender/pipeline/build_kit.py`, `verify_kit.py`, `public/flux/world/kit.glb` (commits 5601f25, 1b36cf9). 708-720 KB, 43.7k tris full + lod1.
- Numbers: LED mix blue ~50%, cyan ~38%, violet ~9%, amber ~3%, no red. Build is deterministic (same sha256 twice). `verify_kit.py` exits 0 (incl. check that the portal disc, not the bezel, is the front-most surface at r<1.7).
- NOT eyeballed: no renders were made. Check: tower ruin silhouettes and growth, portal ring plus disc, bridge arches (violet-pink), coral size (coral_a 7.4k tris).
- Known deferred minors: lod1 of tower modules 1+ not a silhouette twin (stale comment build_kit.py:366); rack_module/bridge_pier lod1 well under a quarter.
### Task 1 (built early, steps 1-4; PENDING OWNER REVIEW)
- Files: `public/flux/ref/p2.png` (byte-identical to native panel), `p2-mask.png`, `scripts/ref_mask.py`, `src/worlds/flux/review/*`, `docs/superpowers/reviews/flux.md` (commit a406f10).
- Numbers: all 14 samples within 1/channel of spec 2.1; mean inside mask (108,93,225), sat 0.657; arm span 3.97 (inside 3.8-4.2).
- Check: look at p2-mask.png beside p2.png (mask ignores title, nameplate, racks, bubbles; arm tips behind nameplate are cut at y 440).
- Still to do: `check_stage.py --world-id flux` run (waits on `E02 landed`).

### Task 2: Flux bundle, intro pose, stage backdrop (built early; PENDING OWNER REVIEW)
- Commit 6257acb. Capture `.tmp/flux-intro.png` (not committed; regenerate with the stage capture): eight arms in roughly the P2 pose on dark navy water; body is flat blue until Task 3; IoU vs P2 mask 0.79 (first trace, Task 6 tunes to >= 0.85).
- Check: arm layout against P2 (T1/T8 up beside head, T2/T7 wide, T3/T6 low, T4/T5 hang).
- Rulings to check: title icon is the flame placeholder (engine has no `gear` icon yet: engine-owner gap); tagline is the P5 subtitle with the spec sentence as the introduction (avoids a duplicate third line on the intro); orbs are one plain shell placeholder until Task 12.
- Gap: E02 baseline stills compared clean on 8 of 14 and the six Nox e2e specs were not run (Nox kit loader times out under load). Task 2 changed no engine code; rerun when quiet.
- Gap: `scripts/check_stage.py` hard-codes the Nox storyboard image for silhouette rows (engine owner).

- Task 8b (layout.json + layout.test.ts) still to do after Veyra Task 8 lands.

### Task 6: P2 look, Milestone 1 gate (PENDING OWNER REVIEW)

- **Files:** `src/worlds/flux/character.ts`, `poses.ts`, `place/config.ts`.
- **Stills** (all in `docs/superpowers/reviews/assets/flux/`):
  - `p2-gate-sbs.webp`: P2 beside the render.
  - `p2-gate-head-3x.webp`: the face at 3x.
  - `p2-gate-pulse.webp`: pulse @0.35 and @0.6.
  - `p2-gate-pulse-3x.webp`: the T2 curl at rest, @0.35 and @0.6.
- **Live:** `/?world=flux&stage=intro&freeze&solo`.
- **Numbers:**
  - check_stage: 3 misses, down from 10: mouthInside 35.2 (engine tongue gap), armTopHighlight 31.8, cupGlow 25.8.
  - IoU: 0.852, up from 0.805.
  - Gradient: 90.
  - Warm face: 198 / 88.
  - Pulse T2 @0.6: (152, 116, 246), brightest - smallest 130. Pulse @0.35: brightest - smallest 60.
  - Perf, under load: median 73.0 / 79.4 fps; slowest 10% 34.2 / 43.7 fps.
- **Check:**
  1. Blue crown, then violet, then warm pink face.
  2. Glassy, not plastic.
  3. Separate glowing cups.
  4. The pulse reads as living light, not LEDs (live).
  5. He is neither Nox nor Veyra.
- **Known weak:**
  - A blue root collar and a rim line under the mouth.
  - The arms are darker and more saturated than P2.
  - The T2 curl is small.
  - Few cups show on the right.
  - The sparkles are coarse.
  - Without `&solo`, the placeholder orbs show (Task 12).
- **Full entry:** `docs/superpowers/reviews/flux.md`, "Milestone 1 (P2 gate)".
