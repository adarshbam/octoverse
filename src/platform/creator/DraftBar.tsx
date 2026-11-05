import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { statusLabel, type SaveStatus } from './draftController';

/** The question Discard draft asks before it clears anything (spec 7.13). */
export const CONFIRM_TEXT = 'Discard this draft? This clears it from this browser.';

type Focus = 'discard' | 'retry' | 'confirm-group';

/**
 * The bottom bar of the creator: the draft's save state in plain sight and the Discard draft button (spec 7.13). It sits OUTSIDE the
 * inert part of the screen, so a discard that is under way or has failed can still be seen and retried.
 *
 * Discard draft asks first (Confirm / Cancel; focus moves to the question, Escape cancels). On Confirm the controller clears the
 * stored draft and images; while it works the status says "Discarding…" and the edit controls are inert. If the clear fails
 * the draft STAYS on screen, the plain message says so and Retry asks again (no second question: the visitor already confirmed). The
 * words a screen reader hears come from the route's one live region, not from here.
 */
export function DraftBar({
  ready,
  status,
  discardError,
  discarding,
  onDiscard,
  confirming: startConfirming = false,
}: {
  ready: boolean;
  status: SaveStatus;
  discardError: string | null;
  discarding: boolean;
  onDiscard: () => Promise<{ cleared: boolean }>;
  /** For tests: starts with the question showing. */
  confirming?: boolean;
}) {
  const uid = useId();
  const [confirming, setConfirming] = useState(startConfirming);
  const [focusWanted, setFocusWanted] = useState<Focus | null>(null);
  const discardRef = useRef<HTMLButtonElement>(null);
  const retryRef = useRef<HTMLButtonElement>(null);
  const groupRef = useRef<HTMLDivElement>(null);

  const state = !ready ? 'loading' : discarding ? 'discarding' : status;

  // Focus follows the flow: to the question when it opens, back to a button that exists when it closes or the clear ends.
  useEffect(() => {
    if (focusWanted === null || discarding) return;
    const target = focusWanted === 'confirm-group' ? groupRef.current : focusWanted === 'retry' ? (retryRef.current ?? discardRef.current) : discardRef.current;
    if (target) {
      target.focus();
      setFocusWanted(null);
    }
  }, [focusWanted, discarding, confirming, discardError]);

  const ask = () => {
    setConfirming(true);
    setFocusWanted('confirm-group');
  };
  const cancel = () => {
    setConfirming(false);
    setFocusWanted('discard');
  };
  const run = async () => {
    setConfirming(false);
    const { cleared } = await onDiscard();
    setFocusWanted(cleared ? 'discard' : 'retry');
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      cancel();
    }
  };

  return (
    <div className="oct-draft-bar oct-glass" data-draft-bar>
      <p className="oct-draft-status" data-draft-status={state} aria-hidden="true">
        {statusLabel({ ready, status, discardError, discarding })}
      </p>
      {discardError !== null ? (
        <p className="oct-draft-error" data-discard-error>
          {discardError}
        </p>
      ) : null}
      <div className="oct-draft-actions">
        {confirming ? (
          <div ref={groupRef} role="group" aria-labelledby={`${uid}-ask`} tabIndex={-1} className="oct-draft-confirm" onKeyDown={onKeyDown}>
            <p id={`${uid}-ask`}>{CONFIRM_TEXT}</p>
            <button type="button" className="oct-small-button oct-small-danger" onClick={() => void run()}>
              Confirm
            </button>
            <button type="button" className="oct-small-button" onClick={cancel}>
              Cancel
            </button>
          </div>
        ) : (
          <>
            {discardError !== null && !discarding ? (
              <button ref={retryRef} type="button" className="oct-small-button oct-small-danger" onClick={() => void run()}>
                Retry
              </button>
            ) : null}
            <button ref={discardRef} type="button" className="oct-small-button" disabled={!ready || discarding} onClick={ask}>
              {discarding ? 'Discarding…' : 'Discard draft'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
