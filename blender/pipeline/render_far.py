"""Flux's pipeline world, its far plate: public/flux/world/far/far-0.ktx2 to far-2.ktx2.

As Veyra's vault's far plate (blender/vault/render_far.py, which this script follows, itself after
the security world's): the sunken server city beyond the near world (layout.json's pieces past
far.json's cutZ, and far.json's extras, which only the plate has) as three transparent layers,
rendered from the page's stage camera at rest (stage (0, 0, 12), looking down -z) with the film
transparent. Each layer is a card the page hangs at the layer's z (src/engine/world/farPlate.ts);
the image is the card's frustum slice, so a pixel of it is the pixel the unmoved camera sees. The
water between the pieces is left empty (alpha 0): the page's fog and sky show through, and the
entrance swim never passes behind a card.

Three depths: the farthest layer is the distant towers with the surface's light shaft falling
across them from the upper right; the middle one the mid towers and a school of dark fish; the
nearest the towers just past the cut. far.json says what stands where (`extras`, `fish`, `shaft`).

Rebuild (a few minutes on a CPU; needs Blender 5.2, KTX-Software 4.3+ for `ktx`):

    "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b --factory-startup -P blender/pipeline/render_far.py

Options after `--`:  --exr <folder>  keep the renders (EXRs) there instead of a temp folder this run
deletes; --reuse  (with --exr) skip the renders, redo the fog, shaft, PNGs and KTX2 from the EXRs in
that folder (to tune LOOK below); --png <folder>  also keep the layer PNGs there.

Pieces are the kit's own builders (blender/pipeline/build_kit.py: same seeds, same geometry) at
lod1, as the page draws them past 16 units, lit as the page lights them: the fill and the surface
light of blender/pipeline/bake_world.py (its constants), and the water's glow as an ambient term.
Stone, rock and coral take the page's colours times the kit's vertex colour (`Col`); the towers'
LEDs glow in their own colours at the blink's mean (their lod1 LED faces, `<piece>_lod1_led`). The
page's fog is baked in per pixel, from the depth of each pixel (three's exp2 fog on the view depth,
the colour and density in far.json), so the cards are drawn with their fog off. Transparent texels
carry the fog colour, so a filtered edge fades into the water rather than a black rim. The shaft
is laid over its layer after the fog (it is light in the water, between the camera and the towers).
Nothing here touches the open .blend file or saves it.

There is no red light: the LEDs are blue, cyan, violet and a few amber, the rest is blue.
"""
import importlib.util
import json
import math
import os
import random
import shutil
import struct
import subprocess
import sys
import tempfile
import time
import zlib
from pathlib import Path

import bmesh
import bpy
import numpy as np
from mathutils.bvhtree import BVHTree

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
FAR = ROOT / "src/worlds/flux/place/far.json"
OUT = ROOT / "public/flux/world/far"
# This run's own temp folder (its pid in the name), deleted when the run ends; --exr keeps the renders elsewhere.
TMP = Path(tempfile.gettempdir()) / f"flux-far-plate-{os.getpid()}"
KTX_BIN = os.environ.get("KTX_SOFTWARE_BIN", r"C:\Program Files\KTX-Software\bin")

SCENE = "FluxWorld pipeline far plate"
PREFIX = "fluxfar."

# How it looks: the page's colours (config.ts palette, Kit.tsx's rock and coral), and the knobs
# that bring the render to the page's lighting (the page also has the water's environment light
# and the lightmaps' bounce, which AMBIENT stands in for).
STONE, ROCK, CORAL = "#1c2c4c", "#211a26", "#7a0a18"
CORAL_GLOW, CORAL_GLOW_RISE = "#d070c8", 0.6  # palette.coral x relics.coral
FISH = "#02102a"  # the water's fish colour (config.ts water.colours.fish)
SHAFT = "#4f9ef0"  # the shaft's light: the water's rays, lighter
LOOK = {
    "ambient": 1.0,  # the water's glow on the pieces
    "ambient_linear": (0.004, 0.012, 0.04),  # its colour (linear RGB): deep navy
    "exposure": 1.0,  # a final multiplier on the lit colour before fog
}
SAMPLES = 96


