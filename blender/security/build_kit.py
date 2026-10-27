"""The security world's kit: rune pillars of large carved blocks with glyph panels, boulders,
coral and a chain. Each piece also comes as `<piece>_lod1`, about a quarter of its triangles,
for far use. Everything is built by this script from its seeds; nothing is hand-modelled.

Run in Blender 5.2, either from a shell:
    blender --background --python blender/security/build_kit.py
or inside a running Blender (Blender MCP):
    p = "<repo>/blender/security/build_kit.py"
    exec(compile(open(p).read(), p, "exec"), {"__file__": p, "__name__": "__main__"})

It rebuilds the "NoxKit security" scene from scratch and touches nothing outside it. It reads the
world's layout, src/nox3d/world/security/layout.json (the same file the page imports), checks
that every piece the layout names is built, and lays the corridor out in a preview collection
that is not exported. Then it exports the pieces and compresses them with gltf-transform into
public/nox/world/security/kit.glb.

Units: 1 = one stage unit (100 storyboard px). Pieces stand on z = 0 at the origin with their
front faces looking down -Y, which glTF's Y-up export turns into +Z, toward the stage camera.
They are exported at the origin because the page places them: compression moves each mesh into
a [-1, 1] box and puts the inverse in its node's transform, so the page keeps that transform
inside its own placement and never overwrites it.
"""
import json
import math
import os
import random
import struct
import subprocess
import tempfile
from pathlib import Path

import bmesh
import bpy
from mathutils import Matrix, Vector, noise
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parents[2]
LAYOUT = ROOT / "src/nox3d/world/security/layout.json"
OUT = ROOT / "public/nox/world/security/kit.glb"
RAW = Path(tempfile.gettempdir()) / "nox-kit-security-raw.glb"

SCENE = "NoxKit security"
PIECES = "NoxKit security pieces"  # exported
WORLD = "NoxKit security world"  # the layout, for looking at the corridor in Blender; not exported
# Blender names must be unique in the file; the prefix is stripped from the exported node names.
PREFIX = "nox."
LOD1 = "_lod1"

# Textures compress to KTX2 (Basis), which gltf-transform makes with KTX-Software's `ktx create`
# (4.3 or later); it insists on finding `ktx` even when, as today, the kit carries no textures
# (the page makes its stone and glyph maps). A Blender started before KTX-Software was installed
# lacks it on its PATH, so the default install folder is added (or set KTX_SOFTWARE_BIN).
TEXTURE_COMPRESS = "ktx2"
KTX_BIN = os.environ.get("KTX_SOFTWARE_BIN", r"C:\Program Files\KTX-Software\bin")
# gltf-transform optimize defaults that would break what the page reads: flatten and join would
# merge the pieces and their glyph panels into a few anonymous meshes (the page finds pieces and
# panels by node name and hierarchy); palette would rewrite the UVs; prune-attributes would drop
# the stone's box UVs (no texture in the file uses them); simplify would change the authored LODs.
KEEP_STRUCTURE = [
    "--flatten", "false", "--join", "false", "--instance", "false", "--palette", "false",
    "--simplify", "false", "--prune-attributes", "false",
]


# --- Scene -------------------------------------------------------------------------------------

