import { useId } from 'react';
import type { NoxSceneLighting } from './sceneLighting';

const leftPillar = 'M0 0 H61 L57 39 L64 77 L57 108 L70 129 L62 164 L70 190 L62 224 L74 256 L64 292 L67 321 L56 359 L64 401 L53 436 L63 471 L0 505Z';
const rightWall = 'M451 0 H507 V505 L475 489 L471 451 L459 422 L462 392 L450 366 L453 333 L438 307 L444 278 L436 253 L440 227 L426 209 L437 180 L427 157 L441 136 L440 99 L450 77 L447 36Z';

function randomAt(index: number, seed = 19) {
  const value = Math.sin(index * 127.1 + seed * 311.7) * 43758.5453;
  return value - Math.floor(value);
}

function Stonework({ side, clip }: { side: 'left' | 'right'; clip: string }) {
  const origin = side === 'left' ? -14 : 426;
  return (
    <g clipPath={`url(#${clip})`} opacity="0.57">
      {Array.from({ length: 42 }, (_, i) => {
        const row = Math.floor(i / 3);
        const column = i % 3;
        const x = origin + column * 32 - row % 2 * 13;
        const y = row * 37 - 12 + randomAt(i, 3) * 5;
        const w = 31 + randomAt(i, 7) * 10;
        const h = 29 + randomAt(i, 11) * 8;
        const face = `M${x + 3} ${y} L${x + w - 4} ${y - 3} L${x + w} ${y + 2} L${x + w - 1} ${y + h - 3} L${x + 4} ${y + h} L${x} ${y + h - 7}Z`;
        return <g key={i}>
          <path d={face} fill={['#090f1c', '#0b1422', '#0a1020', '#0c1523', '#111422'][i % 5]} />
          <path d={`M${x + 3} ${y} L${x + w - 4} ${y - 3} L${x + w} ${y + 2} L${x + 6} ${y + 4}Z`} fill={row < 5 ? '#20374b' : '#222638'} opacity={0.35 + randomAt(i) * 0.2} />
          <path d={`M${x + w} ${y + 2} L${x + w - 1} ${y + h - 3} L${x + w - 4} ${y + h - 6} L${x + w - 3} ${y + 7}Z`} fill="#040912" />
          <path d={`M${x + 11} ${y + 5} l-2 7 4 4 -1 6`} fill="none" stroke="#030813" strokeWidth="0.7" opacity={i % 3 ? 0.45 : 0.9} />
        </g>;
      })}
    </g>
  );
}

function Rock({ x, y, size, warm = false }: { x: number; y: number; size: number; warm?: boolean }) {
  return <g transform={`translate(${x} ${y}) scale(${size})`}>
    <path d="M-1 0 L-.76 -.51 L-.32 -.65 L.12 -.45 L.44 -.62 L.88 -.24 L1 .08 L.45 .29 L-.62 .31Z" fill="#050b15" />
    <path d="M-1 0 L-.76 -.51 L-.32 -.65 L.12 -.45 L-.18 -.21 L-.59 -.19Z" fill={warm ? '#35202c' : '#142233'} />
    <path d="M.12 -.45 L.44 -.62 L.88 -.24 L.25 -.15 L-.18 -.21Z" fill={warm ? '#4f2538' : '#1a2839'} opacity="0.72" />
    <path d="M-.76 -.51 L-.32 -.65 L.12 -.45" fill="none" stroke={warm ? '#95384d' : '#294158'} strokeWidth="0.045" opacity="0.6" />
  </g>;
}

