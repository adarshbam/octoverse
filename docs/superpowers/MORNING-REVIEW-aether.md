# Aether overnight build: morning review list

Branch: `claude/aether-world-overnight`. Nothing pushed, nothing merged. Frame rates are "under load" (three sessions share one Intel UHD).

## PENDING OWNER REVIEW

### P2 look gate (Task 6, Milestone 1, after fix round 1): PROVISIONAL, not approved

Open the intro (`?world=aether`) live, and compare with P2. Stills in `docs/superpowers/evidence/aether/m1/` (all from the final config; P2's 3x panel on the left in each side by side):
- `p2-vs-render-head-3x.png`, `p2-vs-render-left-arms-3x.png`, `p2-vs-render-right-arms-3x.png`, `p2-vs-render-full-1.5x.png`
- `render-intro-front-3x.webp`, `render-intro-three-quarter-yaw35-3x.webp`
- `world-capture-intro.png` (+ `-mask.png`), and all numbers in `numbers.txt`

Numbers:
- 18 of 23 P2 samples are within delta E 10. Open: arm body upper 39.4, the two seed beads 89.0 / 45.1, jellyfish 51.9, ruin 65.3. The reasons are under "Owner decisions" below.
- All four checks pass: warm core 154; below the mouth R-G 37, G 218 (pink, not white); arms B 240 / 239; water B 95.
- The mean inside her silhouette now passes: (158, 142, 237) against (154, 133, 228) +-12; saturation 0.424; brightness 0.929.
- IoU: **0.850** with the nameplate box left out (the bar is 0.85; it was 0.834). Raw 0.812; 0.876 with P2's two rear stubs also left out.
- Head, eyes and span are in range. Four full curls. Specks: 23 on the head front, 111 on the arms. Ring line 1.33 to 1.49 px.
- Pupils' darkest quarter: (15, 9, 34) and (11, 7, 28), against P2's near-black. They were 30 to 40.
- Under load: 62.1 and 52.6 fps median at tier low.

Full rounds: `docs/superpowers/reviews/aether.md`, Task 6 and "Fix round 1".

What to check:
1. **Face glow pink, not white**, below the eyes and the mouth. The bloom now starts at luminance 0.95, so the glow is less hazy than before.
2. **Arms periwinkle**, a deeper indigo in the middle than before, with a lavender-white top rim and a lavender-pink underside. No red anywhere.
3. **Ring placement**: brow height, right side higher, nothing over the eyes. The beads sit where the spec puts them, not where P2 paints them (see the decision below).
4. **Eyes**: the pupils are close to black now. Is that enough?
5. **Cups**: separate, shrinking, pink-white. They stand out as round beads; P2's are a flatter bright scalloped edge. Close enough?
6. Also:
   - No crescent on the crown (engine work).
   - The dome is a little boxier than P2's.
   - The right upper arm (T8) now rises a little higher at its root, toward P2's painted stub.

### Overview pose and dome (Task 11): PROVISIONAL, not approved

Open the overview live (`?world=aether`, then Explore or click her head) and compare with P3. Stills in `docs/superpowers/reviews/assets/aether/` (render left, P3 right):
- `t11-overview-vs-p3.png` (registered pixel for pixel), `t11-dome-2x-vs-p3.png`;
- `t11-orb-room.png`: 16 orbs, 0.6 across, hung 0.16 under the room points the pose leaves;
- `t11-overview-ui.png`: the live overview with the project panel in the dome.

**Rule for Tasks 12 and 20:** overview and dome checks capture the settled state (bare `?freeze` with stage=overview), never `?swell=1`. A bare `?freeze` capture and `swell=1.5` give the same pixels; `swell=1` is the opening's overshoot.

Numbers (settled overview, bare `?freeze`; all in `docs/superpowers/reviews/aether.md`, Task 11 and its fix round 1):
- Dome half-width 1.38 (target 1.38 +- 0.06), top at P3 y 104 px (105 +- 6), centred at +0.015.
- P3 dome samples, delta E: interior upper **7.9**, rim **8.4**, top sheen **3.4** (all within 10). One second into the opening (`swell=1`) the glass is at its overshoot, 5% larger, and the rim and sheen samples miss (17.2, 49.7).
- The 16 orbs clear one another (at least 0.66 apart), the dome, the face and the frame (test). Only four also clear the arm tubes (T3/T6@0.6, T4/T5@0.75, tested); the other twelve overlap an arm by 0.01 to 0.35, as several of P3's do.
- Depth 1.0 (Nox and Veyra 0.6) lands the rim sample but brightens the lower corners: (135, 230) goes from delta E 19.8 to 37.3 from P3 (L* 50.0 to 65.4), and (380, 230) from 15.8 to 38.1. At 0.6 the rim and sheen samples miss (21.3, 21.7).

What to check:
1. **Dome shape**: wide capsule, the size and place of P3's.
2. **Glass colour**: brighter and flatter than P3's. P3's glass darkens toward the bottom and the render's lower corners and seat line are light (engine request below). 
   **Owner call: rim colour.** Spec 7.2 asks a lavender-blue rim. Every lavender-blue rim tried misses the binding rim sample (133, 190): `#f4f4ff` 11.0, `#e8e0ff` 14.5, `#d0d8ff` 15.6, `#b8c4ff` 18.9. P3's bright rim line, measured at nine points, barely moves with the token (mean delta E 12.0 to 14.3; it saturates near-white under bloom). So the rim is a near-neutral `#f4fff4` (rim-line mean 12.8, binding 8.4; round 1's mint `#ecffe4` was 14.1 / 7.5). On the glass it reads lavender-white. Choose: keep it, relax the binding sample for a lavender-blue rim, or wait for the engine's `rimPower` / `rimStrength`.
