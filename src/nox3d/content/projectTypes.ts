/**
 * OctoVerse Content and Scene Contracts (Milestone B00)
 *
 * Minimal readonly TypeScript contracts separating:
 * - Anatomical arm identity (frozen exactly 8 arms: T1-T8)
 * - The storyboard panel each stage shows (Panels 1-5 of Nox storyboard)
 * - Project identity, sections, optional links, media
 * - Technology identity (catalog item: id, name, category, iconKey)
 * - Project technology usage (project-specific role, details, highlights)
 * - Primary technology limit (capped at 15 primary technologies, with additional allowed)
 *
 * NOTE: PoseDefinition and WorldDefinition rendering contracts (SVG spline paths,
 * dynamic character deformation, geometry transforms) are explicitly deferred to E01.
 * Do not invent artwork geometry interfaces here.
 */

import type { StageId } from '../config/types';

// ---------------------------------------------------------------------------
// 1. Anatomical Arm Identity (Frozen 8 Arms)
// ---------------------------------------------------------------------------

// One definition lives in config/arms.ts; re-exported so content code keeps its import path.
export { ARM_IDS, isArmId, TOTAL_ARM_COUNT, type ArmId } from '../config/arms';

// ---------------------------------------------------------------------------
// 2. Storyboard Panel per Stage
// ---------------------------------------------------------------------------

/**
 * The storyboard panel (Nox.jpeg, panels 1-5) each stage shows. StageId is the
 * stage vocabulary; the panel number is the only thing content adds to it.
 */
export const STAGE_PANELS: Record<StageId, 1 | 2 | 3 | 4 | 5> = {
  entering: 1,
  intro: 2,
  overview: 3,
  techFocus: 4,
  detail: 5,
};

// ---------------------------------------------------------------------------
// 3. Technology Catalog Identity
// ---------------------------------------------------------------------------

/**
 * Reusable technology catalog entry.
 * Defines the identity of a technology independently of any project.
 */
export interface Technology {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly iconKey: string;
}

// ---------------------------------------------------------------------------
// 4. Project-Specific Technology Usage
// ---------------------------------------------------------------------------

/**
 * Project-specific usage of a technology.
 * Separated from the catalog identity: describes how this technology
 * is specifically applied and utilized in this project.
 */
export interface ProjectTechnologyUsage {
  readonly id: string;
  readonly technologyId: string;
  readonly role?: string;
  readonly summary?: string;
  readonly details?: readonly string[];
  /** How the character reacts when this technology is in focus (default: a subtle curiosity). */
  readonly reaction?: 'focused' | 'curious';
  /** Storyboard copy standing in until the owner supplies real text. */
  readonly placeholder?: boolean;
}

// ---------------------------------------------------------------------------
// 5. Project Content: Identity, Sections, Links, Media
// ---------------------------------------------------------------------------

export interface ProjectIdentity {
  readonly id: string;
  readonly name: string;
  readonly tagline?: string;
  readonly characterName: string;
  readonly characterEpithet: string;
  readonly introduction: readonly string[];
}

export interface ProjectSection {
  readonly id: string;
  readonly title: string;
  readonly summary?: string;
  readonly content?: string;
  readonly items?: readonly string[];
  /** Storyboard copy standing in until the owner supplies real text. */
  readonly placeholder?: boolean;
}

export interface ProjectLink {
  readonly id: string;
  readonly label: string;
  readonly url: string;
  readonly kind?: 'live' | 'github' | 'demo' | 'docs' | 'other' | string;
}

export interface ProjectMedia {
  readonly id: string;
  readonly type: 'image' | 'screenshot' | 'video';
  readonly url: string;
  /** Optional lighter image for compact previews; url retains the detail image. */
  readonly previewUrl?: string;
  readonly alt: string;
  readonly caption?: string;
}

// ---------------------------------------------------------------------------
// 6. Full Project Contract
// ---------------------------------------------------------------------------

/**
 * Maximum number of primary technologies displayed on tentacles in overview / interaction.
 * As specified in storyboard Panel 3 ("up to 15"). Additional project technologies
 * may exist outside this primary list for full project view.
 */
export const MAX_PRIMARY_TECHNOLOGIES = 15;

/**
 * Complete project contract.
 * Zero technologies, empty sections, and absent optional links/media
 * are completely valid as drafts.
 */
export interface Project {
  readonly id: string;
  readonly name: string;
  readonly tagline?: string;
  /** One or two lines for the overview panel. */
  readonly summary?: string;
  readonly characterName: string;
  readonly characterEpithet: string;
  readonly introduction: readonly string[];
  readonly sections?: readonly ProjectSection[];
  readonly links?: readonly ProjectLink[];
  readonly media?: readonly ProjectMedia[];
  readonly technologyUsages?: readonly ProjectTechnologyUsage[];
  readonly primaryTechnologyIds?: readonly string[];
}
