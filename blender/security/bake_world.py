"""The security world's near light, baked: public/nox/world/security/near.glb.

Cycles bakes the light that does not move into lightmaps on a second UV set (LightUV, TEXCOORD_1
in the file), for every placed instance of stone, rock and coral at both levels of detail, and for
the seabed:
- the glyph lights of the lit pillars, raised by the relics' spill (R29);
- the lava light pooling low round the coral, unshadowed: it stands for lava glowing under the
  rubble, and lights the rock heaps through, as the page's light did;
- the cool fill from overhead, unshadowed as on the page;
- the bounce of all of these and of the surface light, whose own direct light stays real-time on
  the page (its caustic cookie and Nox's moving shadow, R30);
- ambient occlusion.

It builds the kit's pieces with build_kit.py's own builders (same seeds, same geometry), gives each
lightmapped piece a LightUV unwrap, and lays layout.json out twice in its own scene: once at full
detail with the seabed, once at lod1. Each placed piece gets its own square of an atlas: full
detail in one atlas, lod1 in another, so a piece keeps its light when it swaps level. The page
shares each piece's geometry between its placements and frames the atlas on a placement's square
through the lightmap's texture transform.

A lightmap texel is far coarser than the stone's normal map, so each lightmap has a relief map
beside it: per texel, the main direction its glyph, lava and fill light comes from and that
light's strength, from the same lights computed as three computes them, at the texel's baked
position and normal. The page shades the normal map with it (withBakedLight in bakedLight.ts).

near.glb carries the pieces (as kit.glb has them, plus LightUV), the three lightmaps (as the
emissive maps of the quads `lightmap_lod0`, `lightmap_lod1` and `lightmap_seabed`, KTX2 UASTC),
their relief maps (as the same quads' normal maps, linear KTX2 UASTC) and a record of the bake in
its scene's extras (`nox_bake`): the layout and lights it baked, the seabed heights it sampled,
each placement's square and matrix, and the relief maps' encoding. validateWorld.test checks the
record against the page's config, layout and floorHeight; placement.test checks the matrices.

Run from a shell (a GPU is used when Blender's preferences enable one; with --factory-startup
there are none, and Cycles bakes on the CPU):
    blender --background --python blender/security/bake_world.py
or inside a running Blender (Blender MCP), in steps that each finish within a call:
    p = "<repo>/blender/security/bake_world.py"
    import importlib.util, sys
    spec = importlib.util.spec_from_file_location("nox_bake_world", p)
    bw = importlib.util.module_from_spec(spec); sys.modules["nox_bake_world"] = bw; spec.loader.exec_module(bw)
    bw.setup(); [bw.bake(level, step) for level in bw.LEVELS for step in bw.STEPS]
    [bw.bake_geometry(level) for level in bw.LEVELS]; bw.finish()
The bake is not bit-exact between GPU runs: a second run in a fresh Blender changed 20 of the
1024 x 1024 lod0 texels and 0.2% of the seabed's, by at most 16 levels in 255.

It builds and bakes in its own scene, "NoxWorld security bake", and touches nothing outside it; it
never saves the .blend file.
"""
import importlib.util
import json
import math
import random
import tempfile
import time
from pathlib import Path

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
NEAR = ROOT / "public/nox/world/security/near.glb"
TMP = Path(tempfile.gettempdir())
RAW = TMP / "nox-near-security-raw.glb"
UASTC = TMP / "nox-near-security-uastc.glb"

SCENE = "NoxWorld security bake"
PIECES = "NoxWorld security pieces"  # exported: the kit's pieces with LightUV, and the atlas quads
LEVEL_SETS = {"lod0": "NoxWorld security full detail", "lod1": "NoxWorld security lod1"}  # baked, not exported
SEABED_SET = "NoxWorld security seabed"
LIGHTS = "NoxWorld security lights"
# Blender names are unique in the file: a prefix apart from the kit scene's ("nox."), stripped on export.
PREFIX = "noxbake."
LIGHT_UV = "LightUV"
LEVELS = ("lod0", "lod1")
STEPS = ("direct", "indirect", "ao")

# --- What the page has. near.glb records these and validateWorld.test checks that they still
# agree with src/nox3d/world/security/config.ts, seabed.ts and layout.json. ---------------------
GLYPH = {"color": "#ff2436", "intensity": 1.7, "distance": 2.1}  # WorldLight, kind glyph
GLYPH_LIGHT_REACH = 0.985  # in front of the pillar's axis (config.ts)
LAVA = {"color": "#ff3418", "intensity": 3.4, "distance": 5}  # WorldLight, kind lava
FILL = {"color": "#6f8fff", "intensity": 1.1, "position": [-1.5, 10, 2]}  # a directional light at the origin
SURFACE = {"color": "#6f9cff", "intensity": 1.1, "position": [0.6, 24, -10], "target_xz": (0, -8)}  # target y: floorY
SURFACE_CONE = (0.6, 0.55)  # three's angle and penumbra
# The relics' spill (config.ts relics.spill): the glyph light on the stone is the test scene's,
# 1.2 times as strong. Nox's accents keep the WorldLight data as it is.
SPILL = 1.2
# The lava's rise (config.ts glow.lava): the lava lights baked on the stone and seabed are this many
# times the WorldLight data (the lower third wants far more lava glow; Nox's accents keep the data).
LAVA_RISE = 1.4
# The red lights behind the front rock heaps (config.ts glow.back): a lava light at each heap's back
# and foot, this many times the lava data's intensity, so the heaps are rimmed red against the dark.
BACK_RISE = 1.0
BACK_REACH = 3.2  # their distance window
BACK_HEAPS = (-1.5, 2.3)  # rocks nearer than this z (front) and wider than this |x| (heaps)
SEABED = {"width": 26, "nearZ": 7, "farZ": -62, "segments": [110, 260]}
# The page's albedos (linear), for the bounce: stone #343c5a, rock #22202e, coral #7a0a18, seabed #15161f.
ALBEDO = {"stone": "#343c5a", "rock": "#22202e", "coral": "#7a0a18", "seabed": "#15161f"}

