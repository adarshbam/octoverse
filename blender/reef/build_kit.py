"""The OctoVerse host's reef kit (platform spec 7.7): a ruined gateway of dark blocky masonry with
ember-lit windows, a violet-blue membrane and the octopus-logo glyph; dark seabed rocks; magenta and
orange branching coral; and eight thin glass portfolio cards (scenery, never interface). Every placed
piece also comes as `<piece>_lod1` (a lighter copy for far use). Everything is built by this script
from its seeds; nothing is hand-modelled and nothing is random between runs.

Run in Blender 5.2, from a shell (Blender is not on PATH on this machine):
    "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b -P blender/reef/build_kit.py
With no arguments it writes public/octoverse/world/reef/kit.glb and, beside it, kit.nodes.json (the
node list the layout test and the world config read). An optional `-- <path.glb>` writes the kit
elsewhere (kit.nodes.json goes beside it).

It rebuilds the "OctoReefKit" scene from scratch and touches nothing outside it. It reads the
world's layout, src/worlds/octoverse/place/layout.json (the same file the page imports), checks
that every piece the layout names is built, exports the pieces and compresses them with
gltf-transform (meshopt geometry, the one the engine's kit loader decodes).

Units: 1 = one stage unit. Placed pieces stand on z = 0 at the origin with their fronts looking down
-Y, which glTF's Y-up export turns into +Z, toward the stage camera. The gate's three other nodes
share the arch's frame (origin at the middle of the doorway's foot, as `arch` in Veyra's vault
kit), so the world attaches them to `gate_arch` (kit.attached) and each is drawn with every
placement of the arch. `gate_membrane` carries two UV sets (UV0 planar, UV1 the flow map: u round
the doorway's edge, v from 0 at the edge to 1 at the middle) for the membrane material, and
`gate_glyph` is the octopus-logo glyph, a separate node on the `'emissive'` prop drive (its material
has a lavender emissive colour). The cards are centred on their origin (they float), face -Y and
are each their own node, so each can bob on its own phase.

Each placed piece carries its bounding radius on the XZ plane as the node extra `radius` (about the
origin, which is the placement point), for the layout tests.

The gate's size and place are fitted to P1: at depth z = -8 the stage camera (z = 12) shows the
world at 12 / 20 = 0.6 of its size; the arch is placed at scale 1.763, so its membrane (1.04 wide,
2.22 tall here) spans about x +0.95 to +2.05 and y -1.35 to +1.0 in P1's frame (spec 2.2).
"""
import json
import math
import os
import random
import struct
import subprocess
import sys
import tempfile
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector, noise
from mathutils.bvhtree import BVHTree

try:
    ROOT = Path(__file__).resolve().parents[2]
except NameError:  # exec() without __file__
    ROOT = Path.cwd()
LAYOUT = ROOT / "src/worlds/octoverse/place/layout.json"
DEFAULT_OUT = ROOT / "public/octoverse/world/reef/kit.glb"
URL = "/octoverse/world/reef/kit.glb"
# This run's own temporary file (its process id): two builds at once never write the same one.
RAW = Path(tempfile.gettempdir()) / f"octoverse-kit-reef-raw-{os.getpid()}.glb"

SCENE = "OctoReefKit"
PIECES = "OctoReefKit pieces"  # exported
# Blender names must be unique in the file; the prefix is stripped from the exported node names.
PREFIX = "reef."
LOD1 = "_lod1"

# gltf-transform needs KTX-Software's `ktx` on the PATH when asked for KTX2 textures (the kit has
# none, the page makes its own maps); the default install folder is added, or set KTX_SOFTWARE_BIN.
TEXTURE_COMPRESS = "ktx2"
KTX_BIN = os.environ.get("KTX_SOFTWARE_BIN", r"C:\Program Files\KTX-Software\bin")
# gltf-transform optimize defaults that would break what the page reads: flatten and join would merge
# the pieces into a few anonymous meshes (the page finds pieces and props by node name); palette would
# rewrite the UVs; prune-attributes would drop the membrane's second UV set; simplify would change the
# authored LODs; instance would share meshes between nodes.
KEEP_STRUCTURE = [
    "--flatten", "false", "--join", "false", "--instance", "false", "--palette", "false",
    "--simplify", "false", "--prune-attributes", "false",
]

GATE = "gate_arch"
GATE_NODES = ["gate_windows", "gate_membrane", "gate_glyph"]  # share the arch's frame
ROCKS = ["rock_a", "rock_b", "rock_c", "rock_d"]
CORALS = ["coral_magenta_a", "coral_magenta_b", "coral_magenta_c", "coral_orange_a", "coral_orange_b"]
CARD_KINDS = ["picture", "list", "profile", "picture", "picture", "list", "profile", "list"]
CARDS = [f"card_glass_{i + 1:02d}" for i in range(len(CARD_KINDS))]
PLACED = [GATE, *ROCKS, *CORALS, *CARDS]

JOINT = 0.022  # the dark gap between neighbouring stones
BEVEL = 0.03

# The doorway: its half width, the height of its spring (where the round head begins), the foot of
# the membrane above the floor, and the gap the membrane keeps from the stone.
HALF = 0.55
SPRING = 1.82
FOOT = 0.12
INSET = 0.03
# The gate's depth: front face, the doorway's back wall (the membrane stands just before it) and back face.
FRONT, BACK_WALL, BACK = -0.34, 0.16, 0.34
HEAD_OUTER = 0.98  # the round head's outer radius