def kit_scene():
    """The kit's own scene and its two collections, emptied of what an earlier run made."""
    scene = bpy.data.scenes.get(SCENE) or bpy.data.scenes.new(SCENE)
    colls = []
    for name in (PIECES, WORLD):
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
    return scene, colls[0], colls[1]


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
    `offset` maps a face to a UV shift, so each stone block shows its own patch of grain."""
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


def bake_ao(ob, rays=24, reach=0.9, strength=1.0, seed=7, floor=0.18):
    """Ambient occlusion per vertex (stored as the Col colour attribute): seams and hollows darken."""
    me = ob.data
    rng = random.Random(seed)
    tree = BVHTree.FromPolygons([v.co.copy() for v in me.vertices], [tuple(p.vertices) for p in me.polygons], all_triangles=False)
    # Cosine-weighted directions over the +Z hemisphere.
    dirs = []
    for _ in range(rays):
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


def triangles(ob):
    """Triangles drawn by an object and its children, as exported."""
    own = sum(len(p.vertices) - 2 for p in ob.data.polygons) if ob.type == "MESH" else 0
    return own + sum(triangles(child) for child in ob.children)


# --- Pillars: large carved blocks --------------------------------------------------------------

PILLAR_W, PILLAR_D = 1.1, 1.0
JOINT = 0.022  # the dark gap between neighbouring blocks
BEVEL = 0.03
RECESS_DEPTH = 0.05
# A glyph panel's size range (width, height). Each panel draws its own size from a hash of its
# pillar's seed and its index, so no two neighbours match.
PANEL_W = (0.42, 0.64)
PANEL_H = (0.5, 0.78)
PANEL_MARGIN = 0.09  # least stone between a panel and its block's top or bottom


def panel_hash(seed, index, salt):
    """0..1, the same on every run for one panel (a string seed is hashed with SHA-512)."""
    return random.Random(f"{seed}:{index}:{salt}").random()


class Block:
    """One stone: where it sits in the pillar, how it is turned, its chipped corners and, if it
    carries a glyph, the panel recessed into its front face (all in pillar units, z up)."""

    def __init__(self, rng, x0, x1, y0, y1, z0, z1, panel=None, lean=(0.0, 0.0)):
        self.size = Vector((x1 - x0 - JOINT, y1 - y0 - JOINT, z1 - z0 - JOINT))
        self.centre = Vector(((x0 + x1) / 2 + rng.uniform(-0.016, 0.016), (y0 + y1) / 2 + rng.uniform(-0.016, 0.016), (z0 + z1) / 2))
        self.turn = rng.uniform(-0.022, 0.022)
        self.lean = lean
        # The panel: width, height and its centre's height in the pillar; it sits on the front face.
        self.panel = panel
        self.uv = (rng.uniform(0, 7), rng.uniform(0, 7))
        # Knocked-off corners: a plane through each, at a slant of its own. A carved block keeps
        # its front corners near the panel, so those chips stay shallow.
        self.chips = []
        for _ in range(rng.choice((1, 1, 2, 2, 3))):
            corner = Vector((rng.choice((-1, 1)), rng.choice((-1, 1)), rng.choice((-1, 1))))
            depth = rng.uniform(0.06, 0.17)
            if panel and corner.y < 0:
                depth = min(depth, 0.07)
            slant = Vector((corner.x * rng.uniform(0.7, 1.3), corner.y * rng.uniform(0.7, 1.3), corner.z * rng.uniform(0.7, 1.3)))
            self.chips.append((corner, slant.normalized(), depth))

    def matrix(self):
        return (
            Matrix.Translation(self.centre)
            @ Matrix.Rotation(self.turn, 4, "Z")
            @ Matrix.Rotation(self.lean[0], 4, "X")
            @ Matrix.Rotation(self.lean[1], 4, "Y")
        )


def pillar_plan(seed, height, cells):
    """The blocks of one pillar, decided once so that both levels of detail share them: a wide
    plinth, plain courses, one block per glyph panel (its centre where `cells` puts it), plain
    courses again, and a ruined top that loses stones toward the break."""
    rng = random.Random(seed)
    blocks = []

    def course(z0, z1, scale=1.0, split=None, panel=None, keep=1.0):
        w, d = PILLAR_W * scale, PILLAR_D * scale
        x0, x1, y0, y1 = -w / 2, w / 2, -d / 2, d / 2
        if split == "x":
            s = x0 + w * rng.uniform(0.36, 0.64)
            parts = [(x0, s, y0, y1), (s, x1, y0, y1)]
        elif split == "y":
            s = y0 + d * rng.uniform(0.45, 0.66)
            parts = [(x0, x1, y0, s), (x0, x1, s, y1)]
        else:
            parts = [(x0, x1, y0, y1)]
        kept = [p for p in parts if rng.random() < keep] or ([parts[0]] if keep >= 0.5 else [])
        for k, (a, b, c, e) in enumerate(kept):
            # The front stone (lowest y) carries the panel.
            blocks.append(Block(rng, a, b, c, e, z0, z1, panel if c == y0 and k == 0 else None))

    def plain(z0, z1, ruin_from=math.inf):
        z = z0
        while z < z1 - 0.05:
            h = rng.uniform(0.4, 0.78)
            if z1 - (z + h) < 0.3:
                h = z1 - z
            keep = 1.0 - 0.8 * max(0.0, (z - ruin_from) / (height - ruin_from)) if ruin_from < height else 1.0
            course(z, z + h, split=rng.choice((None, None, "x", "x", "y")), keep=keep)
            z += h
        return z

    # Plinth: two broad courses.
    course(0.0, 0.26, scale=1.24, split=rng.choice((None, "x")))
    course(0.26, 0.46, scale=1.12)
    base = 0.46
    panels = [
        (PANEL_W[0] + (PANEL_W[1] - PANEL_W[0]) * panel_hash(seed, j, "w"), PANEL_H[0] + (PANEL_H[1] - PANEL_H[0]) * panel_hash(seed, j, "h"), zc)
        for j, zc in enumerate(cells)
    ]
    # Joints between glyph blocks fall anywhere that leaves both panels their margin.
    joints = [panels[0][2] - panels[0][1] / 2 - rng.uniform(0.1, 0.22)]
    for (_, h0, z0), (_, h1, z1) in zip(panels, panels[1:]):
        lo, hi = z0 + h0 / 2 + PANEL_MARGIN, z1 - h1 / 2 - PANEL_MARGIN
        joints.append(rng.uniform(lo, hi))
    joints.append(panels[-1][2] + panels[-1][1] / 2 + rng.uniform(0.1, 0.22))
    if joints[0] - base < 0.3:
        joints[0] = base
    else:
        plain(base, joints[0])
    for j, panel in enumerate(panels):
        course(joints[j], joints[j + 1], split=rng.choice((None, None, "y")), panel=panel)
    plain(joints[-1], height - 0.1, ruin_from=max(joints[-1], height - 1.2))
    # A broken stone left leaning on the highest stone still standing.
    support = max(blocks, key=lambda b: b.centre.z + b.size.z / 2)
    top = support.centre.z + support.size.z / 2
    lean = (rng.uniform(-0.12, 0.12), rng.uniform(0.06, 0.14) * rng.choice((-1, 1)))
    w, d, h = PILLAR_W * rng.uniform(0.5, 0.7), PILLAR_D * rng.uniform(0.55, 0.75), rng.uniform(0.26, 0.38)
    cx = max(-0.2, min(0.2, support.centre.x + rng.uniform(-0.1, 0.1)))
    # Sunk by what the lean lifts its underside, so it rests on an edge instead of hovering.
    sink = abs(math.sin(lean[1])) * w / 2 + abs(math.sin(lean[0])) * d / 2
    blocks.append(Block(rng, cx - w / 2, cx + w / 2, -d / 2, d / 2, top - 0.03 - sink, top - 0.03 - sink + h, lean=lean))
    return blocks, panels


def carve_block(bm_out, block, detail, seed):
    """Adds one block to `bm_out`: a box, the glyph recess cut into its front, chipped corners,
    rounded edges (three segments at full detail, one flat chamfer at lod1) and a little wear
    along the edges. Returns the panel's quad on the recess floor (block-local corners), if any."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=block.size, verts=bm.verts)
    sx, sy, sz = block.size / 2
    floor = None
    if block.panel:
        pw, ph, pz = block.panel
        cz = pz - block.centre.z
        bm.faces.ensure_lookup_table()
        front = next(f for f in bm.faces if f.calc_center_median().y < -sy + 1e-4)
        bmesh.ops.inset_individual(bm, faces=[front], thickness=0.05)
        # The inset face becomes the panel's exact rectangle, then is pushed back into the stone.
        for v in front.verts:
            v.co.x = math.copysign(pw / 2, v.co.x)
            v.co.z = cz + math.copysign(ph / 2, v.co.z)
        walls = bmesh.ops.extrude_discrete_faces(bm, faces=[front])["faces"]
        for v in walls[0].verts:
            v.co.y += RECESS_DEPTH
        # The panel fills the floor inside the rounded foot of the recess walls.
        qw, qh = pw / 2 - 0.02, ph / 2 - 0.02
        floor = [Vector((x * qw, -sy + RECESS_DEPTH - 0.004, cz + z * qh)) for x, z in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    for corner, slant, depth in block.chips:
        tip = Vector((corner.x * sx, corner.y * sy, corner.z * sz))
        cut = bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], dist=1e-5, plane_co=tip - slant * depth, plane_no=slant, clear_outer=True)
        rim = [e for e in cut["geom_cut"] if isinstance(e, bmesh.types.BMEdge)]
        if rim:
            bmesh.ops.holes_fill(bm, edges=rim, sides=0)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    sharp = [e for e in bm.edges if e.is_manifold and e.calc_face_angle(0) > math.radians(25)]
    rounded = bmesh.ops.bevel(bm, geom=sharp, offset=BEVEL, segments=3 if detail == 0 else 1, profile=0.5, affect="EDGES", clamp_overlap=True)
    # The cut faces shade flat; only the rounded edges between them shade smooth.
    for f in rounded["faces"]:
        f.smooth = True
    # Wear: the stone gives a little along its edges. The same field at both levels, so the faces
    # and their outlines agree; only the rounded edges in between are lost at lod1.
    bm.normal_update()
    off = Vector((seed * 3.7, seed * 1.3, seed * 5.1))
    for v in bm.verts:
        dent = max(0.0, noise.noise(v.co * 5.0 + off)) * 0.014 + noise.noise(v.co * 13.0 + off) * 0.003
        v.co -= v.normal * dent
    bmesh.ops.transform(bm, matrix=block.matrix(), verts=bm.verts)
    # Each stone shows its own patch of grain.
    box_uvs(bm, offset=lambda f: block.uv)
    me = bpy.data.meshes.new(PREFIX + "block")
    bm.to_mesh(me)
    bm.free()
    bm_out.from_mesh(me)  # appends: repeated calls join the blocks
    bpy.data.meshes.remove(me)
    return floor


