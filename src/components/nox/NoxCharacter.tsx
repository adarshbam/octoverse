import { useId } from 'react';
import { introductionArtwork, mantleContour } from './introductionGeometry';
import type { NoxSceneLighting } from './sceneLighting';

type TentacleArtwork = (typeof introductionArtwork)[number];

function Tentacle({ arm, prefix, lighting }: { arm: TentacleArtwork; prefix: string; lighting: NoxSceneLighting }) {
  return (
    <g id={`${prefix}-${arm.id}`} data-tentacle={arm.id} data-depth={arm.depth} aria-label={arm.label}>
      <path d={arm.contour} fill="#d15ac2" opacity="0.22" filter={`url(#${prefix}-rim-bloom)`} />
      <path d={arm.contour} fill={`url(#${prefix}-arm-skin)`} />
      {arm.volume.map((band, i) => <path key={i} d={band.contour} fill={band.color} opacity={0.82 + Math.sin(i * 1.8) * 0.035} />)}
      <path d={arm.dorsal} fill={`url(#${prefix}-dorsal-reflection)`} />
      <path d={arm.innerShade} fill="none" stroke="#060d24" strokeWidth="5" opacity="0.5" filter={`url(#${prefix}-soften)`} />
      <path d={arm.crest} fill="none" stroke="#7360a3" strokeWidth="4.5" opacity="0.25" filter={`url(#${prefix}-rim-bloom)`} />
      <path d={arm.belly} fill={`url(#${prefix}-underside)`} />
      <g clipPath={`url(#${prefix}-${arm.id}-clip)`}>
        <path d={arm.contour} fill={`url(#${prefix}-skin-variation)`} filter={`url(#${prefix}-skin-grain)`} opacity="0.36" />
        <path d={arm.dorsal} fill={`url(#${prefix}-blue-reflection)`} opacity="0.65" />
        {lighting.crimson.map(light => <path key={light.id} d={arm.contour} fill={`url(#${prefix}-${light.id})`} />)}
        <path d={arm.rim} fill="none" stroke={`url(#${prefix}-ridge-reflection)`} strokeWidth="2.3" opacity="0.68" />
        {arm.depth !== 'front' && <path d={mantleContour} transform="translate(0 3)" fill="#020616" opacity="0.8" filter={`url(#${prefix}-contact)`} />}
        {arm.depth === 'middle' && introductionArtwork.filter(a => a.depth === 'front').map(front => <path key={front.id} d={front.contour} transform="translate(0 2)" fill="#020616" opacity="0.8" filter={`url(#${prefix}-contact)`} />)}
      </g>
      <path d={arm.contour} fill={`url(#${prefix}-root-light)`} />
      <path d={arm.rim} fill="none" stroke="#b985df" strokeWidth="1.6" opacity="0.35" filter={`url(#${prefix}-soften)`} />
      <path d={arm.rim} fill="none" stroke="#c593e4" strokeWidth="0.45" opacity="0.38" />
      {arm.cups.map((cup, i) => (
        <g key={i} transform={`translate(${cup.x} ${cup.y}) rotate(${cup.angle})`}>
          <ellipse rx={cup.radius * 1.25} ry={cup.radius} fill="#ff674e" opacity={i % 4 ? 0.23 : 0.4} filter={`url(#${prefix}-soften)`} />
          <path d={`M${-cup.radius} ${-cup.radius * 0.3} C${-cup.radius} ${-cup.radius * 0.8} ${cup.radius} ${-cup.radius * 0.8} ${cup.radius} ${-cup.radius * 0.25} C${cup.radius * 0.95} ${cup.radius * 1.03} ${-cup.radius * 0.88} ${cup.radius * 0.97} ${-cup.radius} ${-cup.radius * 0.3}Z`} fill={`url(#${prefix}-cup)`} />
          <ellipse cy={-cup.radius * 0.24} rx={cup.radius * 0.48} ry={cup.radius * 0.25} fill="#8a294e" opacity="0.62" />
          <path d={`M${-cup.radius * 0.65} ${cup.radius * 0.35} Q0 ${cup.radius * 0.96} ${cup.radius * 0.68} ${cup.radius * 0.31}`} fill="none" stroke="#ffba87" strokeWidth="0.5" opacity="0.56" />
        </g>
      ))}
      {arm.freckles.map((spot, i) => <ellipse key={i} cx={spot.x} cy={spot.y} rx={spot.radius * (i % 2 ? 1.1 : 1.6)} ry={spot.radius} fill={i % 3 ? '#060e26' : '#b689cf'} opacity={i % 3 ? 0.5 : 0.3} />)}
    </g>
  );
}

