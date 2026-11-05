import { useId } from 'react';
import { LINK_ISSUE, linkIssues, safeHref } from './draftEdits';
import { FieldIssue } from './FieldIssue';

/**
 * A project link (spec 7.13): https only. A link that does not start with https:// is KEPT in the draft, flagged under the field and
 * shown as plain text, never as a link (so a javascript: address can never be followed from here). A good one shows as a link that
 * opens in a new tab.
 */
export function LinkField({ label, value, placeholder = 'https://', onChange }: { label: string; value: string; placeholder?: string; onChange: (value: string) => void }) {
  const uid = useId();
  const issue = linkIssues({ live: value }).live;
  const href = safeHref(value);
  return (
    <div className="oct-link-field">
      <label className="oct-field">
        {label}
        <input type="url" value={value} placeholder={placeholder} autoComplete="off" spellCheck={false} aria-invalid={issue ? true : undefined} aria-describedby={issue ? `${uid}-issue` : undefined} onChange={event => onChange(event.target.value)} />
      </label>
      <FieldIssue id={`${uid}-issue`} text={issue === undefined ? undefined : `${LINK_ISSUE}. It is kept, but shown as plain text.`} />
      {value === '' ? null : href ? (
        <a className="oct-link-shown" href={href} target="_blank" rel="noopener noreferrer">
          {value}
        </a>
      ) : (
        <span className="oct-link-plain" data-link-plain>
          {value}
        </span>
      )}
    </div>
  );
}
