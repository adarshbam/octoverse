import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';

// A guard on the shared mechanics: the things two instances on a page would collide on live in one
// named place each, so a new use elsewhere fails here and not in the browser. Tests, the review page
// and main.tsx (the host, which reads the address once) are not engine code.
// (Mid-move: the engine's parts are in src/engine already, the rest still in src/nox3d.)
const ROOTS = [join(import.meta.dirname, '..'), join(import.meta.dirname, '..', '..', 'engine')];
const slash = (path: string) => path.split(String.fromCharCode(92)).join('/');
const listed = ROOTS.flatMap(root =>
  (readdirSync(root, { recursive: true }) as string[])
    .map(slash)
    .filter(f => /\.(ts|tsx)$/.test(f) && !/\.test\./.test(f) && !f.startsWith('review/') && f !== 'main.tsx')
    .map(f => [f, join(root, f)] as const),
);
const files = listed.map(([f]) => f);
const source = new Map(listed.map(([f, full]) => [f, readFileSync(full, 'utf8')]));

/** The files whose code (comments aside) matches `pattern`. */
function using(pattern: RegExp) {
  const hits: string[] = [];
  for (const [file, text] of source) {
    const code = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
    if (pattern.test(code)) hits.push(file);
  }
  return hits.sort();
}

test('the scan sees the engine files (not a vacuous pass)', () => {
  expect(files).toContain('App.tsx');
  expect(files).toContain('host/listeners.ts');
});

test('no engine module reads the page address', () => {
  expect(using(/\b(window\.)?location\.(search|href|hash|pathname)|\bhistory\.(push|replace)State|\bURLSearchParams\(\s*(window\.)?location/)).toEqual([]);
});

test('session storage is touched only by the stage hook, whose key is per world', () => {
  expect(using(/\b(sessionStorage|localStorage)\b/)).toEqual(['behavior/useStage.ts']);
});

test('window listeners are attached only through useWindowListeners', () => {
  expect(using(/\bwindow\.(add|remove)EventListener\(/)).toEqual(['host/listeners.ts']);
});

test('the only document-level listeners are the page-gated pointer-leave in Octopus and the visibility pause', () => {
  expect(using(/\bdocument(\.documentElement)?\.(add|remove)EventListener\(/)).toEqual(['character/Octopus.tsx', 'stage/useQuality.ts']);
});

test('no component writes a fixed id, and only the boot veil looks an element up by id', () => {
  expect(using(/<[a-z]\w*\b[^<>]*\sid="/)).toEqual([]);
  expect(using(/\bgetElementById\(/)).toEqual(['ui/bootVeil.ts']);
});
