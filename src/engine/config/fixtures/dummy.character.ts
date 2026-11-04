import type { CharacterConfig } from '../types';

// A second character made of configuration alone (Task 26): it proves a new octopus is a new
// config, not new code. Test and development only: App.tsx loads it behind `import.meta.env.DEV`
// and the production build must not contain it. Teal and gold where Nox is violet and red, a
// slower stroke and a heavier, slower water feel, and a head swell with no effect.

/**
 * The dummy character, made over `base` (the page passes Nox's bundle character): the fixture
 * names no world's files, so it imports none (D7).
 */
export function dummyCharacter(base: CharacterConfig): CharacterConfig {
  return {
    ...base,
    id: 'dummy',
    glow: {
      ...base.glow,
      core: '#30e0b8',
      light: { color: '#30c8a8', intensity: 4, distance: 5, decay: 2 },
      ramp: [
        [0, '#041a2c'], [0.07, '#06303c'], [0.17, '#0a4a4a'], [0.27, '#10665a'], [0.37, '#1c8466'],
        [0.49, '#3ca470'], [0.61, '#76c070'], [0.74, '#b4d868'], [0.94, '#e4e670'], [1, '#fff08a'],
      ],
      halo: { ...base.glow.halo, color: '#20d0a8', crown: '#2870d8', band: '#e8b010' },
      aura: { inner: '#04202e', low: '#e8a808', belowStart: 0.6, radius: 3.2, strength: 0.8 },
      grade: { ...base.glow.grade, color: '#04141c' },
    },
    palette: {
      ...base.palette,
      cheek: '#107868',
      headEdge: '#146c8c',
      rimTop: '#38d8c8',
      rimLow: '#a07c08',
      sky: '#2890c8',
      blotch: '#04202a',
      tintCool: '#10a0c0',
      tintWarm: '#58a030',
      wet: '#20c0b0',
      armBody: '#08485c',
      terminator: '#c89808',
      armGlow: '#f0c040',
      belly: '#e8a000',
      suckerEdge: '#a07808',
      suckerBody: '#e8c050',
      suckerHot: '#f4d870',
      suckerHollow: '#b88a10',
      domeTint: '#041a20',
      domeRim: '#30e0c0',
      domeRimTop: '#9af0e0',
      domeSheen: '#a0f0e8',
      orbFocus: '#30e0c0',
      effect: { halo: 'rgba(32,208,168,0.5)', stroke: '#20d0a8', core: '#b4f0e0' },
      rimHot: 'color(srgb-linear 0.85 1 0.95)',
      domeRimHot: 'color(srgb-linear 0.8 1 0.95)',
      suckerSpecular: 'color(srgb-linear 1 0.95 0.75)',
      orbGlass: { below: 'color(srgb-linear 0.9 0.7 0.1)', above: 'color(srgb-linear 0.2 0.8 0.75)', side: 'color(srgb-linear 0.15 0.5 0.9)', base: 'color(srgb-linear 0.001 0.003 0.003)' },
    },
    headEffect: 'none',
    personality: {
      ...base.personality,
      // Heavier water: slower, wider-damped head and gaze, smaller sway, a deeper slower float.
      gazeOmega: 11,
      headOmega: 2.2,
      sway: 0.35,
      curl: 0.8,
      float: { amplitude: 0.06, period: 8.4 },
      breathPeriod: 6.2,
      // A slower stroke: longer recovery, power stroke and glide.
      swim: { recovery: 0.78, power: 0.34, glide: 0.95, fill: 0.04, squeeze: 0.06 },
    },
  };
}
