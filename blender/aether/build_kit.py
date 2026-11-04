"""The Aether world's kit: the drowned observatory. A ruined brain portal (arch, steps, oval
membrane, brain glyph, amber lanterns), square ruin towers and wall pieces with lit windows,
floating rubble, seabed rocks, magenta coral fans and small amber corals. Everything is built by
this script from its seeds; nothing is hand-modelled.

Run in Blender 5.2, from a shell (Blender is not on PATH on this machine):
    "C:/Program Files/Blender Foundation/Blender 5.2/blender.exe" -b -P blender/aether/build_kit.py
or inside a running Blender (Blender MCP):
    p = "<repo>/blender/aether/build_kit.py"
    exec(compile(open(p).read(), p, "exec"), {"__file__": p, "__name__": "__main__"})

It rebuilds the "AetherKit" scene from scratch and touches nothing outside it, then exports the
pieces to public/aether/world/kit.glb. Set AETHER_PREVIEW=<png path> to also render a lineup of
the pieces (a preview collection that is not exported) for looking at the shapes.

It reads the world's layout, src/worlds/aether/place/layout.json (the same file the page imports),
checks that every piece the layout names is built, and lays the world out in a collection that is
not exported (`place_instances`).

Units: 1 = one stage unit. Pieces stand on z = 0 at the origin with their fronts looking down -Y,
which glTF's Y-up export turns into +Z, toward the stage camera. They are exported at the origin
because the page places them from layout.json; the script's own placement (`place_instances`) is a
preview in Blender only. Each placed piece carries its bounding radius on the XZ plane as the node
extra `radius` (about the origin, which is the placement point), for the layout test.

The `portal_*` pieces share ONE frame (the arch centre is at z = PORTAL_Z, the membrane and glyph
sit in the arch's plane), so the page places all five with the same transform and they assemble.

Exported node names (prefix stripped): portal_arch, portal_steps, portal_membrane, portal_glyph,
portal_lanterns; tower_a..tower_d; wall_a..wall_c; rubble_float_a..rubble_float_e; rock_a..rock_e;
coral_fan_a..coral_fan_c; coral_amber_a..coral_amber_c.
"""
import json
import math
import os
import random
import struct
import tempfile
from pathlib import Path

import bmesh
import bpy
from mathutils import Matrix, Vector, noise
from mathutils.bvhtree import BVHTree

try:
    ROOT = Path(__file__).resolve().parents[2]
except NameError:  # exec() without __file__
    ROOT = Path.cwd()
LAYOUT = ROOT / "src/worlds/aether/place/layout.json"
OUT = ROOT / "public/aether/world/kit.glb"
RAW = Path(tempfile.gettempdir()) / "aether-kit-raw.glb"

SCENE = "AetherKit"
PIECES = "AetherKit pieces"  # exported
PREVIEW = "AetherKit preview"  # a lineup for looking at the pieces in Blender; not exported
WORLD = "AetherKit world"  # the layout, for looking at it in Blender; not exported
# Blender names must be unique in the file; the prefix is stripped from the exported names.
PREFIX = "aether."

# Triangle budget for the whole kit (the brief asks for well under ~60k).
MAX_TRIANGLES = 60000


# --- Scene and helpers -------------------------------------------------------------------------

def kit_scene():
    """The kit's own scene and its two collections, emptied of what an earlier run made."""
    scene = bpy.data.scenes.get(SCENE) or bpy.data.scenes.new(SCENE)
    colls = []
    for name in (PIECES, PREVIEW, WORLD):
        coll = bpy.data.collections.get(name) or bpy.data.collections.new(name)
        if scene.collection.children.get(name) is None:
            scene.collection.children.link(coll)
        for ob in list(coll.objects):
            bpy.data.objects.remove(ob, do_unlink=True)
        colls.append(coll)
    for store in (bpy.data.meshes, bpy.data.cameras, bpy.data.lights):
        for data in list(store):
            if data.name.startswith(PREFIX) and data.users == 0:
                store.remove(data)
    scene.render.resolution_x, scene.render.resolution_y = 1800, 900
    return scene, colls[0], colls[1], colls[2]


def material(name, rgb, rough=0.85, metal=0.0, emit=None, strength=0.0, alpha=1.0):
    """A plain principled material. `emit` is an emission colour, `strength` its strength."""
    m = bpy.data.materials.get(PREFIX + name) or bpy.data.materials.new(PREFIX + name)
    m.use_nodes = True
    bsdf = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Base Color"].default_value = (*rgb, 1.0)
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    bsdf.inputs["Alpha"].default_value = alpha
    if emit:
        bsdf.inputs["Emission Color"].default_value = (*emit, 1.0)
        bsdf.inputs["Emission Strength"].default_value = strength
    else:
        bsdf.inputs["Emission Strength"].default_value = 0.0
    return m


def materials():
    """Palette: deep indigo stone, no red or lava hues anywhere."""
    return {
        "stone": material("kit_stone", (0.15, 0.16, 0.27), 0.9),
        "rock": material("kit_rock", (0.06, 0.06, 0.12), 0.75),
        "window": material("kit_window", (1.0, 0.62, 0.20), 0.4, emit=(1.0, 0.60, 0.18), strength=2.5),
        "lantern": material("kit_lantern", (1.0, 0.66, 0.24), 0.4, emit=(1.0, 0.62, 0.20), strength=3.0),
        "glyph": material("kit_glyph", (0.30, 0.25, 1.0), 0.4, emit=(0.32, 0.26, 1.0), strength=2.2),
        "membrane": material("kit_membrane", (0.04, 0.30, 0.85), 0.3, emit=(0.05, 0.38, 1.0), strength=0.8, alpha=0.55),
        "coral_fan": material("kit_coral_fan", (0.85, 0.12, 0.78), 0.5, emit=(0.75, 0.10, 0.85), strength=0.7),
        "coral_amber": material("kit_coral_amber", (1.0, 0.58, 0.14), 0.5, emit=(1.0, 0.55, 0.12), strength=0.8),
    }


