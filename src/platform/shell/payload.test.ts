import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

// The landing's payload (platform spec 2.4): the landing route loads no other world's code or kit; each world's bundle (with its kit
// and Theatre state) and the creator load only when their routes are entered, by dynamic import. This builds the app (production,
// with source maps, into node_modules/.cache so dist/ is not touched), reads the build's chunk graph (the manifest) and each chunk's
// source map, and holds that the entry's STATIC import graph contains no module of src/worlds/{nox,veyra,flux,aether} except the
// bare content data the landing's cards read (src/worlds/<id>/content/**). It runs the build itself, so it never reads a stale dist;
// set SKIP_PAYLOAD_BUILD=1 to skip it (the build takes about a minute).

const ROOT = resolve(import.meta.dirname, '../../..');
const OUT = join(ROOT, 'node_modules', '.cache', 'octoverse-payload-build');
const WORLD_IDS = ['nox', 'veyra', 'flux', 'aether'] as const;
const skip = process.env.SKIP_PAYLOAD_BUILD === '1';

interface ManifestChunk {
  file: string;
  src?: string;
  isEntry?: boolean;
  isDynamicEntry?: boolean;
  imports?: string[];
  dynamicImports?: string[];
}

let manifest: Record<string, ManifestChunk>;

/** The chunks reachable from `start` through static imports (start included): what the browser loads before the chunk runs. */
function staticGraph(start: string): string[] {
  const seen = new Set<string>();
  const visit = (key: string) => {
    if (seen.has(key)) return;
    seen.add(key);
    for (const next of manifest[key]?.imports ?? []) visit(next);
  };
  visit(start);
  return [...seen];
}

/** The source modules (relative to the repository, forward slashes) a chunk was built from, read from its source map. */
function sourcesOf(key: string): string[] {
  const file = join(OUT, manifest[key].file);
  if (!existsSync(`${file}.map`)) return []; // the bundler's own runtime chunk has no source map (and no module of ours)
  const map = JSON.parse(readFileSync(`${file}.map`, 'utf8')) as { sources: string[] };
  return map.sources.map(source => relative(ROOT, resolve(dirname(file), source)).split('\\').join('/'));
}

const modulesOf = (keys: string[]) => keys.flatMap(sourcesOf);

/** A module of a showcase world that is not its bare content data (the content modules are what the landing's cards read). */
const worldCode = (module: string, only?: readonly string[]) => {
  const m = /^src\/worlds\/(nox|veyra|flux|aether)\/(.*)$/.exec(module);
  return m !== null && !m[2].startsWith('content/') && (only === undefined || only.includes(m[1]));
};

