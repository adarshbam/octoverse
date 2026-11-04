# Aether overnight build: morning review list

Branch: `claude/aether-world-overnight`. Nothing pushed, nothing merged. Frame rates are "under load" (three sessions share one Intel UHD).

## PENDING OWNER REVIEW

### P2 look gate (Task 6, Milestone 1): PROVISIONAL, not approved

Open the intro (`?world=aether`) live, and compare with P2. Stills in `docs/superpowers/evidence/aether/m1/` (P2's 3x panel on the left in each side by side):
- `p2-vs-render-head-3x.png`, `p2-vs-render-left-arms-3x.png`, `p2-vs-render-right-arms-3x.png`, `p2-vs-render-full-1.5x.png`
- `render-intro-front-3x.webp`, `render-intro-three-quarter-yaw35-3x.webp`
- `world-capture-intro.png` (+ `-mask.png`), and all numbers in `numbers.txt`

Numbers: 18 of 23 P2 samples within delta E 10. The open ones: arm body upper 33.5 (a painted stub P2 has and Aether does not), the two seed beads 87.2 / 43.8 (spec ring roll against P2's bead places), jellyfish 51.5 and ruin 64.2 (not built yet). All four checks pass: warm core 157; below the mouth R-G 37, G 218 (pink, not white); arms B 245 / 240; water B 96. Head, eyes and span are in range. IoU **0.796** (0.834 with the nameplate left out, 0.875 with P2's two rear stubs left out too); the target is 0.85. Mean inside the silhouette: too light (169, 151, 239 against 154, 133, 228). Under load: 65.8 and 64.9 fps median at tier low. Full rounds: `docs/superpowers/reviews/aether.md`, Task 6.

What to check:
1. **Face glow pink, not white**, below the eyes and the mouth.
2. **Arms periwinkle** with a lavender-white top rim and a lavender-pink underside, no red anywhere.
3. **Ring placement**: brow height, right side higher, nothing over the eyes. The beads sit where the spec puts them, not where P2 paints them. Which do you want?
4. **Eyes**: the pupils read grey-violet (about 30 to 40 per channel; P2 is near-black). Bloom spill causes it (bloom off makes them black, but loses the soft glow). Acceptable for now?
5. **Cups**: separate, shrinking, pink-white. They stand out as round beads; P2's are a flatter bright scalloped edge. Close enough?
6. Also: no crescent on the crown (engine), the dome a little boxier than P2's, and a visible bend on the right middle arm (T7).

Decisions wanted: take P2's two rear stubs out of the mask (IoU then 0.875)? Drop or move the bead samples?

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
- **Crown crescent (Task 6).** The jelly crown term in `skinMaterial.ts` is a symmetric cap (`smoothstep(crownHeight, crownHeight + 0.4, N.y)`). P2's sheen is a blue-white crescent on the upper left. It needs a crown direction (a tilt vector, and a width for the crescent) in `JellyLook`.
- **Bloom greys the pupils (Task 6).** With bloom on, the pupils read 30 to 40 per channel; with bloom off, 7 to 11 (P2: near-black). A way to keep the face decal's darks out of the bloom (a bloom mask, or a selective bloom on the glow only) would let Aether keep her soft glow and black pupils.
- **IoU bar against P2's stubs (Task 6).** P2 paints two extra rear stubs beside the head (2675 px). With them in the mask, an eight-armed Aether tops out near 0.83 (nameplate left out); without them, 0.875. The review target needs an owner decision, not engine work.
- **Ring beads against P2 (Task 6).** The spec 2.2 roll and bead angles put the beads away from P2's painted places, so the two bead samples cannot be met by tuning. Spec or samples should change.
- **Backdrop samples (Task 6).** Jellyfish bell and ruin window light wait for Task 8 and later.
- **Mean inside the silhouette (Task 6).** Too light on the arms (169, 151, 239 against 154, 133, 228). Darkening the arm body breaks the arm samples. This may need a darker arm interior between bright edges (a stronger fresnel split in the arm jelly), which is engine shading.

## Questions for the owner (Task 4, face)

- Catchlights: spec 2.3 says "large upper, small lower". Aether's panels P2, P3 and P4 at 3x paint both upper right, so the face follows the panels. Say if you want the spec reading (one-line change).
- `happy` (overview face) was tuned to P3 to `mouthCurve 0.75, mouthOpen 0.35, blush 0.4` (engine base is 0.8 / 0.6). Unrequested; veto if you prefer the base.
- The open "wonder" mouth reads as a V/U with a small tongue, not P4's D-shaped mouth. This is an engine limit (the open mouth keeps the closed smile's curved top, the tongue is a fixed shape). Fixing it needs an engine change; say if you care.