def build_pillar(name, coll, seed, height, cells, mats, detail):
    """A rune pillar: a stack of large carved blocks, a glyph panel cut into the front of one
    block per cell, as panel 2 has them. Glyph panels are child quads named `<name>_glyph<j>`."""
    blocks, panels = pillar_plan(seed, height, cells)
    bm = bmesh.new()
    floors = []
    for k, block in enumerate(blocks):
        floor = carve_block(bm, block, detail, seed * 100 + k)
        if floor:
            floors.append((block, floor))
    ob = to_object(name, bm, coll, mats["stone"], smooth=None)
    bake_ao(ob, rays=16, reach=0.35, strength=1.25)
    for j, (block, floor) in enumerate(floors):
        g = bmesh.new()
        m = block.matrix()
        face = g.faces.new([g.verts.new(m @ co) for co in floor])
        face.normal_update()
        if face.normal.y > 0:
            face.normal_flip()
        # UVs run 0 to 1 across the quad, v up the face (glTF export turns it top-down).
        uv = g.loops.layers.uv.new("UVMap")
        x0, x1 = min(c.x for c in floor), max(c.x for c in floor)
        z0, z1 = min(c.z for c in floor), max(c.z for c in floor)
        local = m.inverted()
        for loop in face.loops:
            co = local @ loop.vert.co
            loop[uv].uv = ((co.x - x0) / (x1 - x0), (co.z - z0) / (z1 - z0))
        to_object(f"{name}_glyph{j}", g, coll, mats["glyph"], parent=ob)
    return ob, sum(p[2] for p in panels) / len(panels)


