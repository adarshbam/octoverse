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
- Task 8b (layout.json + layout.test.ts) still to do after Veyra Task 8 lands.
