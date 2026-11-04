# Flux: morning review list

Branch `claude/flux-world-overnight`. Overnight run: every owner gate was ruled provisionally; each item below is PENDING OWNER REVIEW.
Frame rates are labelled "under load" (three sessions shared one Intel UHD GPU).

## Status
- Milestones 1 and 2 complete (Tasks 1-10, plus early Task 8a and Task 11). Stopped at the Milestone 3 boundary: waiting on Veyra Task 13, Aether Task 12 (orbStyle) and E02 choosableIn. Everything below is PENDING OWNER REVIEW.
- 2026-11-05 Task 10 (Milestone 2 world look) ruled provisionally; PENDING OWNER REVIEW.
- 2026-11-05 Task 11 (overview pose and dome, run early) ruled provisionally; PENDING OWNER REVIEW.

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
- Engine-owner question for Task 9: the portal arcs and disc sit in a plain stone group and share the `stone` material until the baked near world exists, so an `emissive` drive on one arc would light all stone; `validateWorld` forbids emissive drives on glow and led nodes, so the arcs cannot simply become glow nodes. Resolved in Task 9: the arcs now have per-arc `_inlay` membrane nodes (see the Task 9 entry).
- Not guarded by a test: rock_c at (-5.3, -5.4) scale 0.7 sits under the bridge deck flange (top 0.69 vs 0.71); re-check if the bridge or rocks change.
- Stills (Blender Eevee, NOT the page: the world config is Task 9; flat stand-in materials, depth fog by distance, a violet blob for Flux, no camera tilt): `docs/superpowers/reviews/assets/flux/layout-wide.webp` (16:9 intro), `layout-wide-noflux.webp`, `layout-square.webp` (P2's square frame), `layout-plan.webp` (top-down: green corridor, cyan packet path, yellow reach circles).
- Numbers: portal at (6.2, -11.2), rotY -0.42, scale 1.15 (disc centre screen x 3.3 at the z = 0 plane); near towers at x -3.0 / 2.9, z -3.6 (screen -2.3 / 2.2, as P2's edge racks); bridge 4 segments from (-23.4, -14.5) to a deck end 1.9 in front of the disc; packets climb 1.2 from the deck into the disc; corridor (-12, 0.6) to (0, 0) clears every reach by at least 0.197 (rock_c at (-6.1, 3.7)).
- Check: 1) the portal right, partly hidden by the right rack (16:9) and off-frame on a square viewport (P2 shows none); 2) the bridge arch sits directly behind Flux's head in the intro (hidden there, visible in other stages); 3) the bridge reads as a mostly left-right pipe, arches seen at an angle, not a road into depth as in P1; 4) the packets' last hop rises from the deck into the disc; 5) towers are straight columns with little lean (kit look, Task 8a).
### Task 9: baked pipeline world, far plate, PIPELINE_WORLD (PENDING OWNER REVIEW)
- **Commits:**
  - 0735d61: portal arc inlay nodes and disc flow map.
  - ac60b27: config and scripts.
  - The final commit, "feat(flux): baked pipeline world and far plate".
- **Files:**
  - `src/worlds/flux/place/{config.ts,config.test.ts,far.json}`, `src/worlds/flux/bundle.ts` (`place` is now `PIPELINE_WORLD`).
  - `blender/pipeline/{bake_world,render_far}.py`.
  - `public/flux/world/near.glb`: 3,860,600 bytes.
  - `public/flux/world/far/far-{0,1,2}.ktx2`: 111,606 + 188,018 + 162,247 bytes.
- **Stills** (all in `docs/superpowers/reviews/assets/flux/`; the page, Edge, 1280x720):
  - `world-intro.webp`: `?world=flux&stage=intro&freeze`.
  - `world-intro-solo.webp`: `&solo`.
  - `world-overview-solo.webp`.
  - `world-far-plate.webp`: the three far cards composited over a navy gradient, as the resting camera sees them.
- **Live:** `/?world=flux&stage=intro&freeze&solo` and `/?world=flux&stage=intro`.
- **Numbers:**
  - Bake: 10 min 9 s on the CPU (Cycles; 256 direct / 96 indirect / 160 AO samples). Far plate: 5 min 13 s.
  - Lightmaps: lod0 is a 1024 atlas at 17.6 texels per unit; lod1 is 512 at 10.7.
  - Irradiance: up to 11.35, 0% over the encoding.
  - Placements: 14 LED emitter sets; 9 of 44 placements unread (unlit, or beyond the cut).
  - Far cards: 11.3%, 10.9% and 8.0% covered; mean fog 0.95, 0.81 and 0.64.
  - Visitor download: near + far = 4.32 MB; with kit.glb, 5.07 MB (under the 6 MB test).
  - Frame rate, under load: median 48.1 fps, slowest 10% 47.8 fps (intro, live, 240 frames). Task 6 stage-only was 73 fps (also under load); the world adds the baked near world, far plate, LEDs and packets.
  - Clipping (channels at 254+): the world adds none. The world's cyan peaks at 240 (LEDs).
  - Pixels at 254+ in two channels: 3,225 cup rims (R and B) and 2,662 white (eye highlights, title text). These counts are the same with the quick bake and the full bake.
  - The portal and ring spill lights are 12+ units from Flux; their skin ranges are 3 and 2.5. The bloom is unchanged from Task 6.
