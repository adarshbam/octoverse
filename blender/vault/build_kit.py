"""Veyra's vault kit: a stone portal (arch, membrane, padlock), mossy blocks, a broken wall, steps,
dark seabed rocks, orange coral and glowing plants. Every placed piece also comes as `<piece>_lod1`
(a lighter copy for far use). Everything is built by this script from its seeds; nothing is
hand-modelled. Kelp and seagrass are live elements of the engine, not kit pieces.

Run in Blender 5.2 from a shell:
    blender -b -P blender/vault/build_kit.py -- public/veyra/world/kit.glb
With no path it writes public/veyra/world/kit.glb in the repo. A second argument pair,
`--sheet <png>`, also renders a contact sheet of the pieces (Workbench, not part of the kit):
    blender -b -P blender/vault/build_kit.py -- public/veyra/world/kit.glb --sheet sheet.png

It rebuilds the "VeyraKit vault" scene from scratch and touches nothing outside it. It reads the
world's layout, src/worlds/veyra/place/layout.json (the same file the page imports), checks that
every piece the layout names is built, and lays the world out in a preview collection that is not
exported. Then it exports the pieces and compresses them with gltf-transform (meshopt geometry,
the one the engine's kit loader decodes) into the output file.

Units: 1 = one stage unit. Pieces stand on z = 0 at the origin with their fronts looking down -Y,
which glTF's Y-up export turns into +Z, toward the stage camera. Each placed piece carries its
bounding radius on the XZ plane as the node extra `radius` (about the origin, which is the
placement point), for the layout test.

The portal is four top-level nodes sharing one frame (origin at the middle of the doorway's
foot, the same as `arch`): `arch`, `membrane`, `padlock_body` and `padlock_ring`. The page places
the arch like any piece and the other three in the same placement; the ring turns about its own
centre (the node's z axis, the one facing the camera), so its node origin is the ring's centre.
`membrane` carries two UV sets: UV0 is a plain planar map and UV1 is the flow map (u round the
doorway's edge, v from 0 at the edge to 1 at the middle), for the flow shader.
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
from mathutils import Matrix, Vector, noise
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parents[2]
LAYOUT = ROOT / "src/worlds/veyra/place/layout.json"
DEFAULT_OUT = ROOT / "public/veyra/world/kit.glb"
# This run's own temporary file (its process id): two builds at once never write the same one.
RAW = Path(tempfile.gettempdir()) / f"veyra-kit-vault-raw-{os.getpid()}.glb"

SCENE = "VeyraKit vault"
PIECES = "VeyraKit vault pieces"  # exported
WORLD = "VeyraKit vault world"  # the layout, for looking at it in Blender; not exported
SHEET = "VeyraKit vault sheet"  # the contact sheet; not exported
# Blender names must be unique in the file; the prefix is stripped from the exported node names.
PREFIX = "veyra."
LOD1 = "_lod1"

# The kit carries no textures (the page makes its stone maps), but gltf-transform insists on finding
# KTX-Software's `ktx` when it is asked for KTX2 textures. A Blender started before KTX-Software was
# installed lacks it on its PATH, so the default install folder is added (or set KTX_SOFTWARE_BIN).
TEXTURE_COMPRESS = "ktx2"
KTX_BIN = os.environ.get("KTX_SOFTWARE_BIN", r"C:\Program Files\KTX-Software\bin")
# gltf-transform optimize defaults that would break what the page reads: flatten and join would
# merge the pieces into a few anonymous meshes (the page finds pieces and props by node name);
# palette would rewrite the UVs; prune-attributes would drop the membrane's second UV set;
# simplify would change the authored LODs; instance would share meshes between nodes.
KEEP_STRUCTURE = [
    "--flatten", "false", "--join", "false", "--instance", "false", "--palette", "false",
    "--simplify", "false", "--prune-attributes", "false",
]

# What the page may place (each has a lod1), and the nodes that are not placed pieces.
PLACED = ["arch", "block_a", "block_b", "block_c", "block_d", "wall_broken", "steps", "rock_a", "rock_b", "rock_c", "coral_orange", "glowplant_a", "glowplant_b"]
NODES = ["membrane", "padlock_body", "padlock_ring"]

JOINT = 0.022  # the dark gap between neighbouring stones
BEVEL = 0.03
MOSS = (0.62, 0.92, 0.4)  # the vertex tint of the moss on a stone's top faces (the page's stone colour multiplies it)

# The doorway: its half width and the height of its spring (where the round head begins).
DOOR_HALF = 1.0
SPRING = 2.9
# The portal's depth: front face, the doorway's back wall (the membrane stands just before it) and back face.
FRONT, BACK_WALL, BACK = -0.5, 0.25, 0.5


# --- Scene -------------------------------------------------------------------------------------

def kit_scene():
    """The kit's own scene and its collections, emptied of what an earlier run made."""
    scene = bpy.data.scenes.get(SCENE) or bpy.data.scenes.new(SCENE)
    colls = []
    for name in (PIECES, WORLD, SHEET):
        coll = bpy.data.collections.get(name) or bpy.data.collections.new(name)
        if scene.collection.children.get(name) is None:
            scene.collection.children.link(coll)
        for ob in list(coll.objects):
            bpy.data.objects.remove(ob, do_unlink=True)
        colls.append(coll)
    for store in (bpy.data.meshes, bpy.data.cameras):
        for data in list(store):
            if data.name.startswith(PREFIX) and data.users == 0:
                store.remove(data)
    scene.render.resolution_x, scene.render.resolution_y = 1536, 1024
    return scene, colls[0], colls[1], colls[2]