def to_object(name, bm, coll, mats=(), smooth=False):
    """Bakes `bm` into a named object. `mats` fills the material slots in order."""
    me = bpy.data.meshes.new(PREFIX + name)
    bm.to_mesh(me)
    bm.free()
    if smooth is not None:
        for p in me.polygons:
            p.use_smooth = smooth
    ob = bpy.data.objects.new(PREFIX + name, me)
    coll.objects.link(ob)
    for m in mats:
        me.materials.append(m)
    return ob


def triangles(ob):
    own = sum(len(p.vertices) - 2 for p in ob.data.polygons) if ob.type == "MESH" else 0
    return own + sum(triangles(child) for child in ob.children)


def radius_xy(ob):
    """How far the piece reaches from its origin on the ground plane (stage XZ)."""
    return max(math.hypot(v.co.x, v.co.y) for v in ob.data.vertices)


def box_uvs(bm):
    """Box projection (1 UV = 1 unit): each face takes UVs from the plane its normal faces most."""
    uv = bm.loops.layers.uv.verify()
    bm.normal_update()
    for f in bm.faces:
        n = f.normal
        axis = max(range(3), key=lambda k: abs(n[k]))
        for loop in f.loops:
            c = loop.vert.co
            loop[uv].uv = (c.y, c.z) if axis == 0 else (c.x, c.z) if axis == 1 else (c.x, c.y)


def block(bm, size, centre, turn=(0.0, 0.0, 0.0), bevel=0.03):
    """One stone: a box of `size` at `centre`, turned by Euler `turn`, with softened edges."""
    verts = bmesh.ops.create_cube(bm, size=1.0)["verts"]
    bmesh.ops.scale(bm, vec=Vector(size), verts=verts)
    rot = Matrix.Rotation(turn[2], 4, "Z") @ Matrix.Rotation(turn[1], 4, "Y") @ Matrix.Rotation(turn[0], 4, "X")
    bmesh.ops.transform(bm, matrix=Matrix.Translation(centre) @ rot, verts=verts)
    if bevel:
        edges = list({e for v in verts for e in v.link_edges})
        bmesh.ops.bevel(bm, geom=edges, offset=bevel, segments=1, affect="EDGES", clamp_overlap=True)
    return verts


def arch_outline(cx, w, z0, z1, arc=6):
    """2D points (x, z) of an arched window: straight sides up to the springline, a half circle
    on top. Counter-clockwise seen from the front (looking along +Y)."""
    r = w / 2
    spring = z1 - r
    pts = [(cx - r, z0), (cx + r, z0)]
    for k in range(arc + 1):
        a = math.pi * k / arc
        pts.append((cx + r * math.cos(a), spring + r * math.sin(a)))
    return pts


