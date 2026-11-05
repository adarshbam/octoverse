import type { ProjectSection, ProjectTechnologyUsage, Technology } from '../../../engine/content/projectTypes';

// Storyboard copy (Aether's panels 4 and 5) standing in for real project text. Every entry is
// flagged `placeholder: true` (the marker Nox's content uses), so the interface can badge it until
// the owner replaces it.

type Usage = Omit<ProjectTechnologyUsage, 'id' | 'technologyId'>;

/**
 * The tooltip's usage notes (spec 7.5, Task 19): panel 4's text for OpenAI, and for the other nine
 * shipped technologies three short lines in its manner, written for the storyboard (not facts about
 * the project) and flagged as placeholders until the owner supplies the real ones. Each wears the
 * "ooh" face Aether gives OpenAI in P4 (`curious`, the wonder expression). The five test-set
 * technologies have none: they are not shipped.
 */
const USAGES: Readonly<Record<string, Usage>> = {
  openai: { role: 'LLM integration', details: ['LLM integration', 'Text / image generation', 'Function calling', 'Prompt engineering'] },
  python: { role: 'Experiment scripts', details: ['Model experiments', 'Data preparation', 'Evaluation scripts'] },
  typescript: { role: 'Typed front end', details: ['Typed UI and API calls', 'Shared request types', 'Safer refactors'] },
  react: { role: 'Playground UI', details: ['Chat interface', 'Experiment panels', 'Streaming responses'] },
  nextjs: { role: 'App framework', details: ['Pages and routing', 'API routes', 'Server rendering'] },
  postgresql: { role: 'Main database', details: ['Users and sessions', 'Saved experiments', 'Chat history'] },
  redis: { role: 'Cache and queues', details: ['Response caching', 'Rate limiting', 'Job queue'] },
  docker: { role: 'Containers', details: ['Local services', 'Repeatable builds', 'Deployment images'] },
  aws: { role: 'Cloud hosting', details: ['Hosting', 'File storage', 'Background jobs'] },
  'vector-db': { role: 'Semantic search', details: ['Document embeddings', 'Similarity search', 'Retrieval for answers'] },
};

export function placeholderUsages(technologies: readonly Technology[]): ProjectTechnologyUsage[] {
  return technologies.map(technology => {
    const usage = USAGES[technology.id];
    return { id: `aether-${technology.id}`, technologyId: technology.id, ...(usage ? { ...usage, reaction: 'curious' as const } : {}), placeholder: true };
  });
}

export const placeholderSections: readonly ProjectSection[] = [
  {
    id: 'overview',
    title: 'Overview',
    summary: 'A playground for experimenting with LLMs, building useful AI tools, and exploring real-world applications. Includes chat, image generation, document analysis and more.',
    placeholder: true,
  },
  {
    id: 'features',
    title: 'Features',
    items: [
      'AI Chat Interface: Multi-model support',
      'Image Generation: Text to image workflows',
      'Document Analysis: PDF & text processing',
      'Experiment Hub: Try new AI features',
    ],
    placeholder: true,
  },
  ...['Tech Stack', 'Architecture', 'Experiments', 'Challenges', 'What I Learned'].map(title => ({
    id: title.toLowerCase().replaceAll(' ', '-'),
    title,
    summary: `Placeholder: ${title} for AI Playground.`,
    placeholder: true,
  })),
];