# --- Scene -------------------------------------------------------------------------------------

def kit_scene():
    """The kit's own scene and its collection, emptied of what an earlier run made."""
    scene = bpy.data.scenes.get(SCENE) or bpy.data.scenes.new(SCENE)
    coll = bpy.data.collections.get(PIECES) or bpy.data.collections.new(PIECES)
    if scene.collection.children.get(PIECES) is None:
        scene.collection.children.link(coll)
    for ob in list(coll.objects):
        bpy.data.objects.remove(ob, do_unlink=True)
    for data in list(bpy.data.meshes):
        if data.name.startswith(PREFIX) and data.users == 0:
            bpy.data.meshes.remove(data)
    return scene, coll


def material(name, rgb, rough=0.85, metal=0.0, emit=None):
    m = bpy.data.materials.get(PREFIX + name) or bpy.data.materials.new(PREFIX + name)
    m.use_nodes = True
    bsdf = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Base Color"].default_value = (*rgb, 1.0)
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    bsdf.inputs["Emission Color"].default_value = (*(emit or (0.0, 0.0, 0.0)), 1.0)
    bsdf.inputs["Emission Strength"].default_value = 1.0 if emit else 0.0
    return m


def box_uvs(bm, offset=None):
    """Box projection: each face takes UVs from the plane its normal faces most (1 UV = 1 unit).
    `offset` maps a face to a UV shift, so each stone shows its own patch of grain."""
    uv = bm.loops.layers.uv.verify()
    bm.normal_update()
    for f in bm.faces:
        n = f.normal
        axis = max(range(3), key=lambda k: abs(n[k]))
        du, dv = offset(f) if offset else (0.0, 0.0)
        for loop in f.loops:
            c = loop.vert.co
            u, v = (c.y, c.z) if axis == 0 else (c.x, c.z) if axis == 1 else (c.x, c.y)
            loop[uv].uv = (u + du, v + dv)


def to_object(name, bm, coll, mat=None, smooth=False):
    me = bpy.data.meshes.new(PREFIX + name)
    bm.to_mesh(me)
    bm.free()
    if smooth is not None:
        for p in me.polygons:
            p.use_smooth = smooth
    ob = bpy.data.objects.new(PREFIX + name, me)
    coll.objects.link(ob)
    if mat:
        me.materials.append(mat)
    return ob


def smoothstep(a, b, x):
    t = max(0.0, min(1.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def bake_ao(ob, rays=16, reach=0.9, strength=1.0, seed=7, floor=0.18):
    """Ambient occlusion per vertex (stored as the Col colour attribute): seams and hollows darken."""
    me = ob.data
    rng = random.Random(seed)
    tree = BVHTree.FromPolygons([v.co.copy() for v in me.vertices], [tuple(p.vertices) for p in me.polygons], all_triangles=False)
    dirs = []
    for _ in range(rays):  # cosine-weighted directions over the +Z hemisphere
        u, w = rng.random(), rng.random()
        r, th = math.sqrt(u), 2 * math.pi * w
        dirs.append(Vector((r * math.cos(th), r * math.sin(th), math.sqrt(max(0.0, 1 - u)))))
    attr = me.color_attributes.get("Col") or me.color_attributes.new("Col", "FLOAT_COLOR", "POINT")
    up = Vector((0, 0, 1))
    for i, v in enumerate(me.vertices):
        n = v.normal
        rot = up.rotation_difference(n).to_matrix()
        origin = v.co + n * 0.004
        hit = 0.0
        for d in dirs:
            loc, _, _, dist = tree.ray_cast(origin, rot @ d, reach)
            if loc is not None:
                hit += 1.0 - dist / reach
        ao = max(floor, 1.0 - strength * hit / rays)
        attr.data[i].color = (ao, ao, ao, 1.0)
    me.color_attributes.active_color = attr
    me.color_attributes.default_color_name = attr.name


def triangles(ob):
    return sum(len(p.vertices) - 2 for p in ob.data.polygons) if ob.type == "MESH" else 0


def radius_xy(ob):
    """How far the piece reaches from its origin on the ground plane (stage XZ)."""
    return max(math.hypot(v.co.x, v.co.y) for v in ob.data.vertices)


def bounds_gltf(ob):
    """The object's bounding box in glTF axes (x right, y up, z toward the camera): Blender (x, y, z) is glTF (x, z, -y)."""
    pts = [(v.co.x, v.co.z, -v.co.y) for v in ob.data.vertices]
    return {"min": [round(min(p[k] for p in pts), 4) for k in range(3)], "max": [round(max(p[k] for p in pts), 4) for k in range(3)]}


# --- Stone: hulls, chipped and rounded --------------------------------------------------------

def hull_block(bm_out, points, seed, detail, chips=(1, 3), chip_depth=(0.04, 0.12), bevel=BEVEL, gap=JOINT, jitter=0.0):
    """Adds one stone to `bm_out`: the convex hull of `points`, shrunk by half a joint on each axis,
    knocked-off corners, rounded edges (three segments at full detail, one flat chamfer at lod1) and
    a little wear along the edges. `jitter` moves each point by up to that share of the stone's size
    first, so a block is not a perfect box."""
    rng = random.Random(seed)
    centre = sum(points, Vector()) / len(points)
    ext = [max(p[k] for p in points) - min(p[k] for p in points) for k in range(3)]
    if jitter:
        points = [Vector([p[k] + rng.uniform(-jitter, jitter) * ext[k] for k in range(3)]) for p in points]
        centre = sum(points, Vector()) / len(points)
    pts = [centre + Vector([(p[k] - centre[k]) * (1 - gap / ext[k] if ext[k] > gap * 4 else 1.0) for k in range(3)]) for p in points]
    bm = bmesh.new()
    verts = [bm.verts.new(p) for p in pts]
    bmesh.ops.convex_hull(bm, input=verts, use_existing_faces=False)
    bmesh.ops.dissolve_limit(bm, angle_limit=math.radians(1.5), verts=bm.verts[:], edges=bm.edges[:])
    half = Vector([e / 2 for e in ext])
    for _ in range(rng.randint(*chips)):
        corner = Vector((rng.choice((-1, 1)), rng.choice((-1, 1)), rng.choice((-1, 1))))
        depth = rng.uniform(*chip_depth) * min(1.0, min(ext) / 0.5 + 0.4)
        slant = Vector((corner.x * rng.uniform(0.7, 1.3), corner.y * rng.uniform(0.7, 1.3), corner.z * rng.uniform(0.7, 1.3))).normalized()
        tip = centre + Vector((corner.x * half.x, corner.y * half.y, corner.z * half.z))
        cut = bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], dist=1e-5, plane_co=tip - slant * depth, plane_no=slant, clear_outer=True)
        rim = [e for e in cut["geom_cut"] if isinstance(e, bmesh.types.BMEdge)]
        if rim:
            bmesh.ops.holes_fill(bm, edges=rim, sides=0)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    sharp = [e for e in bm.edges if e.is_manifold and e.calc_face_angle(0) > math.radians(25)]
    rounded = bmesh.ops.bevel(bm, geom=sharp, offset=min(bevel, min(ext) / 6), segments=3 if detail == 0 else 1, profile=0.5, affect="EDGES", clamp_overlap=True)
    for f in rounded["faces"]:  # the cut faces shade flat; only the rounded edges between them shade smooth
        f.smooth = True
    bm.normal_update()
    off = Vector((seed * 3.7, seed * 1.3, seed * 5.1))
    for v in bm.verts:  # wear: the stone gives a little along its edges
        dent = max(0.0, noise.noise(v.co * 5.0 + off)) * 0.014 + noise.noise(v.co * 13.0 + off) * 0.003
        v.co -= v.normal * dent
    uv_shift = (rng.uniform(0, 7), rng.uniform(0, 7))
    box_uvs(bm, offset=lambda f: uv_shift)
    me = bpy.data.meshes.new(PREFIX + "block")
    bm.to_mesh(me)
    bm.free()
    bm_out.from_mesh(me)  # appends: repeated calls join the stones
    bpy.data.meshes.remove(me)


