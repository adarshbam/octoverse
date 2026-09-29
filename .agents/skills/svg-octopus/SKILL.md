---
name: svg-octopus
description: Creates, modifies, and animates the OctoVerse 2D SVG octopus, including its body, eyes, mouth, tentacles, technology orbs, glow effects, and project-specific visual variants.
---

# SVG Octopus Skill

## Purpose

This skill is responsible for creating and modifying the OctoVerse
2D SVG octopus character and its interactive behavior.

The octopus is a core visual component of the product, not a generic
decorative illustration.

## Rendering

Use:

- SVG
- React
- TypeScript
- CSS
- Framer Motion

Do not introduce:

- Three.js
- React Three Fiber
- WebGL
- 3D models
- physics engines

unless explicitly requested.

## SVG Structure

Keep the octopus organized into independently controllable layers:

- aura
- body
- eyes
- pupils
- mouth
- tentacles
- technology orbs
- glow effects

Each major visual element should have a stable identifier so it can
be animated or targeted independently.

## Tentacles

Each tentacle should be independently animatable.

A tentacle may have:

- unique id
- technology association
- idle state
- hover state
- selected state
- transform origin
- glow state

Technology data should determine which tentacles are displayed.

Do not hardcode project-specific technology names inside the SVG component.

## Character Animation

Idle behavior should feel alive but subtle:

- gentle floating
- slight body movement
- breathing
- occasional blinking
- subtle tentacle movement

Cursor interaction may include:

- subtle eye tracking
- small head movement

Avoid excessive movement.

## Technology Interaction

When a visitor hovers or selects a technology:

1. The related tentacle reacts.
2. The technology indicator becomes visually prominent.
3. The octopus reacts subtly.
4. Supporting information can appear near the interaction.

The interaction should feel connected to the character rather than
behaving like a normal dashboard hover effect.

## Project Variants

Different projects may use different:

- colors
- names
- personalities
- environmental effects
- technology sets

Keep the underlying octopus component reusable.

Prefer configuration/data over duplicated SVG components.

## Accessibility

Support:

- keyboard interaction where appropriate
- visible focus states
- reduced-motion preferences
- meaningful labels for interactive technology elements

Animations must never be required to understand the portfolio content.

## Performance

Prefer transform and opacity animations.

Avoid unnecessary continuous JavaScript calculations.

Keep SVG structure reasonably simple and reusable.

## Design Principle

Visual fidelity is more important than adding unnecessary features.

Preserve the established OctoVerse visual language:

- cinematic
- underwater
- magical
- premium
- playful
- developer-focused
