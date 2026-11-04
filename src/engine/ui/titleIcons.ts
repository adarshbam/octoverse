import { Flame } from './Flame';

// The icons a world's intro title can carry (`UiTheme.titleIcon`): a closed table inside the engine,
// like the head effects. A world names one; adding one is an entry here and a test. Each icon's own
// colours are its artwork, as a technology's logo is (not the theme's accents).

export const TITLE_ICONS = { flame: Flame } as const;
