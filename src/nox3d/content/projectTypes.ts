/**
 * OctoVerse Content and Scene Contracts (Milestone B00)
 *
 * Minimal readonly TypeScript contracts separating:
 * - Anatomical arm identity (frozen exactly 8 arms: T1-T8)
 * - Five named scene states (Panels 1-5 of Nox storyboard)
 * - Project identity, sections, optional links, media
 * - Technology identity (catalog item: id, name, category, iconKey)
 * - Project technology usage (project-specific role, details, highlights)
 * - Per-pose authored artifact placement (usageId, armId, position, accent, viewportGrouping)
 * - Primary technology limit (capped at 15 primary technologies, with additional allowed)
 *
 * NOTE: PoseDefinition and WorldDefinition rendering contracts (SVG spline paths,
 * dynamic character deformation, geometry transforms) are explicitly deferred to E01.
 * Do not invent artwork geometry interfaces here.
 */

// ---------------------------------------------------------------------------
// 1. Anatomical Arm Identity (Frozen 8 Arms)
// ---------------------------------------------------------------------------

/**
 * Exactly eight anatomical arms, matching the approved Nox character anatomy.
 * Arm count is strictly decoupled from technology counts.
 */
export const ARM_IDS = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8'] as const;

export type ArmId = (typeof ARM_IDS)[number];

export const TOTAL_ARM_COUNT = 8 as const;

export function isArmId(value: unknown): value is ArmId {
  return typeof value === 'string' && (ARM_IDS as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// 2. Five Named Scene States
// ---------------------------------------------------------------------------

/**
 * Five named scene states corresponding to the 5 storyboard panels in Nox.jpeg:
 * 1. realm_entry        (Panel 1: Nox Enters the Security Realm)
 * 2. introduction       (Panel 2: Nox Arrives & Introduces Security Lab)
 * 3. project_overview   (Panel 3: Project Overview in Octopus Head)
 * 4. tech_interaction   (Panel 4: Tech Interaction / Hover)
 * 5. full_project       (Panel 5: Full Project View / Detail)
 */
export const SCENE_STATES = [
  'realm_entry',
  'introduction',
  'project_overview',
  'tech_interaction',
  'full_project',
] as const;

export type SceneState = (typeof SCENE_STATES)[number];

export function isSceneState(value: unknown): value is SceneState {
  return typeof value === 'string' && (SCENE_STATES as readonly string[]).includes(value);
}

export interface SceneStateMetadata {
  readonly id: SceneState;
  readonly panelNumber: 1 | 2 | 3 | 4 | 5;
  readonly title: string;
  readonly description: string;
}

export const SCENE_STATE_DEFINITIONS: readonly SceneStateMetadata[] = [
  {
    id: 'realm_entry',
    panelNumber: 1,
    title: 'Nox Enters the Security Realm',
    description: 'Nox enters from the side into the underwater security ruin environment.',
  },
  {
    id: 'introduction',
    panelNumber: 2,
    title: 'Nox Arrives & Introduces Security Lab',
    description: 'Nox reaches center, floating and looking forward with project identity and nameplate.',
  },
  {
    id: 'project_overview',
    panelNumber: 3,
    title: 'Project Overview in Octopus Head',
    description: 'Floating project summary above head with up to 15 primary technologies held by tentacles.',
  },
  {
    id: 'tech_interaction',
    panelNumber: 4,
    title: 'Tech Interaction',
    description: 'Focused tentacle reaches toward cursor with active technology orb and usage detail tooltip.',
  },
  {
    id: 'full_project',
    panelNumber: 5,
    title: 'Full Project View',
    description: 'Comprehensive project showcase panel while Nox rests in the background alive.',
  },
] as const;

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
// 5. Per-Pose Authored Artifact Placement
// ---------------------------------------------------------------------------

/**
 * 2D spatial coordinate for artifact placement.
 */
export interface PlacementPosition {
  readonly x: number;
  readonly y: number;
}

/**
 * Authored placement of a technology artifact/orb in a given scene pose.
 * Associates a project technology usage with an arm, spatial position,
 * visual accent color, and responsive viewport grouping.
 */
export interface ArtifactPlacement {
  readonly usageId: string;
  readonly armId: ArmId;
  readonly position: PlacementPosition;
  readonly accent?: string;
  readonly viewportGrouping?: 'all' | 'desktop' | 'mobile' | string;
}

/**
 * Collection of artifact placements keyed by pose or scene state.
 */
export type PosePlacementMap = {
  readonly [poseOrState: string]: readonly ArtifactPlacement[];
};

// ---------------------------------------------------------------------------
// 6. Project Content: Identity, Sections, Links, Media
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
// 7. Full Project Contract
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
  readonly placements?: readonly ArtifactPlacement[] | PosePlacementMap;
}
