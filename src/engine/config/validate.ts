import { EXPRESSION_IDS, EXPRESSION_PARAM_KEYS, type ExpressionParams } from '../behavior/expressions';
import { isColour, isWorldColour } from '../world/colour';
import { INTRO_LIGHTING, type StageLighting } from './lighting';
import { ARM_IDS, type AuraSettings, type CharacterConfig, type EffectColours, type GlowLightSettings, type GlowShape, type OrbGlass, type Palette } from './types';

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

/**
 * `value` held to `min`..`max`. Anything that is not a finite number (NaN, an infinity, text a
 * hand-edited file put where a number goes) reads `fallback` instead: `Math.min(max, Math.max(min,
 * NaN))` is NaN, which would reach a GLSL source or a light.
 */
const clamp = (value: number, min: number, max: number, fallback: number) => (finite(value) ? Math.min(max, Math.max(min, value)) : fallback);
const unit = (value: number, fallback: number) => clamp(value, 0, 1, fallback);

/**
 * A colour three and the canvas both read (world/colour.ts `isColour`: what three's `Color.set`
 * reads, CSS colour names included); anything else reads `fallback`. The clamp falls back quietly,
 * as it does for a number; `validateBundle` refuses such a value by name before it gets here.
 */
const colour = (value: unknown, fallback: string): string => (isColour(value) ? value : fallback);
/** A colour a shader compiles in (world/colour.ts `isWorldColour`: `#rrggbb` or `color(srgb-linear r g b)`); anything else reads `fallback`. */
const linear = (value: unknown, fallback: string): string => (isWorldColour(value) ? value : fallback);

/**
 * What a config written before these fields existed reads in their place: Nox's own values, so
 * such a config validates and renders exactly as it did (Task 4).
 */
const LEGACY = {
  core: '#ff4a2a',
  light: { color: '#ff4a30', intensity: 5, distance: 6, decay: 2 } as GlowLightSettings,
  belowStart: 0.75,
  orbFocus: '#ff2e5a',
  effect: { halo: 'rgba(255,24,44,0.5)', stroke: '#ff2c3c', core: '#ffb49c' } as EffectColours,
  // The shader tints fix wave A moved from literals into the palette (linear light, as they were compiled in).
  rimHot: 'color(srgb-linear 1 0.85 1)',
  domeRimHot: 'color(srgb-linear 1 0.85 0.95)',
  suckerSpecular: 'color(srgb-linear 1 0.9 0.84)',
  orbGlass: { below: 'color(srgb-linear 1 0.42 0.12)', above: 'color(srgb-linear 0.62 0.36 1)', side: 'color(srgb-linear 0.25 0.55 1)', base: 'color(srgb-linear 0.002 0.0015 0.004)' } as OrbGlass,
};

/**
 * What a number that is not one (NaN, an infinity, text) reads in the fields below: Nox's own
 * value, so a bad value is the character's default and not a number at the edge of its range (a
 * test holds each equal to Nox's config). The lighting's defaults are INTRO_LIGHTING.
 */
const DEFAULTS = {
  underside: 1.6,
  auraRadius: 3.6,
  auraStrength: 1,
  gradeRadius: 4,
  gradeStrength: 1,
  armBend: 0.2,
  armFlatten: 0.86,
  skin: { speckDensity: 0.5, speckSize: [0.14, 0.42], speckScale: 12, blotchDensity: 0.15, blotchScale: 3, tint: 0.6, translucency: 0.6, wetness: 1.5, gloss: 140, streakScale: 1, streakStrength: 0.35 },
  personality: { sway: 0.5, curl: 1.1, floatAmplitude: 0.045, floatPeriod: 6.2, breathPeriod: 4.6, blinkInterval: [2.6, 7.0] },
} as const;

