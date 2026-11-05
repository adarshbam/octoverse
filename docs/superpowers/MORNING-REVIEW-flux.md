# Flux: morning review list

Branch `claude/flux-world-overnight`. Overnight run: every owner gate was ruled provisionally; each item below is PENDING OWNER REVIEW.
Frame rates are labelled "under load" (three sessions shared one Intel UHD GPU).

## Status
- Milestones 1 to 4 complete (Tasks 1-13). Waiting at the Milestone 5 boundary on Veyra Tasks 16, 17 and 18. Everything below is PENDING OWNER REVIEW except the owner ruling below.
- OWNER RULING (not provisional): the Task 16 flourish contract. Flux adapts to the contract as landed at 4ff01e3: the flourish event is `{ arm, start }` (not `clock`); `settle` stays within 0 to 1 (at or below 1, not 1.4); there is no suppression hook, so Flux gets the idle pulse and unroll interplay another way with no engine change. Applied in Task 14.
- 2026-11-05 Task 10 (Milestone 2 world look) ruled provisionally; PENDING OWNER REVIEW.
- 2026-11-05 Task 11 (overview pose and dome, run early) ruled provisionally; PENDING OWNER REVIEW.
- 2026-11-05 Task 12 (P3 to P5 statics: pendant orbs, tech focus, detail) ruled provisionally; PENDING OWNER REVIEW.
- 2026-11-05 Task 16 (engine variant: pulse appear, lift pulse, swell reveal; Flux's orb values) built; PENDING OWNER REVIEW and PENDING ENGINE-OWNER REVIEW of the engine commit.

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
### Task 12: P3 to P5 statics, pendant orbs (PENDING OWNER REVIEW)
- **Commit:** "feat(flux): P3 to P5 statics (provisional, pending owner review)".
- **Files:** `src/worlds/flux/{artifacts.ts,artifacts.test.ts,slotCriteria.ts,poses.ts}`.
- **What:** 16 pendant slots (8 tips at 1, then mids at 0.55 on T1, T8, T2, T7, then T3, T6, T4, T5; at most 2 an arm); orbs radius 0.28, no thread, violet-pink cap `#b58fd0`, rim `#bec0e8`, no rim beads; choosable in the overview only. The overview arms were re-shaped round the orbs (Task 11's trace gave mid orbs -0.37 into other arms). Tech focus pose: T8 straight up, tip orb high (P4). Detail pose traced from P5.
- **Stills** (`docs/superpowers/reviews/assets/flux/`): `overview-t12-p3-sbs.webp`, `overview-t12-wide.webp`, `overview-t12-slots-on-p3.webp` (geometry over P3), `overview-t12-phone-390x844.webp`, `techfocus-t12-p4-sbs.webp`, `techfocus-t12-pose-on-p3.webp` (geometry: the pose data, not the page), `detail-t12-p5-sbs.webp`, `intro-t12-caps.webp`.
- **Live:** `/?world=flux&stage=overview&freeze`, `&stage=techFocus&tech=github-actions`, `&stage=detail`.
- **Numbers:** 12 shown: clearance from other arms, face and panel 0.089 at rest (desktop), 0.029 at swing +-18 deg, 0.001 at +-25 deg; phone arms and face 0.089; orb-to-orb 0.243; orb-to-face 0.463; tech focus pose 0.064. 16 shown: -0.100 (the T3-T6 mids collide). Perf overview tier low under load: median 37.5 / 43.3 / 40.0 fps (three runs). check_stage `--panel 3`: 6 misses of 9 (headTop now ok, faceGlow now a miss).
- **Check:** 1) a ring of twelve orbs held by the arms, as P3; 2) the arms read as Flux's arms, not bent wire (they were redesigned); 3) the phone: the tray covers the four lowest orbs; 4) tech focus (see weak); 5) detail: Flux at the left, eyes where P5's are.
- **Known weak:** the engine draws the overview pose in the tech focus (`WorldHost` uses `returnTo`), so the P4 still shows the overview, dome open, a suction hold, and GitHub Actions on the T1 tip (order 0), not on T8; the intro shows 12 lavender cap dots at the slots (cap size is not scaled to zero with the orb) and runs the blow appear on invisible orbs; on the 390x844 phone the sheet and tray cover the T3-T6 tip orbs (thread clearance -0.28, below the brief's 0.05; a known-limit test pins it, the world cannot meet spec 7.11 alone); the T1/T8 mid orbs sit 0.017-0.037 from the dome rim; the arms' silhouette IoU against P3 was not re-measured; logos blank for githubactions, aws, bash (R17); detail head a little wider than P5 and a closed smile (P5 open).
- **Engine-owner items:** allow pendant `sizes.intro` 0 and `tether.width` 0 (validator; 0.001 used); scale or hide the orb cap with the orb; draw `poses.techFocus` (or Task 16 armLift) and hang the focused tech on its arm; the phone overview (spec 7.11: Flux in the upper screen or the hanging orbs hidden where the tray lists them); the swing envelope (+-18 deg leaves 0.029; Task 16 must keep the swing small).

### Task 13: back view, orbit review (PENDING OWNER REVIEW)
- **Commit:** "feat(flux): back view (provisional, pending owner review)". **No character change**: the back already meets the spec's lines, so nothing was edited (no `src/engine/**`, no `character.ts`, no test).
- **Stills** (`docs/superpowers/reviews/assets/flux/`): `back-t13-yaw-0-45-90-180.webp` (the four yaws), `back-t13-yaw180-2x.webp` (the back at 2x).
- **Live:** `/?world=flux&stage=intro&freeze&yaw=180` (also 45 and 90; add `&solo` to hide the placeholder orbs).
- **Numbers** (506 x 504 at scale 2, same head area at every yaw): sparkle specks on the head (blob count) 58 at yaw 0, 93 at 45, 91 at 90, 61 at 180. Rim colour at the head's left and right edge (3x3 mean) at 180: (77, 122, 244) and (86, 112, 254) against (83, 128, 244) and (85, 111, 253) at 0. Crown at 180 (71, 107, 236), at 0 (72, 108, 236). The warm core shows through the back's lower middle at (255, 171, 255). Cup-pink pixels outside the head: 8322 at 0, 7421 at 45, 3324 at 90, 1217 at 180. `check_stage --world --stage intro` on a fresh yaw-0 capture: the same 3 known misses (mouthInside 35.2, armTopHighlight 31.8, cupGlow 25.7), nothing new.
- **Check:** 1) the back is a round glass dome with the blue crown on top and a blue rim round the whole edge; 2) the sparkles are as dense as the front; 3) the pink glow showing through the lower back (do you like it as translucent jelly, or should it be cooler?); 4) the cups from behind (see weak).
- **Known weak:** the cups hardly read from behind (1217 pink px against 8322 in front): they sit on the arms' undersides, which face away from a camera behind and above, so the back shows only a pink underside edge light and a hint on the lower tip curls. The brief wanted them to read; fixing it needs the cups to wrap further round the arm, which moves the front. The two lower centre arms meet in a hard pinched seam with a dark notch under the head at the back. The warm core is a bright magenta-pink hotspot on the back's lower middle (jelly translucency; a stronger pink than the front's pink-white). The pink fin behind the head is the world kit (also at yaw 0), not Flux.

### Task 14: motion personality and the idle pulse (PENDING OWNER REVIEW; motion is checked live, no video)
- **Owner ruling (not provisional), recorded and applied:** Flux adapts to the Task 16 flourish contract as landed. The event is `{ arm, start }`; `settle` stays 0 to 1; there is no suppression hook and none was added, so the idle pulse fires alongside Veyra's tip unroll. `flourish.ts`'s exported contract is unchanged.
- **Commits:** "feat(engine): flourish pulse share (for Flux)" (`Personality.flourishPulse`, its clamp and bundle check, `subscribeIdlePulse` in `cupPulse.ts`, the Octopus wiring) then "feat(flux): motion personality and idle pulse".
- **Values:** `settle` 1, `glideBias` 0.55, `flourishRate` 10, `flourishPulse` 0.75.
  - `settle` 1: the scale cannot exceed 1, so the springy 140% is the base `micro.settle.amount` 0.042 (already there), taken whole. The entrance arms' run past the intro pose is Nox's full one, not 140% of it (the only part of the spec's 140% that cannot be had under the 0 to 1 rule).
  - `glideBias` 0.55 shortens the glide, so `swim.glide` is restated to 0.5818 (0.32 / 0.55), as Veyra restated hers: the effective stroke stays the spec's 0.38 / 0.16 / 0.32 = 0.86 s and `FLUX_STROKE_SECONDS` holds (its test now reads `strokeTiming`).
- **Cadence (measured):** the scheduler waits 4.8 to 8 s (mean 6.4 s, 9.4 flourishes a minute), so the plan's numbers do satisfy 6 to 10 s: over 200 seeded 600 s runs, 93.2 flourishes and 69.8 pulses per 600 s, one idle pulse every 8.59 s on average. A single 600 s run ranges 7.4 to 10.3 s across seeds (a short run can drift just past 10 s by chance; the tests pin seeds 1 to 12).
- **How it plays:** each flourish rolls a 0.75 chance; on a hit the arm's cups run the pulse (0.9 s) in the same frame, on the frame clock the cups read. The tip unroll still plays on every flourish (3 s), so the pulse travels while the tip uncurls and has gone before the unroll peaks. The fourth flourish in four is the unroll alone (the spec's tip flick). An arm that is lifting never flourishes or pulses; with reduced motion no flourish plays, so no idle pulse fires (the explicit flush guard drops any too).
- **Check live:** 1) idle pulses about every 6 to 10 s on a random arm, never two at once; 2) the pulse runs root to tip while that arm's tip curl slowly unrolls (alongside, as ruled: confirm it reads as one gesture, not two competing ones); 3) about one flourish in four unrolls with no pulse; 4) with the system reduced-motion setting on, no idle pulse and no unroll; 5) Nox and Veyra show no idle pulse (they subscribe nothing).

