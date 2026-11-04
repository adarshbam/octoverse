"""The OctoVerse host's reef, its near light baked: public/octoverse/world/reef/near.glb.

The same bake as Veyra's vault (blender/vault/bake_world.py, which this script loads as a library
and points at the reef: its seabed, unwraps, atlases, bakes, lightmaps, relief maps, export and
record are the vault's, step for step). Cycles bakes the light that does not move into lightmaps on
a second UV set (LightUV, TEXCOORD_1 in the file), for every placed instance of the layout's groups
at both levels of detail, and for the seabed:
- the membrane's violet spill on the stone round the doorway (lights in the arch's frame, raised by
  the relics' spill);
- the ember windows' warm light on the masonry (points just before the arch's front);
- each coral's faint light in its own colour (orange, magenta), unshadowed (it stands for the
  coral's own glow, which the branches would otherwise hide);
- the path's warm violet-orange glow on the sand, where the host swims (it stands for the host's
  own glow on the path, spec 7.7);
- the cool fill from overhead, unshadowed as on the page;
- the bounce of all of these and of the surface light, whose own direct light stays real-time on
  the page (its caustic cookie and the host's moving shadow);
- ambient occlusion.

There is no red light: no glyph, lava or back light (the record's lists for them are empty). Every
layout group is baked, whatever its name (gate, rocks, corals, cards): `instances` holds one list
per group of layout.json, in its order, so the page's `bakedLightOf` takes the file (the cards and
the magenta coral draw with their own kit material on the page and leave their squares unread).
The gate's other nodes (windows, membrane, glyph) are not placed in the bake (they draw their own
light on the page) but travel in near.glb with the pieces, as kit.glb has them.

It builds the kit's pieces with blender/reef/build_kit.py's own builders (same seeds, same
geometry). src/worlds/octoverse/place/config.test.ts checks the record against the page's config
and layout.

Run from a shell (a GPU is used when Blender's preferences enable one; else Cycles bakes on the CPU):
    "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b -P blender/reef/bake_world.py

It builds and bakes in its own scene, "OctoReef bake", and touches nothing outside it; it never
saves the .blend file. With `-- --rests` it only prints where each coral of the layout comes to rest
(the y the layout gives a coral drawn with its own kit material, which the page does not drop) and
exits.
"""
import importlib.util
import json
import math
import os
import shutil
import sys
import tempfile
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]


def load_module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod


# The vault's bake, as a library: everything below points it at the reef.
BW = load_module("reef_vault_bake_world", ROOT / "blender/vault/bake_world.py")

BW.NEAR = ROOT / "public/octoverse/world/reef/near.glb"
BW.TMP = Path(tempfile.gettempdir()) / f"octoverse-reef-near-{os.getpid()}"
BW.RAW = BW.TMP / "raw.glb"
BW.UASTC = BW.TMP / "uastc.glb"
BW.SCENE = "OctoReef bake"
BW.PIECES = "OctoReef bake pieces"
BW.LEVEL_SETS = {"lod0": "OctoReef bake full detail", "lod1": "OctoReef bake lod1"}
BW.SEABED_SET = "OctoReef bake seabed"
BW.LIGHTS = "OctoReef bake lights"
BW.PREFIX = "octoreefbake."
LAYOUT = ROOT / "src/worlds/octoverse/place/layout.json"

# --- What the page has. near.glb records these and src/worlds/octoverse/place/config.test.ts
# checks that they still agree with src/worlds/octoverse/place/config.ts and layout.json. -------
# The membrane's spill: point lights in the arch's own frame (stage axes: x across the doorway, y
# up, z out of it toward the camera), placed with each arch's placement. WorldLight, kind membrane.
MEMBRANE = {"color": "#7538fc", "intensity": 1.6, "distance": 3.5}
MEMBRANE_LOCAL = [[0, 0.6, 0.02], [0, 1.8, 0.02], [0, 0.9, 0.7]]
# The windows' embers, in the arch's frame just before its front. WorldLight, kind ember.
EMBER = {"color": "#ff9a40", "intensity": 0.5, "distance": 1.6}
EMBER_LOCAL = [[-0.8, 0.9, 0.5], [0.8, 1.2, 0.5], [-0.7, 2.4, 0.5], [0.85, 2.2, 0.5]]
# Each coral's light, CORAL_RISE above the floor: orange (kind coral) or magenta (kind magenta).
CORAL = {"color": "#ff8a3a", "intensity": 0.3, "distance": 1.8}
MAGENTA = {"color": "#e040c0", "intensity": 0.3, "distance": 1.8}
CORAL_RISE = 0.5
# The path's glow: (x, z) points along the path, PATH_RISE above the floor. WorldLight, kind path.
PATH = {"color": "#a97896", "intensity": 1.2, "distance": 3.2}
PATH_POINTS = [[-5.2, -3.4], [-2.6, -2.4], [0.2, -3.4], [1.6, -5.6]]
PATH_RISE = 0.45
BW.FILL = {"color": "#8a8cff", "intensity": 1.0, "position": [-1.5, 10, 2]}
BW.SURFACE = {"color": "#7aa8ff", "intensity": 1.0, "position": [3, 24, -10], "target_xz": (0, -8)}
BW.SPILL = 1.2  # config.ts relics.spill
# The page's albedos, for the bounce: stone (palette.stone), rock and coral (Kit.tsx's own), the
# cards' dark glass (they glow on the page; here they only stand in the light) and the sand
# (palette.sand, which the sand floor draws over most of the seabed).
BW.ALBEDO = {"stone": "#2a2a5a", "rock": "#211a26", "coral": "#7a0a18", "glass": "#10142a", "seabed": "#5c4a72"}
BW.MATERIAL_KINDS = ("stone", "rock", "coral", "glass")
BW.KINDS = {"gate": "stone", "rock": "rock", "coral": "coral", "card": "glass"}
BW.SHADOWS = {"membrane": True, "ember": True, "coral": False, "magenta": False, "path": False, "fill": False}
# A little fewer samples than the vault's: the reef is a backdrop to the host, and the bake shares the machine.
BW.SAMPLES = {"direct": 128, "indirect": 64, "ao": 96}
# The reef is darker than the vault: a lower ceiling keeps more steps in the dark masonry.
BW.INTENSITY = 16.0


