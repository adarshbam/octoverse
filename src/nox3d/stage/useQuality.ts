import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { ReviewOptions } from '../behavior/urlState';
import { debugWindow, report, unreport } from '../host/debugHooks';
import { useInstance } from '../host/instanceContext';
import { FrameProbe, type QualityTier, TIER_SETTINGS, pickTier } from './quality';

/**
 * The tier to start with. Captures (`?freeze`, `?view`) and a forced `?tier` hold their tier;
 * otherwise the device's report picks it and the frame probe may step it down.
 */
export function startingTier(url: ReviewOptions): { tier: QualityTier; adaptive: boolean } {
  if (url.tier) return { tier: url.tier, adaptive: false };
  if (url.freeze || url.view) return { tier: 'high', adaptive: false };
  const nav = navigator as Navigator & { deviceMemory?: number };
  const tier = pickTier({
    cores: nav.hardwareConcurrency ?? 4,
    memoryGb: nav.deviceMemory ?? 4,
    isTouch: window.matchMedia?.('(pointer: coarse)').matches ?? false,
    width: window.innerWidth,
  });
  return { tier, adaptive: true };
}

/** The quality tier and its settings; `step` lowers it when the frame probe asks. */
export function useQuality(url: ReviewOptions) {
  const instance = useInstance();
  const [start] = useState(() => startingTier(url));
  const [tier, setTier] = useState(start.tier);
  // Dev server only, page instance only: lets a browser test force a tier change (the frame probe's step, on demand).
  // (`window.__octoverse.setTier`; `__noxSetTier` for Nox.)
  useEffect(() => {
    if (!import.meta.env.DEV || !debugWindow(instance)) return;
    report(instance, 'setTier', setTier);
    return () => unreport(instance, 'setTier');
  }, [instance]);
  return { tier, settings: TIER_SETTINGS[tier], adaptive: start.adaptive, step: setTier };
}

/** Inside the canvas: feeds frame times to a probe and reports a lower tier when frames run slow. */
export function QualityProbe({ tier, onLower }: { tier: QualityTier; onLower: (tier: QualityTier) => void }) {
  const probe = useMemo(() => new FrameProbe(tier), [tier]);
  useFrame((_, delta) => {
    const lower = probe.push(delta * 1000);
    if (lower) onLower(lower);
  });
  return null;
}

function subscribeVisibility(onChange: () => void) {
  document.addEventListener('visibilitychange', onChange);
  return () => document.removeEventListener('visibilitychange', onChange);
}

/** False while the page is hidden, so rendering can pause. */
export function usePageVisible() {
  return useSyncExternalStore(subscribeVisibility, () => !document.hidden, () => true);
}
