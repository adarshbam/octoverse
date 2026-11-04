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
