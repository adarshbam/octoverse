import type { ProjectSection, ProjectTechnologyUsage, Technology } from '../../../engine/content/projectTypes';

// Storyboard copy (Veyra.jpeg panels 3 and 5) standing in for real project text. Every entry is
// flagged so the interface can badge it until the owner replaces it.

export function placeholderUsages(technologies: readonly Technology[]): ProjectTechnologyUsage[] {
  return technologies.map(technology => ({ id: `veyra-${technology.id}`, technologyId: technology.id, placeholder: true }));
}

export const placeholderSections: readonly ProjectSection[] = [
  {
    id: 'overview',
    title: 'Overview',
    summary: 'A full-stack cloud storage platform inspired by Google Drive. Upload, organize, share files with secure token-based access, built with modern web technologies.',
    placeholder: true,
  },
  {
    id: 'features',
    title: 'Features',
    items: [
      'File Upload & Storage: Large file support with streaming',
      'Share with Links: Secure token-based access with expiry',
      'Folder Organization: Nested folders and real-time size calculation',
      'Authentication: Secure sessions and access control',
    ],
    placeholder: true,
  },
  ...['Tech Stack', 'Architecture', 'Challenges', 'What I Learned'].map(title => ({
    id: title.toLowerCase().replaceAll(' ', '-'),
    title,
    summary: `Placeholder: ${title} for Vault OS.`,
    placeholder: true,
  })),
];