def material(name, rgb, rough=0.85, metal=0.0):
    m = bpy.data.materials.get(PREFIX + name) or bpy.data.materials.new(PREFIX + name)
    m.use_nodes = True
    bsdf = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Base Color"].default_value = (*rgb, 1.0)
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
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


def to_object(name, bm, coll, mat=None, smooth=False, parent=None):
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
    if parent:
        ob.parent = parent
    return ob


def smoothstep(a, b, x):
    t = max(0.0, min(1.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def bake_ao(ob, rays=16, reach=0.9, strength=1.0, seed=7, floor=0.18, moss=0.0):
    """Ambient occlusion per vertex (stored as the Col colour attribute): seams and hollows darken.
    With `moss` above 0, up-facing vertices are tinted green, patchily (the stone's top faces)."""
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
    off = Vector((seed * 1.7, seed * 2.9, seed * 0.7))
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
        m = 0.0
        if moss > 0:
            patch = 0.6 + 0.4 * noise.noise(v.co * 3.1 + off)
            m = moss * smoothstep(0.55, 0.85, n.z) * patch
        attr.data[i].color = (ao * (1 - m + m * MOSS[0]), ao * (1 - m + m * MOSS[1]), ao * (1 - m + m * MOSS[2]), 1.0)
    me.color_attributes.active_color = attr
    me.color_attributes.default_color_name = attr.name


def triangles(ob):
    """Triangles drawn by an object and its children, as exported."""
    own = sum(len(p.vertices) - 2 for p in ob.data.polygons) if ob.type == "MESH" else 0
    return own + sum(triangles(child) for child in ob.children)


def radius_xy(ob):
    """How far the piece reaches from its origin on the ground plane (stage XZ)."""
    return max(math.hypot(v.co.x, v.co.y) for v in ob.data.vertices)


# --- Stone: hulls, chipped and rounded --------------------------------------------------------

def hull_block(bm_out, points, seed, detail, chips=(1, 3), chip_depth=(0.04, 0.12), bevel=BEVEL, gap=JOINT, jitter=0.0):
    """Adds one stone to `bm_out`: the convex hull of `points`, shrunk by half a joint on each axis,
    knocked-off corners (a plane through each at a slant of its own), rounded edges (three segments
    at full detail, one flat chamfer at lod1) and a little wear along the edges. `jitter` moves each
    point by up to that share of the stone's size first, so a block is not a perfect box."""
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
    n_chips = rng.randint(*chips)
    for _ in range(n_chips):
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


def stone_piece(name, coll, mat, boxes, seed, detail, moss=0.8, ao_reach=0.45, **stone):
    """A piece made of stones, each from `boxes` (lists of 8 points) or a plain [x0..z1] box; one mesh.
    `stone` is passed on to each stone (chips, chip_depth, jitter)."""
    bm = bmesh.new()
    for k, b in enumerate(boxes):
        hull_block(bm, b if isinstance(b[0], Vector) else box(*b), seed * 100 + k, detail, **stone)
    ob = to_object(name, bm, coll, mat, smooth=None)
    bake_ao(ob, rays=12 if detail else 16, reach=ao_reach, strength=1.25, seed=seed, moss=moss)
    return ob


# --- The portal --------------------------------------------------------------------------------

def arch_boxes(seed):
    """The stones of the portal, in portal space: plinth and threshold, jamb courses to the spring,
    the voussoirs of the round head, spandrel courses and a header that breaks down toward the
    right, and the back wall the doorway is recessed into."""
    rng = random.Random(seed)
    out = []
    out.append((-2.05, -0.9, FRONT - 0.15, BACK + 0.15, 0.0, 0.3))
    out.append((0.9, 2.05, FRONT - 0.15, BACK + 0.15, 0.0, 0.3))
    out.append((-DOOR_HALF, DOOR_HALF, FRONT, BACK, 0.0, 0.14))  # the threshold
    for side in (-1, 1):
        z = 0.3
        while z < SPRING - 0.05:
            h = rng.uniform(0.5, 0.72)
            if SPRING - (z + h) < 0.35:
                h = SPRING - z
            outer = rng.uniform(1.68, 1.86)
            x0, x1 = sorted((side * DOOR_HALF, side * outer))
            out.append((x0, x1, FRONT, BACK, z, z + h))
            z += h
    # The round head: voussoirs about (0, SPRING), inner radius DOOR_HALF, outer 1.7 to 1.8.
    n = 9
    for i in range(n):
        a0, a1 = math.pi * i / n, math.pi * (i + 1) / n
        ro = rng.uniform(1.68, 1.82)
        pts = []
        for a in (a0, a1):
            for r in (DOOR_HALF, ro):
                for y in (FRONT, BACK):
                    pts.append(Vector((r * math.cos(a), y, SPRING + r * math.sin(a))))
        out.append(pts)
    # Spandrels: courses from the spring up between the head and the pier line, broken lower on the right.
    for side in (-1, 1):
        top = 4.55 if side < 0 else 3.6
        z = SPRING
        while z < top - 0.05:
            h = rng.uniform(0.45, 0.6)
            h = min(h, top - z)
            reach = math.sqrt(max(1.0, 1.82 ** 2 - (z + h - SPRING) ** 2))
            x0, x1 = sorted((side * (reach - 0.05), side * 1.95))
            if abs(x1 - x0) > 0.12:
                out.append((x0, x1, FRONT, BACK, z, z + h))
            z += h
    # The header over the head, taller on the left, one stone lost on the right.
    out.append((-1.95, -0.55, FRONT, BACK, 4.6, 5.25))
    out.append((-0.55, 0.75, FRONT, BACK, 4.6, 5.05))
    out.append((-1.8, -0.7, FRONT, BACK, 5.25, 5.7))
    out.append((0.75, 1.55, FRONT, BACK, 4.6, 4.95))
    # The wall at the back of the doorway (the membrane stands just before it) and behind the spandrels.
    out.append((-DOOR_HALF - 0.4, DOOR_HALF + 0.4, BACK_WALL, BACK, 0.0, SPRING + 0.8))
    return out


def build_arch(name, coll, mats, detail):
    return stone_piece(name, coll, mats["stone"], arch_boxes(3), 3, detail, moss=0.7, ao_reach=0.5)


def door_outline(inset, count=72):
    """The doorway's edge in portal space, a closed loop of (x, z) from the left foot round the head
    to the right foot, sampled evenly by length; `inset` shrinks it so the membrane clears the stone."""
    half = DOOR_HALF - inset
    foot = 0.16
    pts = []
    legs = SPRING - foot
    arc = math.pi * half
    total = 2 * legs + arc + 2 * half
    for i in range(count):
        s = total * i / count
        if s < half:  # along the foot, left to right ... starts at the bottom middle
            pts.append((s, foot))
        elif s < half + legs:
            pts.append((half, foot + (s - half)))
        elif s < half + legs + arc:
            a = (s - half - legs) / half
            pts.append((half * math.cos(a), SPRING + half * math.sin(a)))
        elif s < half + 2 * legs + arc:
            pts.append((-half, SPRING - (s - half - legs - arc)))
        else:
            pts.append((-half + (s - half - 2 * legs - arc), foot))
    return pts


def build_membrane(name, coll, mats, rings=8):
    """The doorway's plane: rings shrinking from the doorway's edge to its middle. UV0 is planar
    (0..1 across and up the doorway), UV1 the flow map: u round the edge (0..1), v from 0 at the
    edge to 1 at the middle."""
    inset = 0.04
    outline = door_outline(inset)
    count = len(outline)
    centre = Vector((0.0, SPRING * 0.5 + 0.1))
    bm = bmesh.new()
    uv0 = bm.loops.layers.uv.new("UVMap")
    uv1 = bm.loops.layers.uv.new("Flow")
    y = BACK_WALL - 0.05
    ring_verts = []
    for k in range(rings):
        t = k / rings
        row = []
        for (x, z) in outline:
            px = centre.x + (x - centre.x) * (1 - t)
            pz = centre.y + (z - centre.y) * (1 - t)
            row.append(bm.verts.new((px, y, pz)))
        ring_verts.append(row)
    hub = bm.verts.new((centre.x, y, centre.y))
    width, height = 2 * (DOOR_HALF - inset), SPRING + DOOR_HALF - inset - 0.16

    def planar(co):
        return ((co.x + (DOOR_HALF - inset)) / width, (co.z - 0.16) / height)

    def face(verts, flow):
        f = bm.faces.new(verts)
        for loop, (u, v) in zip(f.loops, flow):
            loop[uv0].uv = planar(loop.vert.co)
            loop[uv1].uv = (u, v)
        return f

    for k in range(rings):
        for i in range(count):
            j = (i + 1) % count
            u0, u1 = i / count, (i + 1) / count  # the last quad runs on to u = 1: the seam is per loop
            v0, v1 = k / rings, (k + 1) / rings
            if k < rings - 1:
                face([ring_verts[k][i], ring_verts[k][j], ring_verts[k + 1][j], ring_verts[k + 1][i]], [(u0, v0), (u1, v0), (u1, v1), (u0, v1)])
            else:
                face([ring_verts[k][i], ring_verts[k][j], hub], [(u0, v0), (u1, v0), ((u0 + u1) / 2, 1.0)])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    if bm.faces[0].normal.y > 0:  # faces look down -Y, toward the stage camera
        bmesh.ops.reverse_faces(bm, faces=bm.faces)
    return to_object(name, bm, coll, mats["membrane"], smooth=False)


PADLOCK_Z = 1.75  # the middle of the padlock, up the doorway
PADLOCK_Y = BACK_WALL - 0.3  # its back sits just before the membrane


def tube(bm, path, radius, sides=10):
    """A tube of constant radius along a polyline of Vectors, capped at the ends by the ring itself."""
    rings = []
    for i, p in enumerate(path):
        tangent = (path[min(i + 1, len(path) - 1)] - path[max(i - 1, 0)]).normalized()
        ref = Vector((0, 1, 0)) if abs(tangent.y) < 0.9 else Vector((1, 0, 0))
        a = tangent.cross(ref).normalized()
        b = tangent.cross(a).normalized()
        rings.append([bm.verts.new(p + (a * math.cos(2 * math.pi * s / sides) + b * math.sin(2 * math.pi * s / sides)) * radius) for s in range(sides)])
    for r0, r1 in zip(rings, rings[1:]):
        for s in range(sides):
            bm.faces.new((r0[s], r0[(s + 1) % sides], r1[(s + 1) % sides], r1[s]))
    for ring in (rings[0], rings[-1]):
        bm.faces.new(ring)


def build_padlock_body(name, coll, mats, detail):
    """The padlock without its dial ring: a rounded body, the dial's seat (a shallow disc) and the shackle."""
    bm = bmesh.new()
    w, d, h = 0.74, 0.22, 0.6
    cy = PADLOCK_Y
    hull_block(bm, box(-w / 2, w / 2, cy - d / 2, cy + d / 2, PADLOCK_Z - h / 2, PADLOCK_Z + h / 2), 71, detail, chips=(0, 0), bevel=0.05, gap=0.0)
    # The dial's seat on the front: a disc, standing 0.02 proud of the body's front face.
    seat = bmesh.ops.create_cone(bm, cap_ends=True, segments=28 if detail == 0 else 14, radius1=0.2, radius2=0.2, depth=0.04)
    bmesh.ops.rotate(bm, verts=seat["verts"], matrix=Matrix.Rotation(math.pi / 2, 3, "X"))
    bmesh.ops.translate(bm, verts=seat["verts"], vec=Vector((0, cy - d / 2 - 0.0, PADLOCK_Z)))
    # The shackle: two legs and a half circle, standing from the body's top.
    r, leg = 0.22, 0.12
    top = PADLOCK_Z + h / 2
    path = [Vector((r, cy, top - 0.04)), Vector((r, cy, top + leg))]
    for i in range(1, 13):
        a = math.pi * i / 12
        path.append(Vector((r * math.cos(a), cy, top + leg + r * math.sin(a))))
    path += [Vector((-r, cy, top + leg - 0.0)), Vector((-r, cy, top - 0.04))]
    tube(bm, path, 0.045, sides=10 if detail == 0 else 6)
    bm.normal_update()
    box_uvs(bm)
    ob = to_object(name, bm, coll, mats["lock"], smooth=None)
    return ob


def build_padlock_ring(name, coll, mats, detail):
    """The dial ring, around its own origin (the node turns about its z axis, the one facing the
    camera): an annulus with twelve tick blocks round its rim. Placed at the padlock's front."""
    bm = bmesh.new()
    seg = 36 if detail == 0 else 18
    r_in, r_out, depth = 0.11, 0.17, 0.05
    rings = []
    for y in (-depth / 2, depth / 2):
        for r in (r_in, r_out):
            rings.append([bm.verts.new((r * math.cos(2 * math.pi * i / seg), y, r * math.sin(2 * math.pi * i / seg))) for i in range(seg)])
    front_in, front_out, back_in, back_out = rings
    for i in range(seg):
        j = (i + 1) % seg
        bm.faces.new((front_in[i], front_in[j], front_out[j], front_out[i]))  # front face
        bm.faces.new((back_out[i], back_out[j], back_in[j], back_in[i]))  # back face
        bm.faces.new((front_out[i], front_out[j], back_out[j], back_out[i]))  # outer wall
        bm.faces.new((back_in[i], back_in[j], front_in[j], front_in[i]))  # inner wall
    ticks = 12 if detail == 0 else 6
    for t in range(ticks):
        a = 2 * math.pi * t / ticks
        c, s = math.cos(a), math.sin(a)
        pts = [Vector((c * r - s * x, y, s * r + c * x)) for r in (r_out - 0.005, r_out + 0.025) for x in (-0.012, 0.012) for y in (-depth / 2, depth / 2)]
        bmesh.ops.convex_hull(bm, input=[bm.verts.new(p) for p in pts], use_existing_faces=False)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    box_uvs(bm)
    ob = to_object(name, bm, coll, mats["lock"], smooth=False)
    # The ring sits on the dial seat, its front just proud of the seat; the origin is the centre.
    ob.location = (0.0, PADLOCK_Y - 0.11 - 0.025, PADLOCK_Z)
    return ob


# --- Blocks, wall, steps ----------------------------------------------------------------------

def blocks_boxes(which):
    """Large blocks, each standing on z = 0 around the origin."""
    if which == "a":  # one chunky block
        return [(-1.1, 1.1, -0.75, 0.75, 0.0, 1.3)]
    if which == "b":  # two, the upper one set back and turned a little
        top = [Vector(p) for p in box(-0.75, 0.75, -0.55, 0.55, 0.95, 1.65)]
        rot = Matrix.Rotation(0.22, 3, "Z")
        top = [rot @ p + Vector((0.2, 0.05, 0)) for p in top]
        return [(-1.05, 1.05, -0.7, 0.7, 0.0, 1.0), top]
    if which == "c":  # tall, narrower, broken at the top
        return [(-0.7, 0.7, -0.65, 0.65, 0.0, 1.2), (-0.62, 0.62, -0.58, 0.58, 1.2, 2.25)]
    # d: a wide low slab with a fallen stone beside it
    return [(-1.4, 1.2, -0.8, 0.8, 0.0, 0.85), (1.3, 1.95, -0.4, 0.45, 0.0, 0.5)]


def wall_boxes(seed):
    """A wall 4.6 long and 0.9 deep, courses of stones in a running bond, standing tall at the left
    and breaking down toward the right."""
    rng = random.Random(seed)
    out = []
    z = 0.0
    course = 0
    while z < 2.9:
        h = rng.uniform(0.45, 0.62)
        x = -2.3 + (0.0 if course % 2 == 0 else rng.uniform(0.35, 0.7))
        while x < 2.3 - 0.2:
            length = min(rng.uniform(0.85, 1.4), 2.3 - x)
            if length < 0.3:
                break
            xm = x + length / 2
            limit = 2.9 - (xm + 2.3) * 0.43 + 0.5 * noise.noise(Vector((xm * 0.9, course * 1.3, 4.1)))
            if z + 0.2 < limit:
                top = min(z + h, limit + 0.12)
                out.append((x, x + length, -0.45 + rng.uniform(-0.03, 0.03), 0.45 + rng.uniform(-0.03, 0.03), z, top))
            x += length
        z += h
        course += 1
    return out


def steps_boxes(seed):
    """Five broad steps climbing toward +Y (the back), each a block from the floor to its tread."""
    rng = random.Random(seed)
    out = []
    for k in range(5):
        y0 = -1.75 + 0.72 * k
        top = 0.3 * (k + 1) + rng.uniform(-0.02, 0.03)
        w0, w1 = -1.4 + rng.uniform(-0.1, 0.05), 1.4 + rng.uniform(-0.05, 0.1)
        if k in (1, 3):
            mid = rng.uniform(-0.3, 0.3)
            out.append((w0, mid, y0, 1.9, 0.0, top))
            out.append((mid, w1, y0 + rng.uniform(-0.05, 0.05), 1.9, 0.0, top + rng.uniform(-0.04, 0.0)))
        else:
            out.append((w0, w1, y0, 1.9, 0.0, top))
    return out


# --- Rocks, coral, plants ---------------------------------------------------------------------

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
        v.co = p * (1.0 + 0.3 * n + 0.22 * facet + 0.025 * crag)
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


def build_coral(name, coll, seed, mats, size=1.0, smooth_levels=1):
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
    ob.data.materials.append(mats["coral"])
    return ob


def build_glowplant(name, coll, seed, mats, stems, height, smooth_levels=1):
    """A bioluminescent sprig: a few stalks that arc outward and up, each ending in a bulb, a thin
    side shoot or two with their own small bulbs; the tips glow (Col, brighter with height)."""
    rng = random.Random(seed)
    verts = [Vector((0, 0, 0))]
    edges = []
    radii = [0.03]

    def stalk(start, d, length, r, bulb, depth):
        i = start
        pos = verts[i].copy()
        steps = 6
        for s in range(steps):
            d = (d + Vector((rng.uniform(-0.12, 0.12), rng.uniform(-0.12, 0.12), 0.0)) * 0.5 + Vector((0, 0, 0.1))).normalized()
            pos = pos + d * (length / steps)
            verts.append(pos.copy())
            edges.append((i, len(verts) - 1))
            radii.append(max(r * (1 - 0.55 * (s + 1) / steps), 0.016))
            i = len(verts) - 1
        # The bulb: the skin swells to a blob just past the stalk's end, and closes at its tip.
        verts.append(pos + d * bulb * 0.9)
        edges.append((i, len(verts) - 1))
        radii.append(bulb)
        verts.append(pos + d * bulb * 1.9)
        edges.append((len(verts) - 2, len(verts) - 1))
        radii.append(bulb * 0.35)
        if depth > 0 and length > 0.25:
            for _ in range(rng.choice((1, 2))):
                at = start + 1 + rng.randint(2, 4)
                side = Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), 0.5)).normalized()
                stalk(at, side, length * rng.uniform(0.35, 0.5), r * 0.55, bulb * 0.7, depth - 1)

    for k in range(stems):
        a = 2 * math.pi * k / stems + rng.uniform(-0.3, 0.3)
        lean = rng.uniform(0.25, 0.7)
        d = Vector((math.cos(a) * lean, math.sin(a) * lean, 1.0)).normalized()
        stalk(0, d, height * rng.uniform(0.75, 1.0), 0.04, rng.uniform(0.08, 0.11), 1)
    ob = skin_object(name, coll, verts, edges, radii, smooth_levels)
    glow_by_height(ob, floor=0.28, power=1.1)
    ob.data.materials.append(mats["plant"])
    return ob


