import './skip.css';

/**
 * "Skip to project details": the first thing Tab reaches. It stays off-screen until focused, then
 * goes straight to the full project view, whatever the page was showing.
 */
export function SkipLink({ onSkip }: { onSkip: () => void }) {
  return (
    <a
      className="skip-link"
      href="#project-details"
      onClick={event => {
        event.preventDefault();
        onSkip();
      }}
    >
      Skip to project details
    </a>
  );
}