def lit_window(bm, cx, z0, w, h, wall_front_y, mat_stone=0, mat_window=1, frame=0.07, lift=0.045):
    """A small arched window on a wall's front face (the face at y = wall_front_y, facing -Y): a
    raised stone frame and, in front of it, the emissive window face. Local wall coordinates."""
    z1 = z0 + h
    outer = arch_outline(cx, w + 2 * frame, z0 - frame, z1 + frame)
    inner = arch_outline(cx, w, z0, z1)
    # Frame: the outer outline pushed out of the wall.
    face = bm.faces.new([bm.verts.new((x, wall_front_y, z)) for x, z in outer])
    ext = bmesh.ops.extrude_face_region(bm, geom=[face])
    moved = [v for v in ext["geom"] if isinstance(v, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, vec=(0.0, -lift, 0.0), verts=moved)
    shell = [g for g in ext["geom"] if isinstance(g, bmesh.types.BMFace)] + [face]
    bmesh.ops.recalc_face_normals(bm, faces=shell)
    for f in shell:
        f.material_index = mat_stone
    # The window: a face just proud of the frame's front, facing -Y, emissive.
    win = bm.faces.new([bm.verts.new((x, wall_front_y - lift - 0.004, z)) for x, z in inner])
    win.normal_update()
    if win.normal.y > 0:
        win.normal_flip()
    win.material_index = mat_window


# --- Portal ------------------------------------------------------------------------------------

PORTAL_Z = 2.15            # arch centre height: all portal_* pieces share this frame
ARCH_IN = (1.12, 1.62)     # inner half axes (x, z): the membrane's oval fills this
ARCH_BAND = 0.46           # ring thickness
ARCH_DEPTH = 0.72          # along Y
STEP_TOP = 0.34            # plinth height under the arch


def ellipse_point(rx, rz, a, y=0.0):
    return Vector((rx * math.cos(a), y, PORTAL_Z + rz * math.sin(a)))


def build_portal_arch(coll, mats):
    """A ruined oval stone ring: wedge-shaped stones (voussoirs) round the oval, a few missing on
    the upper left where it has broken, plus a broken plinth under it."""
    rng = random.Random(41)
    bm = bmesh.new()
    n = 26
    gap = 0.012
    rxi, rzi = ARCH_IN
    rxo, rzo = rxi + ARCH_BAND, rzi + ARCH_BAND
    for i in range(n):
        a0 = 2 * math.pi * i / n + math.radians(-90) + gap
        a1 = 2 * math.pi * (i + 1) / n + math.radians(-90) - gap
        mid = (a0 + a1) / 2
        deg = math.degrees(mid) % 360
        if 112 < deg < 146:  # the break, upper left
            continue
        d = ARCH_DEPTH * rng.uniform(0.82, 1.0)
        ring = [(rxi, rzi, a0), (rxi, rzi, a1), (rxo, rzo, a1), (rxo, rzo, a0)]
        front = [ellipse_point(rx, rz, a, -d / 2) for rx, rz, a in ring]
        back = [ellipse_point(rx, rz, a, d / 2) for rx, rz, a in ring]
        # Each stone is nudged a little, as old stone settles.
        shift = Vector((rng.uniform(-0.015, 0.015), rng.uniform(-0.03, 0.03), rng.uniform(-0.015, 0.015)))
        vf = [bm.verts.new(p + shift) for p in front]
        vb = [bm.verts.new(p + shift) for p in back]
        for quad in (vf, vb[::-1], (vf[0], vb[0], vb[1], vf[1]), (vf[1], vb[1], vb[2], vf[2]),
                     (vf[2], vb[2], vb[3], vf[3]), (vf[3], vb[3], vb[0], vf[0])):
            bm.faces.new(quad)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    # Rubble stones tipped at the foot of the break.
    for sx, sz, turn in ((-1.25, 0.55, 0.4), (-0.7, 0.5, -0.5), (-1.9, 0.42, 0.9)):
        block(bm, (0.5, 0.5, 0.32), (sx, -0.7, STEP_TOP + 0.12 - 0.0 * sz), (0.2, 0.1, turn), 0.04)
    # Plinth: a wide base block, with a broken-off slab leaning on it.
    block(bm, (3.7, 1.35, STEP_TOP), (0, 0, STEP_TOP / 2), (0, 0, 0.02), 0.04)
    block(bm, (1.1, 0.8, 0.5), (1.75, 0.15, STEP_TOP + 0.25), (0.0, 0.0, -0.15), 0.04)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    box_uvs(bm)
    return to_object("portal_arch", bm, coll, [mats["stone"]], smooth=False)


def build_portal_steps(coll, mats):
    """Four broad steps leading up to the plinth, on the -Y (front) side; the upper ones cracked."""
    rng = random.Random(42)
    bm = bmesh.new()
    depth = 0.46
    for k in range(4):
        top = STEP_TOP - 0.075 * (k + 1)
        width = 3.4 + 0.5 * k
        cy = -(0.675 + depth * (k + 0.5))
        parts = 2 if k % 2 == 0 else 3
        x = -width / 2
        for p in range(parts):
            w = width / parts
            drop = rng.uniform(0.0, 0.03)
            block(bm, (w - 0.02, depth - 0.02, top - drop), (x + w / 2, cy, (top - drop) / 2),
                  (0.0, 0.0, rng.uniform(-0.025, 0.025)), 0.025)
            x += w
    box_uvs(bm)
    return to_object("portal_steps", bm, coll, [mats["stone"]], smooth=False)


def build_portal_membrane(coll, mats):
    """An oval disc filling the arch's opening, in the arch's plane (facing -Y). Concentric rings,
    UVs polar-free (0..1 across the oval) so the page's membrane shader can flow across it."""
    rxi, rzi = ARCH_IN
    rx, rz = rxi - 0.03, rzi - 0.03
    segs, rings = 48, 4
    bm = bmesh.new()
    uv = bm.loops.layers.uv.verify()
    centre = bm.verts.new((0, 0, PORTAL_Z))
    ringv = []
    for r in range(1, rings + 1):
        t = r / rings
        ringv.append([bm.verts.new((rx * t * math.cos(a), 0.0, PORTAL_Z + rz * t * math.sin(a)))
                      for a in (2 * math.pi * s / segs for s in range(segs))])
    faces = []
    for s in range(segs):
        faces.append(bm.faces.new((centre, ringv[0][(s + 1) % segs], ringv[0][s])))
    for r in range(1, rings):
        for s in range(segs):
            faces.append(bm.faces.new((ringv[r - 1][s], ringv[r - 1][(s + 1) % segs], ringv[r][(s + 1) % segs], ringv[r][s])))
    for f in faces:
        f.normal_update()
        if f.normal.y > 0:
            f.normal_flip()
        for loop in f.loops:
            c = loop.vert.co
            loop[uv].uv = (0.5 + 0.5 * c.x / rx, 0.5 + 0.5 * (c.z - PORTAL_Z) / rz)
    return to_object("portal_membrane", bm, coll, [mats["membrane"]], smooth=True)


def ribbon(bm, pts, width, y, closed=False):
    """A flat stroke along 2D points (x, z) at depth y, `width` wide, facing -Y (a neon line)."""
    n = len(pts)
    left, right = [], []
    for i in range(n):
        p0 = pts[(i - 1) % n] if closed or i > 0 else pts[i]
        p1 = pts[(i + 1) % n] if closed or i < n - 1 else pts[i]
        tx, tz = p1[0] - p0[0], p1[1] - p0[1]
        ln = math.hypot(tx, tz) or 1.0
        nx, nz = -tz / ln, tx / ln
        left.append(bm.verts.new((pts[i][0] + nx * width / 2, y, pts[i][1] + nz * width / 2)))
        right.append(bm.verts.new((pts[i][0] - nx * width / 2, y, pts[i][1] - nz * width / 2)))
    for i in range(n if closed else n - 1):
        j = (i + 1) % n
        f = bm.faces.new((left[i], right[i], right[j], left[j]))
        f.normal_update()
        if f.normal.y > 0:
            f.normal_flip()


def build_portal_glyph(coll, mats):
    """The brain, as neon strokes: two lobed hemispheres, folds inside each and a stem, in the
    arch's plane just in front of the membrane (faces -Y). A separate node so the page can pulse
    it on the 'emissive' drive. Sits a little low and right of the opening's centre, as in the
    reference."""
    rng = random.Random(43)
    bm = bmesh.new()
    y = -0.04
    cx, cz = 0.10, PORTAL_Z - 0.12
    w = 0.034
    for side in (-1, 1):
        ox = cx + side * 0.30
        # Outline: an egg, wider toward the top, with lobes (bumps) round its edge.
        outline = []
        phase = rng.uniform(0, 6.28)
        for k in range(44):
            a = 2 * math.pi * k / 44
            bump = 1.0 + 0.07 * math.sin(6 * a + phase) + 0.03 * math.sin(11 * a)
            ex, ez = 0.31 * bump, (0.40 if math.sin(a) > 0 else 0.30) * bump
            outline.append((ox + ex * math.cos(a), cz + ez * math.sin(a)))
        ribbon(bm, outline, w, y, closed=True)
        # Folds: wavy strokes across the hemisphere.
        for fold in range(4):
            z0 = cz + (fold - 1.5) * 0.17
            pts = []
            for k in range(13):
                t = k / 12
                x = ox - 0.24 + 0.48 * t
                zz = z0 + 0.045 * math.sin(7 * t + fold * 1.7 + side) + 0.02 * math.sin(13 * t)
                pts.append((x, zz))
            ribbon(bm, pts, w * 0.8, y)
        # A short vertical sulcus.
        ribbon(bm, [(ox + side * 0.02 + 0.02 * math.sin(5 * t), cz - 0.28 + 0.56 * t) for t in [i / 8 for i in range(9)]], w * 0.8, y)
    # Stem.
    ribbon(bm, [(cx + 0.02 + 0.03 * math.sin(3 * t), cz - 0.24 - 0.40 * t) for t in [i / 6 for i in range(7)]], w * 1.2, y)
    # A touch larger, about the glyph's own centre, so it fills the opening as in the reference.
    for v in bm.verts:
        v.co.x = cx + (v.co.x - cx) * 1.3
        v.co.z = cz + (v.co.z - cz) * 1.3
    return to_object("portal_glyph", bm, coll, [mats["glyph"]], smooth=False)


def build_portal_lanterns(coll, mats):
    """Amber lantern nodes inlaid along the arch's rim: small flattened glowing beads set into
    the ring's front face, evenly spaced with a little scatter."""
    rng = random.Random(44)
    bm = bmesh.new()
    rx, rz = ARCH_IN[0] + ARCH_BAND * 0.5, ARCH_IN[1] + ARCH_BAND * 0.5
    n = 16
    for i in range(n):
        a = 2 * math.pi * (i + rng.uniform(-0.12, 0.12)) / n
        if 108 < math.degrees(a) % 360 < 150:  # the break: no stone there to hold a lantern
            continue
        p = ellipse_point(rx, rz, a, -ARCH_DEPTH / 2 - 0.012)
        bead = bmesh.ops.create_icosphere(bm, subdivisions=2, radius=rng.uniform(0.06, 0.085))["verts"]
        bmesh.ops.scale(bm, vec=Vector((1.0, 0.55, 1.0)), verts=bead)
        bmesh.ops.translate(bm, vec=p, verts=bead)
    return to_object("portal_lanterns", bm, coll, [mats["lantern"]], smooth=True)


# --- Ruin towers and walls ---------------------------------------------------------------------

def build_tower(name, coll, mats, seed, height, apothem, win_rows, broken_dir=0.0):
    """A square ruin tower: a plinth, four hollow wall slabs of different heights that break
    away toward `broken_dir` (radians), a stepped cap ledge on the tallest, and small arched
    windows. Window faces use material slot 1 (emissive amber), the stone slot 0."""
    rng = random.Random(seed)
    bm = bmesh.new()
    t = 0.4  # wall thickness
    # Plinth: two broad steps.
    block(bm, (apothem * 2 + 0.9, apothem * 2 + 0.9, 0.3), (0, 0, 0.15), (0, 0, 0.01), 0.04)
    block(bm, (apothem * 2 + 0.45, apothem * 2 + 0.45, 0.3), (0, 0, 0.45), (0, 0, -0.01), 0.04)
    base = 0.6
    heights = []
    for k in range(4):
        ang = k * math.pi / 2
        # Walls nearer the break direction are lower.
        facing = math.cos(ang - broken_dir)
        heights.append(base + (height - base) * (0.78 - 0.28 * facing + rng.uniform(-0.06, 0.06)))
    heights[max(range(4), key=lambda k: heights[k])] = height
    # Ledge bands and corner quoins, kept below the lowest wall so none hangs in the air.
    low = min(heights)
    bw = apothem * 2 + t + 0.22
    for z in [r + 1.25 for r in win_rows[:-1]] + [win_rows[-1] + 1.25]:
        if z + 0.15 < low:
            block(bm, (bw, bw, 0.16), (0, 0, z), (0, 0, rng.uniform(-0.01, 0.01)), 0.025)
    q = apothem + t / 2
    for sx, sz2 in ((-1, -1), (1, -1), (-1, 1), (1, 1)):
        qh = (low - base) * rng.uniform(0.55, 0.95)
        block(bm, (0.36, 0.36, qh), (sx * q, sz2 * q, base + qh / 2), (0, 0, rng.uniform(-0.03, 0.03)), 0.03)
    # Stones fallen round the foot.
    for _ in range(5):
        a = rng.uniform(0, 2 * math.pi)
        r = apothem + rng.uniform(0.75, 1.3)
        s3 = rng.uniform(0.25, 0.5)
        block(bm, (s3, s3 * rng.uniform(0.7, 1.3), s3 * 0.7), (math.cos(a) * r, math.sin(a) * r, s3 * 0.3), (rng.uniform(-0.3, 0.3), rng.uniform(-0.3, 0.3), a), 0.03)
    for k in range(4):
        ang = k * math.pi / 2
        h = heights[k] - base
        w = apothem * 2 + t
        # A wall slab in local coordinates: x along the wall, y thickness (front face at -y),
        # z up; its top is slanted where it broke.
        slab = bmesh.new()
        verts = bmesh.ops.create_cube(slab, size=1.0)["verts"]
        bmesh.ops.scale(slab, vec=Vector((w, t, h)), verts=verts)
        slope = rng.uniform(-0.45, 0.45)
        for v in verts:
            if v.co.z > 0:
                v.co.z += slope * v.co.x / (w / 2) * min(0.9, h * 0.22) + rng.uniform(-0.05, 0.05)
        edges = list({e for v in verts for e in v.link_edges})
        bmesh.ops.bevel(slab, geom=edges, offset=0.03, segments=1, affect="EDGES", clamp_overlap=True)
        # Windows, in rows up the wall, only where the wall stands tall enough. Front face y = -t/2.
        usable = h - 0.6 if slope >= 0 else h - 0.6 - abs(slope) * 0.2 * h
        for z in win_rows:
            zl = z - base - h / 2  # slab-local height
            if z + 0.8 < base + usable and rng.random() < 0.8:
                lit_window(slab, rng.uniform(-0.15, 0.15), zl, 0.34, 0.72, -t / 2)
        mesh = bpy.data.meshes.new(PREFIX + "slab")
        slab.to_mesh(mesh)
        slab.free()
        # Turn and place the slab round the tower: front face -Y of the slab points outward.
        out = Vector((math.sin(ang), -math.cos(ang), 0.0))  # k=0 -> -Y (front)
        move = Matrix.Translation(out * apothem + Vector((0, 0, base + h / 2))) @ Matrix.Rotation(ang, 4, "Z")
        existing = set(bm.verts)
        bm.from_mesh(mesh)  # appends the slab; its material slots keep their indices
        bpy.data.meshes.remove(mesh)
        bmesh.ops.transform(bm, matrix=move, verts=[v for v in bm.verts if v not in existing])
    box_uvs(bm)
    return to_object(name, bm, coll, [mats["stone"], mats["window"]], smooth=False)


def build_wall(name, coll, mats, seed, length, height, windows=()):
    """A broken wall: courses of stones whose top edge steps down toward one end. `windows` are
    (x centre, z bottom) arched lit windows in the front face."""
    rng = random.Random(seed)
    bm = bmesh.new()
    t = 0.42
    left = -length / 2
    profile = [height * rng.uniform(0.62, 1.0)]
    cols = 8
    for _ in range(cols):
        profile.append(max(0.5, min(height, profile[-1] + rng.uniform(-0.55, 0.45))))
    profile[-1] = max(0.55, profile[-1] * 0.55)  # the far end has fallen most

    def top_at(x):
        u = (x - left) / length * cols
        i = min(cols - 1, int(u))
        f = u - i
        return profile[i] * (1 - f) + profile[i + 1] * f

    # A plinth footing the whole wall.
    block(bm, (length + 0.3, t + 0.3, 0.28), (0, 0, 0.14), (0, 0, 0.0), 0.03)
    z = 0.28
    while z < height - 0.1:
        ch = rng.uniform(0.38, 0.55)
        x = left
        while x < left + length - 0.15:
            w = min(rng.uniform(0.7, 1.4), left + length - x)
            if w < 0.35:
                break
            mid = x + w / 2
            if z + ch * 0.55 < top_at(mid) and rng.random() < 0.96:
                block(bm, (w - 0.025, t, ch - 0.025), (mid, rng.uniform(-0.02, 0.02), z + ch / 2),
                      (0, 0, rng.uniform(-0.02, 0.02)), 0.025)
            x += w
        z += ch
    for cx, z0 in windows:
        block(bm, (0.95, t, 1.3), (cx, 0.0, z0 + 0.4), (0, 0, 0), 0.02)  # solid stone behind the window
        lit_window(bm, cx, z0, 0.38, 0.8, -t / 2 - 0.0)
    box_uvs(bm)
    return to_object(name, bm, coll, [mats["stone"], mats["window"]], smooth=False)


# --- Rubble, rocks ------------------------------------------------------------------------------

def build_rubble(name, coll, mats, seed, size):
    """A stone fragment for hanging in the water: a box with its corners knocked off by planes
    at slants of their own, so it reads as a broken block, not a cube. Flat shaded."""
    rng = random.Random(seed)
    bm = bmesh.new()
    verts = bmesh.ops.create_cube(bm, size=1.0)["verts"]
    bmesh.ops.scale(bm, vec=Vector(size), verts=verts)
    for _ in range(rng.choice((4, 5, 6))):
        corner = Vector((rng.choice((-1, 1)), rng.choice((-1, 1)), rng.choice((-1, 1))))
        slant = Vector((corner.x * rng.uniform(0.6, 1.4), corner.y * rng.uniform(0.6, 1.4), corner.z * rng.uniform(0.6, 1.4))).normalized()
        tip = Vector((corner.x * size[0] / 2, corner.y * size[1] / 2, corner.z * size[2] / 2))
        depth = rng.uniform(0.12, 0.34) * min(size)
        cut = bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], dist=1e-5,
                                     plane_co=tip - slant * depth * 2.2, plane_no=slant, clear_outer=True)
        rim = [e for e in cut["geom_cut"] if isinstance(e, bmesh.types.BMEdge)]
        if rim:
            bmesh.ops.holes_fill(bm, edges=rim, sides=0)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    box_uvs(bm)
    return to_object(name, bm, coll, [mats["stone"]], smooth=False)


