import './skip.css';

/**
 * "Skip to project details": the first thing Tab reaches. It stays off-screen until focused, then
 * goes straight to the full project view, whatever the page was showing.
 */
export function SkipLink({ target, onSkip }: { /** The id of the project view this instance's link goes to. */ target: string; onSkip: () => void }) {
  return (
    <a
      className="skip-link"
      href={`#${target}`}
      onClick={event => {
        event.preventDefault();
        onSkip();
      }}
    >
      Skip to project details
    </a>
  );
}