def srgb_to_linear(hex_colour):
    def ch(c):
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    return tuple(ch(int(hex_colour[i:i + 2], 16) / 255) for i in (1, 3, 5))


def load_module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod


def options():
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    png = Path(args[args.index("--png") + 1]).resolve() if "--png" in args else None
    exr = Path(args[args.index("--exr") + 1]).resolve() if "--exr" in args else None
    if "--reuse" in args and exr is None:
        raise SystemExit("--reuse needs --exr <folder>: the renders of an earlier run kept there")
    return {"reuse": "--reuse" in args, "png": png, "exr": exr}


# --- Scene -------------------------------------------------------------------------------------

def make_scene():
    sc = bpy.data.scenes.get(SCENE) or bpy.data.scenes.new(SCENE)
    for ob in list(sc.collection.all_objects):
        bpy.data.objects.remove(ob, do_unlink=True)
    sc.render.engine = "CYCLES"
    c = sc.cycles
    c.device = "CPU"
    c.samples = SAMPLES
    c.use_denoising = True
    c.max_bounces = c.diffuse_bounces = 2
    c.glossy_bounces = 2
    c.transmission_bounces = c.volume_bounces = 0
    c.sample_clamp_indirect = 10.0
    sc.render.film_transparent = True
    sc.render.pixel_aspect_x = sc.render.pixel_aspect_y = 1.0
    sc.render.resolution_percentage = 100
    sc.view_settings.view_transform = "Standard"
    sc.view_settings.look = "None"
    sc.view_settings.exposure = 0.0
    sc.view_settings.gamma = 1.0
    return sc


def in_scene(sc):
    return bpy.context.temp_override(scene=sc, view_layer=sc.view_layers[0])


def principled(name, colour, rough, emission=None, strength=1.0, emission_power=1.0):
    """A page material: its albedo times the kit's vertex colour (`Col`, which Kit.tsx reads as
    vertex colours), optionally glowing (emission times strength times `Col` red to the power
    `emission_power`)."""
    m = bpy.data.materials.new(PREFIX + name)
    nt = m.node_tree
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Roughness"].default_value = rough
    base = (*srgb_to_linear(colour), 1.0)
    col = nt.nodes.new("ShaderNodeVertexColor")
    col.layer_name = "Col"
    mix = nt.nodes.new("ShaderNodeMix")
    mix.data_type = "RGBA"
    mix.blend_type = "MULTIPLY"
    mix.inputs[0].default_value = 1.0
    mix.inputs[6].default_value = base
    nt.links.new(col.outputs["Color"], mix.inputs[7])
    nt.links.new(mix.outputs[2], bsdf.inputs["Base Color"])
    if emission:
        bsdf.inputs["Emission Color"].default_value = (*srgb_to_linear(emission), 1.0)
        sep = nt.nodes.new("ShaderNodeSeparateColor")
        power = nt.nodes.new("ShaderNodeMath")
        power.operation = "POWER"
        power.inputs[1].default_value = emission_power
        times = nt.nodes.new("ShaderNodeMath")
        times.operation = "MULTIPLY"
        times.inputs[1].default_value = strength
        nt.links.new(col.outputs["Color"], sep.inputs[0])
        nt.links.new(sep.outputs[0], power.inputs[0])
        nt.links.new(power.outputs[0], times.inputs[0])
        nt.links.new(times.outputs[0], bsdf.inputs["Emission Strength"])
    return m


def plain(name, colour, rough):
    """A plain surface of one colour (the fish: dark, unlit by anything of their own)."""
    m = bpy.data.materials.new(PREFIX + name)
    bsdf = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Base Color"].default_value = (*srgb_to_linear(colour), 1.0)
    bsdf.inputs["Roughness"].default_value = rough
    return m


def led_emitter(strength):
    """The LEDs as the page draws them: their own colour (Col, COLOR_0 in the file) as light at `strength`."""
    m = bpy.data.materials.new(PREFIX + "led")
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    emission = nt.nodes.new("ShaderNodeEmission")
    colour = nt.nodes.new("ShaderNodeAttribute")
    colour.attribute_name = "Col"
    emission.inputs["Strength"].default_value = strength
    nt.links.new(colour.outputs["Color"], emission.inputs["Color"])
    nt.links.new(emission.outputs[0], out.inputs["Surface"])
    return m