# --- The layout --------------------------------------------------------------------------------

def read_layout():
    return json.loads(LAYOUT.read_text(encoding="utf-8"))


def check_layout(layout, built):
    named = {p["piece"] for group in layout["groups"].values() for p in group}
    if layout["chains"]:
        named.add("chain")
    missing = sorted(named - set(built))
    if missing:
        raise RuntimeError(f"layout.json names pieces the kit does not build: {missing}")


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


def lay_out(layout, coll, pieces):
    """The world as layout.json places it, from linked copies of the full pieces, with a floor and a
    camera, for looking at it in Blender. Coral drops onto the highest stone below it, or the floor."""
    floor_y = layout["floorY"]
    solids = []

    def place(piece, matrix, label):
        ob = bpy.data.objects.new(f"{PREFIX}world.{label}", pieces[piece].data)
        ob.matrix_world = matrix
        coll.objects.link(ob)
        return ob

    for group, items in layout["groups"].items():
        if group == "corals":
            continue
        for i, p in enumerate(items):
            ob = place(p["piece"], stage_matrix(p), f"{group}{i}")
            mw = ob.matrix_world
            solids.append(BVHTree.FromPolygons([mw @ v.co for v in ob.data.vertices], [tuple(q.vertices) for q in ob.data.polygons]))
    for i, p in enumerate(layout["groups"].get("corals", [])):
        x, _, z = p["position"]
        hits = [t.ray_cast(Vector((x, -z, 8.0)), Vector((0, 0, -1)))[0] for t in solids]
        y = max([h.z for h in hits if h is not None] + [floor_y]) - 0.04
        place(p["piece"], stage_matrix(p, y), f"corals{i}")
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=1.0)
    bmesh.ops.transform(bm, matrix=Matrix.Translation((0, -10, floor_y)) @ Matrix.Diagonal((13, 36, 1, 1)), verts=bm.verts)
    to_object("world.floor", bm, coll, smooth=False)
    cam_data = bpy.data.cameras.get(PREFIX + "stage") or bpy.data.cameras.new(PREFIX + "stage")
    fits = [i.identifier for i in bpy.types.Camera.bl_rna.properties["sensor_fit"].enum_items]
    cam_data.sensor_fit = next(f for f in fits if f.startswith("VERT"))
    cam_data.angle_y = math.radians(23.57)
    cam = bpy.data.objects.new(PREFIX + "world.stage_camera", cam_data)
    cam.location = (0.0, -12.0, 0.0)
    cam.rotation_euler = (math.pi / 2, 0.0, 0.0)
    coll.objects.link(cam)
    return cam


