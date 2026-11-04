# Flux: morning review list

Branch `claude/flux-world-overnight`. Overnight run: every owner gate was ruled provisionally; each item below is PENDING OWNER REVIEW.
Frame rates are labelled "under load" (three sessions shared one Intel UHD GPU).

## Status
- 2026-11-04 Milestone 1 complete (Tasks 1-6 plus early Task 8a), provisional owner gate. Waiting on gate: Milestone 2 (Veyra Tasks 8 and 10, plus the shared sand floor).

## Items
### Task 8a: pipeline kit (built early, PENDING OWNER REVIEW)
- Files: `blender/pipeline/build_kit.py`, `verify_kit.py`, `public/flux/world/kit.glb` (commits 5601f25, 1b36cf9). 708-720 KB, 43.7k tris full + lod1.
- Numbers: LED mix blue ~50%, cyan ~38%, violet ~9%, amber ~3%, no red. Build is deterministic (same sha256 twice). `verify_kit.py` exits 0 (incl. check that the portal disc, not the bezel, is the front-most surface at r<1.7).
- NOT eyeballed: no renders were made. Check: tower ruin silhouettes and growth, portal ring plus disc, bridge arches (violet-pink), coral size (coral_a 7.4k tris).
- Known deferred minors: lod1 of tower modules 1+ not a silhouette twin (stale comment build_kit.py:366); rack_module/bridge_pier lod1 well under a quarter.
### Task 8b: pipeline layout, LED nodes (PENDING OWNER REVIEW)
- Commits bbae5a0 (kit: LED nodes, radius extras), 2ad3ba9 (layout). Files: `src/worlds/flux/place/{kit.ts,kit.test.ts,layout.json,layout.test.ts}`, `blender/pipeline/{build_kit,verify_kit}.py`, `public/flux/world/kit.glb` (732,520 bytes, sha256 dd0c3e16..., same on two builds).
- Ruling R22 (provisional): the LED faces of tower_a/b/c and rack_module are their own top-level nodes `<piece>_led` (+ `<piece>_lod1_led`), attached to the piece via `kit.attached`, `led` on them via `ledMaterials(params)`. The engine draws attached nodes at one level only, so the full `_led` node stands over the lod1 tower too; lod1 towers now keep all three fallen modules so the lights stay on the plates. The `_lod1_led` nodes are in the file but not drawn.
- Ruling R15: no chain placeholder added; the engine already asks for `chain` only when the layout hangs chains (Flux hangs none).
- Engine-owner question for Task 9: the portal arcs and disc sit in a plain stone group and share the `stone` material until the baked near world exists, so an `emissive` drive on one arc would light all stone; `validateWorld` forbids emissive drives on glow and led nodes, so the arcs cannot simply become glow nodes.
- Not guarded by a test: rock_c at (-5.3, -5.4) scale 0.7 sits under the bridge deck flange (top 0.69 vs 0.71); re-check if the bridge or rocks change.
- Stills (Blender Eevee, NOT the page: the world config is Task 9; flat stand-in materials, depth fog by distance, a violet blob for Flux, no camera tilt): `docs/superpowers/reviews/assets/flux/layout-wide.webp` (16:9 intro), `layout-wide-noflux.webp`, `layout-square.webp` (P2's square frame), `layout-plan.webp` (top-down: green corridor, cyan packet path, yellow reach circles).
- Numbers: portal at (6.2, -11.2), rotY -0.42, scale 1.15 (disc centre screen x 3.3 at the z = 0 plane); near towers at x -3.0 / 2.9, z -3.6 (screen -2.3 / 2.2, as P2's edge racks); bridge 4 segments from (-23.4, -14.5) to a deck end 1.9 in front of the disc; packets climb 1.2 from the deck into the disc; corridor (-12, 0.6) to (0, 0) clears every reach by at least 0.197 (rock_c at (-6.1, 3.7)).
- Check: 1) the portal right, partly hidden by the right rack (16:9) and off-frame on a square viewport (P2 shows none); 2) the bridge arch sits directly behind Flux's head in the intro (hidden there, visible in other stages); 3) the bridge reads as a mostly left-right pipe, arches seen at an angle, not a road into depth as in P1; 4) the packets' last hop rises from the deck into the disc; 5) towers are straight columns with little lean (kit look, Task 8a).
### Task 1 (built early, steps 1-4; PENDING OWNER REVIEW)
- Files: `public/flux/ref/p2.png` (byte-identical to native panel), `p2-mask.png`, `scripts/ref_mask.py`, `src/worlds/flux/review/*`, `docs/superpowers/reviews/flux.md` (commit a406f10).
- Numbers: all 14 samples within 1/channel of spec 2.1; mean inside mask (108,93,225), sat 0.657; arm span 3.97 (inside 3.8-4.2).
- Check: look at p2-mask.png beside p2.png (mask ignores title, nameplate, racks, bubbles; arm tips behind nameplate are cut at y 440).
- Still to do: `check_stage.py --world-id flux` run (waits on `E02 landed`).