def depth_material():
    """View-space depth (three's fog depth) as an emission, for the second render of each layer."""
    m = bpy.data.materials.new(PREFIX + "depth")
    nt = m.node_tree
    for n in list(nt.nodes):
        if n.type != "OUTPUT_MATERIAL":
            nt.nodes.remove(n)
    out = next(n for n in nt.nodes if n.type == "OUTPUT_MATERIAL")
    em = nt.nodes.new("ShaderNodeEmission")
    cam = nt.nodes.new("ShaderNodeCameraData")
    nt.links.new(cam.outputs["View Z Depth"], em.inputs["Strength"])
    nt.links.new(em.outputs[0], out.inputs["Surface"])
    return m


def lighting(sc, bw, floor_y):
    """The fill and the surface light as bake_world.py has them (the portal's and the rings' spill
    do not reach past the cut), and the water's glow as the world colour."""
    coll = sc.collection
    sun = bpy.data.lights.new(PREFIX + "fill", "SUN")
    sun.energy = bw.FILL["intensity"]
    sun.color = bw.linear(bw.FILL["color"])
    sun.angle = 0.0
    ob = bpy.data.objects.new(PREFIX + "fill", sun)
    ob.rotation_euler = (-bw.blender(bw.FILL["position"])).to_track_quat("-Z", "Y").to_euler()
    coll.objects.link(ob)

    tx, tz = bw.SURFACE["target_xz"]
    position = bw.blender(bw.SURFACE["position"])
    target = bw.blender([tx, floor_y, tz])
    reach = (target - position).length
    spot = bpy.data.lights.new(PREFIX + "surface", "SPOT")
    spot.energy = 4 * math.pi * bw.SURFACE["intensity"] * reach * reach * bw.COOKIE_MEAN
    spot.color = bw.linear(bw.SURFACE["color"])
    spot.spot_size = 2 * bw.SURFACE_CONE[0]
    spot.spot_blend = bw.SURFACE_CONE[1]
    spot.shadow_soft_size = 0.5
    ob = bpy.data.objects.new(PREFIX + "surface", spot)
    ob.location = position
    ob.rotation_euler = (target - position).to_track_quat("-Z", "Y").to_euler()
    coll.objects.link(ob)

    world = bpy.data.worlds.new(PREFIX + "world")
    bg = next(n for n in world.node_tree.nodes if n.type == "BACKGROUND")
    bg.inputs["Color"].default_value = (*LOOK["ambient_linear"], 1.0)
    bg.inputs["Strength"].default_value = LOOK["ambient"]
    sc.world = world


# --- Placing and rendering ---------------------------------------------------------------------

def layer_index(far, z):
    """The layer a piece at depth z is in (farPlate.ts farLayerOf), or None for the near world."""
    if z >= far["cutZ"]:
        return None
    for i, layer in enumerate(far["layers"]):
        if layer["near"] > z and (layer["far"] is None or z >= layer["far"]):
            return i
    return None


def place_layers(sc, bw, far, layout, built, led):
    """Every piece of every layer, linked into the scene: {layer index: [objects]}. Pieces are
    lod1; a tower or rack module brings its lod1 LED faces."""
    coll = sc.collection
    by_layer = {i: [] for i in range(len(far["layers"]))}

    # Coral rests on the full-detail boulders under it, or the seabed, as on the page.
    rock_trees = []
    for p in layout["groups"].get("rocks", []) + [e for e in far["extras"] if e["piece"].startswith("rock")]:
        full = built[p["piece"]][0]
        mw = bw.stage_matrix(p)
        rock_trees.append(BVHTree.FromPolygons([mw @ v.co for v in full.data.vertices], [tuple(q.vertices) for q in full.data.polygons]))

    floor_y = layout["floorY"]
    pieces = [p for placements in layout["groups"].values() for p in placements] + list(far["extras"])
    for k, p in enumerate(pieces):
        layer = layer_index(far, p["position"][2])
        if layer is None:
            continue
        kind = bw.kind_of(p["piece"])
        matrix = bw.stage_matrix(p)
        if kind == "coral":
            x, _, z = p["position"]
            matrix = bw.stage_matrix(p, bw.coral_rest(x, z, floor_y, rock_trees)[0])
        ob = bpy.data.objects.new(f"{PREFIX}{kind}{k}", built[p["piece"]][1].data)
        ob.matrix_world = matrix
        coll.objects.link(ob)
        by_layer[layer].append(ob)
        if p["piece"] in bw.LED_OWNERS:
            lights = built[p["piece"] + "_led"][1].data.copy()
            lights.materials.clear()
            lights.materials.append(led)
            ob = bpy.data.objects.new(f"{PREFIX}led{k}", lights)
            ob.matrix_world = matrix
            coll.objects.link(ob)
            by_layer[layer].append(ob)
    return by_layer


