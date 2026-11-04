# Aether world: review notes

## Engine as landed

Scan run 2026-11-04 on branch `claude/aether-world-overnight` (HEAD 4abdaf7), command from Task 1 step 1:
`rg "export (const|type|interface|function) (WorldBundle|validateBundle|faceAnchor|HEAD_EFFECTS|PLACEMENTS|APPEARS|SELECTS|LIVE_ELEMENTS|KIT_MATERIAL_VARIANTS|WORLDS|resolveWorld|themeVars|clampCharacterConfig|resolveExpressions|choosableNow|assignPendants|tetherCurve|pendantSwing|threadClearance|armLiftTarget|layoutOrbits|orbitPoint|SurfaceLook|JellySettings|SuckerStyle|EntranceShape)" src/engine src/worlds`

Found (name: file):

| Name | File |
|---|---|
| `WorldBundle` (interface) | `src/engine/types/bundle.ts` |
| `validateBundle` | `src/engine/types/bundle.ts` (second argument `worlds` now defaults to `[]`) |
| `faceAnchor` | `src/engine/types/bundle.ts` |
| `EntranceShape` (interface) | `src/engine/sequences/keys.ts` |
| `HEAD_EFFECTS` | `src/engine/character/headEffects/index.ts` (`none`, `glyphs`) |
| `PLACEMENTS` | `src/engine/artifacts/strategies.ts` (`orbit`) |
| `APPEARS` | `src/engine/artifacts/strategies.ts` (`blow`) |
| `SELECTS` | `src/engine/artifacts/strategies.ts` (`suctionHold`) |
| `choosableNow` | `src/engine/artifacts/strategies.ts` |
| `layoutOrbits` | `src/engine/artifacts/bubbleOrbits.ts` |
| `orbitPoint` | `src/engine/artifacts/bubbleOrbits.ts` |
| `resolveExpressions` | `src/engine/behavior/expressions.ts` |
| `clampCharacterConfig` | `src/engine/config/validate.ts` |
| `themeVars` | `src/engine/ui/theme.ts` |
| `WORLDS` (const) | `src/worlds/index.ts`: `Record<WorldId, WorldBundle>`, `{ nox: NOX_BUNDLE }` |
| `resolveWorld` | `src/worlds/index.ts` |

