export type QualityTier = 'high' | 'medium' | 'low';

export interface TierSettings {
  /** Highest device pixel ratio rendered. */
  dpr: number;
  /** Share of that pixel ratio actually drawn (the frame is scaled up to the page): the lower tiers draw fewer pixels. */
  renderScale: number;
  /** Arm tube vertices round each ring, and segments along each arm. */
  radial: number;
  segments: number;
  /** Detail of each sucker cup and its contact shadow (fraction of the full mesh). */
  suckerScale: number;
  /** Bloom buffer resolution (fraction of the full one). */
  bloomScale: number;
  /** Fraction of the bubbles and embers drawn. */
  particles: number;
  /** The screen-space contact-shadow pass: on at every tier, since it shades Nox's own arms and head (turned off, Nox's brightness changed). */
  contactShadows: boolean;
}

/** `high` is the look the owner signed off; the lower tiers trade detail for frame rate. */
export const TIER_SETTINGS: Record<QualityTier, TierSettings> = {
  high: { dpr: 2, renderScale: 1, radial: 24, segments: 128, suckerScale: 1, bloomScale: 1, particles: 1, contactShadows: true },
  medium: { dpr: 1.5, renderScale: 0.8, radial: 18, segments: 96, suckerScale: 0.75, bloomScale: 0.75, particles: 0.6, contactShadows: true },
  low: { dpr: 1, renderScale: 0.6, radial: 12, segments: 64, suckerScale: 0.5, bloomScale: 0.5, particles: 0.35, contactShadows: true },
};

const ORDER: QualityTier[] = ['high', 'medium', 'low'];

/** The tier a page may use: the lower of what the device was probed for and the page's cap (a preview's `tierCap`); no cap leaves the probe as it was. */
export function capTier(probed: QualityTier, cap?: QualityTier): QualityTier {
  return cap && ORDER.indexOf(cap) > ORDER.indexOf(probed) ? cap : probed;
}

/** The starting tier from what the device reports; touch phones never start high. */
export function pickTier({ cores, memoryGb, isTouch, width }: { cores: number; memoryGb: number; isTouch: boolean; width: number }): QualityTier {
  const tier: QualityTier = cores <= 2 || memoryGb <= 2 ? 'low' : cores >= 8 && memoryGb >= 8 ? 'high' : 'medium';
  return isTouch && width < 768 && tier === 'high' ? 'medium' : tier;
}

/** Window of frame time judged at once, and the mean frame time each tier must keep under. */
const WINDOW_MS = 2000;
/** 22.2 ms is 45 fps, 33.3 ms is 30 fps (spec 9.13): a tier is kept while the frame rate stays at or above these. */
const SLOW_MS: Record<QualityTier, number> = { high: 22.2, medium: 33.3, low: Infinity };
/** A single frame longer than this (a stall, a hidden tab) is left out of the judgement. */
const STALL_MS = 250;

/**
 * Watches frame times and steps the tier down after two seconds that average slower than the
 * tier allows. It never steps up, so the view does not flicker between tiers.
 */
export class FrameProbe {
  private tier: QualityTier;
  private total = 0;
  private frames = 0;

  constructor(tier: QualityTier) {
    this.tier = tier;
  }

  push(dtMs: number): QualityTier | null {
    if (dtMs > STALL_MS) return null;
    this.total += dtMs;
    this.frames++;
    if (this.total < WINDOW_MS) return null;
    const slow = this.total / this.frames > SLOW_MS[this.tier];
    this.total = 0;
    this.frames = 0;
    if (!slow) return null;
    this.tier = ORDER[ORDER.indexOf(this.tier) + 1];
    return this.tier;
  }
}
