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

### Observatory world: bake, far plate, membrane and world light (Task 9): PROVISIONAL, not approved

The page now shows `OBSERVATORY_WORLD` (kit, baked `near.glb`, three far-plate layers, sand floor, membrane, glyph pulse, jellyfish, manta fish). Task 10 is the look review. Open `?world=aether` live; stills in `docs/superpowers/evidence/aether/m2/`:
- `render-entering-t3.2-p1-framing.png`: `stage=entering&t=3.2&freeze`, 510x504. The stage camera does not frame P1: the portal (x 12.6) is out of shot.
- `render-portal-view.png` and `p1-vs-portal-view.png`: the portal area framed directly (`view=1.59,2.96,7.99,-3.34`).
- `render-wide-intro.webp` (wide view of the world) and `world-capture-intro.png` (P2 registration).

Numbers (CIE76 against `public/aether/ref/p1.png`):
- Membrane body: (15, 56, 133) against P1 (15, 56, 167), delta E **21.2**. Not within 10. The engine draws the body at 0.32 of `color` and blue is already at 1 (engine request below). With the brief's `#0f38a7` it read (5, 26, 91). At P1's own pixel (435, 235) the portal view lands on the glyph's cyan core (76, 125, 217), because the framing is not P1's.
- P1 mid water (250, 120) in the entering frame: (29, 47, 117) against (2, 26, 74), delta E **16.3**. Not within 10. A light shaft crosses that pixel; the shafts fan from a fixed point at the top centre (engine request below).
- P2 registration after the switch: her samples are unchanged and the mid water is within delta E 5.2. Four samples now land on world pieces: upper water on a tower, window light, jellyfish bell, and water outside the head on an orbit bead. Face glow G stays 215 to 218 (at most 235).

What to check: the membrane's brightness and its line pattern, the amber windows and lanterns, the coral colours, the large foreground rocks (lighter than P1's near-black), and the jellyfish size.

### Drowned observatory look gate (Task 10, Milestone 2): PROVISIONAL, not approved

Open the intro live (`?world=aether`) at your usual window size, and compare with P2. Then let the entrance play once.

What changed:
- `layout.json`: tower_a is sunk 1.39, so its lit window sits where P2 paints the ruin window light. tower_d is sunk 2.4, so P2's upper-right water is open. wall_b is turned away, so its window no longer glows behind her head.
- The near light is rebaked and the far plate re-rendered.
- In config: tower_a's window is a softer salmon-peach, the shafts are softer, the surface opening is 1.0, and the jellyfish region puts two jellyfish where P2 paints them.

Stills, all in `docs/superpowers/evidence/aether/m2/` (no videos):
- `t10-p2-vs-world-intro.webp` (P2 left, render right), `t10-p2-vs-world-intro-samples.webp` (with the 23 sample boxes), `t10-p2-vs-world-intro-desktop-tier.webp`;
- `t10-render-intro-desktop-1536.webp`: the frozen intro as your page draws it;
- `t10-render-entering-t3.2-her-and-portal.png`: her and the portal in one frame; `t10-fix1-relic-entrance-t1-to-t8.4.webp`: the eight entrance frames the relic check reads; `t10-fix2-relic-check.txt`: its latest output;
- `t10-world-capture-intro.png` (+ mask), `t10-world-capture-intro-desktop-tier.png`;
- `t10-numbers.txt`: every check's output.

