// Writes src/worlds/<id>/sequences/state.theatre.json from the defaults in src/worlds/<id>/sequences/defaults.ts
// (<id> is nox; WORLD=<id> or OCTO_WORLD=<id>, which wins, picks another world, as scripts/stage-capture.mjs does).
// Runs only when the file is missing (or with --force): studio exports replace it afterwards.
// Naming sheets (`node scripts/theatre-seed.mjs entrance`) rewrites just those sheets in the
// existing file and keeps the rest, studio edits included.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const world = process.env.OCTO_WORLD || process.env.WORLD || 'nox';
if (!/^[a-z][a-z0-9-]*$/.test(world)) throw new Error(`theatre-seed: "${world}" is not a world id`);
const { SEQUENCE_DEFAULTS } = await import(pathToFileURL(resolve(root, `src/worlds/${world}/sequences/defaults.ts`)).href);
const out = resolve(root, `src/worlds/${world}/sequences/state.theatre.json`);
const named = process.argv.slice(2).filter(a => !a.startsWith('--'));
for (const name of named) {
  if (!(name in SEQUENCE_DEFAULTS)) {
    console.error(`theatre-seed: no sequence "${name}" (have ${Object.keys(SEQUENCE_DEFAULTS).join(', ')})`);
    process.exit(1);
  }
}
if (existsSync(out) && !named.length && !process.argv.includes('--force')) {
  console.log('theatre-seed: state exists, left alone (use --force to rewrite, or name the sheets to reseed)');
  process.exit(0);
}

const EASE = [0.5, 1, 0.5, 0]; // Theatre's default handles: ease in and out

const existing = named.length && existsSync(out) ? JSON.parse(readFileSync(out, 'utf8')) : null;
const sheetsById = existing ? existing.sheetsById : {};
for (const [sheetId, def] of Object.entries(SEQUENCE_DEFAULTS)) {
  if (existing && !named.includes(sheetId)) continue;
  // Ids are per sheet, so reseeding one sheet never collides with another's.
  let n = 0;
  const id = () => `${sheetId}-${(++n).toString(36).padStart(4, '0')}`;
  const tracksByObject = {};
  for (const [objKey, obj] of Object.entries(def.objects)) {
    const trackData = {};
    const trackIdByPropPath = {};
    for (const [prop, keys] of Object.entries(obj.keys)) {
      const trackId = id();
      trackIdByPropPath[JSON.stringify([prop])] = trackId;
      trackData[trackId] = {
        type: 'BasicKeyframedTrack',
        __debug_objectPath: [sheetId, objKey, prop],
        keyframes: keys.map(([position, value, handles], i) => ({
          id: id(),
          position,
          connectedRight: i < keys.length - 1,
          handles: [...(handles ?? EASE)],
          value,
        })),
      };
    }
    tracksByObject[objKey] = { trackData, trackIdByPropPath };
  }
  sheetsById[sheetId] = {
    staticOverrides: { byObject: {} },
    sequence: { subUnitsPerUnit: 30, length: def.length, type: 'PositionalSequence', tracksByObject },
  };
}

mkdirSync(dirname(out), { recursive: true });
const state = existing ? { ...existing, sheetsById } : { sheetsById, definitionVersion: '0.4.0', revisionHistory: [] };
writeFileSync(out, JSON.stringify(state, null, 2) + '\n');
console.log('theatre-seed: wrote', named.length ? named.join(', ') : 'every sheet', 'to', out);
