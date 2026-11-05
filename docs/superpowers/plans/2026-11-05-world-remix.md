# World Remix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a person build a named world of their own from the pieces of all five worlds: 4 spots, one big piece each, colour per piece, small pieces filled in, Surprise me, and a finish screen.

**Architecture:** Each big piece ships as its own file with a neutral lightmap, so it reads correctly in any spot. A new engine scene draws a chosen ground plus up to four pieces from plain data (`RemixWorld`), bypassing the layout-bound `near.glb`. The creator stores that data as an optional `world` field on the draft.

**Tech Stack:** React 19, three 0.186.1, R3F 9, Vite 8, Vitest, Playwright on msedge, Blender via `blender/` scripts.

**Spec:** `docs/superpowers/specs/2026-11-05-world-remix-design.md`

## Global Constraints

- Branch: `claude/platform-overnight`. Nothing is pushed or merged without the owner's word.
- Engine changes are separate commits that touch only `src/engine/**`, so they can move across branches.
- No free placement, rotate, resize, uploads or outside models. One big piece per spot.
- Showcase worlds do not change. The Nox gate must still pass.
- Low tier, production build, at least 40 fps. One WebGL context. Remix download no bigger than 4.9 MB.
- Memory growth is not made worse: dispose every cloned material and texture on unmount.
- World name uses `NAME_RE` from `draft.ts` (1 to 24 characters).
- Exactly eight arms, T1-T8. Free tools only. No review videos: stills, numbers, and the owner's live check.
- One browser check and one dev server at a time. Kill only your own PIDs. Never reset or restore the main checkout.
- Commits end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Owner approvals are provisional. Log each gate in `docs/superpowers/MORNING-REVIEW-platform.md`.

## Review Focus

1. A saved draft names a piece or swatch no longer in the catalogue: the draft still opens and that spot is empty (test in Task 5).
2. A piece file fails or is slow: the other spots still draw, and the failed spot stays empty without breaking the canvas (test in Task 4).
3. Surprise me is pressed quickly many times: the last press wins, one canvas remains, nothing leaks (test in Task 6).
4. A swatch change: the piece recolours with no canvas remount (test in Task 4).
5. A typed world name fails `NAME_RE`, such as an emoji or only spaces: the person sees why and keeps their text (test in Task 7).

---

### Task 1: Look test (owner gate, stop here)

**Files:**
- Create: `blender/remix/bake_piece.py`, `blender/remix/bake_ground.py`
- Create: `public/remix/pieces/flux-tower.glb`, `public/remix/pieces/nox-pillar.glb`, `public/remix/grounds/nox.glb`
- Create: `src/engine/world/remix/tint.ts`, `src/engine/world/remix/LookTest.tsx`
- Test: `src/engine/world/remix/tint.test.ts`

**Interfaces:**
- Produces: `tintPiece(object: THREE.Object3D, swatch: { tint: string; glow: string }): () => void`. It clones materials, applies the tint, gives emissive parts the glow colour, and returns a dispose function.
- Produces: bake output format, one GLB per piece with geometry, lightmap on uv1, and a `remix_bake` extras record.

- [ ] **Step 1: Write `bake_piece.py`.** Reuse `blender/security/bake_world.py` and `build_kit.py`. Bake one piece alone under a soft neutral sea light, with no neighbours.
- [ ] **Step 2: Write `bake_ground.py`.** Bake the Nox seabed with no pieces on it, so no old shadows remain. Keep the lava from `Floor.tsx` and `floorGlow.ts`.
- [ ] **Step 3: Write the failing test.**

```ts
it('tints without touching the source material, and disposes its clones', () => {
  const dispose = tintPiece(mesh, { tint: '#ff8844', glow: '#ffcc99' });
  expect(mesh.material).not.toBe(source);
  expect(source.color.getHexString()).toBe(before);
  dispose();
  expect(disposed).toBe(true);
});
```

- [ ] **Step 4: Run `npx vitest run src/engine/world/remix/tint.test.ts`.** Expected: FAIL, `tintPiece` not defined.
- [ ] **Step 5: Implement `tintPiece` and `LookTest.tsx`.** Add a dev-only `?world=remix-look`: the Nox ground, the octopus, the Flux tower left, the Nox pillar right, each with a soft shadow disc, in two swatches.
- [ ] **Step 6: Run the test.** Expected: PASS.
- [ ] **Step 7: Capture stills beside a Nox showcase still and log frame rate.** Save to `docs/superpowers/evidence/platform/remix/`, and add the morning review entry.
- [ ] **Step 8: Commit, then STOP.** Tell the owner the live URL. Do not start Task 3 until the owner says yes. If they say no, return to the lighting approaches in the spec. Task 2 may proceed meanwhile.