Numbers (rounds in `docs/superpowers/reviews/aether.md`, "Task 10"):
- **Samples: 19 of 23 within delta E 10** (Task 9's world: 16).
  - Water outside the head 1.9 (was 74.7), mid water 5.9, upper water 4.6 (9.4 at the desktop tier, was 21.9), ruin window light 2.2 (was 63.7).
  - Open: jellyfish bell 13.2 (12.4 desktop; engine request below), plus the three Task 6 owner decisions (arm body upper 39.4, beads 89.0 / 44.4).
  - Her own samples are unchanged.
- **All four global checks pass:** warm core 154; pink, not white R-G 40 / 37, G 215 / 218; periwinkle arms B 240 / 239; indigo water B 88, B-R 72. Mean inside her silhouette and IoU (0.8505) are unchanged.
- **Relic, entrance (over the whole placeholder entrance, fix rounds 1 and 2):** her and the portal in one frame, through the same camera, at t 1, 2, 3.2, 4.5, 5.5, 6.5, 7.5 and 8.4 s, plus the portal over one full glyph pulse:
  - Brightest pixel in the portal's area over her face glow in the same frame: 0.77, 0.84, 0.77, 0.77, 0.81, 0.56, 0.95, 0.82. Each of these eight is a bubble or speck in front of the portal, not the portal's own light: the portal draws that pixel at Y 0.005 to 0.41 in the other frozen stills. The 0.95 is a speck (Y 0.864) where the portal's own light is 0.037.
  - The portal's own brightest (a lantern on the arch, Y 0.475) against her face glow at its breathing trough (x 0.949, measured): 0.55 to 0.57.
  - The portal at its pulse peak (bubbles filtered out) against her dimmest face glow at its trough (0.873 x 0.949 = 0.829): **0.81** (0.87 in an earlier run).
  - **t 1 is unverified:** she is too far in the murk for a face glow (her brightest pixel there is Y 0.511). It is compared with her dimmest measured face glow instead. In that window, the portal's own lantern (0.475) is just below her brightest pixel, and the passing bubbles (0.676) are above it.
  - Pass: worst counted ratio 0.81, the portal's own light only. The bubbles and specks crossing the portal reach 0.999 of her face glow's trough; they are the brightest things near it. Task 17 runs the check again on the real entrance.
- **Relic, intro:** 0 portal pixels in the frozen intro at 1536 x 1024, 1920 x 1080, 1024 x 768 and 390 x 844. The nearest portal point is 112 to 251 px outside the frame. The check projects the portal through the page's own camera.
- **fps under load** (tier low, three back-to-back pairs): 63.7 / 33.4, 52.1 / 67.1, 61.3 / 54.1.
  - Five of six runs clear 40; the median of the six is 57.7.
  - The one dip did not repeat, so no lever was cut. Please measure on your laptop.

What to check:
1. **Depth and indigo.** Navy-indigo water, brighter at the top under the shafts, near-black low. The shafts are softer than Task 9's. Two bubble discs near the camera read grey.
2. **Jellyfish not competing.** Small, lavender, flat and behind her; 6 of 10 in the desktop frame; none over her or the title. They are dimmer than P2's glowing ones (the bell sample misses on brightness).
3. **Warm windows.** Few and flat in P2's box: tower_a's salmon window and faint far windows; amber slits on the side towers in the wide frame. **Owner call:** tower_a's window is `#ffaa98` (hue 10 degrees, HSV saturation 0.40) to match P2's salmon light. It passes the no-red rule, but it is the pinkest warm light in the world. Keep it, or go back to amber (the ruin sample then reads 36.1)?
4. **The ring reads against the water.** A thin gold line with bronze beads; the beads are duller than P2's glowing orbs.
5. **The portal off-frame in the intro.**
6. **Overall.** The world is sparser and darker than P2: dark blank tower faces, few warm lights, and no bloom on the windows or jellyfish (bloom starts at 0.95 to keep her pupils dark). Is this calm enough, or too empty?

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
- **Backdrop samples.** Task 10 met the ruin window light (2.2) and all three water samples. The jellyfish bell is at 13.2: the bell is placed where P2 paints it, but the engine's flat bell cannot reach P2's glow (see the engine request).

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
- **Membrane body level (Task 9).** `src/engine/world/membraneMaterial.ts` draws the body at `mix(color, edge, lit) * (0.32 + 0.68 * lit) * level`. A colour of P1's sample (#0f38a7) reads (5, 26, 91) on the page after the fog.
  - Wanted: an optional `MembraneParams.body` (default 0.32) that replaces the 0.32.
  - Aether would set `body: 1` and go back to `color: '#0f38a7'`. Today it uses `#2876ff`, which reads (15, 56, 133).
  - Target: the membrane body is within delta E 10 of P1's (15, 56, 167).
- **Emissive prop drive (Task 9).** No world prop on `'emissive'` is driven: only a sequence would drive it, and none targets the portal glyph. Its glow material cannot stand beside an emissive drive (validateWorld).
  - Aether drops `portalGlyph` from the world's props and pulses the glyph with its glow material (`pulse` 0.55, `period` 7.5 s).
  - Wanted: an idle drive for `'emissive'` props (a period and depth, like `bob`), or a validateWorld rule that lets a glow's own pulse stand with it.
- **Ray origin per world (Task 9).** `GodRays` (`src/engine/world/Water.tsx`) fans its shafts from the fixed `SHAFT_TOP`, toward `across` in -5 to 5. Spec 7.7 and P1 want the rays from the upper right.
  - Wanted: `water.raysFrom` (a stage point) and a `raysAcross` range.
  - Target: P1's mid water (250, 120) in the entering frame comes within delta E 10 (16.3 now; a shaft crosses it).
- **Mote twinkle (Task 9).** The star motes do not twinkle; the marine snow does (0.6 + 0.4 sin). Spec 7.7 asks for twinkling blue-white star specks. The world draws them with the snow (`snow: '#c8d8ff'`).
  - Wanted: an optional `live.colours.motes.twinkle` (depth, 0 for today's look).
- **Coral base albedo (Task 9).** `Kit.tsx`'s coral material and `bake_world.py`'s ALBEDO use the engine's `#7a0a18` (red) for coral bodies. Aether's coral bodies are dark and their glow is magenta, so no red shows on the page today.
  - Wanted: `palette.coralBody` (optional), read by Kit.tsx and the bakes.
- **Jellyfish bell glow (Task 10).** `src/engine/world/live/Jellyfish.tsx` draws the bell as `new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.75, depthWrite: false, side: THREE.DoubleSide })`: fogged, tone-mapped, and under Aether's 0.95 bloom threshold.
  - At P2's left jellyfish the bell reads (154, 113, 191) against P2's (156, 123, 225), delta E 13.2.
  - Paler, bluer, nearer and larger bells read further off (14.2 to 28.0). The blue cannot climb.
  - Wanted (optional, absent = today's look): `JellyfishConfig.glow` (a bell strength above 1, drawn with `toneMapped: false` so it can reach the bloom) and `JellyfishConfig.opacity` (today 0.75).
  - Target: P2's jellyfish bell sample (81, 155) within delta E 10, with her face glow still the brightest thing in frame.
- **Mean inside the silhouette (Task 6): resolved in config.** Fix round 1 set the arms' jelly `depth` to `#505ce2` at `depthStrength` 0.8 (was `#5c74e6` at 0.4). The mean reads (158, 142, 237) against (154, 133, 228) +-12, saturation 0.424 (0.418 to 0.498). No engine change is needed.

## Questions for the owner (Task 4, face)

- Catchlights: spec 2.3 says "large upper, small lower". Aether's panels P2, P3 and P4 at 3x paint both upper right, so the face follows the panels. Say if you want the spec reading (one-line change).
- `happy` (overview face) was tuned to P3 to `mouthCurve 0.75, mouthOpen 0.35, blush 0.4` (engine base is 0.8 / 0.6). Unrequested; veto if you prefer the base.
- The open "wonder" mouth reads as a V/U with a small tongue, not P4's D-shaped mouth. This is an engine limit (the open mouth keeps the closed smile's curved top, the tongue is a fixed shape). Fixing it needs an engine change; say if you care.

## Engine follow-up from the Flux merge (for the engine owner)

Flux added `WorldTier.id` and Aether added `WorldTier.quality`, both the same quality tier. The Aether branch keeps both (always equal, with a test holding them equal). Fold them into one name, `id` (platform's branch already carries it): a two-line change.
