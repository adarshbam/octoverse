import { useId } from 'react';

/** Nox's flame. */
export function Flame() {
  // Unique to the instance: two on a page would otherwise share an id.
  const gradient = `${useId()}-flame`;
  return (
    <svg viewBox="0 0 40 46" aria-hidden="true">
      <defs>
        <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ff7a5a" />
          <stop offset="1" stopColor="#ff2440" />
        </linearGradient>
      </defs>
      <path
        fill={`url(#${gradient})`}
        d="M20 2c2 8 12 12 12 24a12 12 0 0 1-24 0c0-6 3-9 5-12 0 4 2 7 4 8-1-8 1-14 3-20Zm0 26c-3 3-5 5-5 8a5 5 0 0 0 10 0c0-3-2-5-5-8Z"
      />
    </svg>
  );
}
