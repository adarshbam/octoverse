import {
  type ArtifactPlacement,
  isArmId,
  MAX_PRIMARY_TECHNOLOGIES,
  type PosePlacementMap,
  type Project,
  type Technology,
} from './projectTypes.ts';

/**
 * Machine-readable validation issue codes for contract verification.
 */
export type ValidationIssueCode =
  | 'DUPLICATE_ID'
  | 'MISSING_CATALOG_REFERENCE'
  | 'MISSING_USAGE_REFERENCE'
  | 'MISSING_PRIMARY_REFERENCE'
  | 'MISSING_PLACEMENT_REFERENCE'
  | 'INVALID_ARM_ID'
  | 'PRIMARY_TECH_LIMIT_EXCEEDED';

/**
 * A single validation issue record.
 */
export interface ValidationIssue {
  readonly path: string;
  readonly code: ValidationIssueCode;
  readonly message: string;
}

/**
 * Result of project validation.
 */
export interface ValidationResult {
  readonly valid: boolean;
  readonly issues: readonly ValidationIssue[];
}

/**
 * Optional validation inputs for catalog and external placement verification.
 */
export interface ValidationOptions {
  readonly catalog?: readonly Technology[];
  readonly placements?: readonly ArtifactPlacement[] | PosePlacementMap;
}

/**
 * Composite input object for validateProject.
 */
export interface ValidateProjectInput {
  readonly project: Project;
  readonly catalog?: readonly Technology[];
  readonly placements?: readonly ArtifactPlacement[] | PosePlacementMap;
}

/**
 * Type guard to distinguish the composite object invocation form from a direct Project.
 */
export function isValidateProjectInput(
  value: Project | ValidateProjectInput
): value is ValidateProjectInput {
  return typeof value === 'object' && value !== null && 'project' in value;
}

function isCatalogArray(
  value: ValidationOptions | readonly Technology[]
): value is readonly Technology[] {
  return Array.isArray(value);
}

/**
 * Pure validator for Project contracts.
 *
 * Checks:
 * - Duplicate IDs across sections, links, media, technology usages, primary list, and catalog.
 * - Missing catalog references: technology usages pointing to non-existent catalog technologies
 *   (when catalog is explicitly supplied, even if empty).
 * - Missing usage references: artifact placements pointing to non-existent project technology usages
 *   (validated strictly against ProjectTechnologyUsage.id).
 * - Missing primary references: primary technology IDs that do not correspond to any project usage
 *   (validated strictly against ProjectTechnologyUsage.technologyId).
 * - Missing placement references: artifact placements missing a usageId.
 * - Invalid arm associations: placements using an armId outside T1-T8.
 *   (Shared-arm association is explicitly allowed: multiple placements on one arm do not error.)
 * - Primary technology limit: maximum of 15 primary technologies allowed.
 *   (Additional technologies outside the primary list are explicitly allowed in technologyUsages.)
 * - Draft tolerance: zero technologies and absent optional sections/links/media are valid drafts.
 */