3. **Horseshoe room for orbs**: T1/T8 climb the dome's sides, T2/T7 and T3/T6 curl at the sides, T4/T5 turn out along the bottom. Is it roomy enough, and is the composition P3's?
4. **Happy face at the dome's bottom**: eyes whole under the glass, open smile. The face anchor is just below the glass's seat (P3 paints the eyes 24 px below it), not inside the dome's lower fifth as the plan words it: inside, the glass would tint the eyes.
5. The arms keep their P2 thickness and cups, so they read heavier than P3's slim painted tentacles.

## Owner decisions (look gate)

- **P2's rear stubs and the IoU bar.** P2 paints two extra rear stubs beside the head (2675 px). Aether keeps exactly eight arms (spec 7.4).
  - The bar is met with the stubs in the mask: 0.850, nameplate box left out.
  - Left out of the mask, it would read 0.876.
  - The mask is unchanged. Do you want the stubs out of `p2-mask.png`?
- **Ring beads against P2.** P2's gold and glass bead samples, (1.06, -0.13) and (-1.04, -0.03), need a ring with its left side about 4 degrees higher: roll -4 degrees, tilt 1.36, centre y about -0.24, beads at 123.5 and 248 degrees.
  - Spec 2.2 has the right side 8 degrees higher.
  - Inside the spec's ranges (centre y -0.33 to -0.23, half-width 1.15 to 1.35, roll 6 to 10 degrees), the nearest ring passes 0.15 from the samples. A bead is 0.075 in radius.
  - Choose one: keep the spec and drop or move the two samples, or follow P2's roll.
- **Arm body upper.** P2 paints a thin cyan streak on the upper-left arm (90, 130, 226). That is 34.5 from the lower arm's sample (75, 88, 231), at the same place on its arm.
  - The render gives both points the same colour within delta E 2, whatever the arm material: the arm depth set to the upper colour met it at 7.6 and missed the lower at 27.3.
  - Meeting both needs per-arm colour (an engine feature), or one of the two samples moved or dropped.
- **Backdrop samples.** Jellyfish bell and ruin window light wait for Task 8 and later.

## Placeholder names for the five unnamed P3/P4 icons

Spec 7.10 does not ship these until named. Overnight stand-ins, used only in the 15-technology test set (P3 stills, overview perf run):
1. Atom mark: "Atom"
2. Golden block mark: "Block"
3. White animal mascot: "Mascot"
4. Gold-and-violet mark: "Spark"
5. Vite "V": "Vite"

Please give the real names.

## Engine follow-ups for the engine owner

