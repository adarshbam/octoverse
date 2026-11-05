import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import CreatorRoute from '../creator/CreatorRoute';
import PreviewPage from '../creator/CreatorPreviewPage';
import { profileFor } from '../fixtures/showcase';
import { Explore } from '../pages/Explore';
import { NotFound } from '../pages/NotFound';
import { Profile } from '../pages/Profile';
import type { Route } from '../router/routes';
import WorldPage from '../world/WorldPage';
import { RouteView } from './RouteView';
import { pageKey, titleFor } from './pageKey';

const hasNav = (html: string) => html.includes('class="oct-nav ') && !html.includes('is-hidden');

describe('the navigation bar (spec 7.8)', () => {
  it('shows on every platform page', () => {
    expect(hasNav(renderToStaticMarkup(createElement(Explore)))).toBe(true);
    expect(hasNav(renderToStaticMarkup(createElement(Profile, { profile: profileFor('veyra')! })))).toBe(true);
    expect(hasNav(renderToStaticMarkup(createElement(NotFound)))).toBe(true);
    expect(hasNav(renderToStaticMarkup(createElement(CreatorRoute)))).toBe(true);
    // Through the router's own view: an unknown handle, an unknown project and an unknown path are the not-found page, nav included.
    for (const route of [
      { name: 'profile', handle: 'nobody' },
      { name: 'world', handle: 'veyra', project: 'nope', view: 'intro' },
      { name: 'notFound', path: '/x' },
      { name: 'explore' },
      { name: 'profile', handle: 'flux' },
    ] as Route[]) {
      expect(hasNav(renderToStaticMarkup(createElement(RouteView, { route }))), JSON.stringify(route)).toBe(true);
    }
  });

  it('never shows on a world or the create preview', () => {
    const world = renderToStaticMarkup(createElement(WorldPage, { world: 'veyra', view: 'intro' }));
    expect(world).not.toContain('oct-nav');
    expect(world).toContain('Loading world');
    expect(renderToStaticMarkup(createElement(PreviewPage))).not.toContain('oct-nav');
    // Through the router's own view, while the lazy chunk is loading: the fallback has none either.
    for (const route of [{ name: 'world', handle: 'veyra', project: 'vault-os', view: 'detail' }, { name: 'createPreview', view: 'intro' }] as Route[]) {
      expect(renderToStaticMarkup(createElement(RouteView, { route })), JSON.stringify(route)).not.toContain('oct-nav');
    }
  });
});

describe('pageKey (what a route fade is between)', () => {
  it('keeps the landing and How It Works as one page, and a world across its views', () => {
    expect(pageKey({ name: 'landing' })).toBe(pageKey({ name: 'howItWorks' }));
    expect(pageKey({ name: 'world', handle: 'veyra', project: 'vault-os', view: 'intro' })).toBe(pageKey({ name: 'world', handle: 'veyra', project: 'vault-os', view: 'detail' }));
  });
  it('tells every other pair of pages apart', () => {
    const routes: Route[] = [
      { name: 'landing' }, { name: 'explore' }, { name: 'profile', handle: 'veyra' }, { name: 'profile', handle: 'flux' },
      { name: 'world', handle: 'veyra', project: 'vault-os', view: 'intro' }, { name: 'world', handle: 'flux', project: 'github-pipeline-engine', view: 'intro' },
      { name: 'create' }, { name: 'createPreview', view: 'intro' }, { name: 'notFound', path: '/x' }, { name: 'review', search: '?world=nox' },
    ];
    expect(new Set(routes.map(pageKey)).size).toBe(routes.length);
  });
});

describe('titleFor', () => {
  it('puts the status in the not-found title and names the other pages', () => {
    expect(titleFor({ name: 'notFound', path: '/x' })).toBe('Not found (404) · OctoVerse');
    expect(titleFor({ name: 'profile', handle: 'nobody' })).toBe('Not found (404) · OctoVerse');
    expect(titleFor({ name: 'world', handle: 'veyra', project: 'nope', view: 'intro' })).toBe('Not found (404) · OctoVerse');
    expect(titleFor({ name: 'explore' })).toBe('Explore · OctoVerse');
    expect(titleFor({ name: 'create' })).toBe('Create · OctoVerse');
    expect(titleFor({ name: 'profile', handle: 'veyra' })).toBe('Veyra · OctoVerse');
  });
  it('leaves the landing, How It Works, a world and a review to the host', () => {
    expect(titleFor({ name: 'landing' })).toBeNull();
    expect(titleFor({ name: 'howItWorks' })).toBeNull();
    expect(titleFor({ name: 'world', handle: 'veyra', project: 'vault-os', view: 'intro' })).toBeNull();
    expect(titleFor({ name: 'review', search: '?world=nox' })).toBeNull();
  });
});
