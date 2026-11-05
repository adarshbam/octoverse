import { describe, expect, it } from 'vitest';
import { profileFor } from '../fixtures/showcase';
import type { Route } from '../router/routes';
import { type EngineSync, exitFor, exitMove, reported, requested, routeAfterBack, viewToRequest, worldHistoryStep } from './worldHistory';

// Spec 7.9, the half of it that is arithmetic: which stage changes make a history entry, what a browser Back or Forward asks
// the engine for, and where the world's exit control goes. The walk through a real browser is tests/e2e/platform-routes.spec.ts.

const veyra = profileFor('veyra')!;
const profileRoute: Route = { name: 'profile', handle: 'veyra' };

describe('worldHistoryStep: which stage changes push a history entry', () => {
  it('pushes the overview and the detail, as ?view=', () => {
    expect(worldHistoryStep({ view: 'intro' }, 'overview')).toEqual({ push: 'overview' });
    expect(worldHistoryStep({ view: 'overview' }, 'detail')).toEqual({ push: 'detail' });
    // The skip link opens the detail from the intro in one go: one entry, the detail's.
    expect(worldHistoryStep({ view: 'intro' }, 'detail')).toEqual({ push: 'detail' });
  });

  it('never pushes a technology focus, the entrance or the intro', () => {
    for (const view of ['intro', 'overview', 'detail'] as const) {
      expect(worldHistoryStep({ view }, 'techFocus'), `techFocus from ${view}`).toBeNull();
      expect(worldHistoryStep({ view }, 'entering'), `entering from ${view}`).toBeNull();
      expect(worldHistoryStep({ view }, 'intro'), `intro from ${view}`).toBeNull();
    }
  });

  it('pushes nothing for the view the address already shows', () => {
    expect(worldHistoryStep({ view: 'overview' }, 'overview')).toBeNull();
    expect(worldHistoryStep({ view: 'detail' }, 'detail')).toBeNull();
  });

  it("pushes nothing when the engine's own Escape closes the detail: Escape never changes the platform route", () => {
    expect(worldHistoryStep({ view: 'detail' }, 'overview')).toBeNull();
  });

  it('a technology focus on the way to the detail is one entry, the detail', () => {
    // intro -> overview (push), overview -> techFocus (nothing), techFocus -> detail (push): the walk the visitor makes.
    expect(worldHistoryStep({ view: 'overview' }, 'techFocus')).toBeNull();
    expect(worldHistoryStep({ view: 'overview' }, 'detail')).toEqual({ push: 'detail' });
  });
});

describe('viewToRequest: Back and Forward ask the engine for the stage of the entry they land on', () => {
  it('is the view as a stage request with the id given', () => {
    expect(viewToRequest('intro', 1)).toEqual({ id: 1, stage: 'intro' });
    expect(viewToRequest('overview', 2)).toEqual({ id: 2, stage: 'overview' });
    expect(viewToRequest('detail', 7)).toEqual({ id: 7, stage: 'detail' });
  });
});

describe('the walk of spec 7.9: profile, intro, overview, detail are four entries, and three Backs return to the profile', () => {
  it('Back steps detail -> overview -> intro, then leaves the world', () => {
    expect(routeAfterBack('detail')).toBe('overview');
    expect(routeAfterBack('overview')).toBe('intro');
    expect(routeAfterBack('intro')).toBe('leave');
  });
});

describe('exitFor: the world exit control', () => {
  it("names the profile when the profile opened the world, and goes there", () => {
    expect(exitFor(profileRoute, veyra)).toEqual({ label: "Back to Veyra's profile", href: '/@veyra' });
  });

  it('is Back to OctoVerse when Explore opened it', () => {
    expect(exitFor({ name: 'explore' }, veyra)).toEqual({ label: 'Back to OctoVerse', href: '/' });
  });

  it('is Back to OctoVerse with no opener (a link, a reload)', () => {
    expect(exitFor(null, veyra)).toEqual({ label: 'Back to OctoVerse', href: '/' });
  });

  it("is Back to OctoVerse when another profile opened it (the label names the world's own profile only)", () => {
    expect(exitFor({ name: 'profile', handle: 'flux' }, veyra)).toEqual({ label: 'Back to OctoVerse', href: '/' });
  });
});

describe('exitMove: what the exit control does when pressed', () => {
  it('goes Back when the entry before is the page it names (the world was just entered)', () => {
    expect(exitMove({ href: '/@veyra' }, { opener: '/@veyra', depth: 0 })).toBe('back');
  });

  it('pushes the href from a deeper entry, or when the opener is not the page it names', () => {
    expect(exitMove({ href: '/@veyra' }, { opener: '/@veyra', depth: 2 })).toBe('push');
    expect(exitMove({ href: '/' }, { opener: '/explore', depth: 0 })).toBe('push');
    expect(exitMove({ href: '/' }, null)).toBe('push');
  });
});

describe('echoes: the stage the engine reports after a Back or Forward is not a visitor move', () => {
  // The engine answers a stage request a render or two later (longer while its world loads), so a report can arrive after the route has
  // moved on. Pushed as a visitor's deepening it would write an entry the visitor never made (it once pushed `/@veyra?view=overview`).
  it('a stage reported after a request that changed it is that request echo, once', () => {
    let sync: EngineSync = { engine: 'detail', pending: false };
    sync = requested(sync, 'overview');
    expect(sync.pending).toBe(true);
    const first = reported(sync, 'overview');
    expect(first.echo).toBe(true);
    expect(first.sync).toEqual({ engine: 'overview', pending: false });
    // The next report is the visitor's own.
    expect(reported(first.sync, 'detail').echo).toBe(false);
  });

  it('a request for the view the engine is in already has no report to wait for (the stage after Escape, then Back)', () => {
    const sync = requested({ engine: 'overview', pending: false }, 'overview');
    expect(sync.pending).toBe(false);
    expect(reported(sync, 'detail').echo).toBe(false);
  });

  it('a burst of requests is waited out: the report that lags behind the route is an echo, and the final one lands on the view the route is on', () => {
    let sync = requested({ engine: 'detail', pending: false }, 'overview');
    // Asked again before the engine has answered the first: still waiting (the engine may or may not report in between).
    sync = requested(sync, 'intro');
    expect(sync.pending).toBe(true);
    const lagging = reported(sync, 'overview');
    expect(lagging.echo).toBe(true);
    // The route is on the intro by now: the lagging overview must not become an entry, and the intro that follows pushes nothing either.
    expect(worldHistoryStep({ view: 'intro' }, 'intro')).toBeNull();
  });

  it('the entrance is the intro, and a technology focus is no view: it neither answers a request nor moves the engine', () => {
    expect(reported({ engine: 'intro', pending: false }, 'entering').sync.engine).toBe('intro');
    const waiting = requested({ engine: 'overview', pending: false }, 'detail');
    const focus = reported(waiting, 'techFocus');
    expect(focus.echo).toBe(false);
    expect(focus.sync).toEqual(waiting);
  });
});
