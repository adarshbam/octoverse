"""The OctoVerse host's reef, its far plate: public/octoverse/world/reef/far/far-0.ktx2 to far-2.ktx2.

As Veyra's vault far plate (blender/vault/render_far.py, which this script loads as a library for
its scene, camera, render, fog, PNG and KTX2 steps): the reef beyond the near world (layout.json's
pieces past far.json's cutZ, of which the reef has none, and far.json's extras, which only the plate
has) as three transparent layers, rendered from the page's stage camera at rest (stage (0, 0, 12),
looking down -z) with the film transparent. Each layer is a card the page hangs at the layer's z
(src/engine/world/farPlate.ts); a pixel of it is the pixel the unmoved camera sees. The water
between the pieces is left empty (alpha 0): the page's fog and sky show through.

Rebuild (a few minutes on a CPU; needs Blender 5.2, KTX-Software 4.3+ for `ktx`):

    "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b --factory-startup -P blender/reef/render_far.py

Options after `--` as the vault's: --exr <folder> keeps the renders there; --reuse (with --exr)
redoes the fog, PNGs and KTX2 from them (to tune LOOK below); --png <folder> also keeps the PNGs.

Pieces are the kit's own builders (blender/reef/build_kit.py: same seeds, same geometry) at lod1,
as the page draws them past 16 units, lit as the page lights them: the fill and the surface light
of blender/reef/bake_world.py (its constants) and the water's glow as an ambient term. Stone and
rock take the page's colours times the kit's baked vertex colour (`Col`: occlusion); the orange
coral glows as the page's coral (palette.coral times `Col` red to the power 1.6) and the magenta
coral as its glow material (config.ts). The far gateway carries no membrane, glyph or windows: a
ruin long gone dark. The page's fog is baked in per pixel from each pixel's depth (three's exp2 fog,
the colour and density in far.json), so the cards are drawn with their fog off.
"""
import importlib.util
import json
import sys
import time
from pathlib import Path

import bpy

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]


def load_module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod


RF = load_module("reef_vault_render_far", ROOT / "blender/vault/render_far.py")
FAR = ROOT / "src/worlds/octoverse/place/far.json"
OUT = ROOT / "public/octoverse/world/reef/far"
RF.TMP = Path(RF.tempfile.gettempdir()) / f"octoverse-reef-far-{RF.os.getpid()}"
RF.SCENE = "OctoReef far plate"
RF.PREFIX = "octoreeffar."

# How it looks: the page's colours (config.ts palette and materials, Kit.tsx's rock and coral).
STONE, ROCK, CORAL = "#2a2a5a", "#211a26", "#7a0a18"
CORAL_GLOW, CORAL_GLOW_RISE = "#ff8a3a", 1.0  # palette.coral x relics.coral
# The magenta coral (config.ts materials coral_magenta_*): colour, strength, the vertex colour's
# power, and the pulse's middle (1 - pulse / 2: the still page's level).
MAGENTA_GLOW, MAGENTA_STRENGTH, MAGENTA_TIPS, MAGENTA_PULSE = "#e040c0", 0.9, 1.6, 0.15
RF.LOOK = {
    "ambient": 1.0,  # the water's glow on the pieces
    "ambient_linear": (0.004, 0.008, 0.04),  # its colour (linear RGB): deep indigo
    "exposure": 1.0,
}
RF.SAMPLES = 64


def render(opts, exr):
    t0 = time.time()
    far = json.loads(FAR.read_text(encoding="utf-8"))
    fog = far["fog"]
    exr.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)
    bw = load_module("reef_bake_world_for_far", HERE / "bake_world.py").BW
    KIT = bw.load_kit()
    bw.KIT = KIT
    KIT.PREFIX = RF.PREFIX + "kit."
    sc = RF.make_scene()
    layout = KIT.read_layout()

    if not opts["reuse"]:
        pieces = bpy.data.collections.new(RF.PREFIX + "pieces")
        sc.collection.children.link(pieces)
        with RF.in_scene(sc):
            built = KIT.build_pieces(pieces)
        KIT.check_layout(layout, built)
        missing = sorted({e["piece"] for e in far["extras"]} - set(built))
        if missing:
            raise RuntimeError(f"far.json names pieces the kit does not build: {missing}")
        pieces.hide_render = True
        mats = {
            "stone": RF.principled("stone", STONE, 0.62),
            "rock": RF.principled("rock", ROCK, 0.5),
            "coral": RF.principled("coral", CORAL, 0.42, emission=CORAL_GLOW, strength=CORAL_GLOW_RISE, emission_power=1.6),
            # The page's glow material: a dark surface, its colour times strength (the still pulse's middle) times Col red to the power `tips`.
            "magenta": RF.principled("magenta", "#000000", 0.55, emission=MAGENTA_GLOW, strength=MAGENTA_STRENGTH * (1 - MAGENTA_PULSE / 2), emission_power=MAGENTA_TIPS),
            "glass": RF.principled("glass", "#10142a", 0.3),
        }
        # Swap the kit's placeholder materials for the page's (lod1 only: the plate draws lod1).
        for name, (_, far_ob) in built.items():
            if far_ob is None:
                continue
            kind = "magenta" if name.startswith("coral_magenta_") else bw.kind_of(name)
            far_ob.data.materials.clear()
            far_ob.data.materials.append(mats[kind])
            far_ob.data.polygons.foreach_set("material_index", [0] * len(far_ob.data.polygons))
        RF.lighting(sc, bw, layout["floorY"])
        by_layer = RF.place_layers(sc, KIT, bw, far, layout, built)
        depth_mat = RF.depth_material()
        for i, layer in enumerate(far["layers"]):
            for j, objs in by_layer.items():
                for ob in objs:
                    ob.hide_render = j != i
            RF.set_camera(sc, layer)
            t1 = time.time()
            print(f"layer {i} (z {layer['z']}): {len(by_layer[i])} objects, {layer['pixels'][0]} x {layer['pixels'][1]}")
            RF.render_exr(sc, exr / f"far-{i}-colour.exr")
            RF.render_exr(sc, exr / f"far-{i}-depth.exr", depth_mat)
            print(f"  rendered in {time.time() - t1:.0f} s")

    total = 0
    for i, layer in enumerate(far["layers"]):
        colour = RF.read_exr(exr / f"far-{i}-colour.exr")
        depth = RF.read_exr(exr / f"far-{i}-depth.exr")
        rgba, stats = RF.fogged(colour, depth, fog)
        png = (opts["png"] or exr) / f"far-{i}.png"
        png.parent.mkdir(parents=True, exist_ok=True)
        RF.write_png(png, rgba)
        out = OUT / f"far-{i}.ktx2"
        RF.ktx(png, out)
        total += out.stat().st_size
        print(f"far-{i}.ktx2: z {layer['z']}, {rgba.shape[1]} x {rgba.shape[0]}, {stats['covered']:.2%} covered, mean fog {stats['fog']:.2f}, {out.stat().st_size} bytes")
    print(f"far plate: {total} bytes in {time.time() - t0:.0f} s")


def main():
    opts = RF.options()
    try:
        render(opts, opts["exr"] or RF.TMP)
    finally:
        RF.shutil.rmtree(RF.TMP, ignore_errors=True)


if __name__ == "__main__":
    main()
