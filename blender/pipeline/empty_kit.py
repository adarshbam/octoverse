"""The pipeline world's stage backdrop: an empty kit.

Flux's first world (`PIPELINE_STAGE`, src/worlds/flux/place/config.ts) names no pieces, so its kit
file holds an empty scene: Flux stands on dark water with the engine's own floor, water and light
until the pipeline kit's layout (a later task) fills it. Writing the file keeps the kit's path real,
so the page loads it as it loads any world's kit.

One exception: the engine's kit loader (src/engine/world/Kit.tsx) looks up the chain's links, `chain`
and `chain_lod1`, for every world, laid out or not, and throws "kit piece missing" without them. The
file carries each as one tiny triangle. No layout places them, so nothing of them is ever drawn.

Run in Blender 5.2, from a shell at the repo root:
    blender --background --python blender/pipeline/empty_kit.py -- public/flux/world/stage.glb
The output path after `--` is optional; the default is public/flux/world/stage.glb.

It builds almost nothing, so there is nothing to compress.
"""
import sys
from pathlib import Path

import bmesh
import bpy

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_OUT = ROOT / "public/flux/world/stage.glb"

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
out = Path(argv[0]) if argv else DEFAULT_OUT
if not out.is_absolute():
    out = ROOT / out
out.parent.mkdir(parents=True, exist_ok=True)

# A scene with no objects at all: reset to the factory scene and remove what it brings.
bpy.ops.wm.read_factory_settings(use_empty=True)
for obj in list(bpy.data.objects):
    bpy.data.objects.remove(obj, do_unlink=True)

# The two placeholder link meshes the loader asks for: one small triangle each, never placed.
for name in ("chain", "chain_lod1"):
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bm.faces.new([bm.verts.new(v) for v in ((0, 0, 0), (0.01, 0, 0), (0, 0.01, 0))])
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)

bpy.ops.export_scene.gltf(filepath=str(out), export_format="GLB")
print(f"empty kit: wrote {out} ({out.stat().st_size} bytes, {len(bpy.data.objects)} objects)")
