import type { ProjectTechnologyUsage, Technology } from '../content/projectTypes';

export interface TooltipContent {
  name: string;
  role?: string;
  details: readonly string[];
  summary?: string;
  /** Marks storyboard or missing text while developing; never shown in the public build. */
  badge: boolean;
}

/**
 * What a technology's tooltip says. While developing (`showPlaceholders`), storyboard copy shows
 * with a Placeholder badge and a missing text is said to be missing. In the public build, text
 * that is not the owner's verified copy never appears: only the technology's name and its kind.
 */
export function tooltipContent(technology: Technology, usage: ProjectTechnologyUsage | undefined, showPlaceholders: boolean): TooltipContent {
  const placeholder = usage?.placeholder ?? true;
  if (placeholder && !showPlaceholders) {
    return { name: technology.name, role: technology.category.charAt(0).toUpperCase() + technology.category.slice(1), details: [], badge: false };
  }
  const details = usage?.details ?? [];
  return {
    name: technology.name,
    role: usage?.role,
    details,
    summary: usage?.summary ?? (details.length === 0 && placeholder ? 'How it is used here: text to come.' : undefined),
    badge: placeholder,
  };
}
