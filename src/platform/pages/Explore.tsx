import type { CSSProperties } from 'react';
import { SHOWCASE } from '../fixtures/showcase';
import { contentFor } from '../fixtures/worldContent';
import { Link } from '../ui/Link';
import { PLATFORM_TOKENS } from '../ui/tokens';
import { Badge, Chips, PageFrame, WorldStill } from './parts';
import { YourOctopusPicture } from './YourOctopusPicture';

/** How many of a project's technologies a tile shows (spec 7.11): the first three, in the project's declared order. */
const TILE_CHIPS = 3;

/**
 * Explore (spec 7.11): a calm glass grid over the reef's water, one tile per showcase profile in the order Veyra, Flux, Nox,
 * Aether, then Your Octopus, which opens the creator. Each tile: the world's still, the octopus's name and epithet, the project's
 * title, the first three technologies and the Showcase badge. Stills only for now (a tile's live preview is Task 13).
 */
export function Explore() {
  return (
    <PageFrame>
      <h1 className="oct-page-title">Explore</h1>
      <ul className="oct-tiles">
        {SHOWCASE.map(profile => {
          const content = contentFor(profile.handle);
          return (
            <li key={profile.handle} className="oct-tile-item" data-tile={profile.handle} style={{ '--accent': PLATFORM_TOKENS.accents[profile.handle] } as CSSProperties}>
              <Link href={`/@${profile.handle}`} className="oct-tile">
                <span className="oct-tile-picture">
                  <WorldStill world={profile.handle} />
                  <Badge />
                </span>
                <div className="oct-tile-body">
                  <b>{profile.name}</b>
                  <span className="oct-tile-epithet">{profile.epithet}</span>
                  <span className="oct-tile-project">{content.projectTitle}</span>
                  <Chips names={content.technologies.slice(0, TILE_CHIPS).map(t => t.name)} label="Technologies" />
                </div>
              </Link>
            </li>
          );
        })}
        <li className="oct-tile-item" data-tile="yours" style={{ '--accent': PLATFORM_TOKENS.accents.yours } as CSSProperties}>
          <Link href="/create" className="oct-tile">
            <span className="oct-tile-picture">
              <YourOctopusPicture />
            </span>
            <div className="oct-tile-body">
              <b>Your Octopus</b>
              <span className="oct-tile-epithet">Your Story</span>
            </div>
          </Link>
        </li>
      </ul>
    </PageFrame>
  );
}