# --- How it is baked -------------------------------------------------------------------------
ATLAS = {"lod0": 1024, "lod1": 512}
SEABED_SIZE = (512, 1024)  # across x, along z
SAMPLES = {"direct": 192, "indirect": 96, "ao": 160}
BOUNCES = 3
MARGIN = 4  # pixels the bake extends past each island
PAD = 2  # pixels between two placements' squares
# LightUV: smart projection joins faces up to 89 degrees apart (lightmaps do not mind stretch, and
# fewer islands waste less of the square), with a gap of 0.4% of the square between islands; the
# bake's margin fills the gaps from the faces next to each seam.
UNWRAP_ANGLE = 89
ISLAND_MARGIN = 0.004
AO_DISTANCE = 0.6
AO_STRENGTH = 0.5  # 0: no occlusion, 1: the full AO term
# Texels hold irradiance / INTENSITY, sRGB-encoded, so the dark stone keeps its steps; the
# brightest stone by the lava stays under it.
INTENSITY = 48.0
POINT_RADIUS = 0.05  # soft shadows from the glyph lights
# Which lights cast shadows in the bake. The lava light sits among the rocks and coral it lights;
# shadowed, the rocks would hide the red pools on the seabed that panel 2's lower third wants.
SHADOWS = {"glyph": True, "lava": False, "fill": False}
# The surface light's caustic cookie averages 0.78 (caustics.ts, sampled over its time).
COOKIE_MEAN = 0.78

# The relief maps: texel positions are baked as (p / POSITION_RANGE + 1) / 2, normals as (n + 1) / 2.
# A relief texel holds a vector along the main direction of the glyph, lava and fill light (stage
# space), as (v + 1) / 2, whose length is s / (s + RELIEF_SCALE) for that light's strength s
# (luminance, three's units).
GEOMETRY = ("position", "normal")
POSITION_RANGE = 64.0
RELIEF_SCALE = 0.5
LUMINANCE = (0.2126, 0.7152, 0.0722)


# --- Small things ------------------------------------------------------------------------------

def linear(hex_colour):
    """An sRGB #rrggbb as linear RGB, as three's Color does."""
    def channel(c):
        return c * 0.0773993808 if c < 0.04045 else (c * 0.9478672986 + 0.0521327014) ** 2.4
    return tuple(channel(int(hex_colour[i:i + 2], 16) / 255) for i in (1, 3, 5))


def blender(v):
    """Stage (x, y, z), Y up with the camera down -Z, as Blender (x, -z, y)."""
    return Vector((v[0], -v[2], v[1]))


def load_kit():
    """build_kit.py as its own module, naming what it builds with this script's prefix."""
    spec = importlib.util.spec_from_file_location("nox_build_kit_for_bake", HERE / "build_kit.py")
    kit = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(kit)
    kit.PREFIX = PREFIX
    return kit


KIT = None  # build_kit, loaded by setup()
STATE = {}  # what setup() made, for the steps after it


def scene():
    return bpy.data.scenes[SCENE]


def in_scene():
    sc = scene()
    return bpy.context.temp_override(scene=sc, view_layer=sc.view_layers[0])


# --- The seabed: the page's floorHeight (seabed.ts), operation for operation -------------------

def _hash(x, y, seed):
    h = (x * 374761393 + y * 668265263 + seed * 1442695041) & 0xFFFFFFFF  # `| 0`
    h = ((h ^ (h >> 13)) * 1274126177) & 0xFFFFFFFF  # Math.imul
    return ((h ^ (h >> 16)) & 0xFFFFFFFF) / 4294967295


def noise2(x, y, seed=0):
    xi, yi = math.floor(x), math.floor(y)
    fx, fy = x - xi, y - yi
    ux = fx * fx * (3 - 2 * fx)
    uy = fy * fy * (3 - 2 * fy)
    a, b = _hash(xi, yi, seed), _hash(xi + 1, yi, seed)
    c, d = _hash(xi, yi + 1, seed), _hash(xi + 1, yi + 1, seed)
    return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy


def fbm2(x, y, octaves=4, seed=0):
    v, amp, f = 0.0, 0.5, 1.0
    for o in range(octaves):
        v += amp * noise2(x * f, y * f, seed + o * 31)
        amp *= 0.5
        f *= 2.03
    return v / (1 - 0.5 ** octaves)


def smoothstep(x, lo, hi):
    if x <= lo:
        return 0.0
    if x >= hi:
        return 1.0
    x = (x - lo) / (hi - lo)
    return x * x * (3 - 2 * x)


def floor_height(x, z, floor_y):
    dunes = (fbm2(x * 0.22, z * 0.22, 4, 3) - 0.5) * 0.28
    ripple = (fbm2(x * 1.1, z * 1.1, 3, 7) - 0.5) * 0.08
    side = smoothstep(abs(x), 2.2, 4.8)
    rubble = side * (fbm2(x * 0.7, z * 0.7, 4, 11) - 0.35) * 0.55
    return floor_y + dunes + ripple + max(rubble, 0)


def seabed_grid():
    """The page's seabed vertices (three's PlaneGeometry, laid flat): x across, z along, row by row."""
    width, near_z, far_z = SEABED["width"], SEABED["nearZ"], SEABED["farZ"]
    nx, nz = SEABED["segments"]
    length = near_z - far_z
    xs = [ix * (width / nx) - width / 2 for ix in range(nx + 1)]
    zs = [(iz * (length / nz) - length / 2) + (near_z + far_z) / 2 for iz in range(nz + 1)]
    return xs, zs


def build_seabed(coll, floor_y, material):
    xs, zs = seabed_grid()
    width, near_z, far_z = SEABED["width"], SEABED["nearZ"], SEABED["farZ"]
    bm = bmesh.new()
    rows = [[bm.verts.new((x, -z, floor_height(x, z, floor_y))) for x in xs] for z in zs]
    uv = bm.loops.layers.uv.new(LIGHT_UV)
    for j in range(len(zs) - 1):
        for i in range(len(xs) - 1):
            face = bm.faces.new((rows[j][i], rows[j][i + 1], rows[j + 1][i + 1], rows[j + 1][i]))
            for loop in face.loops:
                x, z = loop.vert.co.x, -loop.vert.co.y
                # Blender's v runs up the image; the page's (seabed.ts) runs down it from the near edge.
                loop[uv].uv = ((x + width / 2) / width, (z - far_z) / (near_z - far_z))
    bm.normal_update()
    for f in bm.faces:
        if f.normal.z < 0:
            f.normal_flip()
    me = bpy.data.meshes.new(PREFIX + "seabed")
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    me.materials.append(material)
    ob = bpy.data.objects.new(PREFIX + "seabed", me)
    coll.objects.link(ob)
    return ob


