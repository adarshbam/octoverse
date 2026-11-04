// The "Your Octopus" card's picture before the creator exists (spec 7.10): a gold glass card holding
// the OctoVerse octopus glyph in gold line. No rendered octopus: nothing is faked.
export function YourOctopusPicture() {
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
