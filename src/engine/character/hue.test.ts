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
  '../nox3d/artifacts/orbMaterial.ts',
  'character/headEffects/glyphs.ts',
];

const HUE = /#[0-9a-fA-F]{6}\b|rgba\(\d/;

// The wider scan (Task 7): every colour spelling a source could hide a hue in, #rrggbbaa, rgb(, hsl(
// and 0xRRGGBB as well as the pattern above. It runs over the files Task 7 touches or creates; the
// older files above keep the narrow pattern until a task that touches them widens theirs.
const HUE_ANY = /#[0-9a-fA-F]{8}\b|#[0-9a-fA-F]{6}\b|\brgba?\(|\bhsla?\(|\b0x[0-9a-fA-F]{6}\b/;
const WIDE_SOURCES = [
  'character/headEffects/glyphs.ts',
  'character/headEffects/index.ts',
  'character/Octopus.tsx',
  '../nox3d/artifacts/TechBubbles.tsx',
  '../nox3d/artifacts/strategies.ts',
  '../nox3d/artifacts/bubbleOrbits.ts',
  '../nox3d/config/nox.artifacts.ts',
];

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

test('the wide scan also finds #rrggbbaa, rgb(, hsl( and 0xRRGGBB, and still lets a short hex or a word through', () => {
  for (const literal of ["'#ff4a3080'", "'#FF4A30'", "'rgb(255, 24, 44)'", "'rgba(255,24,44,0.5)'", "'hsl(350 90% 50%)'", "'hsla(350, 90%, 50%, 0.5)'", 'new Color(0xff4a30)']) {
    expect(HUE_ANY.test(`const c = ${literal};`), literal).toBe(true);
  }
  for (const text of ["fill('#000')", 'const rgbaOf = 1;', 'const hslFor = 2;', 'const n = 0x1f;', 'strengthRgb(1)', 'width: 0.75']) {
    expect(HUE_ANY.test(text), text).toBe(false);
  }
});

for (const path of WIDE_SOURCES) {
  test(`${path} holds no colour literal of any spelling`, () => {
    const hits = code(path)
      .split('\n')
      .map((line, i) => ({ line: i + 1, text: line.trim() }))
      .filter(({ text }) => HUE_ANY.test(text));
    expect(hits).toEqual([]);
  });
}

for (const path of SOURCES) {
  test(`${path} holds no hex or rgba hue literal`, () => {
    const hits = code(path)
      .split('\n')
      .map((line, i) => ({ line: i + 1, text: line.trim() }))
      .filter(({ text }) => HUE.test(text));
    expect(hits).toEqual([]);
  });
}
