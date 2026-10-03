# Nox environment and integrated lighting review

Date: 2026-10-03. Status: implementation ready for user visual review. Environment and lighting are not yet approved.

## Approved baseline

The user approved the character geometry in `../nox-introduction/browser-pass-5.jpg`. Mantle silhouette, facial proportions, complete eye design, eight tentacle shapes and order, suction-cup geometry, pose, scale, placement, and the 507 × 505 composition remain frozen. Title and nameplate positions remain unchanged.

`introductionGeometry.ts` retains SHA-256 `5018DCDCE006063FB8053A739A940FEAA33FFCDA80F62ABF5D073C5A5573438E`. `approved-character-source.txt` and `approved-geometry.json` record the pre-change source and browser geometry. This approval does not establish pixel identity with the reference.

## Implementation

- Layered SVG environment: dark central water, overhead blue opening, soft shafts, distant hazy pillars, recessed side masonry, broken ledges, crimson engravings, hanging chains, receding seabed, foreground rocks, sparse static bubbles and motes, lower crimson growth, and vignette.
- `sceneLighting.ts` shares overhead, wall, lower stonework, and root light coordinates and colors between environment and character.
- Character lighting uses existing contours, clips, gradients, local rim reflection, red bounce, and receiving-surface overlap shadows. Eye/face source and eye gradients remain byte-identical. Cup lighting changes only opacity, not geometry.
- Deterministic SVG turbulence adds restrained skin and stone variation. It affects color/alpha only. No displacement, contour changes, whole-character blur, new dependencies, embedded reference imagery, or animation were introduced.

## Capture evidence

- `environment-depth.jpg`: browser inspection of initial corridor masses before character lighting or atmospheric detail. Comparison identified overly bright regular masonry.
- `lighting-pass-1.jpg`: first integrated-lighting browser pass. Comparison identified insufficient lower crimson illumination and over-strong edge darkening.
- `browser-final.jpg`: exact static browser capture at 507 × 505 after correcting those issues. Unretouched browser JPEG.
- `comparison.png`: panel 2 on the left, final browser capture on the right, each displayed at 507 × 505. Reference is the unretouched x=512, y=0, width=507, height=505 crop from `Nox.jpeg`. Storyboard heading/number remain visible on the reference for provenance; they are excluded from the scene and visual acceptance. No other reference features are masked out.
- `character-lighting-comparison.png`: identical x=35, y=220, width=430, height=240 crops from approved browser pass 5 and final browser capture, enlarged equally. Demonstrates lighting changes within unchanged anatomy.
- `geometry-overlay.svg`: approved cyan contours and current dashed coral contours in the same coordinates, separate from environmental comparison. Mantle and eight arm contours coincide. This diagnostic does not assess shading or claim reference fidelity.
- `geometry-overlay-browser.jpg`: browser-rendered verification of that overlay; outlines coincide, including the intentionally exposed hidden roots in this diagnostic.
- `browser-narrow.jpg`: fixed-proportion layout at 390 × 844, not a redesigned mobile composition.

## Verification

- Build and lint pass.
- `node docs/design/reviews/nox-environment/verify-baseline.cjs` passes: geometry file hash unchanged; Eye function, face artwork, sclera/iris gradients unchanged; browser contour data, arm order, cup geometry/transforms, face geometry, stage, placement, title and nameplate match the saved baseline.
- Browser DOM: exactly eight arms; zero embedded images; zero SVG animation elements.
- Narrow viewport: stage 390 × 388.456, centered; no horizontal overflow or composition cropping.
- No warnings/errors on clean reload. During the two-file hot update, React briefly saw the new required lighting prop before the parent update arrived; the completed code and clean reload have no such error.
- The development server was restarted after stopping between work sessions. Earlier connection/WebSocket errors remain in historical browser logs; the final fresh reload has zero warnings/errors, recorded separately in `browser-validation.json`.
- Particle positions and texture seeds are fixed. The scene remains static. No interaction or motion tests apply to this milestone.

## Remaining visual differences

1. Architecture and foreground rocks remain more geometric and less densely eroded than the painted reference. Distant ruins and surface-water fragmentation are simplified.
2. Crimson illumination and growth are less rich and diffuse than the reference, especially along the lower side walls and seabed. The overhead source is smoother; some light shafts remain more legible as discrete shapes.
3. Skin and suction-cup materials remain more regular than the reference despite local texture and reflection variation. Broader material polish is deferred to the next approved milestone. Existing geometry differences from the JPEG are deliberately preserved under the user's geometry freeze.
4. Existing typography and flame mark are still approximations. Their approved positions were preserved; they were not redesigned here.

These are visible limitations, not accepted substitutions. Passing checks does not establish a visual match. Stop here for the user's environment-and-lighting approval.

Subsequent sequence: material polish → technology orbs → other Nox poses → interactions → animation → project UI.
