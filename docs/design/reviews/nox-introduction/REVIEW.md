# Static Nox introduction: character review

The user approved the character geometry in `browser-pass-5.jpg` on 2026-10-03: silhouette, facial proportions, complete eye design, eight tentacle contours and ordering, cup geometry, pose, scale, and placement are frozen. This is geometry approval, not a claim of pixel identity with the JPEG. The following sections preserve the evidence from the character-focused milestone. Environment and lighting review now lives in `../nox-environment/REVIEW.md`.

## Reference and capture provenance

- Authority: `../../references/Nox.jpeg`, SHA-256 `7527C415AAB05375C765F2D2B122E0CC9209E92AD84807EF29843B4B809A4EA1`.
- `reference-panel-2.png` is an unretouched rectangular crop at source x=512, y=0, width=507, height=505. It is comparison material, never an application asset.
- `browser-pass-1.jpg` through `browser-pass-5.jpg` are actual browser screenshots from the local Vite app. Later screenshots isolate the SVG's rendered rectangle. Browser subpixel layout rounds the approximately 507 x 505 stage to screenshot pixels.
- `comparison.png` places the original panel beside the latest browser capture at the same displayed dimensions. Source storyboard annotations and detailed environment intentionally remain on the reference side only.
- `face-comparison.png` magnifies the same x=190, y=278, width=134, height=75 region on both sides, with reference left and browser right. This is diagnostic enlargement, not reconstructed artwork.

## Changes driven by screenshot comparison

1. Preserved the head crown near source y=228, low face placement, and broad arm spread.
2. Reduced uniform arm outlines; added curve-following cross-section shading and fuller intermediate bends.
3. Thickened and lowered the front arms, broadened their curls, and blended their roots with clipped local illumination.
4. Replaced small bright bead cups with larger coral lobes and recessed centers. Omitted cups close to the front-arm roots.
5. Revised eye width and sclera, increased ruby iris visibility, paired the upper catchlights, corrected right-side lash direction, and shifted cheeks away from yellow toward coral pink.

## Validation

- `npm run build`: passed after the final character edits.
- `npm run lint`: passed after the final character edits.
- Browser console: no errors or warnings returned at final capture.
- Browser DOM: eight unique tentacle groups, T1 through T8; no SVG or HTML images embedded; no SVG animation elements.
- Narrow viewport check at 390 x 844: the complete fixed-proportion scene fits inside a 390 x 388.46 stage, centered vertically. `browser-narrow.jpg` records this fit check, not a separately designed mobile composition. The viewport override was reset afterward.
- The implementation contains no animation or input handlers. All screenshots show the same static pose.

## Remaining differences for approval

- The reconstruction is smoother and more regular than the painted JPEG. Curl contours and local arm overlaps are approximations; the subtle irregularity of the original is not fully reproduced.
- Cup lobes and skin shading remain more uniformly constructed than the reference's textured, irregular highlights.
- Eight arms are explicit, but some hidden roots and small lower curls are ambiguous in the flattened source and have been interpreted anatomically.
- Typography and the flame symbol are approximations. The dark background is intentionally minimal under the character-first scope.

Review the actual images rather than treating these checks as proof of a match. The user subsequently approved the geometry and authorized the environment-and-lighting milestone; remaining material differences continue to be tracked.
