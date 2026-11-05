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

## Task 11: overview pose and dome (P3); owner review PROVISIONAL

Config only (`src/worlds/aether/poses.ts`, `character.ts`, `review/targets.json`); no engine change.

**Registration.** The overview frames P3 at 100 px to a world unit with the origin at the panel's centre (`AETHER_STAGE_FRAMES.overview` 5.09 x 5.04): world (x, y) = ((px - 254.5) / 100, (252 - py) / 100). A 509 x 504 capture with `view=-2.545,2.52,2.545,-2.52` is pixel for pixel P3: the eyes land at (225, 288) and (298, 288) against P3's (221, 289) and (300, 289).

**Pose.** P3 places her higher and a little left of P2 (eye line y 289 px, world -0.37; dome centred at x 256.5 px), at P2's size, so the overview body is (-0.05, 0.31). The eight arms (`OVERVIEW_TRACED`, world units, right side mirrored about x +0.02) form a horseshoe round her:
- T1/T8 climb the dome's sides and roll over at its top corners;
- T2/T7 run out level with the cheeks and curl up at the sides;
- T3/T6 sweep out low and curl up;
- T4/T5 hang from under the chin and turn out along the bottom.
Every root is the intro's root exactly (T4/T5 at y -1.14 under the open mouth), so nothing pops under the mantle at the change (test). The face is `happy`. The tech focus keeps these arms and this body.

**Face at the dome's bottom (how it is tested).** The plan asks that `faceAnchor(AETHER_BUNDLE, 'overview')` lie inside the dome's lower fifth. The anchor is the eye line, and P3 paints the eyes 24 px under the glass's seat (seat y 265, eye line y 289); a dome reaching down past the eye line would put the glass over the eyes and tint them. Nox's overview anchor is 0.17 under its dome's seat too. So the test holds the anchor within 0.28 of the seat (it is 0.23 under it), under the dome's middle, with the eye tops below the seat and the mantle closing inside the glass (fix round 1 tightened 0.32 to 0.28).

