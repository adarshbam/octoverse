import { type CSSProperties, useState } from 'react';
import { SHOWCASE, type ShowcaseProfile } from '../fixtures/showcase';
import { contentFor } from '../fixtures/worldContent';
import { LivePicture, type PreviewOptions } from '../previews/LivePicture';
import { useHot } from '../previews/useHot';
import { Link } from '../ui/Link';
import { PLATFORM_TOKENS } from '../ui/tokens';
import { Badge, Chips, PageFrame } from './parts';
import { YOURS } from './yours';
import { YourOctopusPicture } from './YourOctopusPicture';

/** How many of a project's technologies a tile shows (spec 7.11): the first three, in the project's declared order. */
const TILE_CHIPS = 3;

/** A tile's preview is the card's (spec 7.11: it comes alive as How It Works' cards do): the world's intro, ambient, its water only, no artifacts, tier low at most. */
const TILE_PREVIEW: PreviewOptions = { stage: 'intro', motion: 'ambient', place: 'backdrop', artifacts: 'hidden', tierCap: 'low' };

/** A showcase tile: hover or keyboard focus brings its picture to life (the platform's one slot holds one preview at a time, so the last tile entered is the live one). */
function Tile({ profile }: { profile: ShowcaseProfile }) {
  const content = contentFor(profile.handle);
  const { hot, handlers } = useHot();
  // The preview's layer is drawn beside the tile's link, over its picture, not inside it: the engine's instance has links and buttons of its own.
  const [live, setLive] = useState<HTMLSpanElement | null>(null);
  return (
    <li className="oct-tile-item" data-tile={profile.handle} style={{ '--accent': PLATFORM_TOKENS.accents[profile.handle] } as CSSProperties} {...handlers}>
      <Link href={`/@${profile.handle}`} className="oct-tile">
        <span className="oct-tile-picture">
          <LivePicture still={{ kind: 'world', world: profile.handle }} world={profile.world} options={TILE_PREVIEW} live={hot} into={live} />
        </span>
        <div className="oct-tile-body">
          <b>{profile.name}</b>
          <span className="oct-tile-epithet">{profile.epithet}</span>
          <span className="oct-tile-project">{content.projectTitle}</span>
          <Chips names={content.technologies.slice(0, TILE_CHIPS).map(t => t.name)} label="Technologies" />
        </div>
      </Link>
      {/* Over the picture, beside the link: the preview's layer, and the badge, which the layer must not cover (the tile's own hover lift is a stacking context). */}
      <span ref={setLive} className="oct-tile-live">
        <Badge />
      </span>
    </li>
  );
}

/**
 * Explore (spec 7.11): a calm glass grid over the reef's water, one tile per showcase profile in the order Veyra, Flux, Nox,
 * Aether, then Your Octopus, which opens the creator. Each tile: the world's still, the octopus's name and epithet, the project's
 * title, the first three technologies and the Showcase badge. Hover or focus brings a world tile alive (one live preview at a time); Your Octopus keeps its gold glyph card.
 */
export function Explore() {
  return (
    <PageFrame>
      <h1 className="oct-page-title">Explore</h1>
      <ul className="oct-tiles">
        {SHOWCASE.map(profile => (
          <Tile key={profile.handle} profile={profile} />
        ))}
        <li className="oct-tile-item" data-tile="yours" style={{ '--accent': PLATFORM_TOKENS.accents.yours } as CSSProperties}>
          <Link href="/create" className="oct-tile">
            <span className="oct-tile-picture">
              <YourOctopusPicture />
            </span>
            <div className="oct-tile-body">
              <b>{YOURS.name}</b>
              <span className="oct-tile-epithet">{YOURS.epithet}</span>
            </div>
          </Link>
        </li>
      </ul>
    </PageFrame>
  );
}
