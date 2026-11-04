import type { Technology } from '../../../engine/content/projectTypes';

// The ten technologies panel 5 names, most important first: the overview hangs them on her arms
// from the upper pair down (spec 7.10), so the order is the project's priority, not alphabetical.
// All are storyboard placeholders until the owner confirms the stack. A technology the engine's
// logo table has no mark for (OpenAI, React, Next.js, PostgreSQL, AWS, Vector DB) shows its lettered
// fallback on its orb until that table gains one; the `iconKey`s here are the keys it will take.
export const aetherTechnologies: readonly Technology[] = [
  { id: 'openai', name: 'OpenAI', category: 'ai', iconKey: 'openai' },
  { id: 'python', name: 'Python', category: 'language', iconKey: 'python' },
  { id: 'typescript', name: 'TypeScript', category: 'language', iconKey: 'typescript' },
  { id: 'react', name: 'React', category: 'framework', iconKey: 'react' },
  { id: 'nextjs', name: 'Next.js', category: 'framework', iconKey: 'nextjs' },
  { id: 'postgresql', name: 'PostgreSQL', category: 'data', iconKey: 'postgresql' },
  { id: 'redis', name: 'Redis', category: 'data', iconKey: 'redis' },
  { id: 'docker', name: 'Docker', category: 'containers', iconKey: 'docker' },
  { id: 'aws', name: 'AWS', category: 'cloud', iconKey: 'aws' },
  { id: 'vector-db', name: 'Vector DB', category: 'data', iconKey: 'vectordb' },
];