# --- Rocks, coral, chain (as in the test scene, each with a lighter lod1) -----------------------

def build_rock(name, coll, seed, scale, mats, detail=5):
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
    bake_ao(ob, reach=0.5 * max(scale), strength=1.3)
    return ob


def build_coral(name, coll, seed, mats, size=1.0, smooth_levels=1):
    """Branching coral: a grown skeleton thickened by the Skin modifier, tips brighter (Col).
    The full piece is smoothed once (four times the faces); lod1 keeps the bare skin."""
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
        sub = ob.modifiers.new("Smooth", "SUBSURF")
        sub.levels = smooth_levels
    # Bake the modifiers into the mesh, then colour by height: dim base, glowing tips.
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
        t = max(0.0, v.co.z / top)
        g = 0.32 + 0.68 * t ** 1.4
        attr.data[i].color = (g, g, g, 1.0)
    baked.color_attributes.active_color = attr
    baked.materials.append(mats["coral"])
    return ob


def build_chain(name, coll, mats, links=30, big_r=0.1, small_r=0.026, stretch=1.6, pitch=0.175, nu=14, nv=8):
    """Interlocking oval links along +Z, each turned a quarter from the last. `nu` x `nv` is
    each link's ring and tube resolution; halving both is a quarter of the faces."""
    bm = bmesh.new()
    for i in range(links):
        rot = Matrix.Rotation(math.pi / 2 if i % 2 else 0.0, 4, "Z")
        ring = []
        for a in range(nu):
            th = 2 * math.pi * a / nu
            row = []
            for b in range(nv):
                ph = 2 * math.pi * b / nv
                x = (big_r + small_r * math.cos(ph)) * math.cos(th)
                z = (big_r + small_r * math.cos(ph)) * math.sin(th) * stretch
                y = small_r * math.sin(ph)
                row.append(bm.verts.new(rot @ Vector((x, y, z)) + Vector((0, 0, i * pitch))))
            ring.append(row)
        for a in range(nu):
            for b in range(nv):
                bm.faces.new((ring[a][b], ring[(a + 1) % nu][b], ring[(a + 1) % nu][(b + 1) % nv], ring[a][(b + 1) % nv]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return to_object(name, bm, coll, mats["iron"], smooth=True)


# --- The layout --------------------------------------------------------------------------------

def read_layout():
    return json.loads(LAYOUT.read_text(encoding="utf-8"))


def check_layout(layout, built):
    named = {p["piece"] for group in ("pillars", "rocks", "corals") for p in layout[group]}
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
    """The corridor as layout.json places it, from linked copies of the full pieces, with a floor
    and panel 2's camera, for looking at the world in Blender. Coral drops onto the rocks below."""
    def place(piece, matrix, label):
        source = pieces[piece]
        ob = bpy.data.objects.new(f"{PREFIX}world.{label}", source.data)
        ob.matrix_world = matrix
        coll.objects.link(ob)
        for child in source.children:
            c = bpy.data.objects.new(f"{PREFIX}world.{label}.{child.name[len(PREFIX):]}", child.data)
            coll.objects.link(c)
            c.parent = ob
        return ob

    for i, p in enumerate(layout["pillars"]):
        place(p["piece"], stage_matrix(p), f"pillar{i}")
    rocks = [place(p["piece"], stage_matrix(p), f"rock{i}") for i, p in enumerate(layout["rocks"])]
    trees = []
    for ob in rocks:
        mw = ob.matrix_world
        trees.append(BVHTree.FromPolygons([mw @ v.co for v in ob.data.vertices], [tuple(q.vertices) for q in ob.data.polygons]))
    floor_y = layout["floorY"]
    for i, p in enumerate(layout["corals"]):
        x, _, z = p["position"]
        hits = [t.ray_cast(Vector((x, -z, 8.0)), Vector((0, 0, -1)))[0] for t in trees]
        y = max([h.z for h in hits if h is not None] + [floor_y]) - 0.04
        place(p["piece"], stage_matrix(p, y), f"coral{i}")
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=1.0)
    bmesh.ops.transform(bm, matrix=Matrix.Translation((0, 14, floor_y)) @ Matrix.Diagonal((9, 22, 1, 1)), verts=bm.verts)
    to_object("world.floor", bm, coll, smooth=False)
    cam_data = bpy.data.cameras.get(PREFIX + "panel2") or bpy.data.cameras.new(PREFIX + "panel2")
    fits = [i.identifier for i in bpy.types.Camera.bl_rna.properties["sensor_fit"].enum_items]
    cam_data.sensor_fit = next(f for f in fits if f.startswith("VERT"))
    cam_data.angle_y = math.radians(23.57)
    cam = bpy.data.objects.new(PREFIX + "world.panel2_camera", cam_data)
    # Panel 2's camera at stage (-0.076, -0.081, 12), looking down stage -Z (Blender +Y).
    cam.location = (-0.076, -12.0, -0.081)
    cam.rotation_euler = (math.pi / 2, 0.0, 0.0)
    coll.objects.link(cam)
    return cam


# --- Export ------------------------------------------------------------------------------------

def strip_prefix(path):
    """Drops PREFIX from the glb's node and mesh names: the page asks for `pillar_a`, not `nox.pillar_a`."""
    data = bytearray(path.read_bytes())
    json_len = struct.unpack_from("<I", data, 12)[0]
    doc = json.loads(data[20:20 + json_len])
    for group in ("nodes", "meshes", "materials"):
        for item in doc.get(group, []):
            if item.get("name", "").startswith(PREFIX):
                item["name"] = item["name"][len(PREFIX):]
    text = json.dumps(doc, separators=(",", ":")).encode("utf-8")
    text += b" " * (-len(text) % 4)
    rest = data[20 + json_len:]
    out = struct.pack("<III", 0x46546C67, 2, 12 + 8 + len(text) + len(rest)) + struct.pack("<II", len(text), 0x4E4F534A) + text + rest
    path.write_bytes(out)


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


def compress():
    cmd = ["npx", "gltf-transform", "optimize", str(RAW), str(OUT), "--compress", "meshopt", "--texture-compress", TEXTURE_COMPRESS, *KEEP_STRUCTURE]
    print("compressing:", " ".join(cmd))
    env = dict(os.environ)
    if os.path.isdir(KTX_BIN):
        env["PATH"] = KTX_BIN + os.pathsep + env.get("PATH", "")
    try:
        subprocess.run(cmd, cwd=ROOT, env=env, check=True, shell=os.name == "nt", capture_output=True, text=True)
    except (OSError, subprocess.CalledProcessError) as error:
        detail = getattr(error, "stderr", "") or error
        raise RuntimeError(f"gltf-transform failed; run the command above from {ROOT}.\n{detail}") from error


# --- Build -------------------------------------------------------------------------------------

PILLARS = {
    # name: (seed, height, glyph panel centres up the front face)
    "pillar_a": (3, 7.6, (2.0, 3.06, 4.12, 5.18)),
    "pillar_b": (5, 8.2, (1.7, 2.76, 3.82, 4.88, 5.94)),
    "pillar_c": (9, 3.6, (1.25, 2.31)),
    "pillar_d": (12, 4.4, (1.3, 2.36, 3.42)),
}
ROCKS = ((11, (1.0, 0.9, 0.75)), (12, (0.8, 1.0, 0.9)), (13, (1.2, 0.85, 0.6)), (14, (0.7, 0.75, 1.0)), (15, (1.0, 1.0, 1.0)))
CORALS = (21, 22, 23)


def build():
    scene, pieces_coll, world_coll = kit_scene()
    # Everything below evaluates and exports the kit's own scene, whatever scene Blender shows.
    with bpy.context.temp_override(scene=scene, view_layer=scene.view_layers[0]):
        build_in(scene, pieces_coll, world_coll)


def build_in(scene, pieces_coll, world_coll):
    mats = {
        "stone": material("kit_stone", (0.16, 0.17, 0.24), 0.9),
        "glyph": material("kit_glyph", (0.05, 0.01, 0.02), 0.6),
        "rock": material("kit_rock", (0.07, 0.065, 0.09), 0.7),
        "coral": material("kit_coral", (0.9, 0.08, 0.15), 0.5),
        "iron": material("kit_iron", (0.08, 0.085, 0.11), 0.45, 0.7),
    }
    built = {}
    for name, (seed, height, cells) in PILLARS.items():
        full, centre = build_pillar(name, pieces_coll, seed, height, cells, mats, detail=0)
        # Where the page stands this pillar's glyph light (above the base, stage units).
        full["glyph_centre"] = round(centre, 4)
        built[name] = (full, build_pillar(name + LOD1, pieces_coll, seed, height, cells, mats, detail=1)[0])
    for i, (seed, scale) in enumerate(ROCKS):
        name = f"rock_{i}"
        built[name] = (build_rock(name, pieces_coll, seed, scale, mats, 5), build_rock(name + LOD1, pieces_coll, seed, scale, mats, 4))
    for i, seed in enumerate(CORALS):
        name = f"coral_{i}"
        size = 1.0 + 0.25 * i
        built[name] = (build_coral(name, pieces_coll, seed, mats, size, 1), build_coral(name + LOD1, pieces_coll, seed, mats, size, 0))
    built["chain"] = (build_chain("chain", pieces_coll, mats), build_chain("chain" + LOD1, pieces_coll, mats, nu=7, nv=4))

    layout = read_layout()
    check_layout(layout, built)
    camera = lay_out(layout, world_coll, {name: full for name, (full, _) in built.items()})
    scene.camera = camera

    export(pieces_coll)
    raw = RAW.stat().st_size
    compress()
    for name, (full, far) in built.items():
        print(f"{name}: {triangles(full)} triangles, lod1 {triangles(far)} ({triangles(far) / triangles(full):.0%})")
    print(f"exported {OUT}: {raw} bytes raw, {OUT.stat().st_size} bytes compressed")


if __name__ == "__main__":
    build()
