# Nox character review log

The base Nox is upgraded one component at a time (design doc section 8.0). Each component is shown to the owner on `review.html?component=<id>`, beside the reference, and nothing moves on until the owner approves it. Verdicts are quoted as the owner gave them; captures are under `assets/`.

| Component | Date | Owner verdict | Capture |
|---|---|---|---|
| Body–arm junction | 2026-10-23 | Approved v2. The owner chose "Approve junction" on the v2 review. v1 change requests are listed below. | `assets/junction-v2.png`, `assets/junction-v2-strip.png`, `assets/junction-v2-full.png` |
| Eyebrows | 2026-10-23 | Approved v1. The owner chose "Approve eyebrows". Known gap raised at review: the painting's left brow sits slightly lower (head tilt); ours are symmetric. | `assets/brows-v1.png`, `assets/brows-v1-strip.png`, `assets/brows-v1-expressions.png` |
| Eyes | 2026-10-23 | Approved v1. The owner chose "Approve eyes" after the redraw that answered their v1 junction note on staring eyes (dark iris with a pooled glow, soft pupil, small catchlights, light lower rim, traced size, wider face glow). Known gap raised at review: the painting's two eyes differ slightly; ours are symmetric. Lashes revised 2026-10-24 after "Noo eyes lashes or too small lashes"; the owner chose "Lashes look right" (`assets/eyes-v2-lashes.png`). | `assets/eyes-v1.png`, `assets/eyes-v1-face.png`, `assets/eyes-v1-strip.png`, `assets/eyes-v1-expressions.png` |
| Mouth and blush | 2026-10-23 | Approved v1. The owner chose "Approve mouth and blush" (traced smile with round corners, coral blush with a warm halo, and the open happy smile from panel 3). Known gap raised at review: the blush is slightly duller than the painting at high zoom. | `assets/mouth-v1.png`, `assets/mouth-v1-face.png`, `assets/mouth-v1-strip.png`, `assets/mouth-v1-happy-vs-panel3.png` |
| Mantle | 2026-10-24 | Approved v1. The owner chose "Approve head and cheeks" after their note "cheeks are not round enough": round cheek lobes with the rim around them, apex lowered to the reference, navy dome, lilac rim, sheen on the upper-left crown. Known gaps raised at review: the dome's glossy streaks and texture (Task 13) and the outer halo (Task 14). | `assets/mantle-v1.png`, `assets/mantle-v1-strip.png`, `assets/mantle-v1-cheek.png`, `assets/mantle-v1-full.png` |
| Arms (T1–T8) | pending | | |
| Suckers | pending | | |
| Skin detail | pending | | |
| Glow and halo | pending | | |
| Motion | pending | | |
| **Character sign-off** | pending | | |

## Change requests

### Body–arm junction v1 (2026-10-23)

Capture: `assets/junction-v1-before-after.png`, `assets/junction-v1.png`. Verdict: changes requested. The owner's notes, and where each one is handled:

- **Cheeks** (junction v2): "our 3D design just has one big sphere, but if you will notice, in the actual character design, it has a kind of more than a semicircle, and inside that there are cheeks. Which stick out." "Those cheeks connect the body and the neck properly. So and inside those cheeks there is a beautiful kind of blush."
- **Suckers on every arm** (junction v2 for T4/T5, then Task 12): "some of them are missing in our middle tentacles, if you'll notice. So make sure it is present on every single tentacle everywhere."
- **Arm volume and glow** (Tasks 11 and 14): "those tentacles look really phenomenal. They have proper glow and 3D-ness to them, but our looks really flat."
- **Skin texture** (Task 13): "the main difference is the texture. If you'll notice, our reference has a beautiful texture, and it has variations in the colors some part is more bluish, some part is really reddish, it has variations, and it has a slight texture around it." "So make sure to add that texture, because our 3D model looks flat compared to the reference."
- **Eyes** (Task 9): "our eyes look slightly different and really pointy, but it doesn't feel like it has a cutesy glow. It looks like it's staring right into the eye, but in our reference, it looks like it has really innocent and cute eyes."

Gaps raised with the v1 review and folded into v2: the dark notch where T4 and T5 meet, the crease that the T3/T6 roots draw across the chin, and the glow running further down the centre arms.

### Owner notes after approval (2026-10-24)

Raised during the mantle work: "Noo eyes lashes or too small lashes. And cheeks are not round enough." The lashes are handled as an eyes revision and the cheek shape with the mantle (Task 10).

### Eyes, high-quality reference (2026-10-24)

The owner supplied `docs/design/references/Nox-face-hq.png`, a high-quality version of the face, after the eyelid pass. Their notes: the eyelid in this reference "is really intentionally created" and "creates a kind of border around the whole eye". The border "is thicker, and more on the right side, left side the border gets like really thin, but that distinction adds layer to the eyes". "Inside the pupil there are multiple layers." The whole eye "is much more detailed. It has reflections and the whole eye is inside of a certain kind of black border", for "both areas, white areas as well as those red areas".

**v2 (approved):** the mantle is re-fitted to the rim line as a dome that runs past its widest point, with cheek lobes pushed out below it that carry the blush into the arms. T3/T6 now emerge from behind the neck, so the chin crease is gone. T4/T5 carry their suckers along the V, and sucker rows start small next to the body. The glow down the centre arms measured within range of the reference, so it was left for the glow task. Known gaps raised at the v2 review: each cheek lobe ends in a small point where an arm edge meets it (in the reference that arm is T1, not T2), and from the side the cheeks read as a soft ridge.