### Task 2: Flux bundle, intro pose, stage backdrop (built early; PENDING OWNER REVIEW)
- Commit 6257acb. Capture `.tmp/flux-intro.png` (not committed; regenerate with the stage capture): eight arms in roughly the P2 pose on dark navy water; body is flat blue until Task 3; IoU vs P2 mask 0.79 (first trace). Task 6 reached IoU 0.852 (provisional, see the Task 6 entry).
- Check: arm layout against P2 (T1/T8 up beside head, T2/T7 wide, T3/T6 low, T4/T5 hang).
- Rulings to check: title icon is the flame placeholder (engine has no `gear` icon yet: engine-owner gap); tagline is the P5 subtitle with the spec sentence as the introduction (avoids a duplicate third line on the intro); orbs are one plain shell placeholder until Task 12.
- Gap: E02 baseline stills compared clean on 8 of 14 and the six Nox e2e specs were not run (Nox kit loader times out under load). Task 2 changed no engine code; rerun when quiet.
- Gap: `scripts/check_stage.py` hard-codes the Nox storyboard image for silhouette rows (engine owner).

- Task 8b (layout.json + layout.test.ts): done, see its entry above.

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
  - Pulse T2 @0.6: (152, 116, 246), brightest - smallest 130. Pulse @0.35: brightest - smallest 60, but only 1 to 2 cups lit (target 3 to 5).
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
  - Pulse @0.35 lights only 1 to 2 cups, below the 3 to 5 target (T3 hides T2's root cups).
  - At 3x the resting T7 curl cup is 254, above the 250 brightness cap (holds at P2 size).
- **Full entry:** `docs/superpowers/reviews/flux.md`, "Milestone 1 (P2 gate)".

### Tasks 3, 4, 5: character, face, cup pulse (PENDING OWNER REVIEW)
- Task 3 (start values): mantle, arm and cup values per spec 7.8; sparkle density 70 (mantle) and 50 (arms), set above Veyra's so the jelly reads as Flux.
- Task 4 (face): two lashes, brow thickness 0.034, iris, blush, `happy` and `focused` expressions. Check the face against the P2 close-up.
- Task 5 (engine change, for the engine owner): one commit, 52d49ee, adds the travelling cup pulse (`src/engine/character/cupPulse.ts`, shader term only when a world configures `suckers.pulse`, idle value -1e4). Nox and Veyra shader programs are unchanged. Check: baseline stills were bit-identical except the known techFocus difference.
- Engine-owner gaps found while building Flux (worked around in the bundle): no tongue size field; `TITLE_ICONS` has only `flame` (Flux uses it as a placeholder); zero shells crashes (one plain shell used); `Kit.tsx` requires `chain` and `chain_lod1` nodes (placeholder triangles in `stage.glb`); no sparkle "twinkle faster" field; the jelly rim cannot be turned off at the bottom of the head; the core blends with the colour ramp through `max()`; `scripts/check_stage.py` silhouetteRows compared against a hard-coded `public/spike/Nox.jpeg` (Flux silhouetteRows removed).
- Pre-existing, not caused by Flux: `world.spec:101` fails alone on the pre-change tree; the Nox kit loader times out at 15 s under shared-GPU load.
