import type { ProjectSection, ProjectTechnologyUsage, Technology } from './projectTypes';

// Storyboard copy (Nox.jpeg panels 4 and 5) standing in for real project text.
// Every entry is flagged so the interface can badge it until the owner replaces it.

const TECH_ROLES: Record<string, { role: string; details?: string[]; summary?: string }> = {
  kali: {
    role: 'Security toolchain',
    details: ['Penetration testing and auditing', 'Vulnerability assessment labs', 'Network traffic analysis', 'Security toolchain setup'],
  },
  typescript: {
    role: 'Lab tooling & exploits',
    details: ['Type-safe test harness scripts', 'Automated vulnerability verification', 'Custom security test suites'],
  },
  docker: {
    role: 'Isolated environments',
    details: ['Containerized vulnerable targets', 'Reproducible sandbox testing', 'Multi-service lab topology'],
  },
  burp: {
    role: 'Web security auditing',
    details: ['HTTP request inspection & replay', 'Session analysis & injection testing', 'Automated vulnerability scanning'],
  },
  python: {
    role: 'Exploit development',
    details: ['Custom vulnerability proof-of-concepts', 'Automated scanning & reconnaissance', 'Payload generation scripts'],
  },
  linux: {
    role: 'Target environment',
    details: ['Privilege escalation lab exercises', 'Kernel security mechanisms', 'System hardening practice'],
  },
  node: {
    role: 'Backend runtime',
    details: ['Vulnerable API service targets', 'Mock authentication handlers'],
  },
  redis: {
    role: 'Cache & session store',
    details: ['Session security testing', 'Cache poison simulations'],
  },
  mongodb: {
    role: 'NoSQL database',
    details: ['NoSQL injection testbeds', 'Data exposure scenarios'],
  },
  javascript: {
    role: 'Client-side execution',
    details: ['DOM-based XSS demonstration labs', 'CORS misconfiguration analysis'],
  },
  html: {
    role: 'Interface structure',
    summary: 'Markup and templates for simulated vulnerable web applications.',
  },
  css: {
    role: 'Presentation & layout',
    summary: 'Interface styles and CSS-based exfiltration research.',
  },
  git: {
    role: 'Version control',
    summary: 'Repository history tracking and secret detection practice.',
  },
  github: {
    role: 'Source management',
    summary: 'Code reviews, issue tracking, and automated security CI workflows.',
  },
  express: {
    role: 'Web framework',
    summary: 'Routing and middleware vulnerability assessment labs.',
  },
};

export function placeholderUsages(technologies: readonly Technology[]): ProjectTechnologyUsage[] {
  return technologies.map(technology => {
    const info = TECH_ROLES[technology.id] ?? {
      role: `${technology.category} layer`,
      summary: `${technology.name} in the Security Lab environment.`,
    };
    return {
      id: `nox-${technology.id}`,
      technologyId: technology.id,
      placeholder: true,
      ...info,
    };
  });
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
