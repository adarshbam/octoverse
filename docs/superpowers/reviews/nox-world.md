# Nox world, physics and motion review log

Spec: `docs/superpowers/specs/2026-10-26-nox-world-and-motion-design.md`. Plan: `docs/superpowers/plans/2026-10-26-nox-world-and-motion.md`.

Each milestone ends with the owner's live review. The owner's words, the date and any kept stills are recorded here before the milestone is committed, and the next milestone starts only after approval. Stills only: no clips or frame sequences (see the plan's milestone review pattern). Captures are under `assets/` when kept.

| Milestone | Date | Owner verdict | Capture |
|---|---|---|---|
| 1. Nox's look in the world | pending | | |
| 2. The world in production | pending | | |
| 3. Water physics for the arms | pending | | |
| 4. The back view | pending | | |
| 5. Swimming and the entrance | pending | | |
| 6. Technology bubbles | pending | | |
| 7. The head swell | pending | | |
| 8. Shared micro-animations and variant hooks | pending | | |
| 9. Pass across every stage | pending | | |
| **Phase sign-off** | pending | | |

## Measurements

### The world colour check (Task 1, 2026-10-26)

`node scripts/world-capture.mjs <stage> <out.png>` captures the frozen stage at the high-quality panel 2 framing (1536 x 1024), so a capture pixel is a panel pixel, plus `<out>-mask.png`. `python scripts/check_stage.py <out.png> --world [--stage intro]` measures the mean colour, mean per-pixel HSV saturation and brightness inside the silhouette, and (for `--stage intro`) CIE76 delta E of 7 x 7 px patches at the eight points in `scripts/world_samples.json`. Targets: mean (119, 23, 79) within 10 per channel, saturation 0.85 to 0.91, brightness 0.49 to 0.57, delta E at most 8.

Calibration on known images:

| Image | Mean RGB | Saturation | Brightness | Result |
|---|---|---|---|---|
| Panel 2, through the registered capture mask | 118, 26, 89 | 0.867 | 0.538 | PASS (blue 89.07 is on the 10 tolerance edge; checked as the whole 8-bit colour) |
| Approved stage (painted plate), through its own mask | 138, 41, 95 | 0.758 | 0.580 | FAIL, as expected (spec: 137, 41, 95 / 0.76 / 0.58) |

How the panel 2 measure works. The measurement uses the registered capture mask: the view box frames exactly the painting, so a capture pixel is a panel pixel, and the mask is used exactly as captured for the render and for panel 2. Registered, panel 2 reads (118, 26, 89), 0.867, 0.538. The spec's (119, 23, 79) came from an older stage-capture mask that was misregistered by about (16, -14) px (checked by edge alignment: this mask fits the painting best at shift (-2, 0), the old one at (16, -14)). The targets are kept as approved and panel 2 passes them. The mean colour is compared as the whole 8-bit colour it prints as, so panel 2's blue (89.07) sits on the 10 tolerance edge and passes.

Region points (world x, y; HQ px = 783.6 + 204.5 x, 495.4 - 204.5 y). Each lies at least 4 px inside the approved-stage mask and in the same feature on panel 2, except `aura outside`, which lies 8 px outside the mask above the head. The four arm points lie on the lower right arm, one cross-section through the rim, the top surface, the red band and a cup.

| Region | World point | HQ px | Panel 2 | Approved stage | Delta E |
|---|---|---|---|---|---|
| head crown | 0.00, 0.06 | 784, 483 | #041145 | #231649 | 6.9 |
| head middle | 0.00, -0.10 | 784, 516 | #010a2d | #181238 | 8.2 |
| cheek glow | -0.49, -0.85 | 683, 669 | #fb494d | #f7575f | 10.0 |
| upper arm top | 1.50, -1.10 | 1090, 720 | #3d0348 | #550b5b | 9.3 |
| arm underside band | 1.40, -1.17 | 1070, 735 | #d2053a | #9e0644 | 27.3 |
| arm rim | 1.40, -1.03 | 1070, 706 | #a76de3 | #79339a | 22.8 |
| suckers | 1.40, -1.221 | 1070, 745 | #fc7b56 | #fb7152 | 4.2 |
| aura outside | 0.00, 0.295 | 784, 435 | #381750 | #473365 | 12.4 |

The approved stage misses six of the eight regions, which is the starting point for milestone 1.

### Nox's accents in the world (Task 3, 2026-10-27)

The skin shader now carries the world's accents as compiled code (`character/worldAccent.ts`): warmth from the eight world lights nearest Nox on the sides and underside, the surface light's caustics on up-facing skin, and a far haze that is exactly 0 within 18 units of the camera (density 0 for now). Warmth is capped at 10% of the skin's own luminance, caustics at 5%, and both together at 10%. Each is capped first and faded by its mask after, so the fades hold however strong the light. The face, the crown and the neon rim take no warmth; the rim takes no caustics; nothing reaches the face glow where the arms join the body. The rim fade runs over n·v 0.6 to 0.8: the arm's neon rim is still a fifth of its colour at 0.6 and a twentieth at 0.7. Every strength defaults to 0. In a world, Nox casts the surface light's shadow (a soft band on the seabed in front of him, just below panel 2's frame).