def seabed_samples(floor_y, count=96, seed=17):
    """Heights from this copy of floorHeight, for the page to check its own against."""
    rng = random.Random(seed)
    xs, zs = seabed_grid()
    points = [(xs[i], zs[j]) for i, j in ((0, 0), (55, 130), (110, 260), (17, 201))]
    w, near_z, far_z = SEABED["width"], SEABED["nearZ"], SEABED["farZ"]
    points += [(rng.uniform(-w / 2, w / 2), rng.uniform(far_z, near_z)) for _ in range(count - len(points))]
    return [[x, z, floor_height(x, z, floor_y)] for x, z in points]


# --- Lightmap UVs and the atlases ---------------------------------------------------------------

def unwrap(ob):
    """A LightUV unwrap of one piece, packed into 0..1 (Blender's smart projection)."""
    me = ob.data
    if len(me.uv_layers) == 0:
        # Coral draws no texture, but LightUV must be the second UV set (TEXCOORD_1), which the
        # page reads as uv1: a constant first set comes before it (meshopt packs it to almost nothing).
        me.uv_layers.new(name="UVMap").data.foreach_set("uv", np.zeros(len(me.loops) * 2, np.float32))
    first = me.uv_layers[0].name  # by name: adding a layer moves the others
    if LIGHT_UV not in me.uv_layers:
        me.uv_layers.new(name=LIGHT_UV)
    me.uv_layers.active = me.uv_layers[LIGHT_UV]
    sc = scene()
    vl = sc.view_layers[0]
    common = dict(scene=sc, view_layer=vl, active_object=ob, object=ob, selected_objects=[ob], selected_editable_objects=[ob])
    with bpy.context.temp_override(**common):
        vl.objects.active = ob
        bpy.ops.object.mode_set(mode="EDIT")
    try:
        with bpy.context.temp_override(edit_object=ob, **common):
            bm = bmesh.from_edit_mesh(me)
            for f in bm.faces:
                f.select = True
            bmesh.update_edit_mesh(me)
            methods = enum_ids(bpy.ops.uv.smart_project.get_rna_type().properties["margin_method"])
            bpy.ops.uv.smart_project(angle_limit=math.radians(UNWRAP_ANGLE), island_margin=ISLAND_MARGIN, margin_method=next(m for m in methods if m == "FRACTION"))
    finally:
        with bpy.context.temp_override(edit_object=ob, **common):
            bpy.ops.object.mode_set(mode="OBJECT")
    me.uv_layers.active = me.uv_layers[first]


def areas(me):
    """The piece's surface area (its own units) and the share of LightUV's square its islands cover."""
    me.calc_loop_triangles()
    n = len(me.loop_triangles)
    loops = np.empty(n * 3, np.int32)
    me.loop_triangles.foreach_get("loops", loops)
    uv = np.empty(len(me.loops) * 2, np.float32)
    me.uv_layers[LIGHT_UV].data.foreach_get("uv", uv)
    t = uv.reshape(-1, 2)[loops].reshape(n, 3, 2)
    a, b = t[:, 1] - t[:, 0], t[:, 2] - t[:, 0]
    covered = float(np.abs(a[:, 0] * b[:, 1] - a[:, 1] * b[:, 0]).sum() / 2)
    tri_area = np.empty(n, np.float32)
    me.loop_triangles.foreach_get("area", tri_area)
    return float(tri_area.sum()), covered


def area_scale(p):
    s = p.get("scale", 1)
    sx, sy, sz = (s, s, s) if isinstance(s, (int, float)) else s
    return (sx * sy * sz) ** (2 / 3)


def pack(sides, size):
    """Shelf-packs squares of `sides` pixels, biggest first, into a size x size atlas: their
    top-left corners, or None if they do not fit."""
    order = sorted(range(len(sides)), key=lambda i: -sides[i])
    spots = [None] * len(sides)
    x = y = row = 0
    for i in order:
        s = sides[i]
        if x + s > size:
            x, y, row = 0, y + row + PAD, 0
        if y + s > size:
            return None
        spots[i] = (x, y)
        x += s + PAD
        row = max(row, s)
    return spots


def atlas_squares(needs, size):
    """Each instance's square in an atlas, as large as they all fit: `needs` holds each one's
    area over its LightUV coverage (so the squares share one texel density)."""
    lo, hi = 0.0, size / math.sqrt(max(needs))
    for _ in range(40):
        mid = (lo + hi) / 2
        if pack([max(8, int(mid * math.sqrt(n))) for n in needs], size):
            lo = mid
        else:
            hi = mid
    sides = [max(8, int(lo * math.sqrt(n))) for n in needs]
    return lo, sides, pack(sides, size)


def to_square(me, spot, side, size):
    """Moves a placed copy's LightUV into its square of the atlas (Blender's v up the image)."""
    uv = np.empty(len(me.loops) * 2, np.float32)
    layer = me.uv_layers[LIGHT_UV]
    layer.data.foreach_get("uv", uv)
    uv = uv.reshape(-1, 2)
    x, y = spot
    s = side / size
    uv[:, 0] = uv[:, 0] * s + x / size
    uv[:, 1] = uv[:, 1] * s + 1 - (y + side) / size
    layer.data.foreach_set("uv", uv.ravel())
    # The bake writes through the active UV map.
    me.uv_layers.active = layer
    layer.active_render = True


def rect(spot, side, size):
    """The square as the page reads it: three's offset and repeat, v down the image from its top."""
    x, y = spot
    return [x / size, y / size, side / size, side / size]


# --- Setup -------------------------------------------------------------------------------------

def rock_tree(ob):
    """A placed boulder's surface, for coral to rest on."""
    mw = ob.matrix_world
    return BVHTree.FromPolygons([mw @ v.co for v in ob.data.vertices], [tuple(q.vertices) for q in ob.data.polygons])


def coral_rest(x, z, floor_y, rock_trees):
    """Where coral at stage (x, z) rests, as the page's coralRest (placement.ts): on the highest
    boulder under it or the seabed, whichever is higher, sunk 0.04. Returns (y, "rock" | "seabed")."""
    hits = [tree.ray_cast(Vector((x, -z, 8.0)), Vector((0, 0, -1)))[0] for tree in rock_trees]
    rock = max((h.z for h in hits if h is not None), default=None)
    seabed = floor_height(x, z, floor_y)
    return (rock - 0.04, "rock") if rock is not None and rock > seabed else (seabed - 0.04, "seabed")