/** A config as an older creator wrote it: the fields Task 4 (and fix wave A's shader tints) added may be missing. */
export type LegacyCharacterConfig = Omit<CharacterConfig, 'lighting' | 'glow' | 'palette'> & {
  lighting?: StageLighting;
  glow: Omit<GlowShape, 'core' | 'light' | 'aura'> & { core?: string; light?: GlowLightSettings; aura: Omit<AuraSettings, 'belowStart'> & { belowStart?: number } };
  palette: Omit<Palette, 'orbFocus' | 'effect' | 'rimHot' | 'domeRimHot' | 'suckerSpecular' | 'orbGlass'> & {
    orbFocus?: string;
    effect?: EffectColours;
    rimHot?: string;
    domeRimHot?: string;
    suckerSpecular?: string;
    orbGlass?: OrbGlass;
  };
};

function clampLighting(l: StageLighting, d: StageLighting = INTRO_LIGHTING): StageLighting {
  // Copied, so the validated config shares no array with the one it was made from.
  const direction = l.key.direction.length === 3 && l.key.direction.every(finite) ? l.key.direction : d.key.direction;
  return {
    key: { direction: [direction[0], direction[1], direction[2]], color: colour(l.key.color, d.key.color), intensity: clamp(l.key.intensity, 0, 4, d.key.intensity), wrap: unit(l.key.wrap, d.key.wrap) },
    underglow: { color: colour(l.underglow.color, d.underglow.color), intensity: clamp(l.underglow.intensity, 0, 4, d.underglow.intensity), wrap: unit(l.underglow.wrap, d.underglow.wrap) },
    ambient: { sky: colour(l.ambient.sky, d.ambient.sky), ground: colour(l.ambient.ground, d.ambient.ground), intensity: clamp(l.ambient.intensity, 0, 2, d.ambient.intensity) },
    haze: { color: colour(l.haze.color, d.haze.color), near: clamp(l.haze.near, 0, 4, d.haze.near), far: clamp(l.haze.far, 0, 4, d.haze.far), strength: unit(l.haze.strength, d.haze.strength) },
  };
}

/** Expression overrides: only known ids, only keys the face has, only finite values, each held in the range the face can draw. */
function clampExpressions(overrides: CharacterConfig['expressions']): CharacterConfig['expressions'] {
  if (!overrides) return undefined;
  const out: NonNullable<CharacterConfig['expressions']> = {};
  for (const id of EXPRESSION_IDS) {
    const own = overrides[id];
    if (!own) continue;
    const kept: Partial<ExpressionParams> = {};
    for (const key of EXPRESSION_PARAM_KEYS) {
      const value = (own as Record<string, unknown>)[key];
      if (!finite(value)) continue;
      kept[key] = key === 'puff' || key === 'mouthRound' ? unit(value, 0) : clamp(value, -1, 1, 0);
    }
    out[id] = kept;
  }
  return out;
}

/**
 * Keeps creator-supplied values inside ranges that still look like a healthy
 * octopus. Anatomy is not negotiable: exactly eight arms, T1..T8, in order.
 * A number that is not finite reads the Nox default for its field; so does a colour that does not
 * parse, in the fields that hold one here.
 */
