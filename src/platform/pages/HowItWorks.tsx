import { type CSSProperties, useEffect, useMemo, useRef, useState } from 'react';
import { type InstanceApi, useInstanceApi } from '../../engine/host/useInstanceApi';
import { LivePicture, type PreviewOptions } from '../previews/LivePicture';
import { usePrefersReducedMotion } from '../previews/useCanPreview';
import { useHot } from '../previews/useHot';
import { HOST_BUNDLE } from '../../worlds/octoverse/bundle';
import { HOW_IT_WORKS_CARDS, type HowItWorksCard } from '../../worlds/octoverse/poses';
// Each world's own name and epithet: the content module only (a bare data file), never the world's bundle,
// so the landing's chunk holds no other world's kit or Theatre state.
import { aether } from '../../worlds/aether/content/aether';
import { flux } from '../../worlds/flux/content/flux';
import { nox } from '../../worlds/nox/content/nox';
import { veyra } from '../../worlds/veyra/content/veyra';
import { PLATFORM_TOKENS } from '../ui/tokens';
import { Link } from '../ui/Link';
import { stageRect } from './geometry';
import { useHostBox, useShift } from './hooks';
import { YOURS } from './yours';
import { YourOctopusPicture } from './YourOctopusPicture';
import '../ui/glass.css';
import './landing.css';

export type CardId = HowItWorksCard['id'];

/** What each card says: the world's own name and epithet (spec 7.10: the world's spec, not the storyboard, where they differ). Your Octopus has no world until the creator exists. */
const CARD_TEXT: Record<CardId, { name: string; epithet: string }> = {
  veyra: { name: veyra.name, epithet: veyra.epithet },
  flux: { name: flux.name, epithet: flux.epithet },
  nox: { name: nox.name, epithet: nox.epithet },
  aether: { name: aether.name, epithet: aether.epithet },
  yours: YOURS,
};

/** Where a card goes: its world's profile, and the creator for the visitor's own. */
export const CARD_HREF: Record<CardId, string> = { veyra: '/@veyra', flux: '/@flux', nox: '/@nox', aether: '/@aether', yours: '/create' };

/** How a card's preview is drawn (spec 7.10): the world's intro, ambient, its water only, no artifacts, at tier low at most. */
export const CARD_PREVIEW: PreviewOptions = { stage: 'intro', motion: 'ambient', place: 'backdrop', artifacts: 'hidden', tierCap: 'low' };

/** Who the host is looking at: a card makes itself the one, and only the one releases the gaze (a card left after its neighbour was entered leaves it alone). */
type Attend = { to(id: CardId, el: HTMLElement): void; release(id: CardId): void };

/** The centre of `el` in the host canvas's CSS pixels (the instance API's `attend` target), or null when the host has no canvas on the page. */
function centreInCanvas(el: HTMLElement): { x: number; y: number } | null {
  const canvas = [...(el.closest('.oct-landing') ?? document).querySelectorAll('canvas')].find(c => !c.closest('.oct-live-layer'));
  if (!canvas) return null;
  const c = canvas.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2 - c.left, y: r.top + r.height / 2 - c.top };
}

function Card({ card, index, placed, look, api, onOpen, attend }: { card: HowItWorksCard; index: number; placed: boolean; look: boolean; api: InstanceApi; onOpen: (href: string) => void; attend: Attend }) {
  const item = useRef<HTMLLIElement>(null);
  // The preview's layer is drawn beside the card's button, over its picture, not inside it: the engine's instance has buttons of its own.
  const [live, setLive] = useState<HTMLSpanElement | null>(null);
  const box = useHostBox();
  const { hot, handlers } = useHot();
  const { x0, y0, x1, y1 } = card.box;
  // Each card keeps its place against the stage as the camera hovers: the shift of its centre.
  useShift(item, api, [(x0 + x1) / 2, (y0 + y1) / 2, 0], placed);
  // Hover or keyboard focus: the host looks at the card and the nearest arm reaches toward it; leaving (or the card going) lets both go.
  const gaze = look && hot;
  useEffect(() => {
    if (!gaze || !item.current) return;
    attend.to(card.id, item.current);
    return () => attend.release(card.id);
  }, [gaze, attend, card.id]);
  const text = CARD_TEXT[card.id];
  const rect = placed ? stageRect(HOST_BUNDLE.stage.frames.overview, box, [x0, y0, x1, y1]) : null;
  const style = { '--accent': PLATFORM_TOKENS.accents[card.id], '--i': index, ...(rect && { left: rect.left, top: rect.top, width: rect.width, height: rect.height }) } as CSSProperties;
  return (
    <li ref={item} className="oct-card-item" style={style} data-card={card.id} {...handlers}>
      <button type="button" className="oct-card" aria-label={`${text.name}, ${text.epithet}`} onClick={() => onOpen(CARD_HREF[card.id])}>
        <span className="oct-card-picture">
          {/* Your Octopus stays the gold glyph card: it has no rendered octopus, so no live one until the creator exists (J01). */}
          {card.id === 'yours' ? <YourOctopusPicture /> : <LivePicture still={{ kind: 'world', world: card.id }} world={card.id} options={CARD_PREVIEW} live={hot} into={live} />}
        </span>
        <span className="oct-card-caption">
          <b>{text.name}</b>
          <span>{text.epithet}</span>
        </span>
      </button>
      {card.id !== 'yours' && <span ref={setLive} className="oct-card-live" aria-hidden="true" />}
    </li>
  );
}

/**
 * How It Works (P3): the five cards, in reading order, each a button holding a still of that world's
 * octopus and its name and epithet, with the "Explore all portfolios" link below them. On a desktop
 * or tablet each card stands where P3 has it, in stage units, and follows the stage as the camera
 * hovers; on a phone the cards are a snap row below the host (spec 7.15).
 */
export function HowItWorks({ onOpen }: { onOpen: (href: string) => void }) {
  const api = useInstanceApi();
  const box = useHostBox();
  const reduced = usePrefersReducedMotion();
  const latest = useRef(api);
  useEffect(() => {
    latest.current = api;
  });
  // The gaze follows the card entered last: leaving a card lets go only if it is still the one attended.
  const attending = useRef<CardId | null>(null);
  const attend = useMemo<Attend>(
    () => ({
      to(id, el) {
        const target = centreInCanvas(el);
        if (!target) return;
        attending.current = id;
        latest.current.attend(target, { reach: true });
      },
      release(id) {
        if (attending.current !== id) return;
        attending.current = null;
        latest.current.attend(null);
      },
    }),
    [],
  );
  return (
    <>
      {/* The intro's wordmark heading is hidden here: the page keeps one heading, for the screen reader. */}
      <h1 className="oct-sr-only">How it works</h1>
      <ul className="oct-cards" data-layout={box.phone ? 'row' : 'stage'} aria-label="Example portfolios">
        {HOW_IT_WORKS_CARDS.map((card, i) => (
          <Card key={card.id} card={card} index={i} placed={!box.phone} look={!box.phone && !reduced} api={api} onOpen={onOpen} attend={attend} />
        ))}
      </ul>
      <Link href="/explore" className="oct-explore">
        Explore all portfolios
      </Link>
    </>
  );
}