def fish_mesh(length):
    """A small fish seen side on (Blender: nose toward +X, back up +Z, flat to the camera along Y):
    a slender body and a forked tail."""
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=10, v_segments=6, radius=0.5)
    bmesh.ops.scale(bm, vec=(length * 0.8, length * 0.09, length * 0.2), verts=bm.verts)
    rear = -length * 0.38
    tail = [bm.verts.new(co) for co in ((rear + 0.02 * length, 0, 0), (rear - 0.24 * length, 0, 0.13 * length), (rear - 0.17 * length, 0, 0), (rear - 0.24 * length, 0, -0.13 * length))]
    bm.faces.new(tail)
    me = bpy.data.meshes.new(PREFIX + "fish")
    bm.to_mesh(me)
    bm.free()
    return me


def place_fish(sc, far, material):
    """The schools of far.json, each fish a little turned and sized apart: {layer index: [objects]}."""
    by_layer = {i: [] for i in range(len(far["layers"]))}
    for s, school in enumerate(far.get("fish", [])):
        rng = random.Random(500 + s)
        layer = layer_index(far, school["center"][2])
        if layer is None:
            raise RuntimeError(f"far.json fish school {s} is not beyond the cut")
        me = fish_mesh(school["length"])
        me.materials.append(material)
        cx, cy, cz = school["center"]
        sx, sy, sz = school["spread"]
        for i in range(school["count"]):
            x = cx + rng.gauss(0, sx / 2)
            y = cy + rng.gauss(0, sy / 2) + 0.12 * (x - cx)  # the school rises a little along its way
            z = cz + rng.uniform(-sz / 2, sz / 2)
            ob = bpy.data.objects.new(f"{PREFIX}fish{s}.{i}", me)
            ob.location = (x, -z, y)
            ob.rotation_euler = (0.0, rng.uniform(-0.18, 0.18), 0.0 if school["heading"] > 0 else math.pi)
            ob.scale = [rng.uniform(0.75, 1.2)] * 3
            sc.collection.objects.link(ob)
            by_layer[layer].append(ob)
    return by_layer


def set_camera(sc, layer):
    """The stage camera at rest, its frustum at the layer's depth exactly the card."""
    depth = 12.0 - layer["z"]
    data = bpy.data.cameras.get(PREFIX + "cam") or bpy.data.cameras.new(PREFIX + "cam")
    data.sensor_fit = "HORIZONTAL"
    data.angle = 2 * math.atan(layer["width"] / 2 / depth)
    data.clip_start, data.clip_end = 0.1, 400.0
    cam = bpy.data.objects.get(PREFIX + "cam") or bpy.data.objects.new(PREFIX + "cam", data)
    if cam.name not in sc.collection.objects:
        sc.collection.objects.link(cam)
    cam.location = (0.0, -12.0, 0.0)  # stage (0, 0, 12)
    cam.rotation_euler = (math.pi / 2, 0.0, 0.0)  # looking down stage -z (Blender +y)
    sc.camera = cam
    rx, ry = layer["pixels"]
    sc.render.resolution_x, sc.render.resolution_y = rx, ry
    # Pixel counts are multiples of 4 (block compression); a pixel aspect makes the frame exactly the card's shape.
    ratio = (rx / ry) * (layer["height"] / layer["width"])
    sc.render.pixel_aspect_x, sc.render.pixel_aspect_y = (1.0, ratio) if ratio >= 1.0 else (1.0 / ratio, 1.0)


