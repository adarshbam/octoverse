import type { MouseEvent, ReactNode } from 'react';
import { navigate } from '../router/history';

/**
 * A link inside the platform: an ordinary anchor (so it can be opened in a new tab or copied), taken as a route change when it is a plain click.
 * `focusId` is a stable name for a link whose address can differ when Back lands on its page (history.ts: the control focus is put back on).
 */
export function Link({ href, className, children, onNavigate, focusId }: { href: string; className?: string; children: ReactNode; onNavigate?: () => void; focusId?: string }) {
  const go = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onNavigate?.();
    // The link is the control Back puts focus on when it returns to this page (a click does not focus a link in every browser).
    navigate(href, { from: event.currentTarget });
  };
  return (
    <a href={href} className={className} onClick={go} data-focus-id={focusId}>
      {children}
    </a>
  );
}