def workbench(scene, path, width, height):
    """Workbench settings for a quick look: studio light, the Col colours, a dark teal sky."""
    scene.render.resolution_x, scene.render.resolution_y = width, height
    scene.render.engine = "BLENDER_WORKBENCH"  # the enum lists only the engine in use; assigning an unknown one names the valid ones
    shading = scene.display.shading
    shading.light = "STUDIO"
    shading.color_type = "VERTEX"
    shading.show_cavity = True
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = str(path)
    world = bpy.data.worlds.get(PREFIX + "sheet") or bpy.data.worlds.new(PREFIX + "sheet")
    world.use_nodes = False
    world.color = (0.02, 0.06, 0.07)
    scene.world = world


def render_world(scene, world_coll, path):
    """The layout from the stage camera (placed as the page frames it, without the lean), Workbench. Not exported."""
    workbench(scene, path, 1200, 800)
    for c in scene.collection.children:
        c.hide_render = c.name != WORLD
    with bpy.context.temp_override(scene=scene):
        bpy.ops.render.render(write_still=True)
    print(f"layout preview: {path}")


def contact_sheet(scene, coll, pieces, nodes, path):
    """Renders every piece in a row-and-column grid, fronts to the camera, with Workbench. Not exported."""
    columns = 5
    cell = 5.2
    rows = math.ceil((len(pieces) + 1) / columns)

    for k, (name, ob) in enumerate(pieces.items()):
        col, row = k % columns, k // columns
        c = bpy.data.objects.new(f"{PREFIX}sheet.{name}", ob.data)
        coll.objects.link(c)
        c.location = ((col - (columns - 1) / 2) * cell, 0, -row * cell)
        scale = 0.55 if name in ("arch", "wall_broken") else 1.0
        c.scale = (scale, scale, scale)
    # The portal's other parts, in the arch's frame, beside the first row.
    k = len(pieces)
    col, row = k % columns, k // columns
    for name, ob in nodes.items():
        c = bpy.data.objects.new(f"{PREFIX}sheet.{name}", ob.data)
        coll.objects.link(c)
        c.matrix_world = Matrix.Translation(((col - (columns - 1) / 2) * cell, 0, -row * cell)) @ Matrix.Scale(1.0, 4) @ ob.matrix_basis
    cam_data = bpy.data.cameras.new(PREFIX + "sheet")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = columns * cell * 1.02
    cam = bpy.data.objects.new(PREFIX + "sheet.camera", cam_data)
    # Looks at the fronts (they face -Y) from a little above, so the moss on the top faces shows.
    pitch = math.radians(24)
    cam.rotation_euler = (math.pi / 2 - pitch, 0.0, 0.0)
    target = Vector((0.0, 0.0, -(rows - 1) * cell / 2 + 1.6))
    cam.location = target + Vector((0.0, -30.0 * math.cos(pitch), 30.0 * math.sin(pitch)))
    coll.objects.link(cam)
    scene.camera = cam
    workbench(scene, path, 1800, int(1800 * rows / columns) + 80)
    # Hide the exported pieces and the layout preview from the render.
    for c in scene.collection.children:
        c.hide_render = c.name != SHEET
    with bpy.context.temp_override(scene=scene):
        bpy.ops.render.render(write_still=True)
    print(f"contact sheet: {path}")


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
    """Drops PREFIX from the glb's node, mesh and material names: the page asks for `arch`, not `veyra.arch`."""
    def drop(doc):
        for group in ("nodes", "meshes", "materials"):
            for item in doc.get(group, []):
                if item.get("name", "").startswith(PREFIX):
                    item["name"] = item["name"][len(PREFIX):]
    edit_glb_json(path, drop)


