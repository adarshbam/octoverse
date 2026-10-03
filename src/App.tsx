import { NoxCharacter } from './components/nox/NoxCharacter';
import { NoxEnvironment } from './components/nox/NoxEnvironment';
import { noxSceneLighting } from './components/nox/sceneLighting';
import { nox } from './data/nox';

export const App = () => (
  <main className="nox-world">
    <svg className="nox-introduction" viewBox="0 0 507 505" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="nox-title nox-description">
      <title id="nox-title">{nox.name} — {nox.epithet}</title>
      <desc id="nox-description">Static introduction study. Nox, a luminous violet octopus with eight curling tentacles, ruby eyes, and coral suction cups, represents Security Lab in a dark underwater ruin corridor lit by blue shafts and crimson inscriptions.</desc>
      <defs>
        <linearGradient id="nameplate-fill" x2="0" y2="1"><stop stopColor="#170f20" /><stop offset="1" stopColor="#070c19" /></linearGradient>
        <filter id="label-glow" x="-30%" y="-100%" width="160%" height="300%"><feGaussianBlur stdDeviation="3" /></filter>
      </defs>
      <NoxEnvironment lighting={noxSceneLighting} layer="background" />

      <g className="project-identity" textAnchor="middle" fill="#f2ebee">
        <text x="255" y="110" fontSize="9.2" letterSpacing="5.5" fill="#ef6b7d">OCTOVERSE</text>
        <path d="M159 119 C164 129 173 128 173 138 C173 148 167 154 160 154 C149 154 143 148 145 138 C146 132 151 128 152 124 C151 132 155 134 157 131 C160 127 159 123 159 119Z M158 137 C158 141 153 143 155 147 C158 151 166 148 164 144 C163 142 161 141 161 138 C160 141 157 140 158 137Z" fill="#f95770" fillRule="evenodd" />
        <text x="285" y="149" fontSize="30" fontWeight="700" letterSpacing="-0.65">Security <tspan fill="#fb536c">Lab</tspan></text>
        <text x="255" y="175" fontSize="11.5">{nox.tagline}</text>
        {nox.introduction.map((line, i) => <text key={line} x="255" y={191 + i * 14} fontSize="10.8" fill="#d6d1dc">{line}</text>)}
      </g>

      <NoxCharacter lighting={noxSceneLighting} />
      <NoxEnvironment lighting={noxSceneLighting} layer="foreground" />

      <g className="nameplate" textAnchor="middle">
        <rect x="185" y="444" width="140" height="44" rx="22" fill="none" stroke="#f94d6d" strokeWidth="2" opacity="0.57" filter="url(#label-glow)" />
        <rect x="185" y="444" width="140" height="44" rx="22" fill="url(#nameplate-fill)" stroke="#c84262" strokeWidth="1" />
        <path d="M204 445 H306" stroke="#ec727f" opacity="0.6" strokeWidth="0.7" />
        <text x="255" y="462" fill="#f5ecf0" fontSize="15" fontWeight="600">{nox.name}</text>
        <text x="255" y="478" fill="#d5cad6" fontSize="11.5">{nox.epithet}</text>
      </g>
    </svg>
  </main>
);

export default App;
