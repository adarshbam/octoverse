import { useCallback, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Link } from '../ui/Link';
import { PageFrame } from '../pages/parts';
import { Tabs } from '../pages/Tabs';
import { CreatorPreview } from './CreatorPreview';
import { OctopusPanel } from './OctopusPanel';
import type { MediaApi } from './mediaUrls';
import { ProjectsPanel } from './ProjectsPanel';
import type { CreatorDraft } from './types';
import './creator.css';

export type CreatorLayout = 'wide' | 'phone';

const PHONE = '(max-width: 767px)';
const subscribe = (notify: () => void) => {
  const query = window.matchMedia(PHONE);
  query.addEventListener('change', notify);
  return () => query.removeEventListener('change', notify);
};
const phoneNow = (): CreatorLayout => (window.matchMedia(PHONE).matches ? 'phone' : 'wide');
/** Phone (under 768 px wide) or wide; the server render and tests are wide. */
const useLayout = (): CreatorLayout => useSyncExternalStore(subscribe, phoneNow, () => 'wide');

/** The bottom of the screen: See live preview (the selected project in its full world) and Publish, visibly unavailable (spec 2.6). */
function Actions() {
  return (
    <div className="oct-creator-actions">
      <Link href="/create/preview" className="oct-button oct-button-primary">
        See live preview <span aria-hidden="true">→</span>
      </Link>
      <button type="button" disabled className="oct-button oct-creator-publish">
        Publishing arrives with accounts
      </button>
    </div>
  );
}

/**
 * The creator (spec 7.13, P4, 7.15), static: floating glass panels around the octopus's picture. Wide: "Your Octopus" at the left,
 * "Your Projects" at the right, the actions under the picture (on a tablet the picture on top and the panels side by side). Phone:
 * the picture in a sticky top 40% and the two panels as the tabs "Octopus" and "Projects" below. `layout` forces one of the two
 * (tests); by default it follows the window. The centre is the live preview of the draft (CreatorPreview). The draft is controlled: every edit is `onChange(newDraft)`.
 *
 * `busy` makes the editing part inert and busy (the draft is not loaded yet, or a discard is under way): not editable, not focusable.
 * `bar` (the save status and Discard draft) sits below it, OUTSIDE the inert part, so a discard can still be seen and retried.
 * `media` is the browser's image store for the project images.
 */
export function CreatorPage({ draft, onChange, layout, busy = false, bar, media }: { draft: CreatorDraft; onChange: (draft: CreatorDraft) => void; layout?: CreatorLayout; busy?: boolean; bar?: ReactNode; media?: MediaApi }) {
  const detected = useLayout();
  const mode = layout ?? detected;
  // The project the visitor is looking at: the live preview draws its technologies.
  const [selected, setSelected] = useState<string | null>(draft.projects[0]?.id ?? null);
  const select = useCallback((id: string | undefined) => setSelected(id ?? null), []);
  const preview = <CreatorPreview draft={draft} selectedProjectId={selected} active={!busy} />;
  const projects = <ProjectsPanel draft={draft} onChange={onChange} media={media} onSelect={select} />;
  return (
    <PageFrame footer={false}>
      <div className="oct-creator" data-layout={mode}>
        <h1 className="oct-page-title oct-creator-title">Create your octopus</h1>
        <div className="oct-creator-grid" inert={busy} aria-busy={busy}>
          {mode === 'wide' ? (
            <>
              <OctopusPanel draft={draft} onChange={onChange} />
              {preview}
              {projects}
              <Actions />
            </>
          ) : (
            <>
              {preview}
              <Tabs
                label="Creator"
                tabs={[
                  { id: 'octopus', label: 'Octopus', panel: <OctopusPanel draft={draft} onChange={onChange} /> },
                  { id: 'projects', label: 'Projects', panel: projects },
                ]}
              />
              <Actions />
            </>
          )}
        </div>
        {bar ? <div className="oct-creator-bar-slot">{bar}</div> : null}
      </div>
    </PageFrame>
  );
}
