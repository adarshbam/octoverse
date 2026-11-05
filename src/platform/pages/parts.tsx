import type { ReactNode } from 'react';
import type { PaletteId, TemplateId } from '../creator/types';
import type { ShowcaseWorld } from '../fixtures/worldContent';
import { stillFor } from '../stills/stills';
import { Nav } from './Nav';
import '../ui/glass.css';
import './landing.css';
import './pages.css';

/** The text every showcase page and tile carries (spec 2.5): these portfolios are examples by the OctoVerse team, not users'. */
export const SHOWCASE_FOOTER = 'Showcase portfolios by the OctoVerse team.';

/** The badge every showcase profile and tile carries (spec 2.5; P5's "Pro" is not a thing here). */
export function Badge() {
  return <span className="oct-badge">Showcase</span>;
}

/** Technology chips, in the order given. */
export function Chips({ names, label }: { names: readonly string[]; label?: string }) {
  return (
    <ul className="oct-chips" aria-label={label}>
      {names.map(name => (
        <li key={name} className="oct-chip">
          {name}
        </li>
      ))}
    </ul>
  );
}

/** A world's engine still of its intro (spec 7.14): the octopus is in the middle of the picture, with water above it that the crop trims. */
export function WorldStill({ world }: { world: ShowcaseWorld }) {
  const still = stillFor({ kind: 'world', world });
  return <img className="oct-still" src={still.src} width={still.width} height={still.height} alt="" decoding="async" draggable={false} />;
}

/** A creator still (spec 7.14): one template in one palette, rendered by the engine; a still shows no personality. */
export function CreatorStill({ template, palette, alt = '' }: { template: TemplateId; palette: PaletteId; alt?: string }) {
  const still = stillFor({ kind: 'creator', template, palette });
  return <img className="oct-still" src={still.src} width={still.width} height={still.height} alt={alt} decoding="async" draggable={false} />;
}

/**
 * The frame of the static pages (profile, explore, not found): the reef's water behind everything, the navigation bar, the
 * skip link, the page's one main landmark and an optional footer. No live host here (Task 13 adds the previews).
 */
export function PageFrame({ children, footer = true, centered = false }: { children: ReactNode; footer?: boolean; centered?: boolean }) {
  return (
    <div className="oct-root oct-page">
      <a className="oct-skip-link oct-button" href="#oct-main">
        Skip to main content
      </a>
      <Nav />
      <main id="oct-main" tabIndex={-1} className={`oct-page-main${centered ? ' is-centered' : ''}`}>
        {children}
      </main>
      {footer && <footer className="oct-page-footer">{SHOWCASE_FOOTER}</footer>}
    </div>
  );
}