- **Rulings (provisional):**
  - The Task 8b arc-emissive finding is resolved on the world side, with no engine edit.
  - Each arc's inlay wedge is its own attached node, `portal_arc_<q>_inlay`, with its own `membrane` material (`inlayMaterials`). An `emissive` prop drive therefore lights one arc only.
  - The disc is `membrane` with a "Flow" UV (TEXCOORD_1).
  - Every non-LED emissive is below the face core (0.547).
  - The LEDs' intensity times the brightest LED colour is below the cup-glow luminance.
- **Check:**
  1. Navy water, and a light shaft from the upper right over the towers.
  2. The LED strips blink on the near towers (live) and do not outshine the cups.
  3. The portal disc reads as a dim white-blue membrane with a soft spill glow. At close range its flow lines look like crack lines; check whether that reads as glass or as damage.
  4. Far towers and two fish schools sit in the haze.
  5. Pink corals in the foreground at both sides.
  6. No red anywhere.
- **Known weak / not seen:**
  - The packets (cyan and lavender, on `paths.bridge`) were reported as not visible in any stage frame (corrected in Task 10: they are visible in the intro, one or two at a time, left of the left tower).
  - The violet-pink bridge spill shows only behind Flux's head in the overview.
- **Engine-owner items:**
  - No bubble density bias field, so "denser to the left" is not done (bubbles are uniform).
  - Motes take no sprite set, so the glyph motes are dropped (spec 12.6); motes are 0.
  - The far plate is KTX2, not webp (the engine loads only KTX2 cards).
  - Fish off at the low tier is already the engine tier default.
  - An `emissive` drive on a stone node is a no-op (the stone emissive is black).
  - Task 15 props must name the `_inlay` nodes, not `portal_arc_N`.
  - Membrane has no pulse, so the disc "breathes" only through its slow flow.
  - The R15 placeholders in `stage.glb` are still there (`PIPELINE_STAGE` and layout.test still use them).
  - `/favicon.ico` 404s on every page load; index.html has no icon link. This was there before Task 9.
  - Under load, the kit loader's 15 s timeout tripped twice while Blender was baking. It passed on retry.
- **Tests:** tsc clean, oxlint clean, flux 55/55.
  - `src/worlds src/engine`: 842 passed and 5 timed out under load (reviewTooling x3, Nox entrance, flux targets). All 5 pass when their files are re-run alone.