def own_scene():
    """This script's scene and collections, emptied of what an earlier run made."""
    sc = bpy.data.scenes.get(SCENE) or bpy.data.scenes.new(SCENE)
    colls = {}
    for name in (PIECES, *LEVEL_SETS.values(), SEABED_SET, LIGHTS):
        coll = bpy.data.collections.get(name) or bpy.data.collections.new(name)
        if sc.collection.children.get(name) is None:
            sc.collection.children.link(coll)
        for ob in list(coll.objects):
            bpy.data.objects.remove(ob, do_unlink=True)
        colls[name] = coll
    for store in (bpy.data.meshes, bpy.data.lights, bpy.data.images, bpy.data.materials, bpy.data.worlds, bpy.data.node_groups):
        for data in list(store):
            if data.name.startswith(PREFIX) and data.users == 0:
                store.remove(data)
    return sc, colls


def bake_material(name, albedo):
    """A plain diffuse surface carrying the image node the bake writes into."""
    m = bpy.data.materials.get(PREFIX + name) or bpy.data.materials.new(PREFIX + name)
    m.use_nodes = True
    nodes = m.node_tree.nodes
    bsdf = next(n for n in nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Base Color"].default_value = (*linear(albedo), 1.0)
    bsdf.inputs["Roughness"].default_value = 1.0
    tex = next((n for n in nodes if n.type == "TEX_IMAGE"), None) or nodes.new("ShaderNodeTexImage")
    nodes.active = tex
    return m


def bake_images(name, width, height):
    images = {}
    for step in STEPS:
        key = f"{PREFIX}{name}.{step}"
        img = bpy.data.images.get(key)
        if img and (img.size[0], img.size[1]) != (width, height):
            bpy.data.images.remove(img)
            img = None
        images[step] = img or bpy.data.images.new(key, width, height, alpha=True, float_buffer=True)
        # Clear: the bake writes alpha 1 where an island (or its margin) reaches.
        images[step].generated_color = (0, 0, 0, 0)
    return images


def window(light_data, distance):
    """three's cutoff on a point light: its 1/d^2 times (1 - (d/distance)^4)^2, from the ray's length."""
    light_data.use_nodes = True
    nt = light_data.node_tree
    for n in list(nt.nodes):
        if n.type != "OUTPUT_LIGHT":
            nt.nodes.remove(n)
    out = next(n for n in nt.nodes if n.type == "OUTPUT_LIGHT")
    emission = nt.nodes.new("ShaderNodeEmission")
    path = nt.nodes.new("ShaderNodeLightPath")

    def math_node(op, b, clamp=False):
        n = nt.nodes.new("ShaderNodeMath")
        n.operation = op
        n.inputs[1].default_value = b
        n.use_clamp = clamp
        return n
    over = math_node("DIVIDE", distance)
    fourth = math_node("POWER", 4.0)
    rest = nt.nodes.new("ShaderNodeMath")
    rest.operation = "SUBTRACT"
    rest.inputs[0].default_value = 1.0
    rest.use_clamp = True
    square = math_node("POWER", 2.0)
    nt.links.new(path.outputs["Ray Length"], over.inputs[0])
    nt.links.new(over.outputs[0], fourth.inputs[0])
    nt.links.new(fourth.outputs[0], rest.inputs[1])
    nt.links.new(rest.outputs[0], square.inputs[0])
    nt.links.new(square.outputs[0], emission.inputs["Strength"])
    nt.links.new(emission.outputs[0], out.inputs["Surface"])


def point_light(coll, name, light, shadow):
    data = bpy.data.lights.new(PREFIX + name, "POINT")
    # three's intensity is candela; a Cycles point light of 4 pi W gives the same irradiance.
    data.energy = 4 * math.pi * light["intensity"]
    data.color = linear(light["color"])
    data.shadow_soft_size = POINT_RADIUS
    data.use_soft_falloff = False
    data.use_shadow = shadow
    window(data, light["distance"])
    ob = bpy.data.objects.new(PREFIX + name, data)
    ob.location = blender(light["position"])
    coll.objects.link(ob)
    return ob


def lights(coll, layout, centres):
    floor_y = layout["floorY"]
    glyph, lava = [], []
    for p in layout["pillars"]:
        if not p.get("light"):
            continue
        x, y, z = p["position"]
        rot = p.get("rotY", 0.0)
        position = [x + math.sin(rot) * GLYPH_LIGHT_REACH, y + centres[p["piece"]], z + math.cos(rot) * GLYPH_LIGHT_REACH]
        glyph.append({"position": position, "color": GLYPH["color"], "intensity": GLYPH["intensity"] * SPILL, "distance": GLYPH["distance"]})
    for position in layout["coralLights"]:
        lava.append({"position": list(position), "color": LAVA["color"], "intensity": LAVA["intensity"] * LAVA_RISE, "distance": LAVA["distance"]})
    back = []
    for p in layout["rocks"]:
        x, y, z = p["position"]
        if z < BACK_HEAPS[0] or abs(x) < BACK_HEAPS[1]:
            continue
        scale = p.get("scale", 1.0)
        size = max(scale) if isinstance(scale, list) else scale
        # Behind the heap (away from the lens), low, a little out from the middle of the corridor.
        back.append({"position": [round(x * 1.05, 4), round(layout["floorY"] + 0.45, 4), round(z - 0.75 * size - 0.5, 4)], "color": LAVA["color"], "intensity": LAVA["intensity"] * BACK_RISE, "distance": BACK_REACH})
    for i, light in enumerate(glyph):
        point_light(coll, f"glyph{i}", light, SHADOWS["glyph"])
    for i, light in enumerate(lava):
        point_light(coll, f"lava{i}", light, SHADOWS["lava"])
    for i, light in enumerate(back):
        point_light(coll, f"back{i}", light, SHADOWS["lava"])

    # The fill: three's directional light, shining from its position to the origin, unshadowed.
    data = bpy.data.lights.new(PREFIX + "fill", "SUN")
    data.energy = FILL["intensity"]
    data.color = linear(FILL["color"])
    data.angle = 0.0
    data.use_shadow = SHADOWS["fill"]
    sun = bpy.data.objects.new(PREFIX + "fill", data)
    sun.rotation_euler = (-blender(FILL["position"])).to_track_quat("-Z", "Y").to_euler()
    coll.objects.link(sun)

    # The surface light: three's spot has no falloff (decay 0), so its strength at the target is
    # kept, times its cookie's mean. Only its bounce is baked; the page lights the stone with it.
    tx, tz = SURFACE["target_xz"]
    surface = {"color": SURFACE["color"], "intensity": SURFACE["intensity"], "position": SURFACE["position"], "target": [tx, floor_y, tz]}
    reach = (blender(surface["target"]) - blender(surface["position"])).length
    data = bpy.data.lights.new(PREFIX + "surface", "SPOT")
    data.energy = 4 * math.pi * surface["intensity"] * reach * reach * COOKIE_MEAN
    data.color = linear(surface["color"])
    data.spot_size = 2 * SURFACE_CONE[0]
    data.spot_blend = SURFACE_CONE[1]
    data.shadow_soft_size = 0.5
    spot = bpy.data.objects.new(PREFIX + "surface", data)
    spot.location = blender(surface["position"])
    spot.rotation_euler = (blender(surface["target"]) - blender(surface["position"])).to_track_quat("-Z", "Y").to_euler()
    coll.objects.link(spot)
    return {"glyph": glyph, "lava": lava, "back": back, "fill": dict(FILL), "surface": surface}, spot


def gpu_device(sc):
    """The GPU when Blender's preferences enable one, else the CPU."""
    try:
        prefs = bpy.context.preferences.addons["cycles"].preferences
        if prefs.compute_device_type != "NONE":
            prefs.refresh_devices()
            if any(d.use and d.type != "CPU" for d in prefs.devices):
                sc.cycles.device = "GPU"
                return f"GPU ({', '.join(d.name for d in prefs.devices if d.use and d.type != 'CPU')})"
    except (KeyError, AttributeError):
        pass
    sc.cycles.device = "CPU"
    return "CPU"


def setup():
    """Builds the pieces, their LightUVs, the two layouts, the seabed and the lights."""
    global KIT
    t0 = time.time()
    KIT = load_kit()
    sc, colls = own_scene()
    try:
        sc.render.engine = "CYCLES"
    except TypeError as error:
        raise RuntimeError(f"Cycles is needed to bake: {error}") from error
    device = gpu_device(sc)
    c = sc.cycles
    c.max_bounces = c.diffuse_bounces = BOUNCES
    c.glossy_bounces = c.transmission_bounces = c.volume_bounces = 0
    c.transparent_max_bounces = 2
    c.caustics_reflective = c.caustics_refractive = False
    c.sample_clamp_indirect = 10.0
    world = bpy.data.worlds.get(PREFIX + "world") or bpy.data.worlds.new(PREFIX + "world")
    world.use_nodes = True
    background = next(n for n in world.node_tree.nodes if n.type == "BACKGROUND")
    background.inputs["Color"].default_value = (0, 0, 0, 1)
    background.inputs["Strength"].default_value = 0.0
    world.light_settings.distance = AO_DISTANCE
    sc.world = world

    layout = KIT.read_layout()
    with in_scene():
        built = KIT.build_pieces(colls[PIECES])
    KIT.check_layout(layout, built)
    for ob in colls[PIECES].objects:
        ob.hide_render = True  # the pieces stand at the origin; only the placed copies are baked

    # One LightUV per lightmapped piece (stone, rock, coral), at both levels.
    kinds = {}
    for name, (full, far) in built.items():
        if name == "chain":
            continue
        kind = "stone" if name.startswith("pillar") else name.split("_")[0]
        for level, ob in zip(LEVELS, (full, far)):
            unwrap(ob)
            kinds[(name, level)] = (kind, ob, *areas(ob.data))

    groups = [("pillars", p) for p in layout["pillars"]] + [("rocks", p) for p in layout["rocks"]] + [("corals", p) for p in layout["corals"]]
    squares = {}
    for level in LEVELS:
        needs = [kinds[(p["piece"], level)][2] * area_scale(p) / kinds[(p["piece"], level)][3] for _, p in groups]
        density, sides, spots = atlas_squares(needs, ATLAS[level])
        squares[level] = (density, sides, spots)

    mats = {}
    images = {}
    for level in LEVELS:
        images[level] = bake_images(f"atlas_{level}", ATLAS[level], ATLAS[level])
        for kind in ("stone", "rock", "coral"):
            mats[(kind, level)] = bake_material(f"bake_{kind}_{level}", ALBEDO[kind])
    images["seabed"] = bake_images("atlas_seabed", *SEABED_SIZE)
    mats["seabed"] = bake_material("bake_seabed", ALBEDO["seabed"])

    # The layout, once per level: each placement a copy of its piece with the LightUV moved into
    # its square. Coral drops onto the full-detail rocks below, or the seabed, as on the page.
    floor_y = layout["floorY"]
    seabed = build_seabed(colls[SEABED_SET], floor_y, mats["seabed"])
    placed = {level: [] for level in LEVELS}
    rock_trees = []
    for level in LEVELS:
        coll = colls[LEVEL_SETS[level]]
        density, sides, spots = squares[level]
        for k, (group, p) in enumerate(groups):
            kind, piece, _, _ = kinds[(p["piece"], level)]
            if group == "corals":
                x, _, z = p["position"]
                matrix = KIT.stage_matrix(p, coral_rest(x, z, floor_y, rock_trees)[0])
            else:
                matrix = KIT.stage_matrix(p)
            me = piece.data.copy()
            me.name = f"{PREFIX}{group}{k}.{level}"
            to_square(me, spots[k], sides[k], ATLAS[level])
            for i in range(len(me.materials)):
                me.materials[i] = mats[(kind, level)]
            ob = bpy.data.objects.new(me.name, me)
            ob.matrix_world = matrix
            coll.objects.link(ob)
            for child in piece.children:  # glyph panels: in the way of the light, not baked
                c = bpy.data.objects.new(f"{me.name}.{child.name[len(PREFIX):]}", child.data)
                coll.objects.link(c)
                c.parent = ob
                c.matrix_parent_inverse = child.matrix_parent_inverse.copy()
            placed[level].append(ob)
            if level == "lod0" and group == "rocks":
                rock_trees.append(rock_tree(ob))

    centres = {name: full["glyph_centre"] for name, (full, _) in built.items() if name.startswith("pillar")}
    record_lights, spot = lights(colls[LIGHTS], layout, centres)

    STATE.clear()
    STATE.update(
        layout=layout, built=built, groups=groups, squares=squares, placed=placed, seabed=seabed,
        images=images, mats=mats, spot=spot, lights=record_lights, device=device, colls=colls,
    )
    for level in LEVELS:
        density, sides, _ = squares[level]
        print(f"{level}: {ATLAS[level]} px atlas, {density:.1f} texels per unit, squares {min(sides)} to {max(sides)} px")
    print(f"setup in {time.time() - t0:.1f} s on {device}")


# --- Baking ------------------------------------------------------------------------------------

def enum_ids(prop):
    return [i.identifier for i in prop.enum_items]


def bake(level, step):
    """One bake: `level` lod0 (the full-detail pieces, and the seabed) or lod1, `step` direct
    (glyph, lava and fill light; no surface light), indirect (the bounce of all of them and of
    the surface light) or ao."""
    t0 = time.time()
    sc = scene()
    vl = sc.view_layers[0]
    placed, images, mats = STATE["placed"], STATE["images"], STATE["mats"]
    for lv in LEVELS:
        for ob in placed[lv]:
            for o in (ob, *ob.children):
                o.hide_render = lv != level
    STATE["spot"].hide_render = step != "indirect"
    sc.cycles.samples = SAMPLES[step]
    targets = list(placed[level]) + ([STATE["seabed"]] if level == "lod0" else [])
    for kind in ("stone", "rock", "coral"):
        next(n for n in mats[(kind, level)].node_tree.nodes if n.type == "TEX_IMAGE").image = images[level][step]
    next(n for n in mats["seabed"].node_tree.nodes if n.type == "TEX_IMAGE").image = images["seabed"][step]
    bake_types = enum_ids(bpy.ops.object.bake.get_rna_type().properties["type"])
    kind = next(t for t in bake_types if t == ("AO" if step == "ao" else "DIFFUSE"))
    filters = enum_ids(bpy.types.BakeSettings.bl_rna.properties["pass_filter"])
    pass_filter = set() if step == "ao" else {next(f for f in filters if f == step.upper())}
    margin_type = next(m for m in enum_ids(bpy.types.BakeSettings.bl_rna.properties["margin_type"]) if m.startswith("ADJACENT"))
    for ob in vl.objects:
        ob.select_set(False, view_layer=vl)
    for ob in targets:
        ob.select_set(True, view_layer=vl)
    vl.objects.active = targets[0]
    with bpy.context.temp_override(scene=sc, view_layer=vl, active_object=targets[0], object=targets[0], selected_objects=targets, selected_editable_objects=targets):
        bpy.ops.object.bake(type=kind, pass_filter=pass_filter, margin=MARGIN, margin_type=margin_type, use_clear=True, target="IMAGE_TEXTURES")
    for ob in targets:
        ob.select_set(False, view_layer=vl)
    print(f"baked {level} {step} in {time.time() - t0:.1f} s ({SAMPLES[step]} samples)")


def bake_geometry(level):
    """Each texel's world position and shading normal, for the relief maps (`level` lod0 with the
    seabed, or lod1): an emission bake each, one sample, through the bake materials' emission."""
    t0 = time.time()
    sc = scene()
    vl = sc.view_layers[0]
    placed, mats = STATE["placed"], STATE["mats"]
    for lv in LEVELS:
        for ob in placed[lv]:
            for o in (ob, *ob.children):
                o.hide_render = lv != level
    targets = list(placed[level]) + ([STATE["seabed"]] if level == "lod0" else [])
    sets = {f"atlas_{level}": ([mats[(kind, level)] for kind in ("stone", "rock", "coral")], (ATLAS[level], ATLAS[level]))}
    if level == "lod0":
        sets["atlas_seabed"] = ([mats["seabed"]], SEABED_SIZE)
    sc.cycles.samples = 1
    kind = next(t for t in enum_ids(bpy.ops.object.bake.get_rna_type().properties["type"]) if t == "EMIT")
    margin_type = next(m for m in enum_ids(bpy.types.BakeSettings.bl_rna.properties["margin_type"]) if m.startswith("ADJACENT"))
    multiply_add = next(o for o in enum_ids(bpy.types.ShaderNodeVectorMath.bl_rna.properties["operation"]) if o == "MULTIPLY_ADD")
    geometry = STATE.setdefault("geometry", {})
    for what in GEOMETRY:
        added = []
        for name, (materials, (width, height)) in sets.items():
            key = f"{PREFIX}{name}.{what}"
            img = bpy.data.images.get(key)
            if img:
                bpy.data.images.remove(img)
            img = bpy.data.images.new(key, width, height, alpha=True, float_buffer=True)
            img.generated_color = (0, 0, 0, 0)
            geometry.setdefault(name, {})[what] = img
            for m in materials:
                nt = m.node_tree
                bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
                geo = nt.nodes.new("ShaderNodeNewGeometry")
                encode = nt.nodes.new("ShaderNodeVectorMath")
                encode.operation = multiply_add
                half = 0.5 / POSITION_RANGE if what == "position" else 0.5
                encode.inputs[1].default_value = (half, half, half)
                encode.inputs[2].default_value = (0.5, 0.5, 0.5)
                nt.links.new(geo.outputs["Position" if what == "position" else "Normal"], encode.inputs[0])
                nt.links.new(encode.outputs[0], bsdf.inputs["Emission Color"])
                bsdf.inputs["Emission Strength"].default_value = 1.0
                tex = next(n for n in nt.nodes if n.type == "TEX_IMAGE")
                tex.image = img
                nt.nodes.active = tex  # the bake writes into the active image node
                added.append((m, bsdf, geo, encode))
        for ob in vl.objects:
            ob.select_set(False, view_layer=vl)
        for ob in targets:
            ob.select_set(True, view_layer=vl)
        vl.objects.active = targets[0]
        try:
            with bpy.context.temp_override(scene=sc, view_layer=vl, active_object=targets[0], object=targets[0], selected_objects=targets, selected_editable_objects=targets):
                bpy.ops.object.bake(type=kind, margin=MARGIN, margin_type=margin_type, use_clear=True, target="IMAGE_TEXTURES")
        finally:
            for m, bsdf, geo, encode in added:
                m.node_tree.nodes.remove(geo)
                m.node_tree.nodes.remove(encode)
                bsdf.inputs["Emission Strength"].default_value = 0.0
            for ob in targets:
                ob.select_set(False, view_layer=vl)
    print(f"baked {level} positions and normals in {time.time() - t0:.1f} s")


# --- Finishing: lightmaps, relief maps, export, compression ------------------------------------

def pixels(img):
    a = np.empty(img.size[0] * img.size[1] * 4, np.float32)
    img.pixels.foreach_get(a)
    return a.reshape(img.size[1], img.size[0], 4)


def fill_gaps(rgb, covered, passes=24):
    """Texels no island reached take their neighbours' light, so mip levels do not bleed black in."""
    rgb, covered = rgb.copy(), covered.copy()
    for _ in range(passes):
        if covered.all():
            break
        total = np.zeros_like(rgb)
        count = np.zeros(covered.shape, np.float32)
        for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
            shifted = np.roll(np.roll(covered, dy, 0), dx, 1)
            total += np.roll(np.roll(rgb * covered[..., None], dy, 0), dx, 1)
            count += shifted
        grow = (~covered) & (count > 0)
        rgb[grow] = total[grow] / count[grow][:, None]
        covered = covered | grow
    return rgb


def save_png(name, rgb, colorspace):
    """An 8-bit PNG image of `rgb` (0 to 1), saved beside the export and loaded back from it."""
    h, w = rgb.shape[:2]
    key = PREFIX + name
    img = bpy.data.images.get(key)
    if img:
        bpy.data.images.remove(img)
    img = bpy.data.images.new(key, w, h, alpha=False, float_buffer=False)
    img.colorspace_settings.name = colorspace
    out = np.ones((h, w, 4), np.float32)
    out[..., :3] = np.round(np.clip(rgb, 0, 1) * 255) / 255
    img.pixels.foreach_set(out.ravel())
    path = TMP / f"nox-near-{name}.png"
    img.filepath_raw = str(path)
    img.file_format = "PNG"
    img.save()
    img.source = "FILE"
    img.filepath = str(path)
    img.reload()
    img.colorspace_settings.name = colorspace
    return img


def lightmap(name, images):
    """Irradiance as the page reads it: pi times the diffuse light Cycles baked (direct, then
    the bounce), times the occlusion, over INTENSITY and sRGB-encoded in an 8-bit image. Returns
    the image and the irradiance."""
    direct, indirect, ao = (pixels(images[s]) for s in STEPS)
    covered = direct[..., 3] > 0
    occlusion = 1 - AO_STRENGTH * (1 - ao[..., :1])
    irradiance = math.pi * (direct[..., :3] + indirect[..., :3]) * occlusion
    irradiance = fill_gaps(irradiance, covered)
    v = np.clip(irradiance / INTENSITY, 0, 1)
    srgb = np.where(v <= 0.0031308, v * 12.92, 1.055 * np.power(v, 1 / 2.4) - 0.055)
    img = save_png(name, srgb, "sRGB")
    stats = irradiance[covered]
    print(f"{name}: irradiance up to {stats.max():.2f}, median {np.median(stats):.3f}, {(stats > INTENSITY).mean():.2%} over the encoding")
    return img, irradiance


def stage_vectors(v):
    """Blender (x, y, z) as stage (x, z, -y)."""
    return np.stack([v[..., 0], v[..., 2], -v[..., 1]], -1)


def relief_map(name, atlas, irradiance):
    """The relief map beside a lightmap. Per texel, at its baked position and normal, the glyph and
    lava lights as three has them (colour times intensity, 1 / max(d^2, 0.01), times the cutoff
    window) and the fill: the sum of their directions weighted by luminance is the main direction,
    and its length their strength along it. Where the bake had less light than these lights give
    the surface unshadowed (shadow, occlusion), the strength is scaled down to match."""
    position, normal = (pixels(STATE["geometry"][atlas][what]) for what in GEOMETRY)
    covered = position[..., 3] > 0
    # Texels the bake only partly reached (island edges, margins) hold their value times alpha.
    p = stage_vectors((position[..., :3] / np.maximum(position[..., 3:], 1e-6) * 2 - 1) * POSITION_RANGE)[covered]
    n = stage_vectors(normal[..., :3] / np.maximum(normal[..., 3:], 1e-6) * 2 - 1)[covered]
    n /= np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-6)
    lum = np.array(LUMINANCE)
    lights = STATE["lights"]
    fill = np.array(lights["fill"]["position"], float)
    fill /= np.linalg.norm(fill)
    fill_colour = np.array(linear(lights["fill"]["color"])) * lights["fill"]["intensity"]
    plain = np.outer(np.clip(n @ fill, 0, None), fill_colour)
    toward = np.tile(fill * (fill_colour @ lum), (len(p), 1))
    for light in lights["glyph"] + lights["lava"] + lights["back"]:
        to = np.array(light["position"], float) - p
        d = np.linalg.norm(to, axis=1)
        l = to / np.maximum(d, 1e-4)[:, None]
        window = np.clip(1 - (d / light["distance"]) ** 4, 0, 1) ** 2
        c = np.array(linear(light["color"])) * light["intensity"]
        weight = window / np.maximum(d * d, 0.01)
        plain += np.outer(weight * np.clip(np.sum(n * l, 1), 0, None), c)
        toward += l * (weight * (c @ lum))[:, None]
    length = np.linalg.norm(toward, axis=1)
    strength = length * np.minimum((irradiance[covered] @ lum) / np.maximum(plain @ lum, 1e-4), 1)
    v = np.zeros(covered.shape + (3,), np.float32)
    v[covered] = toward / np.maximum(length, 1e-9)[:, None] * (strength / (strength + RELIEF_SCALE))[:, None]
    v = fill_gaps(v, covered)
    print(f"{name}: relief strength up to {strength.max():.2f}, median {np.median(strength):.3f}")
    return save_png(name, v * 0.5 + 0.5, "Non-Color")