- **Title icon.** The engine's `validateBundle` only accepts `titleIcon` `'flame'` (`src/engine/ui/titleIcons.ts`, red artwork). Aether needs `'ringedPlanet'` (spec 7.10; no red, spec 7.7). Until the engine gains it, Aether's intro title shows the red flame. `src/worlds/aether/bundle.test.ts` pins the stopgap (`titleIcon === 'flame'`); that test failing is the cue to switch the theme.
- **Empty orbit shells.** `layoutOrbits` (`artifacts/bubbleOrbits.ts`) crashes on `shells: []` (`i % 0`); Aether's placeholder uses one zero-radius shell with size 0 until Task 5.
- **Kit stubs.** `Kit.tsx` requires `chain` and `chain_lod1` nodes even when the layout has no chains.
- **Logo marks.** `LOGO_SLUGS` has no mark for OpenAI, React, Next.js, PostgreSQL, AWS or Vector DB (lettered fallback).
- **Crown crescent (Task 6).** The jelly crown term in `src/engine/character/skinMaterial.ts` is a symmetric cap: `smoothstep(crownHeight, crownHeight + 0.4, N.y)`. P2's sheen is a blue-white crescent on the upper left.
  - Wanted: `JellyLook.crownDirection` (a unit vector; for Aether about [-0.45, 0.85, 0.3]) and `crownWidth` (the crescent's angular width).
  - The term would become `smoothstep(crownHeight, crownHeight + crownWidth, dot(N, crownDirection))`.
  - Target: the P2 crown sheen sample (147, 170, 248) at (0.12, 0.07) stays within delta E 10 (it reads 8.9 now), with the bright crescent on the upper left of the dome.
- **Selective bloom for the face (Task 6).** `src/engine/host/WorldHost.tsx` draws one global `<Bloom mipmapBlur {...world.post.bloom} />`.
  - Aether's fix round 1 raised `post.bloom.luminanceThreshold` from 0.8 to 0.95 so the face stops blooming over the pupils. This is global: everything below luminance 0.95 now has no glow.
  - Wanted: an optional `post.bloom.selection` (for example `'glow'`). It would bloom only the glow layer (halo shell, core card, cups) through `SelectiveBloom` from `@react-three/postprocessing`. Aether could then go back to threshold 0.8 for her glow while the face decal stays out.
  - Target: pupils' darkest quarter <= 15 per channel with threshold 0.8.
- **Per-arm jelly tint (Task 6, optional).** See "Arm body upper" above: a per-arm override of `JellyLook.depth` (or a `tint` on `ArmSpec`) would let T1 carry P2's cyan streak (90, 130, 226) while T2 stays indigo (75, 88, 231).
- **Dome glass darker toward the bottom, and a per-character rim and seat (Task 11).** `src/engine/character/domeMaterial.ts` gives the glass one tint (`uTint`), adds `uRim` over the lower 60% and `uRimTop` above with a fixed fresnel `pow(1 - ndv, 4) * 2.4 + pow(1 - ndv, 12) * 1.6`, and draws a bright seat line `uRim * seat * 1.4` along the bottom 10%.
  - P3's glass darkens toward the bottom: (135, 230) is (52, 60, 177) and (360, 255) is (45, 37, 98). The render reads (135, 151, 255) and (148, 156, 248) there.
  - Wanted (optional, absent = today's look): `palette.domeTintLow` (the tint mixed in toward the seat, for example `mix(uTintLow, uTint, smoothstep(0.0, 0.6, up))`), `DomeShape.rimPower` and `rimStrength` (today 4 and 2.4), and `DomeShape.seat` (the seat line's strength, today 1.4; Aether would use about 0.3).
  - Aether widens its rim today with `dome.depth` 1.0 (Nox and Veyra 0.6), which also brightens the lower corners; with `rimPower` it could go back to 0.6.
  - Target: the three P3 dome samples stay within delta E 10, and (135, 230) and (360, 255) come within delta E 20 of P3.
- **Mean inside the silhouette (Task 6): resolved in config.** Fix round 1 set the arms' jelly `depth` to `#505ce2` at `depthStrength` 0.8 (was `#5c74e6` at 0.4). The mean reads (158, 142, 237) against (154, 133, 228) +-12, saturation 0.424 (0.418 to 0.498). No engine change is needed.

## Questions for the owner (Task 4, face)

- Catchlights: spec 2.3 says "large upper, small lower". Aether's panels P2, P3 and P4 at 3x paint both upper right, so the face follows the panels. Say if you want the spec reading (one-line change).
- `happy` (overview face) was tuned to P3 to `mouthCurve 0.75, mouthOpen 0.35, blush 0.4` (engine base is 0.8 / 0.6). Unrequested; veto if you prefer the base.
- The open "wonder" mouth reads as a V/U with a small tongue, not P4's D-shaped mouth. This is an engine limit (the open mouth keeps the closed smile's curved top, the tongue is a fixed shape). Fixing it needs an engine change; say if you care.
