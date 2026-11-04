import './poster.css';
import type { PosterImage } from './theme';

/**
 * The stand-in for the 3D scene where the browser has no WebGL (or `?nowebgl`): a still of the
 * approved intro, captured from the world (scripts/world-capture.mjs intro), under the same HTML
 * overlays. The overview and the project view stay reachable over it. The image is the world's own
 * (`theme.poster`).
 */
export function Poster({ image }: { image: PosterImage }) {
  return <img className="poster" src={`${import.meta.env.BASE_URL}${image.src}`} alt={image.alt} width={image.width} height={image.height} decoding="async" />;
}
