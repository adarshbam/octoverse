---
trigger: always_on
description: Core OctoVerse product and visual constraints.
---

# OctoVerse Rules

## Product

OctoVerse is a lightweight subscription-based platform
for creating interactive developer portfolios.

The portfolio experience is centered around one animated
2D SVG octopus.

Keep the product simple and focused.

## Visual Identity

OctoVerse should feel:

- cinematic
- underwater
- magical
- premium
- playful
- developer-focused

Use the approved OctoVerse reference images as the
visual source of truth.

Do not replace the established visual direction with
generic SaaS design.

## Rendering

Use:

- React
- TypeScript
- SVG
- CSS
- Framer Motion

Do not introduce 3D, WebGL, Three.js, React Three Fiber,
or physics engines unless explicitly requested.

## Octopus

The octopus must remain a 2D, animation-ready SVG.

Body, eyes, mouth and tentacles must be independently
animatable.

The same component must support different project
octopus themes.

## Interaction

Idle:
floating, breathing and occasional blinking.

Cursor:
subtle eye tracking and head movement.

Technology hover:
tentacle reacts, technology glows and the octopus reacts.

Project selection:
the selected project becomes the focus and its
technologies populate the tentacles.

## Architecture

Keep portfolio content data-driven.

Do not hardcode project information into visual components.

Prefer existing project architecture over new abstractions.

Do not add dependencies without justification.

## Scope

OctoVerse v1 is intentionally small.

Do not introduce social features, analytics, custom domains,
3D systems, complex customization systems or other
non-essential features unless explicitly requested.

## Quality

Visual fidelity is more important than adding features.

Before considering a UI task complete:

1. Build the application.
2. Inspect it in the browser.
3. Compare it against the approved reference.
4. Fix the largest visual differences.
5. Verify desktop and mobile behavior.
