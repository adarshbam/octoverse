import { CreatorPage } from './CreatorPage';
import { announcement } from './draftController';
import { useDraft } from './useDraft';

/**
 * The creator's route (`/create`), loaded as its own chunk: the creator over the visitor's draft (useDraft: the stored draft or the
 * sample, autosaved in this browser). Until the stored draft is read (and while a discard is under way) the screen is `inert` (not editable, not focusable): an edit
 * made over the sample could never be told from the visitor's own draft. The save state is announced to screen readers here
 * ("Loading", saved, cannot save, or a discard that did not clear); it changes only between those, not on every save. The creator
 * screen task (Milestone 7) gives it its visible place and the Discard draft button (`discard`, `discardError`).
 */
export default function CreatorRoute() {
  const { draft, update, status, ready, discardError, discarding } = useDraft();
  return (
    <>
      <div style={{ display: 'contents' }} inert={!ready || discarding} aria-busy={!ready || discarding}>
        <CreatorPage draft={draft} onChange={next => ready && update(() => next)} />
      </div>
      <p className="oct-sr-only" role="status" data-save-status={ready ? status : 'loading'}>
        {announcement({ ready, status, discardError })}
      </p>
    </>
  );
}
