import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import { NOX_BUNDLE } from '../../worlds/nox/bundle';
import { defaultReviewOptions } from '../behavior/urlState';
import { BundleError, type WorldBundle } from '../types/bundle';
import { BundleProblem, checkBundle } from './bundleProblem';
import { WorldHost } from './WorldHost';

const broken = { ...NOX_BUNDLE, theme: { ...NOX_BUNDLE.theme, poster: undefined } } as unknown as WorldBundle;

test('checkBundle gives the valid bundle, or the BundleError that names the field; anything else is a bug and goes on up', () => {
  const ok = checkBundle(NOX_BUNDLE);
  expect(ok.error).toBeUndefined();
  expect(ok.valid?.id).toBe('nox');
  const bad = checkBundle(broken);
  expect(bad.valid).toBeUndefined();
  expect(bad.error).toBeInstanceOf(BundleError);
  expect(bad.error?.field).toBe('theme.poster');
  expect(() => checkBundle(null as unknown as WorldBundle)).toThrow(TypeError);
});

test('a bundle that cannot be validated shows a plain message that names the field, not a blank page', () => {
  const error = checkBundle(broken).error!;
  const html = renderToStaticMarkup(createElement(BundleProblem, { error }));
  expect(html).toContain('role="alert"');
  expect(html).toContain('This world could not be shown.');
  expect(html).toContain('theme.poster');
});

test('WorldHost renders that message for a bad bundle (and mounts no instance)', () => {
  const html = renderToStaticMarkup(createElement(WorldHost, { bundle: broken, options: defaultReviewOptions() }));
  expect(html).toContain('This world could not be shown.');
  expect(html).toContain('theme.poster');
  expect(html).not.toContain('<canvas');
});