def build_rock(name, coll, mats, seed, scale, detail=3):
    """A craggy seabed boulder: noise and cell facets on a sphere, its underside flattened to sit
    on z = 0 (tops out near the scale)."""
    rng = random.Random(seed)
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=detail, radius=1.0)
    off = Vector((rng.uniform(0, 90), rng.uniform(0, 90), rng.uniform(0, 90)))
    for v in bm.verts:
        p = v.co.normalized()
        n = noise.fractal(p * 1.15 + off, 0.55, 2.0, 4)
        dist, _ = noise.voronoi(p * 2.1 + off)
        facet = min(dist[1] - dist[0], 0.5)
        crag = noise.fractal(p * 3.2 + off * 0.5, 0.8, 2.0, 3)
        v.co = p * (1.0 + 0.3 * n + 0.22 * facet + 0.025 * crag)
        if v.co.z < -0.3:
            v.co.z = -0.3 + (v.co.z + 0.3) * 0.15
    bmesh.ops.scale(bm, vec=Vector(scale), verts=bm.verts)
    bmesh.ops.translate(bm, vec=(0, 0, 0.3 * scale[2]), verts=bm.verts)
    box_uvs(bm)
    return to_object(name, bm, coll, [mats["rock"]], smooth=True)


# --- Coral -------------------------------------------------------------------------------------