**No change without a world.** `stage-capture intro` then `check_stage --panel 2`, before (HEAD 13aa17f) and after: PASS both, the same ten colour deltas (12, 14, 6, 16, 12, 1, 15, 5, 10 or 9, 4) and the same four widths. The one moving value, `bg upper-left` (10 or 9), reads both ways on two HEAD captures: bubbles and embers run on the real clock. Inside Nox's silhouette the mean colour matches HEAD within 0.01 per channel; the few pixels that differ by more than 8 are a bubble passing the arm junction.

**In the world** (`world-capture intro`, `check_stage --world --stage intro`). The starting strengths are the test scene's warmth balance at 0.05 of its strength and caustics at 0.005 of the surface light. At the test scene's full strength the warmth sat on its cap over most of each arm (a flat 10% lift, no falloff from the lights); at 0.05 the cap binds on almost no pixels and the warmth falls off from the lava corners.

| Capture | Mean RGB | Saturation | Brightness |
|---|---|---|---|
| Spec row: test scene, Nox unlit by the world | 138, 42, 97 | 0.75 | 0.58 |
| HEAD 13aa17f (no accents, no shadow) | 137, 41, 94 | 0.753 | 0.576 |
| Accent strengths 0, shadow on (control) | 137, 41, 94 | 0.753 | 0.576 |
| Starting accents, run 1 | 137, 41, 94 (137.34, 41.37, 94.43) | 0.752 | 0.577 |
| Starting accents, run 2 | 137, 41, 94 (137.34, 41.38, 94.43) | 0.752 | 0.577 |

Both runs are no worse than the unlit row on every measure. Regions (both runs; control in brackets): head crown 7.3 (7.3), head middle 8.3 (8.3), cheek glow 10.0 (10.0), upper arm top 9.3 (8.7), arm underside band 27.4 (28.0), arm rim 23.1 (23.1), suckers 4.4 (4.4), aura outside 22.7 (22.7).

The arm rim sample reads #783399 against the control's #783299. Its 7 x 7 patch straddles the edge: the neon rim rows are unchanged, and the inner rows (the arm's top, n·v about 0.8) gain 1 to 2 in green from the caustics. Over the whole silhouette, the outer 2 px (the neon rim) are unchanged at the 90th percentile (99th: 0.9% in linear luminance, mean change 0.01 per channel). Task 5 tunes the strengths within the caps.

### Nox's aura, glow light and local grade (Task 4, 2026-10-27)

In a world (and never in a silhouette capture) Nox brings three things of his own. Starting values, for Task 5 to tune: aura inner `#c83ce8`, low `#a0102c`, radius 1.6, strength 0.5; grade colour `#1c0618`, radius 3, strength 0.55.

