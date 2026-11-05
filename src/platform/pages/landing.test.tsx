import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { InstanceApiContext, type InstanceApi } from '../../engine/host/useInstanceApi';
import { stageBoxFor } from '../../engine/ui/useStageBox';
import { HOST_BUNDLE } from '../../worlds/octoverse/bundle';
import { HOW_IT_WORKS_CARDS } from '../../worlds/octoverse/poses';
import { HowItWorks } from './HowItWorks';
import { LandingText } from './LandingText';
import { Nav } from './Nav';
import { YourOctopusPicture } from './YourOctopusPicture';
import { PLATFORM_TOKENS } from '../ui/tokens';
import { cardRect, faceRects, hostBox, stageRect } from './geometry';

// Server rendering stands in for jsdom (not installed): the components render to markup with a stand-in
// instance API, so what they say and in what order is checked without a browser. Places on screen are
// the end-to-end spec's (tests/e2e/platform-landing.spec.ts).

const api = (stage: InstanceApi['stage']): InstanceApi => ({
  stage,
  faceAnchor: [0, -0.56, 0.71],
  liveShift: () => ({ dx: 0, dy: 0 }),
  explore() {},
  back() {},
  skip() {},
  attend() {},
});
const inHost = (stage: InstanceApi['stage'], child: React.ReactElement) => renderToStaticMarkup(createElement(InstanceApiContext.Provider, { value: api(stage) }, child));
const noop = () => {};
const textOf = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const buttonsIn = (html: string) => [...html.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/g)].map(m => textOf(m[1]));

describe('the intro text', () => {
  const html = inHost('intro', createElement(LandingText, { onSeeHow: noop, onCreate: noop }));

  it('says the wordmark, the tagline, the description and the pill, word for word', () => {
    expect(html).toContain('OCTOVERSE');
    expect(html).toContain('Create. Showcase. Belong.');
    expect(html).toContain('A platform to create your own animated developer portfolio with unique octopus characters, themes and project showcases.');
    expect(html).toContain('Your Ideas. Your Octopus. Your Universe.');
  });

  it('has two buttons, See how it works then Create yours, and the pill is text, not a button', () => {
    expect(buttonsIn(html)).toEqual(['See how it works', 'Create yours']);
    expect(buttonsIn(html).join(' ')).not.toContain('Your Ideas');
  });

  it('takes the title from the host project, not from a second copy of the words', () => {
    expect(HOST_BUNDLE.content.project.name).toBe('OctoVerse');
    expect(HOST_BUNDLE.content.project.tagline).toBe('Create. Showcase. Belong.');
  });

  it('can be hidden: out of the focus order and the reading order', () => {
    const hidden = inHost('overview', createElement(LandingText, { onSeeHow: noop, onCreate: noop, hidden: true }));
    expect(hidden).toContain('inert');
    expect(hidden).toContain('aria-hidden="true"');
  });
});

describe('How It Works', () => {
  const html = inHost('overview', createElement(HowItWorks, { onOpen: noop }));
  const labels = [...html.matchAll(/<button\b[^>]*aria-label="([^"]*)"/g)].map(m => m[1]);

  it('has five buttons in reading order: Veyra, Flux, Nox, Aether, Your Octopus', () => {
    expect([...html.matchAll(/<button\b/g)]).toHaveLength(5);
    expect(labels).toEqual(['Veyra, The Keeper of Files', 'Flux, The Pipeline Runner', 'Nox, The Watcher', 'Aether, The Curious Mind', 'Your Octopus, Your Story']);
  });

  it('shows each name and epithet on its card (the epithets are the worlds own, not the storyboard)', () => {
    const cards = buttonsIn(html);
    expect(cards).toEqual(['Veyra The Keeper of Files', 'Flux The Pipeline Runner', 'Nox The Watcher', 'Aether The Curious Mind', 'Your Octopus Your Story']);
  });

  it('puts an engine still on the four worlds cards and the gold glyph card on Your Octopus until the draft is read (yourOctopusPicture.test.tsx has the rest)', () => {
    const cards = [...html.matchAll(/<button\b[\s\S]*?<\/button>/g)].map(m => m[0]);
    for (const [i, id] of ['veyra', 'flux', 'nox', 'aether'].entries()) {
      expect(cards[i]).toContain(`src="/platform/stills/${id}.webp"`);
      expect(cards[i]).not.toContain('data-glyph');
    }
    expect(cards[4]).toContain('data-glyph="octopus"');
    expect(cards[4]).not.toContain('<img');
  });

  it('has one heading, How it works, for the screen reader (the wordmark heading is hidden here)', () => {
    expect([...html.matchAll(/<h1[^>]*>([^<]*)<\/h1>/g)].map(m => m[1])).toEqual(['How it works']);
  });

  it('links to Explore all portfolios', () => {
    expect(html).toMatch(/<a\b[^>]*href="\/explore"[^>]*>Explore all portfolios<\/a>/);
  });

  it('the glyph card stands alone too', () => {
    const picture = renderToStaticMarkup(createElement(YourOctopusPicture));
    expect(picture).toContain('data-glyph="octopus"');
    expect(picture).toContain('aria-hidden="true"');
  });
});