def atlas_quad(coll, name, image, relief):
    """A small quad whose material carries a lightmap as its emissive map and its relief map as
    its normal map, for the page to find. An earlier run's quad is replaced."""
    old = bpy.data.objects.get(PREFIX + name)
    if old:
        old_mesh = old.data
        bpy.data.objects.remove(old)
        if old_mesh.users == 0:
            bpy.data.meshes.remove(old_mesh)
    me = bpy.data.meshes.new(PREFIX + name)
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=0.01)
    uv = bm.loops.layers.uv.verify()
    for f in bm.faces:
        for loop in f.loops:
            loop[uv].uv = (loop.vert.co.x * 50 + 0.5, loop.vert.co.y * 50 + 0.5)
    bm.to_mesh(me)
    bm.free()
    m = bpy.data.materials.get(PREFIX + name) or bpy.data.materials.new(PREFIX + name)
    m.use_nodes = True
    nodes, links = m.node_tree.nodes, m.node_tree.links
    nodes.clear()
    out = nodes.new("ShaderNodeOutputMaterial")
    bsdf = nodes.new("ShaderNodeBsdfPrincipled")
    links.new(bsdf.outputs[0], out.inputs["Surface"])
    tex = nodes.new("ShaderNodeTexImage")
    tex.image = image
    links.new(tex.outputs["Color"], bsdf.inputs["Emission Color"])
    bsdf.inputs["Emission Strength"].default_value = 1.0
    relief_tex = nodes.new("ShaderNodeTexImage")
    relief_tex.image = relief
    normal_map = nodes.new("ShaderNodeNormalMap")
    links.new(relief_tex.outputs["Color"], normal_map.inputs["Color"])
    links.new(normal_map.outputs["Normal"], bsdf.inputs["Normal"])
    me.materials.append(m)
    ob = bpy.data.objects.new(PREFIX + name, me)
    coll.objects.link(ob)
    return ob


