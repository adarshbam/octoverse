import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, posix } from 'node:path';
import { expect, test } from 'vitest';

// The engine's boundary (spec sections 6.1 and 13.3), checked on the source text:
//   1. src/engine/** imports nothing from src/worlds/**;
//   2. a world (src/worlds/<id>/**) imports nothing from another world;
//   3. no engine source holds a hue literal outside the logo allow-list, except the files named in
//      KNOWN_HUE_DEBT below, whose count of literals is pinned: a new literal fails here, and so
//      does paying one off without lowering the pinned count (a ratchet, not a free pass).

const SRC = join(import.meta.dirname, '..');
const ENGINE = join(SRC, 'engine');
const WORLDS = join(SRC, 'worlds');

const slash = (path: string) => path.split(String.fromCharCode(92)).join('/');
/** Every file under `dir` (posix paths relative to `dir`). */
const walk = (dir: string): string[] => (existsSync(dir) ? (readdirSync(dir, { recursive: true }) as string[]).map(slash).filter(f => /\.[a-z]+$/.test(f)) : []);

const isCode = (file: string) => /\.(ts|tsx)$/.test(file);
const isTest = (file: string) => /\.test\.tsx?$/.test(file);
/** Test support (dummy worlds and characters for the variant tests): never imported by production code. */
const isFixture = (file: string) => /(^|\/)fixtures\//.test(file);

const engineFiles = walk(ENGINE);
const engineCode = engineFiles.filter(isCode);
const read = (root: string, file: string) => readFileSync(join(root, file), 'utf8');

