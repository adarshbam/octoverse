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

### Overview orbs and the flight (Task 12): PROVISIONAL, not approved

Open the overview live (`?world=aether`, then Explore or click her head) and watch the head swell: the ring's beads brighten, split into orbs, fly to her arms and hang there on gold threads. Then hover an orb. Stills in `docs/superpowers/evidence/aether/m3/`:
- `t12-p3-vs-overview.webp`: P3 left, the settled overview right (registered pixel for pixel).
- `t12-flight-0.1-0.75s.webp` and `t12-flight-0.85s-settled.webp`: the opening at 0.1, 0.3, 0.6, 0.75, 0.85, 0.95 and 1.0 s, and settled.

Numbers (all in `docs/superpowers/reviews/aether.md`, Task 12):
- Orbs 0.6 across, 16 lavender-white rim beads each, a gold cap (0.05) at a gold thread 0.16 long.
- Her ten technologies hang on the upper slots (T1, T8, T2, T7 both; T3, T6 tips). Up to 16 hang (two an arm); more go to the tray.
- Flight: beads brighten 0.2 to 0.43 s, split 0.43 to 0.6 s, orbs fly 0.6 to 1.24 s (T1's tip first), settle by 1.35 s. Float: at most 15 degrees, settled in 1.4 s, 0.03 bob over 3 to 5 s.
- No orb in flight touches her face box, for 10, 15 or 16 technologies (tested). They fly over the dome for about half a second.
- Reduced motion: a crossfade, no flight.

What to check:
1. **Orb rim beads and cap**: P3's rims are a solid glowing ring; these are dotted beads. The glass is lighter than P3's dark glass. Close enough?
2. **The flight**: timing, the arcs (orbs from a bead across her centre line rise over the top), the small stagger (0.06 s first to last), trails, the landing. It has no arm "catch" dip on landing.
3. **No orb over the face**, in flight or hanging.
4. **Orbs over the arms**: all ten of her orbs overlap an arm (only four of the 16 slots clear the arm tubes, none of them hers). P3 has some of this too. Acceptable?
5. **Blank orbs and Redis**: five orbs have no logo (OpenAI, Next.js, PostgreSQL, AWS, Vector DB; engine follow-up "Logo marks"). Redis's mark is red. Keep it or recolour it?
6. Her ten leave the bottom of the horseshoe empty, where P3 has orbs all round.

### Static P3, P4 and P5 (Milestone 3, Task 13): PROVISIONAL, not approved

Open `?world=aether&stage=techFocus&tech=openai`, `?world=aether&stage=detail` and the same on a 390 x 844 phone. Stills in `docs/superpowers/evidence/aether/m3/`:
- `t13-p4-vs-techfocus.webp`, `t13-p4-mouth-vs-render-3x.webp`: P4 left, the frozen tech focus right.
- `t13-p5-vs-detail.webp`, `t13-detail-ui.webp`: P5 left, the detail right; the detail page with its panel.
- `t13-phone-intro-overview-techfocus-detail.webp`: the four frozen stages at 390 x 844.

Numbers (all in `docs/superpowers/reviews/aether.md`, Task 13):
- P4 samples: **not what a visitor sees.** A real tech focus shows the overview's `happy` face (WorldHost draws the returnTo pose). The samples were taken with the expression forced (`expression=curious` in the URL), so they describe the face Task 19's arm lift (expression `curious`) will show; none of it is visible on a real tech focus until then.
- Mouth inside: 7.5 with a patch at the render's own inside centroid (pass), 15.0 by the inside's region mean (miss), 64.7 at P4's point carried by the eyes (miss). It passes only under the most favourable registration.
- Tongue: 25.0 on a patch (MISS: the tongue's own colour is 1.8 off by region mean, but it is 22 px against P4's 176 px, so the patch takes in the dark mouth), 50.7 eye-registered. Focused orb rim: 3.8. Her mouth sits higher than P4's and is a V/U, not P4's D.
- Tools: `src/worlds/aether/review/p4de.py` (mouth) and `src/worlds/aether/review/p4rim.py` (rim).
- Detail: her eyes land within 2.5 px of P5's; eye line 22 degrees as painted; yaw 0.32, tilt 0.37.
- Phone: no bead, orb or thread on her face rect, the title or the nameplate in any frozen stage, tested for 1, 3, 10, 15, 16 and 20 technologies (not every count from 1 to 20); the ring keeps its 45-degree face sector and shrinks with her (ratio to her head 1.671 at both sizes); the phone tray lists her ten (e2e). On the phone she is drawn smaller and centred, not in the upper screen.
- Held orb on a real tech focus: the intended pick (a model: nearestArm from the orb's true place) lands every orb at least 37.9 px clear of her face. The frozen render instead holds OpenAI on T4, about 10 px off her face at 509 x 504: an engine bug (below), held by an expected-failure e2e test on the real page.

What to check:
1. **The lifted arm curling over the orb.** It is authored (`AETHER_POSES.techFocus`, T1 mirrored from P4) but **not drawn yet**: the engine shows a focus in the overview's pose (dome open) and pulls the orb with Nox's suction hold. On the still the held OpenAI orb sits by her left eye among T2's arm, about 10 px off her face. Task 19's arm lift draws the traced arm. Is the traced shape right (crest 1.2 above the eyes, tip over the orb's top)?
2. **The open mouth.** Small V/U with a small tongue against P4's big D (engine). Colours are right.
3. **Aether at the left edge facing the panel**: placement, turn and lean against P5; her arms are the intro's, not P5's longer hanging ones. The panel's left edge comes just over her right cheek on the page.
4. **The ring back round her head** in the detail: tilted with her head it rides high round the crown (as P5's). Its rear bead passes behind her brow, hidden by her head.
5. **Phone frames**: she is centred, not in the upper screen (shared framing); the overview's sheet and tray take the lower third; in the detail the sheet covers her. 15 or 16 technologies reach the tray's third row (known limit, as Veyra; Task 20).
6. **From Task 12, still open**: the flight's stagger reads as a near-simultaneous launch (0.06 s first to last), not a "ripple" from the upper arms down; all ten orbs overlap an arm.

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
- `t10-render-entering-t3.2-her-and-portal.png`: her and the portal in one frame; `t10-fix1-relic-entrance-t1-to-t8.4.webp`: the eight entrance frames the relic check reads; `t10-fix3-relic-check.txt`: its latest output;
- `t10-world-capture-intro.png` (+ mask), `t10-world-capture-intro-desktop-tier.png`;
- `t10-numbers.txt`: every check's output.

Numbers (rounds in `docs/superpowers/reviews/aether.md`, "Task 10"):
- **Samples: 19 of 23 within delta E 10** (Task 9's world: 16).
  - Water outside the head 1.9 (was 74.7), mid water 5.9, upper water 4.6 (9.4 at the desktop tier, was 21.9), ruin window light 2.2 (was 63.7).
  - Open: jellyfish bell 13.2 (12.4 desktop; engine request below), plus the three Task 6 owner decisions (arm body upper 39.4, beads 89.0 / 44.4).
  - Her own samples are unchanged.
- **All four global checks pass:** warm core 154; pink, not white R-G 40 / 37, G 215 / 218; periwinkle arms B 240 / 239; indigo water B 88, B-R 72. Mean inside her silhouette and IoU (0.8505) are unchanged.
- **Relic, entrance (over the whole placeholder entrance, fix rounds 1 to 3):** her and the portal in one frame, through the same camera, at t 1, 2, 3.2, 4.5, 5.5, 6.5, 7.5 and 8.4 s, plus the portal over one full glyph pulse:
  - Brightest pixel in the portal's area over her face glow in the same frame: 0.77, 0.84, 0.77, 0.77, 0.81, 0.56, 0.95, 0.82. Seven of these are bubbles or specks in front of the portal, where the portal itself draws Y 0.005 to 0.15; the 0.95 is a speck (Y 0.864) where the portal draws 0.037. The t 6.5 one (Y 0.504) is her own light on the lower-left lantern as she passes it; it counts.
  - The portal's light, bubbles and specks taken out but her light on it kept, against her face glow at its breathing trough (x 0.949, measured): 0.51 to **0.85** (t 7.5: her light on the lantern, Y 0.734).
  - The portal at its pulse peak (bubbles filtered out) against her dimmest face glow at its trough (0.873 x 0.949 = 0.829): 0.81 (0.87 in an earlier run).
  - **t 1 is unverified:** she is too far in the murk for a face glow (her brightest pixel there is Y 0.511). It is compared with her dimmest measured face glow instead. In that window, the portal's own lantern (0.475) is just below her brightest pixel, and the passing bubbles (0.676) are above it.
  - Pass: worst counted ratio 0.85 (0.87 in the earlier run). The checker's limits (a state-gated light under 850 px on a dark part of the portal, a flash under 0.9 s) are in the review doc.
- **Look note (spec 7.7), for you:** the bubbles and specks crossing in front of the portal are brighter than anything on it. Against her face glow at its trough they reach 0.95 to 0.999 in the measured frames, and the brightest running pixel is pure white (Y 1.0). The relic rule holds for the portal, but world elements near it can outshine her face glow. Is that acceptable, or should the bubbles be dimmed near the portal?
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
6. **Bubbles past the portal (spec 7.7 look note).** Let the entrance play and watch the bubbles cross the portal: they reach pure white, brighter than her face glow at its dimmest. Keep, or dim them near the portal?
7. **Overall.** The world is sparser and darker than P2: dark blank tower faces, few warm lights, and no bloom on the windows or jellyfish (bloom starts at 0.95 to keep her pupils dark). Is this calm enough, or too empty?

### Back view (Task 14, Milestone 4): PROVISIONAL, not approved

Look at it live: http://127.0.0.1:5196/?world=aether&stage=intro&freeze&yaw=180 (and `yaw=45`, `90`, `135`; `stage=overview` for the dome; add `&orbit` and drag on the water, not on her, to look from above or below). Stills in `docs/superpowers/evidence/aether/m4/`: `t14-intro-yaws.webp`, `t14-overview-yaws.webp` (yaw 0, 45, 90, 135, 180), `t14-intro-yaw180.webp`, `t14-overview-yaw180.webp`, `t14-desktop-frame-yaw0-180.webp`, `t14-rear-roots-committed-vs-option.webp`. Per-yaw table and numbers: `docs/superpowers/reviews/aether.md`, "Task 14". No source changed.

Verdicts against spec 2.3:
- **Round and glassy: pass** (intro and overview, all yaws).
- **Specks and rim continue: pass.** Intro dome specks 8 / 7 / 9 / 11 / 15 at yaw 0 / 45 / 90 / 135 / 180 (the back at least as many as the front); rim luminance 235 to 239 at every yaw. The overview dome has no specks front or back (as P3).
- **The ring circles behind the head: pass,** all five beads and the line at yaw 45 to 180. **Spec 7.5's dimmed rear beads: not met** (engine): the bead behind her at yaw 0 is hidden, not seen through the jelly.
- **Face not visible from behind: pass.** No face or glow card at yaw 180 (0 dark and 0 peach pixels on the head at 180; also checked on the 1536 x 1024 frame).
- **Overview from behind: pass with a limit.** No orb inside the dome. From behind the orbs are dark glass discs without a logo; yaw 90 piles them in a column (arms authored flat, as Nox and Veyra).
- **Popping or holes: one fault, the rear arm roots,** at yaw 135 and 180: T1 and T8's root caps meet in a hard butt joint with a notch. Veyra's fix (`rear()` z `[0, -0.62]`) removes it but costs the front one P2 sample (arm underside glow 6.0 to 17.2) and two tests, so I did not apply it.

What to check:
1. Walk yaw 135 to 180 on the intro and overview: the crease where the two upper rear arms meet at the centre. **Owner call:** apply the fix (cost above) or live with it.
2. The ring from behind and from the side: does it read as circling her head? At yaw 90 its line crosses the face's edge (side view, no stage shows it).
3. Overview orbs from behind: anonymous dark discs. Acceptable, or should logos show?
4. The pink wash low in the dome at yaw 135: the face glow through the jelly. Wanted?
5. Motion (twinkle, sway, the head turn) was not judged from stills.

### Curious personality (Task 16, Milestone 5): PROVISIONAL, not approved

Live: http://127.0.0.1:5196/?world=aether&stage=intro (no `freeze`: every item below is motion, so a still shows nothing). Leave the pointer away from her for a minute first. Values: `src/worlds/aether/character.ts` (personality) and `poses.ts` (`INTRO_LOOK_POINTS`); logic and tests: `moments.ts`, `moments.test.ts`. Report: `.superpowers/sdd/2026-11-03-aether-world/task-16-report.md`.

What to look at, and what is only data and tests tonight:
1. **The tilt** (visible live). Head leans up to 6 degrees to one side every 5 to 9 s, takes 4.6 s (2.2 s over, 0.2 s hold, 2.2 s back). Tests: count 6 to 12 in 60 s; never faster than her head turns (measured). Not judged by eye. Is 4.6 s too slow or the 6 degrees too small? Owner call: the "sometimes a blink at the top of the tilt" is not built (engine request below).
2. **The gaze wander** (visible live). Eyes move to a new point every 4 to 8 s: the left jellyfish, the right jellyfish, the title's upper right corner, or you (straight ahead). With a look point in play the pointer holds her eyes for 1.5 s, not 3.5 s. Tests pin the points and the schedule; where the eyes really land was not looked at. The four points are authored from P2 and the title box: say if one should move.
3. **The reach** (visible live). Every 10.4 to 17.4 s (flourishRate 4.6; the spec says 10 to 16, the engine's wait range is fixed at 0.8 to 4/3 of the mean) one arm uncurls its tip up to 40% and rolls back, 3 s. It is the flourish layer Veyra uses, so it does not aim "toward a nearby point of interest": that is an engine request below. Tests: 3 to 5 starts per 60 s over 200 seeds.
4. **The spark** (DATA AND TESTS ONLY, not visible). The trigger (pointer within 1.2 units for over 1.5 s), the wave (1.2 s, `uSparkleWave` 1 to 0, face to crown), the bead flicker and the 8 s cooldown are a tested pure function, `sparkStep` in `moments.ts`. The engine has no hook to call it, so nothing happens live. Never fires during a lift or the swell (tested).
5. **Nothing reads as nervous.** Visible live for the tilt, the wander and the reach, one at a time each; "never two moments at once" is tested on the schedules but NOT live: the engine runs the tilt, the reach and the wander independently, so today they can overlap (the test finds overlaps in the raw schedules). The tilt alone is about 66% of the time (4.6 s of every 7 s on average), so with the arbiter the reach and wander will be pushed back often. Owner call: shorten the tilt, or let the eyes-only wander run during it.

Also changed (values from spec 7.8): `settle` 0.8 (the micro settle amount is Nox's 0.03 now; it was pre-scaled to 0.024, which would have been applied twice), `glideBias` 1.4 (the swim glide base is 0.85 / 1.4, so the effective glide stays 0.85 s and the entrance stroke stays 1.69 s). Other table values already matched.

### Entrance (Task 17, Milestone 5): PROVISIONAL, not approved

Live: http://127.0.0.1:5196/?world=aether. Use a fresh tab: the entrance plays once per browser session (`octoverse.aether.entranceSeen` in sessionStorage). Clear it, or open a new private window, to see it again.

Stills: `docs/superpowers/evidence/aether/m5/`:
- `t17-entrance-stills.webp`: t 0.5, 2, 3.2, 4.8 and 6, with P1;
- `t17-p1-vs-entrance-t2.webp` and `t17-p1-vs-entrance-t3.2.webp`.

Review: `docs/superpowers/reviews/aether.md` "Task 17". Report: `.superpowers/sdd/2026-11-03-aether-world/task-17-report.md`.

Numbers:
- Clearance gap 0.73 with the arms as drawn, 0.41 held open, 1.51 held closed (bar 0.3).
- Relic, worst counted ratio 0.926 (t 5.3). The counted ratios run 0.512 to 0.926 across the frames: 0.864 at t 2, 0.814 at t 4.8, 0.926 at t 5.3, and 0.901 at the pulse peak. Only the lantern and membrane rows are 0.51 to 0.58 (0.512 at the flash's peak). The others are bubbles on the steps, counted by the size rule (BLOB_MIN 850 px).
  - Which side of 850 px a bubble lands on is arbitrary: the t 5.3 bubble counts at 964 px because it merged with the coral's sway; a t 6 bubble (Y 0.978, ratio 1.077) is excluded at 626 px; bubbles at 1.077 to 1.103 stay uncounted.
  - The margin under 1.0 is about 7%, on an estimated trough of 0.813.
- Under load at tier low: 99.0 and 98.0 fps median. Those runs used `--disable-frame-rate-limit` (not capped at 60), and a small, wide framing does not lower GPU cost. The sample is 6 s starting 1.5 s after `ready` (40 frames after load); it covers most of the 6.3 s entrance and may run into the intro, but the log does not record when the entrance clock started, so I cannot say exactly.

What to check (motion is live only; nothing here was judged from video):
1. **The glimmer in (0 to 1 s).** A violet glow left of centre, deep in the haze, becoming her. Is it found by the eye, or too faint?
2. **The two strokes toward the portal (1 to 4.2 s).** Head leading, arms trailing.
   - Do the arms read as P1's long ribbons? In the stills they read as short, thick arms: the trail is swung back and foreshortened.
   - Is she too small? The frame is widened, not turned, to keep the portal in view.
3. **The glyph firing and her look-back (~3.2 s).**
   - Only the membrane brightens (up to 25%, once, peak at 3.2 s). The glyph's own light running across its folds needs the engine.
   - The look-back (head toward the portal, 3.0 to 3.8 s) is authored in the sheet but **not drawn**: the engine passes no head turn from the entrance. Expect no look-back live.
4. **The turn with the 12 degree tilt (4.2 to 5.3 s).** Owner decision: the turn inside 4.2 to 5.3 s is 50 degrees, not "about 90". Spec 7.9 says "turns about 90 degrees (three-quarter side to front)"; the parenthetical fits 50, the number does not, and the plan text conflicts. The whole entrance turns 90 (90 to 50 on the swim, 50 to 0 in the turn). Which do you want?
   - She faces 90 degrees right at the start, 50 at the pass (so her face stays toward the unturned camera), and turns 50 to 0 here.
   - The 12 degree tilt is authored but **not drawn** (engine). Does the turn read as "first sees the visitor"?
5. **The settle, then look, blink, smile (5.3 to 6.3 s).**
   - The arms come forward and open; the smile (gentle) lands by 6.3 s. The words come in at 5.85 s.
   - The look and blink are authored but not drawn. The engine blinks on its own random schedule, so the order look, blink, smile is not guaranteed live.
6. **The camera blend.** The entering frame (16 wide) eases into the intro's only after the entrance ends (6.3 s), not during the turn.
   - Does the late zoom-in read well, or should the engine blend during the turn (request below)?
   - Does the title land in the right place while the camera is still easing?
7. **The ring.** It forms by the `twinkle` appear (Task 18); with no twinkle yet it is shown in the intro as before. The sheet ends at 6.3 s, not 7.7.
8. **Skip, and reduced motion.**
   - A key or click skips to the intro (ring shown).
   - With reduced motion she is simply present in the intro pose.
   - Tested: the engine's reducer (SKIP and ENTRANCE_DONE from entering land in the intro), Aether's own session-flag key, and the reduced-motion start pose, pinned. The reducer has no clock, so a skip at each time is not driven separately. Not looked at live tonight.

Minor, not a decision: `AETHER_ARM_HALF_SPAN` in `sequences/clearance.ts` is hand-set (open 2.4, closed 1.3). Its comment says the trail's farthest point is 2.72 from her head; that is asserted, not verified. The clearance gaps (0.73 as drawn, 0.41 held open) depend on it.

### Technologies live (Task 19, Milestone 6): PROVISIONAL, not approved

Live: http://127.0.0.1:5196/?world=aether, Explore (or click her head), then hover, Tab to or tap an orb. Phone: the same at 390 x 844 (the tray). Stills in `docs/superpowers/evidence/aether/m6/`:
- `t19-techfocus-openai-lift.webp`: `?world=aether&stage=techFocus&tech=openai&freeze`, the lift at rest (T1 curled over OpenAI, the tooltip, the head closed).
- `t19-lift-200ms.webp`: the same with `&hold=200`, 200 ms into the lift (root ahead of the tip).

What is built: her select is Veyra's arm lift with her tuning (`select: { kind: 'armLift', ease: 0.5, scale: 1.3, threadShorten: 0.5 }`), choosable in the overview only. The orb's own arm lifts it: T1 to her traced P4 lift (`AETHER_POSES.techFocus`), every other arm turned rigidly toward the pointer (straight up and forward by keyboard or touch). The head closes and she wears `curious` (the techFocus pose's face). Each of her ten technologies has 3 or 4 placeholder usage lines (OpenAI's are P4's); the test five have none. The engine needed a small change (the arm lift ran only with the pendant placement); see the Task 19 report.

Verified by test (unit and e2e):
- the lift is 500 ms, every point of the arm there by 500 ms, the root ahead of the tip at 170 ms; choosing a second orb lowers the first (one at a time); OpenAI lifts on T1, Python on T8;
- the intro has no orb button, the first stop after the skip link is Explore, and clicking her head opens the overview with ten orb buttons;
- in the overview Tab reaches the ten orbs in slot order; Enter shows the tooltip with the usage lines; choosing another moves the lift to its arm; Escape hides the tooltip and lowers the arm;
- on a phone the tray lists the ten, and tapping OpenAI plays the lift on T1 with its tooltip;
- the frozen tech focus: T1's drawn tip is the tip nearest the OpenAI orb (the old T4 hold bug is gone for her), above the orb's centre and within an orb's width of it. The orb's centre reads at stage (-1.50, 0.39) against `TECH_FOCUS_ORB` (-1.568, 0.387); T1's tip reads about 0.13 from P4_LIFT's tip (Task 13 target 0.04 for the whole arm: not met, not chased).
- twenty technologies put sixteen on her arms and four in the tray: **model only** (no page address loads a 20-technology test bundle, and a project names at most 15).

Only your eye can judge (nothing here was judged from video):
1. **The flight and the float** (unchanged from Task 12) now ending in a choice.
2. **The lift**: does T1 rise root first and the tip curl over the top of the orb and hold it (P4)? The other arms lift rigidly (no traced shape of their own): do they read as reaching, or as stiff?
3. **The wonder face**: the `curious` face with the head closing as the arm rises.
4. **The tooltip**: placement beside the orb, the PLACEHOLDER badge, the lines.
5. **The look of the chosen orb**: it grows 1.3x on a thread half as long. Its rim and halo go to her `orbFocus` lavender-white (#e4d9f8); the spec's soft *cyan* halo is not possible from her config (the halo takes the same focus colour; engine request). The other orbs dim 25% (engine constant), not the spec's about 20%.
6. **Logos**: five of her orbs are blank (OpenAI, Next.js, PostgreSQL, AWS, Vector DB): the engine has no mark for them and no lettered fallback (an earlier note said there was one: there is not). Redis is red. Both need the engine (request below).
7. **No arm "catch" dip on landing** (spec 7.5 flight table): still missing; it needs the engine.

### Synapse effect (Task 20, Milestone 7): PROVISIONAL, not approved

Live: http://127.0.0.1:5196/?world=aether, Explore (or click her head), and watch inside the glass as it swells (and again closing). Stills (the head swell's time in seconds, `?freeze&swell=`, beside P3) in `docs/superpowers/evidence/aether/m7/t20-synapse-stills-vs-p3.webp`: 0.2 s (nothing yet), 0.5 s (progress 0.26: nodes waking), 0.72 s (0.45: lines wiring up from the bottom), 0.9 s (0.61: the wave reaches the crown), 1 s (0.70: the pulse, the whole network lit), and the settled overview (bare `?freeze`: no network, the dome as Task 11 left it).

What is built: the engine's new `synapse` head effect (HEAD_EFFECTS, one points draw of 24 nodes and one line draw, nothing allocated per frame), with her colours (node `#c9d6ff`, line `#d99982`). The sheet's `effect` track is retimed to the flight, 0.2 to 1.35 s (it was Nox's 0.65 to 1.5 s). In effect progress: nodes wake 0 to 0.3, lines wire face to crown 0.3 to 0.65, one pulse peaks at 0.725, lines thin and nodes melt into the glass 0.8 to 1; the network is gone at progress 1, so the settled overview is exactly Task 11's (dome samples 7.1 / 8.2 / 3.9, all within 10). Closing runs at twice the speed.

Verified by test: node and line opacity are 0 at progress 0 and 1; exactly one pulse peak, inside 0.65 to 0.8; a lower edge wires before a higher one; closing is twice as fast (the effect is gone when the swell is half undone) and a jump to a moment lands at once; no Float32Array is made in `update`; `dispose()` is idempotent; reduced motion is a crossfade (no wave, no pulse); Nox's glyphs fixtures are unchanged. Test-verified only, never seen: the closing at twice the speed, and the reduced-motion crossfade. The crossfade cannot show live at all today: with reduced motion the swell run returns the head simply open or closed (`restingSwell`), so the effect's progress is only ever 0 or 1 and nothing is drawn (see Engine follow-ups from Task 20).

Only your eye can judge:
1. **The nodes waking**: 24 small stars lighting at random through the glass: too many, too few, too small? (The size is `NODE_SIZE` in `synapse.ts`; 12 px at the overview.)
2. **The gold wave rising**: lines grow from the lower node of each edge and the lower edges wire first. Are the lines thick enough (they are 1 px; WebGL draws no wider) and the colour right on the blue glass (a pink-gold, `#d99982`)?
3. **The single pulse** just before the dome settles: brighter and bigger for about a tenth of a second at 1.1 s.
4. **The dissolve into the sheen**: the nodes swell and fade while the lines thin out; does it land as the dome settles, with the project panel to come (Task 21)?
5. **Early in the swell** (fix round 1): each node and line end now shows only once the dome's glass has formed round it (the glass's reveal), so none stands above the half-shell at 0.5 s. Check that the nodes appear inside the glass as it blooms rather than popping in.
6. **Frame rate** (round 1: the swell-start stall was not A/B'd; it is left for Task 21's perf pass): settled overview at tier low 46.3 and 56.5 fps median under load; the live opening's window (2.5 s after Explore) read 42.9 and 62.1 fps median, with stalls in the first run (19 frames in 2.5 s). The stalls are not isolated to the effect (not measured with the effect off).

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
- **Tech focus shows the traced arm (Task 13).** *Task 19: done by the arm lift with the satellite placement (engine commit `feat(engine): armLift works with the satellite placement (for Aether)`); the focus takes her techFocus head and face, and T1 lifts to the traced arm. T1's tip reads about 0.13 from P4_LIFT's, not 0.04.* `src/engine/host/WorldHost.tsx` shows a focus in its `returnTo` stage's pose (`const shown = state.stage === 'techFocus' ? state.returnTo : state.stage`, then `blender.start(stagePoseOf(poses, reviewSwim, shown))` and `headOpen={headOpens(stagePoseOf(..., shown))}`), so `poses.techFocus` (arms and `headMorph` 0) is never drawn and the dome stays open. The only select is `suctionHold`, which pulls Aether's OpenAI orb beside her left eye.
  - Wanted: the arm lift select (Veyra's `armLift`, spec 7.5) that blends the chosen arm to `poses.techFocus.arms[arm]` (root first, tip last, about 500 ms) and holds the orb under the curl, and the focus taking `poses.techFocus.headMorph`.
  - Target: on `?freeze&stage=techFocus&tech=openai` her T1 lies within 0.04 of `P4_LIFT` (poses.ts), the orb at `TECH_FOCUS_ORB` (-1.568, 0.387) grown 1.3x, the head closed; the P4 rim sample stays within dE 10.
- **Open mouth shape and tongue (Task 4, Task 13).** `src/engine/character/mouthShape.ts` keeps the closed smile's curved top line and `FaceCanvas.ts` draws the tongue as an ellipse of 0.32 x the mouth's width in the bottom third of the opening.
  - Wanted (optional, absent = today): `FaceLayout.mouth.openTop` (how flat the open mouth's top goes, for P4's D) and `FaceLayout.mouth.tongue` (`{ width, share }`; today 0.32 and 1/3).
  - Target: P4's tongue sample (287, 239) within dE 10 on a 5x5 patch at the rendered tongue's centre; the rendered tongue at least 100 native px (P4 176).
- **Face-glow card facing the pose's turn (Task 13).** `Octopus.tsx` sets `rig.coreGlow` strength by `coreGlowFacing((swim ? swim.yaw : 0) + extraYaw)`, not the pose's `body.yaw`. The card sits 0.9 in front of the face, so in a turned pose it reaches past the cheek. Aether's detail uses yaw 0.32 (P5's own turn) partly to keep it in.
  - Wanted: include `pose.body.yaw` in the facing.
- **Phone composition (Task 13).** Spec 7.11 puts her in the upper screen on a phone; `fovFor` centres the frame, and the detail's sheet (`ProjectDetail`, portrait phone) covers her face (y 380 to 432 of 844).
  - Wanted: a per-stage phone offset (a lens shift that lifts her into the upper screen), and a detail sheet that stops below her face.
- **The suction hold picks its arm before the orbit point is written (Task 13 fix round 1).** *Task 19: no longer affects Aether (her select is the arm lift, which lifts the arm the orb hangs from; the e2e test passes and its `test.fail` is gone). The hold's bug itself is still in the engine for worlds that hold (Nox): not fixed here.* `Octopus.tsx` `holdArm` calls `select.nearestArm(tips, bubbleState.orbit[bubble], faceBox)`. On a frozen tech focus the hold is chosen on the first frame, and the orbit point is most likely still unset (the origin), because `TechBubbles.tsx` writes `s.orbit[i]` in its own frame step. For the origin every path crosses her face box, so `nearestArm` falls back to the nearest tip: T4. The render (`?freeze&stage=techFocus&tech=openai`, 509 x 504) shows the held OpenAI orb beside her left eye, about 10 px off her face, instead of at T1 (OpenAI hangs from T1@0.9).
  - Wanted: pick the arm once the orbit point is written (or from the bubble's slot point when the orbit is unset), and re-pick if the hold's first pick was made from an unset point.
  - Measured on the real page (fix round 2, `tests/e2e/aether.spec.ts`, 1536 x 1024, frozen): the OpenAI orb button is 49 px from T4's drawn tip and 221 px or more from every other tip (T1's 459 px). The cause (the unset orbit point) is read from the code, not traced frame by frame.
  - Target: the e2e test "Aether tech focus, frozen: OpenAI is held near T1, the arm it hangs from [engine follow-up: ...]" is marked `test.fail` today; once the engine holds OpenAI on T1 it passes, Playwright reports it, and the `test.fail` line comes out. On the frozen still the orb then sits at T1's tip, clear of her face (the intended-pick model says 129 px at 509 x 504; model only).
- **Panel edge over her cheek on the page (Task 13 fix round 1).** At 1672 x 941 the detail panel's left edge comes over her right cheek. The model puts her face box's right edge (the blush's outer edge) at stage x -2.546, 0.29 left of the panel's left edge (the Task 13 review read 0.18 for the blush itself; either way it is left of it) (-2.255, `AETHER_STAGE_PANELS.detail`), so the overlap is probably the engine's panel mapping (stage panel to page CSS) at that aspect, not her pose. Not traced in the engine.
  - Wanted: check how `AETHER_STAGE_PANELS` maps to the page panel's left edge at a wide aspect.
- **Mean inside the silhouette (Task 6): resolved in config.** Fix round 1 set the arms' jelly `depth` to `#505ce2` at `depthStrength` 0.8 (was `#5c74e6` at 0.4). The mean reads (158, 142, 237) against (154, 133, 228) +-12, saturation 0.424 (0.418 to 0.498). No engine change is needed.

- **Back view (Task 14).** Three requests, all optional for the stills.
  - Rear beads seen through the jelly, dimmed (spec 7.5): the ring's rear beads are hidden behind the opaque head at yaw 0 and 45. Wanted: draw the ring and beads behind the head dimmed through the glass.
  - Orb logo from behind: a turned-away orb shows a dark disc without its logo. Wanted: a dim mirrored logo on the back face, or the logo as a billboard.
  - Rear arm root caps: where T1's and T8's caps meet at the body's axis they butt in a hard flat joint with a notch (`armTube.ts` root cap). Wanted: caps that overlap or blend, so a rear pair at z `[-0.3, -0.62]` (Nox's) needs no config change. Target: Aether intro yaw 180 shows no crease, the 23-sample P2 check unchanged (HEAD: 4 misses).

- **Character moments hook (Task 16).** The spark of an idea and "never more than one moment at a time" need the engine to call world logic Aether already has (`src/worlds/aether/moments.ts`, pure and tested). Three requests:
  - Moment arbiter. Wanted: an optional bundle field, e.g. `character.moments?: { arbiter: () => MomentArbiter }`, or simply the engine's own one-at-a-time rule, shared by the idle tilt (`idleTiltAt`), the flourish scheduler and the look-point pick (`pickLookPoint`). Each asks `claim(kind, t, seconds)` before it starts (tilt 4.6 s, reach 3 s, gaze shift 1.2 s) and waits when refused. Called in `Octopus.tsx` where `idleTiltAt`, `flourish.step` and `pickLookPoint` are called (about lines 598 to 642). Today they overlap (moments.test.ts finds overlaps in the raw schedules).
  - Spark trigger. Wanted: a per-frame call `sparkStep(state, { t, dt, pointerDistance, lifting, swelling, otherMoment, reducedMotion }, frame)` in the same place; `pointerDistance` is the pointer's distance to her head centre in stage world units (the engine already has the pointer in NDC for the gaze), `lifting` is "a pendant lift is running" (the lift's busy arms), `swelling` the head swell. Its output drives `rig.uniforms.uSparkleWave.value = frame.wave` (the shader band runs crown to face as the value rises, so the world gives 1 down to 0 for face to crown; Octopus never writes it today, it stays 0) and one lit satellite bead's glow by `frame.bead` for the bead `sparkBeadIndex(count, start)`.
  - Blink at the top of the tilt. Wanted: when an idle tilt is at its hold (`IDLE_TILT_SECONDS`, the 0.2 s plateau), sometimes (say one in three) start a blink now. Wanted: a `BlinkScheduler.blinkNow(t)` method (`behavior/ambient.ts` has only `sample(t)`). Not built: needs the tilt phase and the blink scheduler in the same place.
  - Reach toward a point. The flourish layer unrolls a random free arm straight; the spec's reach aims the tip at a nearby point of interest. Wanted: a `FlourishScheduler` choice weighted to the upper arms (T1, T2, T7, T8) and, optionally, a bias of the unroll toward the current look point.

- **Entrance (Task 17).** Aether's entrance sheet authors beats the engine does not draw yet. The sheet: `src/worlds/aether/sequences/defaults.ts`, `ENTRANCE_BEATS`; its test, `sequences/entrance.test.ts`. Four requests:
  - **A signed glide-turn.** `EntranceShape.turn` must be above 0, and `glideTurnYaw` runs the yaw from -turn up to 0, so a non-spiral swimmer always starts facing left.
    - Aether swims right, so her sheet's `yaw` key carries a half turn plus her facing and falls to 0 on the spin's ease.
    - Wanted: allow `turn` below 0 (the yaw runs from -turn, now positive, down to 0), or a `direction: 1 | -1`; `validateBundle` and `glideTurnYaw` to match.
    - Then her `yaw` key would hold only her facing drift (+90 to +50 degrees before the turn), with no half-turn offset.
  - **The face beats from the entrance sheet.** `entranceFrame` passes no head turn, head tilt, gaze or blink, and Octopus zeroes the gaze while `stage === 'entering'`. Wanted: read four optional sheet props into the frame, as `shimmer` is read:
    - `headYaw` (radians, about +y; her look-back to the portal: 0.7 from 3.3 to 3.55 s);
    - `headTilt` (radians, roll; the 12 degree tilt peaking at 4.95 s);
    - `look` (0 to 1; the eyes lock on the visitor, the camera, by 5.45 s);
    - `blink` (0 to 1; a blink closed at 5.75 s).
  - **How Octopus would draw them.** Add `headYaw` and `headTilt` to `headTurn.current.rotation` (y and z) while swimming. Blend the gaze toward the visitor by `look`. Draw `max(m.blinks.sample(...), frame.blink)`, and hold the random blinks off from the first keyed blink's start to the end of the settle, so the spec's order (look, blink, smile) is not broken by a random blink.
  - **A glow node a kit drive can fire (the brain glyph).**
    - `validateWorld` refuses an `'emissive'` drive on a node with a glow material, and the glyph's pulse is its glow on the world clock. So the glyph cannot fire at 3.2 s. Only the membrane's emissive flash (`portalFlash`, sheet prop `glyphFire`) is driven.
    - Wanted: a drive a glow honours within its bound. For example, a `'pulse'` drive that sets the glow's pulse phase or adds up to its `pulse` share, so its brightest stays colour x strength.
    - Better, for spec 7.7 and 7.9's "a light travelling across its folds": a `travel` value (0 to 1) the glow shader sweeps across the node's UVs or its x.
    - Then Aether adds `{ id: 'portalGlyph', node: 'portal_glyph', drive: ... }` back to her world props, and `glyphFire` drives both.
  - **A turned entering frame, blended during the turn.** `StageFrame` is `{ width, height }` about the stage centre, so the entering frame cannot turn right toward the portal (spec 7.9, P1). It is widened to 16 instead, and she draws at about half her intro size.
    - Wanted: an optional `center: [x, y]` and/or `yaw` on `StageFrame`, which StageCamera places and aims by. For Aether, about yaw -0.35 rad (turned right) at P1's 5.1 width.
    - Wanted: the stage camera's ease from the entering frame into the intro's, keyed from the entrance (the sheet's `spin`, or a `frame` sheet prop, 0 to 1 over 4.2 to 5.3 s) rather than started on ENTRANCE_DONE. Today it starts at 6.3 s, after the intro's words are in (5.85 s).

## Questions for the owner (Task 4, face)

- Catchlights: spec 2.3 says "large upper, small lower". Aether's panels P2, P3 and P4 at 3x paint both upper right, so the face follows the panels. Say if you want the spec reading (one-line change).
- `happy` (overview face) was tuned to P3 to `mouthCurve 0.75, mouthOpen 0.35, blush 0.4` (engine base is 0.8 / 0.6). Unrequested; veto if you prefer the base.
- The open "wonder" mouth reads as a V/U with a small tongue, not P4's D-shaped mouth. This is an engine limit (the open mouth keeps the closed smile's curved top, the tongue is a fixed shape). Fixing it needs an engine change; say if you care.

## Engine follow-up from the Flux merge (for the engine owner)

Flux added `WorldTier.id` and Aether added `WorldTier.quality`, both the same quality tier. The Aether branch keeps both (always equal, with a test holding them equal). Fold them into one name, `id` (platform's branch already carries it): a two-line change.

## Review notes

- Task 14 (back view) is docs and evidence only (no source changed) and skipped its separate task review. Its checklist verdicts are the implementer's own; look at the contact sheets in `docs/superpowers/evidence/aether/m4/`.
- The engine merge `9ab7af7` (Veyra back view and Task 16 with Aether's satellite flight) was committed by an agent killed in the laptop crash. Afterwards the full unit suite (1089 passed) and the typecheck were re-run clean; the Nox still gate and the e2e specs were not re-run on that exact commit.

## More engine follow-ups (from the merge reviews)

- Validation gaps (latent, no world hits them): a `rotateZ`/`emissive` prop that names a placed piece (not an attached node) never moves and validateWorld accepts it; a `bob` prop must name a placed piece and must not also appear in `sequences.kitDrives` (the bob wins over the kit drive). Add both checks with tests.

## Nox still gate residual: bisected, it is capture noise

After the Veyra Task 18/19 merge (`0bf10f8`) one full still-gate run read the Nox `techFocus` face-box mean at 0.0317 (feat/nox-3d reads 0.0164 at Task 19). Bisected afterwards: the same Aether HEAD alone gives 0.0218, 0.0158 and 0.0180 across captures, and the variants with the suspect files (`orbMaterial.ts`, the far fish in `Water.tsx`, then TechBubbles, strategies, Octopus and the other shared Nox engine files) restored from feat/nox-3d give 0.0211 to 0.0213. Two captures of the same code differ as much as any pair of variants. So the 0.0317 was one noisy capture; nothing in Aether's engine work moves Nox pixels. Every run passes the floor (face box 0.05 mean, 0.05% over 8). Details: `.superpowers/sdd/2026-11-03-aether-world/nox-residual-report.md`.

## Engine follow-ups from Task 19 (technologies live)

- **Logo marks and a fallback.** `LOGO_SLUGS` (`src/engine/artifacts/logoTexture.ts`) has no mark for OpenAI, Next.js, PostgreSQL, AWS or Vector DB (React has one), and a missing mark draws nothing: there is no lettered fallback. A world cannot name a slug, a colour or a fallback letter per technology.
  - Wanted: marks for those five (simple-icons has `siOpenai`, `siNextdotjs`, `siPostgresql`, `siAmazonwebservices`; none for "Vector DB"), a lettered fallback for a key with no mark, and an optional per-technology logo colour override (spec 2.3: Redis's red on her lavender glass; owner's call whether to recolour).
- **A cyan focus halo.** `createOrbHaloMaterial` takes the palette's `orbFocus` for both the rim and the halo. Spec 7.5 wants a lavender-white rim and a soft cyan halo. Wanted: an optional `palette.orbFocusHalo` (for Aether about `#9ad8ff`).
- **Dimming of the other orbs.** `TechBubbles.tsx` dims the unchosen orbs by a fixed 25%; spec 7.5 says about 20%. Wanted: an optional `select.dim` (0.2 for Aether), default 0.25.
- **Arm "catch" on landing (spec 7.5 flight table, assigned to Task 19 by the Task 12 review).** Not doable as Aether data: the arms' rests come from the stage pose; nothing lets a placement nudge an arm when an orb lands. Wanted: the satellite driver reports each orb's landing moment (it already knows `arrive[i]`), and Octopus dips that orb's slot arm by a small amount (about 0.04 down at the slot, 150 ms down, 300 ms back) with the personality's settle.
- **Twenty-technology e2e.** A project names at most `MAX_PRIMARY_TECHNOLOGIES` (15) and no page address loads a test bundle, so "20 technologies put 4 in the tray" is a model test (`src/worlds/aether/artifacts.test.ts`). Wanted, if the page test matters: a development-only `?testworld=aether-20` (like `nox-b`) with a validated 20-technology project.
- **Non-traced arms lift rigidly.** Only T1 has a traced lift (P4). The other arms turn rigidly about their root by up to 0.9 rad (`armLiftTarget`), with no tip curl over the orb. Wanted (owner's call after the live look): a generic curl for untraced lifts, or traced lifts for T8, T2, T7.

## Engine follow-ups from Task 20 (synapse effect)

- **Reduced motion never shows the synapse crossfade (review gap A).** The effect's crossfade is built and tested (`createSynapse(..., { reducedMotion: true })`), but under reduced motion `SwellRun` returns `restingSwell(open)`, so `sf.effect` is only 0 or 1 and the effect draws nothing (it is dissolved at 1). Wanted, the engine owner's call: either the swell sheet runs a short ramp of `effect` under reduced motion (a crossfade of about 0.4 s while the dome itself still cuts), or the spec's "the effect becomes a crossfade" is read as "the effect is simply absent" and the crossfade code is dropped. Until then it is test-verified only.
- **Scrubbing is told from playing by speed.** The 2x closing applies only while the effect's progress moves at a playing pace on the effect's clock (at most 2 a second, the clock advancing under 1 s a frame); a faster change, or a clock held at 0, shows the swell's own progress. A slow hand scrub backwards in the Theatre studio would still read as closing at 2x. Wanted if that matters: the swell run passes the effect a `playing` flag with the frame.

## Engine follow-ups from Task 21a (responsive, accessibility, reduced motion)

Found by `tests/e2e/aetherAccess.spec.ts` and `src/worlds/aether/reducedMotion.test.ts`. None is Aether data; each is exact.

- **Phone targets under 44 px (spec 7.11).** At 390 x 844 the engine's own controls measure, on Aether's page (and the same shared UI serves every world): the nameplate's Explore button 106 x 35 (`.nameplate-button`, the intro's only way on), the skip link 201 x 42 when focused ("Skip to project details"), and "Skip intro" 122 x 36 during the entrance. Her own controls pass (tray orbs 48 x 48, Close overview 44 x 44, View Project and GitHub 54 high, the project view's controls). Wanted: a minimum of 44 x 44 (`min-height: 44px`, and enough padding) for those three at phone widths. The e2e lists the three by name (`KNOWN_SHORT`) and fails on any other short control, so removing a name from that list is the check after the fix.
- **Sparkle twinkle is not held under reduced motion.** `Octopus.tsx` sets `uSkinTime = t` where `t = freeze ? 0 : state.clock.elapsedTime`, so with `prefers-reduced-motion` the jelly skin's star specks (her head and arms; Veyra's too) still twinkle. Measured on her left arm region at 1536 x 1024: 1.1k to 1.5k changed pixels of 62.5k between shots 0.6 s apart under reduced motion, against 13k to 16k with motion. Wanted: `const t = freeze || reducedMotion ? 0 : state.clock.elapsedTime` for the skin clock (the sparkle wave already rides the swim, which is held). Minor: it is not in spec 7.11's list (float, drift, swim, tilt, wander), but a twinkle is motion.
- **The synapse crossfade is unreachable live under reduced motion** (Task 20's gap A, restated with the measurement): after Explore with reduced motion the swell probe reads `{ open: true, moving: false, morph: 1, effect: 1 }` on every frame, never part-way, so the effect (dissolved at 1) draws nothing. Aether's tests state this and do not claim the crossfade is seen.
- **No probe for the ring.** The ring's bead angles and the twinkle's progress have no `window.__octoverse` probe, so the e2e measures the ring by pixels (a patch holding one bead: 13 to 22 changed pixels between shots under reduced motion, 8k with motion) and relies on the unit tests of `beadAngles` and `twinkleState` for the rest. Wanted, if the ring should be e2e-checkable: `reportObject(instance, 'ring', ...)` with `{ line, beads[], angles[] }`.
