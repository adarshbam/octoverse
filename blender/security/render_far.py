"""The security world's far plate: public/nox/world/security/far-0.ktx2 to far-2.ktx2.

The ruin beyond the near world (layout.json's pieces past far.json's cutZ, and far.json's extras,
which only the plate has) as three transparent layers, rendered from the page's stage camera at
rest (stage (0, 0, 12), looking down -z) with the film transparent. Each layer is a card the page
hangs at the layer's z (src/engine/world/farPlate.ts); the image is the card's frustum slice, so a
pixel of it is the pixel the unmoved camera sees. The corridor's water is left empty (alpha 0): the
page's fog and sky show through, and the entrance swim never passes behind a card.

Rebuild everything (about 2 minutes on a CPU; needs Blender 5.2, KTX-Software 4.3+ for `ktx`):

    "C:\\Program Files\\Blender Foundation\\Blender 5.2\\blender.exe" -b --factory-startup -P blender/security/render_far.py

Options after `--`:  --reuse  skip the renders, redo the fog, PNGs and KTX2 from the EXRs of the
last run (to tune LOOK below); --png <folder>  also keep the layer PNGs there.

Pieces are the kit's own builders (build_kit.py: same seeds, same geometry) at lod1, as the page
draws them past 16 units, lit as the page lights them: the fill and the surface light of
bake_world.py (its constants), the water's glow as an ambient term. The page's fog is baked in per
pixel, from the depth of each pixel (three's exp2 fog on the view depth, the colour and density in
far.json), so the cards are drawn with their fog off and a layer's near and far pieces fade apart
as they do live. Transparent texels carry the fog colour, so a filtered edge fades into the water
rather than a black rim. Nothing here touches the open .blend file or saves it.

Task 10's look fixes (lava, the top opening, the rocks' relight) change bake_world.py's inputs and
the kit; render_far.py reads the kit builders and the constants it shares with the bake, so rerun
it after them.
"""
import importlib.util
import json
import math
import os
import struct
import subprocess
import sys
import tempfile
import time
import zlib
from pathlib import Path

import bpy
import numpy as np
from mathutils.bvhtree import BVHTree

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
FAR = ROOT / "src/worlds/nox/place/far.json"
OUT = ROOT / "public/nox/world/security"
TMP = Path(tempfile.gettempdir()) / "nox-far-plate"
KTX_BIN = os.environ.get("KTX_SOFTWARE_BIN", r"C:\Program Files\KTX-Software\bin")

SCENE = "NoxWorld security far plate"
PREFIX = "noxfar."

# How it looks. The page's colours (config.ts palette, Kit.tsx), and the knobs that bring the
# render to the page's lighting: the page also has the water's environment light and a lightmap
# bounce that the Cycles scene stands in for with AMBIENT.
STONE, ROCK, CORAL, IRON = "#343c5a", "#22202e", "#7a0a18", "#2a2e3c"
CORAL_GLOW, CORAL_GLOW_RISE = "#ff1a30", 1.7 * 1.2  # palette.coral x relics.coral
# Tuned against the page itself (the intro with only the far pieces live, against none: the plate's
# pixels there, fog included, against the live ones): the stone's blue and green matched with the
# fill and surface light alone; the page's stone also holds the red of the lava glow in its
# lightmaps (the red in AMBIENT); a glyph panel's mean is its strokes over the dark recess.
LOOK = {
    "ambient": 0.9,  # the water's glow on the pieces
    "ambient_linear": (0.365, 0.102, 0.352),  # its colour (linear RGB)
    "glyph": 1.0,  # a glyph panel's emission strength (strokes: its mean over the panel)
    "glyph_linear": (0.157, 0.0124, 0.056),  # its mean colour (linear RGB), before fog
    "glyph_strokes": (0.1, 1.8, 0.2),  # stroke width (cell-edge distance), strokes' gain over the mean, the recess's share of it
    "exposure": 1.0,  # a final multiplier on the lit colour before fog
}
SAMPLES = 96
CHAIN_SCALE = 1.45  # Kit.tsx


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
    png = Path(args[args.index("--png") + 1]) if "--png" in args else None
    return {"reuse": "--reuse" in args, "png": png}


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