### Task 2: Catalogue, spots and clearance

**Files:**
- Create: `src/engine/world/remix/types.ts`, `src/engine/world/remix/catalog.ts`
- Test: `src/engine/world/remix/catalog.test.ts`

**Interfaces:**
- Produces in `types.ts`:

```ts
export type SpotId = 'left' | 'right' | 'centre' | 'back';
export type GroundId = 'aether' | 'flux' | 'nox' | 'octoverse' | 'veyra';
export type FillLevel = 'less' | 'some' | 'more';
export interface RemixSpot { piece: string; swatch: string }
export interface RemixWorld { ground: GroundId; spots: Record<SpotId, RemixSpot | null>; fill: FillLevel; seed: number }
export interface RemixPiece { id: string; world: GroundId; label: string; file: string; spots: readonly SpotId[]; radius: number; height: number }
```

- Produces in `catalog.ts`: `REMIX_PIECES`, `REMIX_SPOTS: Record<SpotId, { x: number; z: number; maxHeight: number }>`, `REMIX_SWATCHES: readonly { id: string; label: string; tint: string; glow: string }[]`, `REMIX_ARM_CLEAR_RADIUS`.

- [ ] **Step 1: Write the failing tests.**

```ts
it('keeps every recommended spot clear of the arms', () => {
  for (const p of REMIX_PIECES) for (const id of p.spots) {
    const s = REMIX_SPOTS[id];
    expect(Math.hypot(s.x, s.z) - p.radius).toBeGreaterThan(REMIX_ARM_CLEAR_RADIUS);
    expect(p.height).toBeLessThanOrEqual(s.maxHeight);
  }
});
it('gives every piece at least 2 recommended spots', () => {
  for (const p of REMIX_PIECES) expect(p.spots.length).toBeGreaterThanOrEqual(2);
});
it('puts back furthest and tallest, with centre behind the octopus', () => {
  const dist = (id: SpotId) => Math.hypot(REMIX_SPOTS[id].x, REMIX_SPOTS[id].z);
  expect(dist('back')).toBeGreaterThan(dist('centre'));
  expect(REMIX_SPOTS.back.maxHeight).toBeGreaterThan(REMIX_SPOTS.centre.maxHeight);
});
it('offers 8 swatches', () => expect(REMIX_SWATCHES).toHaveLength(8));
```

- [ ] **Step 2: Run `npx vitest run src/engine/world/remix/catalog.test.ts`.** Expected: FAIL, module missing.
- [ ] **Step 3: Implement.** `REMIX_ARM_CLEAR_RADIUS` is the widest open arm half span across all templates, at least `HOST_ARM_HALF_SPAN.open` (3.0), plus 0.3. Measure from the octopus's stage position. Big pieces come from the layouts' portal, gate, towers, bridge, pillars and walls groups, one entry per distinct mesh, expected at 20-25. A pair that fails the test loses that spot; never widen the rule to pass.
- [ ] **Step 4: Run the tests.** Expected: PASS.
- [ ] **Step 5: Commit.**

### Task 3: Bake every piece and ground

Blocked until the owner says yes to Task 1.

**Files:**
- Create: `public/remix/pieces/<id>.glb` for each catalogue entry, `public/remix/grounds/<ground>.glb` for all five grounds
- Create: `blender/remix/bake_all.py`
- Test: `src/engine/world/remix/assets.test.ts`

**Interfaces:**
- Consumes: Task 1 scripts, Task 2 `REMIX_PIECES`.

- [ ] **Step 1: Write the failing test.** Every `REMIX_PIECES` file and all five grounds exist on disk. The ground plus the four largest pieces total at most 4.9 MB.
- [ ] **Step 2: Run `npx vitest run src/engine/world/remix/assets.test.ts`.** Expected: FAIL, files missing.
- [ ] **Step 3: Write and run `bake_all.py`.** Commit in small batches, one world at a time.
- [ ] **Step 4: Run the test.** Expected: PASS.
- [ ] **Step 5: Save one contact sheet of all pieces to the evidence folder, and commit.**

### Task 4: Engine remix scene

**Files:**
- Create: `src/engine/world/remix/RemixScene.tsx`, `src/engine/world/remix/fill.ts`
- Modify: `src/engine/host/options.ts:20,36` and the host path that mounts `WorldScene`
- Test: `src/engine/world/remix/fill.test.ts`, `src/engine/world/remix/RemixScene.test.tsx`

