// A line of inline validation feedback under a field (spec 7.13). The text helpers are issueText.ts.

/** A line of inline feedback under a field; the field points to it with aria-describedby={id}. */
export function FieldIssue({ id, text }: { id: string; text: string | undefined }) {
  if (text === undefined) return null;
  return (
    <p id={id} className="oct-field-issue" data-issue>
      {text}
    </p>
  );
}
