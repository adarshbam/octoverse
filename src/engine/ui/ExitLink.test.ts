import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { ExitLink } from './ExitLink';

test('the exit link is an anchor to the given href, with the given label', () => {
  const html = renderToStaticMarkup(createElement(ExitLink, { label: 'Back to the hub', href: '/hub' }));
  expect(html).toBe('<a class="exit-link" href="/hub">Back to the hub</a>');
});

test('the label is text, not markup', () => {
  expect(renderToStaticMarkup(createElement(ExitLink, { label: '<b>x</b>', href: '/' }))).toContain('&lt;b&gt;x&lt;/b&gt;');
});
