import { createRoot } from 'react-dom/client';
import { Page } from './Page';
import { parseUrlState } from '../engine/behavior/urlState';
import { PlatformApp } from '../platform/App';
import { parseRoute } from '../platform/router/routes';
import { resolveWorld } from '../worlds';

/**
 * The review switches that still mean "the engine's own page" on `/` (they are the engine's review and
 * debug switches, and every capture script and Nox's own specs use them without a `?world=`): with any
 * of them the page mounts the host exactly as it did before the platform. The platform's landing takes
 * only the switches that make sense on it (`freeze`, `t`, `hover`, `tier`, `kitwait`).
 */
const ENGINE_SWITCHES = ['stage', 'tech', 'expression', 'view', 'orbit', 'nowebgl', 'tilt', 'yaw', 'pose', 'fixture', 'variant', 'testworld', 'mask', 'solo', 'studio', 'blow', 'swell', 'hold', 'pulse'];

/** Whether this address is a review of one world (the engine's page) and not a route of the platform. */
function isWorldReview(pathname: string, search: string) {
  const { route } = parseRoute(pathname, search);
  if (route.name === 'review') return true;
  const params = new URLSearchParams(search);
  return pathname === '/' && ENGINE_SWITCHES.some(key => params.has(key));
}

// The host reads the address once; everything below gets it as a prop (no engine module reads the location).
const options = parseUrlState(window.location.search);

// Theatre studio is a dev tool: the literal DEV check lets the bundler drop the import from production.
if (import.meta.env.DEV && options.studio) {
  void import('@theatre/studio').then(module => {
    // The package is CommonJS: through the dev server's interop its studio is `default.default`.
    const studio = 'initialize' in module.default ? module.default : (module.default as unknown as { default: typeof module.default }).default;
    studio.initialize();
  });
}

if (isWorldReview(window.location.pathname, window.location.search)) {
  // `?world=<id>` picks the world (an unknown id shows Nox, with a warning here, not a blank page).
  const { bundle, warning } = resolveWorld(window.location.search);
  if (warning) console.warn(warning);
  createRoot(document.getElementById('root')!).render(<Page first={bundle} options={options} />);
} else {
  // The static page holds Nox's boot veil ("Security Lab" and the flame) for a page that shows Nox; the platform is not Nox.
  document.documentElement.setAttribute('data-boot-world', 'other');
  document.querySelector('#boot-veil .bv-title')?.remove();
  createRoot(document.getElementById('root')!).render(<PlatformApp />);
}