/** The module specifiers a source names: `from '...'`, `import('...')`, `import '...'`. */
function specifiers(code: string): string[] {
  const out: string[] = [];
  const pattern = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(['"])([^'"\n]+)\1/g;
  for (let m = pattern.exec(code); m; m = pattern.exec(code)) out.push(m[2]);
  return out;
}

/** Where a specifier in `file` (relative to `root`) lands, relative to src/; null for a package. */
function landing(root: string, file: string, specifier: string): string | null {
  const base = posix.relative(slash(SRC), slash(root));
  if (specifier.startsWith('/src/')) return specifier.slice('/src/'.length);
  if (!specifier.startsWith('.')) return null;
  return posix.normalize(posix.join(base, posix.dirname(file), specifier));
}

/** The source with its comments taken out, strings kept (a hue hides in a string, not in a note). */
function withoutComments(source: string, css: boolean): string {
  if (css) return source.replace(/\/\*[\s\S]*?\*\//g, '');
  let out = '';
  let quote: string | null = null;
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    const next = source[i + 1];
    if (quote) {
      out += c;
      if (c === String.fromCharCode(92)) {
        out += next ?? '';
        i++;
      } else if (c === quote || (c === '\n' && quote !== '`')) quote = null;
      continue;
    }
    if (c === '/' && next === '/') {
      while (i < source.length && source[i] !== '\n') i++;
      i--;
      continue;
    }
    if (c === '/' && next === '*') {
      i += 2;
      while (i < source.length && !(source[i] === '*' && source[i + 1] === '/')) {
        if (source[i] === '\n') out += '\n';
        i++;
      }
      i++;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') quote = c;
    out += c;
  }
  return out;
}

/**
 * Every spelling of a colour a source could hold: #rrggbb, #rrggbbaa, rgb( and rgba( with a number
 * in them, hsl( and hsla( likewise, and 0xRRGGBB. (`rgba(${r}` built from variables is a formatter,
 * not a hue; `rgba(palette.x, a)` is a call, not a literal; a short `#000` is black, as the
 * character hue test has always let through.)
 */
const HUE = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6})\b|\b(?:rgba?|hsla?)\(\s*\d|\b0x[0-9a-fA-F]{6}\b/g;
const hueCount = (file: string) => (withoutComments(read(ENGINE, file), file.endsWith('.css')).match(HUE) ?? []).length;

/** The technologies' own marks: brand colours, not a world's. */
const LOGO_ALLOW_LIST = ['artifacts/logoTexture.ts'];

/**
 * The hue literals still in engine sources after the extraction (Task 9), file by file, with how
 * many each holds. Each is artwork, a tint, or a world value the bundle does not carry yet; none
 * is new. The count is exact: more fails the test (a new hue in the engine), fewer fails it too
 * (lower the number, or delete the entry once the file is clean).
 */
const KNOWN_HUE_DEBT: Record<string, { count: number; why: string }> = {
  // World values in the engine's world sources (Nox's colours, to move into place data with F01's per-world look).
  'world/Water.tsx': { count: 8, why: "Nox's water shader colours (deep, zenith, glow, ray and surface tints); the place palette carries only waterFar" },
  'world/particleMaterials.ts': { count: 7, why: "Nox's ember, mote and spark colours" },
  'world/textures.ts': { count: 14, why: "Nox's baked textures: the pillar's red glyphs, the sky gradient, the floor patch" },
  'world/Kit.tsx': { count: 5, why: "Nox's kit materials (rock, iron, coral) and a white glyph multiplier" },
  // Defaults for a legacy config that sets none (spec 13.3): they reproduce Nox, by design.
  'config/validate.ts': { count: 6, why: 'the defaults a config without glow fields reads (Nox’s), spec 13.3' },
  'config/lighting.ts': { count: 5, why: "INTRO_LIGHTING: Nox's stage lighting, the default for a config without `lighting`" },
  // Artwork and tints inside the shared HTML layer.
  'ui/Flame.tsx': { count: 2, why: "the title flame's gradient stops (artwork)" },
  'ui/ProjectDetail.tsx': { count: 1, why: 'the detail panel shield glyph’s glow fill (artwork)' },
  'ui/detail.css': { count: 42, why: "Nox's panel colours as CSS fallbacks beside the theme variables" },
  'ui/exit.css': { count: 5, why: "Nox's exit link colours as CSS fallbacks" },
  'ui/intro.css': { count: 11, why: "Nox's intro title and gradient stops as CSS fallbacks" },
  'ui/overview.css': { count: 23, why: "Nox's overview panel colours as CSS fallbacks" },
  'ui/poster.css': { count: 1, why: 'the no-WebGL poster’s background' },
  'ui/skip.css': { count: 9, why: "Nox's skip-control colours as CSS fallbacks" },
  'ui/tooltip.css': { count: 10, why: "Nox's tooltip colours as CSS fallbacks" },
  // Black as a mask, not a hue.
  'host/WorldHost.tsx': { count: 1, why: "the `?mask` silhouette's black background" },
};

test('the scan sees the engine (not a vacuous pass)', () => {
  expect(engineCode).toContain('behavior/stageMachine.ts');
  expect(engineCode).toContain('host/WorldHost.tsx');
  expect(engineCode).toContain('character/Octopus.tsx');
  expect(engineCode.filter(f => !isTest(f)).length).toBeGreaterThan(100);
});

test('the engine imports nothing from src/worlds', () => {
  const hits: string[] = [];
  for (const file of engineCode) {
    // The tests use Nox as their reference world (its character, poses and place are the fixtures
    // they were written against); every other source, and every other world, is out of bounds.
    const allowed = isTest(file) ? ['worlds/nox/'] : [];
    for (const specifier of specifiers(withoutComments(read(ENGINE, file), false))) {
      const where = landing(ENGINE, file, specifier);
      if (where?.startsWith('worlds/') && !allowed.some(prefix => where.startsWith(prefix))) hits.push(`engine/${file} -> ${where}`);
    }
  }
  expect(hits).toEqual([]);
});

test('a world imports nothing from another world', () => {
  const ids = readdirSync(WORLDS, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name);
  expect(ids).toContain('nox');
  const hits: string[] = [];
  for (const id of ids) {
    const root = join(WORLDS, id);
    for (const file of walk(root).filter(isCode)) {
      for (const specifier of specifiers(withoutComments(read(root, file), false))) {
        const where = landing(root, file, specifier);
        if (where?.startsWith('worlds/') && !where.startsWith(`worlds/${id}/`)) hits.push(`worlds/${id}/${file} -> ${where}`);
      }
    }
  }
  expect(hits).toEqual([]);
});

test('no engine source holds a hue literal outside the logo allow-list and the known debt', () => {
  const scanned = engineFiles.filter(f => (isCode(f) || f.endsWith('.css')) && !isTest(f) && !isFixture(f) && !LOGO_ALLOW_LIST.includes(f));
  const counts: Record<string, number> = {};
  for (const file of scanned) {
    const count = hueCount(file);
    if (count > 0) counts[file] = count;
  }
  const debt = Object.fromEntries(Object.entries(KNOWN_HUE_DEBT).map(([file, { count }]) => [file, count]));
  expect(counts).toEqual(debt);
});

test('the debt list names only files that exist', () => {
  for (const file of Object.keys(KNOWN_HUE_DEBT)) expect(existsSync(join(ENGINE, file)), file).toBe(true);
  for (const file of LOGO_ALLOW_LIST) expect(existsSync(join(ENGINE, file)), file).toBe(true);
});

test('the scan finds a hue where there is one (the pattern is not dead)', () => {
  for (const sample of ["'#1a2b3c'", "'#1a2b3c4d'","'rgb(1,2,3)'", "`rgba(255, 0, 0, ${a})`", "'hsl(10 50% 50%)'", '0xff8800']) expect(sample.match(HUE), sample).not.toBeNull();
  expect("fill('#000')".match(HUE)).toBeNull();
  expect(withoutComments("// #ff0000\nconst a = 1; /* rgb(1,2,3) */", false).match(HUE)).toBeNull();
  expect(withoutComments('const c = rgba(palette.x, 0.5); const d = `rgba(${r}, ${g}, ${b}, ${a})`;', false).match(HUE)).toBeNull();
});
