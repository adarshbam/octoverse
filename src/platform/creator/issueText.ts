// Inline validation (spec 7.13): one line under the field it is about, never a block on saving. The messages come from validateDraft
// (draft.ts) and linkIssues (draftEdits.ts); this puts the field's name in front of one that starts mid-sentence.

/** "needs 2 to 24 letters" for the field "Handle" reads "Handle needs 2 to 24 letters"; a message that is already a sentence stays as it is. */
export function issueText(label: string, message: string): string {
  return /^(needs|has|is)\b|^"/.test(message) ? `${label} ${message}` : message;
}

/** The text of the issue for a field, or undefined (the first one, when a field has several). */
export function issueFor(issues: readonly { field: string; message: string }[], field: string, label: string): string | undefined {
  const found = issues.find(issue => issue.field === field);
  return found ? issueText(label, found.message) : undefined;
}
