import { type ComponentProps, createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { NOX_BUNDLE } from '../bundle.nox';
import type { ArtifactConfig, StageId } from '../../engine/config/types';
import { EngineInstance } from '../host/EngineInstance';
import { TechChoices } from './TechChoices';

// The host's wiring of `choiceRemoved` (host/WorldHost.tsx): the buttons and the tray are drawn
// only in a stage the world lets a technology be chosen in; the tooltips between them always are.

const orbs = [{ techId: 'react', name: 'React' }];
const items = [{ techId: 'vite', name: 'Vite', iconKey: 'vite' }];

function render(stage: StageId, choosableIn: ArtifactConfig['choosableIn']) {
  const choices = createElement(
    TechChoices,
    {
      stage,
      artifacts: { choosableIn },
      buttons: { orbs, open: true, focused: null, tooltipId: 'tip', onChoose: () => {} },
      tray: { items, open: true, tooltipId: 'tip', onChoose: () => {} },
    },
    createElement('div', { className: 'tooltip-here' }),
  );
  // The children go as createElement's third argument (the props type requires them).
  const props = { bundle: NOX_BUNDLE, mode: 'preview' } as ComponentProps<typeof EngineInstance>;
  return renderToStaticMarkup(createElement(EngineInstance, props, choices));
}

test('in a stage a technology can be chosen in, the buttons, the tooltips and the tray are drawn, in that order', () => {
  const html = render('intro', ['intro', 'overview']);
  const [buttons, tip, tray] = ['orb-buttons', 'tooltip-here', 'orb-tray'].map(name => html.indexOf(name));
  expect(buttons).toBeGreaterThanOrEqual(0);
  expect(tip).toBeGreaterThan(buttons);
  expect(tray).toBeGreaterThan(tip);
  expect(html).toContain('aria-label="React"');
  expect(html).toContain('aria-label="Vite"');
});

test('in a stage the world does not let a technology be chosen in, there are no buttons and no tray, and the tooltips stay', () => {
  // Choosable only in the overview (Aether's case): the intro draws neither.
  const html = render('intro', ['overview']);
  expect(html).not.toContain('orb-buttons');
  expect(html).not.toContain('orb-tray');
  expect(html).toContain('tooltip-here');
  // The detail is not a choosing stage: the buttons stay (hidden), as they always have.
  expect(render('detail', ['intro', 'overview'])).toContain('orb-buttons');
  // A technology focus keeps the stage it came from (the host passes `shown`), so it is drawn there.
  expect(render('overview', ['overview'])).toContain('orb-tray');
});