Landed under another name than the draft scan: `WORLDS`. The draft showed `export const WORLDS = ['nox'] as const` in `src/engine/types/bundle.ts` (a list of ids). That list is gone from the engine; the shipped worlds now live only in the registry `src/worlds/index.ts`, and `WorldId` is a plain `string` (engine file comment: the registry's test, `src/worlds/index.test.ts`, holds the id rule). Aether's registration therefore touches `src/worlds/index.ts` only, not the engine.

Missing (not landed yet, as expected: they belong to Veyra's engine work): `LIVE_ELEMENTS`, `KIT_MATERIAL_VARIANTS`, `SurfaceLook`, `JellySettings`, `SuckerStyle`, `assignPendants`, `tetherCurve`, `pendantSwing`, `threadClearance`, `armLiftTarget`. A search of `src` for each name, and for `pendant` and `tether`, finds no file under any other name. (`src/engine/character/suckerRow.ts`, `suckerMaterial.ts`, `armChain.ts` and `armTube.ts` exist and are Nox-era arm and sucker code, none of the missing names.) The engine spec adopts Veyra's pendant helper names (`assignPendants`, `pendantSwing`, `tetherCurve`, `threadClearance`, from `pendant.ts` and `tether.ts`; orchestrator, 2026-11-03); this plan uses them. When they land under another name, use the landed name and record it here.

## Reference checks (Task 1)

- Panels: `public/aether/ref/p1.png` to `p5.png`, copied unchanged from `docs/design/references/Aether/native-panels/` (P1 510 x 504, P2 514 x 504, P3 509 x 504, P4 674 x 519, P5 861 x 519). Colour truth is these native panels only.
- P2 mask: `public/aether/ref/p2-mask.png`, made by `src/worlds/aether/review/make_p2_mask.py` (`scripts/silhouette.py` only prints head half-widths; it makes no mask). It covers the head and the eight arms and leaves out the title, nameplate, gold ring, seed beads, jellyfish and ruins. It is a colour-threshold mask (blue channel), not hand-traced: edges are good to about 4 to 6 px. Known flaws: the lowest arms are cut flat at y 439 where the nameplate starts, one spur of ruin glow touches the outer left arm near (75 to 95, 300), and arm-curl interiors are filled.
- `src/worlds/aether/review/targets.json`: the 31 samples (23 on P2, 8 on P1, P3 and P4; each equals the 5 x 5 mean of its panel within 1 per channel), the colour checks, the shape targets and the mean inside the mask.
- Mean colour inside the P2 mask: (153, 132, 227), saturation 0.459, brightness 0.898 (51017 px). Tolerance 12 per channel, saturation 0.04.
- **Task 6, mask hand-corrected** (`make_p2_mask.py` now records each correction, checked at 4x to 8x beside the panel): the tips beside the nameplate run on to y 465 (lower-left arm x 140 to 183, lower-right tip spiral x 345 to 409) instead of the flat cut at 439; the nameplate stays out; the ruin-glow spur above the outer-left arm is cleared above the arm's top edge (traced by eye between x 70 and 154; it was up to 15 px of glow at x 100 to 140); the eyes and small curl pockets are filled, the two water pockets inside arm loops (lower left x 121 to 151, lower right x 376 to 429) stay open. IoU with the old mask 0.927. Re-recorded mean inside: **(154, 133, 228), saturation 0.458, brightness 0.900 (51 793 px)**, in `targets.json` and `world_samples.json`. `targets.test.ts` pins the corrections (tips below y 440, no nameplate, no spur).
- `check_stage.py` files (E02's world-generic form): `stage_samples.json` (panel mode, `--panel 2`, reads `public/aether/ref/p2.png` as its high-quality reference), `world_samples.json` and `world_reference.json` (world mode; registration: origin (257, 252) = the P2 panel centre, 100 px per world unit, +y up).

## Task 2: bundle, character, intro pose and stage backdrop

Still: `.tmp/aether-intro.png` (1012 x 1008, intro frozen, `WORLD=aether node scripts/stage-capture.mjs intro .tmp/aether-intro.png`), and the side by side with `public/aether/ref/p2.png`: `.tmp/aether-intro-vs-p2.png` (both git-ignored). Colours were not tuned here (Task 6 does).

Verdict, by eye, honest:
- **Pose and silhouette: close.** Eight arms, the upper side pair rolling their tips down and in, the second and third pairs curling, the centre pair hanging, span and head size within a few percent of P2. The head reads a little smaller and rounder-topped than P2's; the arms' rest bend is a touch stiffer than the painted ribbons.
- **Colour: not yet Aether.** The dome is dark navy-violet where P2 is pale lavender with a blue-white crown sheen; the arms are saturated royal blue and opaque where P2's are translucent periwinkle with a pink-white glow along the underside; the cups are white rings, not a glowing beaded frill. The face glow (pink-white, below the eyes) and the eyes (violet irises, two catchlights, lashes, blush) are right in kind. Water is indigo (fitted to the P2 mid water), not black, with Nox's rays; no ruins, jellyfish or gold ring yet (later tasks).
- **Title block:** the engine's intro shows the project name ("AI Playground") as the big title and the epithet block under it; P2 has "Aether" large with "AI Playground" under it. The icon is Nox's red flame (the engine has no `ringedPlanet` icon: see below). Both are engine/UI matters outside this task.
- Start values to tune in Tasks 3 and 6: `armBody`, `rimTop`, `glow.ramp` upper stops, `halo`, `domeTint`, suckers, `skin`.

Theme sampling (build time, 3 x 3 means of the native panels): P3's View Project button runs lavender to violet left to right: `#b79bf8`, `#a68ff8`, `#8f73fb`, `#7b62f7` (top row of samples), so `accent` `#9a80f8` (their mean), `buttonFrom` `#b79bf8`, `buttonTo` `#7b62f7`. P5's Live Demo: `#b89ffb` to `#826cf9` (`liveFrom` / `liveTo`). P5's panel surface about `#081132` to `#0e1333` (surface `rgba(10, 16, 48, 0.92)`). The brief's `nameplateLabel: 'The Curious Mind'` is the epithet text; in the engine `nameplateLabel` is a colour (`#d8d0f8` here), and the epithet is `content.project.characterEpithet`.

Not as the brief wrote it (all because `src/engine/**` is not this task's to change):
- **`titleIcon: 'ringedPlanet'`** is refused by `validateBundle`: the engine's `TITLE_ICONS` (`src/engine/ui/titleIcons.ts`) has only `flame`. The theme uses `flame` until the engine gains a ringed planet. Needs an engine entry (a small SVG component and a test).
- **Zero shells** crashes the engine (`layoutOrbits`: `i % shells.length` gives `shells[NaN]`). The placeholder is one shell of radius 0 with bubble size 0, so nothing is drawn; Task 5 replaces it.
- **`kit piece missing: chain`**: `Kit.tsx` looks up the `chain` and `chain_lod1` nodes even when the layout has no chain, so `stage.glb` carries those two names as one-triangle stubs.
- The engine's logo table has no marks for OpenAI, React, Next.js, PostgreSQL, AWS or Vector DB: those orbs will show the lettered fallback until `LOGO_SLUGS` gains them.

## Task 3: jelly mantle and arms, star specks, pink-white cups

Aether now runs on Veyra's landed variants: `skin.surfaces` jelly on the mantle and the arms with sparkle, the cups' frill `style`, and `glow.underside` 0 (no red band). Start values are the spec 2.1 samples (the brief's hexes); Task 6 tunes to delta E 10 on the render.

Stills (intro, frozen, `WORLD=aether node scripts/stage-capture.mjs intro .tmp/aether-t3-intro.png`, vite on 127.0.0.1:5196): `docs/superpowers/reviews/assets/aether/t3-intro.png`; close-ups at 3x, P2 on the left: `t3-head-3x-vs-p2.png`, `t3-arm-left-3x-vs-p2.png`. The full side by side is `.tmp/aether-t3-intro-vs-p2.png` (not committed). No videos.

Sample delta E (CIE76, 11 x 11 capture px patch at each spec 2.1 P2 point, P2 px (x, y) to capture px ((x - 4) * 2, y * 2)), Task 2 still, then this one:

| Sample | Task 2 | Task 3 |
|---|---|---|
| Crown sheen | 41.2 | 5.4 |
| Upper dome | 44.3 | 6.4 |
| Forehead | 24.3 | 19.4 |
| Between the eyes | 31.7 | 35.6 |
| Face glow below eyes | 6.6 | 8.0 |
| Face glow below mouth | 20.3 | 20.3 (clipped white, unchanged) |
| Chin | 16.7 | 18.4 |
| Head side left / right | 20.3 / 33.5 | 15.6 / 13.3 |
| Blush | 4.7 | 4.4 |
| Arm body upper / lower | 56.5 / 14.0 | 21.6 / 22.5 |
| Arm top rim | 91.4 | 61.0 |
| Arm underside glow | 20.2 | 36.6 |
| Cup | 70.7 | 71.5 |
| Inside tip spiral | 23.3 | 14.8 |

The arm, rim, underside, cup and spiral points land on whatever the render's arm has at that pixel (the pose is not registered to P2's arms point for point), so read those rows as a rough guide, not a measure. `check_stage.py --panel 2 --world-id aether`: FAIL, 18 misses of 23 (max channel delta; exit 1 by design until Task 6), crown sheen, upper dome, face glow below the eyes, blush and arm body lower within its tolerance. The water, ruins, jellyfish and seed beads are later tasks.

Verdict, by eye, honest:
- **Mantle: better, not yet P2.** The dome now reads as blue-violet glass with a bright lavender-white rim all round, where Task 2 was dark navy. The upper dome and the crown hit their samples. Missing: P2's blue-white crescent sheen on the upper left (the crown term is a symmetric cap, so the whole top lightens evenly); the violet-to-pink band from the forehead down to the eyes is too narrow, so the face reads blue-violet down to the brows and then jumps to pink-white (forehead and between-the-eyes still 19 and 36 off). The face glow below the mouth clips to white (as in Task 2: the glow ramp and bloom, Task 6).
- **Star specks:** fine white specks over the head and along the arms, a few larger. A rough peak count on the still: about 22 on the head front between the crown and the brows (spec: at least 15). Along the arms well over 60 by eye (the automated count, about 220, also picks up cup rim highlights, so it is not a clean number).
- **Arms:** periwinkle glass with a thin lavender-white top rim and specks: right in kind. Body a little darker and more saturated than P2's. The lavender-pink underside glow P2 shows along each arm is mostly gone now the red band is off (`underside` 0): the jelly core warms only the roots. Task 6 needs another source for it (the cups' glow and translucency, or the halo band).
- **Cups:** pink-white rings round dark mauve hollows, separate and shrinking to the tip, along the outer edge of the curls. They read as small pale rings, not P2's bright glowing beaded frill: too small, too dim, the hollow too large for the rim. Task 6: cup size and spacing, `glow`, `rimWidth`.
- Nox and Veyra: no file of theirs and no engine file changed; their unit tests pass (Nox's skin program hash test included). No Nox/Veyra still compare was run for this task.

## Task 4: face, lashes and wonder expression

Stills (frozen, vite on 127.0.0.1:5196, `WORLD=aether node scripts/stage-capture.mjs intro <out> [expression=curious]`; note the URL key is `expression`, not `expr`): `docs/superpowers/reviews/assets/aether/t4-intro.png` and `t4-intro-curious.png`. Side by sides at P2's 3x scale (render left, panel right; the render is registered on the face plane, eye spacing to P2's): `t4-face-intro-3x-vs-p2.png`, `t4-eye-left-3x-vs-p2.png`, `t4-face-curious-vs-p4.png`, `t4-mouth-open-3x-vs-p4.png`, `t4-face-happy-vs-p3.png` (an extra capture, `expression=happy`). No videos.

What changed: `AETHER.expressions` overrides `gentle` (mouthOpen 0), `happy` (mouthCurve 0.75, mouthOpen 0.35, blush 0.4) and `curious` = wonder (the plan's values verbatim); every other face is the base one. Eyes rounder (rx 0.15 to 0.168, ry 0.17 to 0.16), pupil larger and round (rx 0.62, ry 0.58, drop 0.06), the small catchlight moved from lower right to upper right. The centre arms' roots (T4/T5) moved from y -1.0 to -1.14: at -1.0 their tops covered the lower half of the open mouth, so the wonder face showed only a thin dark band and no tongue (column through the mouth: dark from y -0.95 to -0.975 only, then white skin/arm). Mask IoU with P2: 0.7114 before, 0.7102 after (spec target 0.85 is Task 6's).

Numbers (CIE76; P4 samples against the intro capture with `expression=curious`, so a different camera from P4's tech focus):

| Point | Render | Target | delta E |
|---|---|---|---|
| Open-mouth inside | 161, 107, 135 | 119, 29, 73 | 29.2 |
| Open-mouth tongue | 254, 163, 183 | 253, 135, 143 | 16.8 |
| Blush (P2) | 253, 187, 217 | 250, 183, 206 | 4.4 |
| Face glow below the mouth (P2) | 255, 255, 255 | 254, 217, 240 | 20.3 (clipped, as Task 3) |

Palette values themselves are the samples exactly (`#771d49`, `#fd878f`, `#fab7ce`; delta E 0 in `face.test.ts`). Brow lift intro to wonder: about 0.02 world units at the brow's darkest row.

Verdict, by eye, honest:
- **Lashes: pass.** Two short lashes at each eye's upper outer corner, as P2.
- **Catchlights: pass.** A large one upper left and a small one upper right on both eyes, as P2, P3 and P4 paint them. Spec 2.3's words say "small lower"; the panels put it high, and the panels won.
- **Iris gradient: pass in kind.** Near-black top round a large pupil, violet middle, magenta-pink at the bottom with the pink pool. Eye shape now round like P2's. The pupils render grey-violet (54 to 76 per channel), not P2's near-black: the face's lower half is lifted by the additive core-glow card in front of the face (`glow.core`, about +40 per channel at the mouth) and bloom.
- **Tongue visible: pass, colour off.** With the roots lowered the whole open mouth shows with the tongue at its bottom. But the inside reads mauve, not P4's dark plum (delta E 29), and the tongue paler (16.8): same lift as the pupils. Task 6 owns the glow and bloom (`glow.core`, the ramp's white top, `post.bloom`).
- **Mouth shape: partial.** P4's open mouth is a D: a shallow top line and a big round bottom, the tongue filling nearly half. The engine's open smile keeps the closed smile's curved top, so the wonder mouth is a V/U with a small tongue ellipse (a third of the depth, 0.32 of the width). The layout cannot make the D without changing the closed smile: an engine limitation, left as is.
- **Happy (P3): close.** A smaller open smile with the tongue showing, about P3's size.
- **Brows: pass.** Thin dark arcs set high; P2's right brow sits a little higher than the left (her head tilt), ours are symmetric.
- **Intro soft smile: pass.** Width and curve match P2 within a few px at 3x. The face glow round it still clips white (Task 6).

## Task 5: the gold ring (engine `satellite` placement, ring form)

Stills (frozen intro, vite on 127.0.0.1:5196, `WORLD=aether node scripts/stage-capture.mjs intro <out> tier=high`): `docs/superpowers/reviews/assets/aether/t5-intro.png`, and the side by side at P2's 3x scale, `t5-ring-3x-vs-p2.png` (render left, P2 right, the world box x -1.55 to 1.65, y 0.3 to -0.9; dashed guides at y -0.28, the ring's centre, and y -0.68, the eyes). Overview and detail were captured too (not kept): no ring and no orbs in the overview, as this task wants; in the detail the ring is drawn but her body still sits behind the panel (the detail pose is Task 13). No videos.

What changed: Aether's artifacts are the engine's new `satellite` placement. The ring: radius 1.25, centre y -0.28, tilt 1.36 rad (nearly edge-on, its front arc the lower one, seen from above as in P2), roll 0.14 rad (right side 8 degrees higher), five beads at 72, 126, 180, 234 and 288 degrees from the camera direction, each swaying +-12 degrees with its own 6 to 9 s period, never inside the face's +-45 degrees. One line batch (ring and constellation lines), 1.5 px at P2's size; lavender glass beads with a gold edge, beads 1 and 3 lit gold with the orb halo. `choosableIn` is now `['overview']`: the intro has no orb buttons and no tray, and the keyboard goes from the skip link to Explore (`tests/e2e/aether.spec.ts`).

Numbers: the projected ring at P2's camera has half-width 1.25 and centre y -0.28 (unit tests; review targets 1.15 to 1.35 and -0.33 to -0.23). In the still, the line's extreme points sit at x -1.16 and +1.35 including the beads at its ends, centred on the head's axis (x 0.07).

Verdict, by eye, honest:
- **Ring at brow height: pass.** It crosses behind the head between the brows and the crown and comes round at the sides at brow-to-eye height, as P2. Right side higher, as P2.
- **Beads at the sides and behind, nothing over the eyes: pass.** Two beads on each side, the fifth behind the head (hidden by it, see below). The face's sector holds no bead and no line.
- **Front arc: differs from P2.** P2 draws the front arc to the head's outline on both sides. Ours fades out over the keep-out (+-45 degrees plus a 10 degree ramp, as the brief says), so only short stubs of the front arc show beyond the beads. If the owner wants P2's longer front arc, the line's keep-out needs its own, smaller angle than the beads'.
- **Width: per spec, wider than P2's line.** The spec and the review targets ask for a projected half-width of 1.25; P2's own ring line spans about +-1.0 (its outer beads at +-1.2 to 1.5 are off the line). We follow the spec.
- **Beads: partial.** Right size (P2's are 10 to 18 px across), right places, gold rims; the lit ones read gold. They are flatter than P2's marbles: P2's unlit beads are dark blue-violet glass with a bright lavender rim and a white highlight, and its lit ones are saturated amber with a hot centre. Ours are the shared orb glass with a dim mauve body and a gold edge; the highlight arcs are too small to read at this size.
- **Rear bead: hidden, not dimmed.** Her jelly head is opaque to depth, so the bead at 180 degrees and the ring's back arc are hidden behind the head rather than seen dimmed through it (no extra pass, as ruled). P2 also hides the back arc behind the head.
- **Line: pass.** Thin warm gold, continuous; a little more tan than P2's brighter white-gold glow, which is the bloom's and Task 6's.
- **Back view (`t5-intro-back.png`, `yaw=180`): pass.** The ring and all five beads circle the back of the head; the line runs unbroken across the back and fades only on the face's side.

## Task 6: P2 look gate (Milestone 1), tuned to the targets; owner review PROVISIONAL

Base `992338f` (the gold ring); the hand-corrected mask is `1571dbd` (see Reference checks). Config only: `character.ts`, `poses.ts` (intro traces), `place/config.ts` (post). No engine file changed. Nox untouched; `boundary.test.ts` green.

How it was measured: `WORLD=aether node scripts/world-capture.mjs intro <out>.png "tier=high&kitwait=90000"` (514 x 504 at P2's registration, with its silhouette mask), then `python scripts/check_stage.py <out>.png --world --stage intro --world-id aether` (CIE76 on 7 x 7 px patches at the 23 spec 2.1 points; the brief's command lacks `--world`, and without it the panel mode's max-channel delta is used instead). The four checks, IoU with `public/aether/ref/p2-mask.png`, and head, eyes and span came from a scratch script using the rules of spec 2.1 and `targets.json`. Close-ups: `VIEW=506x504 SCALE=3 WORLD=aether node scripts/stage-capture.mjs intro <out> "tier=high&kitwait=90000[&yaw=35]"`. Vite on 127.0.0.1:5196 only. Evidence: `docs/superpowers/evidence/aether/m1/` (stills and `numbers.txt`). No videos.

### Rounds (samples within delta E 10, of 23; IoU raw / nameplate box left out)

The "Change" column for c1 to c5 groups several edits per round; only the round's numbers were logged, not a diff per edit. The final values are in the config and pinned by `character.test.ts`.

| Round | Change | Samples ok | IoU | Notes |
|---|---|---|---|---|
| r0 | Task 5 state, new mask | 1 | 0.714 / 0.749 | below the mouth G 255 (white): the pink check fails; forehead 18.7, between the eyes 35.9, top rim 59.5, underside 46.3, cup 42.8 |
| s1 | arms thicker, head 0.745 wide, top 0.19 | (shape only) | 0.745 / 0.789 | |
| s2 | traces refitted to the mask (offline fit 1), root radii 0.24 / 0.21 / 0.26 / 0.2, tip 0.045 | (shape only) | 0.790 / 0.828 | |
| s3 | fit 2, rear roots 0.25, taper power 2, head top power 2.3 | (shape only) | 0.795 / 0.833 | P2's two painted rear stubs cost 2675 px; edge error within 2 px is about 4400 px |
| c1 | glow ramp, reach up 0.72, core card dimmed, bloom threshold 0.8, vignette 0.4 | 7 | | head mostly in, water in |
| c2 | mantle depth and rim, aura 0.5 | 12 | | all head samples in |
| c3 | crown height 0.32 | | | crown too broad, reverted |
| c4 | T1 retraced, arm halo 0.07, underside band on (1.1, periwinkle to pink), cups bigger and tilted | | | underside, cup, spiral and arm body lower in |
| c5 | arm rim power 3 | | | top rim in |
| c6, c7 | cyan crown; T1 lowered | | | both regressed, reverted |
| c8 | arm crown white-pink, cup rim 0.4, hollow lighter | 18 | 0.793 / 0.830 | all four checks pass |
| c9 to c12 | arms darker, to chase the mean inside (c10: `armBody` #4a60e0 to #3e50d8, underside 1.1 to 1.0, cups 0.3 to 0.27, cup glow 1.3 to 1.25) | 14 to 16 | | arm samples broke, reverted to c8 (corrected wording, fix round 1: the backup `character.c10.ts` shows darkening, not lightening) |
| c13 to c15 | mantle rim recoloured (#e0bcf8, power 1.8), sparkle 45 on both | 18 | 0.793 / 0.830 | head sides 9.9 / 9.6, thin |
| c16 | one more curl point on T1, T2, T3, T7 | 17 | 0.795 / 0.832 | top rim 10.6 (T1's taper moved) |
| c17 | T1 back, T6 instead | 18 | 0.796 / 0.833 | four full curls |
| **c18** | T7's bend at x 1.04 eased | **18** | **0.796 / 0.834** | **final** |
| c19 | core card off (test) | 18 | | pupils unchanged (35 / 30): the card is not what greys them; reverted |
| c20 | bloom off (test) | 16 | | pupils near-black (11, 5, 31 / 7, 3, 25), but head sides 10.4 / 10.1 and the glow loses its softness; reverted |
| c21 | bloom 0.5, radius 0.6 (test) | 17 | | pupils 32 / 26, head side left 10.3; reverted |

### Final numbers (c18, `numbers.txt`)

| Sample | delta E | Sample | delta E |
|---|---|---|---|
| Crown sheen | 8.4 | Arm top rim | 5.8 |
| Upper dome | 2.0 | **Arm body upper** | **33.5** |
| Forehead | 7.6 | Arm body lower | 2.9 |
| Between the eyes | 2.6 | Arm underside glow | 4.3 |
| Face glow below eyes | 3.8 | Cup | 7.7 |
| Face glow below mouth | 6.9 | Inside tip spiral | 6.2 |
| Chin | 1.8 | **Gold seed bead** | **87.2** |
| Head side left / right | 9.9 / 9.6 | **Glass seed bead** | **43.8** |
| Blush | 5.5 | Water outside head / mid / upper | 3.4 / 7.8 / 6.2 |
| | | **Jellyfish bell / Ruin window light** | **51.5 / 64.2** |

18 of 23 are within 10. The five open ones, and why:
- **Arm body upper** (-1.03, -0.95): in P2 this point sits where T1 meets a painted rear stub (a ninth and tenth tentacle beside the head; Aether has exactly eight, spec 7.4). P2's two arm-body samples are 34.5 apart, so no single arm material meets both. The lower one is met (2.9).
- **Gold and glass seed beads**: the spec 2.2 ring (right side rolled up, beads at 72 to 288 degrees) puts the beads elsewhere than P2 paints them, so these points land on open water. Owner call: move the beads to P2's places, or drop these two samples.
- **Jellyfish bell, ruin window light**: backdrop pieces that arrive in Task 8 and later.

Checks (all pass): warm core 157 (>= 120). Pink not white: below the eyes R-G 40, G 215; below the mouth R-G 37, G 218 (needs >= 25 and <= 235; it was G 255 at r0). Periwinkle arms: B 245 / B-R 164 and B 240 / B-R 163. Indigo water: B 96, B-R 76.

Shape (all in range): head top 0.19, half-width 0.745 at y -0.38, centre x 0.065, arm span 3.85, eyes at y -0.65.

**IoU: 0.796 raw, 0.834 with the nameplate box left out. Below 0.85.** With P2's two rear stubs also left out it is 0.875. The stubs are the P2-only blobs beside the head, x -1.02 to -0.50 and 0.67 to 1.21, 2675 px. The rest of the gap is edge error of 1 to 2 px along the arms. Owner call: take the stubs out of the mask (they are not Aether's), or keep them in and keep 0.85 as the bar (meeting it would need a ninth and tenth arm, against spec 7.4).

**Mean inside the silhouette: misses.** Capture (169, 151, 239), saturation 0.389, brightness 0.940. Target (154, 133, 228), 0.458, 0.900. On average the arms read lighter and less saturated than P2's, whose arm interiors are darker indigo between bright edges. Darkening the arm body to fix this (c9 to c12) broke the arm samples, so the samples won. Spec 2.1 records the mean when H01 starts. (Superseded: fix round 1 meets it through the arms' jelly depth, below.)

### Close-up checklist at 3x (front and three-quarter, yaw 35)

Stills: `render-intro-front-3x.webp`, `render-intro-three-quarter-yaw35-3x.webp`. Side by sides, P2's 3x panel on the left: `p2-vs-render-head-3x.png`, `p2-vs-render-left-arms-3x.png`, `p2-vs-render-right-arms-3x.png`, `p2-vs-render-full-1.5x.png`.
- **Eyes: pass in kind, pupils not black.** Violet irises, two catchlights, a lash line. On the 3x still the pupils' darkest quarter reads (39, 36, 53) and (33, 29, 45); P2's is near-black (6, 2, 15). Better than Task 4 (54 to 76), but still grey-violet. The cause is bloom spilling from the bright face (c20: with bloom off they read 7 to 11), not the core card (c19). A fix that keeps the soft glow needs the bloom to leave the face decal alone: an engine follow-up.
- **Lashes, brows, blush, smile: pass.** The blush is a little smaller and fainter than P2's.
- **Face glow: pass.** Pink, not white, below the eyes and below the mouth.
- **Crescent crown sheen: miss.** The crown sheen colour lands (8.4), but the sheen is a symmetric cap. P2's is a blue-white crescent on the upper left. This needs an engine crown direction (follow-up).
- **Specks: pass.** 26 on the head front and 123 on the arms (white top-hat peaks on the 3x still, eye catchlights excluded; at a stricter threshold, 17 and 107).
- **Cups: pass in count and spacing, different in look.** Separate rounded cups shrinking toward the tip: pink-white rims round mauve hollows. They stand proud as round beads, where P2's read as a flat, bright scalloped edge. Owner to judge.
- **Curls: pass.** Four arms (T2, T3, T6, T7) turn 391 to 433 degrees at the tip. T1 turns 348, T4 306, T5 283, T8 276.
- **Ring: pass, at the limit.** Line width 1.49 to 1.60 px at 1x (median band crossing on the 3x still, anti-aliased fringe included; config 1.5).
- **Head shape: note.** At 3x the dome reads a little boxier than P2's (flatter top, straighter sides), though top, width and centre are in range.
- **Arms: note.** T7 shows a visible bend near x 1.0 (eased once in c18). In the three-quarter view the ring line passes just beside the left cheek.

### Budget

`WORLD=aether node scripts/perf.mjs "stage=intro&tier=low"`, twice back to back, under load (dev server, other sessions on the same Intel UHD): median **65.8 fps** (slow10 35.0) and **64.9 fps** (slow10 27.0). The 40 fps target is met; the speck lever was not needed (sparkle stays 45).

### Verdict, honest (not an approval)

In colour the character is close to P2: every head, face, arm, cup and water sample but one meets delta E 10, and the four checks pass. It is not yet P2 in three places a viewer will see: the pupils are grey-violet rather than black, the crown has no crescent, and the cups stand out as beads instead of a flat bright frill. The silhouette misses the 0.85 IoU bar, mostly because of P2's two extra stubs. The owner's live check decides.

## Task 6, fix round 1 (review of 24d27d6: gaps Aether can still close)

Same measures and rules as above. Config only (`character.ts`, `poses.ts`, `artifacts.ts`, `place/config.ts`); no engine file changed; vite on 127.0.0.1:5196. The final config is round c34, and the evidence in `docs/superpowers/evidence/aether/m1/` was re-captured from it. "Samples ok" counts out of 23. IoU is given raw / with the nameplate box left out ("like-for-like").

| Round | Change | Samples ok | Mean inside | IoU | Notes |
|---|---|---|---|---|---|
| c18 | start (Task 6 final) | 18 | (169, 151, 239), sat 0.389: miss | 0.796 / 0.834 | pupils (35, 31, 48) / (30, 27, 43) |
| c22 | bloom threshold 0.8 to 0.95; mantle rim power 1.8 to 1.6; ring line 1.5 to 1.4 | 18 | (167, 149, 239), sat 0.402: miss | same | pupils (15, 9, 34) / (11, 7, 28); head sides 7.8 / 6.4 (were 9.9 / 9.6) |
| c23 | per-point fit 1 of all eight traces on the c18 capture's mask | 15 | | 0.816 / **0.854** | T1 moved: underside 12.3, cup 16.2, tip spiral 21.7; pose reverted |
| c24 | arm crown #f8e8fd to #8ab0f8 (the pre-c8 periwinkle cap) | 17 | (155, 143, 238), sat 0.441: pass | | top rim 35.7 (the cap now covers the rim sample) |
| c25 | + arm crown height 0.55, arm rim power 2.2 | 17 | (157, 142, 238): pass | | top rim 40.1 |
| c26 | per-point fit 2 (T1 samples locked by offset); crown back to #f8e8fd at height 0.7 | 16 | (156, 139, 237): pass | 0.815 / 0.853 | top rim 67.9, spiral 20.7 |
| c27 | per-point fit 3 (T1's first points only) | 16 | pass | 0.810 / 0.848 | top rim 61.6, underside 22.2 |
| c28 | (pose c18) arm depth = P2's upper colour #5a82e2 at 1.0, crown height 0.42 | 18 | (156, 152, 235): G miss | | **upper 7.6, lower 27.3**: the two arm samples swap, see item 3 |
| c29 | arm depth #4b58e7 at 1.0, crown height 0.55 | 16 | (145, 132, 236): pass | | top rim 31.3, lower 10.9 |
| **c30** | arm depth #505ce2 at 0.8, crown height 0.42 | **18** | **(159, 142, 236), sat 0.423: pass** | 0.796 / 0.834 | colour final |
| c31 | c27's pose + underside 1.4 | 16 | | 0.810 / 0.848 | top rim 13.6, underside 30.6; reverted |
| c32 | per-point fit 4: T1 held still, T8's first points seeded higher toward the right stub | 18 | pass | 0.810 / 0.848 | |
| c33 | per-point refit on the c32 capture | 18 | pass | 0.812 / 0.850 | |
| **c34** | per-point refit on the c33 capture | **18** | **(158, 142, 237), sat 0.424, brightness 0.929: pass** | **0.812 / 0.8505** | **final** |

The per-point fit applies the predicted change in each arm's tube to the real capture's mask, so its estimate tracks the capture: it estimated 0.8505 for c33 and 0.8513 for c34, and the captures read 0.8501 and 0.8505.

### The six items, closed or not, with numbers

1. **IoU: met, at the bar.**
   - Like-for-like (nameplate box left out of both): **0.8505**, up from 0.834.
   - Raw: 0.812. With P2's two rear stubs also left out: 0.876.
   - T1 is held still, because five colour samples sit on it. Every fit that moved T1 reached 0.848 to 0.854, but broke two or three of those samples (c23, c26, c27, c31).
   - `character.test.ts` now pins the committed capture at >= 0.85.
   - The mask is unchanged. Taking the stubs out is an owner decision (MORNING-REVIEW).
2. **Seed beads: they cannot land inside the spec's ranges.**
   - The capture's beads sit exactly where the engine projects them at rest:
     - home 126 degrees projects to (0.99, 0.01); captured at (0.99, 0.02);
     - home 234 degrees projects to (-0.90, -0.25); captured at (-0.90, -0.25);
     - the other homes: 72 degrees at (1.30, -0.20), 288 degrees at (-1.13, -0.54), 180 degrees at (0.03, -0.02), behind the head.
   - P2's samples: gold at (1.06, -0.13), glass at (-1.04, -0.03).
   - The search covered the spec's ranges (projected centre y -0.33 to -0.23, half-width 1.15 to 1.35, right side 6 to 10 degrees higher), tilt 1.2 to 1.5, and any homes.
   - The nearest ring still passes **0.155** from the gold sample and 0.150 from the glass (roll 6 degrees, tilt 1.2, radius 1.175, centre y -0.24). A bead's radius is 0.075.
   - With the roll free, a ring hits both samples within 0.002: roll **-4 degrees** (left side higher), tilt 1.36, centre y -0.21 (projected -0.24), homes 123.5 and 248 degrees.
   - So P2 itself has the left side higher, against spec 2.2. The ring is unchanged.
3. **Arm body upper: one arm material cannot reach it.**
   - Profiles through both samples (`armprof.py`):
     - P2's upper point (154, 347) sits on a thin cyan streak, about 6 px tall, in the middle of T1 (R 86 to 121, G 129 to 156, B 217 to 249).
     - The lower point (160, 387) is indigo, on T2.
     - Both points sit about 0.05 above their arm's centre line.
   - The render gives them the same colour within delta E 2 under every arm material tried: c18 #5263f5 / #4d5df0, c28 #4e7eeb / #4f80ef.
   - c28 set the arm depth to P2's upper colour: upper 7.6, lower 27.3.
   - The periwinkle cap (c24) does put P2's cyan on T1 (delta E 4.9 at y 334). But it lands 13 px above the sample, on the arm's top, where it breaks the top rim sample (35.7).
   - Meeting both needs a per-arm colour (engine), or one sample moved.
4. **Ring line: set to 1.4.**
   - Measured 1.33, 1.49 and 1.49 px at 1x in the three bands; at 1.5 they read 1.49, 1.60 and 1.49.
   - `bundle.test.ts` pins 1.4.
5. **Pupils: a config fix was found.**
   - The bloom is one global pass: `post.bloom` in `place/config.ts`, drawn by the engine's `<Bloom>` in `WorldHost.tsx` with no selection.
   - Raising its threshold from 0.8 to 0.95 stops the pink-white face (luminance about 0.9) from blooming.
   - Darkest quarter at the pupils, at 1x: **(15, 9, 34) / (11, 7, 28)**; on the 3x still: (17, 12, 35) / (12, 8, 28). Before: (35, 31, 48) / (30, 27, 43). P2: (6, 2, 15) / (0, 1, 7).
   - The mantle rim power went from 1.8 to 1.6, which brings the head sides back to 7.8 / 6.4. With bloom fully off they read 10.4 / 10.1.
   - Trade-off: only near-white highlights bloom now, so the soft glow round her face and the haze round the cups are weaker than at 0.8.
   - The full fix is an engine request: a selective bloom that leaves the face decal alone.
6. **Mean inside the silhouette: met.**
   - (158, 142, 237) against (154, 133, 228) +-12; saturation 0.424 (range 0.418 to 0.498); brightness 0.929 (range 0.86 to 0.94).
   - The lever was the arms' jelly depth: #505ce2 at 0.8, was #5c74e6 at 0.4. The faces of the arms are now deeper indigo.
   - Arm body lower improved to 2.7. Top rim (6.7), underside (6.0), cup (7.1) and spiral (5.9) still pass.
   - `character.test.ts` checks the mean on the committed capture.

### Final numbers (c34, `numbers.txt`)

| Sample | delta E | Sample | delta E |
|---|---|---|---|
| Crown sheen | 8.9 | Arm top rim | 6.7 |
| Upper dome | 3.2 | **Arm body upper** | **39.4** |
| Forehead | 7.8 | Arm body lower | 2.7 |
| Between the eyes | 2.5 | Arm underside glow | 6.0 |
| Face glow below eyes | 4.1 | Cup | 7.1 |
| Face glow below mouth | 7.2 | Inside tip spiral | 5.9 |
| Chin | 6.1 | **Gold / glass seed bead** | **89.0 / 45.1** |
| Head side left / right | 7.8 / 6.4 | Water outside head / mid / upper | 4.2 / 8.2 / 6.0 |
| Blush | 5.3 | **Jellyfish bell / Ruin window light** | **51.9 / 65.3** |

- 18 of 23 samples are within 10.
- All four checks pass:
  - warm core 154;
  - pink not white: R-G 40 / 37, G 215 / 218;
  - periwinkle arms: B 240 / 239, B-R 166 / 158;
  - water: B 95, B-R 79.
- Shape: head top 0.19, half-width 0.745, centre x 0.065, span 3.88, eyes at y -0.656 / -0.647.

### Close-up checklist again (items the tuning could move), 3x front and three-quarter

- **Pupils:** near-black now (item 5).
- **Face glow:** pink, not white.
- **Lashes, brows, blush, smile:** unchanged.
- **Specks:** 23 on the head front and 111 on the arms (16 and 94 at the stricter threshold). Still above 15 and 60. The count dropped because the arms' deeper indigo lowers the top-hat contrast.
- **Curls:** four full (T2 379, T3 420, T6 387, T7 420 degrees).
- **Ring:** 1.33 to 1.49 px.
- **Cups:** separate and shrinking toward the tip, but still round beads rather than P2's flat scallops.
- **Crescent:** still a symmetric cap (engine).
- **New with the pose:** the right upper arm (T8) rises a little higher at its root.

### CIE76 in the test against check_stage.py

`character.test.ts` uses the same conversion as `check_stage.py`:
- the same matrix (0.4124564 ...);
- the same D65 white (0.95047, 1, 1.08883);
- the same f;
- the same 7 x 7 patch at the same rounded pixel.

Run on the c34 capture, the two agree within 0.05 on all 23 samples; the script prints in 0.1 steps. Head sides: TS 7.783 / 6.375, script 7.8 / 6.4.

### Budget

`WORLD=aether node scripts/perf.mjs "stage=intro&tier=low"`, twice back to back, under load:
- median **62.1 fps** (slow10 30.3);
- median **52.6 fps** (slow10 29.6).

The 40 fps target is met.

### Hand-off to Task 8 (backdrop)

Task 6 changed the world's post-processing in `place/config.ts` (`POST`). The change is global, not limited to the stage water:
- vignette darkness 0.8 to 0.4;
- bloom luminance threshold 0.66 to 0.8 (Task 6), then to 0.95 (fix round 1);
- bloom intensity 1.05 to 0.8.

The backdrop's glows (ruin windows, jellyfish) will bloom only above luminance 0.95. Tune the backdrop with these settings in place, or make its emissive parts brighter. Do not lower the threshold: lowering it greys her pupils again.

### Verdict, honest (not an approval)

This round improves every gap Aether could close in config:
- The IoU meets the bar: 0.8505, at the bar, with no margin.
- The mean inside her silhouette passes.
- The pupils are near-black.
- The ring line is within width.

Five samples stay open. Each needs an owner ruling (stubs, ring roll, per-arm colour) or waits for a later task (backdrop). The crescent and the bead-like cups are still unlike P2. The owner's live check decides.
