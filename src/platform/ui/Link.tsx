import type { MouseEvent, ReactNode } from 'react';
import { navigate } from '../router/history';

/** A link inside the platform: an ordinary anchor (so it can be opened in a new tab or copied), taken as a route change when it is a plain click. */
export function Link({ href, className, children, onNavigate }: { href: string; className?: string; children: ReactNode; onNavigate?: () => void }) {
  const go = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    onNavigate?.();
    navigate(href);
  };
  return (
    <a href={href} className={className} onClick={go}>
      {children}
    </a>
  );
}
