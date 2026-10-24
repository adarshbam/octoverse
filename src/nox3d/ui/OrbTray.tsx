import { logoColour, logoIcon } from '../artifacts/logoTexture';

export interface TrayItem {
  techId: string;
  name: string;
  iconKey: string;
}

/**
 * Technologies that have no orb to ride (more than the overview's slots), and on phones every
 * technology, as a row of buttons along the bottom of the overview.
 */
export function OrbTray({ items, open, onChoose }: { items: readonly TrayItem[]; open: boolean; onChoose: (techId: string) => void }) {
  if (items.length === 0) return null;
  return (
    <nav className={`orb-tray${open ? ' is-open' : ''}`} aria-label="More technologies" aria-hidden={!open}>
      {items.map(item => {
        const icon = logoIcon(item.iconKey);
        return (
          <button key={item.techId} type="button" className="orb-tray-item" aria-label={item.name} tabIndex={open ? 0 : -1} onClick={() => onChoose(item.techId)}>
            {icon && (
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path fill={logoColour(item.iconKey)} d={icon.path} />
              </svg>
            )}
          </button>
        );
      })}
    </nav>
  );
}
