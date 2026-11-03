import { createRoot } from 'react-dom/client';
import { BACK_VIEW_YAWS, COMPONENT_VIEWS, HQ_PANEL_2, PANEL_2, hqPixel, type ComponentId } from './components';

// One character component at a time: the reference crop beside the live render,
// frozen, moving and in an orbit view, all framing the same world box. The back view
// instead shows the body turned front, three-quarter, side and back, side by side, frozen.

const params = new URLSearchParams(location.search);
const id = (params.get('component') ?? 'full') as ComponentId;
const view = COMPONENT_VIEWS[id] ?? COMPONENT_VIEWS.full;
const BACK = id === 'back';
const [x0, y0, x1, y1] = view.box;
const aspect = (y0 - y1) / (x1 - x0);
// A grid that fills the window, keeping the box's aspect: 2 x 2, or one row of four for the back view.
const COLUMNS = BACK ? BACK_VIEW_YAWS.length : 2;
const ROWS = BACK ? 1 : 2;
const PANE_WIDTH = Math.floor(Math.min((innerWidth - 32 - 12 * (COLUMNS - 1)) / COLUMNS, (innerHeight - 150) / ROWS / aspect));
const height = Math.round(PANE_WIDTH * aspect);
const box = view.box.join(',');

// The high-quality panel 2 by default; `&ref=panel` shows the original storyboard panel.
const ORIGINAL = params.get('ref') === 'panel';

// `&pose=swim-open` or `swim-trail` shows that swim pose in every live pane, its arms swung back as
// in the swim, and `&yaw=<deg>` turns the body (the back view sets its own turns).
const POSE = params.get('pose');
const YAW = BACK ? null : params.get('yaw');
// `&expression=<id>` shows that face in the live panes. `&expression=blow` (the bubble blow, Task 22)
// shows the blow face at its fullest, frozen, and two stills of the blow itself as it plays
// (`?freeze&blow=<s>`): the cheeks puffed before the first bubble, and the first one wobbling out.
const EXPRESSION = params.get('expression');
const BLOW = EXPRESSION === 'blow';
const BLOW_STILLS = [0.25, 0.5] as const;
const EXTRA = `${POSE ? `&pose=${encodeURIComponent(POSE)}` : ''}${YAW ? `&yaw=${encodeURIComponent(YAW)}` : ''}`;
const FACE = EXPRESSION ? `&expression=${encodeURIComponent(EXPRESSION)}` : '';

function Reference() {
  const crop = ORIGINAL
    ? { left: PANEL_2.left + PANEL_2.width / 2 + x0 * 100, top: PANEL_2.top + PANEL_2.height / 2 - y0 * 100, k: PANE_WIDTH / ((x1 - x0) * 100) }
    : { left: hqPixel(x0, y0).x, top: hqPixel(x0, y0).y, k: PANE_WIDTH / ((x1 - x0) * HQ_PANEL_2.pxPerUnit) };
  const image = ORIGINAL ? { src: '/spike/Nox.jpeg', width: PANEL_2.imageWidth, height: PANEL_2.imageHeight } : HQ_PANEL_2;
  return (
    <div
      role="img"
      aria-label={`Reference: ${view.label}`}
      style={{
        width: PANE_WIDTH,
        height,
        backgroundImage: `url(${image.src})`,
        backgroundSize: `${image.width * crop.k}px ${image.height * crop.k}px`,
        backgroundPosition: `${-crop.left * crop.k}px ${-crop.top * crop.k}px`,
      }}
    />
  );
}

const live = (query: string, title: string) => (
  <iframe title={title} src={`/?stage=intro&${query}&view=${box}${EXTRA}${query.includes('blow=') ? '' : FACE}`} style={{ width: PANE_WIDTH, height, border: 0, display: 'block' }} />
);

function Review() {
  return (
    <main style={{ padding: 16, fontFamily: 'system-ui, sans-serif', color: '#d8cfe8' }}>
      <nav style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        {(Object.keys(COMPONENT_VIEWS) as ComponentId[]).map(key => (
          <a key={key} href={`?component=${key}`} style={{ color: key === id ? '#ff8fa8' : '#a99cc8' }}>{COMPONENT_VIEWS[key].label}</a>
        ))}
      </nav>
      <h1 style={{ fontSize: 18, margin: '0 0 12px' }}>
        {view.label}
        {POSE ? `, pose ${POSE}` : ''}
        {YAW ? `, turned ${YAW}°` : ''}
        {EXPRESSION ? `, face ${EXPRESSION}` : ''}
      </h1>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${COLUMNS}, ${PANE_WIDTH}px)`, gap: 12 }}>
        {(BACK
          ? BACK_VIEW_YAWS.map(deg => [deg === 0 ? 'Front (0°)' : `Turned ${deg}°`, live(`freeze&yaw=${deg}`, `Turned ${deg} degrees`)])
          : BLOW
          ? [
              [ORIGINAL ? 'Reference (panel 2)' : 'Reference (high-quality panel 2)', <Reference key="ref" />],
              ['Blow face, frozen (puff 1, mouth round 1)', live('freeze', 'Blow face frozen')],
              ...BLOW_STILLS.map(s => [`The blow at ${s} s`, live(`freeze&blow=${s}`, `The blow at ${s} seconds`)]),
            ]
          : [
              [ORIGINAL ? 'Reference (panel 2)' : 'Reference (high-quality panel 2)', <Reference key="ref" />],
              ['Live, frozen', live('freeze', 'Live frozen')],
              ['Live, moving', live('', 'Live moving')],
              ['3D orbit (drag to rotate)', live('freeze&orbit', 'Orbit view')],
            ]
        ).map(([caption, pane]) => (
          <figure key={caption as string} style={{ margin: 0 }}>
            {pane}
            <figcaption style={{ fontSize: 13, paddingTop: 4 }}>{caption}</figcaption>
          </figure>
        ))}
      </div>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<Review />);
