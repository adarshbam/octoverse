"""Storyboard panel rectangles in Nox.jpeg and the shared --panel argument."""
import sys

PANELS = {1: (0, 0, 510, 504), 2: (512, 0, 1018, 504), 3: (1021, 0, 1536, 504), 4: (0, 506, 684, 1024), 5: (685, 506, 1536, 1024)}

def take_panel_arg(default=2):
    """Removes `--panel N` from sys.argv and returns (rect, width, height)."""
    panel = default
    if '--panel' in sys.argv:
        i = sys.argv.index('--panel')
        panel = int(sys.argv[i + 1])
        del sys.argv[i:i + 2]
    rect = PANELS[panel]
    return rect, rect[2] - rect[0], rect[3] - rect[1]