def box(x0, x1, y0, y1, z0, z1):
    return [Vector((x, y, z)) for x in (x0, x1) for y in (y0, y1) for z in (z0, z1)]


def stone_piece(name, coll, mat, boxes, seed, detail, ao_reach=0.45, **stone):
    """A piece made of stones, each from `boxes` (lists of 8 points) or a plain [x0..z1] box; one mesh."""
    bm = bmesh.new()
    for k, b in enumerate(boxes):
        hull_block(bm, b if isinstance(b[0], Vector) else box(*b), seed * 100 + k, detail, **stone)
    ob = to_object(name, bm, coll, mat, smooth=None)
    bake_ao(ob, rays=12 if detail else 16, reach=ao_reach, strength=1.25, seed=seed)
    return ob


# --- The gate ----------------------------------------------------------------------------------

def arch_design(seed):
    """The stones of the gate in its own frame: plinths and threshold, jamb courses to the spring,
    the voussoirs of the round head, spandrel courses and a header that breaks down toward the right,
    fallen blocks at its foot and the back wall the doorway is recessed into. Also the ember windows:
    small boxes set on the front of chosen stones (the second list). Returns (stones, windows)."""
    rng = random.Random(seed)
    out = []
    sites = []  # stones whose front face is big enough for a window
    out.append((-1.3, -0.5, FRONT - 0.1, BACK + 0.1, 0.0, 0.2))
    out.append((0.5, 1.3, FRONT - 0.1, BACK + 0.1, 0.0, 0.2))
    out.append((-HALF, HALF, FRONT, BACK, 0.0, 0.1))  # the threshold
    for side in (-1, 1):
        z = 0.2
        while z < SPRING - 0.05:
            h = rng.uniform(0.34, 0.5)
            if SPRING - (z + h) < 0.25:
                h = SPRING - z
            outer = rng.uniform(HEAD_OUTER - 0.1, HEAD_OUTER + 0.02)
            x0, x1 = sorted((side * HALF, side * outer))
            out.append((x0, x1, FRONT, BACK, z, z + h))
            if h > 0.36 and x1 - x0 > 0.3:
                sites.append(out[-1])
            z += h
    # The round head: voussoirs about (0, SPRING), inner radius HALF, outer a little under 1.
    n = 9
    for i in range(n):
        a0, a1 = math.pi * i / n, math.pi * (i + 1) / n
        ro = rng.uniform(HEAD_OUTER - 0.08, HEAD_OUTER + 0.02)
        pts = []
        for a in (a0, a1):
            for r in (HALF, ro):
                for y in (FRONT, BACK):
                    pts.append(Vector((r * math.cos(a), y, SPRING + r * math.sin(a))))
        out.append(pts)
    # Spandrels: courses from the spring up between the head and the pier line, broken lower on the right.
    for side in (-1, 1):
        top = 3.05 if side < 0 else 2.55
        z = SPRING
        while z < top - 0.05:
            h = min(rng.uniform(0.3, 0.42), top - z)
            reach = math.sqrt(max(0.0, HEAD_OUTER ** 2 - (z + h - SPRING) ** 2))
            x0, x1 = sorted((side * (max(reach, 0.2) - 0.05), side * 1.12))
            if abs(x1 - x0) > 0.12:
                out.append((x0, x1, FRONT, BACK, z, z + h))
                if h > 0.33 and abs(x1 - x0) > 0.28:
                    sites.append(out[-1])
            z += h
    # The header over the head, taller on the left, one stone lost on the right.
    out.append((-1.1, -0.35, FRONT, BACK, 2.85, 3.2))
    out.append((-0.35, 0.55, FRONT, BACK, 2.85, 3.1))
    out.append((-0.95, -0.4, FRONT, BACK, 3.2, 3.5))
    out.append((0.55, 1.05, FRONT, BACK, 2.85, 3.05))
    # Fallen blocks at the foot, and the wall at the back of the doorway (the membrane stands just before it).
    out.append((1.25, 1.85, FRONT - 0.4, FRONT + 0.2, 0.0, 0.28))
    out.append((-1.9, -1.35, FRONT - 0.3, FRONT + 0.45, 0.0, 0.2))
    out.append((0.9, 1.4, FRONT - 0.7, FRONT - 0.1, 0.0, 0.14))
    out.append((-HALF - 0.25, HALF + 0.25, BACK_WALL, BACK, 0.0, SPRING + 0.45))
    # Windows: about half of the sites, then enough more to make eight at least.
    chosen = [s for s in sites if rng.random() < 0.55]
    for s in sites:
        if len(chosen) >= 8:
            break
        if s not in chosen:
            chosen.append(s)
    windows = []
    for (x0, x1, _, _, z0, z1) in chosen:
        cx = (x0 + x1) / 2 + rng.uniform(-0.03, 0.03)
        cz = (z0 + z1) / 2 + rng.uniform(-0.02, 0.02)
        w, h = rng.uniform(0.09, 0.12), rng.uniform(0.14, 0.2)
        windows.append((cx - w / 2, cx + w / 2, FRONT - 0.02, FRONT + 0.03, cz - h / 2, cz + h / 2))
    return out, windows


