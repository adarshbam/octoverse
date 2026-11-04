import './skip.css';

/** The entrance's way out: a quiet control in the corner while Nox swims in; it fades as the intro comes. */
export function SkipEntrance({ hidden, onSkip }: { hidden: boolean; onSkip: () => void }) {
  return (
    <button type="button" className={`skip-entrance${hidden ? ' is-hidden' : ''}`} inert={hidden} onClick={onSkip}>
      Skip intro
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M3.5 3.5 8 8l-4.5 4.5M8.5 3.5 13 8l-4.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
