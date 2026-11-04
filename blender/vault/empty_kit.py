"""Veyra's stage backdrop kit: a glTF with one empty scene and no pieces.

Milestone 1 shows Veyra on a graded backdrop before the vault world exists (spec 10.1). The
engine still loads a kit for every world (`place.kit.url`), so the backdrop is a kit with nothing
in it: the water, the fog and the light are the world config's, and the layout names no piece.
The engine needs no particular node name or extra for this: it asks for a piece only where the
layout places one (the chain piece only when the layout has chains), and the baked-light record
(`nox_bake` extras) is read only from a `near.glb`, which this world does not have (the kit level
without a baked near world is the real-time-lit level).

Run in Blender 5.2 from a shell:
    blender -b -P blender/vault/empty_kit.py -- <out.glb>
With no path it writes public/veyra/world/stage.glb in the repo.

It resets Blender to an empty file (nothing the script did not make is touched on disk), exports
the one empty scene as a binary glTF and checks the file it wrote.
"""
import json
import struct
import sys
from pathlib import Path

import bpy

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_OUT = ROOT / "public/veyra/world/stage.glb"
SCENE = "VeyraStage"


def output():
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    return Path(args[0]) if args else DEFAULT_OUT


def empty_scene():
    """A factory file with no objects, collections or data, and one scene named for the backdrop."""
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.name = SCENE
    for store in (bpy.data.objects, bpy.data.meshes, bpy.data.materials, bpy.data.cameras, bpy.data.lights):
        assert len(store) == 0, f"expected an empty file, found {[item.name for item in store]}"
    return scene


def export(path):
    path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=str(path), export_format="GLB", export_yup=True, export_extras=True, export_cameras=False, export_lights=False)


def read_json(path):
    """The glb's JSON chunk."""
    data = path.read_bytes()
    magic, version, length = struct.unpack_from("<4sII", data, 0)
    assert magic == b"glTF" and version == 2 and length == len(data), "not a glTF 2 binary"
    size, kind = struct.unpack_from("<I4s", data, 12)
    assert kind == b"JSON", "the first chunk is not JSON"
    return json.loads(data[20:20 + size])


def check(path):
    """The file is a glTF whose first scene exists and holds no node, mesh or material."""
    doc = read_json(path)
    scenes = doc.get("scenes", [])
    assert len(scenes) == 1, f"expected one scene, found {len(scenes)}"
    assert not scenes[0].get("nodes"), "the scene is not empty"
    for group in ("nodes", "meshes", "materials", "textures", "animations"):
        assert not doc.get(group), f"the file holds {group}"
    print(f"stage kit: {path} ({path.stat().st_size} bytes), one empty scene")


def main():
    path = output()
    empty_scene()
    export(path)
    check(path)


if __name__ == "__main__":
    main()