def build_arch(name, coll, mats, detail):
    stones, _ = arch_design(3)
    return stone_piece(name, coll, mats["stone"], stones, 3, detail, ao_reach=0.5, chips=(1, 3), chip_depth=(0.04, 0.1), jitter=0.02)


def build_windows(name, coll, mats):
    """The ember windows: small boxes on the front of chosen stones, in the arch's frame. They glow in the kit's material."""
    _, windows = arch_design(3)
    bm = bmesh.new()
    for w in windows:
        bmesh.ops.convex_hull(bm, input=[bm.verts.new(p) for p in box(*w)], use_existing_faces=False)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    box_uvs(bm)
    return to_object(name, bm, coll, mats["window"], smooth=False)


def door_outline(inset, count=72):
    """The doorway's edge in gate space, a closed loop of (x, z) round from the bottom middle, sampled evenly by length."""
    half = HALF - inset
    legs = SPRING - FOOT
    arc = math.pi * half
    total = 2 * legs + arc + 2 * half
    pts = []
    for i in range(count):
        s = total * i / count
        if s < half:
            pts.append((s, FOOT))
        elif s < half + legs:
            pts.append((half, FOOT + (s - half)))
        elif s < half + legs + arc:
            a = (s - half - legs) / half
            pts.append((half * math.cos(a), SPRING + half * math.sin(a)))
        elif s < half + 2 * legs + arc:
            pts.append((-half, SPRING - (s - half - legs - arc)))
        else:
            pts.append((-half + (s - half - 2 * legs - arc), FOOT))
    return pts


def build_membrane(name, coll, mats, rings=8):
    """The doorway's plane: rings shrinking from the doorway's edge to its middle. UV0 is planar
    (0..1 across and up the doorway), UV1 the flow map: u round the edge (0..1), v from 0 at the
    edge to 1 at the middle."""
    outline = door_outline(INSET)
    count = len(outline)
    top = SPRING + HALF - INSET
    centre = Vector((0.0, (FOOT + top) / 2))
    bm = bmesh.new()
    uv0 = bm.loops.layers.uv.new("UVMap")
    uv1 = bm.loops.layers.uv.new("Flow")
    y = BACK_WALL - 0.05
    ring_verts = []
    for k in range(rings):
        t = k / rings
        ring_verts.append([bm.verts.new((centre.x + (x - centre.x) * (1 - t), y, centre.y + (z - centre.y) * (1 - t))) for (x, z) in outline])
    hub = bm.verts.new((centre.x, y, centre.y))
    width, height = 2 * (HALF - INSET), top - FOOT

    def planar(co):
        return ((co.x + (HALF - INSET)) / width, (co.z - FOOT) / height)

    def face(verts, flow):
        f = bm.faces.new(verts)
        for loop, (u, v) in zip(f.loops, flow):
            loop[uv0].uv = planar(loop.vert.co)
            loop[uv1].uv = (u, v)

    for k in range(rings):
        for i in range(count):
            j = (i + 1) % count
            u0, u1 = i / count, (i + 1) / count
            v0, v1 = k / rings, (k + 1) / rings
            if k < rings - 1:
                face([ring_verts[k][i], ring_verts[k][j], ring_verts[k + 1][j], ring_verts[k + 1][i]], [(u0, v0), (u1, v0), (u1, v1), (u0, v1)])
            else:
                face([ring_verts[k][i], ring_verts[k][j], hub], [(u0, v0), (u1, v0), ((u0 + u1) / 2, 1.0)])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    if bm.faces[0].normal.y > 0:  # faces look down -Y, toward the stage camera
        bmesh.ops.reverse_faces(bm, faces=bm.faces)
    return to_object(name, bm, coll, mats["membrane"], smooth=False)