**Interfaces:**
- Consumes: `tintPiece`, `RemixWorld`, catalogue.
- Produces: `PreviewOptions.place: 'full' | 'backdrop' | 'remix'` and `PreviewOptions.remix?: RemixWorld`.
- Produces: `fillPieces(world: RemixWorld): { kit: GroundId; mesh: string; x: number; z: number; yaw: number; scale: number }[]`, seeded and pure.

- [ ] **Step 1: Write the failing tests.**

```ts
it('fills the same way for the same seed', () => expect(fillPieces(w)).toEqual(fillPieces(w)));
it('more fills more than less', () => {
  expect(fillPieces({ ...w, fill: 'more' }).length).toBeGreaterThan(fillPieces({ ...w, fill: 'less' }).length);
});
it('keeps small pieces out of the arm radius', () => {
  for (const s of fillPieces(w)) expect(Math.hypot(s.x, s.z)).toBeGreaterThan(REMIX_ARM_CLEAR_RADIUS);
});
it('still draws the other spots when one piece fails to load', async () => { /* left rejects, right resolves: right is in the scene, no throw */ });
it('recolours in place when a swatch changes', async () => { /* same canvas element and same mesh before and after */ });
it('disposes its clones on unmount', async () => { /* renderer.info geometries and textures return to the starting count */ });
```

- [ ] **Step 2: Run `npx vitest run src/engine/world/remix`.** Expected: FAIL.
- [ ] **Step 3: Implement.** `RemixScene` draws the ground's baked file with that world's water, fog and far plate, then pieces at `REMIX_SPOTS`, a soft shadow disc under each, and fill pieces in the ground's colours. Load each piece lazily behind its own error boundary.
- [ ] **Step 4: Run the tests, then the Nox gate.** Expected: PASS, gate unchanged.
- [ ] **Step 5: Commit, engine files only.**

### Task 5: Draft, validation and handoff

**Files:**
- Modify: `src/platform/creator/draft.ts`, `src/platform/creator/draftEdits.ts`, `src/platform/creator/draftToContent.ts`, `src/platform/creator/CreatorPreview.tsx`
- Test: `src/platform/creator/draft.test.ts`, `src/platform/creator/assembleBundle.test.ts`

**Interfaces:**
- Consumes: `RemixWorld`.
- Produces: `interface DraftWorld extends RemixWorld { name: string }`, and an optional `world?: DraftWorld` on the draft. Issue keys are `world.name`, `world.ground`, `world.fill`.

- [ ] **Step 1: Write the failing tests.**

```ts
it('keeps an old draft with no world valid', () => { expect(issues(oldDraft)).toEqual([]); });
it('empties a spot whose piece is gone, and keeps the rest', () => {
  expect(load(withPiece('left', 'gone')).world?.spots.left).toBeNull();
  expect(load(withPiece('left', 'gone')).world?.spots.right).toEqual(right);
});
it('empties a spot whose swatch is gone', () => { expect(load(withSwatch('left', 'gone')).world?.spots.left).toBeNull(); });
it('flags a world name outside NAME_RE', () => { expect(keys(issues(named('🌊')))).toContain('world.name'); });
it('shows the remix wherever a draft with a world shows', () => { expect(previewOptions(draftWithWorld).place).toBe('remix'); });
```

- [ ] **Step 2: Run `npx vitest run src/platform/creator`.** Expected: FAIL.
- [ ] **Step 3: Implement.** With no `world`, every path stays as it is today.
- [ ] **Step 4: Run the tests.** Expected: PASS.
- [ ] **Step 5: Commit.**

### Task 6: World tab and Surprise me

**Files:**
- Create: `src/platform/creator/WorldPanel.tsx`, `src/platform/creator/worldRemix.ts`
- Modify: `src/platform/creator/CreatorPage.tsx:80`
- Test: `src/platform/creator/worldRemix.test.ts`, `src/platform/creator/worldPanel.test.tsx`, and a new spec beside the creator e2e spec

**Interfaces:**
- Consumes: catalogue, `DraftWorld`.
- Produces: `surpriseWorld(seed: number): RemixWorld`, `recommendedSpots(pieceId: string): readonly SpotId[]`.

- [ ] **Step 1: Write the failing tests.**

