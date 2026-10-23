import { createRoot } from 'react-dom/client';
import { COMPONENT_VIEWS, PANEL_2, type ComponentId } from './components';

// One character component at a time: the reference crop beside the live render,
// frozen, moving and in an orbit view, all framing the same world box.

const params = new URLSearchParams(location.search);
const id = (params.get('component') ?? 'full') as ComponentId;
const view = COMPONENT_VIEWS[id] ?? COMPONENT_VIEWS.full;
const [x0, y0, x1, y1] = view.box;
const aspect = (y0 - y1) / (x1 - x0);
// A 2 x 2 grid that fills the window, keeping the box's aspect.
const PANE_WIDTH = Math.floor(Math.min((innerWidth - 44) / 2, (innerHeight - 150) / 2 / aspect));
const height = Math.round(PANE_WIDTH * aspect);
const box = view.box.join(',');

function Reference() {
  const cropLeft = PANEL_2.left + PANEL_2.width / 2 + x0 * 100;
  const cropTop = PANEL_2.top + PANEL_2.height / 2 - y0 * 100;
  const k = PANE_WIDTH / ((x1 - x0) * 100);
  return (
    <div
      role="img"
      aria-label={`Reference: ${view.label}`}
      style={{
        width: PANE_WIDTH,
        height,
        backgroundImage: 'url(/spike/Nox.jpeg)',
        backgroundSize: `${PANEL_2.imageWidth * k}px ${PANEL_2.imageHeight * k}px`,
        backgroundPosition: `${-cropLeft * k}px ${-cropTop * k}px`,
      }}
    />
  );
}

const live = (query: string, title: string) => (
  <iframe title={title} src={`/?stage=intro&${query}&view=${box}`} style={{ width: PANE_WIDTH, height, border: 0, display: 'block' }} />
);

function Review() {
  return (
    <main style={{ padding: 16, fontFamily: 'system-ui, sans-serif', color: '#d8cfe8' }}>
      <nav style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        {(Object.keys(COMPONENT_VIEWS) as ComponentId[]).map(key => (
          <a key={key} href={`?component=${key}`} style={{ color: key === id ? '#ff8fa8' : '#a99cc8' }}>{COMPONENT_VIEWS[key].label}</a>
        ))}
      </nav>
      <h1 style={{ fontSize: 18, margin: '0 0 12px' }}>{view.label}</h1>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(2, ${PANE_WIDTH}px)`, gap: 12 }}>
        {[
          ['Reference (panel 2)', <Reference key="ref" />],
          ['Live, frozen', live('freeze', 'Live frozen')],
          ['Live, moving', live('', 'Live moving')],
          ['3D orbit (drag to rotate)', live('freeze&orbit', 'Orbit view')],
        ].map(([caption, pane]) => (
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
