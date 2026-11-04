import { Link } from '../ui/Link';
import '../ui/glass.css';

/**
 * The navigation bar (spec 7.8): glass, top, small: the OctoVerse wordmark (home), Explore and Create,
 * and nothing else. `hidden` keeps it out of sight and out of the focus order (the landing shows it
 * only once the intro's text is in).
 */
export function Nav({ hidden = false }: { hidden?: boolean }) {
  return (
    <nav className={`oct-nav oct-glass${hidden ? ' is-hidden' : ''}`} aria-label="OctoVerse" aria-hidden={hidden || undefined} inert={hidden || undefined}>
      <Link href="/" className="oct-nav-brand">
        OctoVerse
      </Link>
      <span className="oct-nav-links">
        <Link href="/explore" className="oct-nav-link">
          Explore
        </Link>
        <Link href="/create" className="oct-nav-link">
          Create
        </Link>
      </span>
    </nav>
  );
}
