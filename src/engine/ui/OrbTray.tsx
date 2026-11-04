import { logoColour, logoIcon } from '../artifacts/logoTexture';

export interface TrayItem {
  techId: string;
  name: string;
  iconKey: string;
}

/**
 * Technologies that have no orb to ride (more than the overview's slots), and on phones and
 * without WebGL every technology (`all`), as a row of buttons along the bottom of the overview.
 * Choosing the technology already in focus lets go of it (a second tap closes its tooltip). The
 * tray rides above the overview's bottom sheet while that is up (`lifted`).
 */
export function OrbTray({ items, open, all = false, lifted = false, focused = null, tooltipId, onChoose }: {
  items: readonly TrayItem[];
  open: boolean;
  all?: boolean;
  lifted?: boolean;
  focused?: string | null;
  tooltipId?: string;
  onChoose: (techId: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <nav className={`orb-tray${open ? ' is-open' : ''}${lifted ? ' is-lifted' : ''}`} aria-label={all ? 'Technologies' : 'More technologies'} aria-hidden={!open}>
      {items.map(item => {
        const icon = logoIcon(item.iconKey);
        return (
          <button
            key={item.techId}
            type="button"
            className="orb-tray-item"
            aria-label={item.name}
            aria-pressed={item.techId === focused}
            aria-describedby={item.techId === focused ? tooltipId : undefined}
            tabIndex={open ? 0 : -1}
            onClick={() => onChoose(item.techId)}
          >
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