function Eye({ x, y, rotation, prefix, side }: { x: number; y: number; rotation: number; prefix: string; side: 'left' | 'right' }) {
  const irisOffset = side === 'left' ? 2.3 : -2.3;
  return (
    <g id={`${prefix}-eye-${side}`} transform={`translate(${x} ${y}) rotate(${rotation}) scale(1.09 1)`}>
      <ellipse cy="0.5" rx="17.7" ry="21.4" fill="#bd3258" opacity="0.5" filter={`url(#${prefix}-soften)`} />
      <ellipse rx="16" ry="19.5" fill="#140b22" />
      <ellipse cy="1" rx="14.6" ry="18.2" fill={`url(#${prefix}-sclera)`} />
      <ellipse cx={irisOffset} cy="-0.2" rx="12.8" ry="17.1" fill={`url(#${prefix}-iris)`} />
      <ellipse cx={irisOffset} cy="-1.9" rx="8.05" ry="11.65" fill="#120710" />
      <path d="M-7.5 6 C-6 14 1 17 7 11" fill="none" stroke="#ff6356" strokeWidth="1.1" opacity="0.75" />
      <ellipse cx="-3.4" cy="-7.4" rx="2.8" ry="3.05" fill="#fff5ef" transform="rotate(18 -3.4 -7.4)" />
      <circle cx="5.3" cy="-7.8" r="1.65" fill="#fff6fb" />
      <ellipse cx="4.8" cy="10.8" rx="1.35" ry="2.3" fill="#ffb79b" opacity="0.85" />
      <path d="M-15 -3 C-15 -17 -6 -22 3 -19 C9 -19 14 -13 15 -7" fill="none" stroke="#180d26" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M-14 -9 Q-18 -12 -20 -9 M-10 -15 Q-15 -20 -18 -17 M-5 -18 Q-10 -23 -13 -21" transform={side === 'right' ? 'scale(-1 1)' : undefined} fill="none" stroke="#1b0a27" strokeWidth="1.7" strokeLinecap="round" />
    </g>
  );
}