def render_exr(sc, path, override=None):
    sc.render.image_settings.file_format = "OPEN_EXR"
    sc.render.image_settings.color_mode = "RGBA"
    sc.render.image_settings.color_depth = "32"
    sc.render.filepath = str(path)
    vl = sc.view_layers[0]
    vl.material_override = override
    sc.cycles.use_denoising = override is None
    sc.cycles.samples = SAMPLES if override is None else 16
    bpy.ops.render.render(write_still=True, scene=sc.name)
    vl.material_override = None


def read_exr(path):
    """A float EXR as (h, w, 4), top row first, as Blender stores it (premultiplied linear)."""
    img = bpy.data.images.load(str(path), check_existing=False)
    w, h = img.size
    buf = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(buf)
    bpy.data.images.remove(img)
    return buf.reshape(h, w, 4)[::-1]


# --- Fog, shaft, PNG, KTX2 ---------------------------------------------------------------------

def to_srgb(c):
    c = np.clip(c, 0.0, 1.0)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * np.power(c, 1 / 2.4) - 0.055)


def shaft_cover(shape, shaft):
    """How much of each pixel the shaft covers (0 to `cover`): a soft band from where it meets the
    top at u = `top`, leaning by `lean` in u per unit of v, `width` wide in u, fading out down the
    frame (the layer's visible middle is about v 0.3 to 0.7)."""
    h, w = shape
    v = (np.arange(h, dtype=np.float32) + 0.5)[:, None] / h
    u = (np.arange(w, dtype=np.float32) + 0.5)[None, :] / w
    centre = shaft["top"] + shaft["lean"] * v
    profile = np.exp(-(((u - centre) / shaft["width"]) ** 2))
    t = np.clip((v - 0.3) / (0.85 - 0.3), 0.0, 1.0)
    fade = 1.0 - t * t * (3 - 2 * t)
    return (shaft["cover"] * profile * fade).astype(np.float32)


def fogged(colour, depth, fog, shaft=None):
    """Premultiplied linear colour and depth to straight sRGB RGBA 8-bit, with three's exp2 fog
    on each pixel and the fog colour in the transparent texels; with `shaft` (a cover per pixel),
    the shaft's light laid over it. Returns (rgba, stats)."""
    alpha = colour[..., 3]
    covered = alpha > 1e-4
    straight = np.where(covered[..., None], colour[..., :3] / np.maximum(alpha, 1e-4)[..., None], 0.0)
    d = np.where(covered, depth[..., 0] / np.maximum(depth[..., 3], 1e-4), 0.0)
    amount = 1.0 - np.exp(-((fog["density"] * d) ** 2))
    water = np.array(srgb_to_linear(fog["color"]), dtype=np.float32)
    lit = np.clip(straight * LOOK["exposure"], 0.0, None)
    out = lit * (1.0 - amount[..., None]) + water * amount[..., None]
    out = np.where(covered[..., None], out, water)
    a = np.clip(alpha, 0.0, 1.0)
    if shaft is not None:
        light = np.array(srgb_to_linear(SHAFT), dtype=np.float32)
        total = shaft + a * (1.0 - shaft)
        out = np.where((total > 1e-4)[..., None], (light * shaft[..., None] + out * (a * (1.0 - shaft))[..., None]) / np.maximum(total, 1e-4)[..., None], water)
        a = total
    rgba = np.concatenate([to_srgb(out), a[..., None]], axis=-1)
    return np.round(rgba * 255).astype(np.uint8), {"covered": float(covered.mean()), "fog": float(amount[covered].mean()) if covered.any() else 0.0}


def write_png(path, rgba):
    h, w, _ = rgba.shape
    raw = b"".join(b"\x00" + rgba[y].tobytes() for y in range(h))

    def chunk(kind, data):
        body = kind + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF)
    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")
    Path(path).write_bytes(png)