# Blender space as stage space: stage (x, y, z) is Blender (x, -z, y), so a matrix M in Blender is
# STAGE @ M @ STAGE.transposed() on the page (the exported pieces' own frames turn the same way).
STAGE = Matrix(((1, 0, 0, 0), (0, 0, 1, 0), (0, -1, 0, 0), (0, 0, 0, 1)))


def stage_elements(matrix):
    """A Blender world matrix in stage space, column-major as three's Matrix4.elements."""
    m = STAGE @ matrix @ STAGE.transposed()
    return [m[row][col] for col in range(4) for row in range(4)]


def record():
    layout, groups, squares = STATE["layout"], STATE["groups"], STATE["squares"]
    floor_y = layout["floorY"]
    rock_trees = [rock_tree(STATE["placed"]["lod0"][k]) for k, (group, _) in enumerate(groups) if group == "rocks"]
    instances = {"pillars": [], "rocks": [], "corals": []}
    for k, (group, p) in enumerate(groups):
        entry = {"placement": p}
        for level in LEVELS:
            _, sides, spots = squares[level]
            entry[level] = rect(spots[k], sides[k], ATLAS[level])
        # Where the bake stood it (both levels stand alike), for the page to check its own placing.
        # Blender holds matrices in single precision.
        entry["matrix"] = stage_elements(STATE["placed"]["lod0"][k].matrix_world)
        if group == "corals":
            x, _, z = p["position"]
            entry["restsOn"] = coral_rest(x, z, floor_y, rock_trees)[1]
        instances[group].append(entry)
    return {
        "intensity": INTENSITY,
        "atlases": {"lod0": "lightmap_lod0", "lod1": "lightmap_lod1", "seabed": "lightmap_seabed"},
        "instances": instances,
        "seabed": {**SEABED, "samples": seabed_samples(layout["floorY"])},
        "lights": STATE["lights"],
        "relief": {"scale": RELIEF_SCALE, "encoding": "per texel (v + 1) / 2 for v along the glyph, lava and fill light's main direction (stage space), |v| = s / (s + scale) for its luminance s along it; linear, 8 bits; KTX2 UASTC"},
        "spill": SPILL,
        "lavaRise": LAVA_RISE,
        "backRise": BACK_RISE,
        "settings": {
            "atlas": {"lod0": ATLAS["lod0"], "lod1": ATLAS["lod1"], "seabed": list(SEABED_SIZE)},
            "texelsPerUnit": {level: round(squares[level][0], 2) for level in LEVELS},
            "samples": SAMPLES,
            "bounces": BOUNCES,
            "ao": {"distance": AO_DISTANCE, "strength": AO_STRENGTH},
            "margin": MARGIN,
            "pointRadius": POINT_RADIUS,
            "shadows": SHADOWS,
            "cookieMean": COOKIE_MEAN,
            "encoding": "irradiance / intensity, sRGB, 8 bits; KTX2 UASTC",
            "device": STATE["device"],
            "blender": bpy.app.version_string,
        },
    }


