import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from 'vitest';

// The boundary precursor (Task 4): the engine's character and artifact sources hold no hue. A
// character's colours come from its config, so a new octopus is a new config and not an edit here.
// The logo allow-list (the technologies' own marks) lives in artifacts/logoTexture.ts, which is
// not checked. Task 7's boundary test widens this to every engine file.
const SOURCES = [
  'character/skinMaterial.ts',
  'character/auraMaterial.ts',
  'character/glowLight.ts',
  'character/Octopus.tsx',
  'artifacts/orbMaterial.ts',
  'character/headGlyphs.ts',
];

const HUE = /#[0-9a-fA-F]{6}\b|rgba\(\d/;

/** The source without its comments (block and line), so notes that name a colour do not trip the scan. */
function code(path: string) {
  return readFileSync(resolve(__dirname, '..', path), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
}

test('the scan finds a hue literal in code and ignores one in a comment', () => {
  expect(HUE.test("const c = '#ff4a30';")).toBe(true);
  expect(HUE.test("fill('rgba(255,24,44,0.5)')")).toBe(true);
  expect(HUE.test('#fff is three digits')).toBe(false);
});

for (const path of SOURCES) {
  test(`${path} holds no hex or rgba hue literal`, () => {
    const hits = code(path)
      .split('\n')
      .map((line, i) => ({ line: i + 1, text: line.trim() }))
      .filter(({ text }) => HUE.test(text));
    expect(hits).toEqual([]);
  });
}