def principled(name, colour, rough, metal=0.0, vertex_ao=True, emission=None, emission_power=1.0):
    """A page material: its albedo times the kit's baked vertex AO (`Col`, which Kit.tsx reads as
    vertex colours), optionally glowing (emission times `Col` red to the power `emission_power`)."""
    m = bpy.data.materials.new(PREFIX + name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    base = (*srgb_to_linear(colour), 1.0)
    if vertex_ao:
        col = nt.nodes.new("ShaderNodeVertexColor")
        col.layer_name = "Col"
        mix = nt.nodes.new("ShaderNodeMix")
        mix.data_type = "RGBA"
        mix.blend_type = "MULTIPLY"
        mix.inputs[0].default_value = 1.0
        mix.inputs[6].default_value = base
        nt.links.new(col.outputs["Color"], mix.inputs[7])
        nt.links.new(mix.outputs[2], bsdf.inputs["Base Color"])
    else:
        bsdf.inputs["Base Color"].default_value = base
    if emission:
        glow = (*srgb_to_linear(emission), 1.0)
        bsdf.inputs["Emission Color"].default_value = glow
        bsdf.inputs["Emission Strength"].default_value = CORAL_GLOW_RISE
        # The coral's glow follows its baked colour: tips brightest (Kit.tsx: pow(vColor.r, 1.6)).
        col = nt.nodes.new("ShaderNodeVertexColor")
        col.layer_name = "Col"
        sep = nt.nodes.new("ShaderNodeSeparateColor")
        power = nt.nodes.new("ShaderNodeMath")
        power.operation = "POWER"
        power.inputs[1].default_value = emission_power
        times = nt.nodes.new("ShaderNodeMath")
        times.operation = "MULTIPLY"
        times.inputs[1].default_value = CORAL_GLOW_RISE
        nt.links.new(col.outputs["Color"], sep.inputs[0])
        nt.links.new(sep.outputs[0], power.inputs[0])
        nt.links.new(power.outputs[0], times.inputs[0])
        nt.links.new(times.outputs[0], bsdf.inputs["Emission Strength"])
    return m


def glyph_material():
    """A glyph panel: red strokes on a dark recess, drawn unlit by the page; here its mean."""
    m = bpy.data.materials.new(PREFIX + "glyph")
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        if n.type != "OUTPUT_MATERIAL":
            nt.nodes.remove(n)
    out = next(n for n in nt.nodes if n.type == "OUTPUT_MATERIAL")
    em = nt.nodes.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = (*LOOK["glyph_linear"], 1.0)
    # Strokes: the edges of a Voronoi net over the panel's UVs stand for the page's runes (their
    # shapes are drawn at 128 px and are fogged past reading); the panel's mean stays LOOK["glyph"].
    width, gain, recess = LOOK["glyph_strokes"]
    uv = nt.nodes.new("ShaderNodeTexCoord")
    net = nt.nodes.new("ShaderNodeTexVoronoi")
    net.feature = "DISTANCE_TO_EDGE"
    net.inputs["Scale"].default_value = 4.0
    line = nt.nodes.new("ShaderNodeMath")
    line.operation = "LESS_THAN"
    line.inputs[1].default_value = width
    level = nt.nodes.new("ShaderNodeMath")
    level.operation = "MULTIPLY_ADD"
    level.inputs[1].default_value = gain * (1.0 - recess)
    level.inputs[2].default_value = recess
    strength = nt.nodes.new("ShaderNodeMath")
    strength.operation = "MULTIPLY"
    strength.inputs[1].default_value = LOOK["glyph"]
    nt.links.new(uv.outputs["UV"], net.inputs["Vector"])
    nt.links.new(net.outputs["Distance"], line.inputs[0])
    nt.links.new(line.outputs[0], level.inputs[0])
    nt.links.new(level.outputs[0], strength.inputs[0])
    nt.links.new(strength.outputs[0], em.inputs["Strength"])
    nt.links.new(em.outputs[0], out.inputs["Surface"])
    return m


def depth_material():
    """View-space depth (three's fog depth) as an emission, for the second render of each layer."""
    m = bpy.data.materials.new(PREFIX + "depth")
    m.use_nodes = True
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
    """The fill and the surface light as bake_world.py has them (the glyph and lava lights do not
    reach past z -12), and the water's glow as the world colour."""
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
    world.use_nodes = True
    bg = next(n for n in world.node_tree.nodes if n.type == "BACKGROUND")
    bg.inputs["Color"].default_value = (*LOOK["ambient_linear"], 1.0)
    bg.inputs["Strength"].default_value = LOOK["ambient"]
    sc.world = world


# --- The chain: Kit.tsx hangChain, in Blender --------------------------------------------------

def hang_chain(link_ob, chain, name):
    """The kit's chain link, repeated and bent along a sagging curve as Kit.tsx does (`hangChain`),
    as a Blender mesh. Stage coordinates throughout, then turned to Blender's axes."""
    me = link_ob.data
    # Kit-local as glTF has it: x, y (along the chain: Blender z), z (Blender -y), scaled.
    v = np.array([(c.co.x, c.co.z, -c.co.y) for c in me.vertices], dtype=np.float64) * CHAIN_SCALE
    faces = [tuple(p.vertices) for p in me.polygons]
    unit = 30 * 0.175 * CHAIN_SCALE
    a, b = np.array(chain["from"], float), np.array(chain["to"], float)
    mid = (a + b) / 2
    mid[1] -= chain["sag"] * 2
    t = np.linspace(0, 1, 2001)[:, None]
    pts = (1 - t) ** 2 * a + 2 * (1 - t) * t * mid + t ** 2 * b
    seg = np.linalg.norm(np.diff(pts, axis=0), axis=1)
    arc = np.concatenate([[0], np.cumsum(seg)])
    length = arc[-1]
    copies = max(1, round(length / unit))
    total = copies * unit
    span = b - a
    plane = np.cross(span, (0, -1, 0))
    if np.dot(plane, plane) < 1e-6:
        plane = np.array([0, 0, 1.0])
    plane /= np.linalg.norm(plane)
    verts, polys = [], []
    for k in range(copies):
        base = len(verts)
        for x, y, z in v:
            y += k * unit
            u = min(max(y / total, 0.0), 1.0)
            s = u * length
            i = min(max(int(np.searchsorted(arc, s)), 1), len(arc) - 1)
            f = (s - arc[i - 1]) / max(arc[i] - arc[i - 1], 1e-12)
            p = pts[i - 1] + (pts[i] - pts[i - 1]) * f
            tan = pts[min(i + 1, len(pts) - 1)] - pts[max(i - 2, 0)]
            tan /= np.linalg.norm(tan)
            across = np.cross(tan, plane)
            across /= np.linalg.norm(across)
            q = p + across * x + plane * z
            verts.append((q[0], -q[2], q[1]))  # stage (x, y, z) -> Blender (x, -z, y)
        polys += [tuple(base + i for i in f) for f in faces]
    new = bpy.data.meshes.new(PREFIX + name)
    new.from_pydata(verts, [], polys)
    new.update()
    for p in new.polygons:
        p.use_smooth = True
    return new


# --- Placing and rendering ---------------------------------------------------------------------

def layer_index(far, z):
    """The layer a piece at depth z is in (farPlate.ts farLayerOf), or None for the near world."""
    if z >= far["cutZ"]:
        return None
    for i, layer in enumerate(far["layers"]):
        if layer["near"] > z and (layer["far"] is None or z >= layer["far"]):
            return i
    return None


def place_layers(sc, KIT, bw, far, layout, built, mats):
    """Every piece of every layer, linked into the scene: {layer index: [objects]}. Pieces are lod1."""
    coll = sc.collection
    by_layer = {i: [] for i in range(len(far["layers"]))}

    def link(piece, matrix, label, layer):
        source = built[piece][1]
        ob = bpy.data.objects.new(f"{PREFIX}{label}", source.data)
        ob.matrix_world = matrix
        coll.objects.link(ob)
        by_layer[layer].append(ob)
        for child in source.children:
            c = bpy.data.objects.new(f"{PREFIX}{label}.{child.name[len(KIT.PREFIX):]}", child.data)
            coll.objects.link(c)
            c.parent = ob
            c.matrix_parent_inverse = child.matrix_parent_inverse.copy()
            by_layer[layer].append(c)
        return ob

    # Coral rests on the full-detail boulders under it, or the seabed, as on the page.
    rock_trees = []
    for p in layout["rocks"] + [e for e in far["extras"] if e["piece"].startswith("rock")]:
        full = built[p["piece"]][0]
        mw = KIT.stage_matrix(p)
        rock_trees.append(BVHTree.FromPolygons([mw @ v.co for v in full.data.vertices], [tuple(q.vertices) for q in full.data.polygons]))

    floor_y = layout["floorY"]
    groups = [(p, "pillar") for p in layout["pillars"]] + [(p, "rock") for p in layout["rocks"]] + [(p, "coral") for p in layout["corals"]]
    groups += [(e, e["piece"].split("_")[0]) for e in far["extras"]]
    for k, (p, kind) in enumerate(groups):
        layer = layer_index(far, p["position"][2])
        if layer is None:
            continue
        matrix = KIT.stage_matrix(p)
        if kind == "coral":
            x, _, z = p["position"]
            matrix = KIT.stage_matrix(p, bw.coral_rest(x, z, floor_y, rock_trees)[0])
        link(p["piece"], matrix, f"{kind}{k}", layer)

    for k, chain in enumerate(layout["chains"]):
        if chain["from"][2] <= far["cutZ"] and chain["to"][2] <= far["cutZ"]:
            layer = layer_index(far, (chain["from"][2] + chain["to"][2]) / 2)
            me = hang_chain(built["chain"][1], chain, f"chain{k}")
            me.materials.append(mats["iron"])
            ob = bpy.data.objects.new(f"{PREFIX}chain{k}", me)
            coll.objects.link(ob)
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


# --- Fog, PNG, KTX2 ----------------------------------------------------------------------------

def to_srgb(c):
    c = np.clip(c, 0.0, 1.0)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * np.power(c, 1 / 2.4) - 0.055)


