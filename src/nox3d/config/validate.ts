import { EXPRESSION_IDS, type ExpressionParams } from '../behavior/expressions';
import { INTRO_LIGHTING, type StageLighting } from './lighting';
import { ARM_IDS, type AuraSettings, type CharacterConfig, type EffectColours, type GlowLightSettings, type GlowShape, type Palette } from './types';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

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
};

/** A config as an older creator wrote it: the fields Task 4 added may be missing. */
export type LegacyCharacterConfig = Omit<CharacterConfig, 'lighting' | 'glow' | 'palette'> & {
  lighting?: StageLighting;
  glow: Omit<GlowShape, 'core' | 'light' | 'aura'> & { core?: string; light?: GlowLightSettings; aura: Omit<AuraSettings, 'belowStart'> & { belowStart?: number } };
  palette: Omit<Palette, 'orbFocus' | 'effect'> & { orbFocus?: string; effect?: EffectColours };
};

const unit = (v: number) => clamp(v, 0, 1);

function clampLighting(l: StageLighting): StageLighting {
  return {
    key: { ...l.key, intensity: clamp(l.key.intensity, 0, 4), wrap: unit(l.key.wrap) },
    underglow: { ...l.underglow, intensity: clamp(l.underglow.intensity, 0, 4), wrap: unit(l.underglow.wrap) },
    ambient: { ...l.ambient, intensity: clamp(l.ambient.intensity, 0, 2) },
    haze: { ...l.haze, near: clamp(l.haze.near, 0, 4), far: clamp(l.haze.far, 0, 4), strength: unit(l.haze.strength) },
  };
}

/** Expression overrides: only known ids and finite values, each held in the range the face can draw. */
function clampExpressions(overrides: CharacterConfig['expressions']): CharacterConfig['expressions'] {
  if (!overrides) return undefined;
  const out: NonNullable<CharacterConfig['expressions']> = {};
  for (const id of EXPRESSION_IDS) {
    const own = overrides[id];
    if (!own) continue;
    const kept: Partial<ExpressionParams> = {};
    for (const [key, value] of Object.entries(own as Record<string, number | undefined>)) {
      if (typeof value !== 'number' || !Number.isFinite(value)) continue;
      const blowKey = key === 'puff' || key === 'mouthRound';
      (kept as Record<string, number>)[key] = blowKey ? unit(value) : clamp(value, -1, 1);
    }
    out[id] = kept;
  }
  return out;
}

/**
 * Keeps creator-supplied values inside ranges that still look like a healthy
 * octopus. Anatomy is not negotiable: exactly eight arms, T1..T8, in order.
 */
export function clampCharacterConfig(config: LegacyCharacterConfig): CharacterConfig {
  const ids = config.arms.map(arm => arm.id);
  if (ids.length !== ARM_IDS.length || ids.some((id, i) => id !== ARM_IDS[i])) {
    throw new Error('CharacterConfig needs exactly eight arms T1..T8');
  }
  const p = config.personality;
  const [blinkMin, blinkMax] = p.blinkInterval;
  const low = clamp(blinkMin, 2, 10);
  const k = config.skin;
  const [speckMin, speckMax] = [...k.speckSize].sort((a, b) => a - b).map(v => clamp(v, 0.02, 0.45));
  const { aura, grade } = config.glow;
  const light = config.glow.light ?? LEGACY.light;
  const expressions = clampExpressions(config.expressions);
  return {
    ...config,
    lighting: clampLighting(config.lighting ?? INTRO_LIGHTING),
    ...(expressions ? { expressions } : {}),
    glow: {
      ...config.glow,
      core: config.glow.core ?? LEGACY.core,
      light: { ...light, intensity: clamp(light.intensity, 0, 20), distance: clamp(light.distance, 0.5, 20), decay: clamp(light.decay, 0.5, 4) },
      underside: clamp(config.glow.underside, 0, 2),
      aura: { ...aura, belowStart: clamp(aura.belowStart ?? LEGACY.belowStart, 0.05, 4), radius: clamp(aura.radius, 0.2, 4), strength: clamp(aura.strength, 0, 1) },
      grade: { ...grade, radius: clamp(grade.radius, 0.5, 8), strength: clamp(grade.strength, 0, 1) },
    },
    palette: { ...config.palette, orbFocus: config.palette.orbFocus ?? LEGACY.orbFocus, effect: { ...(config.palette.effect ?? LEGACY.effect) } },
    armBend: clamp(config.armBend, 0, 0.3),
    armFlatten: clamp(config.armFlatten, 0.7, 1),
    skin: {
      ...k,
      speckDensity: clamp(k.speckDensity, 0, 1),
      speckSize: [speckMin, speckMax],
      speckScale: clamp(k.speckScale, 1, 60),
      blotchDensity: clamp(k.blotchDensity, 0, 1),
      blotchScale: clamp(k.blotchScale, 0.5, 20),
      tint: clamp(k.tint, 0, 1),
      translucency: clamp(k.translucency, 0, 1),
      wetness: clamp(k.wetness, 0, 2),
      gloss: clamp(k.gloss, 4, 400),
      streakScale: clamp(k.streakScale, 0.1, 10),
      streakStrength: clamp(k.streakStrength, 0, 1),
    },
    personality: {
      ...p,
      sway: clamp(p.sway, 0, 1),
      curl: clamp(p.curl, 0, 2),
      float: { amplitude: clamp(p.float.amplitude, 0, 0.08), period: clamp(p.float.period, 4, 8) },
      breathPeriod: clamp(p.breathPeriod, 3, 6),
      blinkInterval: [low, clamp(blinkMax, low, 10)],
    },
  };
}
