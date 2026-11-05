import * as simpleIcons from 'simple-icons';
import { describe, expect, it } from 'vitest';
import { aetherTechnologies } from '../../worlds/aether/content/aetherTechnologies';
import { fluxTechnologies } from '../../worlds/flux/content/fluxTechnologies';
import { noxTechnologies } from '../../worlds/nox/content/noxTechnologies';
import { veyraTechnologies } from '../../worlds/veyra/content/veyraTechnologies';
import { CATALOG, COMMON_ICON_EXPORTS, COMMON_TECHNOLOGIES } from './catalog';
import { PERSONALITIES } from './personalities';
import { TEMPLATES } from './templates';
import { PERSONALITY_IDS, type Technology } from './types';

const WORLD_LISTS: Record<string, readonly Technology[]> = { veyra: veyraTechnologies, flux: fluxTechnologies, nox: noxTechnologies, aether: aetherTechnologies };

describe('the technology catalog', () => {
  it('has unique ids and no free text: every entry is a complete technology', () => {
    const ids = CATALOG.map((tech) => tech.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const tech of CATALOG) {
      expect(tech.id, tech.id).toMatch(/^[a-z][a-z0-9-]*$/);
      expect(tech.name.trim(), tech.id).not.toBe('');
      expect(tech.category.trim(), tech.id).not.toBe('');
      expect(tech.iconKey.trim(), tech.id).not.toBe('');
    }
  });

  it("holds every world's technologies, as the world declares them", () => {
    for (const [world, list] of Object.entries(WORLD_LISTS)) {
      for (const tech of list) {
        const entry = CATALOG.find((candidate) => candidate.id === tech.id);
        expect(entry, `${world} ${tech.id}`).toBeDefined();
        // One id is one technology: the same name and the same icon in every world that declares it.
        for (const [other, otherList] of Object.entries(WORLD_LISTS)) {
          const same = otherList.find((candidate) => candidate.id === tech.id);
          if (same) expect({ name: same.name, iconKey: same.iconKey }, `${world} vs ${other}: ${tech.id}`).toEqual({ name: tech.name, iconKey: tech.iconKey });
        }
        expect(entry, `${world} ${tech.id}`).toEqual(tech);
      }
    }
  });

  it('is the worlds plus the approved common set, and nothing else', () => {
    const worldIds = new Set(Object.values(WORLD_LISTS).flatMap((list) => list.map((tech) => tech.id)));
    const commonIds = COMMON_TECHNOLOGIES.map((tech) => tech.id);
    expect(commonIds.length).toBeGreaterThanOrEqual(15);
    expect(commonIds.length).toBeLessThanOrEqual(40);
    for (const id of commonIds) expect(worldIds.has(id), `${id} duplicates a world's technology`).toBe(false);
    expect(new Set(CATALOG.map((tech) => tech.id))).toEqual(new Set([...worldIds, ...commonIds]));
    expect(CATALOG).toHaveLength(worldIds.size + commonIds.length);
  });

  it('gives every common technology an icon that resolves in simple-icons (the engine draws its marks from it)', () => {
    expect(Object.keys(COMMON_ICON_EXPORTS).sort()).toEqual(COMMON_TECHNOLOGIES.map((tech) => tech.iconKey).sort());
    const icons = simpleIcons as unknown as Record<string, { title: string; path: string; hex: string } | undefined>;
    for (const tech of COMMON_TECHNOLOGIES) {
      const icon = icons[COMMON_ICON_EXPORTS[tech.iconKey]];
      expect(icon, `${tech.id} -> ${COMMON_ICON_EXPORTS[tech.iconKey]}`).toBeDefined();
      expect(icon?.path.length, tech.id).toBeGreaterThan(8);
      expect(icon?.hex, tech.id).toMatch(/^[0-9a-fA-F]{6}$/);
    }
  });

  it('is frozen against accidental edits to the shared list', () => {
    expect(Object.isFrozen(CATALOG)).toBe(true);
  });
});

describe('personalities', () => {
  it("are the four worlds' personality blocks, read from their bundles", () => {
    expect(Object.keys(PERSONALITIES).sort()).toEqual([...PERSONALITY_IDS].sort());
    expect(PERSONALITIES.calm).toEqual(TEMPLATES.veyra.bundle.character.personality);
    expect(PERSONALITIES.energetic).toEqual(TEMPLATES.flux.bundle.character.personality);
    expect(PERSONALITIES.mysterious).toEqual(TEMPLATES.nox.bundle.character.personality);
    expect(PERSONALITIES.playful).toEqual(TEMPLATES.aether.bundle.character.personality);
  });

  it('are four different blocks (calm slower than energetic)', () => {
    const blocks = PERSONALITY_IDS.map((id) => JSON.stringify(PERSONALITIES[id]));
    expect(new Set(blocks).size).toBe(4);
    expect(PERSONALITIES.calm.breathPeriod).toBeGreaterThan(PERSONALITIES.energetic.breathPeriod);
  });
});