### Task 10: pipeline world look, Flux in the world, budget (PENDING OWNER REVIEW)
- **Commits:** ea5ded7 (world look values), then "feat(flux): pipeline world look (provisional, pending owner review)" (docs and stills).
- **Files:** `src/worlds/flux/place/config.ts` only (no rebake: none of the changed values is in near.glb's record); `docs/superpowers/reviews/flux.md` (Milestone 2 section).
- **Stills** (`docs/superpowers/reviews/assets/flux/`): `world-t10-intro.webp`, `world-t10-intro-solo.webp`, `world-t10-overview-solo.webp`, `world-t10-p2-sbs.webp` (P2 beside the world), `world-t10-p1-sbs.webp` (P1 beside the entering frame), `world-t10-portal.webp` (disc before/after), `world-t10-packets.webp` (live, 2 s apart).
- **Live:** `/?world=flux&stage=intro`, `&freeze`, `&solo`; `/?world=flux&stage=entering&freeze&solo`.
- **Numbers:**
  - check_stage in the world (`tier=high&solo`): the same 3 misses as Task 6 (mouthInside 35.2, armTopHighlight 31.8, cupGlow 25.7; engine gaps). Flux's samples moved by at most 0.1 delta E; water aura 5.8, mid 6.8, upper 7.1. Page without `&solo`: 5 misses, the same set as Task 6's page (placeholder orbs).
  - Perf, under load (shared Intel UHD), intro: tier low median 67.6 / 58.5 fps (slow10 29.9 / 27.0), tier high 26.2 / 23.7 fps (slow10 18.9 / 13.8). Floor 40 met; no spec 10.1 cut.
  - Portal region 99th-percentile luminance 73 (Task 9: 89); his face glow median 188. Red pixels outside Flux and the title: 0.
- **Changes:** portal disc lines tamed (edge about a third of the body: a line peaks near 1.4 times the body, was about 17 times); bridge arch glow tips 5 (legs and feet dark); coral glow 0.4; packets lighter and longer (0.55).
- **Ruling (provisional):** the packets are visible in the intro (one or two at a time, left of the left tower and beside his left arms), so the bridge layout stays; light, fog and LED intensity stay (baked; Flux's water samples pass).
- **Check (five things):**
  1. A sunken data centre, still underwater.
  2. The portal is focal but quieter than his face (is it now too quiet?).
  3. LEDs and packets alive but not busy (watch live).
  4. No tech clutter (left-edge arch sliver, bottom-left coral chunk).
  5. The camera hover is lively (Nox's amount at 1.2 times his pace).
- **Known weak:** the disc's brightest value (0.522) is only just under the face core's (0.547), a thin margin; racks darker and sparser than P2's (needs kit LEDs or brighter fill, a rebake); the disc lines still faint straight pieces at 3x (finer disc mesh needed); the disc centre reads as a faint darker halo; the entering frame's near arch is a tall flat violet hoop (P1: small rings on the deck); portal off-frame at P1's square frame; packets are flat bars; bubbles uniform; glyph motes dropped.
- **Tests:** tsc clean, oxlint clean, flux 55/55; `src/worlds src/engine` 845 passed, 2 timed out under load (reviewTooling check_stage spawn), which pass alone (3/3).

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
- Engine-owner gaps found while building Flux (worked around in the bundle): no tongue size field; `TITLE_ICONS` has only `flame` (Flux uses it as a placeholder); zero shells crashes (one plain shell used); `Kit.tsx` requires `chain` and `chain_lod1` nodes (placeholder triangles in `stage.glb`); no sparkle "twinkle faster" field; the jelly rim cannot be turned off at the bottom of the head; the core blends with the colour ramp through `max()`; `scripts/check_stage.py` silhouetteRows compared against a hard-coded `public/spike/Nox.jpeg` (Flux silhouetteRows removed); `scripts/side_by_side.py` and `scripts/zoom.py` are hard-wired to Nox's reference (Flux side-by-sides used a scratch script).
- Pre-existing, not caused by Flux: `world.spec:101` fails alone on the pre-change tree; the Nox kit loader times out at 15 s under shared-GPU load.

### Task 11: overview pose and dome (PENDING OWNER REVIEW)
- **Commit:** "feat(flux): overview pose and dome".
- **Files:** `src/worlds/flux/{poses.ts,character.ts,bundle.ts,bundle.test.ts}`, `src/worlds/flux/review/{p3_targets.json,stage_samples.json,targets.test.ts}`, `public/flux/ref/{p3.png,p3-mask.png}`, `scripts/ref_mask.py` (`--panel 3`; the P2 mask regenerates pixel-identical).
- **Stills** (`docs/superpowers/reviews/assets/flux/`): `overview-t11-p3-sbs.webp` (P3 beside the page), `overview-t11-wide.webp`, `overview-t11-dome-bottom-2x.webp`, `overview-t11-mask-diff.webp`.
- **Live:** `/?world=flux&stage=overview&freeze` (at a desktop size; under 768 px wide the panel is the phone sheet).
- **Numbers:** dome fit to P3's rim rms 0.0115 units; face anchor 0.03 from the dome bottom (test 0.1); panel box inside the dome with a 0.04 margin at three viewports; arms within 0.03 of their P3 traces; silhouette IoU 0.726 vs P3's mask (P3 paints ten tentacles); check_stage `--panel 3`: 3 of 9 colour samples ok (rims are thin lines; the dome's inside cannot run bright-to-navy with one tint).
- **Check:** 1) wide blue glass capsule, electric-blue rim; 2) face at the dome's bottom, open smile; 3) arms in a ring round the dome (T1/T8 beside it); 4) panel inside the glass, buttons just above the face; 5) nothing of the dome crosses the eyes.
- **Known weak:** dome tint uniform (no navy-bottom gradient: engine); the sunk head top reads as a cut cup lip; the summary's last line touches the GitHub button at 1536 x 1024 (engine copy column 40% wide; Flux's copy is longer than Nox's); no screenshot in the panel yet; placeholder orbs (Task 12); lower arms a little thick and compact; tech focus now uses the overview arms.
- **Engine-owner items:** a dome tint gradient (top to bottom) field; the overview copy column width or overflow; the sunk mantle rim's look.
