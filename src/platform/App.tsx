import { useState } from 'react';
import { CreatorPage } from './creator/CreatorPage';
import { SAMPLE_DRAFT } from './creator/sampleDraft';
import type { CreatorDraft } from './creator/types';
import { profileFor } from './fixtures/showcase';
import { Explore } from './pages/Explore';
import { Landing } from './pages/Landing';
import { NotFound } from './pages/NotFound';
import { Profile } from './pages/Profile';
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

/** TEMPORARY (platform Task 10): the creator over the static sample draft, kept in memory only (no storage until Task 18). */
function TemporaryCreator() {
  const [draft, setDraft] = useState<CreatorDraft>(SAMPLE_DRAFT);
  return <CreatorPage draft={draft} onChange={setDraft} />;
}

/**
 * TEMPORARY (platform Tasks 9 and 10; Task 14 removes it and routes these pages properly): `?page=profile&handle=<handle>`,
 * `?page=explore`, `?page=notfound` and `?page=create` open the static pages before their routes exist. An unknown handle is the
 * not-found page.
 */
function TemporaryPage({ page }: { page: string }) {
  if (page === 'create') return <TemporaryCreator />;
  if (page === 'explore') return <Explore />;
  if (page === 'notfound') return <NotFound />;
  const profile = profileFor(new URLSearchParams(window.location.search).get('handle') ?? '');
  return profile ? <Profile profile={profile} /> : <NotFound />;
}

/**
 * The platform shell (spec 7.8). Only `/` and `/how-it-works` are built so far: both are the landing, one host
 * instance that stays mounted from the intro to How It Works.
 */
export function PlatformApp() {
  const route = useRoute();
  const page = new URLSearchParams(window.location.search).get('page');
  if (page === 'profile' || page === 'explore' || page === 'notfound' || page === 'create') return <TemporaryPage page={page} />;
  if (route.name === 'landing') return <Landing route="landing" />;
  if (route.name === 'howItWorks') return <Landing route="howItWorks" />;
  return <NotOpenYet />;
}
