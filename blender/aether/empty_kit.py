"""The Aether world's stage backdrop kit: a glTF with no pieces (only two stub nodes).

Task 2 of the Aether plan shows her in the drowned observatory's water only; the engine's world
loads `kit.url` unconditionally, so the backdrop needs a file to load. The layout
(src/worlds/aether/place/config.ts, `OBSERVATORY_STAGE`) places nothing, and `kit.pieces` is empty.
The engine's Kit.tsx still looks up the node named `chain` (and `chain_lod1`) while it builds,
whether or not the layout hangs a chain, and throws "kit piece missing: chain" without them, so the
file carries those two names as one-triangle meshes that nothing places. The real kit (blender/aether/build_kit.py: portal, towers, rubble, rocks, coral) is
exported as public/aether/world/kit.glb and replaces this in Task 8.

Run in Blender 5.2, from a shell (Blender is not on PATH on this machine):
    "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b -P blender/aether/empty_kit.py
or inside a running Blender (Blender MCP):
    p = "<repo>/blender/aether/empty_kit.py"
    exec(compile(open(p).read(), p, "exec"), {"__file__": p, "__name__": "__main__"})

It empties the current file's scene, adds the two stubs and exports it to public/aether/world/stage.glb.
Run it from a background Blender: it removes every object in the open file's scene.
"""
from pathlib import Path

import bpy

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "public/aether/world/stage.glb"


def stub(name):
    """A one-triangle mesh object called `name` in the scene (never placed by the layout)."""
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata([(0.0, 0.0, 0.0), (0.001, 0.0, 0.0), (0.0, 0.001, 0.0)], [], [(0, 1, 2)])
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)


def main():
    for obj in list(bpy.data.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    for name in ("chain", "chain_lod1"):
        stub(name)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=str(OUT), export_format="GLB", use_selection=False)
    print(f"empty_kit: wrote {OUT} ({OUT.stat().st_size} bytes)")


main()
