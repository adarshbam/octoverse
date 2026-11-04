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