def export(coll, raw=RAW):
    raw.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(raw),
        collection=coll.name,
        export_format="GLB",
        export_apply=True,
        export_yup=True,
        export_extras=True,
        export_vertex_color="ACTIVE",
        export_materials="EXPORT",
        export_normals=True,
    )
    strip_prefix(raw)


def gltf_transform(*args):
    """Runs the repo's own gltf-transform (npx --no-install: never a download), with KTX-Software
    on the PATH for its KTX2 commands."""
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
    """Meshopt geometry (what the engine's kit loader decodes) and KTX2 textures, keeping the structure the page reads."""
    out.parent.mkdir(parents=True, exist_ok=True)
    gltf_transform("optimize", raw, out, "--compress", "meshopt", "--texture-compress", TEXTURE_COMPRESS, *KEEP_STRUCTURE)


def check_output(path, wanted):
    """The glb names every piece (and each placed piece its lod1), the membrane has two UV sets and
    every placed piece carries its radius."""
    data = path.read_bytes()
    size = struct.unpack_from("<I", data, 12)[0]
    doc = json.loads(data[20:20 + size])
    names = {n.get("name"): n for n in doc["nodes"]}
    missing = [n for n in wanted if n not in names]
    assert not missing, f"the kit lacks {missing}"
    for piece in PLACED:
        assert piece + LOD1 in names, f"{piece} has no lod1"
        assert "radius" in names[piece].get("extras", {}), f"{piece} carries no radius"
    prim = doc["meshes"][names["membrane"]["mesh"]]["primitives"][0]["attributes"]
    assert "TEXCOORD_0" in prim and "TEXCOORD_1" in prim, f"the membrane has {sorted(prim)}"
    print(f"checked {path}: {len(names)} nodes, membrane UV sets {[k for k in prim if k.startswith('TEXCOORD')]}")


