import { type KeyboardEvent, type ReactNode, useId, useRef, useState } from 'react';
import { nextTab } from './tabKeys';

export interface TabSpec {
  id: string;
  label: string;
  panel: ReactNode;
}

/**
 * An accessible tab list (the ARIA tabs pattern with automatic activation): role tablist, tab and tabpanel; the selected tab is the
 * one tab stop (roving tabindex) and Left, Right, Home and End move and select; each tab controls its panel and each panel is
 * labelled by its tab. Every panel is in the page; the others are `hidden`.
 */
export function Tabs({ tabs, label }: { tabs: readonly TabSpec[]; label: string }) {
  const uid = useId();
  const [selected, setSelected] = useState(0);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const to = nextTab(event.key, selected, tabs.length);
    if (to === undefined) return;
    event.preventDefault();
    setSelected(to);
    buttons.current[to]?.focus();
  };
  return (
    <div className="oct-tabs">
      <div role="tablist" aria-label={label} className="oct-tablist" onKeyDown={onKeyDown}>
        {tabs.map((tab, i) => (
          <button
            key={tab.id}
            ref={node => {
              buttons.current[i] = node;
            }}
            type="button"
            role="tab"
            id={`${uid}-tab-${tab.id}`}
            aria-selected={i === selected}
            aria-controls={`${uid}-panel-${tab.id}`}
            tabIndex={i === selected ? 0 : -1}
            className="oct-tab"
            onClick={() => setSelected(i)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.map((tab, i) => (
        <div key={tab.id} role="tabpanel" id={`${uid}-panel-${tab.id}`} aria-labelledby={`${uid}-tab-${tab.id}`} hidden={i !== selected} tabIndex={0} className="oct-tabpanel">
          {tab.panel}
        </div>
      ))}
    </div>
  );
}
