# OctoVerse 3D Engine Contract

Date: 2026-11-03
Branch: `claude/engine-contract-9ac935`, cut from `feat/nox-3d` at `6009863`. `feat/nox-3d` has since moved on (Nox's last lanes are merging); this contract is checked against the final tip before extraction starts (section 14).
Master plan packet: E01 in `docs/execution/MASTER-PLAN.md` (main checkout). The extraction plan (E02) is a separate document: `docs/superpowers/plans/2026-11-03-engine-extraction.md`.
Method comes from: `2026-10-23-nox-3d-design.md` and `2026-10-26-nox-world-and-motion-design.md`. The master plan's section 2 architecture table and minimum-interface list say which boundaries are wanted; its SVG-era technique does not apply.
Inputs: the Nox code in `src/nox3d/` (about 14k lines), the references `Veyra.jpeg`, `Flux.jpeg`, `Aether.jpeg`, `Octoverse.jpeg` and `girlfriend-reference.jpg` (the DNA), and Veyra's engine needs (`veyra-engine-needs.md`, relayed 2026-11-03).

## 1. Intent

OctoVerse is four octopus worlds (Nox, Veyra, Flux, Aether), a platform that shows them, a creator, and a backend. Nox is built, procedural, and nearly finished. The engine contract answers one question: **how do we put a second, different octopus in a second, different place without recolouring Nox and without copying him?**

The test is Veyra (`Veyra.jpeg`). She is not Nox in teal. She has a rounder jelly-glass body with small cheek lobes, tight spiral tips, cream-gold scalloped cups, a green iris, a vault door with a padlock instead of rune pillars and lava, glowing plants instead of coral, and orbs hung on tethers from her arms instead of bubbles orbiting her head. A contract that survives Veyra honestly will survive Flux and Aether, which are closer to Nox in kind.

The contract is a **boundary map plus a migration**. It names what is engine, what is a world, who owns each piece of authored data, and how every existing Nox effect and pose reaches the new layout unchanged. It does not add features. Nox's rendered output is the frozen reference throughout.

## 2. Goals, non-goals, anti-goals

### Goals

1. **A second world is data plus a small number of named variation modules, not a fork.** A world is one `WorldBundle` (section 5) and its assets.
2. **Nox is preserved exactly.** Every existing effect, authored pose, timing and look has a stated destination (section 11). Frozen stills match before and after; the existing Nox test suite passes unchanged in behaviour.
3. **Instances are isolated.** Two instances on one page, or a world switch, share no mutable state: selection, timers, sequences, anchors, bubbles, listeners, DOM ids (section 8).
4. **Responsibilities are distinct:** geometry, content, placement, rendering and control each have one owner (section 7).
5. **Each world keeps its own authored geometry.** The same shared system (pose blender, stroke, suction hold) runs on different authored arm curves, poses and layouts per character.
6. **Exactly eight arms, T1 to T8, always.** Technology count never sets anatomy.

### Non-goals

- Moving worlds Flux, Aether or the platform to completion. This contract only says how they plug in.
- A plugin system, runtime registration, or third-party extension API.
- Any physics layer. **Arm physics is cancelled** (owner and orchestrator, 2026-11-03). Section 9.3 of the 2026-10-26 spec is withdrawn for the engine's purposes: no node chains, springs or drag are part of the shared systems, and no personality field depends on them. Arms follow-through comes from the existing ambient, stroke and pose-blend layers.
- Rewriting any approved Nox component, pose or timing.
- Changing the rendering pipeline (no tone mapping, SMAA, bloom, contact shadows) except to move its settings into a world's data.
- Backend, accounts, uploads, billing, creator tooling.

### Anti-goals

The extraction fails even if it technically works when:

- Nox's output changes in any way the equivalence checks (section 13) can see.
- **Every character comes out Nox-shaped:** a "generic octopus" with a palette slot. Geometry, poses, orbit or tether layouts, head effects and personality stay authored per character.
- A world needs engine code forked or edited to look right.
- A shared system quietly assumes a hue (red, magenta) or a feature (cheek lobes, lava, a rune glyph).
- A speculative extension point is built that no world uses yet.
- The extraction becomes a big-bang rewrite that cannot be bisected.

## 3. Constraints

- **Stack unchanged:** React 19, three 0.186.1, R3F 9, drei 10, postprocessing 3, Vite 8, Theatre.js 0.7.2 (`@theatre/core` in production, `@theatre/studio` development only), Vitest.
- **Owner's laptop (Intel UHD) is the performance floor.** The extraction adds no per-frame allocation and no extra draw passes. Veyra's own budget (intro at tier low, at least 40 fps at 1536 x 1024, pixel ratio 1) must stay reachable; the engine must not be what costs it.
- **No tone mapping**, `flat` canvas, colour pipeline unchanged.
- **No videos.** Equivalence evidence is stills, numbers and the test suite.
- **Docs-only now.** Extraction starts after Nox's final verification lands on `feat/nox-3d`, and runs on a branch cut from that tip. The Nox session is measuring frame rate: no dev server or Playwright while this spec and plan are written.
- **Main checkout is never edited.** Files are copied from it.
- **Physics cancelled** (above).

## 4. What the Nox code looks like today (evidence)

Mechanics and data are already mostly separate. `Octopus.tsx`, `WorldScene.tsx` and the behaviour modules take their data as props. The coupling is a small, finite set of leaks.

### 4.1 Direct Nox imports in shared code

| File | Leak |
|---|---|
| `App.tsx` | Imports `NOX`, `NOX_POSES`, `SWIM_POSES`, `noxProject`, `noxTechnologies`, `SECURITY_WORLD`; module-level URL parse, project tables, sheet loaders, window globals. It is the de facto composition root. |
| `stage/liveAnchors.ts` | `noxFaceAnchor()` reads `NOX` and `NOX_POSES`; module singleton `liveAnchors`. |
| `ui/OrbButtons.tsx` | Same face-anchor maths as `liveAnchors.ts` from `NOX` and `NOX_POSES` (duplicated). |
| `artifacts/TechBubbles.tsx` | `NOX_SHELLS` from `bubbleOrbits.ts`; `NOX.head.faceOrigin` for the side of the face. |
| `sequences/bubbleBlow.ts` | `BLOW_MOUTH` computed from `NOX.head` and `NOX.face.mouth` at module load. |
| `sequences/entrance.ts` | Reads `NOX.personality.swim`; entrance arc and clearance constants (`ARM_HALF_SPAN`, `PILLAR_HALF`) are Nox's. |
| `sequences/keys.ts` | The Theatre defaults for all four sequences are Nox's authored numbers (and say so: "this file may not import" the config; a test checks they agree). |
| `poses/nox.poses.ts`, `poses/nox.swim.ts` | Authored Nox poses, built from `NOX.arms` at load. They are character data, correctly named, but referenced directly by shared code. |
| `character/Octopus.tsx` | `BODY_X` from `nox.poses`, `swimShapes` from `nox.swim`. |
| `character/skinMaterial.ts` | `INTRO_LIGHTING` (stage lighting) is a default constant in `config/lighting.ts`, not part of `CharacterConfig`, although the 2026-10-26 spec says Nox's lighting comes from his configuration. |

### 4.2 Hard-coded hues and Nox-only features in shared code

These are what a teal octopus would trip over:

- `character/glowLight.ts`: `GLOW_LIGHT.color '#ff4a30'` (the face-glow light).
- `character/Octopus.tsx`: core glow `'#ff4a2a'`.
- `artifacts/orbMaterial.ts`: `ORB_FOCUS_COLOUR '#ff2e5a'` (the focused bubble's edge).
- `character/auraMaterial.ts`: `RED_BELOW`, red below the arms' cup bands.
- `world/WorldScene.tsx`: `SKIN_WARMTH` (pink warmth the world adds to the skin), `CAUSTIC_STRENGTH`.
- `post.ts`: contact-shadow colour `'#1a0418'`, bloom and vignette values, shared by all stages.
- `character/headGlyphs.ts`: red rune strokes; this is Nox's head effect and is correct as a module, but its colours are literal rather than read from the palette.
- `CheekShape` is required on `HeadShape`; the neck blend assumes it.
- `WorldLight.kind` is `'glyph' | 'coral' | 'lava'`; relics are `{ glyph, coral, spill }` and `palette` is `{ stone, glyph, coral, lava, waterFar, floor }`. The world vocabulary is the security realm's.

### 4.3 Shared mutable state (the isolation problem)

| State | Where | Problem |
|---|---|---|
| `bubbleLive` | `artifacts/bubbleLive.ts` | One page-wide set of bubble screen positions. Two instances overwrite each other. |
| `liveAnchors` | `stage/liveAnchors.ts` | One camera/anchor pair. Same. |
| `bubblePointer` | `world/cameraHover.ts` | One hovered flag for the page. |
| `reachState` | `character/armChain.ts` | A module-scratch spring shared by every `ArmChain`. |
| `RELIEF_GATE` / `setReliefGate` | `world/bakedLight.ts` | A shared uniform object. |
| `loading` promise, project id `'OctoVerse'` | `sequences/theatre.ts` | One Theatre project; a second world with its own state needs its own. |
| `ENTRANCE_SHEET`, `BLOW_SHEET`, `SWELL_SHEET`, `url`, `ORDER`, `TECH`, `USAGE`, `ORBS` | `App.tsx` module level | Per-page state that is really per-instance; `url` is parsed from `location.search` at import. |
| Window listeners | `App.tsx` (skip, Escape, press), `Octopus.tsx`, `useQuality.ts`, `ProjectDetail.tsx`, UI | Every instance listens on `window`; a preview would skip another's entrance or close another's detail. |
| `sessionStorage['octoverse.nox.entranceSeen']` | `behavior/useStage.ts` | One flag; a second world would think its entrance was seen. |
| Fixed DOM ids and selectors | `'tech-tooltip'`, `.orb-button`, `.tech-tooltip` via `closest` | Duplicate ids with two instances. |
| `window.__noxReady`, `window.__noxEntrance` | `App.tsx`, `Octopus.tsx` | Read by five e2e specs and `scripts/perf.mjs`. |
| `logoTexture` cache | `artifacts/logoTexture.ts` | Module cache of canvas textures. Safe to share (immutable canvases, never disposed), but must be stated, not accidental. |
| Kit loader per renderer | `world/kitLoader.ts` | Already keyed by `WebGLRenderer` in a `WeakMap`: correct. |

### 4.4 Content contract leftovers

- `ARM_IDS` is defined twice (`config/types.ts`, `content/projectTypes.ts`).
- `SCENE_STATES` (`realm_entry`, `introduction`, ...) is the SVG-era vocabulary and is used only inside the content module; the 3D code uses `StageId` (`entering`, `intro`, `overview`, `techFocus`, `detail`).
- `Project.placements` / `ArtifactPlacement` carries 2D positions in the content contract. Nox sets `placements: {}`. It breaks the master plan's rule that content holds no coordinates.

## 5. Approaches considered

| Approach | Verdict |
|---|---|
| **A. Parameterize in place.** Keep `src/nox3d/`, pass Nox's constants in as arguments. | Fastest to a first Veyra, but nothing structural stops Nox leaking back in, and the singletons and window listeners stay. Rejected as the end state; its useful part (take data as arguments) is step one of B. |
| **B. Split engine from worlds.** `src/engine/` holds shared mechanics; each world is a `WorldBundle` under `src/worlds/<id>/`; every mounted instance owns its own state. | **Chosen.** One migration with a checkable boundary, the only option that fixes isolation, and it matches the master plan's "common contracts, separate technology data". |
| **C. Copy Nox into Veyra and deduplicate later.** | Quickest Veyra, but the master plan prohibits whole-engine duplication, Nox would be edited twice, and "later" does not arrive. Rejected. |

Recommended by this session; the owner confirms it when approving this document.

## 6. Architecture

### 6.1 Layout

```
src/engine/
  arms.ts            ARM_IDS, ArmId: the one definition
  types/             CharacterConfig, StagePose, WorldConfig, StageId, ... (contract types)
  character/         Octopus, ArmChain, ArmTube, ArmWeb, suckers, face, skin and dome materials,
                     halo, aura, grade, head geometry, head-effect modules (HEAD_EFFECTS table)
  motion/            stroke, swimArms (the shared stroke cycle)
  behavior/          ambient, attention, expressions, reach, focus choreography, pose blender,
                     stage state machine, stage hook
  artifacts/         bubbles, tethered orbs, orbit layout, suction hold, logo textures, orb glass
  sequences/         sheet loader, entrance/blow/swell run logic (data from the bundle)
  world/             WorldScene, kit loader, floor, water, particles, far plate, baked light, tiers
  stage/             framing, anchors, quality probe
  ui/                the shared HTML layer (intro, overview, detail, tooltip, tray, skip, orb buttons)
  host/              WorldHost, EngineInstance, instance context, URL/review options
src/worlds/
  nox/               bundle.ts, character.ts, poses.ts, swim.ts, content/, sequences/, world/, theme
  veyra/             (later) same shape
  flux/  aether/     (later)
src/app/main.tsx     reads `?world=`, mounts <WorldHost>
```

Files move with `git mv` to keep history. Tests move beside their modules. Engine imports nothing from `src/worlds/`; a lint check enforces it (section 13).

### 6.2 The world bundle

A world is one object. The engine reads only this; it never imports a world.

```ts
export type WorldId = string; // 'nox' | 'veyra' | 'flux' | 'aether'

export interface WorldBundle {
  id: WorldId;
  /** What the creature looks like and how it moves: geometry, materials, face, personality, lighting. */
  character: CharacterConfig;
  /** Authored arm curves, body transform, expression, head morph, per stage. */
  poses: Record<StageId, StagePose>;
  /** The swim's two arm shapes (open, trail) and the swim stretch. */
  swim: SwimPoseSet;
  /** How technology artifacts are placed, appear and are chosen. */
  artifacts: ArtifactConfig;
  /** Theatre state and per-sequence extras (entrance path, clearance) for this world. */
  sequences: SequenceSet;
  /** The place: kit, layout, palette, lights, far plate, live elements, post. */
  place: WorldConfig;
  /** Per-stage framing. The face anchor the overlays and lens shift register on is derived: `faceAnchor(bundle, stage)` from `character.head` and `poses[stage].body`. */
  stage: { frames: Record<StageId, StageFrame> };
  /** Project data. No coordinates. */
  content: { project: Project; technologies: readonly Technology[] };
  /** UI tokens: accents, title icon, nameplate, surface tint, focus ring. */
  theme: UiTheme;
  /** Optional dev-only helpers: extra URL stills, review components. */
  review?: ReviewHooks;
}
```

Master-plan names map as follows: `WorldDefinition` = `WorldBundle` (with `place` = the environment part); `PoseDefinition` = `StagePose`; `TechnologyPlacement` = `ArtifactConfig` (strategy data, section 9.2); `SceneState` = `StageId`; `TechnologyUsage` = `ProjectTechnologyUsage`; `TechnologyDefinition` = `Technology`; `ProjectDefinition` = `Project`. The newer 3D names stay because the code uses them.

### 6.3 CharacterConfig changes

`CharacterConfig` keeps its current shape (the approved Nox values are unchanged). Additions, each defaulting so Nox's values are byte-for-byte what they are now:

| Change | For | Nox value |
|---|---|---|
| `lighting: StageLighting` moved into the config (today `INTRO_LIGHTING`) | lighting is the character's | `INTRO_LIGHTING` |
| `glow.core: string`, `glow.light: { color, intensity, distance, decay }` replacing the `'#ff4a2a'` and `GLOW_LIGHT` literals | no hard-coded hue | the current literals |
| `glow.aura.low`: already config. `RED_BELOW` becomes `aura.belowStart` | no hard-coded hue | 0.75 |
| `palette.orbFocus` replacing `ORB_FOCUS_COLOUR` | focused-bubble edge colour | `'#ff2e5a'` |
| `skin.mode: 'skin' \| 'jelly'` | Veyra's jelly-glass mantle: fresnel rim, bright crown, see-through middle, warm core; single pass, no transmission target | `'skin'` |
| `skin.sparkle: number` (default 0) | sparkle-speck term | 0 |
| `suckers.style`: rim width, scallop height, colours as config; the red underside band's colour and strength already come from `glow.underside` and the palette | Veyra's cream-gold frill cups | current values |
| `armCurl: { tightness: number }` (spiral tip tightness) | Veyra's tight spirals | current constant |
| `face.lashes: { count, style }`, `face.brow.thickness`, expression tuning table | per-character face | current values |
| `personality.settle`, `personality.glideBias`, `personality.flourishRate` | Veyra's calm motion | values that reproduce today's behaviour |
| `expressions?: Partial<Record<ExpressionId, Partial<ExpressionParams>>>`, per-character overrides merged over the engine's base table by `resolveExpressions(config)`; every reader goes through the resolved table *(A1, G1)* | Veyra's "interested" tech-focus face | absent (the base table) |
| `headEffect: HeadEffectId \| null`, a closed union extended by editing the engine | `'none' \| 'glyphs'` today; `'vaultDial'` when Veyra builds it | `'glyphs'` |

Validation (`clampCharacterConfig`) clamps every new field. A field absent from a legacy config reads its default, so Nox's existing config validates unchanged.

### 6.4 World configuration changes

`WorldConfig` gains vocabulary, not rendering:

- `WorldLight.kind` and the relic table become world-defined string keys with a numeric multiplier each; the security world's `glyph` / `coral` / `lava` stay valid.
- `palette` and `relics` keys are validated by `validateWorld`; the engine reads them by the names the world declares in `lights` and `relics`.
- `skinAccent: string` replaces `SKIN_WARMTH`; caustic strength becomes `water.causticStrength`.
- `post: { contactShadow, bloom, vignette }` moves in from the global `POST`.
- `live` set: today's six shares stay; a world may add named live elements it supplies a renderer module for (kelp, seagrass). That is the same closed-table rule as head effects (section 9).
- `floor.material` names a floor shader variant from a closed list (`'lava-cracks'`, `'sand'`, `'moss'`), added by the world that needs it.
- `props: { id, node, drive }[]` names animatable parts of the kit (Veyra's gate: a padlock ring that turns and clicks). `node` is a named node in the kit glTF; `drive` is one of a small closed set (`'rotateZ'`, `'emissive'`, and `'bob'` from Aether's work). A sequence object in the world's Theatre state targets a prop by id (`SequenceSet.kitDrives`), so the entrance can turn the ring without engine code that knows about gates. A world with no props declares none; Nox declares none.
- The entrance's gate, path and clearance inputs come from the bundle's layout and props, never from the security realm's constants.
- `camera: { tilt, hover: { amount, pace } }`: hover amount and pace per world (`pace` scales the drift's clock; 1 is Nox's). *(A1)*

## 7. Ownership boundaries

One owner per kind of data. A worker changes only what their layer owns.

| Layer | Owns | Lives in | Never contains |
|---|---|---|---|
| **Geometry** | Authored shapes: head, arm specs and curves, swim shapes, kit pieces and layout, dome, orbit shells or tether slots | `worlds/<id>/` (and the Blender script for its kit) | Colours, copy, behaviour logic |
| **Content** | Project identity, text, sections, links, media, technology catalog, per-project usage notes | `worlds/<id>/content/` | Coordinates, arm ids for layout, colours |
| **Placement** | Where artifacts sit and how they are chosen: strategy plus its parameters, per world, per stage and per breakpoint | `ArtifactConfig` in the bundle | Technology text; anatomy |
| **Rendering** | Turning configs into pixels: materials, shaders, meshes, post, kit loading | `engine/` | World-specific numbers, hues, imports from worlds |
| **Control** | Stage machine, input, focus, selection, timers, sequence clocks, URL, storage | `engine/` per instance | Visual data |

Rules, verbatim from the owner's hard rules and the master plan:

- **Exactly eight arms, T1 to T8.** `ARM_IDS` is defined once in `engine/arms.ts`. A technology is never an arm. An arm can carry more than one artifact; extras go to the tray.
- **Shared systems may use different authored geometry per character and pose.**
- **Content holds no coordinates.** `Project.placements`, `ArtifactPlacement`, `PosePlacementMap` and the `SCENE_STATES` vocabulary are removed from the content contract; `StageId` is the single stage vocabulary. A small table maps storyboard panel numbers to `StageId` for review tooling.
- **No creator-supplied geometry.** Authored geometry is trusted application code. Creators choose among approved presets.

## 8. Instance model and isolation

### 8.1 EngineInstance

`<WorldHost world={bundle} />` mounts one **instance**. The instance owns everything mutable and passes it through React context. The engine has no module-level mutable state after extraction, except immutable caches named in the table below.

An instance holds: its stage reducer state, quality probe, `bubbleLive`, `liveAnchors`, camera-hover state, pointer-hover flag, sequence loaders, entrance clock, Theatre project handle, `useId`-derived DOM ids, and its root element ref.

### 8.2 Decisions per shared state

| Today | After |
|---|---|
| `bubbleLive` | Instance field; created by the instance, read via context. |
| `liveAnchors` | Instance field. |
| `bubblePointer` | Instance field (`hover.bubble`). |
| `reachState` in `armChain.ts` | Per-`ArmChain` field. |
| `RELIEF_GATE` | Per-world uniform object owned by the instance; passed to the materials that read it. |
| Theatre `loading` promise, project id | One Theatre project per world, id `OctoVerse/<worldId>`, loaded once per world and memoised per world id. Sampling is synchronous (set position, read value), so two instances of one world sharing the project is safe; the loader documents this. |
| `ENTRANCE_SHEET`, `BLOW_SHEET`, `SWELL_SHEET` | Instance-owned sheet holders. |
| Module-level `url` | The host parses the URL once and passes a `ReviewOptions` prop; engine modules never read `location`. A preview instance gets default options. |
| Window listeners | Instances are `mode: 'page'` or `mode: 'preview'`. Only a page instance attaches `window` listeners; a preview attaches none, runs ambient motion at most, and ignores URL and storage. Page listeners are removed on unmount. |
| `sessionStorage` entrance flag | Key `octoverse.<worldId>.entranceSeen`. Nox keeps `octoverse.nox.entranceSeen`, so existing sessions behave as before. |
| `'tech-tooltip'`, `.orb-button`, `.tech-tooltip` | `useId` ids; `closest` calls scoped to the instance root. Class names stay as styling hooks. |
| `window.__noxReady`, `window.__noxEntrance` | The instance writes `window.__octoverse = { ready, entrance }` for the active page instance, and for the Nox world also keeps the two legacy names, so the five e2e specs and `scripts/perf.mjs` pass unchanged. They migrate to the new names later, in their own change. |
| `logoTexture` cache | Stays module-level. It is an immutable cache of canvas textures, never disposed, safe across instances. Documented in the module. |

### 8.3 World switching

`?world=<id>` selects the bundle. The host keys the instance on `world.id`, so a switch is a full unmount and remount: stage, timers, selection, sequences, listeners and uniforms reset by construction. The renderer's GL context is released with the old canvas. A deliberate non-goal: cross-fading two worlds.

### 8.4 Multiple instances

A page may mount several preview instances (platform storyboard, creator preview) beside one page instance. Previews share the module-level WebGL kit loader (already keyed by renderer) and the immutable logo cache, and nothing else.

## 9. Variation points and the "no plugin system" rule

Veyra asked for open registries. The contract takes the need and rejects the mechanism.

**Rule:** a world may differ from Nox only through (a) data in its bundle, or (b) a **closed, named variant** in a table inside the engine. A variant is added by editing the engine, in the same change as the first world that uses it, with a test. There is no runtime registration and no public extension API.

Closed variant sets, with who needs them:

| Point | Variants today | Added when |
|---|---|---|
| `HeadEffectId` | `'none'`, `'glyphs'` (Nox) | `'vaultDial'` (Veyra) in F01 |
| `skin.mode` | `'skin'`, `'jelly'` | `'jelly'` in F01, built against Veyra |
| `ArtifactConfig.placement`, `.appear`, `.select` | `'orbit'`, `'blow'`, `'suctionHold'` (Nox) | `'pendant'`, `'bloom'`, `'armLift'` (Veyra, owner decision 2026-11-03) in F01 |
| `floor.material`, extra live elements | `'lava-cracks'` | with the world that needs each |

`HEAD_EFFECTS`, `ARTIFACT_STRATEGIES` and the like are plain `Record<Id, Module>` tables in the engine, and the id unions are derived from them (`type HeadEffectId = keyof typeof HEAD_EFFECTS`). Adding a variant is therefore one module, one table entry and one test, with no other edit to shared code. That meets Veyra's real concern (a closed union scattered through shared code would force edits there) without runtime registration. It is the same weight as the master plan's "shared extension points" in F02.

### 9.1 Head effect module

```ts
export interface HeadEffectModule {
  /** Builds the effect's meshes once per character config. */
  create(dome: DomeShape, palette: Palette): HeadEffectRuntime;
}
export interface HeadEffectRuntime {
  /** swell: 0 to 1 progress; frame: the dome frame; called each frame the head is open or moving. */
  update(swell: number, frame: DomeFrame, clockSeconds: number): void;
  dispose(): void;
}
```

Nox's glyph effect (`headGlyphs.ts`) becomes the `'glyphs'` module with its colours read from the palette, not literals.

### 9.2 Artifact strategies (decided: per world)

The owner chose pendants for Veyra (2026-11-03). Placement, appear and select are three independent per-world strategies, each a closed table in the engine (`PLACEMENTS`, `APPEARS`, `SELECTS`; ids derived from the tables). Blow and suction hold stay shared modules that Nox uses.

The shared parts do not vary: orb glass look, logo textures, HTML buttons that follow the artifact, tooltip, keyboard and touch access, phone tray, overflow tray (never extra arms).

```ts
export type PlacementConfig =
  | { kind: 'orbit'; shells: readonly Shell[]; sizes: Record<'intro' | 'overview', number>; centreY: number; halfHeight: number; squareness: number; swellPush: number }
  | { kind: 'pendant'; slots: Record<'intro' | 'overview', readonly PendantSlot[]>; maxPerArm: 2; sizes: Record<'intro' | 'overview', number>; tether: TetherStyle /* length may be 0: a cap only */; swing?: SwingLimits /* default 25 degrees, 1.2 s (A2 X2) */; reveal?: PendantReveal /* seconds; absent: the appear's own timing (A2 X3) */ };

/** A glass orb hangs on a short tether from the arm at arc fraction `at` (0 root, 1 tip); `order` is the technology's rank for the slot. */
export interface PendantSlot { arm: ArmId; at: number; order: number }

/** The thread and its cap: `length` runs from the arm to the cap (0: a cap only), `width` is its diameter, `sag` its sideways bow at the middle as a fraction of `length`; `color` and `cap` are config, never engine literals. */
export interface TetherStyle { length: number; color: string; width: number; sag: number; cap: string }
/** Radians and seconds: the largest swing from vertical, and the time it takes to settle once the arm stops. */
export interface SwingLimits { maxAngle: number; settle: number }
/** Seconds: the first pendant's start, how long one takes, the delay between pendants in `order`. */
export interface PendantReveal { start: number; span: number; step: number }

export interface ArtifactConfig {
  placement: PlacementConfig;
  /** How artifacts appear after the entrance settles: 'blow' (Nox: from the mouth), 'bloom' (Veyra: from a cup) or 'twinkle' (Aether: the ring forms); each kind carries its own parameters (A1, F5). */
  appear: { kind: AppearId };
  /** The stages in which an artifact can be chosen (Nox: both; Aether: the overview only). */
  choosableIn: readonly ('intro' | 'overview')[];
  /** How one is chosen: 'suctionHold' (Nox: the arm pulls it to its tip and lifts it) or 'armLift' (Veyra: its own arm lifts its orb toward the pointer; carries `liftMs`, `overshoot`, `expression`). */
  select: { kind: SelectId };
}
```

- **Nox:** `placement.kind: 'orbit'` with today's `NOX_SHELLS` and constants, `appear: { kind: 'blow' }`, `select: { kind: 'suctionHold' }`, `choosableIn: ['intro', 'overview']`.
- **Veyra:** `placement.kind: 'pendant'`: orbs on short tethers at arm arc-length slots, at most two per arm, the tether swinging **procedurally** from the owning arm's motion (a driven sine on the arm's own velocity; no physics). `appear: 'bloom'`: each orb grows out of a cup on its arm. `select: 'armLift'`: on hover, focus or tap the owning arm lifts its orb toward the pointer, the orb grows and glows, and the tooltip shows (P4).
- **Every appear runs after the entrance settles**, on one trigger for all worlds. Anything that moves with the head swell belongs to the placement: each placement module receives `{ stage, swell, dt }` each frame, as `orbit` reads the swell today (`BubbleState.swell` pushes the shells out). Aether's `satellite` uses it for the flight between its ring and its pendant slots.
- **Combinations are independent.** Nothing requires a placement to pair with one appear or select; a world may mix (for example, orbit placement with `armLift`). The tooltip, buttons and tray read positions from the instance's `bubbleLive` whichever strategy writes them.
- **Slot rules.** The pendant slots map arms to technologies by `order` in the project's declared technology order. With more technologies than slots (at most 16 slots against the 15 primary technologies), the extras go to the tray, as today.
- **Built: the `pendant` placement (Veyra's Task 13, engine commit `feat(engine): pendant placement and tethers`).** `PLACEMENTS = { orbit, pendant }`. Each entry carries `capacity(config)` (orbit 15; pendant: the smaller of the stages' slot counts, so a technology past it goes to the tray in every stage and none is placed in one stage and neither drawn nor offered in the other (a per-stage tray would need the host to build the tray per stage: the larger change); `createProjectModel(project, technologies, capacity)` takes it, so a project's technologies past it go to the tray) and `driver(config, count)`, the per-instance run TechBubbles steps each frame with `{ stage, swell, dt, hot, still }` and the character's live arms (`BubbleState.arms`, ARM_IDS order); the orbit driver is Nox's clock and ring maths unchanged. The pure parts are exported for `satellite` (A1): `assignPendants`, `pendantSwing`, `swingLimits`, `idleSway`, `threadClearance`, `armPoint`, `layoutPendants` from `artifacts/pendant.ts` and `tetherCurve`, `capRadius` from `artifacts/tether.ts`. `tetherCurve(attach, angle, style, radius = 0)` takes the orb's radius as an optional fourth argument (the orb hangs a radius past the cap, so its top is the cap); `threadClearance(pose, slots, faceRect, geometry?)` takes the thread, orb radius, arm thickness, swing angles and, where the rig's rest bend moves the arms off the pose's curves, the drawn arm lines (`armLines`), as an optional fourth argument; without it only the attach points are measured. The swing is a damped sine in phasor form (exact at any frame rate), kicked by the attach point's sideways travel (1.5 radians a unit), its envelope decaying so that under 1 degree is left `settle` seconds after the arm stops, the swing and its speed each held to `maxAngle` less the idle sway (at most 2 degrees, a slow sine, a different phase for each pendant); with reduced motion or `?freeze` the angle is 0. The threads are one `InstancedMesh` of 5 tube segments a pendant and a second of cap beads, in `tether.color` and `tether.cap`. The suction hold stands in for `armLift` until Task 19: the thread is hidden while an arm holds the orb, and the hold swings about the body's middle. `validateBundle` checks the slots (arm, `at` in [0, 1], whole unique `order`, at most two an arm), sizes, tether (colours must parse) and the optional swing and reveal by field name.
- **Built in F01.** E02 ships the three tables with Nox's entries only and the `PlacementConfig` union with `orbit`; the `pendant`, `bloom` and `armLift` modules are added in F01 with Veyra (spec 14.1).

## 10. Coordinate conventions

All of these exist today and are frozen. They are now written down so a second world cannot drift.

- **Units:** 1 world unit = 100 storyboard panel pixels. Time is seconds in code, milliseconds only at the UI boundary. Angles are radians in data and code; degrees only in the URL (`?yaw`) and in `CheekShape.angle`, which is already degrees and is named so.
- **Stage space:** origin at the centre of the 506 x 504 panel; **+x right, +y up, +z toward the camera**. The traced plane is `z = 0`. The camera looks down `-z` from `CAMERA_Z = 12`. Things beyond the character have `z < 0`. The stage's vertical half-extent is `STAGE_HALF = 2.52`.
- **Camera:** perspective, field of view fitted per stage frame (`fovFor`): tall windows widen, nothing is cropped. A world's `camera.tilt` pitches the camera up, with the matching lens shift so the face anchor keeps its screen place (`leanCamera`). Hover drift is a camera offset from this rest camera.
- **Body space:** the octopus's own frame. Origin where the stage pose places the body (`pose.body: { x, y, scale, yaw }`), turning about `PIVOT_Y`; the head's own turn and tilt about the neck. Arms are authored in this space.
- **Head-local space:** origin at `head.faceOrigin`; the face canvas covers `FACE_RECT`.
- **Arm authoring:** each arm is a polyline of `Point2` in the flat traced plane, root first (root hidden under the mantle), then flattened for depth (`flattenForDepth`) so that, at the arm's own z, the stage camera still sees the traced curve. Every world's poses are authored in the traced plane and flattened the same way.
- **Depth tags:** arms are `rear` / `middle` / `front` with a root z and a tip z in `ArmSpec`.
- **Screen space:** CSS pixels from the canvas's top-left. Page UI is laid out for the **rest** camera and follows the live camera by a per-frame `translate` (`useAnchorShift`), never by React state.
- **Colour:** sRGB hex strings in config; the renderer converts. No tone mapping.
- **World layout:** stage units, `z < 0` beyond the character, `floorY` the seabed mean.

## 11. Nox migration map

Every existing effect and authored pose, where it goes, and how its preservation is checked. Paths are today's under `src/nox3d/`. "Verbatim" means the numbers and maths do not change. The extraction plan sequences these moves.

### 11.1 Character

| Existing | Destination | Preserved by |
|---|---|---|
| Mantle: `headGeometry`, `headMorph`, dome geometry and material | `engine/character/` | Frozen stills of intro and overview; `headGeometry` and `domeMaterial` unit tests |
| Skin material (`skinMaterial`), skin detail, wet gloss, speckles | `engine/character/` (`mode: 'skin'`; `'jelly'` is added later) | `skinMaterial.test`; frozen stills; colour samples |
| Arms: `armChain`, `armTube`, `armWeb`, suckers (`suckerRow`, `suckerMaterial`) | `engine/character/` | Their unit tests unchanged; frozen stills |
| Face: `FaceCanvas`, `eyeShape`, `browShape`, `mouthShape`, `faceRedraw`, blush, puff and round mouth | `engine/character/` (lashes and brow thickness read config) | The face tests; expression stills for all seven expression ids |
| Halo, aura, local grade, glow light, core glow | `engine/character/` with colours read from config (`glow.core`, `glow.light`) | `haloMaterial`, `auraMaterial`, `glowLight` tests; colour targets (`check_stage.py --world`) |
| Head effect: glyphs | `engine/character/headEffects/glyphs.ts` as `HEAD_EFFECTS.glyphs` | Head-swell stills (`?swell=<s>`), `headSwell` tests |
| `NOX` config | `worlds/nox/character.ts`, plus new fields at Nox's current values | `nox.character.test`, `validate.test` unchanged |
| `INTRO_LIGHTING` | `worlds/nox/character.ts` as `lighting` | Frozen stills; colour samples |
| `worldAccent.ts` (world accents on skin) | `engine/character/` (skin accent now from the world) | `worldAccent.test` |

### 11.2 Poses and motion

| Existing | Destination | Preserved by |
|---|---|---|
| `NOX_POSES.intro`, `overview`, `techFocus`, `detail`, `entering` (traced curves, body, expression, tilt, look) | `worlds/nox/poses.ts`, verbatim, built from `bundle.character.arms` | `nox.poses.test`; frozen stills of every stage |
| `INTRO_TRACED`, `OVERVIEW_TRACED`, `ENTERING_TRACED` | `worlds/nox/poses.ts` (authored data) | Same |
| `flattenForDepth`, `withRoot`, `toContent` | `engine/poses/` (pure helpers every world uses) | `nox.poses.test` |
| `SWIM_POSES` (`open`, `trail`), `swimShapes`, `SWIM_STRETCH` | `worlds/nox/swim.ts` (authored), helpers in `engine/motion/` | `nox.swim.test`; `?pose=swim-open` / `swim-trail` stills |
| `stroke.ts`, `swimArms.ts` (the stroke cycle) | `engine/motion/`, reading `personality.swim` from the config | `stroke.test`, `swimArms.test` |
| `PoseBlender`, `STAGE_TRANSITION` | `engine/behavior/` | `poseBlend.test` |
| `ambient`, `attention`, `expressions`, `reach`, `focusChoreography` | `engine/behavior/` | Their tests; `FOCUS_BEATS` and `HOLD_BEATS` unchanged |

### 11.3 Sequences

| Existing | Destination | Preserved by |
|---|---|---|
| `keys.ts` Nox defaults for `entrance`, `bubbleBlow`, `headSwell`, `arrival` | `worlds/nox/sequences/defaults.ts` | `theatre.test`; the check that the Theatre JSON and the defaults agree |
| `state/octoverse.theatre.json` | `worlds/nox/sequences/state.theatre.json` (content unchanged) | JSON diff is empty |
| `theatre.ts` loader | `engine/sequences/` taking `{ projectId, state, defaults }` | `theatre.test` |
| `entrance.ts` run logic and path; `ARM_HALF_SPAN`, `PILLAR_HALF` | Run logic to `engine/sequences/`; path, clearance inputs, the layout they test against and any gate prop to the bundle. Nox's entrance has no gate prop and runs as today. | `entrance.test` (clearance against the Nox layout) |
| `bubbleBlow.ts`, `BLOW_MOUTH` | Logic to engine; `BLOW_MOUTH` is computed from the bundle's head and face at instance creation, not at module load | `bubbleBlow.test`; blow stills (`?blow=<s>`) |
| `headSwell.ts` | Engine; sheet from the bundle | `headSwell.test`; swell stills |

### 11.4 Artifacts

| Existing | Destination | Preserved by |
|---|---|---|
| `TechBubbles`, `bubbleOrbits` (`NOX_SHELLS`, centre, size, swell push) | Engine component; shells and constants become `bundle.artifacts.orbit` | `bubbleOrbits.test`; frozen stills with bubbles |
| `suctionHold` | Engine, `select: 'suctionHold'` | `suctionHold.test`; `?hold=<ms>` stills |
| `orbMaterial` (glass look, halo), `logoTexture` | Engine; focus colour from `palette.orbFocus` | `logoTexture.test`; stills |
| `bubbleLive` | Instance-owned | Isolation tests (section 13) |
| The 15 bubbles over shells, overflow to the tray | Same logic; count and overflow from content | `content.test`; e2e keyboard spec |

### 11.5 World

| Existing | Destination | Preserved by |
|---|---|---|
| `WorldScene`, `Kit`, `Floor`, `Water`, `Particles`, `Motes`, `FarCards`, `SurfaceLight`, `bakedLight`, `kitLoader`, `kitLod`, `liveMotion`, `placement`, `worldTiers`, `worldLevel`, `worldTime`, `cameraHover`, `lensShift`, `ContactShadows` | `engine/world/` | Their unit tests; e2e `world`, `worldMotion`, `worldTiers` specs; frozen stills |
| `SECURITY_WORLD` (`world/security/config.ts`), `layout.json`, `far.json` | `worlds/nox/place/` | `validateWorld.test`; the Blender script reads the same `layout.json` |
| `blender/security/*.py`, `public/nox/world/security/*` | Stay at their paths; the Blender scripts live with the world. `public/nox/` keeps its path for Nox; new worlds use `public/<id>/`. | Asset hashes unchanged |
| `POST` | `place.post` of the bundle | Frozen stills (bloom and vignette identical) |
| Quality tiers (`quality.ts`, `useQuality`, `FrameProbe`) | `engine/stage/` | `quality.test` |

### 11.6 Stage, UI, content, tooling

| Existing | Destination | Preserved by |
|---|---|---|
| `STAGE_FRAMES`, `framing`, `config/stage.ts`, `viewWindow` | Frames from the bundle; maths in `engine/stage/` | `framing.test`, `stage.test` |
| `noxFaceAnchor`, `OrbButtons` anchor maths | One shared `faceAnchor(bundle, stage)` derived from the head and poses; the duplicated code is removed | Both consumers' tests; tooltip stills |
| `stageMachine`, `useStage`, `urlState` | `engine/behavior/`, per instance; URL parsed in the host | `stageMachine.test`, `urlState.test` |
| UI components and CSS (`IntroOverlay`, `OverviewPanel`, `ProjectDetail`, `OrbButtons`, `OrbTray`, `TechTooltip`, `SkipEntrance`, `ExploreNameplate`) | `engine/ui/`; colours and the title icon from `bundle.theme`; Nox's theme reproduces the current CSS values | UI tests (`detailContent`, `tooltipContent`, `tooltipPlacement`, `hoverIntent`); e2e `detail`, `keyboard`; stills |
| Content: `nox.ts`, `noxProject.ts`, `noxTechnologies.ts`, `placeholders.ts` | `worlds/nox/content/` | `content.test` |
| `projectTypes.ts`, `validateProject.ts` | `engine/content/`, minus `placements` | `content.test` updated only for the removed field |
| Review page (`review/`) | `engine/review/` and `worlds/nox/review.ts` | The review page builds and loads |
| Scripts: `check_stage.py`, `perf.mjs`, `world-capture.mjs`, `stage_samples.json`, `world_samples.json` | Stay; take `--world-id <id>` (default `nox`; the existing `check_stage.py --world` flag already means "the world scene" and keeps that meaning) and read the world's samples. `perf.mjs` and the capture scripts already take query strings, so `world=<id>` rides in them. | Same numbers for Nox |

Anything not listed that a later grep finds in `src/nox3d/` gets a row in the extraction plan before it moves. Nothing is deleted without a row.

## 12. How the other worlds plug in

Each new world is a directory with a bundle and its assets, and engine changes only for a named closed variant it introduces.

### 12.1 Per-world deliverables

1. `character.ts` (all `CharacterConfig` fields), authored against the world's reference panel.
2. `poses.ts` and `swim.ts` for the five stages, authored (never derived from Nox's).
3. `artifacts` config.
4. `sequences/` Theatre state and defaults (entrance, blow or bloom, swell), and the entrance clearance test against this world's layout.
5. `place/`: kit glTF, Blender script, layout, far plate, palette, lights, live elements, post, camera.
6. `content/` and `theme.ts`.
7. Samples and colour targets for `check_stage.py --world <id>`, and a perf run.

### 12.2 Veyra (the second-world proof)

Reconciled with the Veyra session's list (section 15). Needs engine variants: jelly skin mode, sparkle term, `vaultDial` head effect, `pendant` placement with `bloom` and `armLift`, a world-defined relic and light vocabulary, a floor material, kelp and seagrass live elements.

### 12.3 Flux and Aether (from the references; to be confirmed by their own design sessions)

These are read from `Flux.jpeg` and `Aether.jpeg`, not from a design. They are closer to Nox in kind, which is the point of the order: engine owner approves anything beyond data.

- **Flux:** blue-violet body, brighter and more energetic. A server-and-pipeline realm with a GitHub shield gate. Orbs hang at arm ends and arms spread wide; the references show the same pendant-style layout as Veyra, so Flux will likely reuse `pendant`, which Veyra's work builds. Likely needs: a floor and relic vocabulary for server racks, a gate prop.
- **Aether:** indigo-pink, translucent jellyfish glow, a crown, floating particles, an AI-brain gate, jellyfish live elements. Likely needs: a translucent skin tint, a jellyfish live element, orbiting particle dots.
- **Platform (O):** a different shape: a landing, an explore view of mini octopuses, a creator preview, a profile. Mini octopuses are **preview instances** of the same engine (section 8.4). That is the first place multi-instance isolation is exercised for real.

A new variant for any of these goes through the engine owner: one worker owns shared engine changes; world workers cannot independently change contracts (master plan, section 2).

### 12.4 Creator octopuses

A creator picks a base character preset, palette and personality from approved choices. The result is a `WorldBundle` assembled from templates: no arbitrary geometry or SVG. This needs `CharacterConfig` to stay fully serialisable data, which it is today and must remain.

## 13. Verification

### 13.1 Equivalence (extraction acceptance)

1. **Baseline first.** Before any move, on the cut tip of `feat/nox-3d`: capture frozen stills (`?freeze&stage=<s>` for all five stages, the entrance at `?t=` 2 and 4, `?blow=`, `?swell=`, `?hold=`, `?pose=swim-open|swim-trail`, `?yaw=180`, and a phone viewport) with `scripts/stage-capture.mjs`, and record the `check_stage.py` colour and silhouette numbers. Keep them as the baseline set.
2. **Noise floor.** Capture the baseline twice; the difference between the two is the tolerance. A frozen frame that differs by more than that floor after a migration step is a regression. Tolerance is set from the measurement, not guessed.
3. **After each migration step** the vitest suite passes, and the stills are compared against the baseline.
4. The numbers `check_stage.py` reports for Nox (colour samples, silhouette widths) are equal within the tolerance.

### 13.2 Existing suite

- All vitest tests under `src/nox3d/**` (today 66 test files, about 399 cases at `6009863`; the extraction plan records the count on the final tip) move with their modules and pass; the count of test cases does not drop. `vitest.config.ts` `include` and `tsconfig.nox3d.json` are updated to the new paths in the same change.
- The six e2e specs (`detail`, `entrance`, `keyboard`, `world`, `worldMotion`, `worldTiers`) pass unmodified. The legacy `__nox*` names stay (section 8.2).
- `tests/visual/*` is SVG-era and not part of this suite; it is neither a gate nor edited.

### 13.3 New tests

- **Isolation:** two instances of Nox mounted on one page: distinct DOM ids and aria ownership; selecting a technology in one leaves the other's state and `bubbleLive` untouched; the entrance in one is not skipped by input to the other; unmounting one leaves the other running; a `mode: 'preview'` instance registers no window listener.
- **World switch:** `?world=a` to `?world=b` resets stage, selection, timers and sequences; no listeners leak (listener count equals before).
- **Boundary lint:** `src/engine/**` imports nothing from `src/worlds/**`; `src/worlds/**` imports only engine contract types and its own files.
- **Config defaults:** a legacy Nox config with none of the new fields validates and reads defaults that reproduce current behaviour.
- **No hue literals:** a test greps `src/engine/**` shader and material sources for hex literals not in an allow list (logo marks).

### 13.4 Performance

Measure with `scripts/perf.mjs` only (pane closed, back to back, 1536 x 1024, pixel ratio 1), after the extraction lands, against the numbers recorded at baseline. Not at this stage: no dev server runs while the spec and plan are written.

## 14. Sequencing and what this blocks

- E01 (this) -> owner approval -> E02 plan (written now, not executed).
- **Extraction begins only after** Nox's final verification lands on `feat/nox-3d`. The plan's first task re-reads this contract against that tip and records any drift (new files, new singletons) as additional migration-map rows.
- F01 (Veyra static) starts after E02 lands and is approved.

### 14.1 What E02 builds and what waits for F01

The closed-variant rule (section 9) applies to the extraction itself: E02 builds the **boundary, the isolation and every move that Nox already exercises**, and defers each variant that has no user yet to the world that needs it, built against that world's reference.

- **E02 builds:** the layout (6.1); the bundle and host; instance isolation (8); `?world=` and full-remount switching; `lighting` into the character; `glow.core`, `glow.light`, `aura.belowStart`, `palette.orbFocus` and the head-effect colours moved from literals into config at Nox's values; `skinAccent`, `causticStrength`, `post` and `camera.hover` into the world; open `WorldLight.kind` strings; the `HEAD_EFFECTS` and `ARTIFACT_STRATEGIES` tables with their derived id unions (Nox's `glyphs` and `orbit` only); the content-contract cleanup; theme tokens; `--world-id` tooling.
- **Deferred to F01, with the Veyra work that needs each:** `skin.mode: 'jelly'` and `skin.sparkle`; cup-frill style fields (`suckers.style`); `vaultDial`; `pendant`, `bloom` and `armLift`; `place.props` and `SequenceSet.kitDrives` (the gate's ring); the generalised layout categories, relic and palette keys (`WorldLayout` is still `pillars / rocks / corals / chains / coralLights`, which only Veyra's real kit can shape correctly); `floor.material` and extra live elements; personality `settle`, `glideBias` and `flourishRate`.
- **Added by amendment A1 (section 18):** per-character `expressions` overrides, `EntranceShape`, `camera.hover.pace`, and sheet ids derived from the appear table: all plumbed in E02 at Nox's values. The flourish layer and the non-spiral entrance path are built in F01.
- **Dropped unless F01 finds a need:** `armCurl.tightness` and new face fields other than `expressions`. Tip spirals are authored pose points, and lash count, lash shape and brow thickness are already config (`EyeLayout.lashes`, `FaceLayout.brow.thickness`).

The contract types for the deferred items stay in this document as the agreed shape; the extraction plan does not add them to code.
- Master plan packet E02 asks for human approval of the engine foundation; second-world validation (F02) follows.

## 15. Veyra reconciliation

Source: Veyra's full answers, relayed 2026-11-03 (they supersede its first list). "Accepted" means included above as written.

| # | Veyra's need | Outcome |
|---|---|---|
| 1 | Cheek lobes optional; tip-curl tightness and cup style as config | **Cheeks: withdrawn by Veyra** (it now has small cheek lobes, radius about 0.10, `adf5ac2`), so `head.cheeks` stays a required config value and nothing in the contract or E02 exists for radius 0. Tip curl and cup style: as 14.1 (authored pose points; `suckers.style` in F01). |
| 2 | "Jelly glass" mantle mode, single pass; sparkle term; no hue assumed by shaders | Accepted. `skin.mode`, `skin.sparkle`, the hard-coded hue list in 4.2 moves to config. The jelly shader is built against Veyra in F01, not speculatively now. |
| 3 | Face fully from config; expression presets per character | Accepted. Lash count and style, brow thickness and an expression tuning table become config. |
| 4 | `HeadEffectId` an open registry; `vaultDial`; the effect gets swell progress and the dome frame | **Modified.** A `HEAD_EFFECTS` table in the engine with the id union derived from it, so adding `vaultDial` is one module and one entry with no other shared-code edit. No runtime registration. The module receives the swell progress and dome frame (9.1). |
| 5 | Tech placement, appear and select as per-world strategies; Nox `orbit`, `blow`, `suctionHold`; Veyra `pendant`, `bloom`, `armLift` | **Decided by the owner, 2026-11-03.** Three independent closed tables (9.2). E02 ships Nox's entries; F01 builds Veyra's three modules. Blow and suction hold stay shared modules. |
| 5b | The entrance's gate with an animatable part (padlock ring turns and clicks), tested against Veyra's layout | Accepted, new since the first list: `place.props` and `SequenceSet.kitDrives` (6.4). |
| 5c | Face anchor per character (the face sits lower on a taller dome) | Already in the contract: the anchor is derived per character from its head and poses by one shared function, and the two duplicated anchor computations collapse into it (11.6). |
| 6 | Poses owned by the character; blender shared | Accepted (6.2, 7). |
| 7 | World config: per-world kit and Blender script; open light and relic enums; live-element set; floor material; fog; camera tilt and hover | Accepted with closed tables for floor materials and extra live elements (6.4, 9). |
| 8 | Personality: settle overshoot, glide/stroke bias, flourish rate; Theatre sequences and entrance clearance per world; no physics | Accepted; physics is out of the engine entirely. |
| 9 | UI theme tokens and project data per world | Accepted (`theme`, `content`). |
| 10 | `?world=`, full reset on switch; `check_stage --world`; perf script takes a world id; Veyra budget 40 fps at tier low | Accepted (8.3, 11.6, 13.4). The 40 fps budget is Veyra's own acceptance, not the engine's; the engine's duty is to add no frame cost. |

Not raised by Veyra and added by this contract: instance isolation (section 8), the `lighting` and `post` moves into data, and removing `Project.placements`.

## 16. Left to the builder

- Exact file names inside `engine/` beyond the layout in 6.1, and the final names of the new config fields.
- The `HeadEffectRuntime` and `DomeFrame` signatures, within 9.1.
- The order of migration steps (the plan proposes one).
- How to pass the instance through React (one context versus a few), provided the engine has no module-level mutable state.
- The still-comparison tool (a small script versus the existing Python tools) and the tolerance, measured per 13.1.
- The `ReviewHooks` shape for dev-only stills.

## 17. Calls I made (for the owner to check)

1. **Approach B** (engine and worlds split) over parameterizing in place or copying. The owner has not yet confirmed it; approving this document confirms it.
2. **Variation by closed tables**, not open registries; this overrides Veyra's wording and keeps the "no speculative plugin systems" rule.
3. **Pendants for Veyra are decided** (owner, 2026-11-03). Placement, appear and select are three independent closed tables; E02 builds Nox's entries and F01 builds `pendant`, `bloom` and `armLift`.
4. **`StageId` is the only stage vocabulary**; the SVG-era `SCENE_STATES` and `Project.placements` are removed from the content contract.
5. **Legacy `__nox*` globals stay** so the e2e suite passes untouched.
6. **A world switch is a full remount**, not a transition.
7. **Preview instances take no input, URL or storage.** This is the isolation story for the platform's mini octopuses.
8. **Arm physics is gone from the engine**, per the orchestrator; the 2026-10-26 section 9.3 is not implemented by this work.

## 18. Amendment A1: gaps found by the world plans (approved by the owner, 2026-11-03)

Veyra's plan (`claude/veyra-design-3b1c3c`, `2026-11-03-veyra-world.md`) found five gaps against this contract and left the contract unedited. Each is answered below as data or a closed variant. Flux and Aether added their own gaps (18.1, 18.2); all items are firm and the owner approved the combined amendment. Sections 6.3, 6.4 and 14.1 carry the matching in-line edits, marked *(A1)*.

| Gap | Need | Decision |
|---|---|---|
| G1 | `EXPRESSIONS` is an engine constant; Veyra needs a different tech-focus face | **Accepted, plumbed in E02.** `CharacterConfig.expressions` overrides merge over the base table through `resolveExpressions(config)`; `PoseBlender`, `Octopus` and the URL parser read the resolved table. No new `ExpressionId`: an override of an existing id. Nox has none, so its faces are unchanged. Veyra's values land in F01. |
| G2 | The entrance spin is a fixed full golden-spiral turn; Veyra wants a 200-degree glide turn | **Accepted.** `SequenceSet` carries `entrance: EntranceShape = { turn: number; spiral: boolean }`. E02 reads `turn` and `spiral` from data with Nox's values (`2 pi`, `true`; the type admits only `spiral: true` until F01) and proves the outputs unchanged against fixtures. The non-spiral path is built in F01 with Veyra (the closed-variant rule: no user yet). |
| G3 | `camera.hover` is an amount; Veyra wants a slower period too | **Accepted.** `camera.hover: { amount, pace }`; the drift's clock is `t * pace`. Nox `pace: 1`. Veyra's fallback (a lower amount) is no longer needed. |
| G4 | `flourishRate` needs a shared idle-flourish ambient layer | **Accepted, built in F01.** A shared layer `engine/behavior/flourish.ts`, driven by `Personality.flourishRate` (events per minute; 0 is none, so Nox is unchanged). It joins the other deferred personality fields in 14.1. |
| G5 | `SequenceId` is a closed union; Veyra's bloom needs its own sheet | **Accepted, derived rather than open.** `SequenceId` becomes `'entrance' \| 'headSwell' \| 'arrival' \| AppearSheet`, where `AppearSheet` is the optional `sheet` field of each entry in the appear table (an entry with no sheet, such as a future `pulse`, adds none) (`APPEARS.blow.sheet = 'bubbleBlow'`, `APPEARS.bloom.sheet = 'bloom'` in F01). A bundle must supply the sheets its own modules need; `validateBundle` checks it. Nox's Theatre sheet names do not change, so its JSON is untouched. |

Not changed: G6 (the first milestone's backdrop is an empty kit plus water colours, which the contract already allows) and G7 (tip spirals as authored pose points; Veyra raises it if ambient curl unrolls them).

Everything here keeps Nox's output unchanged and the Nox migration map (section 11) intact: each new field has an absent or neutral default that reproduces today's behaviour.

### 18.1 Flux's gaps (firm; from `flux-engine-needs.md`)

Flux is mostly data on this contract (cheeks kept, `jelly` skin with its own colours, `pendant` placement, `armLift` select, a `sand` floor, Veyra's `props` and `kitDrives` with the `emissive` drive, fish and bubbles). The owner accepted the pulse motif and Flux confirmed the list (2026-11-03), so every item is firm. All are built in Flux's own work (G01), not in E02.

| Gap | Need | Decision |
|---|---|---|
| F1 | A travelling emissive pulse along each arm's cup row, with a per-arm one-shot trigger | **Accepted (motif accepted by the owner).** `suckers.pulse: { speed, wavelength, strength, colours }` in the character config; a term in the sucker material plus one uniform array of eight trigger times; no extra pass. `strength` defaults to 0, so Nox and Veyra are unchanged. The trigger is a function on the instance that appear and select modules and sequences call. |
| F2 | An appear mode where the pulse runs down the arm and the orb grows at its slot | **Accepted, with F1.** One entry in `APPEARS` (`pulse`), reusing `bloom`'s grow; one module, one entry, one test. |
| F3 | A head effect: four linked light nodes fill in sequence, then a ripple opens the panel | **Accepted.** `HEAD_EFFECTS.pipelineRun`; it fits `HeadEffectModule` as written (9.1). |
| F4a | A live element of light pulses travelling along spline paths named in the world layout | **Accepted as a closed variant.** A `packets` entry in the live-element table (instanced). The paths are layout data, so it rides on the generalised layout that Veyra's work builds first. |
| F4b | Kit LEDs that blink | **Decided: a kit-material variant, not a live element.** A closed `KIT_MATERIAL_VARIANTS` table with `led` (emissive, with a per-vertex phase baked into the glTF by the world's Blender script). Chosen because the phase is authored in Blender and a prop per LED would not scale. Confirmed by Flux. |
| F5 | `armLift` timing and expression come from the character, not module constants | **Accepted; changes the artifact config shape.** `appear` and `select` become small configs: `appear: { kind: AppearId; ...params }`, `select: { kind: SelectId; ...params }`. `armLift` carries `{ liftMs, overshoot, expression }`; Veyra sets about 450 ms ease-out, Flux about 300 ms with overshoot and a slightly open mouth (an expression override, A1 G1). Nox's `{ kind: 'blow' }` and `{ kind: 'suctionHold' }` keep their module constants. |
| F6 | `jelly` colour stops hue-free | **Accepted as a build constraint on Veyra's `jelly` work.** Crown, depth and warm-core colours are all config (`skin.jelly: { crown, depth, core }`); no hue constant in the shader. |
| F7 | Tether length down to about 0; orb size as data | **Accepted.** `pendant.tether.length` admits 0 (a cap only), and `pendant.sizes: Record<'intro' \| 'overview', number>` joins the placement config (9.2). |

### 18.2 Aether's gaps (first list; the owner chose approach A, so A1 to A3 are firm)

Aether's proposed approach A: in the intro and detail a tilted gold ring carries five seed beads joined by constellation lines; when the head opens the beads flare, split into the technology orbs and fly to arm-tip pendant slots. Technologies are choosable from the overview on, not in the intro. The owner chose approach A (relayed 2026-11-03), so A1 and A3 are firm; A2 was withdrawn by Aether (below). All are built in Aether's own work (H01) unless marked E02.

| Gap | Need | Decision |
|---|---|---|
| A1 | `satellite` placement: a ring rest form plus pendant slots, swell-driven flight between them | **Accepted (approach A chosen).** One entry in `PLACEMENTS`. **Build rule for Veyra's work:** the pendant's slot assignment, swing, tether curve and thread clearance are exported as pure functions with no React, instance state or globals: `assignPendants`, `pendantSwing`, `tetherCurve` and `threadClearance`, from `engine/artifacts/pendant.ts` and `engine/artifacts/tether.ts` (the names and paths of Veyra's plan, which writes them), and Nox's orbit maths (`orbitPoint`, `layoutOrbits`) stays exported, so `satellite` composes them without copying. A placement is built from shared helpers, never from another placement's component. |
| A2 | The contract never says when an appear runs | **Withdrawn by Aether.** The swell-driven flight lives in the `satellite` placement, which reads the swell as `orbit` does; Aether's appear is `twinkle` (the ring forms after the entrance settles), on the same trigger as blow and bloom. No `appear.on` field exists. The contract now states the single trigger in 9.2. |
| A3 | A stage with zero choosable artifacts (the intro) must work | **Accepted; built and tested in E02.** `ArtifactConfig.choosableIn: readonly ('intro' \| 'overview')[]` (Nox: both). The stage reducer ignores `FOCUS_TECH` in a stage not listed; the bubble buttons and the tray render nothing there; Explore still leads to the overview; keyboard order has no dead stops. |
| A4 | `HEAD_EFFECTS.synapse` (star nodes, gold lines wiring in a wave, one pulse, dissolve) | **Accepted.** Fits `HeadEffectModule` (9.1). |
| A5 | A `jellyfish` live element (instanced bell with trailing filaments) | **Accepted** as a closed `LIVE_ELEMENTS` entry, with `packets` and kelp. |
| A6 | `jelly` and `sparkle` need colour and core position as config, and apply to the arms as well as the mantle | **Accepted as a build constraint on Veyra's `jelly` work.** `skin.jelly: { crown, depth, rim, core: { colour, position }, surfaces: ('mantle' \| 'arms')[] }`, with no hue constant in the shader (with F6). Veyra uses `['mantle']`; Aether `['mantle', 'arms']`. `sparkle` is per surface in the same way. |
| A7 | Frill cup style as config (pink-white) | **Accepted as a build constraint** on `suckers.style`: colours, glow and size are config. |
| A8 | Veyra's portal membrane as a shared material with colour parameters | **Accepted.** A `membrane` entry in `KIT_MATERIAL_VARIANTS` (with F4b's `led`), with colour parameters in `place.materials`; Aether's arch reuses it. The brain glyph is a kit node on the existing `'emissive'` prop drive. |
| A8 extension (pending owner) | What Veyra's Task 10 built beyond A8 (engine commit `f0d7687`) | **Built, pending owner approval.** (1) The table is `KIT_MATERIAL_VARIANTS = { membrane, glow }` (closed; `led` is still F4b's to add). `membrane` params: `{ color, edge, flowSpeed, flowScale, flash }`. A second entry, `glow`, with params `{ color, strength, tips, pulse, period }`: an emissive piece brightest at its vertex-colour tips, pulsing slowly; Veyra's glowing plants and padlock use it. (2) The assignments are `WorldConfig.materials: readonly { node, material, params }[]` (a kit node by name, the variant's id in `material`), not a `place.materials` colour map. (3) `kit.attached: readonly { node, piece }[]`: kit nodes built in a placed piece's frame and drawn with each placement of it (the membrane and padlock in each arch). `validateWorld` checks every name. **The owner's choice:** the padlock could instead keep the glb's own emissive material and use the existing `'emissive'` prop drive, as A8's brain glyph does; then `glow` serves the plants only, or is dropped if the plants take a baked look instead. |
| A8 extension 2 (pending owner) | What Veyra's Task 11 added (engine commit `c32da3b`) | **Built, pending owner approval.** (1) Both kit-material variants take an optional `fog` param in [0, 1]: the share of the world's fog the piece mixes in (unset: 1, the world's). Spliced into three's fog chunk (`kitFog.ts`), refused by name outside [0, 1]; it never raises the brightest value, so the relic rule's measure is unchanged. Veyra's portal takes 0.25 so it reads from the stage as P1 paints it. (2) The palette may give the kit's `rock`, `pebble` and `coralBody` colours (Kit.tsx keeps Nox's literals as the fallback, so his materials, their order and his stills are unchanged; the hue-debt count is unchanged). Veyra's are a dark blue-teal rock and an orange coral body. |
| G4 and 14.1 build (pending owner) | What Veyra's Task 16 built for the deferred personality fields and the flourish layer (engine commit "feat(engine): settle, glide bias and flourish (for Veyra)") | **Built, pending owner confirmation** (raised overnight, not before starting; the controller ruled to proceed). All three are optional on `Personality` and read Nox's values when unset (`PERSONALITY_VARIANT_DEFAULTS = { settle: 1, glideBias: 1, flourishRate: 0 }`); `validateBundle` refuses each by name when set out of range (`settle` 0 to 1, `glideBias` above 0, `flourishRate` 0 or more, all finite) and `clampCharacterConfig` keeps them when set. (1) `settle` scales the landing overshoots: `settleOvershoot(t, micro, scale)` (a stage move's) and the entrance arms' run past the intro pose (`settleWeight(settle, overshoot)`: the same curve with a coefficient solved so the run past is that share of Nox's; `settleScale(personality)` reads it). (2) `glideBias` scales the stroke's glide: `strokeTiming(personality)` is `swim` with `glide * glideBias` (Nox's own `swim` object at 1); Octopus and the entrance read it. (3) `flourishRate` (per minute) drives `engine/behavior/flourish.ts`: `FlourishScheduler(rate, rng)` waits 0.8 to 4/3 of 60 / rate s from one start to the next (12 to 20 s at 4), never less than a flourish, never the same arm twice in a row; `flourishCurve(t, start)` runs 0 to 1 to 0 over `FLOURISH_SECONDS` = 3 (smootherstep up and down); `flourishUnroll` = `FLOURISH_UNROLL` (0.4) x the curve, applied to one arm as the chain's tip straightening (`ArmDrive.straighten`, the max with any drive), so the tip curl unrolls by at most 40%. No flourish with reduced motion, with `freeze`, or in the entrance. **Events (X1):** `InstanceState.flourish: FlourishEvents`, `subscribe(cb: (e: { arm: ArmId; start: number }) => void): () => void`, one per instance (the plan's event form; it supersedes X1's `(arm) => void`). **Busy-arm hook, for Task 19:** `FlourishScheduler.step(t, busy?: (arm: ArmId) => boolean, events?)` starts a flourish only on an arm for which `busy` is false (default: none busy). Octopus passes `armBusy`: the suction hold's turn toward its bubble (`holdWeight[arm] > 0`). Task 19's pendant lift must make a lifting arm busy, through that hold or by extending `armBusy`. Nox sets none of the fields: his ambient, stroke and overshoot outputs equal fixtures captured from the code before the change (`src/engine/motion/fixtures/nox-motion.json`), and his stills are unchanged. |
| A9 | Per-character expression table; `armLift` reads the focus expression from it | **Already in A1/G1 (promoted to E02).** `CharacterConfig.expressions` overrides carry Aether's "wonder"; `select.expression` (F5) names the id. This supersedes the earlier "dropped unless F01 finds a need". |
| A10 | Floor reuses `'sand'` | No change. |
| A11 | `artifacts.orbStyle { rimBeads, rimColour, cap }` on the shared orb glass | **Accepted, built in H01.** Data on `ArtifactConfig`; zero beads and no cap is today's look, so Nox is unchanged. |
| A12 | Curious personality: an idle head tilt and gaze wander | **Cheap form accepted:** `Personality.idleTilt: { amplitude, period }` (0 is none) and `StagePose.lookPoints?: readonly Point2[]` (a per-pose list of look-at points that attention picks from every few seconds; the existing single `look` stays). **Richer form declined:** attention reading live-element positions couples two systems for one world's benefit. Revisit only if H01 shows the cheap form is not enough. Built in H01. |
| A13 | A prop drive `'bob'` (a slow vertical sine) for floating rubble | **Accepted.** `'bob'` joins the closed prop-drive set (`'rotateZ'`, `'emissive'`, `'bob'`), with `{ amplitude, period }` and a per-prop phase. Built in H01 beside the other drives. Fallback unnecessary. |
| A14 | The fish live element needs its silhouette as data (Aether's manta-like fish) | **Accepted as data.** `live.fish.silhouette?: readonly Point2[]`: a closed outline polygon of at most 24 points in a unit box, validated by `validateWorld`; absent means Veyra's shape. The instanced fish card is built from the outline, so a new silhouette is data and not a new module. Built in H01 (the first world to override it). |
| A15 | Floor `'sand'` (dark rock and sand); Veyra builds only `'moss'` | **Accepted: `'sand'` is one shared floor variant**, with its colours from the world's palette. Flux (a `sand` floor) and Aether both need it, so the first of the two to build adds the entry and the other reuses it; neither forks it. The `moss` fallback is not needed. |

## 19. Amendment A2: the platform's embedding needs and Flux's plan gaps (approved by the owner, 2026-11-03)

The platform design (`platform-design`, `platform-engine-needs.md`) mounts the OctoVerse host as the page instance, mini octopuses as `mode: 'preview'` instances (8.4), and creator octopuses as runtime bundles (12.4). Its seven gaps are answered below. The owner picked the platform's approach A (the host is an engine world, `octoverse`, with platform HTML around it), so every item stands. A2 is approved by the owner once, separately from A1, which is final. The E02 plan carries the E02 part as a clearly marked conditional Task 8b, so extraction builds the host options once if A2 is approved and skips them if not.

| Gap | Need | Decision |
|---|---|---|
| P1 | Headless host UI: no engine title, nameplate, overview panel or skip; children read the instance | **Accepted, E02 (Task 8b).** `WorldHost` option `ui: 'engine' \| 'none'` (default `'engine'`, today's behaviour). `useInstanceApi()` returns `{ stage, faceAnchor, liveShift(world), explore(), back(), skip() }` from the instance context; the engine's own UI components use the same dispatchers. |
| P2 | An overview without the swell, dome, panel or head effect, for the host's How It Works pose | **No new flag: already data.** The swell opens from `poses.overview.headMorph >= 0.5`. A bundle whose overview pose has `headMorph: 0` never swells, and with `ui: 'none'` there is no panel. E02 adds a test that proves it (Task 8b). |
| P3 | Preview options as props: stage, tier cap, motion still or ambient, place full or backdrop, artifacts settled or hidden; no entrance or appear in a preview | **Accepted, E02 (Task 8b), by mapping to what exists.** `PreviewOptions = { stage: 'intro' \| 'overview' \| 'detail'; tierCap?: QualityTier; motion: 'still' \| 'ambient'; place: 'full' \| 'backdrop'; artifacts: 'settled' \| 'hidden' }`. `stage` and `motion: 'still'` map to `ReviewOptions.stage` and `freeze`; `tierCap` is the one new piece (the tier is `min(probed, cap)`); `place: 'backdrop'` is the world's lowest level (the water, fog and light with no kit, the `LAST_LEVEL` step that `worldLevel` already has, which Veyra's and Aether's first milestones use); `artifacts: 'settled'` passes no blow sheet, so the bubbles are simply there as the existing no-sheet path does, and `'hidden'` shows none. A preview never starts the entrance (it opens on its `stage`) and never plays an appear. |
| P4 | Runtime bundles: `assembleBundle`, `validateBundle` outside `WORLDS`; one Theatre project per template; creator ids `u-<handle>` | **Split.** E02 (Task 8): `validateBundle` already runs on any bundle, and `WorldId` is validated as `^[a-z][a-z0-9-]{1,31}$` with the `u-` prefix reserved for creator bundles. The Theatre project is already keyed by `sequences.projectId`, not the bundle id, and the entrance-seen key by the bundle id (8.2), so a creator bundle reuses its template's `projectId` and thousands of creators make one project. `assembleBundle(template, presets, content)` is creator tooling and is built in J01, not E02. |
| P5 | History sync: `initialStage`, `onStageChange`, a stage request | **Accepted, E02 (Task 8b).** A page instance takes `initialStage: 'intro' \| 'overview' \| 'detail'` (never `entering` or `techFocus` from a link), calls `onStageChange(stage)` after each change, and accepts a `stageRequest` prop that the reducer handles as a `CLOSE` or `OPEN_*` event. Escape and the engine's own close keep working. |
| P6 | Palette slots: a partial colour override clamped by `clampCharacterConfig` | **Built in J01, not E02.** `applyPalette(config, override)` is a pure function over `clampCharacterConfig`; the engine's duty is the hue rule (A1: no hue literal in engine sources, which Task 4's test and the boundary test enforce). The per-template list of settable fields is the template's data. |
| P7 | An exit slot `exit?: { label, href }`, first in tab order, drawn by the engine UI | **Accepted, E02 (Task 8b).** One engine component, themed from `bundle.theme`, rendered first in the instance's DOM order; absent by default. |
| P8 | `attend(target, { reach })`: the host looks at a hovered or keyboard-focused HTML card and the nearest arm reaches toward it | **Accepted, E02 (Task 8b), reusing Nox's attention and reach code.** `useInstanceApi().attend(target: { x: number; y: number } \| null, opts?: { reach?: boolean })`, with `target` in canvas CSS pixels and `null` releasing it. The target is converted to the instance's normalised device coordinates and to the stage plane (z = 0), then stands in for the pointer: it is the `fixed` point `Attention.update` already takes for a focused orb (eyes and head follow it, keyboard focus included), and with `reach: true` the arm whose tip is nearest it reaches, through the existing reach weights. Two small changes to existing code: `reachingArm(tips, target, head, range = REACH_RANGE)` takes the range (`Infinity` for `attend`, since a card is far from any tip; the rule that no arm folds into the face stays), and `reachesForPointer` is bypassed by an explicit `reach: true`, since the host's overview is not the intro stage (the bubble-hot, swim and review-drive gates stay). With no `attend`, behaviour is today's. |

Platform rules (not gaps, recorded here): at most two live WebGL contexts at once (the page instance plus one preview; other cards are stills captured from the engine); one project per world visit; a world switch stays a full remount (8.3).

### 19.1 Flux's plan gaps (part of A2; none changes E02)

Flux's plan (`flux-design`, `44c2b1b`) found three small gaps. They sit in A2 so the owner approves once. All three are built in Veyra's and Flux's own work; E02 is untouched.

| Gap | Need | Decision |
|---|---|---|
| X1 | Idle cup pulses come from the flourish layer | **Accepted.** The flourish layer (Veyra's Task 16, `engine/behavior/flourish.ts`) emits each flourish as an event on the instance (`instance.flourish.subscribe(cb: (arm: ArmId) => void)`; with no subscriber, nothing changes). Flux's own work adds `Personality.flourishPulse` (0 to 1, the share of flourish events that also fire a cup pulse; 0 is none, so every other world is unchanged) and subscribes the pulse trigger (F1) to it. The setting is Flux's, not Veyra's. |
| X2 | The orb swing limits as data (Flux 18 degrees and 0.8 s; Veyra 25 degrees and 1.2 s) | **Accepted, built in Veyra's Task 13.** `pendant.swing?: { maxAngle: number; settle: number }`, defaulting to Veyra's 25 degrees and 1.2 s (radians and seconds in data). `pendantSwing` takes the limits as an argument and its tests cover both pairs. |
| X3 | A per-slot swell stagger for orbs growing from size 0 | **Accepted, the field in Veyra's Task 13 and the reader in Veyra's Task 19.** `pendant.reveal?: { start: number; span: number; step: number }` (seconds: first slot's start, each orb's grow time, and the delay between slots in `order`). Absent means what Veyra's `bloom` does when it is first built, so the default is Veyra's behaviour. The `bloom` and Flux's `pulse` appear modules both read it. |
