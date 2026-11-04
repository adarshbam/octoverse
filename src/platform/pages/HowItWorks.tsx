import { type CSSProperties, useRef } from 'react';
import { type InstanceApi, useInstanceApi } from '../../engine/host/useInstanceApi';
import { stillFor } from '../stills/stills';
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

/** A world's engine still of its intro (spec 7.14): the octopus is in the middle of the picture, with water above it that the crop trims. */
function WorldStill({ world }: { world: Exclude<CardId, 'yours'> }) {
  const still = stillFor({ kind: 'world', world });
  return <img className="oct-still" src={still.src} width={still.width} height={still.height} alt="" decoding="async" draggable={false} />;
}

function Card({ card, index, placed, api, onOpen }: { card: HowItWorksCard; index: number; placed: boolean; api: InstanceApi; onOpen: (href: string) => void }) {
  const item = useRef<HTMLLIElement>(null);
  const box = useHostBox();
  const { x0, y0, x1, y1 } = card.box;
  // Each card keeps its place against the stage as the camera hovers: the shift of its centre.
  useShift(item, api, [(x0 + x1) / 2, (y0 + y1) / 2, 0], placed);
  const text = CARD_TEXT[card.id];
  const rect = placed ? stageRect(HOST_BUNDLE.stage.frames.overview, box, [x0, y0, x1, y1]) : null;
  const style = { '--accent': PLATFORM_TOKENS.accents[card.id], '--i': index, ...(rect && { left: rect.left, top: rect.top, width: rect.width, height: rect.height }) } as CSSProperties;
  return (
    <li ref={item} className="oct-card-item" style={style} data-card={card.id}>
      <button type="button" className="oct-card" aria-label={`${text.name}, ${text.epithet}`} onClick={() => onOpen(CARD_HREF[card.id])}>
        <span className="oct-card-picture">{card.id === 'yours' ? <YourOctopusPicture /> : <WorldStill world={card.id} />}</span>
        <span className="oct-card-caption">
          <b>{text.name}</b>
          <span>{text.epithet}</span>
        </span>
      </button>
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
  return (
    <>
      {/* The intro's wordmark heading is hidden here: the page keeps one heading, for the screen reader. */}
      <h1 className="oct-sr-only">How it works</h1>
      <ul className="oct-cards" data-layout={box.phone ? 'row' : 'stage'} aria-label="Example portfolios">
        {HOW_IT_WORKS_CARDS.map((card, i) => (
          <Card key={card.id} card={card} index={i} placed={!box.phone} api={api} onOpen={onOpen} />
        ))}
      </ul>
      <Link href="/explore" className="oct-explore">
        Explore all portfolios
      </Link>
    </>
  );
}
