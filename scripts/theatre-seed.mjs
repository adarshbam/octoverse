// Writes src/nox3d/sequences/state/octoverse.theatre.json from the defaults in sequences/keys.ts.
// Runs only when the file is missing (or with --force): studio exports replace it afterwards.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SEQUENCE_DEFAULTS } from '../src/nox3d/sequences/keys.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, 'src/nox3d/sequences/state/octoverse.theatre.json');
if (existsSync(out) && !process.argv.includes('--force')) {
  console.log('theatre-seed: state exists, left alone (use --force to rewrite)');
  process.exit(0);
}

const EASE = [0.5, 1, 0.5, 0]; // Theatre's default handles
let n = 0;
const id = () => `seed${(++n).toString(36).padStart(6, '0')}`;

const sheetsById = {};
for (const [sheetId, def] of Object.entries(SEQUENCE_DEFAULTS)) {
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
        keyframes: keys.map(([position, value], i) => ({
          id: id(),
          position,
          connectedRight: i < keys.length - 1,
          handles: EASE,
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
writeFileSync(out, JSON.stringify({ sheetsById, definitionVersion: '0.4.0', revisionHistory: [] }, null, 2) + '\n');
console.log('theatre-seed: wrote', out);
