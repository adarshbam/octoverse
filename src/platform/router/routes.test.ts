import { describe, expect, it } from 'vitest';
import { RESERVED_HANDLES, buildPath, parseRoute, type Route } from './routes';

const parse = (path: string, search = '') => parseRoute(path, search);

describe('parseRoute', () => {
  it('maps the static routes', () => {
    expect(parse('/').route).toEqual({ name: 'landing' });
    expect(parse('/how-it-works').route).toEqual({ name: 'howItWorks' });
    expect(parse('/explore').route).toEqual({ name: 'explore' });
    expect(parse('/create').route).toEqual({ name: 'create' });
    expect(parse('/create/preview').route).toEqual({ name: 'createPreview', view: 'intro' });
  });

  it('tolerates one trailing slash except on root', () => {
    expect(parse('/explore/').route).toEqual({ name: 'explore' });
    expect(parse('/create/preview/').route).toEqual({ name: 'createPreview', view: 'intro' });
    expect(parse('/@veyra/').route).toEqual({ name: 'profile', handle: 'veyra' });
    expect(parse('/@veyra/vault-os/').route).toMatchObject({ name: 'world', project: 'vault-os' });
    expect(parse('/').route).toEqual({ name: 'landing' });
  });

  it('routes review query params on root', () => {
    const r = parse('/', '?world=veyra&freeze');
    expect(r.route).toEqual({ name: 'review', search: '?world=veyra&freeze' });
    expect(r.replace).toBeUndefined();
    expect(parse('/', '?creator=1').route).toEqual({ name: 'review', search: '?creator=1' });
    expect(parse('/', '?freeze').route).toEqual({ name: 'landing' });
  });

  it('parses profiles and worlds', () => {
    expect(parse('/@nox').route).toEqual({ name: 'profile', handle: 'nox' });
    expect(parse('/@veyra/vault-os').route).toEqual({
      name: 'world', handle: 'veyra', project: 'vault-os', view: 'intro',
    });
    expect(parse('/@veyra/vault-os', '?view=detail').route).toMatchObject({ view: 'detail' });
    expect(parse('/@veyra/vault-os', '?view=overview').route).toMatchObject({ view: 'overview' });
    expect(parse('/@veyra/vault-os', '?view=detail').replace).toBeUndefined();
  });

  it('falls back to intro and canonicalises bad views', () => {
    for (const bad of ['techFocus', 'x']) {
      const r = parse('/@veyra/vault-os', `?view=${bad}`);
      expect(r.route).toMatchObject({ name: 'world', view: 'intro' });
      expect(r.replace).toBe('/@veyra/vault-os');
    }
  });

  it('keeps other search params when canonicalising', () => {
    const r = parse('/@veyra/vault-os', '?view=x&a=1');
    expect(r.replace).toBe('/@veyra/vault-os?a=1');
  });

  it('the create preview has views like a world, keeps its project parameter, and canonicalises a bad view', () => {
    expect(parse('/create/preview', '?view=detail').route).toEqual({ name: 'createPreview', view: 'detail' });
    expect(parse('/create/preview', '?project=beta&view=overview')).toEqual({ route: { name: 'createPreview', view: 'overview' } });
    expect(parse('/create/preview', '?project=beta').route).toEqual({ name: 'createPreview', view: 'intro' });
    for (const bad of ['techFocus', 'x', '']) {
      const r = parse('/create/preview', `?view=${bad}&project=beta`);
      expect(r.route).toEqual({ name: 'createPreview', view: 'intro' });
      expect(r.replace).toBe('/create/preview?project=beta');
    }
    expect(parse('/create/preview', '?view=x').replace).toBe('/create/preview');
  });

  it('rejects bad handles and projects', () => {
    expect(parse('/@explore').route).toEqual({ name: 'notFound', path: '/@explore' });
    expect(parse('/@Nox').route).toEqual({ name: 'notFound', path: '/@Nox' });
    expect(parse('/@a').route.name).toBe('notFound');
    expect(parse('/@1abc').route.name).toBe('notFound');
    expect(parse('/@veyra/NOPE').route).toEqual({ name: 'notFound', path: '/@veyra/NOPE' });
    expect(parse('/@veyra/' + 'a'.repeat(41)).route.name).toBe('notFound');
    expect(parse('/@veyra/' + 'a'.repeat(40)).route.name).toBe('world');
    expect(parse('/@veyra/a/b').route.name).toBe('notFound');
  });

  it('rejects all reserved handles', () => {
    expect(RESERVED_HANDLES).toHaveLength(8);
    for (const h of RESERVED_HANDLES) {
      expect(parse(`/@${h}`).route).toEqual({ name: 'notFound', path: `/@${h}` });
    }
  });

  it('returns notFound with the path for unknown paths', () => {
    expect(parse('/nope/else').route).toEqual({ name: 'notFound', path: '/nope/else' });
  });

  it('a double slash is not the landing: it is not found, with the path as typed', () => {
    expect(parse('//').route).toEqual({ name: 'notFound', path: '//' });
    expect(parse('//explore').route).toEqual({ name: 'notFound', path: '//explore' });
    expect(parse('/explore//').route).toEqual({ name: 'notFound', path: '/explore//' });
    expect(parse('///').route).toEqual({ name: 'notFound', path: '///' });
    expect(parse('/@veyra//vault-os').route.name).toBe('notFound');
    // One trailing slash is still tolerated.
    expect(parse('/explore/').route).toEqual({ name: 'explore' });
  });
});

describe('buildPath', () => {
  it('builds each route', () => {
    expect(buildPath({ name: 'landing' })).toBe('/');
    expect(buildPath({ name: 'howItWorks' })).toBe('/how-it-works');
    expect(buildPath({ name: 'explore' })).toBe('/explore');
    expect(buildPath({ name: 'profile', handle: 'nox' })).toBe('/@nox');
    expect(buildPath({ name: 'world', handle: 'a1', project: 'p', view: 'intro' })).toBe('/@a1/p');
    expect(buildPath({ name: 'world', handle: 'a1', project: 'p', view: 'overview' })).toBe('/@a1/p?view=overview');
    expect(buildPath({ name: 'world', handle: 'a1', project: 'p', view: 'detail' })).toBe('/@a1/p?view=detail');
    expect(buildPath({ name: 'create' })).toBe('/create');
    expect(buildPath({ name: 'createPreview', view: 'intro' })).toBe('/create/preview');
    expect(buildPath({ name: 'createPreview', view: 'overview' })).toBe('/create/preview?view=overview');
    expect(buildPath({ name: 'notFound', path: '/x/y' })).toBe('/x/y');
    expect(buildPath({ name: 'review', search: '?world=veyra' })).toBe('/?world=veyra');
  });

  it('round-trips every route', () => {
    const cases: Array<[string, string]> = [
      ['/', ''], ['/how-it-works', ''], ['/explore', ''], ['/@nox', ''],
      ['/@veyra/vault-os', ''], ['/@veyra/vault-os', '?view=overview'],
      ['/@veyra/vault-os', '?view=detail'], ['/create', ''], ['/create/preview', ''], ['/create/preview', '?view=overview'], ['/create/preview', '?view=detail'],
      ['/nope/else', ''], ['/@Nox', ''], ['/', '?world=veyra&freeze'],
    ];
    for (const [p, s] of cases) {
      const route: Route = parseRoute(p, s).route;
      expect(buildPath(route)).toBe(p + s);
    }
  });
});