def seg_hull(bm, a, b, width, y0, y1, origin):
    """A straight stroke from (u, v) a to b of the given width and depth, as a convex hull; `origin` is the glyph's (x, z) centre."""
    du, dv = b[0] - a[0], b[1] - a[1]
    length = math.hypot(du, dv)
    if length < 1e-6:
        return
    nu, nv = -dv / length * width / 2, du / length * width / 2
    pts = []
    for (u, v) in (a, b):
        for s in (-1, 1):
            for y in (y0, y1):
                pts.append(bm.verts.new((origin[0] + u + s * nu, y, origin[1] + v + s * nv)))
    bmesh.ops.convex_hull(bm, input=pts, use_existing_faces=False)


def stroke(bm, pts, width, y0, y1, origin, closed=False):
    pairs = list(zip(pts, pts[1:] + ([pts[0]] if closed else [])))
    for a, b in pairs:
        seg_hull(bm, a, b, width, y0, y1, origin)


def ellipse(cx, cy, rx, ry, rot, count):
    c, s = math.cos(rot), math.sin(rot)
    out = []
    for i in range(count):
        a = 2 * math.pi * i / count
        x, y = rx * math.cos(a), ry * math.sin(a)
        out.append((cx + x * c - y * s, cy + x * s + y * c))
    return out


def build_glyph(name, coll, mats):
    """The OctoVerse octopus-logo glyph (P1: a line-drawn octopus whose head holds an atom's orbits):
    strokes about 0.03 thick, on the doorway's middle, just before the membrane. Faces -Y."""
    top = SPRING + HALF - INSET
    origin = (0.0, (FOOT + top) / 2 + 0.03)
    y1 = BACK_WALL - 0.05 - 0.012  # just before the membrane
    y0 = y1 - 0.016
    bm = bmesh.new()
    cy = 0.12
    stroke(bm, ellipse(0.0, cy, 0.2, 0.19, 0.0, 44), 0.032, y0, y1, origin, closed=True)  # the head
    for rot in (0.0, math.pi / 3, -math.pi / 3):  # the atom's orbits
        stroke(bm, ellipse(0.0, cy, 0.135, 0.05, rot, 30), 0.014, y0, y1, origin, closed=True)
    stroke(bm, ellipse(0.0, cy, 0.026, 0.026, 0.0, 10), 0.03, y0, y1, origin, closed=True)  # the nucleus
    # Seven tentacles from the head's underside, curling outward at the tips.
    for i in range(7):
        phi = math.pi * (1.17 + 0.66 * i / 6)
        px, py = 0.2 * math.cos(phi), cy + 0.19 * math.sin(phi)
        side = 1.0 if px > 0.01 else -1.0 if px < -0.01 else 0.0
        heading = math.atan2(math.sin(phi) * 0.3 - 1.0, math.cos(phi) * 0.35)  # leaving the head, bent hard toward down
        length = 0.46 - 0.025 * abs(i - 3)
        steps = 16
        pts = [(px, py)]
        for k in range(steps):
            t = k / steps
            heading += side * (0.55 + 9.5 * t * t) * (length / steps)
            px += math.cos(heading) * length / steps
            py += math.sin(heading) * length / steps
            pts.append((px, py))
        stroke(bm, pts, 0.03 * (1.0 - 0.3 * (abs(i - 3) / 3)), y0, y1, origin)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    box_uvs(bm)
    return to_object(name, bm, coll, mats["glyph"], smooth=False)


# --- Rocks, coral -----------------------------------------------------------------------------

def build_rock(name, coll, seed, scale, mats, detail):
    """A craggy boulder: noise and cell facets on a sphere, its underside flattened to sit.
    `detail` is the icosphere's subdivision; one step less is a quarter of the triangles."""
    rng = random.Random(seed)
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=detail, radius=1.0)
    off = Vector((rng.uniform(0, 90), rng.uniform(0, 90), rng.uniform(0, 90)))
    for v in bm.verts:
        p = v.co.normalized()
        n = noise.fractal(p * 1.15 + off, 0.55, 2.0, 5)
        dist, _ = noise.voronoi(p * 2.1 + off)
        facet = min(dist[1] - dist[0], 0.5)
        crag = noise.fractal(p * 3.2 + off * 0.5, 0.8, 2.0, 3)
        v.co = p * (1.0 + 0.3 * n + 0.28 * facet + 0.03 * crag)
        if v.co.z < -0.3:
            v.co.z = -0.3 + (v.co.z + 0.3) * 0.15
    bmesh.ops.scale(bm, vec=Vector(scale), verts=bm.verts)
    box_uvs(bm)
    ob = to_object(name, bm, coll, mats["rock"], smooth=True)
    bake_ao(ob, reach=0.5 * max(scale), strength=1.3, seed=seed)
    return ob