def ktx(png, out):
    """KTX2, UASTC with zstd, mipmapped, sRGB: the empty water between the pieces costs almost nothing."""
    env = dict(os.environ)
    env["PATH"] = KTX_BIN + os.pathsep + env.get("PATH", "")
    subprocess.run(
        ["ktx", "create", "--format", "R8G8B8A8_SRGB", "--encode", "uastc", "--uastc-quality", "2", "--zstd", "18", "--generate-mipmap", str(png), str(out)],
        check=True, env=env,
    )


# --- Main --------------------------------------------------------------------------------------

def main():
    opts = options()
    try:
        render(opts, opts["exr"] or TMP)
    finally:
        shutil.rmtree(TMP, ignore_errors=True)


def render(opts, exr):
    t0 = time.time()
    far = json.loads(FAR.read_text(encoding="utf-8"))
    fog = far["fog"]
    exr.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)
    bw = load_module("flux_bake_world_for_far", HERE / "bake_world.py")
    KIT = bw.load_kit()
    bw.KIT = KIT
    KIT.PREFIX = PREFIX + "kit."
    sc = make_scene()
    layout = bw.read_layout()

    if not opts["reuse"]:
        pieces = bpy.data.collections.new(PREFIX + "pieces")
        sc.collection.children.link(pieces)
        with in_scene(sc):
            built = KIT.build_pieces(pieces)
        bw.check_layout(layout, built)
        missing = sorted({e["piece"] for e in far["extras"]} - set(KIT.PLACED))
        if missing:
            raise RuntimeError(f"far.json names pieces the kit does not build: {missing}")
        pieces.hide_render = True
        mats = {
            "stone": principled("stone", STONE, 0.62),
            "rock": principled("rock", ROCK, 0.5),
            "coral": principled("coral", CORAL, 0.42, emission=CORAL_GLOW, strength=CORAL_GLOW_RISE, emission_power=1.6),
        }
        # Swap the kit's placeholder materials for the page's, on the shared mesh data (lod1 only:
        # the plate draws lod1). The towers' coral flecks are coral; the rest of a piece is its kind.
        for name in KIT.PLACED:
            far_ob = built[name][1]
            kind = bw.kind_of(name)
            for i, m in enumerate(far_ob.data.materials):
                far_ob.data.materials[i] = mats["coral"] if (m and m.name.endswith("coral")) else mats.get(kind, mats["stone"])
        led = led_emitter(bw.LED["intensity"] * bw.LED["duty"])
        lighting(sc, bw, layout["floorY"])
        by_layer = place_layers(sc, bw, far, layout, built, led)
        for i, objs in place_fish(sc, far, plain("fish", FISH, 0.8)).items():
            by_layer[i] += objs
        depth_mat = depth_material()
        for i, layer in enumerate(far["layers"]):
            for j, objs in by_layer.items():
                for ob in objs:
                    ob.hide_render = j != i
            set_camera(sc, layer)
            t1 = time.time()
            print(f"layer {i} (z {layer['z']}): {len(by_layer[i])} objects, {layer['pixels'][0]} x {layer['pixels'][1]}")
            render_exr(sc, exr / f"far-{i}-colour.exr")
            render_exr(sc, exr / f"far-{i}-depth.exr", depth_mat)
            print(f"  rendered in {time.time() - t1:.0f} s")

    total = 0
    shaft = far.get("shaft")
    for i, layer in enumerate(far["layers"]):
        colour = read_exr(exr / f"far-{i}-colour.exr")
        depth = read_exr(exr / f"far-{i}-depth.exr")
        cover = shaft_cover(colour.shape[:2], shaft) if shaft and shaft["layer"] == i else None
        rgba, stats = fogged(colour, depth, fog, cover)
        png = (opts["png"] or exr) / f"far-{i}.png"
        png.parent.mkdir(parents=True, exist_ok=True)
        write_png(png, rgba)
        out = OUT / f"far-{i}.ktx2"
        ktx(png, out)
        total += out.stat().st_size
        print(f"far-{i}.ktx2: z {layer['z']}, {rgba.shape[1]} x {rgba.shape[0]}, {stats['covered']:.2%} covered, mean fog {stats['fog']:.2f}{', shaft' if cover is not None else ''}, {out.stat().st_size} bytes")
    print(f"far plate: {total} bytes in {time.time() - t0:.0f} s")


if __name__ == "__main__":
    main()
