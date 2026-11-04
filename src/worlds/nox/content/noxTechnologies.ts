import type { Technology } from '../../../engine/content/projectTypes';

// Membership confirmed by the user from the Nox references. No usage claims implied.
export const noxTechnologies: readonly Technology[] = [
  { id: 'html', name: 'HTML', category: 'markup', iconKey: 'html' },
  { id: 'css', name: 'CSS', category: 'styles', iconKey: 'css' },
  { id: 'javascript', name: 'JavaScript', category: 'language', iconKey: 'javascript' },
  { id: 'typescript', name: 'TypeScript', category: 'language', iconKey: 'typescript' },
  { id: 'node', name: 'Node.js', category: 'runtime', iconKey: 'node' },
  { id: 'redis', name: 'Redis', category: 'data', iconKey: 'redis' },
  { id: 'docker', name: 'Docker', category: 'containers', iconKey: 'docker' },
  { id: 'github', name: 'GitHub', category: 'development', iconKey: 'github' },
  { id: 'git', name: 'Git', category: 'version control', iconKey: 'git' },
  { id: 'python', name: 'Python', category: 'language', iconKey: 'python' },
  { id: 'mongodb', name: 'MongoDB', category: 'data', iconKey: 'mongodb' },
  { id: 'linux', name: 'Linux', category: 'operating system', iconKey: 'linux' },
  { id: 'kali', name: 'Kali Linux', category: 'operating system', iconKey: 'kali' },
  { id: 'burp', name: 'Burp Suite', category: 'security', iconKey: 'burp' },
  { id: 'express', name: 'Express', category: 'framework', iconKey: 'express' },
];
