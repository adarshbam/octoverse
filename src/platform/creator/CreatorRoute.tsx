import { useState } from 'react';
import { CreatorPage } from './CreatorPage';
import { SAMPLE_DRAFT } from './sampleDraft';
import type { CreatorDraft } from './types';

/**
 * The creator's route (`/create`), loaded as its own chunk. TEMPORARY (platform Task 10, until Task 18): the creator over the
 * static sample draft, kept in memory only (no storage yet).
 */
export default function CreatorRoute() {
  const [draft, setDraft] = useState<CreatorDraft>(SAMPLE_DRAFT);
  return <CreatorPage draft={draft} onChange={setDraft} />;
}
