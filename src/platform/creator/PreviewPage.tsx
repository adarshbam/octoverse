import '../ui/glass.css';

/**
 * The creator's full-screen preview (`/create/preview`), loaded as its own chunk. A placeholder until the preview task builds
 * it: like a world it has no navigation bar (spec 7.8), only a way back.
 */
export default function PreviewPage() {
  return (
    <main className="oct-root oct-unopened" id="oct-main" tabIndex={-1}>
      <div className="oct-glass oct-unopened-card">
        <h1>Preview</h1>
        <p>The preview of your octopus is not open yet.</p>
        <a href="/create" className="oct-button oct-button-primary">
          Back to the creator
        </a>
      </div>
    </main>
  );
}