def load_kit():
    """build_kit.py (the reef's) as its own module, naming what it builds with the bake's prefix,
    with the few helpers the vault's bake asks of a kit module."""
    kit = load_module("reef_build_kit_for_bake", HERE / "build_kit.py")
    kit.PREFIX = BW.PREFIX
    vault = load_module("reef_vault_kit_helpers", ROOT / "blender/vault/build_kit.py")
    kit.read_layout = lambda: json.loads(LAYOUT.read_text(encoding="utf-8"))
    kit.stage_matrix = vault.stage_matrix  # the page's applyPlacement, in Blender space
    own_check = kit.check_layout
    kit.check_layout = lambda layout, built: own_check(built)
    own_export = kit.export

    def export(coll, raw=None):
        if raw is not None:
            kit.RAW = Path(raw)
        own_export(coll)
    kit.export = export
    kit.NODES = list(kit.GATE_NODES)
    return kit


BW.load_kit = load_kit


def world_lights(layout):
    """The point lights as the page's config has them (WorldLight without the skin's range), by kind."""
    floor_y = layout["floorY"]
    groups = layout["groups"]
    pp = BW.placed_point

    def at(light, position):
        return {"position": position, "color": light["color"], "intensity": light["intensity"], "distance": light["distance"]}
    gates = groups.get("gate", [])
    corals = groups.get("corals", [])
    rise = round(floor_y + CORAL_RISE, 6)
    return {
        "membrane": [at(MEMBRANE, pp(p, local)) for p in gates for local in MEMBRANE_LOCAL],
        "ember": [at(EMBER, pp(p, local)) for p in gates for local in EMBER_LOCAL],
        "coral": [at(CORAL, [p["position"][0], rise, p["position"][2]]) for p in corals if not p["piece"].startswith("coral_magenta_")],
        "magenta": [at(MAGENTA, [p["position"][0], rise, p["position"][2]]) for p in corals if p["piece"].startswith("coral_magenta_")],
        "path": [at(PATH, [x, round(floor_y + PATH_RISE, 6), z]) for x, z in PATH_POINTS],
    }


BW.world_lights = world_lights
KINDS = ("membrane", "ember", "coral", "magenta", "path")


def lights(coll, layout):
    """The vault's lights (bake_world.py lights), with the reef's point lights in place of the
    portal's, plants' and corals' (the membrane's spill raised by SPILL, the rest as their data):
    the fill unshadowed, the surface light's strength at its target times its cookie's mean."""
    import bpy
    floor_y = layout["floorY"]
    points = world_lights(layout)
    baked = {kind: points[kind] for kind in KINDS}
    baked["membrane"] = [{**light, "intensity": light["intensity"] * BW.SPILL} for light in points["membrane"]]
    for kind, items in baked.items():
        for i, light in enumerate(items):
            BW.point_light(coll, f"{kind}{i}", light, BW.SHADOWS[kind])

    fill = BW.FILL
    data = bpy.data.lights.new(BW.PREFIX + "fill", "SUN")
    data.energy = fill["intensity"]
    data.color = BW.linear(fill["color"])
    data.angle = 0.0
    data.use_shadow = BW.SHADOWS["fill"]
    sun = bpy.data.objects.new(BW.PREFIX + "fill", data)
    sun.rotation_euler = (-BW.blender(fill["position"])).to_track_quat("-Z", "Y").to_euler()
    coll.objects.link(sun)

    tx, tz = BW.SURFACE["target_xz"]
    surface = {"color": BW.SURFACE["color"], "intensity": BW.SURFACE["intensity"], "position": BW.SURFACE["position"], "target": [tx, floor_y, tz]}
    reach = (BW.blender(surface["target"]) - BW.blender(surface["position"])).length
    data = bpy.data.lights.new(BW.PREFIX + "surface", "SPOT")
    data.energy = 4 * math.pi * surface["intensity"] * reach * reach * BW.COOKIE_MEAN
    data.color = BW.linear(surface["color"])
    data.spot_size = 2 * BW.SURFACE_CONE[0]
    data.spot_blend = BW.SURFACE_CONE[1]
    data.shadow_soft_size = 0.5
    spot = bpy.data.objects.new(BW.PREFIX + "surface", data)
    spot.location = BW.blender(surface["position"])
    spot.rotation_euler = (BW.blender(surface["target"]) - BW.blender(surface["position"])).to_track_quat("-Z", "Y").to_euler()
    coll.objects.link(spot)
    # The record keeps the engine's three red lists, empty: the reef has no glyph, lava or back light.
    return {"glyph": [], "lava": [], "back": [], **baked, "fill": dict(fill), "surface": surface}, spot