export function NoxEnvironment({ lighting, layer }: { lighting: NoxSceneLighting; layer: 'background' | 'foreground' }) {
  const prefix = `realm-${useId().replaceAll(':', '')}`;
  const ref = (id: string) => `${prefix}-${id}`;

  if (layer === 'foreground') return (
    <g id="nox-environment-foreground" aria-hidden="true">
      <defs>
        <radialGradient id={ref('vignette')} cx="51%" cy="49%" r="73%"><stop offset=".48" stopColor="#01040c" stopOpacity="0" /><stop offset="1" stopColor="#01040c" stopOpacity=".58" /></radialGradient>
        <radialGradient id={ref('embers')}><stop stopColor="#ff795d" stopOpacity=".8" /><stop offset=".19" stopColor="#fa3454" stopOpacity=".6" /><stop offset=".53" stopColor="#a61b42" stopOpacity=".25" /><stop offset="1" stopColor="#b0224e" stopOpacity="0" /></radialGradient>
      </defs>
      <path d="M0 445 L12 441 L25 449 L42 440 L60 449 L72 455 L91 451 L113 470 L130 475 L150 494 L185 505 H0Z" fill="#020712" />
      <path d="M507 411 L495 428 L487 431 L478 452 L462 450 L447 466 L431 465 L414 480 L396 486 L376 505 H507Z" fill="#020710" />
      {[ [6, 473, 29], [30, 463, 25], [66, 478, 35], [93, 489, 28], [125, 500, 16], [486, 469, 32], [452, 483, 25], [422, 496, 20] ].map(([x, y, size], i) => <Rock key={i} x={x} y={y} size={size} warm={i % 3 === 0} />)}
      {lighting.crimson.filter(light => light.id.endsWith('lower')).map(light => <ellipse key={light.id} cx={light.x} cy={light.y} rx={light.radius * .36} ry={light.radius * .41} fill={`url(#${ref('embers')})`} />)}
      <g fill="none" strokeLinecap="round">
        <path d="M81 453 l-3 -11 2 -7 -3 -9 m8 22 l-1 -10 M409 473 l-3 -14 2 -7 -2 -11 m11 25 l-1 -10" stroke="#d12a42" strokeWidth="3" />
        <path d="M81 452 l-2 -7 M79 435 l-1 -5 M410 471 l-2 -10 m1 -6 l-1 -7 M417 465 l-1 -4" stroke="#ff9770" strokeWidth="1.3" />
      </g>
      <g fill="none" strokeLinecap="round">
        {Array.from({ length: 23 }, (_, i) => {
          const right = i > 11;
          const x = right ? 477 + randomAt(i, 40) * 35 : randomAt(i, 40) * 42;
          const y = 404 + randomAt(i, 43) * 101;
          const h = 8 + randomAt(i, 44) * 27;
          return <g key={i} stroke={i % 3 ? '#73142d' : '#c32448'} opacity={.35 + randomAt(i) * .4}>
            <path d={`M${x} ${y} q-5 ${-h * .5} -2 ${-h} m1 ${h * .55} q-8 -2 -8 -9 m9 5 q7 -3 7 -11`} strokeWidth="1.7" />
            <path d={`M${x - 2} ${y - h} l1 4`} stroke="#ff4c62" strokeWidth="1.1" />
          </g>;
        })}
      </g>
      {Array.from({length:110},(_,i) => {
        const x = i % 2 ? randomAt(i, 79) * 53 : 477 + randomAt(i, 79) * 30;
        const y = 345 + randomAt(i, 80) * 154;
        return <path key={i} d={`M${x} ${y} l${randomAt(i) * 3 - 1} -4 1 -2 .5 4Z`} fill={i % 3 ? '#a02246' : '#f64262'} opacity={.2 + randomAt(i, 81) * .65} />;
      })}
      {[77,411].map((x,j)=><g key={x}>
        {Array.from({length:24},(_,i)=>{
          const px=x+(randomAt(i,j+89)-.5)*29;
          const py=(j?461:443)+(randomAt(i,j+93)-.5)*45;
          return <path key={i} d={`M${px} ${py} l-1 -${2+randomAt(i)*5} 2 -2 .5 5Z`} fill={i%4?'#ce274c':'#ff8c69'} opacity={.3+randomAt(i,91)*.5}/>;
        })}
      </g>)}
      <rect width="507" height="505" fill={`url(#${ref('vignette')})`} />
    </g>
  );

  return (
    <g id="nox-environment-background" aria-hidden="true">
      <defs>
        <linearGradient id={ref('water')} x1="280" y1="0" x2="250" y2="505" gradientUnits="userSpaceOnUse">
          <stop stopColor="#081a2b" /><stop offset="0.36" stopColor="#040c1a" /><stop offset="0.74" stopColor="#060b18" /><stop offset="1" stopColor="#0d1020" />
        </linearGradient>
        <radialGradient id={ref('overhead')} cx={lighting.overhead.x} cy={lighting.overhead.y} r={lighting.overhead.radius} gradientUnits="userSpaceOnUse">
          <stop stopColor={lighting.overhead.color} stopOpacity={lighting.overhead.strength} /><stop offset="0.27" stopColor="#215478" stopOpacity="0.42" /><stop offset="0.58" stopColor="#14324c" stopOpacity="0.13" /><stop offset="1" stopColor="#10233e" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={ref('distance')} x1="0" y1="0" x2="1" y2="0.4"><stop stopColor="#0b1626" /><stop offset="0.5" stopColor="#10253a" /><stop offset="1" stopColor="#071222" /></linearGradient>
        <linearGradient id={ref('floor')} x1="255" y1="400" x2="255" y2="505" gradientUnits="userSpaceOnUse"><stop stopColor="#0a1120" /><stop offset="0.67" stopColor="#181321" /><stop offset="1" stopColor="#321924" /></linearGradient>
        <clipPath id={ref('left-wall')}><path d={leftPillar} /></clipPath>
        <clipPath id={ref('right-wall')}><path d={rightWall} /></clipPath>
        <filter id={ref('haze')}><feGaussianBlur stdDeviation="2" /></filter>
        <filter id={ref('shaft-soft')} x="-30%" y="-10%" width="160%" height="120%"><feGaussianBlur stdDeviation="4" /></filter>
        <filter id={ref('rune-glow')} x="-100%" y="-50%" width="300%" height="200%"><feGaussianBlur stdDeviation="3" /></filter>
        <filter id={ref('stone-grain')} colorInterpolationFilters="sRGB"><feTurbulence type="fractalNoise" baseFrequency=".1 .18" numOctaves="3" seed="41" /><feColorMatrix type="matrix" values="0 0 0 0 .23 0 0 0 0 .29 0 0 0 0 .4 .6 0 0 0 -.2" /></filter>
        <linearGradient id={ref('shaft')} x1="390" y1="0" x2="274" y2="265" gradientUnits="userSpaceOnUse"><stop stopColor={lighting.overhead.color} stopOpacity=".26" /><stop offset=".6" stopColor="#396791" stopOpacity=".035" /><stop offset="1" stopColor="#346593" stopOpacity="0" /></linearGradient>
        <radialGradient id={ref('bubble')} cx="32%" cy="18%" r="80%"><stop stopColor="#d9accd" stopOpacity=".35" /><stop offset=".25" stopColor="#784464" stopOpacity=".06" /><stop offset=".7" stopColor="#070d20" stopOpacity=".12" /><stop offset="1" stopColor="#c0486c" stopOpacity=".45" /></radialGradient>
        {lighting.crimson.map(light => <radialGradient key={light.id} id={ref(light.id)} cx={light.x} cy={light.y} r={light.radius} gradientUnits="userSpaceOnUse"><stop stopColor={light.color} stopOpacity={light.strength * 0.25} /><stop offset="0.34" stopColor={light.color} stopOpacity={light.strength * 0.09} /><stop offset="1" stopColor={light.color} stopOpacity="0" /></radialGradient>)}
      </defs>

      <rect width="507" height="505" fill={`url(#${ref('water')})`} />
      <rect width="507" height="390" fill={`url(#${ref('overhead')})`} />
      <g fill={`url(#${ref('shaft')})`} filter={`url(#${ref('shaft-soft')})`}>
        <path d="M356 -8 L370 -8 L232 262 L186 270Z M384 -8 L397 -8 L320 273 L271 276Z M417 -8 L433 -8 L406 237 L358 265Z" />
      </g>
      <g opacity=".47" fill="#3c7096">
        {Array.from({ length: 28 }, (_, i) => {
          const x = 302 + randomAt(i, 8) * 146;
          const y = randomAt(i, 9) * 73;
          return <path key={i} d={`M${x} ${y} l${6 + randomAt(i) * 15} -5 9 2 -13 3 -8 8Z`} opacity={.12 + randomAt(i) * .6} />;
        })}
      </g>
      <g fill={`url(#${ref('distance')})`} opacity="0.5" filter={`url(#${ref('haze')})`}>
        <path d="M88 351 L91 225 L97 218 L96 185 L108 191 L112 238 L121 243 L121 387Z" />
        <path d="M116 376 L122 272 L136 266 L140 283 L151 291 L149 394Z" />
        <path d="M374 389 L377 263 L389 255 L388 224 L401 214 L411 220 L408 259 L417 267 L414 418Z" />
        <path d="M345 398 L349 299 L357 292 L366 299 L371 405Z" opacity="0.6" />
        <path d="M153 426 L157 340 L166 329 L174 337 L180 430Z" opacity="0.45" />
      </g>
      <g fill="none" stroke="#23506a" strokeWidth="0.8" opacity="0.19">
        <path d="M97 188 L101 311 M389 226 L392 335 M111 239 L112 348 M402 253 L405 367" />
      </g>

      <path d="M0 505 L144 455 L205 424 L273 414 L354 441 L507 505Z" fill={`url(#${ref('floor')})`} />
      {Array.from({ length: 46 }, (_, i) => {
        const t = (i + 1) / 47;
        const y = 417 + t * 91;
        const x = 253 + (randomAt(i, 24) - 0.5) * (65 + t * 340);
        return <Rock key={i} x={x} y={y} size={2 + t * 10 * randomAt(i, 12)} warm={i % 4 === 0} />;
      })}

      <path d={leftPillar} fill="#040a14" />
      <path d={rightWall} fill="#050a15" />
      <Stonework side="left" clip={ref('left-wall')} />
      <Stonework side="right" clip={ref('right-wall')} />
      <g clipPath={`url(#${ref('left-wall')})`} opacity=".48"><rect width="80" height="505" filter={`url(#${ref('stone-grain')})`} /></g>
      <g clipPath={`url(#${ref('right-wall')})`} opacity=".48"><rect x="425" width="82" height="505" filter={`url(#${ref('stone-grain')})`} /></g>
      <g fill="none" stroke="#030812" strokeWidth="2.4" opacity=".8">
        <path d="M11 0 l13 48 -10 24 15 20 -7 32 16 14 -9 45 12 15 -15 44 8 26 -9 23 M490 6 l-16 36 8 27 -15 19 10 35 -12 37 15 22 -13 30 17 29 -10 25 16 26 -8 29" />
      </g>
      <g fill="#0b1421" stroke="#294051" strokeWidth=".45">
        <path d="M428 150 l31 -26 32 -1 9 19 -43 5 -22 23Z" />
        <path d="M437 177 l25 -20 34 2 5 18 -41 4 -21 15Z" />
        <path d="M22 123 l33 -13 14 16 -8 17 -35 -11Z" />
      </g>
      <path d="M61 0 L57 39 L64 77 L57 108 L70 129 L62 164 L70 190 L62 224 L74 256 L64 292" fill="none" stroke="#254259" strokeWidth="1.5" opacity="0.25" />
      <path d="M451 0 L447 36 L450 77 L440 99 L441 136 L427 157 L437 180 L426 209" fill="none" stroke="#37617a" strokeWidth="1.1" opacity="0.44" />
      {lighting.crimson.map(light => <rect key={light.id} width="507" height="505" fill={`url(#${ref(light.id)})`} />)}
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        {[
          'M48 137 l9 7 3 14 -5 15 -9 -3 -4 -11 4 -15 M48 146 l5 4 -2 7 -5 -2 M50 164 l3 -4',
          'M44 202 l-3 7 3 7 -2 9 M50 210 l2 7 -3 6 M41 232 l-4 5 2 6 M48 236 l-3 6',
          'M455 218 l6 -3 4 12 -2 10 M454 224 l-1 9 M460 225 l1 7',
          'M461 262 l-4 8 3 13 M466 260 l2 21 M460 272 l8 -3',
          'M448 310 l4 -8 3 7 -3 10 M477 325 l3 -5 2 8',
        ].map((d, i) => <g key={d} stroke={lighting.crimson[i < 2 ? 0 : 2].color}>
          <path d={d} strokeWidth="7" opacity=".85" filter={`url(#${ref('rune-glow')})`} />
          <path d={d} strokeWidth="1.7" opacity=".88" />
          <path d={d} stroke="#ff947d" strokeWidth=".55" opacity=".75" />
        </g>)}
      </g>
      <g fill="#b2274b">
        {Array.from({length:40},(_,i)=>{
          const x=i%2?38+randomAt(i,112)*22:449+randomAt(i,113)*25;
          const y=i%2?125+randomAt(i,114)*161:219+randomAt(i,115)*106;
          return <path key={i} d={`M${x} ${y} l1 -3 2 1 -1 4Z`} opacity={.2+randomAt(i)*.5}/>;
        })}
      </g>
      <g fill="none" stroke="#020713" strokeWidth="2.7" opacity=".85">
        {Array.from({ length: 18 }, (_, i) => {
          const x = 288 + i * 11.5;
          const y = 59 + Math.sin(i / 17 * Math.PI) * 26 - i * .8;
          return <ellipse key={i} cx={x} cy={y} rx="8.3" ry={i % 2 ? 2.5 : 4.5} transform={`rotate(${26 - i * 3.7} ${x} ${y})`} />;
        })}
        {Array.from({ length: 10 }, (_, i) => <ellipse key={i} cx={438 + i * 1.9} cy={i * 11.5 - 4} rx={i % 2 ? 2.1 : 3.3} ry="7.4" transform={`rotate(-11 ${438 + i * 1.9} ${i * 11.5 - 4})`} strokeWidth="2" />)}
      </g>
      <g>
        {[[94,253,8],[359,242,4.5],[97,370,6],[363,458,5.5],[405,431,5],[74,285,3],[346,264,1.9],[89,296,2.4],[428,379,2.8]].map(([x,y,r],i) => <g key={i} opacity={i % 2 ? .6 : .78}>
          <circle cx={x} cy={y} r={r} fill={`url(#${ref('bubble')})`} stroke="#794965" strokeWidth=".45" />
          <path d={`M${x - r * .7} ${y - r * .2} Q${x - r * .6} ${y - r * .85} ${x - r * .13} ${y - r * .8}`} fill="none" stroke="#c7a9ce" strokeWidth=".8" opacity=".6" />
          <circle cx={x + r * .25} cy={y + r * .73} r={r * .13} fill="#d9608c" />
        </g>)}
        {Array.from({length:65},(_,i) => <circle key={i} cx={15 + randomAt(i, 61) * 478} cy={30 + randomAt(i, 62) * 471} r={i % 7 ? .35 : .8} fill={i % 4 ? '#7396b7' : '#f66a8d'} opacity={.1 + randomAt(i, 63) * .3} />)}
      </g>
    </g>
  );
}