- **The aura** (`character/Aura.tsx`, `auraMaterial.ts`) is a card turned to face the camera, at the body's middle and 0.8 behind it (just behind the rear arms). It moves and turns with the body, adds its light and writes no depth. It is magenta-violet at and above the body's middle and deep red from 1.2 below it.
- **His glow's light** is the test scene's `PointLight('#ff4a30', 5, 6, 2)` at the face glow plus (0, -0.42, 0.5). It does not cast shadows. Lit (standard) materials take it: the seabed, the stone blocks, rocks, pebbles, coral and the chains. In panel 2's frame it shows as red on the seabed below and right of him (#0b0b25 to #120c25 at world (0.3, -2.3)) and faintly on the near pillars and coral. Unlit pieces take none of it: the glyph panels, the fish, the light shafts and the water sky. (The bubbles, embers, motes and snow take it as a tint since fix round 1, below.) Nox's own skin is a shader that ignores scene lights, and it takes none of it either: inside his silhouette the change is within capture-to-capture noise.
- **The local grade** (`character/LocalGrade.tsx`, `localGradeMaterial.ts`) is drawn in the scene, not after it (ruling R19, which replaces R17).
  - It is 8 camera-facing discs on the line of sight through his face glow, placed in their shader from the live view matrix, so a moving camera is followed with no work on the CPU.
  - The first disc lies 1.4 + 0.3 behind the glow along the view axis (his back plus 0.3), the last 1 further back. Each disc mixes what is behind it toward the grade colour (linear) by its share of `gradeWeight × strength`, so the grade ramps in over that unit of depth.
  - The discs are depth-tested and write no depth, and they draw after the opaque world and before every transparent layer (render order -1000). Nox's skin, nearer, fails the depth test. His halo, aura, orbs, dome glass and glow card draw after the discs and are not graded.
  - The world's transparent pieces (light shafts, bubbles, embers, motes, snow) also draw after the discs and stay ungraded. Directly above his head the central light shaft is added over the graded water, so the grade reads weaker there than on the seabed below him. The opaque water sky, stone, seabed and fish behind him are graded.
- **R18:** `tests/e2e/world.spec.ts` checks that a `&mask` capture is byte-identical with and without `&world`.

**No change without a world.** `stage-capture intro`, then `check_stage --panel 2`. At HEAD aabf73a: PASS, colour deltas 12, 14, 6, 16, 12, 1, 15, 5, 9, 4. After, three captures: PASS each. Run 2 gives exactly HEAD's deltas; runs 1 and 3 read `bg upper-left` 10 and `bg low right` 5 or 4. Those are the two background samples bubbles and embers pass through (Task 3 saw the same). The four widths are unchanged. Inside the silhouette, the mean matches HEAD within 0.01 per channel.

**In the world** (`world-capture intro`, `check_stage --world --stage intro`):

| Capture | Mean RGB | Saturation | Brightness | Aura outside |
|---|---|---|---|---|
| Task 3 / HEAD aabf73a | 137, 41, 94 | 0.752 to 0.753 | 0.577 | #44488c, delta E 22.7 |
| Glow light only (aura and grade strength 0) | 137, 41, 94 (137.38, 41.48, 94.50) | 0.752 | 0.578 | #44488c, 22.69 |
| Aura and light, no grade | 137, 41, 94 | 0.752 | 0.578 | #5c4a9b, 25.24 |
| Grade and light, no aura | 137, 41, 94 | 0.753 | 0.577 | #454383, 19.80 |
| Starting values, run 1 | 137, 41, 94 (137.33, 41.36, 94.43) | 0.752 | 0.577 | #5c4593, 22.72 |
| Starting values, run 2 | 137, 41, 94 (137.33, 41.33, 94.41) | 0.753 | 0.577 | #5c4593, 22.72 |

The other seven regions are unchanged from Task 3: head crown 7.3, head middle 8.3, cheek glow 10.0, upper arm top 9.3, arm underside band 27.4, arm rim 23.1, suckers 4.4.

The grade alone takes "aura outside" from 22.7 to 19.8. The aura at strength 0.5 adds blue-violet there and puts it back to 22.7: panel 2's #381750 is darker and redder than either.

**Not graded** (grade strength 0.55 against 0, with everything else the same):

| What | How it was checked | Result |
|---|---|---|
| Neon halo | Halo over the water beside it (3 px outside the silhouette, against 18 px outside), linear luminance, at the crown, head sides, head top-left and both upper arms | 98.4% to 101.1% kept |
| Water there | Same pixels | Graded as expected, for example B 0.162 to 0.130 at the crown |
| Aura | Its added light at "aura outside" (linear) | R 0.049 and B 0.065 with the grade off; 0.048 and 0.064 with it on |
| Orbs (overview) | Mean luminance over each of the 15 orb discs | -0.8% to +1.7% (the orbs bob on the real clock) |
| Dome glass (overview) | Rim over the water outside it | 99.9% to 101.0% kept; its peak is identical on and off |
| Nox's skin | Inside the silhouette, 3 px in | Median change 0; the share of pixels changing by more than 1% matches two captures that differ only in the light |

**The seabed shows no line** where it passes behind the discs. The grade's share of the floor's luminance below Nox falls from 0.24 to 0 over about 40 px (rows 918 to 960). The largest change from one row to the next is 3.3% of the floor's luminance, about 1 sRGB level. A contrast-stretched crop of that strip shows no step. The one line there is in the scene with the grade off too.