export function clampCharacterConfig(config: LegacyCharacterConfig): CharacterConfig {
  const ids = config.arms.map(arm => arm.id);
  if (ids.length !== ARM_IDS.length || ids.some((id, i) => id !== ARM_IDS[i])) {
    throw new Error('CharacterConfig needs exactly eight arms T1..T8');
  }
  const p = config.personality;
  const d = DEFAULTS.personality;
  const [blinkMin, blinkMax] = p.blinkInterval;
  const low = clamp(blinkMin, 2, 10, d.blinkInterval[0]);
  const k = config.skin;
  const ds = DEFAULTS.skin;
  const [speckMin, speckMax] = k.speckSize.map((v, i) => clamp(v, 0.02, 0.45, ds.speckSize[i])).sort((a, b) => a - b);
  const { aura, grade } = config.glow;
  const light = config.glow.light ?? LEGACY.light;
  const expressions = clampExpressions(config.expressions);
  const effect = config.palette.effect ?? LEGACY.effect;
  const glass = config.palette.orbGlass ?? LEGACY.orbGlass;
  return {
    ...config,
    lighting: clampLighting(config.lighting ?? INTRO_LIGHTING),
    ...(expressions ? { expressions } : {}),
    glow: {
      ...config.glow,
      core: colour(config.glow.core, LEGACY.core),
      light: {
        ...light,
        color: colour(light.color, LEGACY.light.color),
        intensity: clamp(light.intensity, 0, 20, LEGACY.light.intensity),
        distance: clamp(light.distance, 0.5, 20, LEGACY.light.distance),
        decay: clamp(light.decay, 0.5, 4, LEGACY.light.decay),
      },
      underside: clamp(config.glow.underside, 0, 2, DEFAULTS.underside),
      aura: { ...aura, belowStart: clamp(aura.belowStart ?? LEGACY.belowStart, 0.05, 4, LEGACY.belowStart), radius: clamp(aura.radius, 0.2, 4, DEFAULTS.auraRadius), strength: unit(aura.strength, DEFAULTS.auraStrength) },
      grade: { ...grade, radius: clamp(grade.radius, 0.5, 8, DEFAULTS.gradeRadius), strength: unit(grade.strength, DEFAULTS.gradeStrength) },
    },
    palette: {
      ...config.palette,
      orbFocus: colour(config.palette.orbFocus, LEGACY.orbFocus),
      effect: { halo: colour(effect.halo, LEGACY.effect.halo), stroke: colour(effect.stroke, LEGACY.effect.stroke), core: colour(effect.core, LEGACY.effect.core) },
      rimHot: linear(config.palette.rimHot, LEGACY.rimHot),
      domeRimHot: linear(config.palette.domeRimHot, LEGACY.domeRimHot),
      suckerSpecular: linear(config.palette.suckerSpecular, LEGACY.suckerSpecular),
      orbGlass: { below: linear(glass.below, LEGACY.orbGlass.below), above: linear(glass.above, LEGACY.orbGlass.above), side: linear(glass.side, LEGACY.orbGlass.side), base: linear(glass.base, LEGACY.orbGlass.base) },
    },
    armBend: clamp(config.armBend, 0, 0.3, DEFAULTS.armBend),
    armFlatten: clamp(config.armFlatten, 0.7, 1, DEFAULTS.armFlatten),
    skin: {
      ...k,
      speckDensity: unit(k.speckDensity, ds.speckDensity),
      speckSize: [speckMin, speckMax],
      speckScale: clamp(k.speckScale, 1, 60, ds.speckScale),
      blotchDensity: unit(k.blotchDensity, ds.blotchDensity),
      blotchScale: clamp(k.blotchScale, 0.5, 20, ds.blotchScale),
      tint: unit(k.tint, ds.tint),
      translucency: unit(k.translucency, ds.translucency),
      wetness: clamp(k.wetness, 0, 2, ds.wetness),
      gloss: clamp(k.gloss, 4, 400, ds.gloss),
      streakScale: clamp(k.streakScale, 0.1, 10, ds.streakScale),
      streakStrength: unit(k.streakStrength, ds.streakStrength),
    },
    personality: {
      ...p,
      sway: unit(p.sway, d.sway),
      curl: clamp(p.curl, 0, 2, d.curl),
      float: { amplitude: clamp(p.float.amplitude, 0, 0.08, d.floatAmplitude), period: clamp(p.float.period, 4, 8, d.floatPeriod) },
      breathPeriod: clamp(p.breathPeriod, 3, 6, d.breathPeriod),
      blinkInterval: [low, clamp(blinkMax, low, 10, Math.max(low, d.blinkInterval[1]))],
    },
  };
}
