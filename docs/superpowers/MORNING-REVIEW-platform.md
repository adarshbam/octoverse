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
- 13 of 17 P2 samples within delta E 10 (max of those 9.3, forehead). Misses: head side left 13.4, head side right 19.6, arm upper 41.4, arm underside 20.7, upper water 11.0.
- Every global check passes: face B - G 13.7 (<= 15), face R - B 60.1 (>= 60), crown B - R 153.6, upper head R - G 36.9, core over head R 120.1, cup R - B 88.1, mid water B 93.1, B - R 72.4.
- Silhouette IoU 0.855 (>= 0.85; Task 2 was 0.714). Mean inside the P2 mask (161, 116, 194), saturation 0.481 (target (164, 116, 204) +- 12, 0.518 +- 0.04: passes, saturation near its floor).
- Arm span 4.61 on the render (4.58 from the traces), head top 0.33, eyes (+-0.40, -0.54), mouth opening centre -0.85.
- Sparkle specks counted on the still: head 113, arms 687 (>= 30, >= 50).
- Frame rate: 53.2 fps median, slow10 28.4, tier low, production build, under load (four sessions on one Intel UHD; floor 40).

What to check, live at `?world=octoverse&stage=intro` (and `&freeze`):
1. Reads as its own character, not Aether: peach face (not pink-white), amber cups, blue crown over a violet dome.
2. Peach face and amber cups: the face glow from the eyes to below the chin; the cup frill along each underside.
3. The wide welcoming arms: eight, spread 4.6 wide, the side arms curled, thicker than Task 2's.
4. The open smile: a wide D, plum inside, coral tongue, at rest and in the intro.
5. The glassy jelly: lavender rim, crown light, fine specks; the back view round and glassy.

Known gaps for the owner to rule on:
- P2 lights the head's right side (134, 131, 253) and shades its left (95, 80, 237), delta E 28.7 apart; the engine's mantle has no directional light, so a symmetric head can get no nearer than about 14.5 to both (BLOCKED on E02b / owner).
- The arm upper sample sits on T1's inner edge beside the head, where P2 is dark blue and the engine draws the arm's rim light (no per-edge control).
- The head keeps Task 2's squarish dome (within spec 2.2's numbers); P2's is rounder. The arms are a deeper cobalt than P2's lavender.