def build_coral(name, coll, mats, mat_key, seed, size=1.0, fan=True):
    """Branching coral: a grown skeleton thickened by the Skin modifier. `fan` keeps the growth
    in one plane (x-z), like a sea fan, and spreads wide; otherwise it is a stubby 3D bush.
    Tips are brighter (Col)."""
    rng = random.Random(seed)
    verts = [Vector((0, 0, 0))]
    edges = []
    radii = [0.034 * size]

    def grow(i, d, length, r, depth):
        pos = verts[i].copy()
        steps = max(2, int(length / (0.09 * size)))
        for s in range(steps):
            wob = Vector((rng.uniform(-0.25, 0.25), 0.0 if fan else rng.uniform(-0.3, 0.3), rng.uniform(0.0, 0.2)))
            d = (d + wob * 0.4).normalized()
            pos = pos + d * (length / steps)
            verts.append(pos.copy())
            edges.append((i, len(verts) - 1))
            radii.append(max(r * (1 - 0.35 * (s + 1) / steps), 0.012 * size))
            i = len(verts) - 1
        if depth > 0:
            n = rng.choice((2, 2, 3)) if fan else rng.choice((2, 3))
            for k in range(n):
                a = (k - (n - 1) / 2) * rng.uniform(0.6, 0.9) + rng.uniform(-0.2, 0.2)
                yb = 0.0 if fan else rng.uniform(-0.6, 0.6)
                nd = (d + Vector((math.sin(a) * 0.95, yb, 0.1))).normalized()
                grow(i, nd, length * rng.uniform(0.74, 0.9), radii[i] * 0.8, depth - 1)

    stems = rng.choice((4, 5)) if fan else rng.choice((3, 4))
    for k in range(stems):
        a = (k - (stems - 1) / 2) * (0.5 if fan else 0.7) + rng.uniform(-0.1, 0.1)
        yb = 0.0 if fan else rng.uniform(-0.5, 0.5)
        grow(0, Vector((math.sin(a), yb, math.cos(a))).normalized(), (0.36 if fan else 0.2) * size, 0.04 * size, 3 if fan else 2)
    me = bpy.data.meshes.new(PREFIX + name + "_skel")
    me.from_pydata([tuple(v) for v in verts], edges, [])
    me.update()
    ob = bpy.data.objects.new(PREFIX + name, me)
    coll.objects.link(ob)
    ob.modifiers.new("Skin", "SKIN")
    sv = me.skin_vertices[0].data
    for k, r in enumerate(radii):
        sv[k].radius = (r, r * (0.55 if fan else 1.0))  # fan branches are flatter front to back
    sv[0].use_root = True
    deps = bpy.context.evaluated_depsgraph_get()
    baked = bpy.data.meshes.new_from_object(ob.evaluated_get(deps))
    ob.modifiers.clear()
    ob.data = baked
    bpy.data.meshes.remove(me)
    baked.name = PREFIX + name
    for p in baked.polygons:
        p.use_smooth = True
    top = max(v.co.z for v in baked.vertices) or 1.0
    attr = baked.color_attributes.new("Col", "FLOAT_COLOR", "POINT")
    for i, v in enumerate(baked.vertices):
        g = 0.4 + 0.6 * max(0.0, v.co.z / top) ** 1.3
        attr.data[i].color = (g, g, g, 1.0)
    baked.color_attributes.active_color = attr
    baked.materials.append(mats[mat_key])
    return ob


