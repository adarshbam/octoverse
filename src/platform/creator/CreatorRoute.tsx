import { useMemo } from 'react';
import { CreatorPage } from './CreatorPage';
import { DraftBar } from './DraftBar';
import { announcement } from './draftController';
import { useDraft } from './useDraft';

/**
 * The creator's route (`/create`), loaded as its own chunk: the creator over the visitor's draft (useDraft: the stored draft or the
 * sample, autosaved in this browser). Until the stored draft is read (and while a discard is under way) the editing part of the screen is `inert` (not
 * editable, not focusable): an edit made over the sample could never be told from the visitor's own draft. The bar below it (the
 * visible save status and Discard draft, DraftBar) is OUTSIDE the inert part. The save state is also announced to screen readers
 * ("Loading", saved, cannot save, discarding, or a discard that did not clear) from one polite live region; it changes only
 * between those, not on every save.
 */
export default function CreatorRoute() {
  const { draft, update, status, ready, discardError, discarding, discard, putMedia, getMedia } = useDraft();
  const media = useMemo(() => ({ put: putMedia, get: getMedia }), [putMedia, getMedia]);
  return (
    <>
      <CreatorPage
        draft={draft}
        onChange={next => ready && update(() => next)}
        busy={!ready || discarding}
        media={media}
        bar={<DraftBar ready={ready} status={status} discardError={discardError} discarding={discarding} onDiscard={discard} />}
      />
      <p className="oct-sr-only" role="status" data-save-status={ready ? status : 'loading'}>
        {announcement({ ready, status, discardError, discarding })}
      </p>
    </>
  );
}