def fogged(colour, depth, fog):
    """Premultiplied linear colour and depth to straight sRGB RGBA 8-bit, with three's exp2 fog
    on each pixel and the fog colour in the transparent texels. Returns (rgba, stats)."""
    alpha = colour[..., 3]
    covered = alpha > 1e-4
    straight = np.where(covered[..., None], colour[..., :3] / np.maximum(alpha, 1e-4)[..., None], 0.0)
    d = np.where(covered, depth[..., 0] / np.maximum(depth[..., 3], 1e-4), 0.0)
    amount = 1.0 - np.exp(-((fog["density"] * d) ** 2))
    water = np.array(srgb_to_linear(fog["color"]), dtype=np.float32)
    lit = np.clip(straight * LOOK["exposure"], 0.0, None)
    out = lit * (1.0 - amount[..., None]) + water * amount[..., None]
    out = np.where(covered[..., None], out, water)
    rgba = np.concatenate([to_srgb(out), np.clip(alpha, 0.0, 1.0)[..., None]], axis=-1)
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
    t0 = time.time()
    far = json.loads(FAR.read_text(encoding="utf-8"))
    fog = far["fog"]
    TMP.mkdir(exist_ok=True)
    bw = load_module("nox_bake_world_for_far", HERE / "bake_world.py")
    KIT = bw.load_kit()
    KIT.PREFIX = PREFIX + "kit."
    sc = make_scene()
    layout = KIT.read_layout()

    if not opts["reuse"]:
        pieces = bpy.data.collections.new(PREFIX + "pieces")
        sc.collection.children.link(pieces)
        with in_scene(sc):
            built = KIT.build_pieces(pieces)
        KIT.check_layout(layout, built)
        pieces.hide_render = True
        mats = {
            "stone": principled("stone", STONE, 0.62),
            "rock": principled("rock", ROCK, 0.5),
            "coral": principled("coral", CORAL, 0.42, emission=CORAL_GLOW, emission_power=1.6),
            "iron": principled("iron", IRON, 0.38, metal=0.8, vertex_ao=False),
            "glyph": glyph_material(),
        }
        # Swap the kit's placeholder materials for the page's, on the shared mesh data.
        for name, (full, far_ob) in built.items():
            kind = {"pillar": "stone", "rock": "rock", "coral": "coral", "chain": "iron"}[name.split("_")[0]]
            for ob in (far_ob, *far_ob.children):
                glyph = ob.parent is not None
                ob.data.materials.clear()
                ob.data.materials.append(mats["glyph"] if glyph else mats[kind])
        lighting(sc, bw, layout["floorY"])
        by_layer = place_layers(sc, KIT, bw, far, layout, built, mats)
        depth_mat = depth_material()
        for i, layer in enumerate(far["layers"]):
            for j, objs in by_layer.items():
                for ob in objs:
                    ob.hide_render = j != i
            set_camera(sc, layer)
            t1 = time.time()
            print(f"layer {i} (z {layer['z']}): {len(by_layer[i])} objects, {layer['pixels'][0]} x {layer['pixels'][1]}")
            render_exr(sc, TMP / f"far-{i}-colour.exr")
            render_exr(sc, TMP / f"far-{i}-depth.exr", depth_mat)
            print(f"  rendered in {time.time() - t1:.0f} s")

    total = 0
    for i, layer in enumerate(far["layers"]):
        colour = read_exr(TMP / f"far-{i}-colour.exr")
        depth = read_exr(TMP / f"far-{i}-depth.exr")
        rgba, stats = fogged(colour, depth, fog)
        png = (opts["png"] or TMP) / f"far-{i}.png"
        png.parent.mkdir(parents=True, exist_ok=True)
        write_png(png, rgba)
        out = OUT / f"far-{i}.ktx2"
        ktx(png, out)
        total += out.stat().st_size
        print(f"far-{i}.ktx2: z {layer['z']}, {rgba.shape[1]} x {rgba.shape[0]}, {stats['covered']:.2%} covered, mean fog {stats['fog']:.2f}, {out.stat().st_size} bytes")
    print(f"far plate: {total} bytes in {time.time() - t0:.0f} s")


if __name__ == "__main__":
    main()