# --- The kit -----------------------------------------------------------------------------------

LETTERS = "abcdefghij"


def build_pieces(coll):
    """Every kit piece into `coll`: {exported name: object}."""
    mats = materials()
    built = {}

    def add(ob):
        built[ob.name[len(PREFIX):]] = ob

    add(build_portal_arch(coll, mats))
    add(build_portal_steps(coll, mats))
    add(build_portal_membrane(coll, mats))
    add(build_portal_glyph(coll, mats))
    add(build_portal_lanterns(coll, mats))

    # name: (seed, height, apothem, window rows, break direction)
    towers = {
        "tower_a": (3, 9.0, 1.15, (1.9, 3.7, 5.5, 7.3), math.radians(135)),
        "tower_b": (5, 7.2, 1.0, (1.8, 3.5, 5.2), math.radians(-60)),
        "tower_c": (9, 4.4, 1.2, (1.7, 3.1), math.radians(200)),
        "tower_d": (12, 8.2, 0.8, (1.8, 3.6, 5.4, 7.0), math.radians(20)),
    }
    for name, (seed, h, ap, rows, brk) in towers.items():
        add(build_tower(name, coll, mats, seed, h, ap, rows, brk))

    add(build_wall("wall_a", coll, mats, 21, 4.4, 2.8))
    add(build_wall("wall_b", coll, mats, 22, 3.4, 3.4, windows=((-0.3, 1.0),)))
    add(build_wall("wall_c", coll, mats, 23, 2.6, 2.2, windows=((0.4, 0.7),)))

    rubble = ((31, (1.1, 0.8, 0.7)), (32, (0.8, 0.8, 0.6)), (33, (1.4, 0.9, 0.9)), (34, (0.6, 0.5, 0.5)), (35, (1.0, 0.7, 1.0)))
    for i, (seed, size) in enumerate(rubble):
        add(build_rubble(f"rubble_float_{LETTERS[i]}", coll, mats, seed, size))

    rocks = ((11, (1.0, 0.9, 0.75), 3), (12, (0.8, 1.0, 0.9), 3), (13, (1.2, 0.85, 0.6), 3), (14, (0.7, 0.75, 1.0), 2), (15, (1.0, 1.0, 1.0), 3))
    for i, (seed, scale, detail) in enumerate(rocks):
        add(build_rock(f"rock_{LETTERS[i]}", coll, mats, seed, scale, detail))

    for i, (seed, size) in enumerate(((51, 1.5), (52, 1.9), (53, 1.3))):
        add(build_coral(f"coral_fan_{LETTERS[i]}", coll, mats, "coral_fan", seed, size, fan=True))
    for i, (seed, size) in enumerate(((61, 1.1), (62, 1.4), (63, 0.9))):
        add(build_coral(f"coral_amber_{LETTERS[i]}", coll, mats, "coral_amber", seed, size, fan=False))
    for name, ob in built.items():
        if name == "portal_arch" or not name.startswith("portal_"):
            ob["radius"] = round(radius_xy(ob), 4)
    return built


