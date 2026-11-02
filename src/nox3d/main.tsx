import { createRoot } from 'react-dom/client';
import { App } from './App';
import { parseUrlState } from './behavior/urlState';

// Theatre studio is a dev tool: the literal DEV check lets the bundler drop the import from production.
if (import.meta.env.DEV && parseUrlState(window.location.search).studio) {
  void import('@theatre/studio').then(({ default: studio }) => {
    studio.initialize();
  });
}

createRoot(document.getElementById('root')!).render(<App />);
