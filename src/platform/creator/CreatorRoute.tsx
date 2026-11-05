import { CreatorPage } from './CreatorPage';
import { useDraft, type SaveStatus } from './useDraft';

const SAYS: Readonly<Record<SaveStatus, string>> = {
  saved: 'Saved in this browser',
  saving: 'Saving…',
  memory: 'Cannot save in this browser; your changes stay in this tab only',
};

/**
 * The creator's route (`/create`), loaded as its own chunk: the creator over the visitor's draft (useDraft: the stored draft or the
 * sample, autosaved in this browser). The save state is announced to screen readers here; the creator screen task (Milestone 7) gives
 * it its visible place and the Discard draft button.
 */
export default function CreatorRoute() {
  const { draft, update, status } = useDraft();
  return (
    <>
      <CreatorPage draft={draft} onChange={next => update(() => next)} />
      <p className="oct-sr-only" role="status" data-save-status={status}>
        {SAYS[status]}
      </p>
    </>
  );
}