# --- Build -------------------------------------------------------------------------------------

def arguments():
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    paths = {}
    for flag in ("--sheet", "--preview"):
        if flag in args:
            k = args.index(flag)
            paths[flag] = Path(args[k + 1]).resolve()
            del args[k:k + 2]
    return (Path(args[0]) if args else DEFAULT_OUT), paths.get("--sheet"), paths.get("--preview")


def build_pieces(pieces_coll):
    """Every piece and its lod1 into `pieces_coll`: {name: (full, lod1)}; the portal's nodes come with
    `None` for a lod1."""
    mats = {
        "stone": material("kit_stone", (0.16, 0.22, 0.2), 0.9),
        "rock": material("kit_rock", (0.05, 0.07, 0.09), 0.7),
        "coral": material("kit_coral", (0.9, 0.55, 0.1), 0.5),
        "plant": material("kit_plant", (0.1, 0.8, 0.5), 0.5),
        "lock": material("kit_lock", (0.75, 0.8, 0.85), 0.35, 0.6),
        "membrane": material("kit_membrane", (0.1, 0.8, 0.9), 0.3),
    }
    built = {}

    def both(name, fn):
        built[name] = (fn(name, 0), fn(name + LOD1, 1))

    both("arch", lambda n, d: build_arch(n, pieces_coll, mats, d))
    for letter in "abcd":
        both(f"block_{letter}", lambda n, d, letter=letter: stone_piece(n, pieces_coll, mats["stone"], blocks_boxes(letter), ord(letter), d, chips=(3, 5), chip_depth=(0.12, 0.34), jitter=0.06, bevel=0.05))
    both("wall_broken", lambda n, d: stone_piece(n, pieces_coll, mats["stone"], wall_boxes(5), 5, d, moss=0.7, ao_reach=0.5, chips=(1, 3), chip_depth=(0.05, 0.16), jitter=0.025))
    both("steps", lambda n, d: stone_piece(n, pieces_coll, mats["stone"], steps_boxes(8), 8, d, moss=0.85, chips=(1, 3), chip_depth=(0.08, 0.2), jitter=0.02))
    rocks = (("rock_a", 41, (1.0, 0.9, 0.75)), ("rock_b", 42, (0.8, 1.0, 0.9)), ("rock_c", 43, (1.2, 0.85, 0.6)))
    for name, seed, scale in rocks:
        both(name, lambda n, d, seed=seed, scale=scale: build_rock(n, pieces_coll, seed, scale, mats, 4 - d))
    both("coral_orange", lambda n, d: build_coral(n, pieces_coll, 31, mats, 1.0, 1 - d))
    both("glowplant_a", lambda n, d: build_glowplant(n, pieces_coll, 51, mats, 6, 0.9, 1 - d))
    both("glowplant_b", lambda n, d: build_glowplant(n, pieces_coll, 52, mats, 4, 0.65, 1 - d))
    for name in PLACED:
        built[name][0]["radius"] = round(radius_xy(built[name][0]), 4)
    built["membrane"] = (build_membrane("membrane", pieces_coll, mats), None)
    built["padlock_body"] = (build_padlock_body("padlock_body", pieces_coll, mats, 0), None)
    built["padlock_ring"] = (build_padlock_ring("padlock_ring", pieces_coll, mats, 0), None)
    return built