describe.skipIf(skip)('the production build: what the landing loads (spec 2.4)', () => {
  beforeAll(() => {
    const vite = join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');
    const run = spawnSync(process.execPath, [vite, 'build', '--outDir', OUT, '--emptyOutDir', '--sourcemap', '--manifest', '--logLevel', 'warn'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, env: { ...process.env, NODE_ENV: 'production' } });
    if (run.status !== 0) throw new Error(`vite build failed (${run.status}):\n${run.stdout}\n${run.stderr}`);
    expect(existsSync(join(OUT, '.vite', 'manifest.json'))).toBe(true);
    manifest = JSON.parse(readFileSync(join(OUT, '.vite', 'manifest.json'), 'utf8'));
  }, 600_000);

  const entry = () => Object.keys(manifest).filter(key => manifest[key].isEntry);

  it('has one entry, and its static graph really is the landing (the scan is not vacuous)', () => {
    expect(entry()).toHaveLength(1);
    const modules = modulesOf(staticGraph(entry()[0]));
    expect(modules).toContain('src/platform/pages/Landing.tsx');
    expect(modules).toContain('src/engine/host/WorldHost.tsx');
    expect(modules).toContain('src/worlds/octoverse/bundle.ts');
  });

  it("the landing's static graph holds no module of another world, and not the registry", () => {
    const modules = modulesOf(staticGraph(entry()[0]));
    expect(modules.filter(m => worldCode(m))).toEqual([]);
    expect(modules).not.toContain('src/worlds/index.ts');
    expect(modules).not.toContain('src/app/ReviewPage.tsx');
    // The loader itself is in the landing since Task 13 (a card's live preview asks it for its world): it holds only the dynamic
    // imports, one per world, and the test below holds that each of those is a chunk of its own, never a static import of the landing.
    expect(modules).toContain('src/platform/worlds/loadWorld.ts');
    expect(modules).not.toContain('src/platform/creator/CreatorPage.tsx');
  });

  /** The one chunk a world's bundle was built into (the manifest names it by hash, not by source: the source map says what is in it). */
  const worldChunk = (id: string) => {
    const keys = Object.keys(manifest).filter(key => sourcesOf(key).includes(`src/worlds/${id}/bundle.ts`));
    expect(keys, `${id}'s bundle is in one chunk`).toHaveLength(1);
    return keys[0];
  };

  it('each world, the creator, the world page and the review page are their own chunks, reached by dynamic import only', () => {
    const landing = new Set(staticGraph(entry()[0]));
    const dynamicEntries = Object.entries(manifest).filter(([, chunk]) => chunk.isDynamicEntry);
    const named = (src: string) => dynamicEntries.find(([, chunk]) => chunk.src === src)?.[0];
    expect(named('src/platform/world/WorldPage.tsx')).toBeDefined();
    // The chunk the loader (src/platform/worlds/loadWorld.ts) was built into: the landing's own, since a card's preview uses it too.
    const loader = Object.keys(manifest).filter(key => sourcesOf(key).includes('src/platform/worlds/loadWorld.ts'));
    expect(loader, 'the loader is in one chunk').toHaveLength(1);
    for (const id of WORLD_IDS) {
      const key = worldChunk(id);
      expect(landing.has(key), `${id} is not loaded with the landing`).toBe(false);
      // The loader's one dynamic import per world: its chunk names each bundle's chunk as a dynamic import, never a static one.
      expect(manifest[loader[0]].dynamicImports, id).toContain(key);
      expect(manifest[loader[0]].imports ?? [], id).not.toContain(key);
    }
    for (const src of ['src/platform/world/WorldPage.tsx', 'src/platform/creator/CreatorRoute.tsx', 'src/platform/creator/PreviewPage.tsx', 'src/app/ReviewPage.tsx']) {
      const key = named(src);
      expect(key, `${src} is a dynamic entry`).toBeDefined();
      expect(landing.has(key!), src).toBe(false);
    }
  });

  // Vitest runs with NODE_ENV=test, which a child `vite build` would inherit: that makes `import.meta.env.DEV` true and the build a
  // development one (jsxDEV, the dev-only branches kept). The build above sets NODE_ENV=production. The checks come in pairs: what must
  // be absent, and a positive control that the same scan does find a string or module that IS in the build (so it can fail).
  describe('the build is a production build: the dev-only branches are gone', () => {
    const jsFiles = () => Object.values(manifest).map(chunk => join(OUT, chunk.file)).filter(file => file.endsWith('.js'));
    const code = () => jsFiles().map(file => ({ file, text: readFileSync(file, 'utf8') }));
    const holding = (needle: string) => code().filter(chunk => chunk.text.includes(needle)).map(chunk => chunk.file);
    const modules = () => modulesOf(Object.keys(manifest));

    it('the scan reads real chunks (positive controls)', () => {
      expect(jsFiles().length).toBeGreaterThan(10);
      expect(code().every(chunk => chunk.text.length > 0)).toBe(true);
      // The creator route's chunk holds the database name, so the scan finds a string that is in the build.
      expect(holding('octoverse-creator').some(file => /CreatorRoute/.test(file)), 'the creator chunk holds the DB name').toBe(true);
      // The source maps are read: the creator's modules, the entry's review-address parser and Theatre's core are all listed.
      expect(modules()).toEqual(expect.arrayContaining(['src/platform/creator/draft.ts', 'src/platform/creator/storage.ts', 'src/platform/creator/reviewParam.ts', 'src/app/Page.tsx']));
      expect(modules().some(m => m.includes('@theatre/core/'))).toBe(true);
    });

    it('is not a development build (no jsxDEV)', () => {
      expect(holding('jsxDEV')).toEqual([]);
    });

    it('has no creator review entry: no creatorReviewBundle, and the module is in no chunk', () => {
      expect(holding('creatorReviewBundle')).toEqual([]);
      expect(modules()).not.toContain('src/platform/creator/review.ts');
    });

    it("has no world switcher (src/app/Page.tsx is built, but its dev-only __octoSwitchWorld is not) and no Theatre studio", () => {
      expect(holding('__octoSwitchWorld')).toEqual([]);
      expect(modules().filter(m => m.includes('@theatre/studio'))).toEqual([]);
    });
  });

  it("a world's chunks hold no other world's code (each world and its kit are separate chunks)", () => {
    for (const id of WORLD_IDS) {
      const others = WORLD_IDS.filter(other => other !== id);
      expect(modulesOf(staticGraph(worldChunk(id))).filter(m => worldCode(m, others)), id).toEqual([]);
    }
  });
});

describe('payload test setup', () => {
  it('says why it is skipped', () => {
    if (skip) console.warn('payload.test.ts: SKIP_PAYLOAD_BUILD=1, the production build graph was not checked');
    expect(typeof skip).toBe('boolean');
  });
});
