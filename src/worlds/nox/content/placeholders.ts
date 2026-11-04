import type { ProjectSection, ProjectTechnologyUsage, Technology } from '../../../engine/content/projectTypes';

// Storyboard copy (Nox.jpeg panels 4 and 5) standing in for real project text.
// Every entry is flagged so the interface can badge it until the owner replaces it.

// Panel 4's text for Kali Linux, with the focused face Nox gives it there. No other technology has
// project text yet: none is invented; the interface says so while developing.
const KALI_USAGE: Omit<ProjectTechnologyUsage, 'id' | 'technologyId'> = {
  role: 'Security toolchain',
  details: ['Used for penetration testing', 'Vulnerability scanning', 'Exploitation and research', 'Security toolchain setup'],
  reaction: 'focused',
  placeholder: true,
};

export function placeholderUsages(technologies: readonly Technology[]): ProjectTechnologyUsage[] {
  return technologies.map(technology => ({
    id: `nox-${technology.id}`,
    technologyId: technology.id,
    ...(technology.id === 'kali' ? KALI_USAGE : { placeholder: true }),
  }));
}

export const placeholderSections: readonly ProjectSection[] = [
  {
    id: 'overview',
    title: 'Overview',
    summary: 'A hands-on web security lab where I explore real world vulnerabilities, learn exploitation techniques and document writeups. Built with Docker, custom vulnerable apps and modern security toolchain.',
    placeholder: true,
  },
  {
    id: 'features',
    title: 'Features',
    items: [
      'Vulnerable Apps: Intentional vulnerabilities for learning',
      'Exploitation Labs: SQLi, XSS, CSRF, IDOR and more',
      'Writeups: Detailed explanations and fixes',
      'Tool Integration: Burp Suite, Nmap, Metasploit, custom tools',
    ],
    placeholder: true,
  },
  ...['Vulnerabilities', 'Writeups', 'Challenges', 'What I Learned'].map(title => ({
    id: title.toLowerCase().replaceAll(' ', '-'),
    title,
    summary: `Placeholder: ${title} for Security Lab.`,
    placeholder: true,
  })),
];