def build():
    out, sheet, preview = arguments()
    scene, pieces_coll, world_coll, sheet_coll = kit_scene()
    # Everything below evaluates and exports the kit's own scene, whatever scene Blender shows.
    with bpy.context.temp_override(scene=scene, view_layer=scene.view_layers[0]):
        build_in(scene, pieces_coll, world_coll, sheet_coll, out, sheet, preview)


def build_in(scene, pieces_coll, world_coll, sheet_coll, out, sheet, preview):
    built = build_pieces(pieces_coll)
    layout = read_layout()
    check_layout(layout, built)
    full = {name: pair[0] for name, pair in built.items()}
    scene.camera = lay_out(layout, world_coll, full)
    export(pieces_coll)
    raw = RAW.stat().st_size
    compress(RAW, out)
    check_output(out, PLACED + NODES)
    for name, (piece, far) in built.items():
        lod = f", lod1 {triangles(far)} ({triangles(far) / triangles(piece):.0%})" if far else ""
        extra = f", radius {piece['radius']}" if "radius" in piece.keys() else ""
        print(f"{name}: {triangles(piece)} triangles{lod}{extra}")
    print("pieces:", ", ".join(PLACED), "| nodes:", ", ".join(NODES))
    print(f"exported {out}: {raw} bytes raw, {out.stat().st_size} bytes compressed")
    if preview:
        preview.parent.mkdir(parents=True, exist_ok=True)
        render_world(scene, world_coll, preview)
    if sheet:
        sheet.parent.mkdir(parents=True, exist_ok=True)
        contact_sheet(scene, sheet_coll, {n: full[n] for n in PLACED}, {n: full[n] for n in NODES}, sheet)


if __name__ == "__main__":
    build()
