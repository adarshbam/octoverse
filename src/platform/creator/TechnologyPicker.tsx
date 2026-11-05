import { useEffect, useRef, useState } from 'react';
import { clip } from './clip';
import { MAX_TECHNOLOGIES } from './draft';
import { technologyName } from './technologies';
import { searchTechnologies } from './techSearch';

/** How many matches the list shows at once (a longer list is a long tab trip: type to narrow it). */
export const PICKER_LIMIT = 8;

/**
 * The technology picker (spec 7.13): a text filter over the shared catalog and a short list of buttons to toggle a technology on or off
 * (the list keeps its place when one is picked, so a keyboard user stays where they were); the chosen ones are removable chips in the
 * order they were picked, each with an optional usage note. No free text: only catalog entries can be added.
 */
export function TechnologyPicker({
  chosen,
  usage,
  onAdd,
  onRemove,
  onNote,
  initialQuery = '',
}: {
  chosen: readonly string[];
  usage: Readonly<Partial<Record<string, string>>>;
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
  onNote: (id: string, note: string) => void;
  /** For tests: the text the filter starts with. */
  initialQuery?: string;
}) {
  const [query, setQuery] = useState(initialQuery);
  const { matches, total } = searchTechnologies(query, [], PICKER_LIMIT);
  const full = chosen.length >= MAX_TECHNOLOGIES;
  const searchRef = useRef<HTMLInputElement>(null);
  const removeButtons = useRef(new Map<string, HTMLButtonElement>());
  // After a chip goes, focus goes to its neighbour's remove button, or to the filter when none is left (the removed button is gone).
  const focusNext = useRef<string | null>(null);
  useEffect(() => {
    const target = focusNext.current;
    focusNext.current = null;
    if (target === null) return;
    (target === '' ? searchRef.current : removeButtons.current.get(target))?.focus();
  }, [chosen]);

  const remove = (id: string) => {
    const at = chosen.indexOf(id);
    focusNext.current = chosen[at + 1] ?? chosen[at - 1] ?? '';
    onRemove(id);
  };

  return (
    <div className="oct-subsection oct-tech">
      <h3>Technologies</h3>
      {chosen.length > 0 ? (
        <>
          <ul className="oct-selected-techs" aria-label="Technologies in this project, in the order shown">
            {chosen.map(id => {
              const name = technologyName(id);
              return (
                <li key={id} className="oct-selected-tech" data-tech-id={id}>
                  <span className="oct-chip oct-chip-removable">
                    {name}
                    <button
                      type="button"
                      className="oct-chip-remove"
                      aria-label={`Remove ${name}`}
                      ref={node => {
                        if (node) removeButtons.current.set(id, node);
                        else removeButtons.current.delete(id);
                      }}
                      onClick={() => remove(id)}
                    >
                      <span aria-hidden="true">×</span>
                    </button>
                  </span>
                  <label className="oct-field oct-usage">
                    {`Usage note for ${name} (optional)`}
                    <input type="text" value={usage[id] ?? ''} placeholder="How you used it" autoComplete="off" onChange={event => onNote(id, event.target.value)} />
                  </label>
                </li>
              );
            })}
          </ul>
          <p className="oct-hint">Shown in the order you picked them.</p>
        </>
      ) : (
        <p className="oct-empty">None yet</p>
      )}

      <label className="oct-field">
        Search technologies
        <input ref={searchRef} type="text" value={query} placeholder="Type a name, such as React" autoComplete="off" spellCheck={false} onChange={event => setQuery(event.target.value)} />
      </label>
      {full ? <p className="oct-hint">A project has at most {MAX_TECHNOLOGIES} technologies. Remove one to add another.</p> : null}
      <ul className="oct-picker-list" aria-label="Technologies you can add">
        {matches.map(tech => {
          const picked = chosen.includes(tech.id);
          return (
            <li key={tech.id}>
              <button type="button" className="oct-picker-item" data-picker-id={tech.id} aria-pressed={picked} disabled={full && !picked} onClick={() => (picked ? remove(tech.id) : onAdd(tech.id))}>
                <span>{tech.name}</span>
                <span className="oct-picker-category">{tech.category}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="oct-hint" role="status" data-picker-count>
        {total === 0 ? `No technology matches "${clip(query.trim())}".` : total > matches.length ? `Showing ${matches.length} of ${total}. Type to narrow the list.` : `${total} ${total === 1 ? 'match' : 'matches'}.`}
      </p>
    </div>
  );
}
