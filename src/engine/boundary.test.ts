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

/**
 * The module specifiers a source names: `from '...'`, `import('...')`, `import '...'`, and the file
 * references the bundler resolves without an import: `import.meta.glob('...')` / `globEager` (one
 * pattern or a list) and `new URL('...', import.meta.url)`. A glob pattern keeps its `*`: its
 * folder part is what the boundary reads.
 */
function specifiers(code: string): string[] {
  const out: string[] = [];
  const pattern = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(['"])([^'"\n]+)\1/g;
  for (let m = pattern.exec(code); m; m = pattern.exec(code)) out.push(m[2]);
  const glob = /\bimport\.meta\.glob(?:Eager)?\s*(?:<[^>(]*>)?\s*\(\s*(\[[^\]]*\]|(['"`])[^'"`\n]+\2)/g;
  for (let m = glob.exec(code); m; m = glob.exec(code)) for (const item of m[1].matchAll(/(['"`])([^'"`\n]+)\1/g)) out.push(item[2]);
  const url = /\bnew\s+URL\s*\(\s*(['"`])([^'"`\n]+)\1\s*,\s*import\.meta\.url/g;
  for (let m = url.exec(code); m; m = url.exec(code)) out.push(m[2]);
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
 * Every spelling of a colour a source could hold in a string: #rrggbb, #rrggbbaa, rgb( and rgba(
 * with a number in them, hsl( and hsla( likewise, and 0xRRGGBB. (`rgba(${r}` built from variables
 * is a formatter, not a hue; `rgba(palette.x, a)` is a call, not a literal; a short `#000` is
 * black, as the character hue test has always let through.)
 */
const HUE = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6})\b|\b(?:rgba?|hsla?)\(\s*\d|\b0x[0-9a-fA-F]{6}\b/g;

/**
 * A colour written as three numbers, the spellings HUE cannot see:
 *   - a GLSL float triple, `vec3(r, g, b)` or `vec4(r, g, b, a)` with three number literals;
 *   - a linear colour string, `color(srgb-linear r g b)` (world/colour.ts);
 *   - a CSS channel triple, `var(--oct-name, r, g, b)`: a token's fallback a stylesheet passes to rgba().
 * Each counts as a hue only when its three numbers are a colour and not grey (`isTripleHue`).
 */
const TRIPLE = /(?<!normalize\(\s*)\bvec[34]\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)\s*[,)]|\bcolor\(srgb-linear\s+([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)\s*\)|\bvar\(--oct-[a-z-]+,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)/g;

/**
 * Number triples that are not colours, named: the Rec. 709 luminance weights (a dot product that
 * measures brightness) and the hash's multipliers (Dave Hoskins' hash31, a noise function).
 */
const NOT_COLOURS: Record<string, string> = {
  '0.2126,0.7152,0.0722': 'the Rec. 709 luminance weights',
  '0.1031,0.103,0.0973': "the noise hash's multipliers",
};

/**
 * Whether three numbers, as a triple of TRIPLE spells them, are a hue: every channel in its
 * colour's range (0 to 1 for GLSL and linear light, where brightness goes in a factor; 0 to 255
 * for a CSS channel), not grey (the three not all equal: black, white and greys carry no hue), not
 * made of 0s and 1s alone in GLSL (an axis or a lattice offset, `vec3(1, 0, 0)`: a pure primary is
 * read as one too), and not one of the NOT_COLOURS. A minus sign never matches TRIPLE (a direction
 * with a negative component is not a colour), and neither does a triple handed to normalize().
 */
function isTripleHue(numbers: readonly string[], css: boolean): boolean {
  const n = numbers.map(Number);
  if (n.some(v => !Number.isFinite(v) || v < 0 || v > (css ? 255 : 1))) return false;
  if (n[0] === n[1] && n[1] === n[2]) return false;
  if (!css && n.every(v => v === 0 || v === 1)) return false;
  return !Object.hasOwn(NOT_COLOURS, n.join(','));
}

/** Every hue literal in a source text (comments already out): HUE's and the coloured triples. */
function hues(text: string): string[] {
  const found: string[] = [...(text.match(HUE) ?? [])];
  for (const m of text.matchAll(TRIPLE)) {
    const numbers = (m[1] !== undefined ? m.slice(1, 4) : m[4] !== undefined ? m.slice(4, 7) : m.slice(7, 10)) as string[];
    if (isTripleHue(numbers, m[7] !== undefined)) found.push(m[0]);
  }
  return found;
}
const hueCount = (file: string) => hues(withoutComments(read(ENGINE, file), file.endsWith('.css'))).length;

/** The technologies' own marks: brand colours, not a world's. */
const LOGO_ALLOW_LIST = ['artifacts/logoTexture.ts'];

/**
 * The hue literals still in engine sources after the extraction (Task 9) and fix wave A, file by
 * file, with how many each holds (every spelling `hues` sees, GLSL and linear triples included).
 * Each is Nox's kit art, a legacy default, artwork, or a stylesheet colour no theme token reaches
 * yet; none is new. The count is exact: more fails the test (a new hue in the engine), fewer fails
 * it too (lower the number, or delete the entry once the file is clean).
 */
const KNOWN_HUE_DEBT: Record<string, { count: number; why: string }> = {
  // Nox's kit art in the engine's world sources (Veyra's M2 kit work moves these into kit/place data).
  'world/textures.ts': { count: 10, why: "Nox's kit art: the glyph panels' recess gradient, red rune strokes and seam (canvas textures); the environment map's colours are place data" },
  'world/Kit.tsx': { count: 5, why: "Nox's kit materials: the rock, pebble, iron and coral body colours, and the glyph panels' white multiplier" },
  // Defaults for a legacy config that sets none (spec 13.3): they reproduce Nox, by design.
  'config/validate.ts': { count: 13, why: 'LEGACY: what a character config written before a field existed reads (Nox’s values, spec 13.3): the glow core and light, the orb focus, the head effect’s three colours, and the seven shader tints fix wave A moved into the palette (rim, dome front, cup highlight, orb glass)' },
  'config/lighting.ts': { count: 5, why: "INTRO_LIGHTING: Nox's stage lighting, the default for a config without `lighting`" },
  // Artwork inside the shared HTML layer (wave B / the no-WebGL poster work).
  'ui/Flame.tsx': { count: 2, why: "the title flame's gradient stops (artwork)" },
  'ui/ProjectDetail.tsx': { count: 1, why: 'the detail panel shield glyph’s glow fill (artwork)' },
  'ui/poster.css': { count: 1, why: 'the no-WebGL poster’s background (Nox’s water)' },
  // The stylesheets: N fallbacks are Nox's theme values inside var(--oct-*, ...) (a theme reaches
  // them; ui/theme.test.ts holds each equal to Nox's theme), the rest are bare near-neutral colours
  // no token reaches yet (white hairlines, violet-black panel and button fills, text greys, black
  // shadows) and the storyboard placeholder badge's amber. No bare red or pink is left (theme.test).
  'ui/detail.css': { count: 42, why: '17 theme fallbacks; 25 bare: white hairlines, violet-black fills, text greys, a black shadow, the placeholder badge (2)' },
  'ui/exit.css': { count: 5, why: '5 theme fallbacks' },
  'ui/intro.css': { count: 11, why: "7 theme fallbacks; 4 bare: the page's violet-black, two text greys, the nameplate's fill" },
  'ui/overview.css': { count: 23, why: '15 theme fallbacks; 8 bare: white hairlines, a black shadow, violet-black fills, a text grey' },
  'ui/skip.css': { count: 9, why: '6 theme fallbacks; 3 bare: the skip control’s violet-black fills and text grey' },
  'ui/tooltip.css': { count: 10, why: '5 theme fallbacks; 5 bare: the violet-black fill, two text greys, the placeholder badge (2)' },
  // Black as a mask, not a hue.
  'host/WorldHost.tsx': { count: 1, why: "the `?mask` silhouette's black background" },
};

test('the scan sees the engine (not a vacuous pass)', () => {
  expect(engineCode).toContain('behavior/stageMachine.ts');
  expect(engineCode).toContain('host/WorldHost.tsx');
  expect(engineCode).toContain('character/Octopus.tsx');
  expect(engineCode.filter(f => !isTest(f)).length).toBeGreaterThan(100);
});

test('the specifier scan sees imports, dynamic imports, import.meta.glob (one pattern or a list) and new URL(..., import.meta.url)', () => {
  const code = [
    "import a from '../a';",
    "const b = await import('../b');",
    "import '../c.css';",
    "const d = import.meta.glob('../d/*/bundle.ts');",
    "const e = import.meta.globEager<string>(['../e/*.ts', \"../f/*.json\"], { eager: true });",
    "const g = new URL('../d/x.json', import.meta.url);",
    "const h = new URL(path, import.meta.url);",
    "const i = new URL('https://example.com/x');",
  ].join('\n');
  expect(specifiers(code)).toEqual(['../a', '../b', '../c.css', '../d/*/bundle.ts', '../e/*.ts', '../f/*.json', '../d/x.json']);
  // And the boundary reads them like any import: a glob into src/worlds from the engine is a hit.
  expect(landing(ENGINE, 'host/x.ts', '../../worlds/*/bundle.ts')?.startsWith('worlds/')).toBe(true);
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
  // GLSL float triples, linear colour strings and CSS channel triples that are colours count ...
  for (const sample of ['vec3(1.0, 0.09, 0.05)', 'vec4(0.62, 0.36, 1.0, 1.0)', 'mix(rim, vec3(1.0, 0.85, 1.0), 0.3)', 'vec3(.5, .25, 1.)', "'color(srgb-linear 1 0.09 0.05)'", 'rgba(var(--oct-glow-rgb, 255, 40, 90), 0.35)']) {
    expect(hues(sample), sample).toHaveLength(1);
  }
  // ... and grey, black, white, axes, directions, out-of-range vectors and the named constants do not.
  for (const sample of [
    'vec3(1.0)', 'vec3(0.6, 0.6, 0.6)', 'vec4(0.0, 0.0, 0.0, 1.0)', 'vec3(1, 0, 0)', 'rh(i + vec3(0.0, 1.0, 1.0))', 'vec4(position, 1.0)',
    'normalize(vec3(0.45, 0.6, 0.7))', 'normalize(vec3(-0.45, 0.6, 0.7))', 'vec3(-0.5, 0.7, 0.5)', 'p * vec3(30.0, 8.0, 30.0)',
    'dot(c, vec3(0.2126, 0.7152, 0.0722))', 'fract(p * vec3(0.1031, 0.103, 0.0973))', "'color(srgb-linear 0.5 0.5 0.5)'", 'var(--oct-ink-rgb, 20, 20, 20)',
  ]) {
    expect(hues(sample), sample).toEqual([]);
  }
  expect(Object.keys(NOT_COLOURS)).toHaveLength(2);
  for (const sample of ["'#1a2b3c'", "'#1a2b3c4d'","'rgb(1,2,3)'", "`rgba(255, 0, 0, ${a})`", "'hsl(10 50% 50%)'", '0xff8800']) expect(sample.match(HUE), sample).not.toBeNull();
  expect("fill('#000')".match(HUE)).toBeNull();
  expect(withoutComments("// #ff0000\nconst a = 1; /* rgb(1,2,3) */", false).match(HUE)).toBeNull();
  expect(withoutComments('const c = rgba(palette.x, 0.5); const d = `rgba(${r}, ${g}, ${b}, ${a})`;', false).match(HUE)).toBeNull();
});

// ---------------------------------------------------------------------------------------------
// The platform (src/platform/**, platform spec 7.8 and plan Task 8): it imports only the engine's
// contract exports, world bundles (read-only) and its own files, and never edits src/engine or
// another world's folder (this test reads imports; it cannot see an edit). Specifically:
//   - nothing under src/worlds/<id>/ is reached except the host's own folder (src/worlds/octoverse/**),
//     the registry (src/worlds/index) and the four showcase worlds' content modules
//     (src/worlds/<id>/content/<id>.ts: a bare data file, for the epithets; never a world's bundle,
//     so the landing's chunk holds no other world's kit or Theatre state) and, for the showcase
//     fixtures, that world's <id>Project.ts and <id>Technologies.ts (more bare data files);
//   - engine imports are an explicit allowlist (below): a new deep engine import fails here.
// ---------------------------------------------------------------------------------------------

const PLATFORM = join(SRC, 'platform');
const platformFiles = walk(PLATFORM).filter(isCode).filter(f => !isFixture(f));

/**
 * The engine modules the platform imports today. Known debt: the engine has no barrel (no single
 * public entry), so the platform reaches for the module that holds each contract export; a gap goes
 * to the engine owner, and a new entry here needs that conversation first.
 */
const PLATFORM_ENGINE_ALLOWED = [
  'engine/behavior/stageMachine', // LinkStage (the host's initialStage and stageRequest)
  'engine/behavior/urlState', // parseUrlState (the review switches the landing passes through)
  'engine/host/WorldHost', // the host itself (the landing's page instance)
  'engine/host/useInstanceApi', // the instance API and its context
  'engine/stage/framing', // StageFrame, layoutFor
  'engine/types/bundle', // WorldBundle, faceAnchor, FaceStage
  'engine/world/types', // Vec3
  'engine/ui/useStageBox', // stageBoxFor: landing.test.tsx cross-checks the platform's own projection against it
  'engine/config/validate', // clampCharacterConfig: the creator's applyPalette is a pure function over it (contract amendment A2, P6; platform Task 17)
];

/**
 * The one platform file allowed to import a world's bundle, and only dynamically (platform Task 14, spec 2.4): each world's bundle,
 * kit and Theatre state load as their own chunk when its route is entered. Read from `file` (relative to src/platform); this test
 * cannot tell a dynamic import from a static one, so src/platform/worlds/loadWorld.test.ts and the payload test hold that half.
 */
const WORLD_LOADER_FILE = 'worlds/loadWorld.ts';

/**
 * The creator templates (platform Task 17, spec 7.13): `creator/templates/<id>.ts` imports its OWN world's bundle, read-only, and no
 * other. They sit in the lazy creator chunk, never in the landing's (src/platform/shell/payload.test.ts holds that half).
 */
const TEMPLATE_FILE = /^creator\/templates\/(nox|veyra|flux|aether)\.ts$/;

/** Where a platform import is out of bounds, or null when it is allowed. `where` is relative to src/, without an extension; `file` is the importing file, relative to src/platform. */
function platformViolation(where: string, file = ''): string | null {
  const bare = where.replace(/\.(tsx?|css|json)$/, '');
  // TEST-ONLY allowlist entry: the world loader may import each showcase world's bundle (and nothing else of a world's).
  if (file === WORLD_LOADER_FILE && /^worlds\/(nox|veyra|flux|aether)\/bundle$/.test(bare)) return null;
  // TEST-ONLY allowlist entry: a creator template may import its own world's bundle (and nothing else of a world's).
  const template = TEMPLATE_FILE.exec(file);
  if (template && bare === `worlds/${template[1]}/bundle`) return null;
  if (bare.startsWith('engine/')) return PLATFORM_ENGINE_ALLOWED.includes(bare) ? null : 'an engine module outside the allowlist';
  if (bare.startsWith('worlds/')) {
    if (bare === 'worlds/index' || bare.startsWith('worlds/octoverse/')) return null;
    if (/^worlds\/(nox|veyra|flux|aether)\/content\/(nox|veyra|flux|aether)$/.test(bare) && bare.split('/')[1] === bare.split('/')[3]) return null;
    // Platform Task 9 (showcase fixtures): the same world's own project and technology lists, also bare data modules (they import
    // only their sibling content and engine types, never a bundle or a kit). The pages need the project id (the route slug), its
    // screenshot and the technologies in declared order, and the content module (<id>.ts) holds none of them.
    if (/^worlds\/(nox|veyra|flux|aether)\/content\/(nox|veyra|flux|aether)(Project|Technologies)$/.test(bare) && bare.split('/')[1] === bare.split('/')[3].replace(/(Project|Technologies)$/, '')) return null;
    return "a world's folder other than the host's, the registry or a content module";
  }
  return null;
}

test('the platform scan sees the platform (not a vacuous pass)', () => {
  expect(platformFiles).toContain('App.tsx');
  expect(platformFiles).toContain('pages/HowItWorks.tsx');
  expect(platformFiles).toContain('router/routes.ts');
});

test('the platform imports only allowed engine modules and worlds', () => {
  const hits: string[] = [];
  for (const file of platformFiles) {
    for (const specifier of specifiers(withoutComments(read(PLATFORM, file), false))) {
      const where = landing(PLATFORM, file, specifier);
      const why = where === null ? null : platformViolation(where, file);
      if (why) hits.push(`platform/${file} -> ${where}: ${why}`);
    }
  }
  expect(hits).toEqual([]);
});

test('the platform rule fails on a deep engine import, a world bundle, multi-line, bare and dynamic imports', () => {
  const at = (code: string, file = 'pages/x.tsx') => specifiers(code).map(s => landing(PLATFORM, file, s)).filter((w): w is string => w !== null).map(where => platformViolation(where, file));
  expect(at("import { a } from '../../engine/character/Octopus';")).toEqual(['an engine module outside the allowlist']);
  expect(at("import {\n  a,\n  b,\n} from '../../engine/host/EngineInstance';")).toEqual(['an engine module outside the allowlist']);
  expect(at("import '../../engine/ui/intro.css';")).toEqual(['an engine module outside the allowlist']);
  expect(at("const m = await import('../../engine/sequences/theatre');")).toEqual(['an engine module outside the allowlist']);
  expect(at("import { NOX_BUNDLE } from '../../worlds/nox/bundle';")).toHaveLength(1);
  expect(at("const m = import('../../worlds/veyra/bundle');")).toHaveLength(1);
  expect(at("import { nox } from '../../worlds/nox/content/noxPlaceholders';")).toHaveLength(1);
  expect(at("import { nox } from '../../worlds/nox/content/placeholders';")).toHaveLength(1);
  expect(at("import { nox } from '../../worlds/veyra/content/noxProject';")).toHaveLength(1);
  expect(at("import { nox } from '../../worlds/nox/content/veyraTechnologies';")).toHaveLength(1);
  expect(at("import { nox } from '../../worlds/veyra/content/nox';")).toHaveLength(1);
  // The world loader (one file) may import the four bundles, and nothing else of a world's, an engine module outside the list, or another world's bundle by a wrong id.
  const loader = (code: string) => at(code, WORLD_LOADER_FILE);
  expect(loader("const m = import('../../worlds/nox/bundle');\nconst v = import('../../worlds/veyra/bundle');\nconst f = import('../../worlds/flux/bundle');\nconst a = import('../../worlds/aether/bundle');")).toEqual([null, null, null, null]);
  expect(loader("const m = import('../../worlds/nox/place/config');")).toHaveLength(1);
  expect(loader("const m = import('../../worlds/octoverse/../nox/character');")).toHaveLength(1);
  expect(loader("const m = import('../../worlds/nox/bundle.test');")).toHaveLength(1);
  expect(loader("import { x } from '../../engine/character/Octopus';")).toEqual(['an engine module outside the allowlist']);
  // A second file importing a bundle fails, whatever its name: only that exact file is allowed.
  for (const other of ['pages/Landing.tsx', 'worlds/other.ts', 'world/WorldPage.tsx', 'worlds/loadWorld.tsx', 'x/worlds/loadWorld.ts', 'loadWorld.ts']) {
    expect(at("const m = import('../../worlds/nox/bundle');", other), other).toHaveLength(1);
    expect(at("import { NOX_BUNDLE } from '../../worlds/veyra/bundle';", other), other).toHaveLength(1);
  }
  // A creator template (creator/templates/<id>.ts) may import its own world's bundle and no other world's, nothing else of its own world's, and only from that exact file.
  const template = (id: string, code: string) => at(code, `creator/templates/${id}.ts`);
  for (const id of ['nox', 'veyra', 'flux', 'aether']) expect(template(id, `import { B } from '../../../worlds/${id}/bundle';
const m = import('../../../worlds/${id}/bundle');`), id).toEqual([null, null]);
  for (const [id, other] of [['nox', 'veyra'], ['veyra', 'nox'], ['flux', 'aether'], ['aether', 'flux']]) expect(template(id, `import { B } from '../../../worlds/${other}/bundle';`), `${id} -> ${other}`).toHaveLength(1);
  expect(template('nox', "import { C } from '../../../worlds/nox/character';")).toHaveLength(1);
  expect(template('nox', "import { C } from '../../../worlds/nox/place/config';")).toHaveLength(1);
  expect(template('nox', "import { B } from '../../../worlds/octoverse/../nox/bundle.test';")).toHaveLength(1);
  expect(template('nox', "import { x } from '../../../engine/character/Octopus';")).toEqual(['an engine module outside the allowlist']);
  for (const other of ['creator/templates/index.ts', 'creator/templates/make.ts', 'creator/templates/nox.tsx', 'creator/templates/octoverse.ts', 'creator/templates/nox/extra.ts', 'creator/nox.ts', 'creator/CreatorPage.tsx', 'x/creator/templates/nox.ts', 'templates/nox.ts']) {
    expect(at("import { NOX_BUNDLE } from '../../../worlds/nox/bundle';", other), other).toHaveLength(1);
  }
  // What is allowed.
  expect(at("import { HOST_BUNDLE } from '../../worlds/octoverse/bundle';\nimport { nox } from '../../worlds/nox/content/nox';\nimport { noxProject } from '../../worlds/nox/content/noxProject';\nimport { noxTechnologies } from '../../worlds/nox/content/noxTechnologies';\nimport { WORLDS } from '../../worlds';\nimport { WorldHost } from '../../engine/host/WorldHost';")).toEqual([null, null, null, null, null, null]);
});
