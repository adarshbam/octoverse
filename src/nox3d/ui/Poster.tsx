import './poster.css';

/**
 * The stand-in for the 3D scene where the browser has no WebGL (or `?nowebgl`): a still of the
 * approved intro, captured from the world (scripts/world-capture.mjs intro), under the same HTML
 * overlays. The overview and the project view stay reachable over it.
 */
export function Poster() {
  return <img className="poster" src="/nox/poster-intro.webp" alt="Nox, the octopus guide to Security Lab, in the dark water of his lab" width={1536} height={1024} decoding="async" />;
}
