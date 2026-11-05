import type { CreatorTemplate, TemplateId } from '../types';
import { AETHER_TEMPLATE } from './aether';
import { FLUX_TEMPLATE } from './flux';
import { NOX_TEMPLATE } from './nox';
import { VEYRA_TEMPLATE } from './veyra';

/** The four creator templates, one per world (the host is not a template). Each imports its world's bundle read-only. */
export const TEMPLATES: Readonly<Record<TemplateId, CreatorTemplate>> = {
  nox: NOX_TEMPLATE,
  veyra: VEYRA_TEMPLATE,
  flux: FLUX_TEMPLATE,
  aether: AETHER_TEMPLATE,
};