def skin_object(name, coll, verts, edges, radii, smooth_levels):
    """A skeleton thickened by the Skin modifier (radius per vertex), smoothed, baked into the mesh."""
    me = bpy.data.meshes.new(PREFIX + name)
    me.from_pydata([tuple(v) for v in verts], edges, [])
    me.update()
    ob = bpy.data.objects.new(PREFIX + name, me)
    coll.objects.link(ob)
    ob.modifiers.new("Skin", "SKIN")
    sv = me.skin_vertices[0].data
    for k, r in enumerate(radii):
        sv[k].radius = (r, r)
    sv[0].use_root = True
    if smooth_levels:
        ob.modifiers.new("Smooth", "SUBSURF").levels = smooth_levels
    deps = bpy.context.evaluated_depsgraph_get()
    baked = bpy.data.meshes.new_from_object(ob.evaluated_get(deps))
    ob.modifiers.clear()
    ob.data = baked
    bpy.data.meshes.remove(me)
    baked.name = PREFIX + name
    for p in baked.polygons:
        p.use_smooth = True
    return ob


def glow_by_height(ob, floor=0.32, power=1.4):
    """Colour by height (Col): a dim base, glowing tips."""
    me = ob.data
    top = max(v.co.z for v in me.vertices) or 1.0
    attr = me.color_attributes.new("Col", "FLOAT_COLOR", "POINT")
    for i, v in enumerate(me.vertices):
        g = floor + (1 - floor) * max(0.0, v.co.z / top) ** power
        attr.data[i].color = (g, g, g, 1.0)
    me.color_attributes.active_color = attr
    me.color_attributes.default_color_name = attr.name


def build_coral(name, coll, seed, mat, size=1.0, smooth_levels=1):
    """Branching coral: a grown skeleton thickened by the Skin modifier, tips brighter (Col)."""
    rng = random.Random(seed)
    verts = [Vector((0, 0, 0))]
    edges = []
    radii = [0.03 * size]

    def grow(i, d, length, r, depth):
        pos = verts[i].copy()
        steps = max(2, int(length / (0.045 * size)))
        for s in range(steps):
            # Wander and rise, staying mostly in one fan-shaped plane (x-z) like a sea fan.
            d = (d + Vector((rng.uniform(-0.25, 0.25), rng.uniform(-0.1, 0.1), rng.uniform(0.0, 0.3))) * 0.4).normalized()
            pos = pos + d * (length / steps)
            verts.append(pos.copy())
            edges.append((i, len(verts) - 1))
            radii.append(max(r * (1 - 0.3 * (s + 1) / steps), 0.011 * size))
            i = len(verts) - 1
        if depth > 0:
            n = rng.choice((2, 2, 3))
            for k in range(n):
                a = (k - (n - 1) / 2) * rng.uniform(0.55, 0.85) + rng.uniform(-0.2, 0.2)
                nd = (d + Vector((math.sin(a) * 0.9, rng.uniform(-0.15, 0.15), 0.12))).normalized()
                grow(i, nd, length * rng.uniform(0.72, 0.9), radii[i] * 0.8, depth - 1)

    stems = rng.choice((3, 4))
    for k in range(stems):
        a = (k - (stems - 1) / 2) * 0.42 + rng.uniform(-0.12, 0.12)
        grow(0, Vector((math.sin(a), rng.uniform(-0.2, 0.2), math.cos(a))).normalized(), 0.17 * size, 0.026 * size, 3)
    ob = skin_object(name, coll, verts, edges, radii, smooth_levels)
    glow_by_height(ob)
    ob.data.materials.append(mat)
    return ob


# --- Glass cards -------------------------------------------------------------------------------

CARD_W, CARD_H, CARD_D = 1.0, 0.7, 0.03


def rounded_rect(w, h, r, seg):
    """A rounded rectangle's outline, counter-clockwise, as (x, z) points."""
    pts = []
    for cx, cz, a0 in ((w / 2 - r, h / 2 - r, 0.0), (-w / 2 + r, h / 2 - r, 90.0), (-w / 2 + r, -h / 2 + r, 180.0), (w / 2 - r, -h / 2 + r, 270.0)):
        for k in range(seg + 1):
            a = math.radians(a0 + 90.0 * k / seg)
            pts.append((cx + r * math.cos(a), cz + r * math.sin(a)))
    return pts


def circle(cx, cz, r, count):
    return [(cx + r * math.cos(2 * math.pi * i / count), cz + r * math.sin(2 * math.pi * i / count)) for i in range(count)]


def prism(bm, layer, pts, y0, y1, grey):
    """A convex outline of (x, z) points, extruded from y0 to y1 (-Y is the front), each vertex coloured `grey` (Col)."""
    ring0 = [bm.verts.new((x, y0, z)) for (x, z) in pts]
    ring1 = [bm.verts.new((x, y1, z)) for (x, z) in pts]
    for v in ring0 + ring1:
        v[layer] = (grey, grey, grey, 1.0)
    n = len(pts)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((ring0[i], ring0[j], ring1[j], ring1[i]))
    bm.faces.new(ring0)
    bm.faces.new(ring1)


