import { createRoot } from 'react-dom/client';
import { App } from './App';
import { parseUrlState } from '../engine/behavior/urlState';

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

createRoot(document.getElementById('root')!).render(<App options={options} />);