BW.lights = lights


def relief_map(name, atlas, irradiance):
    """The vault's relief map (bake_world.py relief_map), with the reef's point lights in place of
    the portal's, plants' and corals': per texel the main direction of the point lights and the
    fill, its length their strength along it, scaled down where the bake had less light."""
    position, normal = (BW.pixels(BW.STATE["geometry"][atlas][what]) for what in BW.GEOMETRY)
    covered = position[..., 3] > 0
    p = BW.stage_vectors((position[..., :3] / np.maximum(position[..., 3:], 1e-6) * 2 - 1) * BW.POSITION_RANGE)[covered]
    n = BW.stage_vectors(normal[..., :3] / np.maximum(normal[..., 3:], 1e-6) * 2 - 1)[covered]
    n /= np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-6)
    lum = np.array(BW.LUMINANCE)
    lights_ = BW.STATE["lights"]
    fill = np.array(lights_["fill"]["position"], float)
    fill /= np.linalg.norm(fill)
    fill_colour = np.array(BW.linear(lights_["fill"]["color"])) * lights_["fill"]["intensity"]
    plain = np.outer(np.clip(n @ fill, 0, None), fill_colour)
    toward = np.tile(fill * (fill_colour @ lum), (len(p), 1))
    for light in [light for kind in KINDS for light in lights_[kind]]:
        to = np.array(light["position"], float) - p
        d = np.linalg.norm(to, axis=1)
        l = to / np.maximum(d, 1e-4)[:, None]
        window = np.clip(1 - (d / light["distance"]) ** 4, 0, 1) ** 2
        c = np.array(BW.linear(light["color"])) * light["intensity"]
        weight = window / np.maximum(d * d, 0.01)
        plain += np.outer(weight * np.clip(np.sum(n * l, 1), 0, None), c)
        toward += l * (weight * (c @ lum))[:, None]
    length = np.linalg.norm(toward, axis=1)
    strength = length * np.minimum((irradiance[covered] @ lum) / np.maximum(plain @ lum, 1e-4), 1)
    v = np.zeros(covered.shape + (3,), np.float32)
    v[covered] = toward / np.maximum(length, 1e-9)[:, None] * (strength / (strength + BW.RELIEF_SCALE))[:, None]
    v = BW.fill_gaps(v, covered)
    print(f"{name}: relief strength up to {strength.max():.2f}, median {np.median(strength):.3f}")
    return BW.save_png(name, v * 0.5 + 0.5, "Non-Color")


BW.relief_map = relief_map
vault_record = BW.record


def record():
    """The vault's record, its settings naming the reef's lights in place of the vault's."""
    out = vault_record()
    settings = out["settings"]
    for key in ("portalLocal", "plantRise"):
        settings.pop(key, None)
    settings.update(membraneLocal=MEMBRANE_LOCAL, emberLocal=EMBER_LOCAL, coralRise=CORAL_RISE, pathPoints=PATH_POINTS, pathRise=PATH_RISE)
    out["relief"]["encoding"] = "per texel (v + 1) / 2 for v along the membrane, ember, coral, magenta, path and fill light's main direction (stage space), |v| = s / (s + scale) for its luminance s along it; linear, 8 bits; KTX2 UASTC"
    return out


BW.record = record


def rests():
    """Where each coral of the layout comes to rest (as the page's coralRest): on the highest
    full-detail boulder under it or the seabed, sunk 0.04."""
    import bpy
    kit = load_kit()
    BW.KIT = kit
    sc, colls = BW.own_scene()
    layout = kit.read_layout()
    with BW.in_scene():
        built = kit.build_pieces(colls[BW.PIECES])
    trees = []
    for p in layout["groups"].get("rocks", []):
        ob = bpy.data.objects.new(BW.PREFIX + "resttest", built[p["piece"]][0].data)
        colls[BW.PIECES].objects.link(ob)
        ob.matrix_world = kit.stage_matrix(p)
        trees.append(BW.rock_tree(ob))
    for i, p in enumerate(layout["groups"].get("corals", [])):
        x, _, z = p["position"]
        y, on = BW.coral_rest(x, z, layout["floorY"], trees)
        print(f"REST corals[{i}] {p['piece']} ({x}, {z}): y {y:.4f} on {on}")


if __name__ == "__main__":
    if "--rests" in sys.argv:
        rests()
    else:
        BW.main()
