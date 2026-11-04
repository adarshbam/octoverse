import type { ProjectSection, ProjectTechnologyUsage, Technology } from '../../../engine/content/projectTypes';

// Storyboard copy (Flux panels 3, 4 and 5) standing in for real project text. Every entry is
// flagged so the interface can badge it until the owner replaces it.

// Panel 4's text for GitHub Actions, with the focused face Flux gives it there. No other technology
// has project text yet: none is invented; the interface says so while developing.
const GITHUB_ACTIONS_USAGE: Omit<ProjectTechnologyUsage, 'id' | 'technologyId'> = {
  role: 'Workflow runner integration',
  details: ['Workflow runner integration', 'Trigger builds via webhooks', 'Artifacts and caching', 'Automated deployments'],
  reaction: 'focused',
  placeholder: true,
};

export function placeholderUsages(technologies: readonly Technology[]): ProjectTechnologyUsage[] {
  return technologies.map(technology => ({
    id: `flux-${technology.id}`,
    technologyId: technology.id,
    ...(technology.id === 'github-actions' ? GITHUB_ACTIONS_USAGE : { placeholder: true }),
  }));
}

export const placeholderSections: readonly ProjectSection[] = [
  {
    id: 'overview',
    title: 'Overview',
    summary: 'A self-hosted CI/CD system with GitHub webhooks, dynamic workflows, multiple runners, parallel jobs and dependency handling. Built with Node.js, TypeScript and Redis.',
    placeholder: true,
  },
  {
    id: 'features',
    title: 'Features',
    items: [
      'Webhook Integration: Trigger pipelines on push/PR',
      'Workflow Engine: YAML/JSON based configs',
      'Multiple Runners: Self-hosted and multi-project',
      'DAG Execution: Parallel jobs with dependencies',
    ],
    placeholder: true,
  },
  {
    id: 'tech-stack',
    title: 'Tech Stack',
    summary: 'Node.js, TypeScript, Express, Redis, Docker, AWS, Linux, GitHub API and MongoDB.',
    placeholder: true,
  },
  ...['Architecture', 'Challenges', 'What I Learned'].map(title => ({
    id: title.toLowerCase().replaceAll(' ', '-'),
    title,
    summary: `Placeholder: ${title} for GitHub Pipeline Engine.`,
    placeholder: true,
  })),
];
