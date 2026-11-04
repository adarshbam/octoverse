import { Link } from '../ui/Link';
import { PageFrame } from './parts';

/**
 * The not-found page (spec 7.8): "This part of the ocean is unexplored", with a way home and one to Explore. The reef's water
 * is the backdrop; the host's own picture is wired in by Task 14 (the real host is a page instance, not a still).
 */
export function NotFound() {
  return (
    <PageFrame footer={false} centered>
      <div className="oct-glass oct-notfound">
        <h1>This part of the ocean is unexplored</h1>
        <div className="oct-notfound-actions">
          <Link href="/" className="oct-button oct-button-primary">
            Back to OctoVerse
          </Link>
          <Link href="/explore" className="oct-button">
            Explore
          </Link>
        </div>
      </div>
    </PageFrame>
  );
}