#### Task 4, fix round 1 (2026-10-27)

**The particles take the glow (R21).** The bubbles, embers, motes and marine snow take no scene lights, so their shaders now take the face glow's light as a tint (`character/glowLight.ts`, `world/particleMaterials.ts`).

- Each particle works out the tint from its own world position, with three's point-light falloff for the light's reach 6 and decay 2: `1 / max(d², 0.01) × clamp(1 − (d/6)⁴, 0, 1)²`. A unit test checks the mirror against that formula and checks that three's shader chunk still uses it.
- The light is `#ff4a30` (linear 1.0, 0.0685, 0.0296) × intensity 5 × the particles' share, 0.25/π (a quarter of what a white surface square to the light shows). That gives (0.398, 0.027, 0.012) at 1 unit before the cap. The share is a starting value for Task 5.
- The tint's brightest channel is capped at 0.35, so no particle near the glow blows out. The cap binds within 1.07 units of the light; the red channel reads 0.18 at 1.5 units, 0.10 at 2, 0.04 at 3 and 0 at 6.
- The tint adds to each particle's own colour and follows its brightness and shape: bubbles take it like their tint (`× (0.4 + 1.4 f)`), and embers, motes and flecks of snow take it times their own alpha.
- All four read one shared pair of uniforms (`AccentLink.light`: where the light is, in world space, and its colour as the particles take it). Octopus writes the position each frame, where the point light goes too, and sets the colour while he is in a world. Outside a world the particles share one black light, so the tint is zero.
- R18: a silhouette capture has no world and no tint. `world.spec.ts` still passes (mask with `&world` byte-identical to one without).
- A still with the share raised 25 times and the cap to 4 (temporary, not committed) shows the bubbles and specks round Nox turning red, so the wiring works and no shader fails to compile. At the starting share the change is small next to the bubbles' and embers' own movement between two captures.

