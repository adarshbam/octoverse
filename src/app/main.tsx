import { createRoot } from 'react-dom/client';
import { Page } from './Page';
import { parseUrlState } from '../engine/behavior/urlState';
import { resolveWorld } from '../worlds';

// The host reads the address once; everything below gets it as a prop (no engine module reads the location).
const options = parseUrlState(window.location.search);
// `?world=<id>` picks the world (an unknown id shows Nox, with a warning here, not a blank page).
const { bundle, warning } = resolveWorld(window.location.search);
if (warning) console.warn(warning);

// Theatre studio is a dev tool: the literal DEV check lets the bundler drop the import from production.
if (import.meta.env.DEV && options.studio) {
  void import('@theatre/studio').then(module => {
    // The package is CommonJS: through the dev server's interop its studio is `default.default`.
    const studio = 'initialize' in module.default ? module.default : (module.default as unknown as { default: typeof module.default }).default;
    studio.initialize();
  });
}

createRoot(document.getElementById('root')!).render(<Page first={bundle} options={options} />);
