import { Flame } from './Flame';
import { Padlock } from './Padlock';

// The icons a world's intro title can carry (`UiTheme.titleIcon`): a closed table inside the engine,
// like the head effects. A world names one; adding one is an entry here and a test. The flame's colours
// are its artwork, as a technology's logo is; the padlock takes the theme's button gradient.

export const TITLE_ICONS = { flame: Flame, padlock: Padlock } as const;
