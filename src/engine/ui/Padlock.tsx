import { useId } from 'react';

/**
 * A padlock: a closed shackle over a body with a keyhole. Its fill reads the theme's button
 * gradient (`--oct-button-from` to `--oct-button-to`), so a world's lock takes the world's accent
 * and the engine holds no colour of its own here.
 */
export function Padlock() {
  // Unique to the instance: two on a page would otherwise share an id.
  const gradient = `${useId()}-padlock`;
  return (
    <svg viewBox="0 0 40 46" aria-hidden="true">
      <defs>
        <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--oct-button-from)' }} />
          <stop offset="1" style={{ stopColor: 'var(--oct-button-to)' }} />
        </linearGradient>
      </defs>
      <path fill="none" stroke={`url(#${gradient})`} strokeWidth="5" strokeLinecap="round" d="M11 21v-6a9 9 0 0 1 18 0v6" />
      <path fill={`url(#${gradient})`} fillRule="evenodd" d="M7 21h26a3 3 0 0 1 3 3v17a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V24a3 3 0 0 1 3-3Zm13 7a3.4 3.4 0 0 0-1.6 6.4V38h3.2v-3.6A3.4 3.4 0 0 0 20 28Z" />
    </svg>
  );
}