def finish():
    """The lightmaps from the bakes, then near.glb: exported, recorded and compressed."""
    t0 = time.time()
    colls, images = STATE["colls"], STATE["images"]
    for level in ("lod0", "lod1", "seabed"):
        image, irradiance = lightmap(f"lightmap_{level}", images[level])
        relief = relief_map(f"relief_{level}", f"atlas_{level}", irradiance)
        atlas_quad(colls[PIECES], f"lightmap_{level}", image, relief)
    bake_record = record()
    with in_scene():
        KIT.export(colls[PIECES], RAW)

    def add_record(doc):
        doc["scenes"][doc.get("scene", 0)].setdefault("extras", {})["nox_bake"] = bake_record
    KIT.edit_glb_json(RAW, add_record)
    raw = RAW.stat().st_size
    # Lightmaps are smooth gradients: UASTC keeps them (ETC1S, gltf-transform's default for an
    # emissive map, bands them); the relief maps, as normal maps, are encoded linear (a pass of
    # their own: a slot pattern with a comma does not reach gltf-transform intact on Windows). Then
    # meshopt, as for the kit; optimize leaves KTX2 textures be.
    uastc = ("--level", 2, "--rdo", "--rdo-multithreading", "false", "--zstd", 18)
    KIT.gltf_transform("uastc", RAW, UASTC, "--slots", "emissiveTexture", *uastc)
    KIT.gltf_transform("uastc", UASTC, UASTC, "--slots", "normalTexture", *uastc)
    KIT.compress(UASTC, NEAR)
    print(f"exported {NEAR}: {raw} bytes raw, {NEAR.stat().st_size} bytes compressed, in {time.time() - t0:.1f} s")


def main():
    setup()
    for level in LEVELS:
        for step in STEPS:
            bake(level, step)
        bake_geometry(level)
    finish()


if __name__ == "__main__":
    main()