**Room for 16 orbs.** P3 paints more than eight tentacles, one orb per curl. With eight arms the pose leaves two points per arm (`OVERVIEW_ROOM`, arc fractions: a mid-arm point and a tip point; T4/T5's tip point is the low turn just before their short end curl). A 0.6 orb hung 0.16 under each of the 16 points (on the solved rest chain, seen from the camera) is at least 0.66 from every other, outside the dome, off the face and inside the frame (`poses.test.ts`). Smallest gap: T1@0.55 to T2@0.82, just over 0.66. Only four of the 16 also clear every arm tube (orb centre to arm line more than orb radius plus arm radius; `OVERVIEW_OPEN_WATER`, tested): T3/T6@0.6 (gap 0.04) and T4/T5@0.75 (gap 0.06). The other twelve overlap an arm by 0.01 (T1/T8@0.9 against the T2/T7 curls) to 0.35 (T3/T6@0.95 on their own curl), as several of P3's orbs sit over tentacles. (Corrected in fix round 1: the first text said eight were clear, judged by eye.) Task 12 chooses the real slots.

**Dome** (`dome`, authored in the head's space): centre (0.07, 0.355), half-width 1.38, half-height 0.805, power 3.2, mantle top -0.42 (the seat is at -0.45, so the face rises into the glass with no gap; the face decal is cut above the sunk top, and the eyes stay whole under the seat). Depth 1.0 (Nox and Veyra use 0.6), see below.

| Measure (settled, bare `?freeze`) | Target | Render |
|---|---|---|
| Half-width (white rim line, row y 190) | 1.38 +- 0.06 | 1.38 (x 118 to 394 px) |
| Top (white rim line, column x 256) | P3 y 105 +- 6 | 104 px |
| Centre x | P3 dome centre +0.02 | +0.015 |
| Seat | P3 about 265 px | 262 px |
| Glass bottom vs eye tops | eyes whole below the glass | seat 0.07 above the eye tops |

**Colour.** CIE76 on 5 x 5 patch means at the spec 2.1 P3 points, capture px = P3 px (`.tmp/t11/de.py`, the same Lab as `check_stage.py`; `check_stage.py --panel 3` has no panel 3 samples, and its composition mode compares masks only, so I computed it directly):

| Sample | P3 | Render (settled) | delta E | Render at `swell=1` |
|---|---|---|---|---|
| Dome interior upper (243, 125) | 59, 94, 226 | 70, 101, 221 | **7.9** | 6.2 |
| Dome rim (133, 190) | 73, 106, 209 | 79, 101, 216 | **8.4** | 17.2 |
| Dome top sheen (263, 108) | 164, 202, 253 | 157, 198, 255 | **3.4** | 49.7 |

(The settled column is fix round 1's, rim `#f4fff4`; the `swell=1` column is the first round's, rim `#ecffe4`.)

`swell=1` is one second into the opening sheet, where the morph is at its overshoot (about 1.05 of 1.07 at 0.85 s, settling by 1.3 s): the glass is 5% larger (half-width 1.455, top at 94.5 px), so the rim and top samples fall inside the glass. The settled overview (the sheet's end, `swell=1.5`) is what the targets describe.

Rounds (settled): c0 the start values (`#2a44c8`, `#7a9aff`, `#c4dcff`, depth 0.6) 18.4 / 16.8 / 25.5; c1 tint `#0c44ff`, rim `#b0e0ff`, rim top `#c8f4ff`: 1.0 / 28.6 / 23.9 (the rim sample sits 15 px inside the glass edge, where the engine's fresnel `pow(1 - n.v, 4)` gives under 0.02 at depth 0.6); c2 depth 1.0 (the sides turn away from the camera over a wider band): 2.9 / 19.7 / 4.2; c3 to c7 rim colour: the rim sample needs less blue and more red and green than the interior, and the rim is added over the same tint, so the rim token has to be a near-white with little extra blue (c3 `#f0ffc0` 6.8 / 7.9 / 3.4, a yellow cast; first final: tint `#0644f0`, rim `#ecffe4`, rim top `#c8f4ff`, sheen `#a4caff` unchanged: 8.0 / 7.5 / 3.5; fix round 1 rim `#f4fff4`: 7.9 / 8.4 / 3.4). A darker navy tint (`#0a2aa0`, closer to P3's lower glass) misses the interior and rim samples (29.4 / 18.9) and does not darken the lower corners, which come from the rim and the seat line, not the tint.

**What does not match P3 (engine limits):**
- P3's glass darkens toward the bottom: (135, 230) is (52, 60, 177) and (360, 255) is (45, 37, 98). The render is (135, 151, 255) and (148, 156, 248) there: the engine's dome shader has one tint, a rim colour for the lower 60% of the height, and a bright seat line along the bottom (`uRim * seat * 1.4`), so the lower corners and the seat read light where P3 is dark. Engine request below.
- P3's interior falls from the bright top to navy within 25 px (x 256: y 120 (33, 61, 186), y 128 (13, 37, 125)); the render's top band is flatter (y 128 (64, 95, 215)). The HTML project panel covers most of the middle in the live overview (`t11-overview-ui.png`).
- The sunk mantle shows a straight-sided lip between the face and the seat; P3's face blends into the glass.
- The arms keep their P2 thickness and cups, so the horseshoe reads heavier than P3's slimmer painted tentacles.

Stills (`docs/superpowers/reviews/assets/aether/`, render left, P3 right, vite on 127.0.0.1:5196, `WORLD=aether VIEW=509x504 SCALE=1 node scripts/stage-capture.mjs overview <out> "view=-2.545,2.52,2.545,-2.52&tier=high&kitwait=90000"`, bare freeze, the settled state; regenerated in fix round 1):
- `t11-overview-vs-p3.png`: the whole panel, registered;
- `t11-dome-2x-vs-p3.png`: the dome at 2x (P3 px 90 to 420, 80 to 300);
- `t11-orb-room.png`: the 16 room points with 0.6 orbs hung 0.16 below, drawn on the render (2x);
- `t11-overview-ui.png`: the live overview at 1280 x 900 with the project panel in the dome.
No videos. No fps measured here (three sessions on one GPU).

### Verdict, honest (not an approval)

The dome's size and place are P3's (half-width 1.38, top 104 px), the face sits at its bottom with the happy smile and whole eyes, and the three P3 dome samples are within delta E 10 on the settled overview (7.9, 8.4, 3.4 after fix round 1). The glass reads brighter and flatter than P3's, and its lower corners and seat are light where P3 is dark: P3's dark-bottomed glass needs an engine change. The horseshoe has room for 16 orbs that clear one another, the dome, the face and the frame; four of those points also clear the arm tubes; the other twelve overlap an arm. The owner's live look decides.

### Task 11, fix round 1 (review of 2b412c3)

**Settled-check rule (for Tasks 12 and 20).** Overview and dome checks capture the settled state (bare `?freeze` with stage=overview), never `?swell=1`. `swell=1` is the opening's overshoot (glass 5% larger), and there the rim and sheen samples miss (17.2, 49.7). A bare `?freeze` capture and a `swell=1.5` capture are the same pixels (max channel difference 0 over the whole 509 x 504 frame), so the first round's `swell=1.5` numbers were already the settled state. The bare-freeze path reproduces them: `WORLD=aether NOX_URL=http://127.0.0.1:5196 VIEW=509x504 SCALE=1 node scripts/stage-capture.mjs overview <out> "view=-2.545,2.52,2.545,-2.52&tier=high&kitwait=90000"` gives interior upper **7.9**, rim **8.4**, top sheen **3.4**, with the rim line at row 190 from x 117 to 394 (half-width 1.385), the top at 104 px and the centre at x +0.01.

**Rim colour (spec 7.2 asks lavender-blue): kept near-white, owner call.** P3's bright rim line, sampled at nine points (informational, not binding; the brightest pixel within 6 px of the line, 3 x 3 mean, `.tmp/t11/rim.py`):

| Point | P3 | Render, rim `#f4fff4` | delta E |
|---|---|---|---|
| left, row 150 | 227, 236, 253 | 228, 235, 245 | 3.4 |
| left, row 180 | 191, 204, 251 | 224, 228, 245 | 18.0 |
| left, row 210 | 209, 216, 254 | 215, 219, 253 | 2.5 |
| right, row 150 | 223, 233, 252 | 233, 240, 250 | 5.3 |
| right, row 180 | 170, 187, 241 | 244, 249, 255 | 34.5 |
| right, row 210 | 234, 238, 254 | 245, 251, 255 | 7.6 |
| top, column 200 | 162, 204, 242 | 197, 214, 234 | 12.7 |
| top, column 256 | 229, 247, 254 | 180, 199, 218 | 17.9 |
| top, column 310 | 173, 210, 249 | 185, 201, 217 | 13.7 |

Rim tokens tried (mean over the nine points; the binding sample (133, 190) must stay within 10):

| Rim | Rim-line mean | Binding (133, 190) |
|---|---|---|
| `#ecffe4` (round 1, mint) | 14.1 | 7.5 |
| **`#f4fff4` (chosen)** | **12.8** | **8.4** |
| `#ffffff` | 13.3 | 9.0 |
| `#f0ffc0` | 13.6 | 7.9 |
| `#e0fff0` | 14.0 | 9.5 |
| `#f4f4ff` (lavender) | 12.0 | 11.0, misses |
| `#e8e0ff` (lavender) | 12.6 | 14.5, misses |
| `#d0d8ff` (lavender-blue) | 12.8 | 15.6, misses |
| `#b8c4ff` (lavender-blue) | 14.3 | 18.9, misses |

The rim line saturates to near-white under bloom whatever the token (the means span only 12.0 to 14.3). The token mainly moves the binding sample, which sits 15 px inside the glass edge and needs less blue than the interior. Every lavender-blue rim misses it. So the single binding sample forces a near-neutral rim. `#f4fff4` is the closest to the rim line that keeps the binding sample (12.8, against the mint's 14.1); on the glass it reads lavender-white. A lavender-blue rim needs either the binding sample relaxed or the engine's `rimPower` / `rimStrength` (engine follow-up in MORNING-REVIEW-aether.md). Owner call.

**What depth 1.0 (Nox and Veyra 0.6) does to the lower corners.** Depth 1.0 turns the glass's sides away from the camera over a wider band, so the fresnel rim covers more of the lower corners and brightens them. With the final colours, depth 0.6 to 1.0:
- (135, 230): delta E from P3 19.8 to 37.3, L* 50.0 to 65.4;
- (380, 230): 15.8 to 38.1, L* 55.3 to 73.3;
- (150, 255): 26.5 to 28.2;
- (360, 255): 46.3 to 49.5.
At depth 0.6 the binding samples read 4.9 / 21.3 / 21.7 (rim and sheen miss). Depth 1.0 lands the rim sample, and the price is lower corners about 20 delta E further from P3's dark-bottomed glass.

**Tests.**
- The 16-orb test is retitled to what it asserts: the orbs do not collide with each other, the dome, the face or the frame.
- A new test checks that the open-water points (`OVERVIEW_OPEN_WATER`: T3/T6@0.6, T4/T5@0.75) clear every arm tube: orb centre to arm line more than the orb radius plus `armRadius` there, skipping the orb's own arm within 0.3 of arc length of the attach point.
- The face-anchor tolerance is 0.28 (was 0.32; actual 0.23).
- The `mantleTop - seat < 0.06` line is dropped (it restated config numbers).

Stills regenerated with the bare-freeze path and rim `#f4fff4`. No videos; no fps measured.

## Task 10: Aether in her world (Milestone 2 look gate); owner review PROVISIONAL

Config, layout and bake only (`place/config.ts`, `place/layout.json`, `place/far.json`, `near.glb` rebaked, far plate re-rendered). Two review checks are added (`review/portal_offframe.mjs`, `review/relic_entrance.py`). No engine change. Captures ran on 127.0.0.1:5196, with two other sessions on the same Intel UHD.

**How it is measured.**
- The binding capture is Task 6's: `WORLD=aether node scripts/world-capture.mjs intro <out> "tier=high&kitwait=90000"`.
- Then `python scripts/check_stage.py <out> --world --stage intro --world-id aether`. It compares CIE76 against P2's 7 x 7 patch means at the registered points of `world_samples.json`. So the targets are P2's patch means, not the spec 2.1 pixels.
- Then `.tmp/t6/measure.py` for the four global checks, IoU and shape.
- Its 514 x 504 page is a phone layout, so the world draws its phone tier: 4 jellyfish, 0.4 of the shafts, no fish or motes.
- A second capture of the same P2 box at the desktop tier shows what the owner's 1536-wide page draws there: 10 jellyfish and every shaft. It is 1028 x 1008 with `view=-2.57,2.52,2.57,-2.52`, downsampled 2:1.

### Rounds (23 samples within delta E 10; the world samples named)

| Round | Change | Within 10 | Water outside head | Upper water | Jellyfish bell | Ruin window |
|---|---|---|---|---|---|---|
| r0 | Task 9's world (BASE 81ab7e8) | 16 | 74.7 (a far window behind her head) | 21.9 (tower_d) | 58.5 (no jellyfish there) | 63.7 (tower stone) |
| j1 | layout.json: tower_a sunk 1.39 and 0.15 right (its window on (46, 225)), tower_d sunk 2.4; jellyfish region shifted so jellyfish 1 lands on P2's left one | 17 | 74.7 | **6.0** | 24.6 | 36.1 (on the amber window) |
| j2 | jellyfish region nearer (z -12 to -3.5), x and y re-solved | 17 | | | 19.6 | |
| j3 | bell `#e6b8ff` (paler) | 17 | | | 27.3 | |
| j4 | bell `#c4a0ff` (bluer) | 17 | | | 21.2 | |
| j5 | bell back to `#d49cff`, bell 3 px lower (the sample in its bright upper half) | 17 | | | **13.3** | |
| j6 | region nearer still (z -10 to -2.5) | 17 | | | 14.2; back to j5 | |
| w1 | tower_a's window `#ffc0a0` at 1.0 (the others stay amber) | 17 | | | | 11.6 |
| w2 | tower_a's window `#ffaa98` at 0.85 | 18 | | | | **2.2** |
| f1 | near.glb rebaked; far plate re-rendered: wall_b turned away (its window off her head), the far tower_a 2 to the right | 19 | **1.6** | 6.0 | 13.2 | 2.2 |
| d1 | desktop-tier capture of f1 | 18 | 1.8 | 14.3 (every shaft drawn) | 12.3 | 2.2 |
| d2 | world shafts `#3c64d0` / `#7898d8` (the stage keeps `#5a8cff` / `#9cc4ff`) | 18 | | 11.1 | | |
| d3 | world surface opening `glow.top` 1.2 to 1.0 | 19 | 1.9 | **9.4** | 12.4 | 2.2 |
| f2 | phone-tier capture of d3 | 19 | 1.9 | 4.6 | 13.2 | 2.2 |
| j7 | jellyfish size 0.16 to 0.36 (was 0.3) | 18 | | | 16.3; back to 0.3 | |
| f3 / d4 | final (= f2 / d3), captured again after the commit | **19** | 1.9 | 4.6 / 9.4 | 13.2 / 12.4 | 2.2 |

Rounds j1 to w2 ran with the new layout.json and the old lightmaps: the page places the pieces from layout.json, and the bake finished before f1. Her own samples did not move in any round (largest change 0.4, desktop tier).

### Final numbers (f3, phone tier, binding; d4, desktop tier)

| Sample | P2 patch | f3 | dE | d4 dE | r0 dE |
|---|---|---|---|---|---|
| Crown sheen | #93aaf8 | #b0abfe | 8.9 | 8.9 | 8.9 |
| Upper dome | #5c50f4 | #6556f7 | 3.2 | 3.2 | 3.2 |
| Forehead | #9b6cf8 | #8263f6 | 7.8 | 7.4 | 7.8 |
| Between the eyes | #fab7f1 | #fbbdf3 | 2.5 | 2.5 | 2.5 |
| Face glow below eyes | #fdd4e8 | #ffd7f3 | 4.1 | 4.1 | 4.1 |
| Face glow below mouth | #fdd8ef | #ffdaff | 7.2 | 6.5 | 7.2 |
| Chin | #c08af9 | #ac81f5 | 6.1 | 6.1 | 6.1 |
| Head side left | #8967e5 | #7766ef | 7.8 | 7.6 | 7.8 |
| Head side right | #8379f7 | #7f6bee | 6.4 | 6.3 | 6.4 |
| Blush | #fab5cf | #f7b4d7 | 5.3 | 4.9 | 5.3 |
| Arm top rim | #e0cef8 | #d1c4f7 | 6.7 | 6.7 | 6.7 |
| Arm body upper | #5a82e2 | #4957f0 | **39.4 MISS** | 39.4 | 39.4 |
| Arm body lower | #4b58e7 | #525def | 2.7 | 2.5 | 2.7 |
| Arm underside glow | #e8c3f8 | #d6b7f2 | 6.0 | 6.7 | 6.0 |
| Cup | #cdbcef | #e4ccfa | 7.2 | 4.7 | 7.2 |
| Inside tip spiral | #593f8d | #473d87 | 6.1 | 5.9 | 5.8 |
| Gold seed bead | #dfa58d | #141866 | **89.0 MISS** | 88.0 | 89.0 |
| Glass seed bead | #956d9e | #13175e | **44.4 MISS** | 44.4 | 42.9 |
| Water outside head | #0f1962 | #141863 | 1.9 | 1.9 | 74.7 |
| Mid water | #07154d | #0f1658 | 5.9 | 5.7 | 5.2 |
| Upper water | #022464 | #0d276e | 4.6 | 9.4 | 21.9 |
| Jellyfish bell | #9c7be1 | #9a71bf | **13.2 MISS** | 12.4 | 58.5 |
| Ruin window light | #b17979 | #b37775 | 2.2 | 2.2 | 63.7 |

- **Samples:** 19 of 23 within delta E 10 (r0: 16). Open: arm body upper and the two seed beads (owner decisions from Task 6, unchanged), and the jellyfish bell.
- **All four global checks pass:**
  - Warm core 154 (glow R 255, dome R 101).
  - Pink, not white: below the eyes R-G 40, G 215; below the mouth R-G 37, G 218 (desktop tier 35 / 220).
  - Periwinkle arms: B 240 / 239, B-R 166 / 158.
  - Indigo water: B 88, B-R 72 (desktop B 90, B-R 73).
- **Mean inside her silhouette:** (158, 142, 237), saturation 0.424, brightness 0.929, within the target.
- **IoU:** 0.8505 with the nameplate box left out (unchanged; raw 0.812). Head top 0.19, half-width 0.745, centre x 0.065, span 3.88.
- **Jellyfish bell, why it stays open.**
  - The bell is where P2 paints it: rim at P2 (81, 165), 18 px in radius (`config.test` pins it).
  - It reads (154, 113, 191) against P2's (156, 123, 225): the blue falls 34 short.
  - The engine draws the bell with a flat `MeshBasicMaterial` at opacity 0.75, fogged and tone-mapped, under the 0.95 bloom threshold. Its blue cannot climb: paler, bluer, nearer and larger bells all read further off (14.2 to 28.0).
  - P2's bells glow. Engine request in MORNING-REVIEW-aether.md.
- **Ruin window, how it was met.**
  - tower_a's window glows `#ffaa98` at 0.85. The other windows keep the amber `#ffa040` at 1.3.
  - P2's patch there is (177, 121, 121), a warm salmon light. The amber read (216, 136, 76), delta E 36.1.
  - `#ffaa98` is hue 10 degrees at an HSV saturation of 0.40. It passes spec 7.7's no-red rule (under 0.5), but it is the pinkest warm light in the world. Owner check.

### Relic intensity (spec 7.7)

**Entrance (t 3.2).** The stage camera at `stage=entering&t=3.2` does not frame the portal (Task 9). One frame holds both instead:
- The capture is a `view` window onto the same unmoved stage camera, `view=-3,4.165,9.5,-4.165` at 1250 x 833: `WORLD=aether VIEW=1250x833 SCALE=1 node scripts/stage-capture.mjs entering <out> "t=3.2&view=-3,4.165,9.5,-4.165&tier=high&kitwait=90000"`.
- She and the portal share one exposure, tone mapping and bloom.
- `python src/worlds/aether/review/relic_entrance.py <out> "-3,4.165,9.5,-4.165"` compares relative luminance Y (Rec. 709, linearised).

Results:
- **Portal region:** the hull of every portal node's box from kit.glb, placed as layout.json places the arch, with her silhouette left out. Its brightest pixel is Y **0.668**, (182, 217, 255) at (837, 538).
  - That pixel is a bubble rising in front of the steps.
  - The brightest pixel of the membrane, glyph and lantern regions is Y 0.545 (186, 190, 255), on the glyph.
  - Anything in front of the portal counts, so the test is stricter than the portal alone.
- **Her face glow** (the largest pink-white patch in her silhouette, 4008 px) peaks at Y **0.873** (255, 234, 255).
- **Verdict:** 0.668 < 0.873 (ratio 0.76): **pass**. Task 17 authors the real entrance; the script runs again on its still.

**Intro.** `NOX_URL=http://127.0.0.1:5196 node src/worlds/aether/review/portal_offframe.mjs [out-dir]`:
- It loads the frozen intro and reads the camera the page drew with (`window.__octoverse.camera`: place, facing after the lean, field of view, lens shift).
- It projects every portal node's box through that camera and counts the pixels of their hulls inside the frame.
- **0 portal pixels** at desktop 1536 x 1024, 16:9 1920 x 1080, 4:3 1024 x 768 and phone 390 x 844.
- The nearest portal point lands 249, 112, 251 and 185 px outside the frame.
- The projection was checked against the still: tower_a's window centre projects to (341, 456); the still shows it at about (340, 470).
- `layout.test.ts` keeps the geometric check of the unmoved camera.

### Budget (under load)

`WORLD=aether node scripts/perf.mjs "stage=intro&tier=low"`, three back-to-back pairs, all under load:
- Pair 1: **63.7** and **33.4** fps median (slow10 29.1 / 15.6). The second run drew 169 frames in 6 s; the others drew 295 to 350.
- Pair 2: 52.1 and 67.1 (slow10 27.9 / 31.4).
- Pair 3 (after the commit): 61.3 and 54.1 (slow10 29.9 / 28.5).

Five of six runs clear 40. The median of all six is 57.7. The one miss did not repeat in the four runs after it, so no spec 10.1 lever was taken:
- Fish are already off at tier low.
- The next lever (jellyfish 4 to 3) costs look for a dip that the shared GPU explains.
- If the owner's laptop misses 40, the order stands: jellyfish to 3, then rays, motes and bubbles, then the far plate.

### Anti-goals, by eye (stills below)

- **Jellyfish do not compete with her.**
  - Small (P2's left one at 18 px radius), lavender, flat, behind her.
  - 6 of 10 in the desktop frame, none over her or the title.
  - They read dimmer than P2's glowing ones.
- **Water indigo, not grey or black.**
  - Mid water (15, 22, 88), upper water (13, 39, 110): navy-indigo, brighter at the top under the shafts.
  - Two bubble discs near the camera read grey (desktop still, (188, 590) and (1380, 360)).
- **Warm windows.**
  - Present, but few and flat in P2's box: tower_a's salmon window on the left and faint far windows beside her head.
  - The desktop frame adds amber slits on the left and right towers.
  - P2's ruins are thick with warm lights, so the world reads sparser and darker than P2.
- **The ring reads against the water.** A thin gold line with bronze beads, clear on the indigo. The beads are dull next to P2's glowing gold and glass orbs.
- **Portal off-frame in the intro.** Yes, 0 px (above).

### Stills and numbers

All in `docs/superpowers/evidence/aether/m2/` (no videos):
- `t10-p2-vs-world-intro.webp` (P2 left, the binding capture right, 1.5x);
- `t10-p2-vs-world-intro-samples.webp` (the same with the 23 sample boxes);
- `t10-p2-vs-world-intro-desktop-tier.webp`;
- `t10-world-capture-intro.png` (+ `-mask.png`) and `t10-world-capture-intro-desktop-tier.png`;
- `t10-render-intro-desktop-1536.webp` (the frozen intro as the owner's page draws it);
- `t10-render-entering-t3.2-her-and-portal.png` (+ `-mask.png`), the relic still;
- `t10-numbers.txt` (every check's output and the perf runs).

### Verdict, honest (not an approval)

What is met:
- The world now meets P2's water samples (outside the head 1.9, mid 5.9, upper 4.6) and the ruin window (2.2).
- Her look is untouched: all her samples, the four checks, the mean and the IoU are as at Task 6.
- The portal is out of the intro and below her face glow in the entrance frame.
- The budget holds under load in five runs of six.

What is not:
- The jellyfish bell stays at 13.2 (engine).
- Against P2 the world is sparse: dark blank tower faces, few warm lights, and flat (unbloomed) windows and jellyfish.

The owner's live look decides.

### Task 10, fix round 1 (review of c8b50b8): the relic check fails loudly and covers the entrance span

Scripts only (`src/worlds/aether/review/`). No config, layout or engine change, so the look numbers above stand.

**1. Fails loudly.** Every empty mask or region now ends the run with exit 1 and a line starting `FAIL`. Before, an empty face mask let `argmax` pick pixel (0, 0) and compare against it.
- `relic_entrance.py` fails on:
  - a missing capture or mask;
  - no portal node in kit.glb;
  - an empty portal region;
  - no face glow where one is needed: no pink-white patch of at least 200 px in her silhouette, in the single still or in the intro reference;
  - config.ts's portal glows unreadable;
  - pulse stills that do not match their times, leave a gap over 0.9 s, do not cover the longest portal pulse, or do not hold the portal's region;
  - any ratio of 1 or more.
- Checked by hand: an all-black mask, a box off the portal, a missing file, a folder with no intro, and stills 0.06 s short of the glyph period. Each gives its `FAIL` line and exit 1.
- `portal_offframe.mjs` now also fails, with a `FAIL` line and exit 1, on:
  - a camera probe with a non-finite value;
  - a corner that projects to a non-finite pixel;
  - a hull of fewer than three corners (its area of 0 would have passed);
  - any error, caught and printed.
  - A pass needs 0 pixels **and** every corner outside the frame. Re-run: 0 px at all four sizes, exit 0.

**2. The entrance span.** Spec 7.7 says "during the entrance". The check now reads three sets of frames.

Frozen entrance stills:
- Taken at t 1, 2, 3.2, 4.5, 5.5, 6.5, 7.5 and 8.4 s: the placeholder entrance's swim, hold, opening, spin and settle.
- Each frame compares the portal's brightest pixel with her face glow in **that same frame**.
- At t 1 she is 6032 px of silhouette far in the murk, with no pink-white patch of 200 px. That frame is compared with her **intro** face glow (Y 0.908, the same window), and the line says so.

Running intro stills:
- A frozen world holds every glow at its mid level: the pulse factor is 1 - pulse/2 while motion is held. So frozen stills never show the glyph's peak.
- 20 clipped stills of the running intro cover 9.5 s of world time, more than one glyph period (7.5 s) and one lantern period (4.3 s).
- The intro, not the entrance: the glows pulse on the world clock whatever the stage, and she stays clear of the portal there (her silhouette is left out anyway).
- The glyph's violet lines in these stills run from (85, 76, 187) at the trough (about 1 s and 8.6 s) to (123, 109, 253) at the peak (about 5 s). The frozen intro shows (106, 94, 227), the mid level. So the pulse is captured.
- A plain per-pixel maximum over the stills is not the portal's. Bubbles and specks rising past it are near white, Y 1.0, and sweep most of its pixels (first run: 1.000 at (1012, 410), a bubble crossing the glyph for 0.6 s).
- So each pixel's reading is the maximum over time of its minimum over a window: the stills within 0.45 s either side, plus always the still before and after.
  - Whatever stays lit across a window counts. Anything that crosses faster drops out; a slower bubble stays in, which only makes the reading stricter.
  - The window can miss a sine pulse's peak by at most pulse/2 x (1 - cos(2 pi d / period)), with d = max(0.45, widest gap) + widest gap/2. This run: d = 0.84 s, so 6.6% (the glyph, pulse 0.55 over 7.5 s; the lanterns lose 5.0%).
  - The reading is raised by that share before the comparison. For these bright pixels the tone curve compresses, so this is an upper bound.
- The membrane's flash never fires in Aether: only an `emissive` prop drive raises it, and nothing in the world or the sequences targets it.

Results (`.tmp` run, exit 0; output in `t10-fix1-relic-check.txt`):

| frame | portal's brightest Y (pixel, colour) | her face glow Y | ratio |
|---|---|---|---|
| entrance t 1 | 0.676 (950, 378) #b4dbff | intro 0.908 (none found in frame) | 0.74 |
| entrance t 2 | 0.745 (921, 556) #c0e5ff | 0.890 (2000 px) | 0.84 |
| entrance t 3.2 | 0.668 (837, 538) #b6d9ff | 0.873 (4008 px) | 0.76 |
| entrance t 4.5 | 0.689 (943, 365) #b6ddff | 0.896 | 0.77 |
| entrance t 5.5 | 0.722 (1029, 423) #cbdeff | 0.896 | 0.81 |
| entrance t 6.5 | 0.504 (908, 460) #edaf87 | 0.908 | 0.56 |
| entrance t 7.5 | 0.864 (900, 536) #cff6ff | 0.908 | **0.95** |
| entrance t 8.4 | 0.749 (1008, 406) #c3e5ff | 0.908 | 0.82 |
| pulse peak, filtered | 0.706 (844, 483), raised to 0.755 | dimmest found 0.873 (t 3.2) | 0.86 |
| pulse peak, filtered | 0.755 | intro 0.908 | 0.83 |

- **Worst ratio 0.95, at t 7.5.** Pass, but the margin is thin. That pixel is not the portal: it is a white speck on the coral before the steps (zoomed by eye). The frozen stills keep every bubble and speck in front of the portal, so they read strictly.
- The filtered pulse peak (0.706) is itself a slow bubble at the arch's left edge, lit in three stills (8.9 to 9.8 s). The portal's own sustained light is lower.
- Per node, filtered: glyph, lanterns and membrane 0.548 (the membrane's cyan centre); steps 0.613.
- Two earlier runs failed, honestly, before the filter was right:
  - one gave 1.15, from the unfiltered bubbles;
  - one gave 1.14: a speck in a window that held no other still, under load (gaps 0.5 s). The window now always takes its neighbours.

Commands (dev server on 127.0.0.1:5196; exit 0 on a pass, 1 with a `FAIL` line otherwise):
- `NOX_URL=http://127.0.0.1:5196 node src/worlds/aether/review/relic_capture.mjs <dir>`: the eight frozen entrance stills and their masks, the frozen intro and its mask, and the running pulse stills with `pulse-times.json`.
  - It fails if a capture throws or the page errors, or if the pulse stills leave a gap over 0.9 s or cover less than one glyph period.
  - `--pulse-only` captures the running stills again when a loaded machine left them sparse.
- `python src/worlds/aether/review/relic_entrance.py <dir>`: the comparison above. The single-still mode stays: `relic_entrance.py capture.png "x0,y0,x1,y1"`.
- `NOX_URL=http://127.0.0.1:5196 node src/worlds/aether/review/portal_offframe.mjs [out-dir]`: the intro half.
- They need a dev server, so they stay scripts, not vitest.

Stills, in `docs/superpowers/evidence/aether/m2/`:
- `t10-fix1-relic-entrance-t1-to-t8.4.webp` (the eight frames, one third size);
- `t10-fix1-relic-pulse-peak-5.3s.webp` (a running still at the glyph's peak);
- `t10-fix1-relic-check.txt`.

**What is left (Task 17).**
- These frames are the placeholder entrance: her pose is not authored for it, and at t 1 her face glow is not found.
- Task 17 authors the real entrance. It must run `relic_capture.mjs` and `relic_entrance.py` again on it, with `ENTRANCE_T` set to its beats.
- If Task 17 drives the membrane's `emissive` flash (up to +25%), a frame at the flash's peak must be added.
- The worst frame (0.95) is a speck, not the portal. Still, the portal's own steady light (about 0.55 to 0.75) sits within 15 to 25% of her face glow.

### Task 10, fix round 2 (re-review of c43d700): frames asserted, face-glow basis and trough, owners named

Scripts only (`src/worlds/aether/review/relic_capture.mjs`, `relic_entrance.py`). No config, layout or engine change. `--pulse-only` from fix round 1 is now `--running-only`: it captures the pulse and face stills again. Evidence run: `.tmp/t10/relic4`, output in `t10-fix2-relic-check.txt`.

**The verdict rule changed.** The check now counts only the portal's own light:
- each frame's own brightest, against her face glow at its trough;
- the pulse peak, against her dimmest face glow at its trough.

The brightest pixel in the portal's area is still printed for every frame, with its owner. When that pixel is a bubble, speck or her light (see (d)), the line starts `area` and does not decide the verdict. If it is the portal's own, it counts. The last line names the worst counted ratio and, separately, how far the bubbles and specks reach.

**(a) Frames asserted.**
- `relic_capture.mjs` deletes every old `entering-t*.png`, `intro*.png`, `pulse-NNN.png`, `face-NNN.png` and `frames.json` before capturing. It then writes `frames.json`: the moments and the run's start time.
- `relic_entrance.py` fails unless:
  - the eight frames of `ENTRANCE_T` and their masks are there, with no other `entering-t*` file;
  - each was written after the start time;
  - her silhouette holds at least 200 px in every frame and in the intro.
- Only t 1 (`FAR_T`) may lack a face glow.
- Negative runs (`t10-fix2-relic-negative-runs.txt`), all exit 1 with a `FAIL` line:
  - a stale extra `entering-t9.png`;
  - a missing `entering-t5.5.png`;
  - an all-black mask at t 4.5;
  - a 900 px silhouette with no face glow at t 5.5;
  - `entering-t2.png` dated before the run;
  - no `frames.json`;
  - face stills ending at 45 s;
  - a missing face still.
- The evidence run went into a folder seeded with a stale `entering-t9.png`, an old `entering-t2.png` and a `pulse-099.png`. The capture removed all three, and the check passed on the new frames.

**(b) Her face glow pulses.**
- Octopus.tsx (engine, read only) sets `uGlowStrength = (1 + 0.06 b + 0.025 live sin(0.37 t + 1.3)) (1 - 0.15 rest)`:
  - b is her breath (Aether's breathPeriod 5.0 s);
  - live is 0 when frozen;
  - rest comes only in the intro after 40 s idle (stageMachine.ts `isRestful`), never in the entrance.
- Frozen stills show strength 1.0. The entrance swings it from 0.915 to 1.085.
- Measured from 69 running-intro stills of her face over 17.36 s. That is longer than the 17 s drift; the page age was 23.4 s, so before any rest.
  - Her face glow's brightest pixel holds at Y 0.908 (#fff0ff) in every still. It is clipped: R and B are at 255 over 2000 to 2900 px of the patch.
  - The patch's 90% level is not clipped. It runs from Y 0.801 to 0.845, against 0.838 frozen. It moves with her breath, her sway and the patch's size. (Fix round 3 correction: the patch's size can move it either way, since a smaller patch drops its dim fringe and raises the quantile. So this is a measurement of the glow's unclipped body, not a proven bound.)
  - The stills may miss the joint trough by 0.013 of the strength: a breath trough within 2.5 s of the drift's trough, plus half a 0.48 s gap. So the drop is scaled by 0.085 / 0.072.
  - Trough factor **r = 0.949** (0.944 in the earlier run).
- The entrance frames' face-glow maxima are not all clipped (t 3.2's is a single pixel), so r is applied to every face glow the portal's own light is compared with.

**(c) t 1.**
- She is 6032 px of silhouette with no pink-white patch; her brightest pixel is Y 0.511.
- The frame is compared with the dimmest face glow measured (0.873, t 3.2), not the intro's 0.908, and marked **UNVERIFIED** in the output.
- In that window:
  - the portal's own brightest (0.475, a lantern) is just below her brightest pixel (0.511);
  - the bubbles in front of the portal (0.676, ratio 1.32 to her brightest pixel) outshine her.
- Whether the stage camera frames the portal at t 1 of the real entrance is not checked here (Task 17).

**(d) Owners named.** Each frame's brightest pixel in the area is printed with:
- the kit nodes whose hull holds it;
- the portal's own frozen light there.

The portal's own light is the per-pixel median over the nine frozen stills (her silhouette, grown 8 px for her bloom, left out of each). A frozen world holds every glow at mid level and the membrane still, so the portal draws the same pixel in all of them, while bubbles and specks move with each still's world time. More than 0.05 above that median is transient.

| t | brightest in area, Y | at | in hulls of | portal's own Y there | ratio to her face glow (same frame) | portal's own brightest vs her trough |
|---|---|---|---|---|---|---|
| 1 | 0.676 | (950, 378) | membrane/lanterns/arch | 0.046 | 0.774 (vs 0.873, UNVERIFIED) | 0.573 (UNVERIFIED) |
| 2 | 0.745 | (921, 556) | steps | 0.005 | 0.836 | 0.562 |
| 3.2 | 0.668 | (837, 538) | steps | 0.012 | 0.765 | 0.573 |
| 4.5 | 0.689 | (943, 365) | membrane/lanterns/arch | 0.114 | 0.768 | 0.559 |
| 5.5 | 0.722 | (1029, 423) | glyph/membrane/lanterns/arch | 0.050 | 0.805 | 0.559 |
| 6.5 | 0.504 | (908, 460) | lanterns/arch | 0.412 (her light on the lantern) | 0.555 | 0.551 |
| 7.5 | 0.864 | (900, 536) | steps/arch | 0.037 | 0.952 | 0.551 |
| 8.4 | 0.749 | (1008, 406) | glyph/membrane/lanterns/arch | 0.147 | 0.824 | 0.551 |

- All eight frame maxima are transient. The t 7.5 one (0.952) is a speck in front of the steps, where the portal draws 0.037. So fix round 1's "a speck, not the portal" now has evidence in the output.
- The portal's own brightest in every frame is Y 0.475 at (909, 461), a lantern on the arch.

**(e) Unfiltered beside filtered**, from the running intro (42 stills over 9.5 s, widest gap 0.28 s):
- **Unfiltered** per-pixel maximum: Y 1.000 at (1012, 410), in glyph/membrane/lanterns/arch, where the portal's own frozen light is 0.169: a bubble.
- **Filtered, anything in the area:** Y 0.800 at (852, 421). Only the arch's hull holds it, and the portal's own light there is 0.008. It is a slow bubble on the stone, held through the window.
  - Raised and against her trough, it reads 0.999. It is not counted, but it is printed.
  - The arch and steps have no kit material (config.ts names only the membrane, glyph and lanterns), so stone never brightens itself. A held stone pixel more than 0.05 above its frozen light is a slow bubble or speck.
  - Every pixel in a glowing node's hull counts at its held value, whatever lit it.
- **Filtered, the portal's own:** Y 0.652 at (956, 352), membrane/lanterns/arch. Raised 3.3% for the 0.59 s reach: **Y 0.674**.
  - Per node: glyph 0.646, lanterns 0.652, membrane 0.652, steps 0.156.
- **Pulse peak against her trough:** 0.674 / (0.873 x 0.949 = 0.829) = **0.813**. In the earlier run (34 stills, gaps to 0.55 s), 0.720 / 0.825 = **0.873**.
- **Limit:** the filter hides anything on the portal lit for less than about 0.9 s. Nothing on the portal does that today:
  - the membrane has no prop;
  - the glyph's `emissive` prop is filtered out of the world (`WORLD_PROPS = OBSERVATORY_PROPS.filter(prop => prop.id !== 'portalGlyph')`, config.ts), so no flash is ever driven.
  - If Task 17 drives one, the flash needs a frozen frame at its peak; the filtered number would not show it.

**(f)** `portal_pulses()` reads each portal glow's `pulse` and `period` in either order, and fails on a portal glow missing either. Checked against a scratch config.

**Result (exit 0):**
- Worst counted ratio **0.813** (0.873 in the earlier run): the portal's pulse peak against her face glow's trough.
- The portal's own frozen light against her trough: 0.55 to 0.57.
- t 1 is UNVERIFIED.
- The bubbles and specks in front of the portal reach 0.999 (a slow bubble on the arch) and 0.952 (t 7.5 speck). They are not the portal, but they are the brightest things near it.

Commands (dev server on 127.0.0.1:5196; exit 0 on a pass, exit 1 with a `FAIL` line otherwise):
- `NOX_URL=http://127.0.0.1:5196 node src/worlds/aether/review/relic_capture.mjs <dir> [--running-only]`
- `python src/worlds/aether/review/relic_entrance.py <dir>`

**Still left (Task 17).**
- Re-run on the real entrance, with `ENTRANCE_T` and `FAR_T` set to its beats.
- Check whether the stage camera frames the portal at the early, far moments (t 1 here is unverified, and there the bubbles outshine her).
- Add a frame at a membrane or glyph flash's peak if a sequence drives one.
- Limit (d) of fix round 3 stands: a bubble-sized light (under 850 px) on dark membrane inside a glowing hull is excluded as a bubble would be.
- (Task 17 closes these: see "Task 17" below.)

### Task 10, fix round 3 (re-review of 19ebcd6): positive controls, blob guard, bloom-aware exclusion

Scripts only (`relic_entrance.py`). No change to config, layout or the engine, and no new capture: every run below reads the relic4 capture from fix round 2. Output: `t10-fix3-relic-check.txt`.

**The classifier now.** A pixel in the portal's region is excluded as a bubble or speck only when all of these hold:
- It sits more than 0.05 above the portal's own frozen light (the median over the nine frozen stills).
- Its connected patch is under **BLOB_MIN = 850 px**.
- Its own light is under **OWN_DARK = 0.2**, so it is not on a lit part of the portal.
- For the held stone in the pulse check: it lies more than **BLOOM_PX = 20 px** from every glowing node's hull.

Everything else counts, light above the median included. Each frame now counts the brightest pixel left after exclusion, against her face glow at its trough (x r). Before, only the median map was compared. So her light on the portal counts now.

Each frame and the pulse check print:
- how many pixels sit above the portal's own light, with their bounding box and largest patch;
- how many were excluded, with the same.

**Why these thresholds (measured on relic4):**

- **BLOB_MIN 850.** The bubbles and specks in the portal's area are discs:
  - at most 374 px (about 22 px across) in the frozen entrance stills;
  - at most 806 px (32 px across, filling 0.76 to 0.82 of their box, as a disc does) in the running windows, where bubbles near the camera pass.

  Her light on the lower-left lantern makes patches of 511 to 962 px. Those pixels sit on lit portal (own light 0.4 and more), so OWN_DARK counts them whatever their size.
- **OWN_DARK 0.2.** The dark stone and the membrane body sit at 0.005 to 0.15. The lit parts (lanterns, glyph lines, the membrane's centre) sit at 0.2 and more, mostly 0.4 and more.
- **BLOOM_PX 20.** The stone's own light shows no halo past the glowing hulls: median 0.012 at 1 to 4 px, 0.007 to 0.013 farther. Its brightest pixels reach 0.18 to 0.23 within 16 px of a hull, but at most 0.15 from 17 px on.
- **The pulse guard runs per window.** Over all windows, the union of a slow bubble's positions is a trail: 6434 px held above the frozen light in relic4, the bubble chain on the left plus the swaying coral before the steps. Judged on that union, the slow bubble counted, at 0.999. Judged in each window before the maximum over time, it is one disc under 850 px on dark stone (held Y 0.800 around 9.03 s) and is excluded. The glowing nodes' hulls are never screened.

**1. Positive controls** (`t10-fix2-relic-negative-runs.txt`, after the eight negative inputs; all on copies of relic4). Each paints a disc of sRGB (249, 249, 249), Y 0.946, into frozen stills:

| control | disc | stills | result |
|---|---|---|---|
| (a) | radius 20 (1257 px) on the glyph at (1010, 437) | all nine | **exit 1**: 1.143 at t 3.2 |
| (b) | the same disc | t 6.5, 7.5, 8.4 only (a late, state-gated light) | **exit 1**: 1.099 at t 8.4 |
| (c) | radius 12 (441 px) on the glyph | the same three | **exit 1**: part of it is on lit glyph lines (OWN_DARK) |
| (e) | radius 17 (901 px) on the dark membrane under the glyph at (1065, 475), own light at most 0.131 | the same three | **exit 1**: the size guard alone catches it |
| (d) LIMIT | radius 12 (441 px) at (1065, 475) | the same three | **exit 0**: bubble-sized and on dark membrane, so excluded as a bubble would be |

Under fix round 2's rule, (b)'s light had a near-dark median and would have been labelled transient. (d) is the classifier's stated limit, shown rather than hidden.

**2. State-dependent light: limits, stated.**
- **5 of 9:** the portal's own light is a median over nine frozen stills, needing at least five valid. A light the portal shows in four or fewer of them (an opening glow gated late in the entrance, a flash, her light) has a near-dark median. It still counts when its patch reaches 850 px or it lies on a lit part of the portal, as in (b), (c) and (e). A smaller one on dark stone or membrane is excluded, as in (d).
- **0.9 s:** the pulse filter hides anything on the portal lit for less than about 0.9 s. The unfiltered maximum is printed beside the filtered one.
- **Bloom:** in the pulse check, held stone within 20 px of a glowing hull is never excluded. (Correction, Task 17: as first written this overstated it. The frames had no such guard until Task 17 added it; inside a glowing hull a bubble-sized patch on dark membrane may still be excluded, limit (d).)

**3. Bloom-aware stone exclusion.** The pulse check prints:
- held stone above its own light in some window: 6434 px, x 798 to 1146, y 354 to 574;
- excluded in some window: 4090 px, same box.

The slow bubble on the arch (held 0.800 at (852, 421), own light 0.008, more than 20 px from every glowing hull) is excluded per window. The counted pulse peak is unchanged from fix round 2: 0.652 at (956, 352) in membrane/lanterns/arch, raised to 0.674, **ratio 0.813**.

**Results (relic4, exit 0):**

| t | brightest in area (ratio to her face glow, same frame) | what it is | portal's light counted, vs her trough |
|---|---|---|---|
| 1 | 0.676 (0.774, UNVERIFIED) | bubble, excluded | 0.445 at (908, 424), lantern: 0.537 (UNVERIFIED) |
| 2 | 0.745 (0.836) | bubble, excluded | 0.442, lantern: 0.523 |
| 3.2 | 0.668 (0.765) | bubble, excluded | 0.457, membrane: 0.551 |
| 4.5 | 0.689 (0.768) | bubble, excluded | 0.475, lantern: 0.559 |
| 5.5 | 0.722 (0.805) | bubble, excluded | 0.595 at (898, 473) on the arch, own light 0.089, inside a 932 px patch above its own light, counted by size: 0.700 |
| 6.5 | 0.504 (0.555) | her light on the lantern, **counted** | 0.504: 0.585 |
| 7.5 | 0.864 (0.952) | speck, excluded | 0.734 at (908, 460), her light on the lantern (own light 0.412): **0.852** |
| 8.4 | 0.749 (0.824) | bubble, excluded | 0.441, lantern: 0.512 |
| pulse | unfiltered 1.000 (bubble); filtered, anything: 0.800 (slow bubble, excluded per window) | | 0.674: 0.813 |

- **Worst counted ratio 0.852**: t 7.5, her own light on the lantern, against her face glow's trough. The earlier capture (relic3) gives 0.873, its pulse peak.
- t 1 stays UNVERIFIED.

**Owner look note (spec 7.7; also in MORNING-REVIEW).** The bubbles and specks crossing in front of the portal are the brightest things near it:
- against her face glow at its trough they reach 0.95 (the t 7.5 speck) to 0.999 (the slow bubble);
- the brightest running pixel is pure white, Y 1.0.

The relic rule holds for the portal, but world elements near it can outshine her face glow. Keeping them or dimming them near the portal is the owner's call.

**Doc fixes.**
- The face-trough wording no longer claims that a changing patch size only adds to the dip (both in the script and in fix round 2 above).
- MORNING-REVIEW no longer calls t 6.5 a bubble: it is her light on the lantern, and it counts.

## Task 12: overview orbs (engine `satellite` active form, the flight, `orbStyle`); owner review PROVISIONAL

Three commits: two engine-only, one Aether.
- **`orbStyle`** (engine, also for Flux): `ArtifactConfig.orbStyle { rimBeads, rimColour, cap | null }`, validated (`rimBeads` 0 to 64, a colour, `cap.size` > 0). Every orb gets a rim of small additive beads, which brighten with its focus, and a small cap where its thread meets it. Absent, the orb glass is today's exactly: `orbStyle.test.ts` pins the glass shaders' fingerprints, uniforms and flags.
- **Satellite flight and active form** (engine). Without `slots`, `sizes`, `tether` and `swing` the satellite is ring-only with capacity 0, as before. With them:
  - the technologies are dealt round the ring's beads;
  - the beads brighten, flare and split into orbs, which fly to the pendant slots, hang on tethers and float;
  - Veyra's `assignPendants`, `layoutPendants`, `stepPendants` and `pendantSwing` are reused unchanged (two type widenings only).
- **Aether** (`src/worlds/aether/artifacts.ts`): 16 overview slots from `OVERVIEW_ROOM`, two per arm, filled a pair of arms at a time from the top down, tips first (T1 tip order 0, T8 tip order 1, then T1 and T8 mid-arm, then T2/T7, and so on). Orbs 0.6 across (`sizes.overview` is the radius, 0.3; the plan's "0.6" is the width, as in `poses.test.ts`). Gold thread 0.16 long, sag 0.2. Swing at most 15 degrees, settled in 1.4 s. `orbStyle { rimBeads: 16, rimColour: '#e4d9f8', cap: { colour: '#d99982', size: 0.05 } }`. Still choosable in the overview only.

**Her ten.** They take both slots on T1, T8, T2 and T7 and the tips of T3 and T6. The lower arms' slots wait for an eleventh to sixteenth technology. A seventeenth and beyond go to the tray (tested for 1, 3, 10, 15, 16 and 20).

**The flight** (swell sheet seconds; the satellite reads the swell's `push` over its settled value as the flight's progress p):
- Aether's `push` key was Nox's (peak then settle), which gave the flight only 0.3 to about 0.6 s. It now rises once, with no overshoot, from 0.2 s to 1.35 s (`sequences/defaults.ts`; `state.theatre.json` reseeded for `headSwell` only). p = (t - 0.2) / 1.15.
- Beads brighten, p 0 to 0.2 (0.2 to 0.43 s). They flare and split, p 0.2 to 0.35 (0.43 to 0.6 s).
- Travel, p 0.35 to 0.9 (0.6 to 1.235 s). Each orb flies for 0.5 of p (0.58 s), T1's tip first and the last orb 0.05 of p (0.06 s) later. The orb grows from 0.3 of its size, and its logo comes up over the last 30% of its own travel. A short gold trail follows it (fixed pool of 7-point tubes). Threads appear on landing.
- Settle, p 0.9 to 1 (1.235 to 1.35 s). Then each orb floats: `pendantSwing` with the arm, plus a 0.03 bob over 3 to 5 s, each orb out of phase.
- **The path keeps clear of her face.** It comes down a lane at least the ring's radius (1.25) out from her head's centre line, on the slot's side:
  - an orb whose bead is across her centre line from its slot rises over the top, higher the further across it is;
  - an orb whose bead is already out on the slot's side and above it swings outward and down, and comes in low.
  - Tested: for 10, 15 and 16 technologies no orb in flight touches her face box (eyes, brows, blush, mouth). The first arc tried (a bow outward and up) crossed it for 4 of her ten.
- **Continuity:** at most 0.148 per 0.01 of swell progress (plan limit 0.15). The plan's limit is why the stagger is small: a longer stagger shortens each orb's travel and speeds it past the limit.
- **Reduced motion:** a crossfade. The orbs shrink out at the bead before p 0.5 and grow in at the slot after it, never between.
- **Hold:** once the orbs land in the overview, a technology focus keeps them landed although it closes the head. Leaving the overview flies them home with the swell. A still (`?freeze`, `?swell=`) shows the swell's own moment. A bug found while capturing: a settled frame before the seek latched the orbs as landed, and `?swell=0.3` showed them on the arms.

**Stills** (`docs/superpowers/evidence/aether/m3/`, 509 x 504 at SCALE 2, P3's registration; `kitwait=90000`):
- `t12-p3-vs-overview.webp`: P3 left, settled overview (bare `?freeze`) right. Also `t12-overview-settled.webp`.
- `t12-flight-0.1-0.75s.webp`: `?swell=` 0.1 and 0.3 s (ring at rest; the ring line's left half is behind the squeezing head, as before Task 12), 0.6 s (beads bright, splitting), 0.75 s (orbs leaving).
- `t12-flight-0.85s-settled.webp`: 0.85 s (mid-flight, trails, over the dome), 0.95 s (landing), 1.0 s (landed, logos up), settled.
- Single stills: `t12-swell-0.1s/0.3s/0.6s/1s.webp`.

**Against P3:**
- Matches: the horseshoe of orbs round her, gold caps and threads, dotted bright rims, and nothing over the face.
- P3 shows more orbs (about 15) all round the horseshoe down to the bottom; her shipped ten fill only the upper slots, so the bottom of the horseshoe is empty.
- P3's orbs are dark glass with a solid glowing rim and large logos. The render's rims read as dotted bead rings, and the glass is lighter.
- Five of her ten orbs are blank: OpenAI, Next.js, PostgreSQL, AWS and Vector DB have no logo mark (`LOGO_SLUGS`; already an engine follow-up).
- Redis's mark is red (its brand colour), against spec 7.7's no-red rule. Owner call.

**Clearances** (`artifacts.test.ts`):
- Attach points: more than 0.05 clear of the other arms and her face (`threadClearance`).
- Hanging straight down (as every still holds them): threads and orbs more than 0.05 from her face and from the dome's panel.
- Floating, at the idle sway's few degrees and the 0.03 bob: none reaches the panel. Swung to the full 15 degrees: none reaches the face. T8's mid-arm orb does reach the panel's right edge by about 0.065; only a hard arm sweep swings it that far (tested to stay under 0.1).
- **Arms:** only four of the 16 slots clear the arm tubes (Task 11: T3/T6@0.6, T4/T5@0.75), and her ten use none of them. All ten of her orbs overlap an arm, from 0.01 (T1/T8 tips against the T2/T7 curls) to 0.35 (T3/T6 tips on their own curl), as several of P3's orbs sit over tentacles.
- **Mid-flight**, the orbs cross the dome and its panel for about half a second (up to 0.23 inside the panel box). They fly over the glass, as P3's story has them rise out of the head.

**Not done / known:**
- No arm "catch" dip on landing.
- In the detail stage the orbs fade out with the overview; they do not fly back to the ring.
- The beads' `from` points ignore the head's turn.
- Orbs appear with the overview's blow, then the flight runs.
- During the flight the ring line, at brow height, crosses the dome's lower edge until it fades.

## Task 13: tech focus (P4), detail (P5) and the phone frames (Milestone 3 statics); owner review PROVISIONAL

Commit `64dcac9` (poses, tests, e2e) and the evidence commit. Config, data and tests only: no engine file, no Nox, Veyra or Flux file.

**Tech focus (P4).** `AETHER_POSES.techFocus` is the overview with T1 lifted, face `curious`, head closed (`headMorph` 0). OpenAI is technology 0 and hangs from slot order 0, T1's tip (her left), so P4's right-hand lift is mirrored, as Veyra's is.
- Traced on native P4 relative to the head's near edge (x 347 px) and the eyes' midpoint (284, 204.5), at P4's 109 px a unit (eyes 75.5 px apart, hers 0.69). Placed on the overview: head edge at x -0.725, 0.1 further out (her arms are thicker), eyes' midpoint y -0.37. Root first, at the intro's root (no pop).
- Drawn (rig at rest): the arm runs under the chin, rises beside the head (0.22 clear of the head box above the waist, thickness taken off), crests at (-1.49, 0.86), 1.23 above the eyes (P4 1.18), and its tip ends at (-1.72, 0.78), on the held orb's top far side. `TECH_FOCUS_ORB` (-1.568, 0.387), 0.76 above the eyes (P4's OpenAI (428, 122) mirrored).
- Against her ten overview orbs: the lifted arm touches T2's mid-arm orb (gap -0.001, arm thickness and orb radius taken off). T1's own two orbs would ride the arm in a real lift.
- **The render does not show this arm.** WorldHost shows a focus in the pose of the stage it came from (the overview, dome open) and moves the chosen orb by the select strategy, `suctionHold` (the only one). This pose is the target data for Task 19's arm lift, as Veyra's is. On the frozen capture the held OpenAI orb sits beside her left eye, among T2's arm, not grown much; it clears her face by about 10 px at 509 x 504. Engine follow-up recorded.

**P4 samples** (bare `?freeze`, `stage=techFocus&tech=openai&expression=curious`, the settled rule; CIE76 as `check_stage.py`; `src/worlds/aether/review/p4de.py`, `p4rim.py`, moved there and committed in fix round 1):

| Sample | Target | Feature-registered | dE | Region mean | dE | Eye-registered | dE |
|---|---|---|---|---|---|---|---|
| Open-mouth inside (P4 295,231) | 119,29,73 | 101,28,66 (5x5 at the inside's centroid) | **7.5** | 83,27,65 | 15.0 | 246,207,243 | 64.7 |
| Open-mouth tongue (P4 287,239) | 253,135,143 | 176,88,109 (5x5 at the tongue's centroid) | **25.0 MISS** | 249,133,143 | **1.8** | 106,45,83 | 50.7 |
| Focused orb rim (P4 385,110) | 228,217,248 | 217,215,250 (P4's place on the held orb) | **3.8** | mirrored side 222,205,244 | 5.9 | best on the rim | 1.3 |

- Task 4 read inside 29.2 and tongue 16.8 (render lighter than the palette). Since Task 6's bloom threshold 0.95 the colours are right: the tongue's own pixels average dE 1.8, the inside's centre 7.5.
- **The tongue miss is size, not colour.** The rendered tongue is about 22 native px; P4's is 176 px (inside 238 px against P4's 304). A 5x5 patch on it takes in the dark inside. The engine draws the tongue as a fixed ellipse in the bottom third of a V/U mouth (`FaceCanvas.ts`, `mouthShape.ts`); P4's is a D with the tongue filling nearly half.
- Eye-registered points miss (64.7 / 50.7) because her mouth sits higher under the eyes than P4's and is a different shape: P4's sample points land on her lip and cheek.
- Config tuning tried: `curious.mouthOpen` 0.7 to 1.0 (a deeper mouth, larger tongue). The mouth's bottom then went under her chin and the arm roots (tongue region 194 to 96 px at 3x, inside region mean 13.2): reverted. Nothing in the look changed, so the P2 samples and four global checks are as Task 10 left them (not re-measured).

**Detail (P5).** Body (-3.115, 0.95), scale 1, yaw 0.32, tilt 0.37, `look` (0.65, 0.2) (the panel's screenshot), `attentive`; the intro's arms (as Nox's and Veyra's).
- Registered on the face: P5's eyes (87.5, 246) and (152.5, 220) px of 861 x 519; the capture's (85, 244) and (151, 221): within 2.5 px. Eye line 22 degrees (P5 22).
- Yaw 0.32, not Veyra's 0.45: P5's eyes' midpoint sits 0.19 right of her head's middle, which her face depth gives at 0.32. At 0.45 the additive face-glow card (it faces the camera only with the swim's turn) and T8's top showed as a pale band past her right cheek.
- Her head is inside the frame (its left edge less than 0.6 in from the frame's), her left arms are cropped, her head is left of the panel's box. On the 1672 x 941 page the panel's left edge comes just over her right cheek, clear of the eyes.
- The ring is back round her head (the satellite's rest form; stage `detail`). Tilted with her head, it sits higher round the crown, as P5's does. The rear bead (home 180 degrees) and part of the rear line project onto her brow area; they are behind her head and hidden there (depth-tested; tested: inside the head's outline). Not visible on the 3x capture.
- Sections: Overview, Features, Tech Stack, Architecture, Experiments, Challenges, What I Learned, in order (content from Task 2, placeholder-marked; `content.test.ts`), shown on the page as P5's.
- Not traced: P5's own arms (longer, hanging to the bottom). The detail's orbs fade with the overview; they do not fly back to the ring (Task 12 note).

**Phone, 390 x 844** (`frames.test.ts`, `stageCriteria.ts`: the stage camera's framing from the bundle's stage frames, Octopus's pivots read from its source):
- ringKeepOut: over a minute at 30 fps every bead angle is outside the 45-degree face sector; frozen, the nearest home is 72 degrees.
- The ring shrinks with her: ring half-width / head half-width 1.671 at desktop and phone (intro), 1.605 (detail); intro ring 94 px at the phone against 253 px at 1536 x 1024.
- Face rect: over a minute of sway, no bead in front of her head comes nearer than 30.8 px (phone intro) or 6.8 px (phone detail); counting the rear beads too, the phone intro's nearest is 8.9 px. The ring line in front never crosses it.
- Intro, frozen: beads clear the face rect by 11.9 px, the title by 28.8 px and the nameplate by 104 px (phone); 31.7 / 75.2 / 273 px (desktop).
- Overview and tech focus, frozen, 1, 3, 10, 15, 16 and 20 technologies: no orb or thread within 24 px of the face rect (phone; 65 px desktop); the held orb at `TECH_FOCUS_ORB` (authored, not drawn: Task 19's target) grown 1.3x clears it by more than 20 px.
- Sheet and tray: her ten clear the bottom sheet and the two-row tray by 23.7 px. 15 and 16 (a third row) reach it by 23 px: the known limit Veyra has (Task 20).
- Tray: the model (`createProjectModel` with the satellite's capacity 16) lists every technology in order on the phone for 1, 3, 10, 15, 16 and 20 (the counts tested); `tests/e2e/aether.spec.ts` checks the live phone overview: ten 44 px+ tray buttons, OpenAI to Vector DB, above the sheet (passed).
- Stills: on the phone she is centred, not in the upper screen (the shared framing fits the frame to the width); the overview's sheet and tray take the lower third. The detail's sheet covers her (her face is under it at y 380 to 432 px).

**Tests.** `poses.test.ts`: tech focus (T1 only, root, curious, closed), the lift (crest, tip on the orb, head clearance 0.1+, frame), the detail (eyes on P5 within 0.06, eye line 17 to 27 degrees, left edge, cropped arms, left of the panel, face on screen at 861, 1536 and 390). RED: the four pose tests failed on the HEAD poses. `frames.test.ts` (8 tests) is a guard: it also passes on the old poses. `npx vitest run --testTimeout=30000`: 134 files, 1061 passed, 1 skipped. Typecheck clean. E2E `aether.spec.ts`: 3 of 3.

**Stills** (`docs/superpowers/evidence/aether/m3/`): `t13-p4-vs-techfocus.webp`, `t13-p4-mouth-vs-render-3x.webp`, `t13-p5-vs-detail.webp`, `t13-detail-ui.webp`, `t13-phone-intro-overview-techfocus-detail.webp`. No videos; no fps measured.

### Verdict, honest (not an approval)
- Detail: the strongest match of the three: her face lands on P5's within 2.5 px, turned and leaning as painted, the ring round her head. The arms are the intro's, not P5's hanging ones.
- Tech focus (see Fix round 1: the mouth samples need the expression forced, and inside 7.5 is the most favourable of three registrations): the colours are right (inside 7.5, rim 3.8, tongue's own colour 1.8), but the open mouth is a small V/U with a small tongue against P4's big D, and the rendered focus is the dome-open overview with Nox's suction hold, not P4's closed head and lifted arm. The traced lift waits for the arm lift.
- Phone: every frozen stage keeps beads, orbs and threads off her face, title and nameplate. The phone composition is centred, and the detail sheet hides her.

### Task 13 fix round 1: the rendered stage pinned, reporting made plain

**What a visitor sees on a tech focus.** WorldHost draws a focus in the `returnTo` pose, so a real tech focus shows the overview: dome open, face `happy`, the orb moved by the suction hold. The traced lift, the closed head and the `curious` face are target data for Task 19's arm lift (expression `curious`). None of them is visible on a real tech focus until then.

**P4 samples, plainly.** They exist only with the expression forced (`expression=curious` in the URL). On the same capture the mouth inside reads:
- 7.5 with a 5x5 patch at the render's own inside centroid: pass;
- 15.0 by the inside's region mean: miss;
- 64.7 at P4's sample point carried by the eyes: miss.
It passes only under the most favourable registration. The tongue misses on a patch (25.0) and eye-registered (50.7); only its region mean (1.8) is close. The rim, 3.8, is the one sample that passes under any reading near P4's place (5.9 mirrored). Tools, now committed: `src/worlds/aether/review/p4de.py` (mouth), `src/worlds/aether/review/p4rim.py` (rim; Task 13's orb at 157.5 306 31 on the 509 x 504 capture).

**Held orb, tested against the render's own logic** (`frames.test.ts`):
- The authored-target test is retitled: `TECH_FOCUS_ORB` grown 1.3x clears the face rect by more than 20 px. It describes Task 19's target, not the rendered stage.
- New, the rendered stage: for every orb of 1, 3, 10, 15, 16 and 20 technologies, the arm `nearestArm` picks (from her drawn overview tips, the orb's place and her head box, as `Octopus.tsx` `holdArm` does) lands the orb, grown 1.3x, turned toward its orbit by `HOLD_ARM`, lifted and held `offTip` radii past the tip, clear of the face rect. Least margin 37.9 px (the phone, T8@0.55's orb held by T7) over the desktop, the phone and 509 x 504; OpenAI (T1@0.9) is held by T1, 98.7 px clear at the phone and 128.8 px at 509 x 504. The test asks only for more than 0, as the review set it.
- New, `KNOWN ENGINE BUG (pinned, flips with the engine fix)`: the frozen render does not do that. `holdArm` reads the bubble's orbit point before `TechBubbles` writes it; for the origin every path crosses her head box and `nearestArm` falls back to the nearest tip, T4. The test expects T4 for the origin. The render shows OpenAI beside her left eye about 10 px off her face; the model puts T4's landing 18 px off at the phone, 24 px at 509 x 504 and 48 px on the desktop (cruder than the render). Engine follow-up recorded. The likely cause is read from the code, not traced frame by frame.

**Overclaims corrected.**
- Counts: the phone checks cover 1, 3, 10, 15, 16 and 20 technologies, not every count from 1 to 20.
- On the phone she is drawn smaller and centred (the stage frames are fitted to the phone's width, the extra height above and below her), not "in the upper screen"; the `frames.test.ts` header said otherwise and is fixed.

**Cheap fixes.**
- The lifted T1 touched T2's mid-arm orb (T2@0.5) at its elbow under the cheek: gap -0.001. Nudging the lift 0.03 outward made it worse (-0.024: that orb hangs below and outside the elbow), so the first traced point is raised instead (`P4_LIFT[0]` y -0.6, was -0.65; about 5 P4 px). Gap now 0.03; a test pins every other overview orb more than 0.02 clear. The crest, the tip on the orb and the head clearance tests are unchanged and pass. No render changes: the tech focus pose is not drawn.
- `stageCriteria.ts` takes the swim's centre line from `poses.ts` `BODY_X` (was a copy, 0.07).
- `faceBoxLocal` notes that its mouth bottom is the closed mouth's depth; the happy and curious faces open a little lower, not modelled or measured: the 10 px and 20 px margins may or may not cover it (fix round 2 wording).
- Engine follow-up added: the detail panel's edge over her right cheek on the 1672 x 941 page is probably the engine's panel mapping. The model puts her face box's right edge 0.29 left of the panel's left edge (the review read 0.18 for the blush).

**Tests.** `frames.test.ts` 12 tests (was 8). Full run and typecheck: see the Task 13 report.

### Task 13 fix round 2: the engine-bug guard drives the real hold path

**The fake guard is gone.** Fix round 1's "KNOWN ENGINE BUG" test in `frames.test.ts` called a test-local model with the origin and expected T4. No engine fix could flip it. It is deleted.

**The real hold path cannot be reached from a vitest world test.** `holdArm` is a closure inside `Octopus.tsx`'s frame loop, and `TechBubbles.tsx` writes the orbit points in its own frame step. Neither is a pure function an Aether test can call with the same inputs. So the guard is an e2e test on the real page, in `tests/e2e/aether.spec.ts`:
- Title: "Aether tech focus, frozen: OpenAI is held near T1, the arm it hangs from [engine follow-up: the suction hold picks its arm before the orbit point is written]".
- It opens `?world=aether&stage=techFocus&tech=openai&freeze` at 1536 x 1024 and waits for the hold probe to report `openai` at pull 1. It takes the OpenAI orb button's centre and the drawn arm tips (`window.__octoverse.attention.tips`). It places the tips by the overview's body and projects them through the reported stage camera (fov, position, lens shift; its 2-degree pitch left out).
- It expects the correct behaviour: the nearest tip is T1's. It is marked `test.fail` and fails for that reason today: nearest T4 at 49 px (T3 221, T2 339, T1 459). Checked in the JSON report: the error is `Expected: "T1" Received: "T4"`, not a timeout.
- When the engine is fixed, the test passes and Playwright reports the expected failure as unexpected; then the `test.fail` line comes out.
- Limit: `test.fail` also counts any other failure (a timeout, a missing probe) as expected. The recorded annotation (`hold`: orb, tip distances, nearest) shows which.

**Labels.** The model test is renamed "intended hold pick". It asserts the pick from the orb's true place, a model of the hold as intended: least 37.9 px from her face (the phone). The frozen render today holds OpenAI on T4, about 10 px off her face at 509 x 504 (the engine bug). The 18 / 24 / 48 px figures from fix round 1 were model-only and are dropped.

**Small items.**
- The authored held orb (`TECH_FOCUS_ORB` at 1.3x, > 20 px) is now labelled "authored, not drawn" in the Task 13 phone list.
- The `faceBoxLocal` comment and the fix round 1 note now say the open mouth's extra depth is not modelled or measured; the margins may or may not cover it.
- `src/worlds/aether/review/targets.json` is tracked. Both tools were run from a `git archive` export of HEAD's `src/worlds/aether/review/` (a clean path, the export as working directory). They reproduce Task 13's numbers exactly (inside 7.5 / 15.0 / 64.7, tongue 25.0 / 1.8 / 50.7, rim 3.8 / 5.9 / 1.3). They need numpy and Pillow, and the captures they read are not committed (`.tmp/t13/f-tf-face3x.png`, `f-tf.png`).

**Run.** vite on 127.0.0.1:5196 for the e2e only, stopped afterwards. The page logged "the world's kit did not load in 15000 ms" once (the world drew less); the character, hold and probes were unaffected. `aether.spec.ts`: 4 of 4 (the new one as an expected failure).

## Task 14: back view (Milestone 4); owner review PROVISIONAL

Spec 2.3 "Back view": round and glassy, the specks and rim continue round the back, the ring circles behind the head. This is the orbit review for the intro and the overview. No approval is claimed: the owner looks live (`?world=aether&stage=intro&freeze&yaw=180`, and `yaw=45`, `90`, `135`; add `&orbit` and drag on the water to look from above or below). `yaw` turns her body about its upright axis; the stage camera stays put.

**Source: unchanged.** HEAD `11319aa`'s config was captured and is committed as is. A fix for the one clear fault (the rear arm roots, below) was found and measured, and not applied; see "Rear arm roots".

**Captures** (vite on 127.0.0.1:5196 only; bare `?freeze`, the settled state; `tier=high&kitwait=90000`; no kit retry needed):
- Intro: `WORLD=aether VIEW=514x504 SCALE=2 node scripts/stage-capture.mjs intro <out> "view=-2.57,2.52,2.57,-2.52&tier=high&kitwait=90000&yaw=<0|45|90|135|180>"` (P2's box, 200 px to a unit).
- Overview: the same with `overview`, `VIEW=509x504`, `view=-2.545,2.52,2.545,-2.52` (P3's box).
- Desktop frame: `VIEW=1536x1024 SCALE=1`, no `view`, yaw 0 and 180, both stages.
- Evidence (`docs/superpowers/evidence/aether/m4/`): `t14-intro-yaws.webp` and `t14-overview-yaws.webp` (yaw 0, 45, 90, 135, 180 side by side, 0.67 size), `t14-intro-yaw180.webp`, `t14-overview-yaw180.webp` (the back at 0.75 size), `t14-desktop-frame-yaw0-180.webp` (intro and overview, front and back, on the page), `t14-rear-roots-committed-vs-option.webp` (the root crease, 3x, committed against the option).

### Per-yaw checklist against spec 2.3

PASS means seen on the stills and, where a number exists, measured. Concern means a fault or a limit the owner should look at.

| Check | 0 | 45 | 90 | 135 | 180 |
|---|---|---|---|---|---|
| Intro: round and glassy | pass | pass | pass | pass | pass |
| Intro: specks continue | pass | pass | pass | pass | pass |
| Intro: rim continues | pass | pass | pass | pass | pass |
| Intro: ring round the head, 5 beads | 4 seen, 1 hidden (engine) | 5 | 5 | 5 | 5 |
| Intro: face not visible from behind | n/a | face turning | face edge-on | pass | pass |
| Intro: no popping or holes | pass | pass | pass | concern (roots) | concern (roots) |
| Overview: dome glassy and round | pass | pass | pass | pass | pass |
| Overview: orbs and threads sensible | pass | pass | concern (column) | concern (no logos) | concern (no logos) |
| Overview: no orb inside the head | pass | pass | pass | pass | pass |
| Overview: nothing popping | pass | pass | pass | concern (roots) | concern (roots) |

**1. Round and glassy: yes, intro and overview.** From behind the intro mantle is the same jelly as the front: lavender-white crown, violet middle, a bright rim all round, a faint pink wash low in the dome where the face glow shines through (yaw 135, lower right). The overview dome is a blue glass capsule with the white rim all round and the pink-lavender seat band at its foot, the same from behind as from the front.

**2. Specks continue: yes (intro mantle).** Counted with Veyra's method (bright points at least 35 over a 15 px median, 2 px or larger, on the dome interior eroded 10 px; `.tmp/t14/measure.py`, adapted from the Nox spike's `measure.py` to this 514 x 504 box at 200 px a unit; the arm, cream and P2-sample columns of that script do not apply to Aether and are not used):

| Yaw | Specks on the dome | per 10,000 px | Rim luminance | Dark px on the head | Peach px |
|---|---|---|---|---|---|
| 0 | 8 | 7.7 | 237 | 1,687 (eyes, brows) | 0 |
| 45 | 7 | 7.5 | 236 | 1,120 | 0 |
| 90 | 9 | 10.9 | 239 | 115 (face edge-on) | 14 |
| 135 | 11 | 11.7 | 235 | 0 | 2 |
| 180 | 15 | 14.5 | 237 | 0 | 0 |

The back has at least as many as the front. These counts are not Task 3's or Task 6's (23 to 26 on the front at 3x, by a top-hat peak count): the method differs, so compare yaws with each other, not with the spec's 15; this method reads 8 on the front, so it cannot confirm the spec's 15 at P2 size, and Task 6's count stands for that. In the overview the dome is the engine's glass capsule with no specks on it, front or back (P3 paints none either), so nothing stops at the sides; the arms carry their specks at every yaw (seen on the stills, not counted).

**3. Rim continues: yes.** The rim's brightest outline reads 235 to 239 at every yaw (the intro), and in the overview it is the same bright white line all round the capsule at every yaw.

**4. The ring circles behind the head: yes, and it holds at every yaw.** At yaw 0 four of the five beads show (two lit gold, two glass) outside the head's sides, and the fifth is behind the head and hidden. At yaw 45 to 180 all five beads and the ring line are seen: the line runs round the head at brow height, the beads sit at the same places, and at 180 the near arc crosses the back of the dome with a glass bead near its top, while the far arc (the face side) passes behind it. At yaw 90 the ring is seen edge-on and its line crosses the face's edge, with one bead beside the eye: the ring's front sector is the face's, seen from the side, and no stage shows her from the side. **Spec 7.5's "rear beads seen through the jelly, dimmed" is not met, and the engine is why:** a bead behind the head at yaw 0 is hidden by the opaque head, not drawn dimmed through the glass (it predates Task 13; engine follow-up below). The five beads sit on the ring's rear 270 degrees, so from behind none of them is behind the dome (nothing is hidden at yaw 180); the limit shows at yaw 0 and 45, and for the far bead at 90.

**5. The face is not visible from behind: pass, and the glow card is not seen at yaw 180.** At yaw 135 and 180 there is no near-black pixel and no peach pixel to speak of on the head (0 and 0 at 180; 0 dark and 2 peach at 135; yaw 0 has 1,687 dark pixels, the eyes and brows). No face card or glow patch shows through or round the head at yaw 180, on the P2 box or on the 1536 x 1024 desktop frame (`t14-desktop-frame-yaw0-180.webp`). `?yaw` is part of the engine's `coreGlowFacing` input (`(swim ? swim.yaw : 0) + extraYaw`), so the card fades with the yaw in these stills. **Task 13's engine follow-up stands for the pose's own turn:** `coreGlowFacing` still does not read `pose.body.yaw`, and the detail's turn depends on it. At yaw 90 the face sits at the head's edge with the glow card faded; no streak is seen.

**6. Overview from behind.** The dome reads round and glassy with nothing inside it: no orb lies inside the head, and at every yaw each orb hangs on an arm outside the dome's silhouette or in front of it (at yaw 45 the Python and React orbs overlap the dome's right edge, drawn in front of the glass, on their arms). Orbs from behind are dark glass discs with their rim beads and the gold cap, and no logo (the logo is on the orb's front face and the orb turns with the arm), so from behind the twelve orbs are anonymous; the coloured rim (red on the Redis-like orb) and the arm seen through the glass remain. The threads hang from the arm slots as at the front. At yaw 90 the orbs stack in a column along the side-on pile of arms: the arms are authored flat for the stage camera (as Nox and Veyra: "not a design", nothing shows her from the side). On the desktop frame at yaw 180 the project panel stays over the dome's back: it is an HTML panel, not world geometry, and does not follow the yaw.

**7. No popping geometry or holes: one fault, the rear arm roots.** From behind (intro yaw 135 and 180; overview yaw 135 and 180) T1 and T8's root caps stand out behind the mantle and meet in a hard flat-ended butt joint with a notch under it, at the body's axis (`t14-rear-roots-committed-vs-option.webp`, left). It is the same fault as Veyra's Task 15 (`rear()` arm z `[-0.3, -0.62]`, as Nox). No other seam, hole or colour mismatch was seen between front and back, and nothing pops.

### Rear arm roots: the fix, measured, not applied

Veyra's fix is `rear()` z `[0, -0.62]`: the root caps then sit inside the neck. On Aether it removes the crease (the arms join in a smooth V under the dome, `t14-rear-roots-committed-vs-option.webp`, right: the option is round 8 below) and it moves the front: the front lighting of T1's middle (P2 samples (-1.12, -1.05) and (-1.15, -1.12)) depends on the arm's depth. The 23-sample P2 check (`check_stage.py --world --stage intro --world-id aether`; HEAD has 4 misses: arm body upper 39.4, the two seed beads 89.0 and 44.4, jellyfish bell 13.2):

| Round | Change | Misses | Arm underside glow | Cup | IoU raw |
|---|---|---|---|---|---|
| HEAD | none | 4 | 6.0 | 7.2 | 0.8123 |
| 1 | z [0, -0.62] | 6 | 12.3 miss | 11.7 miss | 0.8129 |
| 2 | z [-0.15, -0.62] | 5 | 8.0 | 10.7 miss | 0.8126 |
| 3 | z [0, -1.0] | 7 | 14.1 miss | 7.7 | 0.8128 |
| 4 | z 0, underside 1.25, cup glow 1.1 | 5 | 16.7 miss | 6.4 | 0.8129 |
| 5 | z 0, underside 0.95, cup glow 1.1 | 5 | 17.7 miss | 6.4 | 0.8129 |
| 6 | z 0, underside 1.1, cup glow 1.2 | 5 | 15.0 miss | 8.9 | not taken |
| 7 | z -0.15, cup glow 1.2 | 5 | 10.8 miss | 7.2 | 0.8126 |
| 8 | z 0, cup glow 1.1 | 5 | 17.2 miss | 6.4 | 0.8129 |
| 9 | round 8 and underglow 0.42 to 0.6 | 5 | 17.0 miss | 7.5 | 0.8129 |

Round 3's rear tips at z -1.0 also took the arm top rim (14.5) and the inside tip spiral (10.6). Every variant costs at least one sample; the arm underside glow does not come back (the cups' glow lights it, and the cups' own sample then goes). The best candidate (round 8) removes the crease at the cost of one sample (arm underside glow 6.0 to 17.2; mean inside, saturation and brightness stay in range). It also broke two tests: `character.test.ts` ("the config still holds the Task 6 look", which pins the cup glow) and `artifacts.test.ts` (frozen: no thread or orb within 0.05 of her face, 0.0495, because the rear arm's chain moved). So it is not a one-line fix and I stopped: the front's Task 6 look is the owner's tuned gate, and the crease is an orbit-only fault. **Owner call:** take `rear()` z `[0, -0.62]` with cup glow 1.1, accept the arm underside sample at 17.2 and update the two tests; or keep the crease (seen only from behind, yaw 135 to 180, which no stage shows). The tuning rounds are not committed (config reverted to HEAD).

### Engine requests (also in MORNING-REVIEW)

1. Rear beads seen through the jelly, dimmed (spec 7.5): the ring's rear beads hide behind the opaque head at yaw 0 and 45.
2. Orb logo seen from behind: a turned-away orb shows a dark disc with no logo. Optional.
3. Root caps that blend: a rear pair's root caps should overlap or blend where they meet at the body's axis (as Veyra noted), so no config trade is needed.

### Concerns

1. The rear arm roots' crease from behind (above).
2. Spec 7.5's dimmed rear beads are not drawn (engine).
3. Orbs have no logo from behind; stacked at yaw 90 (not a design).
4. Specks: the count method cannot compare with the spec's 15; the back reads at least as many as the front by this method (15 against 8).
5. Motion (twinkle, sway, the head turn) is not judged from stills.

No `src/engine/**`, Nox, Veyra or Flux file touched; no source file changed. No videos. Vite stopped afterwards.

## Task 17: the entrance with the glyph firing (Milestone 5); owner review PROVISIONAL

Spec 7.9. Code: `src/worlds/aether/swimArms.ts` (the swim shapes), `swim.ts`, `poses.ts` (`entering`), `sequences/defaults.ts` (the sheet, `ENTRANCE_BEATS`), `sequences/index.ts` (the kit drive), `sequences/clearance.ts`, `place/config.ts` (`PORTAL_FLASH`), `bundle.ts` (the entering frame). Tests: `sequences/entrance.test.ts`, `swim.test.ts`. The Theatre state was reseeded for the entrance sheet only (`node scripts/theatre-seed.mjs entrance --world=aether`; the other three sheets are byte-for-byte unchanged).

### The beats as built

| Time | Spec 7.9 | Built |
|---|---|---|
| 0 to 1 s | glimmer in the haze on the left, glow first | `reveal` 0 to 1; she starts at (-3.5, 1.4, -9), left of centre and deep. |
| 1 to 4.2 s | two or three pulse strokes toward the portal | Two whole strokes at her own 1.69 s, clock 0.82 to 4.2 s; the surges start at 1.42 and 3.11 s. The path runs right toward the portal. |
| ~3.2 s | glyph fires; she looks back at it (3.0 to 3.8 s) | She is at (5.7, 0.8, -2.8), in front of the portal and to its left. `glyphFire` drives the membrane's emissive: 1 at rest, 1.25 at 3.2 s (the most its shader draws), back to 1 by 3.7 s. The look-back is `headYaw`, 0.7 rad from 3.3 to 3.55 s, inside 3.0 to 3.8 s: **sheet data only** (see the engine requests). |
| 4.2 to 5.3 s | curve away, turn about 90 degrees (three-quarter side to front), 12 degree tilt | The path curves toward the camera and the spot. The yaw falls monotonically. The whole entrance turns 90 degrees: 90 to 50 during the swim, as the path bends, and 50 to 0 in the turn. `headTilt` peaks at 12 degrees at 4.95 s and is 0 at 4.4 and 5.3 s: **sheet data only**. |
| 5.3 to 6.3 s | settle; look, blink, smile in order | `forward` 5.3 to 5.7, `open` 5.4 to 6.2. Then `look` lands at 5.45, `blink` closes at 5.75 (sheet data only), and the smile follows: `settle`, happy to gentle, 5.85 to 6.3 s. That also brings in the intro's words at 5.85 s. She arrives at the spot at 6.1 s. |
| 6.3 to 7.7 s | the ring forms (twinkle, Task 18) | Not in this sheet. The sheet ends at 6.3 s, so the camera can return sooner; see the concerns. |

**The facing.** The engine's glide-turn only rises (from -turn to 0). On its own, she would face left while swimming right. So the sheet's `yaw` key carries a half turn plus her facing before the turn, and falls to 0 on the spin's own ease. The sum is monotonic (tested).

**The 50 degrees at the pass.** The camera sits at the stage centre. Once she is right of centre, a body facing straight right shows the camera the back of her head. At 50 degrees the camera keeps her face three-quarter, as in P1 (stills below). The turn after the pass is 50 degrees, not 90; the whole entrance turns 90. Spec 7.9 says "about 90 degrees (three-quarter side to front)": the parenthetical fits 50, the number does not. Owner decision (also in MORNING-REVIEW).

`AETHER_ARM_HALF_SPAN` (open 2.4, closed 1.3) is hand-set; the comment's "trail's farthest point 2.72 from her head" is asserted, not verified.

### Swim poses (P1)

`open` and `trail` are generated shapes in the authored plane, as Veyra's are:
- each arm starts at its intro root and keeps its intro length;
- each heading swings as a sine along the arm (1.5 bows, growing from the root over a third of its length);
- neighbouring arms swing in opposite phase;
- each tip curls the way the intro's does.

The trail fans the eight arms downward (headings 242 to 298 degrees, waves 14 to 18 degrees). The open bell spreads them 34 degrees apart (waves 8 to 10 degrees). The stretch is 1.12.

`swim.test.ts` (ported from Veyra) checks:
- the anatomy;
- the umbrella order and the bundle's width (the trail is under half the open width);
- that no blend among open, trail and intro folds an arm.

To pass that last check, T1's open curl went from 150 to 225 degrees and T4's trail curl from 165 to 200.

Reach: the intro spans 1.99 either side, the open bell 2.14 (2.40 stretched), the trail 1.04.

### Clearance (layout.json, `entranceClearance`, 1261 samples)

The footprints are half box sizes read from kit.glb, for:
- the arch and its steps;
- the four towers and the three walls;
- the five floating stones.

The test checks that every such piece in the layout has one. Rocks and corals are low or in front, and are not counted.

| reach | least gap | where |
|---|---|---|
| as drawn | 0.727 | rubble_float_d at 3.05 s |
| held open (2.40) | 0.407 | rubble_float_d at 2.55 s |
| held closed (1.30) | 1.507 | rubble_float_d at 2.55 s |

All are above the 0.3 bar. The first path (pass at z -3.2) failed at -0.06 against rubble_float_d. The waypoints at 1.6 and 3.2 s moved toward the camera (z -5.0 and -2.6).

### The camera

The entering frame is 16 x 5.04, up from 5.1 x 5.04. `StageFrame` has no centre or turn, so the frame cannot turn right. It widens instead, until the glyph is in view at 3:2 and at 16:9 (tested with a 0.3 margin, and with her body's middle a unit inside the frame the whole way).

The cost:
- She draws at about 0.47 of her intro size on a 3:2 screen at the start, and about 0.6 at the pass.
- The arch's right edge is cut at 3:2.
- The engine eases the frame into the intro's only after ENTRANCE_DONE (6.3 s), not during the turn as spec 7.9 says.

Engine request below.

### Stills (frozen, 1536 x 1024, tier high), in `docs/superpowers/evidence/aether/m5/`

- `t17-entrance-stills.webp`: t 0.5, 2, 3.2, 4.8 and 6, with P1.
- `t17-p1-vs-entrance-t2.webp` and `t17-p1-vs-entrance-t3.2.webp`: P1 beside the still.
- `t17-relic-entering-t3.2-flash.webp`: the relic window at the flash's peak.

**Verdict against P1, honest (not an approval).** At t 3.2 the composition reads as P1's:
- she swims right, head leading, three-quarter with her face toward the camera;
- her arms stream behind her to the left;
- the portal stands on the right with the brain glyph lit, a little ahead of her.

What does not match:
- **Her size.** She is much smaller than in P1, where she fills about half the panel. Here she is about a sixth of the frame's width. This is the unturned, widened camera.
- **The arms.** P1's ribbons are long, thin and many-waved. Hers read as four or five short, thick arms: the trail is swung back toward the camera's line and foreshortened. The waves read only faintly.
- **The portal.** It is small and at the frame's right edge (cut at 3:2). P1's is large and close.
- **The world.** The towers and ruins are sparse and dark beside P1's lit ruins (as Task 10 found).

At t 2 she is mid-frame, small, gliding right. At 0.5 she is a dim violet glimmer, as the spec asks. At 4.8 she is turning toward the camera with her arms bunched. At 6 she sits at the spot in the intro pose, in the still-wide frame.

Motion was not judged from stills: the strokes, the turn and the camera's ease into the intro are live checks.

### Relic intensity on the real entrance (spec 7.7)

Run: `relic_capture.mjs .tmp/t17/relic`, then `relic_entrance.py` (exit 0). Output: `t17-relic-check.txt`. Settings:
- `ENTRANCE_T` = 0.5, 1, 2, 3.2, 4.2, 4.8, 5.3, 6 and 6.3;
- `FAR_T` = 0.5;
- `FLASH_T` = 3.2. The frozen frame reads the kit drive at its moment, so the membrane is at 1.25 there.

| t | portal's brightest counted, Y | where, what | vs her face glow's trough | ratio |
|---|---|---|---|---|
| 0.5 | 0.580 | arch, dark stone (own 0.006) | dimmest measured 0.856 x 0.950 | 0.714 (UNVERIFIED: the glimmer, no face patch; her own brightest pixel there is Y 1.000) |
| 1 | 0.484 | membrane/lanterns (own 0.205) | 0.862 | 0.561 |
| 2 | 0.745 | steps (own 0.005), counted | 0.862 | 0.864 |
| 3.2 (flash peak) | 0.441 | a lantern (own 0.441) | 0.862 | 0.512 |
| 4.2 | 0.608 | steps/arch (own 0.006) | 0.846 | 0.719 |
| 4.8 | 0.702 | steps/arch (own 0.008), counted by size (853 px patch) | 0.862 | 0.814 |
| 5.3 | 0.753 | steps/arch (own 0.008), counted by size (964 px patch) | 0.813 | **0.926** |
| 6 | 0.497 | a lantern, her light on it (own 0.412) | 0.862 | 0.577 |
| 6.3 | 0.456 | a lantern (own 0.412) | 0.862 | 0.528 |
| pulse peak (running intro) | 0.708, raised to 0.733 | lanterns/arch around 2.06 s | 0.813 | 0.901 |

- **Worst counted ratio 0.926: pass**, but the margin is thin: about 7% under 1.0, on an estimated trough of 0.813.
  - That pixel (t 5.3, (907, 544)) is pale blue (#c2e6ff) on the steps, which draw only 0.008 there. Zoomed at 3x, it is a bubble in front of the foreground rock and the swaying coral.
  - It counts because its patch above the portal's own light (bubbles plus the coral's sway, joined) reaches 964 px, over BLOB_MIN 850. That is the strict side of the rule.
  - The counted ratios run 0.512 to 0.926 (0.864 at t 2, 0.814 at t 4.8, 0.926 at t 5.3, 0.901 at the pulse peak). Only the lantern and membrane rows (t 1, 3.2, 6, 6.3) are 0.51 to 0.58. The others are bubbles on the steps, counted by the size rule (BLOB_MIN 850 px).
  - Which side of 850 px a bubble lands on is arbitrary: the t 4.8 patch counts at 853 px, the t 5.3 bubble at 964 px because it merged with the coral's sway, and a t 6 bubble (Y 0.978, ratio 1.077) is excluded at 626 px. Bubbles at 1.077 to 1.103 stay uncounted.
- **The flash.** At t 3.2, with the membrane at its peak, the portal's brightest counted pixel is a lantern (0.441). The membrane's centre stays under it. Ratio 0.512.
- **Bubbles and specks** near the portal, not counted, still reach 1.077 against her face glow (t 6: a bubble over the glyph, Y 0.978) and 1.103 in the pulse window. This is the owner look note Task 10 raised, unchanged.

**Task 10's carry list, addressed; limits remain:**

1. **Frame-path bloom test.** The frames now apply the pulse check's guard: stone within BLOOM_PX (20 px) of a glowing node's hull is never excluded.
   - Positive control (`t17-relic-controls.txt`), at t 4.8, not at the flash frame: a 6 px disc of Y 0.946 on the arch at (892, 297), 6 to 10 px from a glowing hull, in the t 4.8 frame. Result: **exit 1** (1.099).
   - The same disc 40 px further left, off the ring, on dark stone, is excluded as a bubble would be: exit 0 (0.926, unchanged).
2. **Halo tail past 20 px, and at the pulse peak.** `halo_tail` prints the stone round the glowing hulls in bands from 1 to 60 px, in two places: the flash frame, and the running intro held over each window (a whole glyph pulse).
   - In every band, in both places, the stone's median light over its own frozen light is +0.0000. For the flash frame this is real: the median of the nine stills excludes the flash, so the tail is measured on the flash frame itself against the stone's frozen light.
   - The maxima and 99th percentiles in the bands (up to 0.867) are bubbles: bright, small, and moving between stills.
   - So neither the flash nor the pulse adds a halo the exclusion could hide. BLOOM_PX 20 is conservative.
3. **Pulse-path control.** The same disc, painted into every running still, gives **exit 1** (1.205).
4. **Limit (d).** Restated, not closed. It stays, stated in the script and in fix round 2's "Still left": a bubble-sized light (under 850 px) on dark membrane inside a glowing hull is excluded. The flash frame sits inside a glowing hull, exactly where (d) applies. The positive control for the frame path was a disc at t 4.8, not at the flash.
5. **"bloom: never excluded".** The wording in fix round 3 is corrected above. It was true only of the pulse check; now it is true of both, outside the hulls.
6. **t 1 UNVERIFIED.** Resolved for t 1; t 0.5 stays UNVERIFIED. At t 1 in the real entrance her face glow is found at t 1 (2171 px). Only the glimmer at t 0.5 stays UNVERIFIED (12881 px of silhouette, no pink-white patch of 200 px). There, the portal's counted 0.580 is under her own brightest pixel (Y 1.000).
7. **The stage camera at the early moments.** Closed by a geometric test (the entering frame holds the portal at 3:2 and 16:9 through the whole entrance), not by a render through the stage camera. The relic stills use the fixed `view` window (VIEW_BOX).
8. **A flash frame.** t 3.2 is the flash's peak frame (FLASH_T).

### Budget (under load)

`WORLD=aether node scripts/perf.mjs "stage=entering&tier=low"`, twice. Under load: dev server and other sessions on the shared GPU.
- Run 1: median **99.0** fps (slow10 75.8, mean 84.1, 505 frames).
- Run 2: median **98.0** fps (slow10 73.0, mean 78.2, 469 frames).

Both are well over the 32 fps target, so no spec 10.1 lever was taken.

Read these with care:
- `scripts/perf.mjs` launches with `--disable-frame-rate-limit`, so numbers above 60 are not capped by vsync.
- A small, wide framing does not lower GPU cost; the 99 and 98 say the machine had room, not that the wide frame is cheap.
- The sample is 6 s starting 1.5 s after `ready` (set 40 frames after load). That covers most of the 6.3 s entrance and may run into the intro, but the script does not record when the entrance clock started, so I cannot say which part was sampled.

### Engine requests (also in MORNING-REVIEW)

1. A signed glide-turn.
2. The entrance frame passes the face beats: head turn, head tilt, gaze and blink.
3. A glow node a kit drive can fire: the glyph's travelling light.
4. A turned entering frame, and the camera's ease from it into the intro during the turn.

### Concerns

1. The look-back, the 12 degree tilt, the look and the blink are sheet data only. Nothing draws them until the engine reads them. Live, she does not turn her head to the portal or tilt it. She blinks on the engine's random schedule (slower while swimming), so a blink may fall anywhere. Only the smile (`settle`) and the turn are drawn.
2. The glyph does not fire on its own. Only the membrane brightens, by 25%; the glyph keeps its 7.5 s glow pulse on the world clock.
3. The camera:
   - It is wide and unturned, so she is small.
   - It eases into the intro only after 6.3 s, so the intro's words (in at 5.85 s) come in while the frame is still wide. Not checked live.
   - On a phone held upright, a 16-wide frame makes everything tiny. Not captured.
4. The sheet is 6.3 s, not 7.7. The ring's forming (Task 18) is an appear, not this sheet.
5. Her facing at the pass is 50 degrees, not 90, to keep her face toward the unturned camera.
6. Arms: P1's long, many-waved ribbons read as short, thick arms (foreshortened by the swing back).
