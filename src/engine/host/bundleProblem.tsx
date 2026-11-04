import { BundleError, type WorldBundle, validateBundle } from '../types/bundle';

/** The bundle, validated and clamped, or the BundleError that says what is wrong with it. Any other error is a bug and goes on up. */
export type BundleCheck = { valid: WorldBundle; error?: undefined } | { valid?: undefined; error: BundleError };

export function checkBundle(bundle: WorldBundle): BundleCheck {
  try {
    return { valid: validateBundle(bundle) };
  } catch (error) {
    if (error instanceof BundleError) return { error };
    throw error;
  }
}

/**
 * What the page shows in place of a world whose bundle cannot be drawn: a plain message that names
 * the field, not a blank page (the host also logs the BundleError). No theme: a bad bundle has no
 * look the engine can trust.
 */
export function BundleProblem({ error }: { error: BundleError }) {
  return (
    <div role="alert" style={{ position: 'fixed', inset: 0, display: 'grid', placeContent: 'center', gap: 8, padding: 24, background: '#111', color: '#eee', font: '16px/1.5 system-ui, sans-serif', textAlign: 'center' }}>
      <strong>This world could not be shown.</strong>
      <span>
        {error.field}: {error.message.replace(/^WorldBundle [^:]*: /, '')}
      </span>
    </div>
  );
}
