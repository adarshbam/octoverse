import { ARM_IDS, type CharacterConfig } from './types';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * Keeps creator-supplied values inside ranges that still look like a healthy
 * octopus. Anatomy is not negotiable: exactly eight arms, T1..T8, in order.
 */
export function clampCharacterConfig(config: CharacterConfig): CharacterConfig {
  const ids = config.arms.map(arm => arm.id);
  if (ids.length !== ARM_IDS.length || ids.some((id, i) => id !== ARM_IDS[i])) {
    throw new Error('CharacterConfig needs exactly eight arms T1..T8');
  }
  const p = config.personality;
  const [blinkMin, blinkMax] = p.blinkInterval;
  const low = clamp(blinkMin, 2, 10);
  const k = config.skin;
  const [speckMin, speckMax] = [...k.speckSize].sort((a, b) => a - b).map(v => clamp(v, 0.02, 0.45));
  return {
    ...config,
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