export function NoxCharacter({ lighting, idPrefix }: { lighting: NoxSceneLighting; idPrefix?: string }) {
  const generatedId = useId().replaceAll(':', '');
  const prefix = idPrefix ?? `nox-${generatedId}`;
  const ref = (name: string) => `${prefix}-${name}`;
  const crownSpeckles = Array.from({ length: 54 }, (_, i) => ({
    x: 184 + ((i * 43.73) % 147),
    y: 230 + ((i * 17.39) % 74),
    r: 0.4 + (i % 5) * 0.17,
  }));

  return (
    <g id={`${prefix}-character`} data-character="nox" data-pose="introduction">
      <defs>
        {introductionArtwork.map(arm => <clipPath key={arm.id} id={ref(`${arm.id}-clip`)}><path d={arm.contour} /></clipPath>)}
        <filter id={ref('contact')}><feGaussianBlur stdDeviation="1.6" /></filter>
        <filter id={ref('skin-grain')} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.14 0.21" numOctaves="3" seed="23" result="grain" />
          <feColorMatrix in="grain" type="matrix" values="0 0 0 0 .53 0 0 0 0 .34 0 0 0 0 .65 .7 0 0 0 -.22" />
          <feComposite in2="SourceGraphic" operator="in" />
        </filter>
        <linearGradient id={ref('skin-variation')}><stop stopColor="#c49adc" /><stop offset="1" stopColor="#634083" /></linearGradient>
        <radialGradient id={ref('blue-reflection')} cx={lighting.overhead.x} cy={lighting.overhead.y} r="470" gradientUnits="userSpaceOnUse">
          <stop stopColor={lighting.overhead.color} stopOpacity={lighting.overhead.strength} /><stop offset=".6" stopColor="#8f77d5" stopOpacity=".45" /><stop offset="1" stopColor="#7462c9" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={ref('ridge-reflection')} x1="100" y1="310" x2="375" y2="448" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7469bd" stopOpacity=".3" /><stop offset=".24" stopColor="#b29bec" /><stop offset=".46" stopColor="#64559d" stopOpacity=".16" /><stop offset=".7" stopColor="#a68ce8" stopOpacity=".85" /><stop offset="1" stopColor="#ad5faf" stopOpacity=".2" />
        </linearGradient>
        {lighting.crimson.map(light => <radialGradient key={light.id} id={ref(light.id)} cx={light.x} cy={light.y} r={light.radius * 1.35} gradientUnits="userSpaceOnUse"><stop stopColor={light.color} stopOpacity={light.strength * .58} /><stop offset=".45" stopColor={light.color} stopOpacity={light.strength * .22} /><stop offset="1" stopColor={light.color} stopOpacity="0" /></radialGradient>)}
        <linearGradient id={ref('arm-skin')} x1="235" y1="281" x2="265" y2="445" gradientUnits="userSpaceOnUse">
          <stop stopColor="#302244" /><stop offset="0.28" stopColor="#23203f" /><stop offset="0.59" stopColor="#151831" /><stop offset="1" stopColor="#211d36" />
        </linearGradient>
        <linearGradient id={ref('underside')} x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#7d285f" /><stop offset="0.52" stopColor="#bf345f" /><stop offset="1" stopColor="#f96b5c" />
        </linearGradient>
        <linearGradient id={ref('dorsal-reflection')} x1="180" y1="302" x2="280" y2="445" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7462a3" stopOpacity="0.42" /><stop offset="0.45" stopColor="#5b4c8e" stopOpacity="0.17" /><stop offset="1" stopColor="#7362a3" stopOpacity="0.34" />
        </linearGradient>
        <radialGradient id={ref('root-light')} cx={lighting.roots.x} cy={lighting.roots.y} r={lighting.roots.radius} gradientUnits="userSpaceOnUse">
          <stop stopColor={lighting.roots.color} stopOpacity={lighting.roots.strength} /><stop offset="0.35" stopColor="#ce4866" stopOpacity="0.5" /><stop offset="1" stopColor="#9a3563" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={ref('cup')} x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#ab3157" /><stop offset="0.5" stopColor="#ef645f" /><stop offset="1" stopColor="#ffac79" />
        </linearGradient>
        <linearGradient id={ref('mantle')} x1="252" y1="227" x2="256" y2="373" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2c244e" /><stop offset="0.24" stopColor="#11132a" /><stop offset="0.47" stopColor="#301535" /><stop offset="0.72" stopColor="#8a2855" /><stop offset="0.9" stopColor="#de4562" /><stop offset="1" stopColor="#98264c" />
        </linearGradient>
        <radialGradient id={ref('face-light')} cx="50%" cy="50%" r="50%">
          <stop stopColor="#ffb078" /><stop offset="0.32" stopColor="#ff765e" /><stop offset="0.68" stopColor="#f64766" stopOpacity="0.7" /><stop offset="1" stopColor="#ec3875" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={ref('crown-light')} cx="42%" cy="0%" r="90%">
          <stop stopColor="#9983cf" stopOpacity="0.47" /><stop offset="0.3" stopColor="#795dc0" stopOpacity="0.18" /><stop offset="0.72" stopColor="#242141" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={ref('mantle-rim')} x1="200" y1="230" x2="281" y2="360" gradientUnits="userSpaceOnUse">
          <stop stopColor="#e1a7ee" /><stop offset="0.4" stopColor="#a760bd" /><stop offset="0.7" stopColor="#d852b8" /><stop offset="1" stopColor="#fe7b83" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={ref('sclera')} x1="0" y1="0" x2="0.45" y2="1">
          <stop stopColor="#382033" /><stop offset="0.42" stopColor="#ad7777" /><stop offset="0.8" stopColor="#fff1d3" /><stop offset="1" stopColor="#ffb39c" />
        </linearGradient>
        <radialGradient id={ref('iris')} cx="65%" cy="82%" r="77%">
          <stop stopColor="#ff7962" /><stop offset="0.3" stopColor="#f33340" /><stop offset="0.65" stopColor="#740f29" /><stop offset="1" stopColor="#170613" />
        </radialGradient>
        <filter id={ref('soften')} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="0.85" /></filter>
        <filter id={ref('rim-bloom')} x="-20%" y="-30%" width="140%" height="160%"><feGaussianBlur stdDeviation="2.9" /></filter>
        <filter id={ref('aura-blur')} x="-40%" y="-80%" width="180%" height="260%"><feGaussianBlur stdDeviation="11" /></filter>
        <clipPath id={ref('mantle-clip')}><path d={mantleContour} /></clipPath>
        <clipPath id={ref('anatomy-clip')}><path d={mantleContour} />{introductionArtwork.map((arm) => <path key={arm.id} d={arm.contour} />)}</clipPath>
      </defs>

      <g id={ref('local-bioluminescence')} opacity="0.38" filter={`url(#${ref('aura-blur')})`}>
        <ellipse cx="257" cy="343" rx="68" ry="32" fill="#ef365d" />
        <path d="M154 414 Q253 454 364 413" fill="none" stroke="#eb395e" strokeWidth="10" opacity="0.24" />
      </g>

      {introductionArtwork.filter((arm) => arm.depth !== 'front').map((arm) => <Tentacle key={arm.id} arm={arm} prefix={prefix} lighting={lighting} />)}

      <g id={ref('mantle')}>
        <path d={mantleContour} fill="none" stroke="#df64ce" strokeWidth="3.5" opacity="0.6" filter={`url(#${ref('rim-bloom')})`} />
        <path d={mantleContour} fill={`url(#${ref('mantle')})`} />
        <g clipPath={`url(#${ref('mantle-clip')})`}>
          <ellipse cx="255" cy="338" rx="72" ry="57" fill={`url(#${ref('face-light')})`} />
          <ellipse cx="253" cy="267" rx="82" ry="48" fill={`url(#${ref('crown-light')})`} />
          <path d={mantleContour} fill={`url(#${ref('blue-reflection')})`} opacity="0.35" />
          <path d={mantleContour} fill="none" stroke={`url(#${ref('blue-reflection')})`} strokeWidth="7" opacity="0.65" />
          <path d={mantleContour} fill={`url(#${ref('skin-variation')})`} filter={`url(#${ref('skin-grain')})`} opacity="0.3" />
          <path d="M195 288 C193 256 220 236 245 233 M273 234 Q291 238 300 249" fill="none" stroke="#a885d7" strokeWidth="2.4" opacity="0.25" filter={`url(#${ref('soften')})`} />
          <path d="M207 266 Q203 261 210 255 M211 250 L215 246 M225 239 L229 237 M284 244 L288 247" fill="none" stroke="#8062ad" strokeWidth="2.5" strokeLinecap="round" opacity="0.27" />
          {crownSpeckles.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={p.r} fill={i % 3 ? '#a779bd' : '#d6bae8'} opacity={0.08 + i % 4 * 0.04} />)}
        </g>
        <path d={mantleContour} fill="none" stroke={`url(#${ref('mantle-rim')})`} strokeWidth="1.1" />
        <path d="M211 241 C232 225 262 225 283 234" fill="none" stroke="#e6c1f2" strokeWidth="0.85" opacity="0.7" />
      </g>

      {introductionArtwork.filter((arm) => arm.depth === 'front').map((arm) => <Tentacle key={arm.id} arm={arm} prefix={prefix} lighting={lighting} />)}

      <g id={ref('root-web')} clipPath={`url(#${ref('anatomy-clip')})`}>
        <ellipse cx="256" cy="344" rx="55" ry="43" fill={`url(#${ref('face-light')})`} />
      </g>

      <g id={ref('face')} data-part="face">
        <path d="M207 286 Q211 277 221 280 M290 279 Q299 276 305 284" stroke="#100e25" strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.85" />
        <Eye x={221} y={317} rotation={-9} prefix={prefix} side="left" />
        <Eye x={295} y={316} rotation={8} prefix={prefix} side="right" />
        <g id={ref('cheeks')} data-part="cheeks">
          <ellipse cx="204" cy="338" rx="13" ry="6" fill="#ff6485" opacity="0.42" filter={`url(#${ref('rim-bloom')})`} />
          <ellipse cx="310" cy="337" rx="13" ry="6" fill="#ff6485" opacity="0.42" filter={`url(#${ref('rim-bloom')})`} />
          <ellipse cx="204" cy="338" rx="11.2" ry="4.9" fill="#ff7582" opacity="0.82" transform="rotate(8 204 338)" />
          <ellipse cx="310" cy="337" rx="10.8" ry="5" fill="#ff7582" opacity="0.82" transform="rotate(-9 310 337)" />
          <ellipse cx="200" cy="336.8" rx="3.1" ry="1.1" fill="#ffb396" opacity="0.24" />
          <ellipse cx="306.5" cy="335.7" rx="3.1" ry="1.1" fill="#ffb396" opacity="0.24" />
        </g>
        <path id={ref('mouth')} data-part="mouth" d="M247 337 C252 343 264 345 271 337" fill="none" stroke="#35142b" strokeWidth="1.7" strokeLinecap="round" />
        <path d="M250 344 Q260 348 267 343" fill="none" stroke="#ffa178" strokeWidth="0.8" opacity="0.3" />
      </g>
    </g>
  );
}
