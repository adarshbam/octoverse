import './exit.css';

/**
 * The host page's way out (spec 19, P7): a link the platform gives the instance (`exit`), drawn in
 * the world's UI theme and first in the instance's focus order. Absent unless the host asks for it.
 */
export function ExitLink({ label, href }: { label: string; href: string }) {
  return (
    <a className="exit-link" href={href}>
      {label}
    </a>
  );
}
