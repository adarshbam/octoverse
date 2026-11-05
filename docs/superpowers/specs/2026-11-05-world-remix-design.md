# World remix design

Status: written 2026-11-05, waiting for owner approval. Nothing here is built.

This document adds to `2026-11-03-platform-3d-design.md`. It overrides that spec's non-goal at line 152 ("freehand colours", "custom worlds or kits") only as far as described here.

"Owner" marks what the owner decided. "My call" marks what I filled in, for the owner to check.

## Intent

The platform's point is lots of different, colourful worlds. Today the creator only offers whole-world templates, palettes and personalities. The remix lets a person make a world of their own by reusing the pieces of Nox, Veyra, Flux, Aether and the host reef, with no manual placement, and name it. It has to fit next week's finish.

## Goals

- Pick big pieces from all the worlds into 4 spots, one piece per spot (owner).
- The app recommends which spots suit each piece; the person taps one. No dragging (owner).
- Change the colour of each piece (owner).
- Small pieces fill in by themselves, with a Less/More control. This is the owner's "X amount of assets" (owner).
- A Surprise me button fills everything at random; pressing again gives a new world (owner).
- A finish screen where the person names the world (owner, details below).

## Non-goals

- Free placement, move handles, rotate or resize. A Roblox-style builder is a possible version 2 (owner).
- Outside model libraries or uploaded models (owner).
- More than one big piece per spot (owner).
- Changing the octopus through the remix. The creator's octopus choices stay as they are.
- Publishing. It still waits for accounts.

## Anti-goals

This fails, even if it works, when:

- A remixed world looks cheaper than the showcase worlds.
- A piece blocks the octopus's arms or face, or the camera's view of it.
- A showcase world changes or regresses. The Nox gate must still pass.

## Approaches

Lighting was the deciding build choice, because each world's light is baked for its exact layout. `bakedLight.ts` throws if near.glb was baked from another layout, so a moved piece has no light.

1. **Bake once per piece (owner's pick).** Each big piece gets its own neutral light in Blender, so it reads correctly in any spot. Tint on top, and a soft fake shadow beneath. Close to the crafted look at little frame cost. Costs a Blender pass over the pieces, and pieces cast no real shadows on each other.
2. **Bake every piece at every spot.** About 4 times the bakes and download size, and neighbours still aren't in the bake, because they aren't known in advance.
3. **Live lighting only.** Simplest build, but flatter pieces and a frame-rate cost. How It Works already runs at 38.8 fps against a floor of 36.

The owner also weighed placement size. 4 spots with colour per piece was chosen over 8-12 snap spots (roughly 6/10 difficulty) and a free builder (roughly 8/10), because it fits next week.

## The design

### Spots

- Four spots: `left`, `right`, `centre`, `back` (owner: 4, "3 would do, but 4 would be better").
- The octopus stands centre stage, so `centre` means behind it, low to medium height, and `back` means furthest away, for the tallest pieces (my call).
- One shared set of spot positions across every ground (my call). A piece can never enter the octopus's clearance: run the existing `sequences/clearance.ts` checks for every allowed piece and spot pair, for every octopus template. A failing pair is removed from that piece's recommended spots.
- Any spot may stay empty. A world with no big pieces is still valid (my call).

### Pieces

- Big pieces are the kit's towers, gates, bridges, pillars, portals and walls. Small pieces are rocks, corals, plants and rubble. The builder confirms the exact list, expected at 20-25 big pieces (my call).
- Each big piece lists its recommended spots as data, at least 2 each.
- Each piece is a separate file, loaded only when chosen, holding its geometry and neutral lightmap.

### Ground (my call: this choice is new, please check it)

The pieces need something to stand on, and the owner mentioned Nox's lava alongside other worlds' pillars. Lava is part of Nox's floor (`Floor.tsx`, `floorGlow.ts`), not a kit piece. So the person also picks a ground from the five worlds, which brings that world's floor, water and far backdrop. Each ground needs a neutral seabed bake, because today's seabed lightmap holds the shadows of the original layout.

### Colour

- Each big piece takes one swatch from a curated list of about 8, not a free colour picker, so worlds stay good-looking (my call).
- A swatch tints the piece and keeps its detail. Glowing parts take a lighter shade of the same swatch (my call).
- Small pieces follow the ground's colours.

### Surprise me

Picks the ground, pieces, spots, swatches, fill level and a seed, then suggests a name. It only uses recommended spots. The seed makes the same world replay exactly (my call).

### Where it sits

A new World tab in the creator beside Octopus and Projects (my call). Picking must work by keyboard and touch through normal controls, not only by clicking the 3D scene. The live preview shows each change.

### Finish screen (owner approved)

- The finished world stays live on screen with the octopus in it.
- One "Name your world" box, already filled with a suggestion. A dice button swaps in another. Names combine colour and biggest piece, like "Amber Spire Reef".
- The octopus name shows below, carried over from the earlier screen and editable. It gets a suggestion only if left blank. Nothing is asked twice.
- A small line credits the source worlds, like "Built from Flux, Nox and Veyra".
- Back returns to the earlier screens. "See my world" finishes.
- The world name follows the octopus name's rule: 1 to 24 characters (my call).

### Saved data

Worlds save as piece, position and colour, so a later builder can reuse them (owner). Add one optional field to the draft:

```ts
type SpotId = 'left' | 'right' | 'centre' | 'back';

type DraftWorld = {
  name: string;
  ground: 'aether' | 'flux' | 'nox' | 'octoverse' | 'veyra';
  spots: Record<SpotId, { piece: string; swatch: string } | null>;
  fill: 'less' | 'some' | 'more';
  seed: number;
};
```

With no `world` field the template's own world shows as it does today, so existing drafts stay valid. With a `world` field, the remix replaces the template's world wherever that draft shows (my call).

## Constraints

- Engine: `src/engine/host/options.ts` only knows `place: 'full' | 'backdrop'`, so the engine needs a third mode. Keep that commit separate so it can move across branches.
- Sequences: the Aether, Veyra and host sequences mention portals or gates. If an entrance relies on a named piece the remix lacks, it falls back to an entrance that needs none.
- Performance: low tier, production build, at least 40 fps (my call, matching the landing floor). One WebGL context. Download no bigger than the largest world today, about 4.9 MB (my call).
- Open memory growth (+105% over 20 round trips) is not made worse.
- Free tools only. No review videos: stills, numbers and the owner's live check.
- Exactly eight arms, T1-T8.

## Order of work

1. **Look test, first and gated.** One Flux piece beside one Nox pillar, neutral light, two swatches, on one ground. The owner judges it live. No more bakes until they say yes.
2. Bake the pieces and grounds. Fix the spots and pass every clearance check.
3. Engine mode and scene.
4. World tab, Surprise me, saved data.
5. Finish screen.
6. Final pass: keyboard, touch, reduced motion, no-WebGL poster, frame rates, showcase regression.

All owner approvals stay provisional until the owner's review.

## Left to the builder

File names, the route for the finish screen, exact spot coordinates, the swatch values, the name word lists, and how the fill level maps to piece counts.
