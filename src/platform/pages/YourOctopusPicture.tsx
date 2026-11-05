import { useEffect, useState } from 'react';
import { readLocalDraft, type LocalDraft } from '../creator/localDraft';
import { CreatorStill } from './parts';

// The "Your Octopus" card's picture (spec 7.10, J01): the creator still of the visitor's own draft when one is saved in this browser
// (its template and palette), otherwise the sample creator octopus (Aether, peach), and the gold glyph card only while that is being
// looked up. Always a still (the card has no live preview until the creator's preview exists). The picture says what it is: a sample
// is labelled "Sample octopus", a real draft "Your draft" or its name.

/** The sample creator octopus of spec 7.10. */
export const SAMPLE_OCTOPUS = { template: 'aether', palette: 'peach' } as const;

/** The gold glass card with the octopus glyph in gold line: no rendered octopus, nothing is faked. Shown while the draft is being read. */
export function GlyphCard() {
  return (
    <span className="oct-glyph-card" aria-hidden="true">
      <svg className="oct-glyph" data-glyph="octopus" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        {/* The mantle, the two eyes and the smile. */}
        <path d="M29 50 C26 30 38 17 50 17 C62 17 74 30 71 50" />
        <circle cx="41" cy="40" r="3.2" />
        <circle cx="59" cy="40" r="3.2" />
        <path d="M44.5 48 Q50 53 55.5 48" />
        {/* Six of the arms, each curling at its tip. */}
        <path d="M31 52 C22 58 24 70 15 71 C10 71 10 65 14 65" />
        <path d="M38 56 C33 66 38 77 29 81 C24 83 22 77 26 76" />
        <path d="M46 58 C45 69 47 80 42 87 C39 90 35 86 38 83" />
        <path d="M54 58 C55 69 53 80 58 87 C61 90 65 86 62 83" />
        <path d="M62 56 C67 66 62 77 71 81 C76 83 78 77 74 76" />
        <path d="M69 52 C78 58 76 70 85 71 C90 71 90 65 86 65" />
      </svg>
    </span>
  );
}

/**
 * The picture for what is known of the visitor's draft: `undefined` is "still reading" (the glyph card), `null` is "no draft here"
 * (the labelled sample), a draft is its own still with its name, or "Your draft" if it has none.
 */
export function OctopusPicture({ own }: { own: LocalDraft | null | undefined }) {
  if (own === undefined) return <GlyphCard />;
  const { template, palette } = own ?? SAMPLE_OCTOPUS;
  const label = own === null ? 'Sample octopus' : own.name === '' ? 'Your draft' : own.name;
  return (
    <span className="oct-yours-picture" data-picture={own === null ? 'sample' : 'draft'}>
      <CreatorStill template={template} palette={palette} />
      {/* Hidden from assistive technology so the Explore tile's link keeps the name "<name>, <epithet>" (the How It Works card has its own label). */}
      <span className="oct-still-tag" aria-hidden="true">
        {label}
      </span>
    </span>
  );
}

/** The visitor's draft in this browser: undefined while it is read, then the draft or null (never throws; no IndexedDB is null). */
export function useLocalDraft(): LocalDraft | null | undefined {
  const [own, setOwn] = useState<LocalDraft | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    void readLocalDraft().then(found => {
      if (live) setOwn(found);
    });
    return () => {
      live = false;
    };
  }, []);
  return own;
}

export function YourOctopusPicture() {
  return <OctopusPicture own={useLocalDraft()} />;
}