# --- Placement ---------------------------------------------------------------------------------

# The portal's other nodes share the arch's frame: they are placed wherever the arch is.
PORTAL_PARTS = ("portal_steps", "portal_membrane", "portal_glyph", "portal_lanterns")


def read_layout():
    return json.loads(LAYOUT.read_text(encoding="utf-8"))


def check_layout(layout, built):
    named = {p["piece"] for group in layout["groups"].values() for p in group}
    missing = sorted(named - set(built))
    if missing:
        raise RuntimeError(f"layout.json names pieces the kit does not build: {missing}")
    if layout["chains"]:
        raise RuntimeError("layout.json has chains, but the kit has no chain piece")


def stage_matrix(p, y=None):
    """A placement's matrix in Blender space. Stage is Y-up with the camera down -Z; Blender is
    Z-up: stage (x, y, z) is Blender (x, -z, y). Turning about stage Y is turning about Blender Z;
    the tilt about stage Z is a turn about Blender -Y. Applied as on the page: tilt, then turn."""
    x, sy, z = p["position"]
    s = p.get("scale", 1)
    sx, ssy, sz = (s, s, s) if isinstance(s, (int, float)) else s
    return (
        Matrix.Translation((x, -z, sy if y is None else y))
        @ Matrix.Rotation(p.get("rotY", 0.0), 4, "Z")
        @ Matrix.Rotation(-p.get("tilt", 0.0), 4, "Y")
        @ Matrix.Diagonal((sx, sz, ssy, 1.0))
    )


def place_instances(built, world_coll, layout):
    """The world as layout.json places it, from linked copies of the pieces (the page places the
    same pieces from the same data): the portal's parts with the arch, coral dropped onto the
    highest stone below it or the floor. A floor plane is added for looking at it. Not exported."""
    floor_y = layout["floorY"]
    solids = []

    def place(name, matrix, label):
        ob = bpy.data.objects.new(f"{PREFIX}world.{label}", built[name].data)
        ob.matrix_world = matrix
        world_coll.objects.link(ob)
        return ob

    for group, items in layout["groups"].items():
        if group == "corals":
            continue
        for i, p in enumerate(items):
            m = stage_matrix(p)
            ob = place(p["piece"], m, f"{group}{i}")
            if group == "portal":
                for part in PORTAL_PARTS:
                    place(part, m, f"{group}{i}.{part}")
            if group != "rubble":
                mw = ob.matrix_world
                solids.append(BVHTree.FromPolygons([mw @ v.co for v in ob.data.vertices], [tuple(q.vertices) for q in ob.data.polygons]))
    for i, p in enumerate(layout["groups"].get("corals", [])):
        x, _, z = p["position"]
        hits = [t.ray_cast(Vector((x, -z, 12.0)), Vector((0, 0, -1)))[0] for t in solids]
        y = max([h.z for h in hits if h is not None] + [floor_y]) - 0.04
        place(p["piece"], stage_matrix(p, y), f"corals{i}")
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=1.0)
    bmesh.ops.transform(bm, matrix=Matrix.Translation((0, -8, floor_y)) @ Matrix.Diagonal((16, 32, 1, 1)), verts=bm.verts)
    to_object("world.floor", bm, world_coll, [material("preview_floor", (0.02, 0.02, 0.06), 1.0)], smooth=False)