describe('the navigation bar', () => {
  it('has the wordmark (home), Explore and Create, and nothing else', () => {
    const html = renderToStaticMarkup(createElement(Nav, {}));
    const links = [...html.matchAll(/<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g)].map(m => [m[1], textOf(m[2])]);
    expect(links).toEqual([['/', 'OctoVerse'], ['/explore', 'Explore'], ['/create', 'Create']]);
  });
});

describe('the tokens', () => {
  it("hold spec 7.10's title gradient stops, in order", () => {
    expect(PLATFORM_TOKENS.titleGradient.stops).toEqual(['#f9dad4', '#ffaaee', '#ffa3fa', '#ea8df5', '#67b3f0', '#82a6fd', '#9d99f3']);
  });
  it('have a glass surface, border and glow, and the lavender focus ring', () => {
    expect(PLATFORM_TOKENS.glass.surface).toBeTruthy();
    expect(PLATFORM_TOKENS.glass.border).toBeTruthy();
    expect(PLATFORM_TOKENS.glass.glow).toBeTruthy();
    expect(PLATFORM_TOKENS.focusRing).toBe('#d8c8ff');
  });
});

describe('glass.css', () => {
  const css = readFileSync(join(import.meta.dirname, '..', 'ui', 'glass.css'), 'utf8');
  it("carries the tokens' gradient, glass and focus ring as the same values", () => {
    const gradient = /--oct-title-gradient:\s*([^;]+);/.exec(css)![1];
    expect(gradient).toBe(PLATFORM_TOKENS.titleGradient.css);
    expect(css).toContain(`--oct-glass: ${PLATFORM_TOKENS.glass.surface};`);
    expect(css).toContain(`--oct-glass-border: ${PLATFORM_TOKENS.glass.border};`);
    expect(css).toContain(`--oct-glass-glow: ${PLATFORM_TOKENS.glass.glow};`);
    expect(css).toContain(`--oct-focus: ${PLATFORM_TOKENS.focusRing};`);
  });
});

describe('the geometry in stage units', () => {
  const frame = HOST_BUNDLE.stage.frames.overview;
  const sizes = [{ width: 1536, height: 1024 }, { width: 768, height: 1024 }, { width: 390, height: 464 }, { width: 800, height: 600 }];

  it("agrees with the engine's own projection of a stage box", () => {
    for (const size of sizes) {
      const box = [-1.94, 1.12, -0.97, -0.1] as const;
      const mine = stageRect(frame, size, box);
      const theirs = stageBoxFor(frame, box, size);
      expect(mine.left).toBeCloseTo(theirs.left, 4);
      expect(mine.top).toBeCloseTo(theirs.top, 4);
      expect(mine.width).toBeCloseTo(theirs.width, 4);
      expect(mine.height).toBeCloseTo(theirs.height, 4);
    }
  });

  it('makes the host box the upper 55% of a phone and the whole window otherwise', () => {
    expect(hostBox({ width: 390, height: 844 })).toEqual({ width: 390, height: 464, phone: true });
    expect(hostBox({ width: 768, height: 1024 })).toEqual({ width: 768, height: 1024, phone: false });
    expect(hostBox({ width: 1536, height: 1024 })).toEqual({ width: 1536, height: 1024, phone: false });
  });

  it('keeps all five cards on the screen and apart from the face at the three sizes', () => {
    for (const win of [{ width: 1536, height: 1024 }, { width: 768, height: 1024 }]) {
      const box = hostBox(win);
      const face = faceRects(frame, box, HOST_BUNDLE, 'overview');
      for (const card of HOW_IT_WORKS_CARDS) {
        const r = cardRect(card, frame, box);
        expect(r.left, `${card.id} at ${win.width}`).toBeGreaterThanOrEqual(0);
        expect(r.right, `${card.id} at ${win.width}`).toBeLessThanOrEqual(win.width);
        for (const part of [...face.eyes, face.mouth]) {
          const apart = r.right <= part.left || r.left >= part.right || r.bottom <= part.top || r.top >= part.bottom;
          expect(apart, `${card.id} against the face at ${win.width}`).toBe(true);
        }
      }
    }
  });
});

describe('the landing chunk', () => {
  it('imports no world but the host, and from the others only their content modules', () => {
    const dir = import.meta.dirname;
    const platform = join(dir, '..');
    const files = [...readdirSync(dir), ...readdirSync(join(platform, 'ui')).map(f => `../ui/${f}`)].filter(f => /\.tsx?$/.test(f) && !/\.test\./.test(f));
    expect(files.length).toBeGreaterThan(5);
    for (const file of files) {
      const source = readFileSync(join(dir, file), 'utf8');
      for (const m of source.matchAll(/from\s+'([^']*worlds\/[^']*)'/g)) {
        const spec = m[1];
        const ok = /worlds\/octoverse\//.test(spec) || /worlds\/(nox|veyra|flux|aether)\/content\/(nox|veyra|flux|aether)$/.test(spec);
        expect(ok, `${file} imports ${spec}`).toBe(true);
      }
    }
  });
});