def build_card(name, coll, mats, kind, detail):
    """A thin glass frame: a rounded slab, a darker screen set into its front and a bright icon on it
    (a picture, a list or a profile). Centred on its origin, facing -Y; the colours are the Col attribute."""
    seg = 4 if detail == 0 else 1
    bm = bmesh.new()
    layer = bm.verts.layers.float_color.new("Col")
    front = -CARD_D / 2
    prism(bm, layer, rounded_rect(CARD_W, CARD_H, 0.06, seg), front, CARD_D / 2, 0.8)
    prism(bm, layer, rounded_rect(CARD_W - 0.1, CARD_H - 0.1, 0.035, seg), front - 0.006, front + 0.004, 0.3)
    y0, y1 = front - 0.016, front - 0.004
    ring = 14 if detail == 0 else 8
    if kind == "picture":
        prism(bm, layer, [(-0.3, -0.18), (0.0, -0.18), (-0.17, 0.06)], y0, y1, 1.0)
        prism(bm, layer, [(-0.08, -0.18), (0.29, -0.18), (0.15, 0.09)], y0, y1, 0.85)
        prism(bm, layer, circle(0.2, 0.17, 0.05, ring), y0, y1, 1.0)
    elif kind == "list":
        for i in range(4):
            z = 0.15 - 0.1 * i
            prism(bm, layer, circle(-0.3, z, 0.022, ring), y0, y1, 1.0)
            end = (0.18, 0.08, 0.26, 0.12)[i]
            prism(bm, layer, [(-0.24, z - 0.018), (end, z - 0.018), (end, z + 0.018), (-0.24, z + 0.018)], y0, y1, 0.9)
    else:  # profile
        prism(bm, layer, circle(0.0, 0.08, 0.11, ring + 4), y0, y1, 1.0)
        prism(bm, layer, [(0.22 * math.cos(math.pi * i / 10), -0.2 + 0.22 * math.sin(math.pi * i / 10)) for i in range(11)], y0, y1, 0.9)
    if detail == 0:  # three small window dots in the screen's top left corner
        for i in range(3):
            prism(bm, layer, circle(-0.4 + 0.045 * i, 0.26, 0.014, 8), y0, y1, 0.9)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ob = to_object(name, bm, coll, mats["card"], smooth=False)
    ob.data.color_attributes.active_color = ob.data.color_attributes["Col"]
    ob.data.color_attributes.default_color_name = "Col"
    return ob


# --- The layout --------------------------------------------------------------------------------

def check_layout(built):
    layout = json.loads(LAYOUT.read_text(encoding="utf-8"))
    named = {p["piece"] for group in layout["groups"].values() for p in group}
    if layout["chains"]:
        named.add("chain")
    missing = sorted(named - set(built))
    if missing:
        raise RuntimeError(f"layout.json names pieces the kit does not build: {missing}")
    unplaced = sorted(set(PLACED) - named)
    if unplaced:
        print(f"note: the kit builds pieces the layout does not place: {unplaced}")


# --- Export ------------------------------------------------------------------------------------

def edit_glb_json(path, edit):
    """Rewrites a glb's JSON chunk through `edit(doc)`, keeping its binary chunk."""
    data = bytearray(path.read_bytes())
    json_len = struct.unpack_from("<I", data, 12)[0]
    doc = json.loads(data[20:20 + json_len])
    edit(doc)
    text = json.dumps(doc, separators=(",", ":")).encode("utf-8")
    text += b" " * (-len(text) % 4)
    rest = data[20 + json_len:]
    out = struct.pack("<III", 0x46546C67, 2, 12 + 8 + len(text) + len(rest)) + struct.pack("<II", len(text), 0x4E4F534A) + text + rest
    path.write_bytes(out)


def strip_prefix(path):
    """Drops PREFIX from the glb's node, mesh and material names: the page asks for `gate_arch`, not `reef.gate_arch`."""
    def drop(doc):
        for group in ("nodes", "meshes", "materials"):
            for item in doc.get(group, []):
                if item.get("name", "").startswith(PREFIX):
                    item["name"] = item["name"][len(PREFIX):]
    edit_glb_json(path, drop)


def export(coll):
    RAW.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(RAW),
        collection=coll.name,
        export_format="GLB",
        export_apply=True,
        export_yup=True,
        export_extras=True,
        export_vertex_color="ACTIVE",
        export_materials="EXPORT",
        export_normals=True,
    )
    strip_prefix(RAW)


def gltf_transform(*args):
    """Runs the repo's own gltf-transform (npx --no-install: never a download), with KTX-Software on the PATH for its KTX2 commands."""
    cmd = ["npx", "--no-install", "gltf-transform", *map(str, args)]
    print("gltf-transform:", " ".join(cmd))
    env = dict(os.environ)
    if os.path.isdir(KTX_BIN):
        env["PATH"] = KTX_BIN + os.pathsep + env.get("PATH", "")
    try:
        subprocess.run(cmd, cwd=ROOT, env=env, check=True, shell=os.name == "nt", capture_output=True, text=True)
    except (OSError, subprocess.CalledProcessError) as error:
        detail = getattr(error, "stderr", "") or error
        raise RuntimeError(f"gltf-transform failed; run the command above from {ROOT}.\n{detail}") from error


def compress(raw, out):
    """Meshopt geometry (what the engine's kit loader decodes), keeping the structure the page reads."""
    out.parent.mkdir(parents=True, exist_ok=True)
    gltf_transform("optimize", raw, out, "--compress", "meshopt", "--texture-compress", TEXTURE_COMPRESS, *KEEP_STRUCTURE)


