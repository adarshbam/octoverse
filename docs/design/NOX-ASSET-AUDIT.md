# Nox source-artwork audit

Audit date: 2026-10-03

Status: The source-layer prerequisite has been withdrawn by the user. SVG reconstruction is authorized. Character geometry in `browser-pass-5.jpg` is approved and frozen. The environment-and-lighting implementation is ready for visual review, not yet approved.

## Approved target

The Nox JPEG remains the visual target. The user clarified that no original layers exist and authorized reconstruction with React, SVG/CSS, and Framer Motion. The JPEG and the notebook sketch are comparison material only; neither may be embedded in the scene to simulate fidelity.

The current milestone reconstructs the static panel-2 underwater environment and integrates its lighting with the approved character. Shared scene lights, clipped shading, contact shadows, and restrained skin variation preserve the geometry. No animation, interactions, other poses, technology orbs, or project panels are included.

## Verified source

- File: `docs/design/references/Nox.jpeg`
- Format: flattened JPEG storyboard containing five panels
- Dimensions: 1536 x 1024 pixels
- Size: 292,796 bytes
- SHA-256: `7527C415AAB05375C765F2D2B122E0CC9209E92AD84807EF29843B4B809A4EA1`

The workspace file inventory and asset scan of `docs`, `public`, and `src` found six reference JPEGs: the original notebook photograph and the Veyra, Flux, Nox, Aether, and Octoverse storyboards. No clean Nox scene plates, separate character or artifact layers, original project screenshots, font files, or layered artwork packages were found. No new source-art attachment accompanied the implementation request.

The previous title-only React placeholder has been replaced with the static SVG introduction. Existing unrelated repository changes and deletions have not been restored or repurposed. No new dependencies were added.

## Current reconstruction strategy

- Authored geometry uses a 507 x 505 viewBox aligned to panel 2.
- Each of eight tentacles has its own cubic curves, taper, depth assignment, underside, and cup placement. Closed filled contours provide physical width; cross-section shading follows the curves.
- The mantle, eyes, pupils, cheek treatment, mouth, cups, and local glows are web-rendered elements.
- Hidden tentacle roots are inferred and occluded. The JPEG's visible overlaps remain the visual target; ambiguous anatomy is not claimed as extracted fact.
- Project identity is separate data; the character does not contain project titles or technology information.
- No original-source-file acquisition is required to continue this reconstruction.

## Acceptance procedure

1. Capture the actual browser-rendered introduction at the panel's proportions.
2. Compare against the original panel crop, including enlarged face inspection.
3. Preserve the approved geometry while correcting environmental depth and lighting relationships.
4. Record remaining differences and present the static environment-and-lighting pass for user approval.
5. Stop before material polish, technology orbs, other poses, interactions, animation, and project UI.

The source requirement and approval procedure in the first version of this audit are obsolete. A build passing does not establish visual fidelity.

## Later inputs

Actual project and GitHub destinations, additional project sections, and additional carousel pages have not been supplied. They do not prevent static visual review. Under the approved plan, unsupplied destinations and content remain semantically unavailable rather than being invented.

Animation timing in the approved plan is proposed behavior, not information recovered from the still reference. Intermediate poses require separate review.

## Validation performed

- Inspected the current workspace file inventory and asset locations.
- Confirmed the Nox JPEG dimensions, byte size, and digest.
- Built and linted the static reconstruction successfully.
- Inspected browser screenshots and iterated on the root joins, arm volume, cup treatment, and face.
- Browser DOM inspection found exactly eight independent tentacle groups and no embedded images.
- See `reviews/nox-introduction/REVIEW.md` for approved geometry evidence, and `reviews/nox-environment/REVIEW.md` for the current milestone. Environment-and-lighting acceptance is pending.