def lay_out_preview(built, coll):
    """A lineup of every piece in three rows, for looking at the shapes in Blender or in a render.
    Not exported. The five portal pieces share a frame, so they go at one spot. Returns the camera."""
    rows = [  # (y, first x, spacing, name prefixes)
        (0.0, -10.0, 5.5, ("tower_",)),
        (11.0, -14.0, 5.2, ("wall_", "rubble_", "rock_")),
        (21.0, -12.0, 3.0, ("coral_",)),
    ]
    for y, x, gap, prefixes in rows:
        for name, src in built.items():
            if name.startswith(prefixes):
                ob = bpy.data.objects.new(f"{PREFIX}preview.{name}", src.data)
                ob.location = (x, y, 2.0 if name.startswith("rubble_") else 0.0)
                coll.objects.link(ob)
                x += gap
    for name, src in built.items():
        if name.startswith("portal_"):
            ob = bpy.data.objects.new(f"{PREFIX}preview.{name}", src.data)
            ob.location = (-15.0, 0.0, 0.0)
            coll.objects.link(ob)
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=1.0)
    bmesh.ops.transform(bm, matrix=Matrix.Translation((0, 10, -0.02)) @ Matrix.Diagonal((30, 20, 1, 1)), verts=bm.verts)
    floor = to_object("preview.floor", bm, coll, [material("preview_floor", (0.02, 0.02, 0.06), 1.0)], smooth=False)
    cam_data = bpy.data.cameras.new(PREFIX + "preview_cam")
    cam_data.lens = 30
    cam = bpy.data.objects.new(PREFIX + "preview.camera", cam_data)
    cam.location = (0, -24, 20)
    cam.rotation_euler = (math.radians(62), 0, 0)
    override = os.environ.get("AETHER_CAM")  # "x,y,z,tilt_degrees,lens" to look closer at one piece
    if override:
        x, y, z, tilt, lens = (float(v) for v in override.split(","))
        cam.location, cam.rotation_euler, cam_data.lens = (x, y, z), (math.radians(tilt), 0, 0), lens
    coll.objects.link(cam)
    for loc, energy, rgb in (((6, -8, 14), 5000, (0.7, 0.8, 1.0)), ((-8, -4, 5), 900, (1.0, 0.7, 0.4))):
        ld = bpy.data.lights.new(PREFIX + "preview_light", "POINT")
        ld.energy = energy
        ld.color = rgb
        lo = bpy.data.objects.new(PREFIX + "preview.light", ld)
        lo.location = loc
        coll.objects.link(lo)
    return cam


def render_preview(scene, path):
    """One still of the lineup. Eevee if it runs, else Workbench."""
    engines = [i.identifier for i in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items]
    for want in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE", "BLENDER_WORKBENCH"):
        if want in engines:
            scene.render.engine = want
            break
    scene.world = scene.world or bpy.data.worlds.new("AetherKit world")
    scene.world.use_nodes = True
    bg = next(n for n in scene.world.node_tree.nodes if n.type == "BACKGROUND")
    bg.inputs["Color"].default_value = (0.01, 0.015, 0.06, 1.0)
    scene.render.filepath = str(path)
    scene.render.image_settings.file_format = "PNG"
    bpy.ops.render.render(write_still=True, scene=scene.name)
    print(f"preview rendered: {path} ({scene.render.engine})")


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


def tidy_glb(path):
    """Drops PREFIX from node, mesh and material names (the page asks for `portal_arch`, not
    `aether.portal_arch`) and makes the membrane an alpha-blended material."""
    def edit(doc):
        for group in ("nodes", "meshes", "materials"):
            for item in doc.get(group, []):
                if item.get("name", "").startswith(PREFIX):
                    item["name"] = item["name"][len(PREFIX):]
        for m in doc.get("materials", []):
            if m.get("name") == "kit_membrane":
                m["alphaMode"] = "BLEND"
                m["doubleSided"] = True
    edit_glb_json(path, edit)


def export(coll):
    OUT.parent.mkdir(parents=True, exist_ok=True)
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
    tidy_glb(RAW)
    OUT.write_bytes(RAW.read_bytes())


def build():
    scene, pieces_coll, preview_coll, world_coll = kit_scene()
    # Everything below evaluates and exports the kit's own scene, whatever scene Blender shows.
    with bpy.context.temp_override(scene=scene, view_layer=scene.view_layers[0]):
        built = build_pieces(pieces_coll)
        layout = read_layout()
        check_layout(layout, built)
        place_instances(built, world_coll, layout)
        total = 0
        for name, ob in built.items():
            tris = triangles(ob)
            total += tris
            print(f"{name}: {tris} triangles")
        print(f"kit total: {total} triangles, {len(built)} nodes")
        if total > MAX_TRIANGLES:
            raise RuntimeError(f"kit has {total} triangles, over the {MAX_TRIANGLES} budget")
        export(pieces_coll)
        print(f"exported {OUT}: {OUT.stat().st_size} bytes")
        shot = os.environ.get("AETHER_PREVIEW")
        if shot:
            world_coll.hide_render = True
            scene.camera = lay_out_preview(built, preview_coll)
            render_preview(scene, shot)


if __name__ == "__main__":
    build()
