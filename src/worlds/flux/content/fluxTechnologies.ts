import type { Technology } from '../../../engine/content/projectTypes';

// The twelve technologies of panels 3 and 5 (spec 7.10). The two unlabelled icons in panel 3 (a bar
// chart and a workflow) stay unassigned until the owner names them. No usage claims implied.
// `iconKey`s the engine's logo table does not know yet draw no brand mark (artifacts/logoTexture.ts).
export const fluxTechnologies: readonly Technology[] = [
  { id: 'github-actions', name: 'GitHub Actions', category: 'automation', iconKey: 'githubactions' },
  { id: 'typescript', name: 'TypeScript', category: 'language', iconKey: 'typescript' },
  { id: 'node', name: 'Node.js', category: 'runtime', iconKey: 'node' },
  { id: 'redis', name: 'Redis', category: 'data', iconKey: 'redis' },
  { id: 'docker', name: 'Docker', category: 'containers', iconKey: 'docker' },
  { id: 'linux', name: 'Linux', category: 'operating system', iconKey: 'linux' },
  { id: 'aws', name: 'AWS', category: 'cloud', iconKey: 'aws' },
  { id: 'mongodb', name: 'MongoDB', category: 'data', iconKey: 'mongodb' },
  { id: 'express', name: 'Express', category: 'framework', iconKey: 'express' },
  { id: 'github-api', name: 'GitHub API', category: 'integration', iconKey: 'github' },
  { id: 'bash', name: 'Bash', category: 'shell', iconKey: 'bash' },
  { id: 'git', name: 'Git', category: 'version control', iconKey: 'git' },
];