def check_output(path, wanted):
    """The glb names every piece (and each placed piece its lod1), every placed piece carries its radius, the membrane has two UV sets."""
    data = path.read_bytes()
    size = struct.unpack_from("<I", data, 12)[0]
    doc = json.loads(data[20:20 + size])
    names = {n.get("name"): n for n in doc["nodes"]}
    missing = [n for n in wanted if n not in names]
    assert not missing, f"the kit lacks {missing}"
    for piece in PLACED:
        assert piece + LOD1 in names, f"{piece} has no lod1"
        assert "radius" in names[piece].get("extras", {}), f"{piece} carries no radius"
    prim = doc["meshes"][names["gate_membrane"]["mesh"]]["primitives"][0]["attributes"]
    assert "TEXCOORD_0" in prim and "TEXCOORD_1" in prim, f"the membrane has {sorted(prim)}"
    print(f"checked {path}: {len(names)} nodes, membrane UV sets {[k for k in prim if k.startswith('TEXCOORD')]}")


# --- Build -------------------------------------------------------------------------------------

def arguments():
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    return Path(args[0]).resolve() if args else DEFAULT_OUT


def build_pieces(coll):
    """Every piece and its lod1 into `coll`: {name: (full, lod1)}; the gate's other nodes come with `None` for a lod1."""
    mats = {
        "stone": material("kit_stone", (0.055, 0.06, 0.12), 0.9),
        "rock": material("kit_rock", (0.03, 0.035, 0.075), 0.75),
        "coral_magenta": material("kit_coral_magenta", (0.95, 0.1, 0.55), 0.5),
        "coral_orange": material("kit_coral_orange", (0.95, 0.42, 0.08), 0.5),
        "membrane": material("kit_membrane", (0.178, 0.04, 0.973), 0.3),
        "glyph": material("kit_glyph", (0.8, 0.75, 1.0), 0.4, emit=(0.85, 0.8, 1.0)),
        "window": material("kit_window", (0.9, 0.45, 0.1), 0.5, emit=(1.0, 0.5, 0.12)),
        "card": material("kit_card", (0.5, 0.6, 1.0), 0.2),
    }
    built = {}

    def both(name, fn):
        built[name] = (fn(name, 0), fn(name + LOD1, 1))

    both(GATE, lambda n, d: build_arch(n, coll, mats, d))
    rocks = (("rock_a", 41, (1.0, 0.9, 0.75)), ("rock_b", 42, (0.8, 1.0, 0.9)), ("rock_c", 43, (0.75, 0.7, 1.5)), ("rock_d", 44, (1.45, 1.1, 0.9)))
    for name, seed, scale in rocks:
        both(name, lambda n, d, seed=seed, scale=scale: build_rock(n, coll, seed, scale, mats, 4 - d))
    corals = (("coral_magenta_a", 61, "coral_magenta", 1.0), ("coral_magenta_b", 62, "coral_magenta", 0.85), ("coral_magenta_c", 63, "coral_magenta", 1.15),
              ("coral_orange_a", 31, "coral_orange", 1.0), ("coral_orange_b", 33, "coral_orange", 0.9))
    for name, seed, mat, size in corals:
        both(name, lambda n, d, seed=seed, mat=mat, size=size: build_coral(n, coll, seed, mats[mat], size, 1 - d))
    for name, kind in zip(CARDS, CARD_KINDS):
        both(name, lambda n, d, kind=kind: build_card(n, coll, mats, kind, d))
    for name in PLACED:
        built[name][0]["radius"] = round(radius_xy(built[name][0]), 4)
    built["gate_windows"] = (build_windows("gate_windows", coll, mats), None)
    built["gate_membrane"] = (build_membrane("gate_membrane", coll, mats), None)
    built["gate_glyph"] = (build_glyph("gate_glyph", coll, mats), None)
    return built


def write_node_list(out, built):
    """kit.nodes.json beside the kit: what the file holds, for the layout test and the world config."""
    info = {}
    for name in [*PLACED, *GATE_NODES]:
        ob = built[name][0]
        entry = {"bounds": bounds_gltf(ob)}
        if name in PLACED:
            entry["radius"] = ob["radius"]
        info[name] = entry
    listing = {
        "url": URL,
        "pieces": PLACED,
        "nodes": GATE_NODES,
        "attached": [{"node": node, "piece": GATE} for node in GATE_NODES],
        "info": info,
    }
    path = out.with_name("kit.nodes.json")
    path.write_text(json.dumps(listing, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {path}")


def build():
    out = arguments()
    scene, coll = kit_scene()
    # Everything below evaluates and exports the kit's own scene, whatever scene Blender shows.
    with bpy.context.temp_override(scene=scene, view_layer=scene.view_layers[0]):
        built = build_pieces(coll)
        check_layout(built)
        export(coll)
        raw = RAW.stat().st_size
        compress(RAW, out)
        check_output(out, PLACED + GATE_NODES)
        for name, (piece, far) in built.items():
            lod = f", lod1 {triangles(far)} ({triangles(far) / triangles(piece):.0%})" if far else ""
            extra = f", radius {piece['radius']}" if "radius" in piece.keys() else ""
            print(f"{name}: {triangles(piece)} triangles{lod}{extra}")
        write_node_list(out, built)
        print("pieces:", ", ".join(PLACED), "| nodes:", ", ".join(GATE_NODES))
        print(f"exported {out}: {raw} bytes raw, {out.stat().st_size} bytes compressed")
    RAW.unlink(missing_ok=True)


if __name__ == "__main__":
    build()
