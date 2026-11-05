import { aetherTechnologies } from '../../worlds/aether/content/aetherTechnologies';
import { fluxTechnologies } from '../../worlds/flux/content/fluxTechnologies';
import { noxTechnologies } from '../../worlds/nox/content/noxTechnologies';
import { veyraTechnologies } from '../../worlds/veyra/content/veyraTechnologies';
import type { Technology } from './types';

// The shared technology catalog (platform spec 7.13): the union of the four worlds' own technology lists plus a small approved common
// set of well-known technologies. A creator picks from it; there is no free-text technology in v1. Each entry is the engine's own
// `Technology` ({ id, name, category, iconKey }): the icon mechanism is the worlds', an `iconKey` the engine draws from simple-icons
// (artifacts/logoTexture.ts LOGO_SLUGS); a key that table does not know yet draws the orb's lettered fallback, as AWS and OpenAI do in the worlds.

/** The four worlds' lists in the house order (Veyra, Flux, Nox, Aether): the first world to declare an id names it, and the lists agree. */
const WORLD_LISTS: readonly (readonly Technology[])[] = [veyraTechnologies, fluxTechnologies, noxTechnologies, aetherTechnologies];

/**
 * The approved common set: well-known technologies no world declares, added so a creator's own stack is not limited to the four
 * showcase projects'. Each has a simple-icons mark (COMMON_ICON_EXPORTS); the engine draws it once its LOGO_SLUGS table
 * names the key (until then the lettered fallback, exactly as for the worlds' AWS and OpenAI).
 */
export const COMMON_TECHNOLOGIES: readonly Technology[] = [
  { id: 'vue', name: 'Vue', category: 'framework', iconKey: 'vue' },
  { id: 'angular', name: 'Angular', category: 'framework', iconKey: 'angular' },
  { id: 'svelte', name: 'Svelte', category: 'framework', iconKey: 'svelte' },
  { id: 'tailwind', name: 'Tailwind CSS', category: 'styles', iconKey: 'tailwind' },
  { id: 'sass', name: 'Sass', category: 'styles', iconKey: 'sass' },
  { id: 'vite', name: 'Vite', category: 'tooling', iconKey: 'vite' },
  { id: 'threejs', name: 'Three.js', category: 'graphics', iconKey: 'threejs' },
  { id: 'go', name: 'Go', category: 'language', iconKey: 'go' },
  { id: 'rust', name: 'Rust', category: 'language', iconKey: 'rust' },
  { id: 'java', name: 'Java', category: 'language', iconKey: 'java' },
  { id: 'cpp', name: 'C++', category: 'language', iconKey: 'cpp' },
  { id: 'php', name: 'PHP', category: 'language', iconKey: 'php' },
  { id: 'swift', name: 'Swift', category: 'language', iconKey: 'swift' },
  { id: 'kotlin', name: 'Kotlin', category: 'language', iconKey: 'kotlin' },
  { id: 'django', name: 'Django', category: 'framework', iconKey: 'django' },
  { id: 'flask', name: 'Flask', category: 'framework', iconKey: 'flask' },
  { id: 'fastapi', name: 'FastAPI', category: 'framework', iconKey: 'fastapi' },
  { id: 'graphql', name: 'GraphQL', category: 'integration', iconKey: 'graphql' },
  { id: 'mysql', name: 'MySQL', category: 'data', iconKey: 'mysql' },
  { id: 'sqlite', name: 'SQLite', category: 'data', iconKey: 'sqlite' },
  { id: 'firebase', name: 'Firebase', category: 'cloud', iconKey: 'firebase' },
  { id: 'vercel', name: 'Vercel', category: 'cloud', iconKey: 'vercel' },
  { id: 'kubernetes', name: 'Kubernetes', category: 'containers', iconKey: 'kubernetes' },
  { id: 'terraform', name: 'Terraform', category: 'infrastructure', iconKey: 'terraform' },
  { id: 'nginx', name: 'Nginx', category: 'server', iconKey: 'nginx' },
  { id: 'figma', name: 'Figma', category: 'design', iconKey: 'figma' },
];

/** Each common technology's `iconKey` to its simple-icons export (the engine's LOGO_SLUGS shape): the test checks every one resolves. */
export const COMMON_ICON_EXPORTS: Readonly<Record<string, string>> = {
  vue: 'siVuedotjs',
  angular: 'siAngular',
  svelte: 'siSvelte',
  tailwind: 'siTailwindcss',
  sass: 'siSass',
  vite: 'siVite',
  threejs: 'siThreedotjs',
  go: 'siGo',
  rust: 'siRust',
  java: 'siOpenjdk',
  cpp: 'siCplusplus',
  php: 'siPhp',
  swift: 'siSwift',
  kotlin: 'siKotlin',
  django: 'siDjango',
  flask: 'siFlask',
  fastapi: 'siFastapi',
  graphql: 'siGraphql',
  mysql: 'siMysql',
  sqlite: 'siSqlite',
  firebase: 'siFirebase',
  vercel: 'siVercel',
  kubernetes: 'siKubernetes',
  terraform: 'siTerraform',
  nginx: 'siNginx',
  figma: 'siFigma',
};

function union(lists: readonly (readonly Technology[])[]): readonly Technology[] {
  const seen = new Set<string>();
  const out: Technology[] = [];
  for (const list of lists) {
    for (const tech of list) {
      if (seen.has(tech.id)) continue;
      seen.add(tech.id);
      out.push(Object.freeze({ ...tech }));
    }
  }
  return Object.freeze(out);
}

/** Every technology a creator may pick: the four worlds' (deduplicated by id) then the approved common set. Frozen. */
export const CATALOG: readonly Technology[] = union([...WORLD_LISTS, COMMON_TECHNOLOGIES]);