export function validateProject(
  projectOrInput: Project | ValidateProjectInput,
  optionsOrCatalog?: ValidationOptions | readonly Technology[]
): ValidationResult {
  let project: Project;
  let catalog: readonly Technology[] | undefined;
  let explicitPlacements: readonly ArtifactPlacement[] | PosePlacementMap | undefined;

  // Normalize polymorphic arguments
  if (isValidateProjectInput(projectOrInput)) {
    project = projectOrInput.project;
    catalog = projectOrInput.catalog;
    explicitPlacements = projectOrInput.placements;
  } else {
    project = projectOrInput;
    if (optionsOrCatalog !== undefined) {
      if (isCatalogArray(optionsOrCatalog)) {
        catalog = optionsOrCatalog;
      } else {
        catalog = optionsOrCatalog.catalog;
        explicitPlacements = optionsOrCatalog.placements;
      }
    }
  }

  const issues: ValidationIssue[] = [];

  // Helper to add issues
  const addIssue = (path: string, code: ValidationIssueCode, message: string) => {
    issues.push({ path, code, message });
  };

  // -------------------------------------------------------------------------
  // 1. Catalog Validation (if catalog supplied)
  // -------------------------------------------------------------------------
  const catalogIdSet = new Set<string>();
  if (catalog !== undefined) {
    for (const tech of catalog) {
      if (catalogIdSet.has(tech.id)) {
        addIssue(
          `catalog[${tech.id}]`,
          'DUPLICATE_ID',
          `Duplicate technology ID "${tech.id}" in technology catalog.`
        );
      } else {
        catalogIdSet.add(tech.id);
      }
    }
  }

  // -------------------------------------------------------------------------
  // 2. Project Sections Duplicate Check
  // -------------------------------------------------------------------------
  const sectionIdSet = new Set<string>();
  if (project.sections && project.sections.length > 0) {
    for (const section of project.sections) {
      if (sectionIdSet.has(section.id)) {
        addIssue(
          `sections[${section.id}]`,
          'DUPLICATE_ID',
          `Duplicate section ID "${section.id}".`
        );
      } else {
        sectionIdSet.add(section.id);
      }
    }
  }

  // -------------------------------------------------------------------------
  // 3. Project Links Duplicate Check
  // -------------------------------------------------------------------------
  const linkIdSet = new Set<string>();
  if (project.links && project.links.length > 0) {
    for (const link of project.links) {
      if (linkIdSet.has(link.id)) {
        addIssue(
          `links[${link.id}]`,
          'DUPLICATE_ID',
          `Duplicate link ID "${link.id}".`
        );
      } else {
        linkIdSet.add(link.id);
      }
    }
  }

  // -------------------------------------------------------------------------
  // 4. Project Media Duplicate Check
  // -------------------------------------------------------------------------
  const mediaIdSet = new Set<string>();
  if (project.media && project.media.length > 0) {
    for (const item of project.media) {
      if (mediaIdSet.has(item.id)) {
        addIssue(
          `media[${item.id}]`,
          'DUPLICATE_ID',
          `Duplicate media ID "${item.id}".`
        );
      } else {
        mediaIdSet.add(item.id);
      }
    }
  }

  // -------------------------------------------------------------------------
  // 5. Technology Usages Validation
  // -------------------------------------------------------------------------
  const usageIdSet = new Set<string>();
  const usageTechIdSet = new Set<string>();

  if (project.technologyUsages && project.technologyUsages.length > 0) {
    for (const usage of project.technologyUsages) {
      // Duplicate usage ID
      if (usageIdSet.has(usage.id)) {
        addIssue(
          `technologyUsages[${usage.id}]`,
          'DUPLICATE_ID',
          `Duplicate technology usage ID "${usage.id}".`
        );
      } else {
        usageIdSet.add(usage.id);
      }

      usageTechIdSet.add(usage.technologyId);

      // Missing catalog reference (when catalog is explicitly supplied, even if empty)
      if (catalog !== undefined && !catalogIdSet.has(usage.technologyId)) {
        addIssue(
          `technologyUsages[${usage.id}].technologyId`,
          'MISSING_CATALOG_REFERENCE',
          `Technology usage "${usage.id}" references unknown technology catalog ID "${usage.technologyId}".`
        );
      }
    }
  }

  // -------------------------------------------------------------------------
  // 6. Primary Technologies Validation (Capped at 15)
  // -------------------------------------------------------------------------
  if (project.primaryTechnologyIds) {
    // Check primary count limit
    if (project.primaryTechnologyIds.length > MAX_PRIMARY_TECHNOLOGIES) {
      addIssue(
        'primaryTechnologyIds',
        'PRIMARY_TECH_LIMIT_EXCEEDED',
        `Primary technologies count (${project.primaryTechnologyIds.length}) exceeds maximum limit of ${MAX_PRIMARY_TECHNOLOGIES}.`
      );
    }

    const seenPrimary = new Set<string>();
    for (const primaryId of project.primaryTechnologyIds) {
      // Duplicate primary ID
      if (seenPrimary.has(primaryId)) {
        addIssue(
          `primaryTechnologyIds[${primaryId}]`,
          'DUPLICATE_ID',
          `Duplicate primary technology ID "${primaryId}".`
        );
      } else {
        seenPrimary.add(primaryId);
      }

      // Check whether primary ID resolves to a project technology usage by its catalog technologyId
      if (!usageTechIdSet.has(primaryId)) {
        addIssue(
          `primaryTechnologyIds[${primaryId}]`,
          'MISSING_PRIMARY_REFERENCE',
          `Primary technology ID "${primaryId}" does not correspond to any technology usage in this project.`
        );
      }
    }
  }

  // -------------------------------------------------------------------------
  // 7. Placements Validation (Arm IDs & Usage References)
  // -------------------------------------------------------------------------
  const rawPlacements = explicitPlacements ?? project.placements;

  if (rawPlacements) {
    const placementList: ArtifactPlacement[] = [];

    if (Array.isArray(rawPlacements)) {
      placementList.push(...rawPlacements);
    } else if (typeof rawPlacements === 'object') {
      for (const list of Object.values(rawPlacements)) {
        if (Array.isArray(list)) {
          placementList.push(...list);
        }
      }
    }

    for (let i = 0; i < placementList.length; i++) {
      const p = placementList[i];
      const pathPrefix = `placements[${p.usageId || i}]`;

      // 1. Arm ID validation (must be T1-T8)
      if (!isArmId(p.armId)) {
        addIssue(
          `${pathPrefix}.armId`,
          'INVALID_ARM_ID',
          `Invalid arm association "${String(p.armId)}". Must be one of T1-T8.`
        );
      }

      // 2. Usage reference validation
      if (!p.usageId) {
        addIssue(
          `${pathPrefix}.usageId`,
          'MISSING_PLACEMENT_REFERENCE',
          'Placement is missing a usageId.'
        );
      } else if (!usageIdSet.has(p.usageId)) {
        addIssue(
          `${pathPrefix}.usageId`,
          'MISSING_USAGE_REFERENCE',
          `Placement references unknown technology usage ID "${p.usageId}".`
        );
      }
    }
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}
