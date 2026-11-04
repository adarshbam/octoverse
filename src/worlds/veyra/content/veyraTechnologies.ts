import type { Technology } from '../../../engine/content/projectTypes';

// The twelve technologies of panel 3 and panel 5's Tech Stack (spec 7.10), in the storyboard's
// order. No usage claims implied. AWS has no mark in the engine's logo set (simple-icons no longer
// ships one): its orb shows no logo until the pendants task decides how it is drawn.
export const veyraTechnologies: readonly Technology[] = [
  { id: 'react', name: 'React', category: 'framework', iconKey: 'react' },
  { id: 'typescript', name: 'TypeScript', category: 'language', iconKey: 'typescript' },
  { id: 'javascript', name: 'JavaScript', category: 'language', iconKey: 'javascript' },
  { id: 'node', name: 'Node.js', category: 'runtime', iconKey: 'node' },
  { id: 'express', name: 'Express', category: 'framework', iconKey: 'express' },
  { id: 'mongodb', name: 'MongoDB', category: 'data', iconKey: 'mongodb' },
  { id: 'redis', name: 'Redis', category: 'data', iconKey: 'redis' },
  { id: 'docker', name: 'Docker', category: 'containers', iconKey: 'docker' },
  { id: 'linux', name: 'Linux', category: 'operating system', iconKey: 'linux' },
  { id: 'aws', name: 'AWS', category: 'cloud', iconKey: 'aws' },
  { id: 'cloudflare', name: 'Cloudflare', category: 'cloud', iconKey: 'cloudflare' },
  { id: 'github', name: 'GitHub', category: 'development', iconKey: 'github' },
];
