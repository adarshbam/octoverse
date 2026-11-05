import type { CSSProperties } from 'react';
import { contentFor } from '../fixtures/worldContent';
import type { ShowcaseProfile } from '../fixtures/showcase';
import { LivePicture, type PreviewOptions } from '../previews/LivePicture';
import { Link } from '../ui/Link';
import { PLATFORM_TOKENS } from '../ui/tokens';
import { Badge, Chips, PageFrame } from './parts';
import { Tabs } from './Tabs';

/** How many of a project's technologies its card shows; the Tech Stack tab lists them all. */
const CARD_CHIPS = 5;

/** The hero's live preview (spec 7.12): the world's intro, ambient, its water only, the artifacts simply there (the technologies show as in its world), tier low at most. */
const HERO_PREVIEW: PreviewOptions = { stage: 'intro', motion: 'ambient', place: 'backdrop', artifacts: 'settled', tierCap: 'low' };

/**
 * A showcase profile (spec 7.12, P5 without the out-of-scope parts): the hero card with the octopus (a live preview on a desktop or tablet, the engine's still on a
 * phone, with reduced motion and until the preview is ready), the identity beside it (name and the Showcase badge, epithet, the project's tagline, a link or
 * a location only where the world's content supplies one) and the primary action, then the tabs Projects (n), About and Tech
 * Stack. No Follow, no counts, no social links.
 */
export function Profile({ profile }: { profile: ShowcaseProfile }) {
  const content = contentFor(profile.handle);
  const href = `/@${profile.handle}/${profile.projects[0].slug}`;
  const projectsPanel = (
    <ul className="oct-projects">
      {profile.projects.map(project => (
        <li key={project.slug} className="oct-project" data-project={project.slug}>
          <div className="oct-shot">
            {content.screenshot ? <img src={content.screenshot.src} alt={content.screenshot.alt} loading="lazy" decoding="async" draggable={false} /> : <div className="oct-shot-missing">No screenshot yet</div>}
          </div>
          <div className="oct-project-body">
            <h3>
              <Link href={`/@${profile.handle}/${project.slug}`} className="oct-project-link">
                {content.projectTitle}
              </Link>
            </h3>
            <p>{content.tagline}</p>
            <Chips names={content.technologies.slice(0, CARD_CHIPS).map(t => t.name)} label="Technologies" />
          </div>
        </li>
      ))}
    </ul>
  );
  const aboutPanel = (
    <div className="oct-about">
      <p>{content.introduction}</p>
      <p>{content.overview}</p>
    </div>
  );
  const stackPanel = (
    <ul className="oct-stack">
      {content.technologies.map(tech => (
        <li key={tech.id} className="oct-stack-item" data-tech={tech.id}>
          <b>{tech.name}</b>
          <span className="oct-stack-category">{tech.category}</span>
          {tech.note !== undefined && (
            <p>
              {tech.note}
              {tech.placeholder && <span className="oct-placeholder-note">placeholder text</span>}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
  return (
    <PageFrame>
      <article className="oct-profile oct-glass" style={{ '--accent': PLATFORM_TOKENS.accents[profile.handle] } as CSSProperties}>
        <header className="oct-profile-top">
          <div className="oct-hero">
            <LivePicture still={{ kind: 'world', world: profile.handle }} world={profile.world} options={HERO_PREVIEW} live />
          </div>
          <div className="oct-identity">
            <div className="oct-name-row">
              <h1>{profile.name}</h1>
              <Badge />
            </div>
            <p className="oct-epithet">{profile.epithet}</p>
            <p className="oct-project-tagline">{content.tagline}</p>
            {profile.location !== undefined && <p className="oct-profile-location">{profile.location}</p>}
            {profile.link !== undefined && (
              <a className="oct-profile-link" href={profile.link} rel="noopener noreferrer">
                {profile.link}
              </a>
            )}
            <Link href={href} className="oct-button oct-button-primary oct-enter">
              {`Enter ${profile.name}'s world`}
            </Link>
          </div>
        </header>
        <Tabs
          label={`${profile.name}'s portfolio`}
          tabs={[
            { id: 'projects', label: `Projects (${profile.projects.length})`, panel: projectsPanel },
            { id: 'about', label: 'About', panel: aboutPanel },
            { id: 'stack', label: 'Tech Stack', panel: stackPanel },
          ]}
        />
      </article>
    </PageFrame>
  );
}
