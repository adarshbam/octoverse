# Platform overnight build: morning review

Branch: `claude/platform-overnight`. Everything below is PENDING OWNER REVIEW. Frame rates are "under load" (four sessions shared one Intel UHD GPU). Nothing pushed.

Each entry: item, still paths, numbers, what to check.

(Entries added as milestones land.)

## PENDING OWNER REVIEW: M1 gate, the host's look on the P2 stage (Task 3)

Commits on `claude/platform-overnight`: `feat(octoverse): host jelly, peach-amber cups and face presets`, `chore(platform): kitless capture and host delta E check`, `feat(octoverse): host look (P2 gate, pending owner review)`.

Stills (`docs/superpowers/evidence/platform/m1/`):
- `task3-host-intro.png` (frozen intro at P2's frame, 512 x 508 at scale 2) and `task3-host-intro-mask.png`;
- `task3-side-by-side.png` (render left, P2 right, both at P2's size);
- `task3-closeup-face.png`, `task3-closeup-cups-right.png`, `task3-closeup-arms-left.png` (3x zoom, render left, the 3x panel right);
- `task3-host-back.png` (`?yaw=180`);
- `task3-iou-overlay.png` (white both, red P2 only, cyan render only).
The engine's own title and nameplate show on the stills (the dev page's `ui: 'engine'`); the platform draws its own later.

Numbers (CIE76 delta E against spec 2.1, `python scripts/host_delta_e.py <still>`):
- 12 of 17 P2 samples within delta E 10 (max of those 9.3, forehead). Misses: head side left 13.3, head side right 19.7, arm upper 18.8, arm underside 14.5, upper water 11.0. (Corrected after review: the first entry said 13 of 17, and the check read each sample a half pixel off spec 2.1's window; fixed, P2 itself now reads delta E 0.0 on every sample.)
- Every global check passes: face B - G 10.1 (<= 15), face R - B 62.1 (>= 60), crown B - R 153.6, upper head R - G 34.1, core over head R 122.0, cup R - B 108.2, mid water B 92.7, B - R 72.9.
- Silhouette IoU 0.856 (>= 0.85; Task 2 was 0.714). Mean inside the P2 mask (165, 118, 199), saturation 0.484 (target (164, 116, 204) +- 12, 0.518 +- 0.04: passes, saturation near its floor).
- Arm span 4.61 on the render, head top 0.35, head half-width 0.80, eyes (+-0.40, -0.54), mouth opening centre -0.85.
- Sparkle specks counted on the still: head 109, arms 702 (>= 30, >= 50).
- Frame rate (round 1, before the colour and shape round 2): 53.2 fps median, slow10 28.4, tier low, production build, under load (four sessions on one Intel UHD; floor 40). Round 2 changed colours and the lathe profile only, not geometry counts; not re-measured.

What to check, live at `?world=octoverse&stage=intro` (and `&freeze`):
1. Reads as its own character, not Aether: peach face (not pink-white), amber cups, blue crown over a violet dome.
2. Peach face and amber cups: the face glow from the eyes to below the chin; the cup frill along each underside.
3. The wide welcoming arms: eight, spread 4.6 wide, the side arms curled, thicker than Task 2's.
4. The open smile: a wide D, plum inside, coral tongue, at rest and in the intro.
5. The glassy jelly: lavender rim, crown light, fine specks; the back view round and glassy.

Known gaps for the owner to rule on:
- P2 lights the head's right side (134, 131, 253) and shades its left (95, 80, 237), delta E 28.7 apart; the engine's mantle has no directional light, so a symmetric head can get no nearer than about 14.5 to both (BLOCKED on E02b / owner).
- The arm upper sample (58, 55, 213) is P2's deep blue gap beside the head. Round 2 moved T1 onto it (it had read the arm's rim light) and made the lit arms violet-lavender as P2's are, so the sample now reads the shaded arm root (90, 69, 196), delta E 18.8; nearer needs bluer arms all over.
- Round 2 made the head rounder (top 0.35, topPower 1.7, bottomPower 2.45) and the cups amber-orange; the arms are still a little bluer and darker than P2's, whose tops run pink-lavender.

## PENDING OWNER REVIEW: M2, the reef world around the host (Task 5)

Commit on `claude/platform-overnight`: `feat(octoverse): reef world (pending owner review)`.

Stills (`docs/superpowers/evidence/platform/m2/`, frozen, 512 x 508 at scale 2, kit and far plate loaded):
- `task5-reef-intro.png` and `-mask.png`: the frozen intro at P2's frame;
- `task5-reef-entrance.png` and `-mask.png`: `?stage=entering&t=3&freeze`. The entrance is a placeholder until Task 12, so this frame is the intro pose, not P1's.

Numbers:
- P2 (`python scripts/host_delta_e.py`): 12 of 17 samples within delta E 10, the same 12 as Task 3. No passing sample regressed. Changes: upper head 8.6 to 8.9, face glow 7.5 to 5.8, water outside head 8.7 to 8.6, mid water 8.6 to 3.3. The five misses are Task 3's, unchanged (head sides 13.3 and 19.7, arm upper 18.8, arm underside 14.5, upper water 11.0). Every global check passes; IoU 0.856.
- The gate as a greeting (`python scripts/reef_check.py intro <still> --reference m1/task3-host-intro.png`): the brightest pixel in the gate's box is 0.230 relative luminance, against 0.712 on the host's face glow (ratio 0.32). That pixel is the surface water seen through the ruin, not the gate. The gate's own surfaces are dimmer: membrane and glyph 0.135, windows 0.10. Without the reference, the brightest is a bubble highlight at 0.684 (still below the face).
- P1 samples on the entrance still (placeholder frame): membrane 79.4, floor path 32.3, mid water 34.6. These read the intro pose, so they say nothing yet. The membrane variant's body is 0.32 x its colour, so P1's bright violet membrane is out of reach (BLOCKED on E02b: membrane body brightness).
- Frame rate, production build, intro, tier auto (production ignores the `tier` parameter), under load: 40.2, 29.0 and 37.5 fps median on the final build (earlier runs 32.6 to 80.6). The reef costs about 4.5 ms of GPU per frame over Task 3's kitless host. The 40 fps floor is marginal under load.
- Gate plinth on the dunes: the sand under the gate's footprint runs -2.528 to -2.252 against the plinth at -2.45. At the front edge the gap is at most 0.012, so the plinth sits in the sand and does not float.

What to check, live at `?world=octoverse&stage=intro`:
1. Reef light: violet stone, magenta and orange corals that differ, glass cards, path glow on sand.
2. Water colour: indigo near the host, cyan-blue toward the top right. The brief's fog `#021648` and surface glow `#1081db` were tried and measured worse on P2 (mid water 12.9, upper water 17.4). Task 3's `#141e5f` and `#20a8ff` are kept.
3. The gate as a greeting, not glare: it stands right of the head and is clearly visible in the intro. The static layout cannot hide it per stage; Task 6's frames own that.

Known gaps for the owner to rule on:
- Jellyfish and bobbing props are left out (ruling R14); jellyfish waits on Aether Task 7. Props wait on Task 12.
- Magenta corals take a glow material, so they lose the engine's coral sway and rest drop; their heights are set by hand. A per-node coral colour (E02b) would fix this.
- Cards are a glow approximation of glass.
- Under load the production kit sometimes took longer than the engine's 15 s wait, and the world fell back to level 1.

## PENDING OWNER REVIEW: M2, the entering and How It Works poses (Task 6)

Commit on `claude/platform-overnight`: `feat(octoverse): entering and How It Works poses (pending owner review)`.

Stills (`docs/superpowers/evidence/platform/m2/`, frozen, kit and far plate loaded):
- `task6-overview-vs-p3.png`: `?world=octoverse&stage=overview&freeze` (1022 x 1016, P3's 511 x 508 frame) beside P3. `task6-overview-cards.png`: the same still with the five card boxes drawn in.
- `task6-entering-t3-vs-p1.png`: `?stage=entering&t=3&freeze` (P1's 510 x 508 frame) beside P1. The entrance sheet is still the held-landed placeholder (Task 12), so this frame shows the intro pose on the stage spot, not P1's swim.
- `task6-swim-sheet.png`: the host's new swim shapes (`?pose=swim-open`, `?pose=swim-trail`, and the trail at `&yaw=90`, the profile P1 shows).
- `task6-intro.png`: the intro re-captured after the crown change below (P2 regression check).

Numbers:
- Overview head on the still (`python scripts/host_panel_check.py p3 <still>`): top -0.20, half-width 0.80, centre x 0.00 (spec -0.24, 0.81, +0.03, each ± 0.05). The head is turned 10.9 degrees: its top leans to the viewer's right, so the eye line falls to the right as P3's does (about 11 degrees).
- P3 samples: upper head 9.4, face glow 5.7 (both within delta E 10).
- P2 after the crown change: still 12 of 17 within 10, the same five misses; crown 3.2 to 5.3, upper head 8.9 to 8.3; crown B - R 140.2 (floor 140); IoU 0.856.
- Gate in the intro: unchanged (0.230 against the face's 0.712). It cannot leave the intro frame: see the gaps below.

What to check, live at `?world=octoverse&stage=overview`:
1. Head turned and low: the host sits low and a little smaller, its head leaning right as P3's.
2. T1 and T8 rising beside the cards: T1 under Veyra's column, T8 under Nox's, curling near y -0.5.
3. Clear space for five cards: the lower six arms spread under the face, and no arm tip sits on a card box (the overlay still).
4. Face clear: no card box covers the face.

Known gaps for the owner to rule on:
- "Turned 8 to 15 degrees right" is built as a lean of the head about its neck (the eye line's fall in P3). P3 shows no turn about the vertical; if anything its face sits left of the dome's middle. Say if a turn about the vertical was meant.
- The host's face (P2's layout) sits lower and wider on its dome than P3 paints it. To land P3's face-glow sample on the chin and not the lip, the body sits 0.03 left and 0.04 higher than centred. That leaves the measured top at -0.20, 0.01 inside the tolerance.
- The crown cap starts higher (crownHeight 0.45 to 0.58): P3's upper dome is violet nearer the top than P2's. P2's crown B - R margin is now 0.2.
- P3's arms are longer and flow further out than these. The host's head is larger relative to its arms than P3 paints it.
- The gate stands fully visible behind the Nox and gold cards in How It Works (P3 shows no gate). In the intro it stays soft beside the host: the engine's stage frame is a size only, centred on the stage, so it cannot move the view off the gate (E02b or owner: a frame offset, or a per-stage layout).
- P1's head position at 3 s (spec 2.2: -0.36, -0.36, profile right) belongs to the entrance sheet (Task 12). Today the head sits at the intro spot (about 0, -0.2).