```ts
it('repeats for a seed and differs across seeds', () => {
  expect(surpriseWorld(7)).toEqual(surpriseWorld(7));
  expect(surpriseWorld(7)).not.toEqual(surpriseWorld(8));
});
it('only uses recommended spots', () => {
  for (let s = 0; s < 200; s++) for (const [id, spot] of Object.entries(surpriseWorld(s).spots)) {
    if (spot) expect(recommendedSpots(spot.piece)).toContain(id);
  }
});
it('offers only the spots that suit the chosen piece', () => { /* render, pick a piece, unsuitable spots are disabled */ });
it('lets every control work by keyboard', () => { /* ground, piece, spot, swatch, fill, Surprise me are native controls */ });
it('lets the last Surprise me press win, with one canvas', async () => { /* e2e: 10 quick presses, one canvas, shown world equals the last seed */ });
```

- [ ] **Step 2: Run `npx vitest run src/platform/creator`.** Expected: FAIL.
- [ ] **Step 3: Implement.** Add `{ id: 'world', label: 'World', panel: <WorldPanel ... /> }` beside Octopus and Projects. Controls: ground, per-spot piece and swatch, an empty option per spot, a Less/Some/More control, Surprise me. Choosing a piece highlights its recommended spots in the panel and in the preview.
- [ ] **Step 4: Run the tests and the new e2e spec alone.** Expected: PASS.
- [ ] **Step 5: Commit.**

### Task 7: Finish screen and names

**Files:**
- Create: `src/platform/creator/CreatorFinishPage.tsx`, `src/platform/creator/worldNames.ts`
- Modify: the platform route table (`/create/finish`), `src/platform/creator/CreatorPage.tsx:34` so the primary action leads there when the draft has a world
- Test: `src/platform/creator/worldNames.test.ts`, `src/platform/creator/creatorFinish.test.tsx`

**Interfaces:**
- Consumes: `DraftWorld`, `NAME_RE`.
- Produces: `suggestWorldName(world: RemixWorld, roll: number): string`, `suggestOctopusName(roll: number): string`, `builtFromLine(world: RemixWorld): string`.

- [ ] **Step 1: Write the failing tests.**

```ts
it('always suggests a valid name, and repeats for a roll', () => {
  for (let r = 0; r < 500; r++) expect(suggestWorldName(w, r)).toMatch(NAME_RE);
  expect(suggestWorldName(w, 3)).toBe(suggestWorldName(w, 3));
});
it('names from colour and the biggest piece', () => { /* an amber spire world yields a name holding Amber and Spire */ });
it('credits each source world once, ground included', () => {
  expect(builtFromLine(fluxNoxVeyra)).toBe('Built from Flux, Nox and Veyra');
});
it('prefills the world name and does not re-ask the octopus name', () => { /* box filled; octopus field shows the saved name */ });
it('suggests an octopus name only when blank', () => { /* blank draft gets a suggestion; named draft keeps its name */ });
it('explains a bad name and keeps the typed text', () => { /* type an emoji: message shows, text stays, See my world is blocked */ });
it('keeps the draft when Back is used', () => { /* edits survive a return to the World tab */ });
```

- [ ] **Step 2: Run `npx vitest run src/platform/creator`.** Expected: FAIL.
- [ ] **Step 3: Implement.** The live world stays on screen in the same canvas pattern as the preview. The dice button re-rolls the suggestion. "See my world" saves and goes to the preview. Publishing stays unavailable.
- [ ] **Step 4: Run the tests.** Expected: PASS.
- [ ] **Step 5: Commit.**

### Task 8: Entrances and final pass

**Files:**
- Modify: the sequence files that rely on a named piece, found in Step 1
- Test: a new spec beside the creator e2e spec, `src/worlds/remixEntrance.test.ts`

- [ ] **Step 1: List every sequence that reads a portal or gate.** Start from `src/worlds/{aether,octoverse,veyra}/sequences`.
- [ ] **Step 2: Write the failing test.** Each octopus template's entrance runs to its end in a remix world with all spots empty, with no error and no missing object.
- [ ] **Step 3: Run `npx vitest run src/worlds/remixEntrance.test.ts`.** Expected: FAIL for sequences that need a piece.
- [ ] **Step 4: Add the fallback.** With no such piece, use an entrance that needs none. Showcase worlds keep their own entrance. Run the test. Expected: PASS.
- [ ] **Step 5: Run the final pass.** Keyboard, touch and responsive on the World tab and finish screen; reduced motion; no-WebGL poster; 40 fps on low tier in a production build, 2 runs; one WebGL context; heap against the platform baseline; the Nox gate; each showcase world's e2e.
- [ ] **Step 6: Log the numbers and what to check live in the morning review, and commit.**
