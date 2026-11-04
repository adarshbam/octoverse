import { Landing } from './pages/Landing';
import { useRoute } from './router/history';
import { Link } from './ui/Link';
import './ui/glass.css';

/** The routes that are not built yet (explore, profiles, the creator): an honest page with a way home, until their tasks land. */
function NotOpenYet() {
  return (
    <main className="oct-root oct-unopened" id="oct-main" tabIndex={-1}>
      <div className="oct-glass oct-unopened-card">
        <h1>This part of OctoVerse is not open yet</h1>
        <Link href="/" className="oct-button oct-button-primary">
          Back to OctoVerse
        </Link>
      </div>
    </main>
  );
}

/**
 * The platform shell (spec 7.8). Only `/` and `/how-it-works` are built so far: both are the landing, one host
 * instance that stays mounted from the intro to How It Works.
 */
export function PlatformApp() {
  const route = useRoute();
  if (route.name === 'landing') return <Landing route="landing" />;
  if (route.name === 'howItWorks') return <Landing route="howItWorks" />;
  return <NotOpenYet />;
}