**No change without a world**, two captures: PASS both. Colour deltas 12, 14, 6, 16, 12, 1, 15, 5, 10, 4 and 12, 14, 6, 16, 12, 1, 15, 5, 9, 4 (the second is HEAD's exactly). Widths unchanged.

**In the world**, two runs: mean 137, 41, 94; saturation 0.753 and 0.752; brightness 0.577 and 0.578; aura outside #5c4593, delta E 22.7. The other seven regions are unchanged (7.3, 8.3, 10.0, 9.3, 27.4, 23.1, 4.4). Still FAIL (9 misses) before Task 5.

**Check 3: no part of Nox is graded in the other poses.** `?stage=detail&freeze&world` (1672 × 941) and `?stage=overview&freeze&world` (1012 × 1008 at 2×), with grade strength 0.55 and with 0 (a temporary edit, not committed), plus a second grade-off capture for the noise. DOM panels are hidden in the captures (only the canvas shows), and the `&mask` capture of each is the mask. Compared: the silhouette eroded 2 px, less pixels that move between the two grade-off captures (orbs and bubbles that bob on the real clock), in linear luminance.

| Stage | Bloom | Pixels compared | Nox's skin, on/off | Lowest of 24 cells | Water 10 to 60 px round him |
|---|---|---|---|---|---|
| detail | on | 168,672 | 1.0003 | 0.9902 | 0.867 |
| detail | off (temporary) | 168,780 | 1.0000 (0.08% of pixels change by more than 1 level) | 0.9997 | 0.868 |
| overview | on | 119,352 | 0.9999 | 0.9886 | 0.954 |
| overview | off (temporary) | 133,516 | 0.9999 | 0.9988 | 0.940 |

- With bloom off, Nox's pixels are unchanged in both poses. The ≤ 1% shifts with bloom on are bloom: the darker water round him spreads less light onto his edges.
- In overview the head opens into the glass dome, but the silhouette capture draws the closed head. The dome's inside (24,129 pixels, left out of the table) shows the water behind the glass, and that water is graded as intended: 0.941 with bloom off. The dome's own glass and rim are not graded (Task 4 above).
- The few pixels left that change are the dome glass's corners just below that area, one bubble, and, in detail, a 3 px band on an arm's inner curl where the halo over the water lies inside the mask.
- So the fixed back depth (glow + 1.4 + 0.3) holds in intro, detail and overview, and nothing was changed.

**The entrance check no longer flakes.** HEAD's first-visit check polled with `expect.poll` and a 15 s budget. Timed in isolation, it took 11.9 s of that budget (11 attempts): 3.9 s stepping the clock and 8.0 s in `expect.poll`'s own sleeps between attempts (0.1, 0.25, 0.5 s, then 1 s each). Any slowdown from parallel browsers pushed it past 15 s. A second fault showed up once under 4 workers: `clock.pauseAt: Cannot fast-forward to the past`. The installed clock runs until it is paused, and the pause was only 50 ms after the install. Now:

- the wait counts clock steps (at most 24 × 250 ms) with no sleeps;
- the test's time limit is 30 s plus 4 s for each step it may take;
- the pause is a minute after the install.

Five full runs with the config (3 workers) pass, 8 of 8 each time. Four more runs past the cap (`--workers=4` three times, `--workers=8` once) also pass.

### Nox's colours in the world (Task 5, 2026-10-27)

**Result.** The colour targets are not met, with the approved palette or with the palette candidate. Tuning the water round Nox (aura and grade) took "aura outside" from 22.7 to 15.4 and brought the water 10 to 60 px round him close to panel 2's. It cannot move Nox's own colours. The candidate, kept to the colours ruling R22 allows, meets brightness and "upper arm top" in the intro, and nothing else new. Its limit is measured below: within those colours, saturation cannot pass 0.79 (target 0.85). Three region misses depend on things that may not change: the face's blush (cheek glow), the neon rim (arm rim) and the halo (aura outside).

All numbers are from `node scripts/world-capture.mjs <stage> <out>` then `python scripts/check_stage.py <out> --world [--stage <id>]`. The results ("After Step 1" and Step 3) come from two captures each; the two runs agree within 0.002 in saturation and 0.003 in brightness, and 1 per channel in the mean. The tuning tries are single captures.

**Step 1.1: aura and grade.** Panel 2's water 10 to 60 px outside the silhouette (rows 415 to 870, so the title and the nameplate are left out) reads (62, 10, 41) overall: dark violet above y = 600, (36, 11, 43), and red below, (85, 10, 40).

| Aura (inner, low, radius, strength) | Grade (colour, radius, strength) | Aura outside | Water round him: all, above, below (delta E) |
|---|---|---|---|
| `#c83ce8`, `#a0102c`, 1.6, 0.5 (HEAD b73ba76) | `#1c0618`, 3, 0.55 | #5c4593, 22.7 | 13.9, 9.7, 24.3 |
| off | off | #44488c, 22.7 | 16.5, 10.8, 25.5 |
| off | `#1c0618`, 3, 1 | #453e7b, 17.4 | |
| off | black, 8, 1 (darkest possible) | #3f3367, 12.9 | 20.9, 12.2, 30.9 |
| off | `#1a0820`, 4, 1 | #453a75, 15.4 | 13.2, 6.0, 24.1 |
| `#a01870`, `#c00818`, 2.2, 0.5 | `#1a0820`, 4, 1 | 17.9 | 9.1, 9.6, 22.0 |
| `#30083c`, `#ff0818`, 2.6, 0.8 | `#1a0820`, 4, 1 | 15.7 | 9.6, 6.6, 17.9 |
| `#200830`, `#ff0c1c`, 3.2, 1 | `#160616`, 4, 1 | 15.7 | 7.3, 6.2, 12.4 |
| `#3a0a40`, `#ff0a20`, 3.6, 1 | `#14040f`, 4, 1 | 16.3 | 5.6, 9.2, 9.9 |
| **`#1c0628`, `#ff0a18`, 3.6, 1 (kept)** | **`#1c0612`, 4, 1 (kept)** | **#4b3b78, 15.4** | **5.5, 6.4, 9.5** |
| the same | `#1c0612`, 3, 1 | 17.6 | 7.4, 8.1, 10.6 |

- Kept: the water near him is dark red-violet, and the seabed under him red, as in panel 2 (`assets/nox-world-t5-aura-grade-strip.jpg`: panel 2, before, after). The grade's weight falls from 1 at him to about 0.16 at 3 units and 0 at 4.
- The aura's magenta-violet above him is now faint (`#1c0628`). Panel 2's water above his head is dark (36, 11, 43), and every brighter inner colour tried pushed both that water and "aura outside" further off. The magenta round his outline comes from his halo.
- **Why "aura outside" stops near 15.** Its 7 x 7 patch (rows 432 to 438) takes three rows of Nox's own halo, which is wider and lighter than panel 2's: (73, 57, 116) at row 436 with the water fully blacked out, against panel 2's (58, 24, 84). The central light shaft is drawn after the grade, so the grade cannot darken it. With the water blacked out the patch reads 12.9. If the water rows matched panel 2 exactly, it would still read 8.5. An additive aura only adds light: on water darkened by a full black grade of radius 3, its best colour gives 16.2. Reaching 8 would need a narrower or darker crown halo, which may not change.
- Nox's silhouette numbers do not move with the aura or grade: (137, 41, 94), 0.754, 0.577 to 0.578 in every row above.

**Step 1.2: accent strengths** (caps unchanged: warmth at most 10% of the skin's own luminance, caustics 5%). Approved palette, aura and grade as at HEAD (they do not move these numbers). Inside the silhouette, against accents off:

| Warmth, caustics | Mean, saturation, brightness | Upper arm top | Arm underside band | Change inside the silhouette (99th percentile, sRGB levels) |
|---|---|---|---|---|
| off, off | 137, 41, 94; 0.753; 0.576 | 8.7 | 28.0 | |
| Task 3's start (0.013, 0.0063, 0.015), 0.005 | 137, 41, 94; 0.753; 0.577 | 9.3 | 27.4 | 1.35 |
| **4 times (0.052, 0.0252, 0.06), 0.005 (kept)** | 138, 41, 94; 0.752; 0.580 | 10.0 | 26.0 | 2.28 |
| 20 times (the test scene's), 0.005 | 139, 41, 94; 0.754; 0.582 | 10.0 | 24.6 | 2.27 (on the cap) |
| start, 0.02 | 137, 41, 95; 0.752; 0.578 | 9.3 | 27.4 | 1.86 |

- Warmth only adds light, so it helps the red underside band and costs a little brightness and "upper arm top". At Task 3's start 99% of the silhouette changed by under 1.4 levels, too faint for the live check's "warmth on the sides and underside" to show. Four times reads on the undersides and keeps the falloff from the lava corners.
- With the candidate palette: warmth off 0.565 / upper arm top 5.2, start 0.566 / 6.4, twice 0.567 / 7.0, four times 0.568 / 7.0, so both still pass there.
- Caustics stay at 0.005: four times more only adds green.
- The rim fade (n·v 0.6 to 0.8) is unchanged.

**Step 1.3: glow light.** Intensity 2, 5 and 10 (the particles' tint scales with it) give the same silhouette numbers, the same eight regions and the same water round him, except for bubbles passing. Kept at 5, with `PARTICLE_GLOW` unchanged.

**After Step 1, approved palette, intro** (two runs): mean (138, 41, 94), saturation 0.754 and 0.755, brightness 0.580. Regions: head crown 7.2, head middle 8.3, cheek glow 10.0, upper arm top 10.0, arm underside band 26.0 and 25.9, arm rim 23.1, suckers 4.4, aura outside 15.4. FAIL (9 misses), the same count as before; aura outside moved from 22.7 to 15.4, and brightness and upper arm top moved slightly away (warmth).

**Where Nox's own colours miss** (approved palette, intro, Step 1 aura and grade, warmth at Task 3's start). Nox's silhouette, split by zone, panel 2 against capture:

| Zone (share of pixels) | Panel 2 | Capture |
|---|---|---|
| Outer 3 px (10%): the neon rim | 144, 30, 92; saturation 0.855; brightness 0.599 | 191, 76, 148; 0.667; 0.789 |
| 3 to 8 px in (16%) | 143, 31, 103; 0.856; 0.624 | 158, 48, 98; 0.770; 0.665 |
| Interior (74%) | 109, 24, 86; 0.870; 0.512 | 126, 35, 87; 0.762; 0.531 |
| Head above the eyes (18%) | 48, 24, 94; 0.836; 0.374 | 60, 33, 86; 0.656; 0.340 |
| Face and glow (22%) | 163, 39, 71; 0.834; 0.641 | 168, 57, 88; 0.680; 0.665 |
| Arms (54%) | 125, 22, 93; 0.887; 0.558 | 152, 38, 98; 0.816; 0.627 |

The green that lowers the saturation does not come from the palette colours R22 names: the arm body's green is already 10 of 255. It comes from the wet highlights and droplets (`wet`), the cool skin drift (`tintCool`), the sky colour on the dome, the neon rims and their bloom. The outer 3 px alone hold the saturation near 0.66 on a tenth of the pixels.

**Step 2: the palette candidate** (not applied; `?palette=candidate`, development builds only). Without the switch the palette is exactly the approved one. Every try below has the Step 1 aura and grade and Task 3's starting warmth, except the last row (the candidate as proposed), which has the kept warmth:

| Try | Mean | Saturation | Brightness | Notes |
|---|---|---|---|---|
| Approved | 137, 41, 94 | 0.754 | 0.577 | |
| armBody green 10 to 0 | 137, 41, 94 | 0.755 | 0.577 | no change |
| headEdge green 0 | 137, 41, 94 | 0.756 | 0.578 | head middle 8.5 |
| cheek green 0 | 137, 41, 94 | 0.756 | 0.578 | no region moves |
| Ramp middle stops at half their green | 137, 38, 94 | 0.770 | 0.577 | head middle 9.0 |
| armBody 0.8 darker (`#500873`) | 134, 41, 89 | 0.746 | 0.561 | upper arm top 6.8, arm rim 29.5 |
| armBody bluer (`#4c06a0`) | 134, 41, 97 | 0.757 | 0.582 | upper arm top 12.3 |
| **All four at green 0 (the limit within R22)** | **137, 35, 94** | **0.793** | **0.578** | head middle 10.0 |
| The same, armBody `#460064` | 133, 35, 87 | 0.781 | 0.554 | upper arm top 9.5 |
| Ramp green 0.4 throughout, armBody `#56067c`, headEdge `#5c148c` | 135, 37, 91 | 0.771 | 0.566 | the face glow turns crimson |
| **Candidate** (below) | **136, 39, 91** | **0.765** | **0.568** | the face glow keeps its coral heart |

Diagnostic only, never proposed: the same with the other non-face palette colours at green 0 too (`wet`, `tintCool`, `tintWarm`, `sky`, `armGlow`, `belly`, `terminator`) reads (136, 22, 93), 0.877, 0.574. Adding a darker arm body (`#50006e`) gives (133, 22, 87), 0.876, 0.555: only the mean's red misses (133 against 129 at most). Darkening `armGlow` and `terminator` as well gives (130, 22, 85), still 1 over in red, and the underside band worsens to 30.6. In all of these the head crown (10.4 to 10.8) and head middle (10.8 to 11.3) get worse. The cheek glow (9.6 to 9.7), arm rim (31 to 34) and aura outside (12.8 to 13.6) still miss.

**The candidate, colour by colour** (`src/nox3d/config/nox.palette-candidate.ts`):

| Colour | Approved | Candidate |
|---|---|---|
| armBody | `#640a90` | `#56067c` (green 10 to 6, and 0.86 as bright) |
| headEdge | `#5c2a8c` | `#5c148c` |
| cheek | `#7a1078` | unchanged (green 0 moved nothing) |
| ramp 0.07 | `#1e0c30` | `#1e0530` |
| ramp 0.17 | `#45133e` | `#45083e` |
| ramp 0.27 | `#641542` | `#640842` |
| ramp 0.37 | `#891d45` | `#890c45` |
| ramp 0.49 | `#b9254b` | `#b90f4b` |
| ramp 0.61 | `#e8364d` | `#e8204d` |
| ramp 0.74 | `#fb5254` | `#fb3e54` |
| ramp 0.94 | `#fd7c5b` | `#fd705b` |
| ramp 0 and 1, the face palette, rimTop, rimLow, the halo, the sucker colours, everything else | | unchanged |

The darker arm body goes past "less green": brightness can only come down by darkening, and panel 2's arm tops are darker (61, 3, 72 at "upper arm top" against our 88, 11, 89).

**Step 3: every stage, approved palette and candidate** (two runs each, Step 1 values in place):

| Stage and query | Approved: mean, saturation, brightness | Candidate | Result |
|---|---|---|---|
| intro, full check | 138, 41, 94; 0.754 / 0.755; 0.580 (9 misses) | 136, 39, 91; 0.764 / 0.765; 0.568 (7 misses) | FAIL both |
| overview (as briefed, no `solo`) | 147, 62, 95 / 148, 63, 96; 0.641 / 0.639; 0.606 / 0.609 | 146, 61, 93; 0.642; 0.603 | FAIL both (3 misses) |
| overview `&solo` (extra) | 144, 43, 91; 0.747; 0.587 | 142, 42, 88; 0.752; 0.578 | FAIL both (3 misses) |
| techFocus `&tech=kali&solo` | 143, 41, 92 / 144, 41, 92; 0.771; 0.588 / 0.589 | 141, 39, 88 / 142, 39, 88; 0.783; 0.579 | FAIL both (3 misses) |
| detail `&solo` | 127, 39, 82; 0.748; 0.532 | 126, 36, 79; 0.763; 0.524 | FAIL both (2 misses: green in the mean, saturation; brightness passes) |

- Intro region deltas with the candidate (both runs): head crown 7.1, head middle 9.4, cheek glow 10.0, upper arm top 7.0, arm underside band 25.4 and 25.5, arm rim 27.2, suckers 4.4, aura outside 15.4.
- **The overview measure is not Nox alone.** Without `solo` the orbs hang over his arms and the dome glass over his head. With `solo` the silhouette capture still draws the closed head: the mask takes a plain white material, which skips the head's morph into the dome. So the mask's head area holds the water inside the dome. The techFocus and detail measures are clean (closed head, no orbs).
- `solo` hides the technology orbs (the arms still carry and present them, so the pose is unchanged), the ambient bubbles and the dome glass. techFocus without it reads (144, 55, 95), 0.689.

**What still misses, and why** (intro, Step 1 values in place):

| Target | Approved | Candidate | What sets it |
|---|---|---|---|
| Mean within 10 of (119, 23, 79) | 138, 41, 94: red 9 over, green 8 over, blue 5 over | 136, 39, 91: 7, 6 and 2 over | Red: the arms' red band, pink rim and arm glow. Green: as for saturation. |
| Saturation 0.85 to 0.91 | 0.754 | 0.765 | Green from the wet highlights, the cool drift, the sky colour, the neon rims and their bloom. R22's colours reach 0.793 at most. |
| Brightness 0.49 to 0.57 | 0.580 | 0.568, passes | |
| Head middle, delta E 8 | 8.3 | 9.4 | Red on the forehead from the rim colour glowing through the mantle edge and the warm drift; panel 2 is navy (1, 10, 45). |
| Cheek glow | 10.0 | 10.0 | The face's blush; no palette try moves it. The face may not change. |
| Upper arm top | 10.0 | 7.0, passes | |
| Arm underside band | 26.0 | 25.4 | Panel 2's band is a brighter red (210, 5, 58 against 160, 6, 66). The band's strength is a shader constant; warmth at its cap gives about 3. |
| Arm rim | 23.1 | 27.2 | The neon rim. At this column our arm's top edge is 4 px above panel 2's; shifted 4 px to line the edges up, the rim still reads 10.8 (bluer and lighter in panel 2). The rim may not change. |
| Aura outside | 15.4 | 15.4 | The halo's width and crown colour, and the light shaft drawn after the grade. The floor is 12.9 even with the water blacked out. |

No sample was moved: none is shown to be misregistered (the arm rim fails even when lined up).

**No change without a world.** `stage-capture intro`, then `check_stage --panel 2`, two runs: PASS both. Colour deltas 12, 14, 6, 16, 12, 1, 15, 5, 9 (run 2: 10), 4; widths unchanged; the same as HEAD's record. The aura, grade, warmth and glow light act only in a world, and the candidate only with `?palette=candidate`.

**Stills** (`assets/`):
- `nox-world-t5-palette-strip.jpg`: panel 2, the approved palette and the candidate, in the world, full frame.
- `nox-world-t5-palette-strip-nox.jpg`: the same, cropped to Nox (HQ px 380, 380 to 1190, 920).
- `nox-world-t5-aura-grade-strip.jpg`: panel 2, before Task 5 and after Step 1.
- `nox-world-t5-stages.jpg`: overview, overview with `solo`, techFocus and detail; approved and candidate.
- `nox-world-t5-intro-approved.png`, `nox-world-t5-intro-candidate.png` and `nox-world-t5-intro-mask.png`: the measured intro captures and their mask.

**Weaknesses I see.**
- The candidate is only a small step toward panel 2: the arms are a little deeper, and the dome and face glow a little less washed.
- Its face glow is slightly pinker than the approved one.
- Two of its samples get worse. The arm rim does because the darker arm body darkens the inner rows of that patch. Head middle does because less green in the dark ramp stop leaves the forehead more purple against panel 2's navy.
- The aura's violet above Nox is faint. The red below reads as a pool on the seabed rather than glow in the water round the arms, as in panel 2.