### Task 15: entrance with the portal run (PENDING OWNER REVIEW; motion is checked live, no video)
- **Commits:** "feat(flux): swim open and trail poses from P1", "feat(flux): entrance sheet, portal props and kit drives", "fix(flux): entrance enters at the frame edge, arcs dark before the run", then the docs commit "feat(flux): entrance with the portal run (provisional, pending owner review)". No `src/engine/**` edit.
- **What it does (5.0 s):** bursts in across the left edge by 0.3 s at 2.6 units/s; five quick strokes (surges at 0.59, 1.11, 1.63, 2.15, 2.67 s; the stroke clock runs 0.52 s a stroke, 1.65x his own 0.86 s timing, as Veyra's ruling); arcs 1 to 4 peak at 2.30, 2.45, 2.60, 2.75 s (dark 0.35, flash 5, settle lit 3), disc flash 1.4 at 2.95 s; overshoot +0.25 in x at 3.32 s, back on the spot at 3.6 s; turn of pi 3.6 to 4.2 s with a 0.14 bounce; arms pop open 4.2 to 4.65 s, settle to 5.0 s. Key `octoverse.flux.entranceSeen`. Reduced motion: the intro pose, the arcs rest lit (3).
- **Stills:** `docs/superpowers/reviews/assets/flux/entrance-t15-stills.webp` (t = 0.3, 1.5, 2.6, 2.95, 3.3, 4.0, 5.0 at 1280 x 720, plus the ring at 1.5 / 2.6 / 5.0).
- **Live:** `/?world=flux` in a fresh tab (or clear sessionStorage `octoverse.flux.entranceSeen`); a still at a time: `/?world=flux&stage=entering&freeze&t=2.6`.
- **Check live:** 1) energetic, not frantic (speed about 1 unit/s in the glides, 4 at a surge; is the surge pulse too jerky?); 2) the portal run reads as a pipeline going green; 3) the overshoot and spring-back feel playful; 4) the turn and the pop-open land on the smile; 5) skippable at any moment (the Skip intro button).
- **Rulings (provisional):** the swing round in the brake plus the pi turn make one 295 degree twirl (he swims in facing right three-quarter, P1, and the glide-turn starts from his back, as Veyra's 280); Flux's `gentle` face is set to his intro smile, so the engine's settle face is the intro face (no close-then-pop of the mouth at the hand-over); the arrival wiggle is quicker (arms flick with the first rock).
- **Known weak:** the portal run is subtle: the lit inlays are small strips, the brightest ring pixel goes 70 to 118 (luminance p99) at the flash and rests at 93 lit, still blue not green, and on 16:9 only the ring's left half shows (the right half is off-frame); the disc flash (1 to 1.4) does not read in a still. The brake's "arms flared forward" reads as the arms dropping under him, not flaring. At 3.3 s he shows his back mid-twirl. The surges are a strong pulse (1 to 4 units/s). The portal stays under the face glow (118 against 182).
- **Also weak / for the engine owner (Task 15):** there is no body bob in the arrival (the engine's arrival has only roll and armWave, so the happy bounce is in the entrance's turn); the arm reach is split in the clearance check (open swim pose 2.3 for 0 to 3 s, intro reach 2.05 for 3 to 5 s, because the stage spot is only 2.32 from the rack module; smallest gaps 0.35 swimming and 0.20 arriving, against a 0.15 threshold, and `settle` 1 lets the arms open about 4 percent past the intro pose around 4.4 to 4.6 s, not modelled); engine items: the entrance settle face is hard-wired to `gentle`, the clearance check has one open reach for the swim pose and the intro, and the stroke lead uses the stroke's own period so a faster clock amplifies `surge`.

### Task 16: pulse appear, lift pulse, swell reveal, swing (PENDING OWNER REVIEW; engine change PENDING ENGINE-OWNER REVIEW; motion is checked live, no video)
- **Commits:** "feat(engine): pulse appear and lift pulse (for Flux)" (`APPEARS.pulse` in `artifacts/pulseAppear.ts`, `ArmLiftSelect.pulse`, `fireLiftPulse`, `AppearConfig` member, bundle checks, TechBubbles and Octopus wiring), then "feat(flux): orbs appear and lift with the pulse" (Flux's values and tests). Nox's `blow` and Veyra's `bloom` and `armLift` behave as before (their tests and the full engine suite pass unmodified).
- **Values:** `appear { kind: 'pulse', step: 0.18 }`; `select { kind: 'armLift', ease: 0.3, scale: 1.25, threadShorten: 0, pulse: true }`; `placement.reveal { start: 0.35, span: 0.3, step: 0.03 }`; `placement.swing { maxAngle: 18 deg, settle: 0.8 }`.
- **How it plays:** after the entrance settles the arms fire in pairs (T1+T8 at 0, T2+T7 at 0.18, T3+T6 at 0.36, T4+T5 at 0.54 s); each orb starts to grow when its arm's band reaches its slot (fire time + slot arc / 1.33) and grows over 0.5 s with the bloom's own wobble. The whole appear is 1.79 s. In the intro the orbs are 0.001 across, so you see four pulse waves and no orbs. Opening the head (Explore) grows orb i from nothing to 0.28 over head-swell progress 0.35 + 0.03 i to that + 0.3 (orbs 12 to 15 are clamped to end at 1). Choosing an orb lifts its arm over 0.3 s and runs a pulse root to tip along it.
- **Differences from the brief (the landed contract wins):** `liftMs: 300` is `ease: 0.3` (seconds); `overshoot: 0.12` has no field (the release overshoot is the personality's `settle`, 1 for Flux, giving the engine's 0.1); `expression: 'focused'` is the arm lift's own (`SELECTS.armLift.reaction`) and Flux's tech-focus pose already wears `focused`. There was no "shared reveal reader" in the engine: `placement.reveal` was only read by the bloom, in seconds. With the pulse appear it is read in head-swell progress by the new `revealSize` (validated to start and span at most 1); the bloom still reads it as seconds. The head's progress is a new `BubbleState.swellProgress` (the old `swell` is the orbit push, 0 to 0.1).
- **Numbers:** swing clearance, 12 orbs at the overview, nearest other arm or face: 0.0893 at rest, 0.0537 at 10 deg, 0.0376 at 15, **0.0286 at 18 (positive; the swing as set keeps clearance)**, 0.0209 at 20, 0.0006 at 25. Sixteen orbs already collide at rest (-0.0996, slots 13 to 16, the known limit). A 3 units/s arm step swings the orbs at most 18 deg and the swing is under 1 deg by 0.8 s.
- **Check live:** 1) the four pulse pairs run out along the arms in the intro in pipeline order, with no orbs and no violet-pink caps in the intro (the caps now scale with the orb's reveal; this removes the 12 cap dots Task 12 noted, but is not seen live); 2) Explore: the tip orbs grow first, then the mid ones, finishing as the head settles, even when pressed while the pulses are still running (never a double grow, never a flicker); 3) hovering an orb snaps its arm up in 0.3 s with a pulse along the arm and the 1.25x glow, the face `focused`; 4) a quick sweep across six orbs gives at most three bands at once; 5) the swing is lively but tight, with no orb through an arm; 6) reduced motion: all cups light for 0.3 s, the orbs are simply there, no swing. 7) **watch a chosen orb overlapping a neighbour**: the chosen orb is 1.25x (radius 0.35) and its arm lifts; hover each of the twelve, with the swing running, and look for the orb or the lifted arm passing through a neighbouring arm, orb or the face.
- **Known weak (lifted orb clearance, measured in the arms' plane, not disclosed in the first pass):** the 0.0893 / 0.0286 figures above are for every orb at rest radius 0.28. The chosen orb is 1.25x (0.35): with the scale alone the worst of the twelve is -0.039 at rest (T8's mid orb), -0.088 at 15 deg of swing and -0.098 at 18 deg (T7's mid orb), so it overlaps a neighbouring arm (it is under the 0.05 threshold at every angle). With the arm lifted too (keyboard or tap lift: straight up and forward, rigid turn up to 0.9 rad, T8 on its traced lift) the plane measure is much worse: chosen orb -0.313 at rest, -0.391 at 15, -0.406 at 18 deg (T5's tip), and the other eleven against the lifted arm -0.334. The plane measure ignores depth (the lift also comes forward and the arms sit at different depths), so it overstates the overlap, but it is not a pass. Orb to orb the chosen 1.25x orb keeps 0.171 at rest (0.243 at rest radius). Pinned as known-limit tests in `artifacts.test.ts` (they flip when the lift or the slots are reworked); no engine change was made. Fix options for the engine owner: lift only toward the pointer (smaller turn), a per-arm traced lift for every arm, or a smaller `scale`.
- **Known weak / unverified:** all motion is unverified live (unit tests only; no browser was run). A lift on an arm without a traced lift (every arm but T8) turns the arm rigidly up to 0.9 rad about its root toward the pointer: it was not checked against the neighbouring arms' orbs, so look for an orb clipped by a lifted arm. In a fast sweep the later orbs get no pulse while three bands run (it is dropped, not queued); the lift itself still plays. The select pulse does not fire with reduced motion. A band takes 0.88 s but the lift 0.3 s, so the pulse outlasts the lift. The appear times the growth from the overview slots (Flux's intro and overview slots are the same). The cap/rim fix applies only to this appear (Nox and Veyra are untouched). Engine-owner review of the engine commit is pending (F2).

### Engine-owner item from the Milestone 6 merge (latent, not reachable in any shipped world)
- `TechBubbles.tsx` (orbStyle cap, about line 367) places Aether's orb-style cap at the raw thread end `points[TETHER_POINTS - 1]`, but Veyra's bloom and arm lift shorten the thread, the orb and the thread's own cap by `reach` (`bloom.thread` times `liftedReach`). A world that combines `orbStyle` with `bloom` or `armLift` with `threadShorten` above 0 would show the cap floating at the full thread end. Fix: `capAt = points[0] + (points[last] - points[0]) * reach`. Flux uses `appear` pulse and `armLift` with `threadShorten` 0, Veyra has no `orbStyle`, so nothing ships with it today.
