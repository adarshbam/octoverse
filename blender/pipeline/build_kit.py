"""The pipeline world's kit ("Pipeline Deep"): server towers built of stacked rack modules, a
single rack module, the GitHub portal (plinth, disc, four ring arcs), the bridge (deck, pier,
arch), rocks and a coral clump. Each piece also comes as `<piece>_lod1`, about a quarter of its
triangles, for far use. Everything is built by this script from its seeds; nothing is hand-modelled.

Run in Blender 5.2, from a shell at the repo root:
    blender --background --python blender/pipeline/build_kit.py -- public/flux/world/kit.glb
The output path after `--` is optional; the default is public/flux/world/kit.glb.

It rebuilds the "FluxKit pipeline" scene from scratch and touches nothing outside it. It builds
the pieces, exports them raw, compresses them with gltf-transform into the output and prints the
piece list. It reads no layout: the layout (a later task) names these pieces and places them.

LED faces. The towers and the rack module carry LED quads in a material slot named `led`. Each LED
is its own island, so its four vertices carry one colour (COLOR_0, from the `Col` colour
attribute: mostly blue and cyan, some violet, under 10% amber, never red) and one blink phase (the
custom per-vertex float `_PHASE`, random 0 to 1; glTF's exporter keeps it because the name starts
with an underscore and `export_attributes` is on). The LED faces are then split off into their
own top-level node, `<piece>_led` (and `<piece>_lod1_led`), in the piece's frame (ruling R22: the
page draws every mesh under a node with one material, so stone and lights need two nodes). The
piece keeps the stone, its colours and no `_PHASE`; the world attaches the LED node to it.

Arc inlays (Task 9). The lit strip on the front of each ring arc's blocks is split off the same
way into a top-level node `portal_arc_<q>_inlay` (full detail only; on its own `portal_inlay`
material), so the world can give each inlay a kit material whose emissive a sequence drives
without lighting the arc's stone or any other piece. The disc carries a second UV set, `Flow`
(TEXCOORD_1): the membrane kit material's flow map, u round the ring and v from the rim (0) to
the middle (1); its round caps are fans round a centre vertex so v runs across them.

Extras for the layout: each full piece carries its bounding radius on the ground plane (node extra
`radius`, about the origin, which is the placement point), and `portal_disc` carries the ring's
centre in its frame (`ring_centre`, glTF axes) for the packet path's end.

Units: 1 = one stage unit. Pieces stand on z = 0 at the origin with their front faces looking
down -Y, which glTF's Y-up export turns into +Z, toward the stage camera. They are exported at
the origin because the page places them: compression moves each mesh into a [-1, 1] box and puts
the inverse in its node's transform, so the page keeps that transform inside its own placement
and never overwrites it.

Two groups share an origin so one placement assembles them: the four `portal_arc_*` and
`portal_disc` stand in the gate's frame above `portal_plinth` (the ring turns in the XZ plane,
its centre on the plinth's axis, facing -Y); `bridge_deck`, `bridge_pier` and `bridge_arch` share
the bridge's frame (the deck runs along X, on a pier and under an arch that are each at x = 0).
"""
import math
import os
import random
import subprocess
import sys
import tempfile
from pathlib import Path

import bmesh
import bpy
from mathutils import Matrix, Vector, noise

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_OUT = ROOT / "public/flux/world/kit.glb"
RAW = Path(tempfile.gettempdir()) / "flux-kit-pipeline-raw.glb"

SCENE = "FluxKit pipeline"
PIECES = "FluxKit pipeline pieces"
# Blender names must be unique in the file; the prefix is stripped from the exported names.
PREFIX = "flux."
LOD1 = "_lod1"

# gltf-transform optimize defaults that would break what the page reads: flatten and join would
# merge the pieces into a few anonymous meshes (the page finds pieces by node name); palette would
# rewrite the UVs; prune-attributes would drop the custom `_PHASE` and the colour; simplify would
# change the authored LODs. The kit carries no textures, so texture compression is off (it would
# otherwise demand KTX-Software).
KEEP_STRUCTURE = [
    "--flatten", "false", "--join", "false", "--instance", "false", "--palette", "false",
    "--simplify", "false", "--prune-attributes", "false", "--texture-compress", "false",
]

# Material slot order inside a rack mesh.
RACK, LED, BARNACLE, CORAL = 0, 1, 2, 3
# Material slot of a ring arc's inlay (an arc's slots: rack, inlay).
INLAY = 1

# LED colours (linear RGB): blue and cyan lead, a little violet, a few amber. No red.
LED_COLORS = {
    "blue": (0.08, 0.32, 1.0, 1.0),
    "cyan": (0.05, 0.85, 1.0, 1.0),
    "violet": (0.55, 0.22, 1.0, 1.0),
    "amber": (1.0, 0.62, 0.10, 1.0),
}
LED_TALLY = {k: 0 for k in LED_COLORS}  # across the whole kit, full pieces and lod1 alike


# --- Scene -------------------------------------------------------------------------------------

def kit_scene():
    """The kit's own scene and collection, emptied of what an earlier run made."""
    scene = bpy.data.scenes.get(SCENE) or bpy.data.scenes.new(SCENE)
    coll = bpy.data.collections.get(PIECES) or bpy.data.collections.new(PIECES)
    if scene.collection.children.get(PIECES) is None:
        scene.collection.children.link(coll)
    for ob in list(coll.objects):
        bpy.data.objects.remove(ob, do_unlink=True)
    for store in (bpy.data.meshes, bpy.data.materials):
        for data in list(store):
            if data.name.startswith(PREFIX) and data.users == 0:
                store.remove(data)
    return scene, coll


def material(name, rgb, rough=0.85, metal=0.0):
    m = bpy.data.materials.get(PREFIX + name) or bpy.data.materials.new(PREFIX + name)
    m.use_nodes = True
    bsdf = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Base Color"].default_value = (*rgb, 1.0)
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    return m


def triangles(ob):
    """Triangles drawn by an object and its children, as exported."""
    own = sum(len(p.vertices) - 2 for p in ob.data.polygons) if ob.type == "MESH" else 0
    return own + sum(triangles(child) for child in ob.children)


# --- A small mesh builder ----------------------------------------------------------------------

class Mesh:
    """A bmesh with a colour layer (`Col`) and, when `phase` is set, the blink-phase layer
    (`_PHASE`). Every shape makes its own vertices, so a colour or a phase never bleeds between
    shapes. Faces are wound outward by a reference point inside the shape."""

    def __init__(self, phase=False):
        self.bm = bmesh.new()
        self.col = self.bm.verts.layers.float_color.new("Col")
        self.ph = self.bm.verts.layers.float.new("_PHASE") if phase else None

    def vert(self, co, color, phase=0.0):
        v = self.bm.verts.new(co)
        v[self.col] = color
        if self.ph is not None:
            v[self.ph] = phase
        return v

    def face(self, verts, mat, ref):
        """A face wound so its normal points away from `ref`."""
        co = [v.co for v in verts]
        n = Vector()
        for i in range(len(co)):
            n += co[i].cross(co[(i + 1) % len(co)])
        if n.dot(sum(co, Vector()) / len(co) - ref) < 0:
            verts = verts[::-1]
        f = self.bm.faces.new(verts)
        f.material_index = mat
        return f

    def hexa(self, pts, mat, color, xf=None):
        """A hexahedron: pts 0-3 one end in order, 4-7 the other (the cube's topology)."""
        vs = [self.vert(xf @ Vector(p) if xf else Vector(p), color) for p in pts]
        ref = sum((v.co for v in vs), Vector()) / 8
        for idx in ((0, 1, 2, 3), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)):
            self.face([vs[i] for i in idx], mat, ref)

    def box(self, centre, size, mat, color, xf=None):
        cx, cy, cz = centre
        hx, hy, hz = size[0] / 2, size[1] / 2, size[2] / 2
        pts = [(cx - hx, cy - hy, cz - hz), (cx + hx, cy - hy, cz - hz), (cx + hx, cy + hy, cz - hz), (cx - hx, cy + hy, cz - hz),
               (cx - hx, cy - hy, cz + hz), (cx + hx, cy - hy, cz + hz), (cx + hx, cy + hy, cz + hz), (cx - hx, cy + hy, cz + hz)]
        self.hexa(pts, mat, color, xf)

    def prism(self, r0, r1, h, n, mat, color, xf=None, twist=0.0):
        """A (tapered) n-sided prism along +Z from z = 0 (radius r0) to z = h (radius r1)."""
        vs = []
        for z, r in ((0.0, r0), (h, r1)):
            for k in range(n):
                a = 2 * math.pi * k / n + twist
                p = Vector((r * math.cos(a), r * math.sin(a), z))
                vs.append(self.vert(xf @ p if xf else p, color))
        ref = sum((v.co for v in vs), Vector()) / len(vs)
        for k in range(n):
            j = (k + 1) % n
            self.face([vs[k], vs[j], vs[n + j], vs[n + k]], mat, ref)
        self.face(vs[:n], mat, ref)
        self.face(vs[n:], mat, ref)

    def sweep(self, pts, radius, n, mat, color, up, colors=None):
        """A tube of n sides along the polyline `pts`; `up` fixes the frame. `colors` gives each
        ring its own colour."""
        rings, axis = [], []
        for j, p in enumerate(pts):
            t = (pts[min(j + 1, len(pts) - 1)] - pts[max(j - 1, 0)]).normalized()
            u = t.cross(up)
            if u.length < 1e-6:
                u = t.cross(Vector((1, 0, 0)))
            u.normalize()
            w = t.cross(u)
            c = colors[j] if colors else color
            rings.append([self.vert(p + radius * (math.cos(2 * math.pi * k / n) * u + math.sin(2 * math.pi * k / n) * w), c) for k in range(n)])
            axis.append(p)
        for j in range(len(pts) - 1):
            ref = (axis[j] + axis[j + 1]) / 2
            for k in range(n):
                i = (k + 1) % n
                self.face([rings[j][k], rings[j][i], rings[j + 1][i], rings[j + 1][k]], mat, ref)
        self.face(rings[0], mat, axis[1])
        self.face(rings[-1], mat, axis[-2])

    def led(self, centre, w, h, color, phase, xf=None):
        """One LED: a quad facing -Y (a lone face, so its four vertices share colour and phase)."""
        cx, cy, cz = centre
        pts = [(cx - w / 2, cy, cz - h / 2), (cx + w / 2, cy, cz - h / 2), (cx + w / 2, cy, cz + h / 2), (cx - w / 2, cy, cz + h / 2)]
        vs = [self.vert(xf @ Vector(p) if xf else Vector(p), color, phase) for p in pts]
        f = self.bm.faces.new(vs)
        f.material_index = LED
        # Face the quad down the module's -Y (through xf), never away from it.
        front = (xf.to_3x3() @ Vector((0, -1, 0))) if xf else Vector((0, -1, 0))
        f.normal_update()
        if f.normal.dot(front) < 0:
            f.normal_flip()

    def tag(self, verts, mat, color):
        """Sets material and colour on shapes made with bmesh.ops (their faces and vertices)."""
        faces = set()
        for v in verts:
            v[self.col] = color
            if self.ph is not None:
                v[self.ph] = 0.0
            faces.update(v.link_faces)
        for f in faces:
            f.material_index = mat


def to_object(name, m, coll, mats, smooth=False):
    me = bpy.data.meshes.new(PREFIX + name)
    m.bm.to_mesh(me)
    m.bm.free()
    for p in me.polygons:
        p.use_smooth = smooth
    for mat in mats:
        me.materials.append(mat)
    attr = me.color_attributes.get("Col")
    if attr:
        me.color_attributes.active_color = attr
        me.color_attributes.render_color_index = list(me.color_attributes).index(attr)
    ob = bpy.data.objects.new(PREFIX + name, me)
    coll.objects.link(ob)
    return ob


def split_led(ob, coll, led_mat):
    """Moves the faces of `ob` in the `led` slot into a new top-level object `<name>_led` in the
    same frame (R22), on the `led` material alone, keeping their colour and `_PHASE`. `ob` keeps
    every other face and its colours and loses `_PHASE` (its faces carried 0). Every LED face is
    a small light, never a cap of the tower's cut (asserted)."""
    src = ob.data
    lights = src.copy()
    lights.name = ob.name + "_led"
    for me, keep_led in ((src, False), (lights, True)):
        bm = bmesh.new()
        bm.from_mesh(me)
        doomed = [f for f in bm.faces if (f.material_index == LED) != keep_led]
        bmesh.ops.delete(bm, geom=doomed, context="FACES")
        if keep_led:
            assert bm.faces, f"{ob.name} has no LED faces"
            for f in bm.faces:
                assert f.calc_area() < 0.02, f"{ob.name}: an LED face of area {f.calc_area():.3f} is not a light"
                f.material_index = 0
        bm.to_mesh(me)
        bm.free()
    lights.materials.clear()
    lights.materials.append(led_mat)
    src.attributes.remove(src.attributes["_PHASE"])
    led_ob = bpy.data.objects.new(ob.name + "_led", lights)
    coll.objects.link(led_ob)
    return led_ob


def split_inlay(ob, coll, inlay_mat):
    """Moves the inlay faces of a ring arc (slot INLAY) into a new top-level object `<name>_inlay`
    in the arc's frame (Task 9, as R22 split the LEDs): the arc stays stone, the inlay is drawn with
    a material of its own, which a sequence's emissive drive lights without lighting other stone."""
    src = ob.data
    strip = src.copy()
    strip.name = ob.name + "_inlay"
    for me, keep in ((src, False), (strip, True)):
        bm = bmesh.new()
        bm.from_mesh(me)
        bmesh.ops.delete(bm, geom=[f for f in bm.faces if (f.material_index == INLAY) != keep], context="FACES")
        if keep:
            assert bm.faces, f"{ob.name} has no inlay faces"
            for f in bm.faces:
                f.material_index = 0
        bm.to_mesh(me)
        bm.free()
    strip.materials.clear()
    strip.materials.append(inlay_mat)
    src.materials.pop(index=INLAY)
    inlay_ob = bpy.data.objects.new(ob.name + "_inlay", strip)
    coll.objects.link(inlay_ob)
    return inlay_ob


def radius_xy(ob):
    """How far the piece reaches from its origin on the ground plane (stage XZ)."""
    return max(math.hypot(v.co.x, v.co.y) for v in ob.data.vertices)


def sit_on_ground(m, floor=0.0):
    low = min(v.co.z for v in m.bm.verts)
    for v in m.bm.verts:
        v.co.z += floor - low


def grey(g, tint=(0.92, 0.96, 1.0)):
    return (g * tint[0], g * tint[1], g * tint[2], 1.0)


# --- Rack modules and towers -------------------------------------------------------------------

MW, MD, MH = 1.0, 0.8, 0.5  # one rack module's width, depth, height

# Detail levels for modules, towers and the pieces: 0 full, 1 lod1.
MODULE = (
    dict(bays=4, ribs=4, post_n=6, leds=6, barnacles=1.0, twigs=1.0),
    dict(bays=2, ribs=0, post_n=4, leds=2, barnacles=0.0, twigs=0.0),
)


class Leds:
    """Picks LED colours: blue 46%, cyan 39%, violet 10%, amber 5%, and amber never above 8% of
    the LEDs picked so far, so a piece stays under 10% amber whatever the dice give."""

    def __init__(self, rng):
        self.rng = rng
        self.total = 0
        self.amber = 0

    def pick(self):
        r = self.rng.random()
        self.total += 1
        kind = "blue" if r < 0.46 else "cyan" if r < 0.85 else "violet" if r < 0.95 else "amber"
        if kind == "amber" and self.amber + 1 > 0.08 * self.total:
            kind = "cyan"
        if kind == "amber":
            self.amber += 1
        LED_TALLY[kind] += 1
        return LED_COLORS[kind], self.rng.random()  # colour, phase 0..1


def build_module(m, xf, rng, leds, D, tone):
    """One rack module in module space (origin at the middle of its underside, front toward -Y):
    a body, a face plate with drive bays, vent ribs, corner posts and LEDs on the plate."""
    def col(k=1.0):
        return grey(tone * k)

    m.box((0, 0, MH / 2), (MW, MD, MH - 0.03), RACK, col(0.8), xf)
    m.box((0, -MD / 2 - 0.015, MH / 2), (MW * 0.94, 0.03, MH * 0.82), RACK, col(1.0), xf)
    fy = -MD / 2 - 0.03
    for i in range(D["bays"]):
        step = 0.19 if D["bays"] >= 4 else 0.3
        bx = -0.34 + i * step
        m.box((bx, fy - 0.01, MH * 0.34), (0.17, 0.02, 0.19), RACK, col(0.6), xf)
    for i in range(D["ribs"]):
        m.box((0.2 + i * 0.07, fy - 0.004, MH * 0.34), (0.012, 0.008, 0.19), RACK, col(0.7), xf)
    if D["post_n"]:
        for sx in (-1, 1):
            for sy in (-1, 1):
                at = Matrix.Translation((sx * MW / 2, sy * MD / 2, 0.0))
                m.prism(0.045, 0.04, MH, D["post_n"], RACK, col(0.55), (xf @ at) if xf else at)
    ly = fy - 0.006
    color, phase = leds.pick()
    m.led((-0.15, ly, MH * 0.66), 0.5, 0.022, color, phase, xf)
    for k in range(D["leds"]):
        color, phase = leds.pick()
        m.led((0.14 + 0.045 * k, ly, MH * 0.66), 0.03, 0.03, color, phase, xf)


def grow(m, rng, surfaces, D, count_barnacles, count_twigs, cut=None):
    """Barnacles (small squashed icospheres) and coral twigs on the faces of the modules.
    `surfaces` is a list of (module matrix, scale vector); `cut` is a (point, normal) of the break:
    growth beyond it is skipped."""
    def spot():
        xf, scale = rng.choice(surfaces)
        w, d = MW * scale[0], MD * scale[1]
        face = rng.choice(("front", "front", "side", "side", "back", "top", "top"))
        edge = rng.random() < 0.65
        if face == "front":
            p, n = Vector((rng.uniform(-0.47, 0.47) * w, -d / 2 - 0.03, rng.choice((0.04, MH - 0.05, rng.uniform(0.04, MH - 0.05)) if edge else (rng.uniform(0.04, MH - 0.05),)))), Vector((0, -1, 0))
        elif face == "back":
            p, n = Vector((rng.uniform(-0.47, 0.47) * w, d / 2, rng.uniform(0.03, MH - 0.03))), Vector((0, 1, 0))
        elif face == "side":
            s = rng.choice((-1, 1))
            p, n = Vector((s * w / 2, rng.uniform(-0.45, 0.45) * d, rng.uniform(0.03, MH - 0.03))), Vector((s, 0, 0))
        else:
            p, n = Vector((rng.uniform(-0.47, 0.47) * w, rng.uniform(-0.45, 0.45) * d, MH - 0.03)), Vector((0, 0, 1))
        if edge and face in ("top", "side"):
            p.x = math.copysign(abs(p.x) * 0.5 + w * 0.3, p.x) if face == "top" else p.x
        return xf @ p, (xf.to_3x3() @ n).normalized()

    def beyond(p):
        return cut is not None and (p - cut[0]).dot(cut[1]) > -0.02

    for _ in range(int(count_barnacles)):
        p, n = spot()
        if beyond(p):
            continue
        r = rng.choice((0.03, 0.04, 0.05, 0.07))
        # Bigger ones are the faceted ones; the rest are minimal icosahedra.
        sub = 2 if r >= 0.07 else 1
        quat = n.to_track_quat("Z", "Y")
        mat = Matrix.Translation(p - n * 0.01) @ quat.to_matrix().to_4x4() @ Matrix.Diagonal((r, r * rng.uniform(0.8, 1.1), r * 0.6, 1.0))
        res = bmesh.ops.create_icosphere(m.bm, subdivisions=sub, radius=1.0, matrix=mat)
        m.tag(res["verts"], BARNACLE, grey(rng.uniform(0.75, 1.0), (0.95, 1.0, 1.0)))
    for _ in range(int(count_twigs)):
        p, n = spot()
        if beyond(p):
            continue
        base_d = rng.uniform(0.07, 0.13)
        for _ in range(rng.choice((2, 3, 3))):
            d = (n + Vector((rng.uniform(-0.6, 0.6), rng.uniform(-0.6, 0.6), rng.uniform(-0.6, 0.6)))).normalized()
            pos, r = p - n * 0.01, 0.014
            for s in range(3):
                length = base_d * rng.uniform(0.7, 1.0)
                tip = s == 2 and rng.random() < 0.4
                color = (1.0, 0.62, 0.32, 1.0) if tip else (0.95, 0.5, 0.75, 1.0)
                at = Matrix.Translation(pos) @ d.to_track_quat("Z", "Y").to_matrix().to_4x4()
                m.prism(r, r * 0.65, length, 5, CORAL, color, at)
                pos = pos + d * length
                d = (d + Vector((rng.uniform(-0.35, 0.35), rng.uniform(-0.35, 0.35), rng.uniform(-0.2, 0.35)))).normalized()
                r *= 0.65


def build_tower(name, coll, mats, seed, count, lean, break_at, slip, cut_back, detail):
    """A server tower: `count` rack modules stacked, leaning by `lean` (radians about Y, about X)
    toward the top, a slip at module `break_at` (an offset and an extra tilt), a ruined top cut off
    by a slanted plane `cut_back` below the highest point, loose modules fallen at the foot, and
    barnacle and coral growth over the modules (full detail only)."""
    D = MODULE[detail]
    rng = random.Random(seed)
    leds = Leds(random.Random(f"{seed}:leds"))  # its own dice: the geometry's rng is the same at every detail level
    m = Mesh(phase=True)
    pos = Vector((0.0, 0.0, 0.0))
    surfaces = []
    for i in range(count):
        t = i / max(1, count - 1)
        a = lean[0] * t ** 1.3 + rng.uniform(-0.012, 0.012)
        b = lean[1] * t + rng.uniform(-0.01, 0.01)
        if i >= break_at:
            a += slip[2]
        rot = Matrix.Rotation(rng.uniform(-0.035, 0.035), 4, "Z") @ Matrix.Rotation(a, 4, "Y") @ Matrix.Rotation(b, 4, "X")
        at = Matrix.Translation(pos + (Vector((slip[0], slip[1], 0.0)) if i == break_at else Vector())) @ rot
        scale = Vector((1.12 if i < 2 else rng.uniform(0.92, 1.05), 1.1 if i < 2 else rng.uniform(0.94, 1.04), 1.0))
        xf = at @ Matrix.Diagonal((scale.x, scale.y, scale.z, 1.0))
        build_module(m, xf, rng, leds, D, rng.uniform(0.7, 1.0))
        surfaces.append((at, scale))
        pos = at.translation + rot @ Vector((rng.uniform(-0.008, 0.008), rng.uniform(-0.008, 0.008), MH))
    # The break: a slanted plane below the highest point; everything above it goes.
    top = pos + Vector((0, 0, 0.0))
    normal = Vector((rng.choice((-1, 1)) * rng.uniform(0.3, 0.5), rng.uniform(-0.3, 0.3), 1.0)).normalized()
    point = top - Vector((0, 0, cut_back))
    cut = bmesh.ops.bisect_plane(m.bm, geom=m.bm.verts[:] + m.bm.edges[:] + m.bm.faces[:], dist=1e-5, plane_co=point, plane_no=normal, clear_outer=True)
    rim = [e for e in cut["geom_cut"] if isinstance(e, bmesh.types.BMEdge)]
    if rim:
        filled = bmesh.ops.holes_fill(m.bm, edges=rim, sides=0)
        bmesh.ops.triangulate(m.bm, faces=filled["faces"])
    for v in m.bm.verts:
        if v[m.col][3] == 0.0:
            v[m.col] = grey(0.55)  # the cut's new faces
    # Loose modules fallen at the foot, each with an LED of its own. Three at both levels: the page
    # draws the full LED node over the lod1 too, so lod1 keeps every module the lights sit on.
    for k in range(3):
        ang = rng.uniform(0, 2 * math.pi)
        dist = rng.uniform(0.95, 1.5)
        sc = rng.uniform(0.55, 0.85)
        xf = (Matrix.Translation((math.cos(ang) * dist, math.sin(ang) * dist, 0.0))
              @ Matrix.Rotation(rng.uniform(0, 2 * math.pi), 4, "Z")
              @ Matrix.Rotation(rng.uniform(-0.35, 0.35), 4, "X")
              @ Matrix.Rotation(rng.uniform(-0.35, 0.35), 4, "Y")
              @ Matrix.Diagonal((sc, sc, sc, 1.0)))
        xf.translation.z = MH * sc * 0.55
        build_module(m, xf, rng, leds, MODULE[1], rng.uniform(0.6, 0.9))
    if detail == 0:
        grow(m, rng, surfaces, D, 14 * count / 3 + 20, 4 * count / 3 + 6, cut=(point, normal))
    else:
        grow(m, rng, surfaces, D, 12, 0, cut=(point, normal))
    sit_on_ground(m)
    return to_object(name, m, coll, mats, smooth=False)


def build_rack_module(name, coll, mats, seed, detail):
    """A single loose rack module with a little growth at its foot."""
    D = MODULE[detail]
    rng = random.Random(seed)
    m = Mesh(phase=True)
    build_module(m, None, rng, Leds(random.Random(f"{seed}:leds")), D, 0.9)
    grow(m, rng, [(Matrix.Identity(4), Vector((1, 1, 1)))], D, 10 * D["barnacles"], 3 * D["twigs"])
    return to_object(name, m, coll, mats, smooth=False)


# --- The portal --------------------------------------------------------------------------------

PLINTH_TOP = 0.7  # the ring stands on the plinth's top step
RING_R0, RING_R1 = 1.85, 2.35  # inner and outer radius of the ring gate
RING_Z = PLINTH_TOP + RING_R1 - 0.2  # the ring's centre height; it sinks a little into the plinth
RING_D = 0.56  # the ring's thickness, along Y


def build_plinth(name, coll, mats, detail):
    """A stepped stone plinth, three round steps squashed to an oval, with blocks round the rims."""
    n = 24 if detail == 0 else 12
    rng = random.Random(61)
    m = Mesh()
    radii = (2.75, 2.35, 1.95)
    z = 0.0
    for k, r in enumerate(radii):
        h = PLINTH_TOP / 3
        m.prism(r, r * 0.97, h, n, RACK, grey(0.75 + 0.08 * k), Matrix.Translation((0, 0, z)) @ Matrix.Diagonal((1.0, 0.56, 1.0, 1.0)), twist=0.12 * k)
        if detail == 0:
            for j in range(4 if k else 6):
                a = rng.uniform(0, 2 * math.pi)
                bw, bh = rng.uniform(0.22, 0.4), rng.uniform(0.07, 0.16)
                m.box((0, 0, 0), (bw, 0.16, bh), RACK, grey(0.6), Matrix.Translation((r * 0.98 * math.cos(a), r * 0.56 * math.sin(a), z + h + bh / 2 - 0.03)) @ Matrix.Rotation(a, 4, "Z"))
        z += h
    return to_object(name, m, coll, mats, smooth=False)


def build_disc(name, coll, mats, detail):
    """The portal disc: a bezel, the glowing disc (front UVs run 0 to 1 across its diameter, for the
    GitHub mark the page lays on it) and a raised core, in the ring's plane, facing -Y."""
    n = 48 if detail == 0 else 16
    m = Mesh()
    face_front = Matrix.Translation((0, 0, RING_Z)) @ Matrix.Rotation(math.radians(90), 4, "X")  # +Z -> -Y
    m.prism(RING_R0 - 0.04, RING_R0 - 0.04, 0.1, n, 1, grey(0.5, (0.6, 0.75, 1.0)), face_front @ Matrix.Translation((0, 0, -0.05)))
    m.prism(RING_R0 - 0.14, RING_R0 - 0.14, 0.07, n, 0, (0.82, 0.93, 1.0, 1.0), face_front)
    if detail == 0:
        m.prism(0.95, 0.95, 0.03, n, 0, (0.95, 0.98, 1.0, 1.0), face_front @ Matrix.Translation((0, 0, 0.07)))
    # Each round cap becomes a fan round a centre vertex, so the flow map below runs from the rim
    # (v 0) to the middle (v 1) across it.
    caps = [f for f in m.bm.faces if len(f.verts) >= 8]
    for v in bmesh.ops.poke(m.bm, faces=caps)["verts"]:
        v[m.col] = v.link_edges[0].other_vert(v)[m.col]
    uv = m.bm.loops.layers.uv.verify()
    d = 2 * (RING_R0 - 0.14)
    for f in m.bm.faces:
        f.normal_update()
        for loop in f.loops:
            c = loop.vert.co
            loop[uv].uv = ((c.x / d) + 0.5, ((c.z - RING_Z) / d) + 0.5)
    disc_flow(m, RING_R0 - 0.04)
    return to_object(name, m, coll, mats, smooth=False)


def disc_flow(m, radius):
    """The disc's second UV set, `Flow`, the membrane kit material's flow map (membraneMaterial.ts):
    u the turn round the ring's axis (0 to 1, from the right, counter-clockwise; a face across the
    seam runs on past 1, which the shader's whole turns do not see), v from 0 at `radius` (the
    rim) to 1 at the centre. A fan's centre vertex takes its face's mean turn."""
    flow = m.bm.loops.layers.uv.new("Flow")
    for f in m.bm.faces:
        loops = []
        for loop in f.loops:
            x, z = loop.vert.co.x, loop.vert.co.z - RING_Z
            r = math.hypot(x, z)
            loops.append((loop, r, (math.atan2(z, x) / (2 * math.pi)) % 1.0))
        turns = [u for _, r, u in loops if r > 1e-4]
        wraps = bool(turns) and max(turns) - min(turns) > 0.5
        turns = [u + 1.0 if wraps and u < 0.5 else u for u in turns]
        mean = sum(turns) / len(turns) if turns else 0.0
        for loop, r, u in loops:
            u = u + 1.0 if wraps and u < 0.5 else u
            loop[flow].uv = (u if r > 1e-4 else mean, max(0.0, 1.0 - r / radius))


def build_arc(name, coll, mats, quarter, detail):
    """One of the four ring arcs (quarter 0 to 3, counter-clockwise from the right, seen from the
    front), a run of separate stone blocks with a lip on the inside and an inlay on the front (in
    material slot 1, which split_inlay moves into its own node)."""
    blocks = 8 if detail == 0 else 4
    m = Mesh()
    a0, span = quarter * math.pi / 2 + 0.035, math.pi / 2 - 0.07
    rng = random.Random(70 + quarter)
    step = span / blocks

    def wedge(ang0, ang1, r0, r1, y0, y1, color, mat=0):
        def pt(a, r, y):
            return (r * math.cos(a), y, RING_Z + r * math.sin(a))
        pts = [pt(ang0, r0, y0), pt(ang1, r0, y0), pt(ang1, r1, y0), pt(ang0, r1, y0),
               pt(ang0, r0, y1), pt(ang1, r0, y1), pt(ang1, r1, y1), pt(ang0, r1, y1)]
        m.hexa(pts, mat, color)

    for b in range(blocks):
        s0 = a0 + b * step + 0.006
        s1 = a0 + (b + 1) * step - 0.006
        tone = rng.uniform(0.7, 1.0)
        wedge(s0, s1, RING_R0, RING_R1, -RING_D / 2, RING_D / 2, grey(tone * 0.8))
        wedge(s0 + 0.012, s1 - 0.012, RING_R0 - 0.07, RING_R0, -RING_D / 2 + 0.06, RING_D / 2 - 0.06, grey(tone * 0.6))
        if detail == 0:
            wedge(s0 + 0.03, s1 - 0.03, RING_R0 + 0.12, RING_R1 - 0.12, -RING_D / 2 - 0.02, -RING_D / 2 + 0.01, (0.7, 0.9, 1.0, 1.0), INLAY)
    return to_object(name, m, coll, mats, smooth=False)


# --- The bridge --------------------------------------------------------------------------------

DECK_LEN, DECK_R, DECK_Z = 6.0, 0.5, 1.2  # the walkway-pipe along X, its radius and axis height


def build_deck(name, coll, mats, detail):
    """The walkway-pipe: a long tube with flanges and a walking strip on top."""
    sides = 12 if detail == 0 else 8
    segs = 6 if detail == 0 else 3
    rng = random.Random(81)
    m = Mesh()
    pts = [Vector((-DECK_LEN / 2 + DECK_LEN * i / segs, 0.0, DECK_Z)) for i in range(segs + 1)]
    m.sweep(pts, DECK_R, sides, RACK, grey(0.8), Vector((0, 0, 1)))
    flanges = 7 if detail == 0 else 4
    for i in range(flanges):
        x = -DECK_LEN / 2 + 0.2 + (DECK_LEN - 0.4) * i / (flanges - 1)
        at = Matrix.Translation((x - 0.07, 0, DECK_Z)) @ Matrix.Rotation(math.radians(90), 4, "Y")
        m.prism(DECK_R + 0.11, DECK_R + 0.11, 0.14, sides, RACK, grey(0.62), at)
        if detail == 0:
            for k in range(6):
                a = 2 * math.pi * k / 6 + 0.2
                m.box((x, (DECK_R + 0.12) * math.cos(a), DECK_Z + (DECK_R + 0.12) * math.sin(a)), (0.05, 0.05, 0.05), RACK, grey(0.9),
                      Matrix.Translation((0, 0, 0)))
    m.box((0, 0, DECK_Z + DECK_R * 0.93), (DECK_LEN - 0.3, 0.55, 0.05), RACK, grey(0.95), None)
    m.box((0, 0.26, DECK_Z + DECK_R * 0.93 + 0.07), (DECK_LEN - 0.3, 0.03, 0.09), RACK, grey(0.7), None)
    return to_object(name, m, coll, mats, smooth=False)


def build_pier(name, coll, mats, detail):
    """A stone pier under the deck, with a footing, a tapered shaft and a saddle cap."""
    n = 8 if detail == 0 else 6
    m = Mesh()
    m.prism(0.7, 0.62, 0.16, n, RACK, grey(0.6), twist=0.2)
    m.prism(0.34, 0.28, 0.5, n, RACK, grey(0.8), Matrix.Translation((0, 0, 0.14)))
    m.box((0, 0, 0.66), (0.95, 0.7, 0.12), RACK, grey(0.7))
    if detail == 0:
        for sx in (-1, 1):
            m.box((sx * 0.4, 0, 0.8), (0.1, 0.62, 0.16), RACK, grey(0.55))
        rng = random.Random(83)
        grow(m, rng, [(Matrix.Translation((0, 0, 0.1)), Vector((0.9, 0.7, 1.0)))], MODULE[0], 8, 2)
    return to_object(name, m, coll, mats, smooth=False)


def build_arch(name, coll, mats, detail):
    """A glowing ring arch over the deck: a tube bent in the YZ plane, feet on the ground, the
    colour running from violet at the feet to pink at the crown."""
    segs = 14 if detail == 0 else 6
    sides = 8 if detail == 0 else 5
    ry, rz = 1.3, 2.55
    pts = [Vector((0.0, ry * math.cos(math.pi * i / segs), rz * math.sin(math.pi * i / segs))) for i in range(segs + 1)]
    colors = []
    for i in range(segs + 1):
        t = math.sin(math.pi * i / segs)
        colors.append((0.55 + 0.4 * t, 0.2 + 0.1 * t, 1.0 - 0.3 * t, 1.0))  # violet to pink
    m = Mesh()
    m.sweep(pts, 0.1, sides, RACK, None, Vector((1, 0, 0)), colors=colors)
    for sy in (-1, 1):
        m.box((0, sy * ry, 0.1), (0.5, 0.5, 0.2), RACK, grey(0.7))
    return to_object(name, m, coll, mats, smooth=False)


# --- Rocks and coral ---------------------------------------------------------------------------

def build_rock(name, coll, mats, seed, scale, detail):
    """A craggy dark boulder: noise and cell facets on an icosphere, its underside flattened to
    sit. `detail` 0 is subdivision 4 and 1 is 3 (a quarter of the triangles)."""
    rng = random.Random(seed)
    m = Mesh()
    bmesh.ops.create_icosphere(m.bm, subdivisions=4 if detail == 0 else 3, radius=1.0)
    off = Vector((rng.uniform(0, 90), rng.uniform(0, 90), rng.uniform(0, 90)))
    for v in m.bm.verts:
        p = v.co.normalized()
        n = noise.fractal(p * 1.15 + off, 0.55, 2.0, 5)
        dist, _ = noise.voronoi(p * 2.1 + off)
        facet = min(dist[1] - dist[0], 0.5)
        crag = noise.fractal(p * 3.2 + off * 0.5, 0.8, 2.0, 3)
        v.co = p * (1.0 + 0.3 * n + 0.22 * facet + 0.025 * crag)
        if v.co.z < -0.3:
            v.co.z = -0.3 + (v.co.z + 0.3) * 0.15
    bmesh.ops.scale(m.bm, vec=Vector(scale), verts=m.bm.verts)
    sit_on_ground(m, -0.02)
    top = max(v.co.z for v in m.bm.verts)
    for v in m.bm.verts:
        v[m.col] = grey(0.45 + 0.55 * max(0.0, v.co.z / top) ** 0.8)
    return to_object(name, m, coll, mats, smooth=True)


def build_coral(name, coll, mats, seed, detail):
    """Branching coral: a grown skeleton thickened by the Skin modifier, pink with orange flecks
    toward the tips (Col). Full detail smooths it once; lod1 keeps the bare skin."""
    rng = random.Random(seed)
    size = 1.0
    verts = [Vector((0, 0, 0))]
    edges = []
    radii = [0.03 * size]

    def grow_branch(i, d, length, r, depth):
        pos = verts[i].copy()
        steps = max(2, int(length / (0.1 * size)))
        for s in range(steps):
            d = (d + Vector((rng.uniform(-0.25, 0.25), rng.uniform(-0.1, 0.1), rng.uniform(0.0, 0.3))) * 0.4).normalized()
            pos = pos + d * (length / steps)
            verts.append(pos.copy())
            edges.append((i, len(verts) - 1))
            radii.append(max(r * (1 - 0.3 * (s + 1) / steps), 0.011 * size))
            i = len(verts) - 1
        if depth > 0:
            n = 2
            for k in range(n):
                a = (k - (n - 1) / 2) * rng.uniform(0.55, 0.85) + rng.uniform(-0.2, 0.2)
                nd = (d + Vector((math.sin(a) * 0.9, rng.uniform(-0.15, 0.15), 0.12))).normalized()
                grow_branch(i, nd, length * rng.uniform(0.72, 0.9), radii[i] * 0.8, depth - 1)

    stems = 3
    for k in range(stems):
        a = (k - (stems - 1) / 2) * 0.42 + rng.uniform(-0.12, 0.12)
        grow_branch(0, Vector((math.sin(a), rng.uniform(-0.2, 0.2), math.cos(a))).normalized(), 0.34 * size, 0.026 * size, 2)
    me = bpy.data.meshes.new(PREFIX + name + ".skel")
    me.from_pydata([tuple(v) for v in verts], edges, [])
    me.update()
    ob = bpy.data.objects.new(PREFIX + name, me)
    coll.objects.link(ob)
    ob.modifiers.new("Skin", "SKIN")
    sv = me.skin_vertices[0].data
    for k, r in enumerate(radii):
        sv[k].radius = (r, r)
    sv[0].use_root = True
    if detail == 0:
        ob.modifiers.new("Smooth", "SUBSURF").levels = 1
    deps = bpy.context.evaluated_depsgraph_get()
    baked = bpy.data.meshes.new_from_object(ob.evaluated_get(deps))
    ob.modifiers.clear()
    ob.data = baked
    bpy.data.meshes.remove(me)
    baked.name = PREFIX + name
    for p in baked.polygons:
        p.use_smooth = True
    top = max(v.co.z for v in baked.vertices) or 1.0
    low = min(v.co.z for v in baked.vertices)
    for v in baked.vertices:
        v.co.z -= low
    top -= low
    attr = baked.color_attributes.new("Col", "FLOAT_COLOR", "POINT")
    crng = random.Random(seed + 1)
    for i, v in enumerate(baked.vertices):
        t = max(0.0, v.co.z / top)
        g = 0.45 + 0.55 * t ** 1.2
        color = (g, g * 0.9, g * 0.95, 1.0)
        if t > 0.55 and crng.random() < 0.16:
            color = (1.0, 0.62, 0.30, 1.0)  # orange fleck
        attr.data[i].color = color
    baked.color_attributes.active_color = attr
    baked.materials.append(mats["coral"])
    return ob


# --- Export ------------------------------------------------------------------------------------

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
        export_attributes=True,  # keeps `_PHASE` (custom attributes starting with an underscore)
        export_materials="EXPORT",
        export_normals=True,
        export_cameras=False,
        export_lights=False,
    )
    # Node and mesh names lose the Blender-side prefix: the page asks for `tower_a`, not `flux.tower_a`.
    import json
    import struct
    data = bytearray(raw.read_bytes())
    json_len = struct.unpack_from("<I", data, 12)[0]
    doc = json.loads(data[20:20 + json_len])
    for group in ("nodes", "meshes", "materials"):
        for item in doc.get(group, []):
            if item.get("name", "").startswith(PREFIX):
                item["name"] = item["name"][len(PREFIX):]
    text = json.dumps(doc, separators=(",", ":")).encode("utf-8")
    text += b" " * (-len(text) % 4)
    rest = data[20 + json_len:]
    raw.write_bytes(struct.pack("<III", 0x46546C67, 2, 12 + 8 + len(text) + len(rest)) + struct.pack("<II", len(text), 0x4E4F534A) + text + rest)


def gltf_transform(*args):
    """Runs the repo's own gltf-transform (npx --no-install: never a download)."""
    cmd = ["npx", "--no-install", "gltf-transform", *map(str, args)]
    print("gltf-transform:", " ".join(cmd))
    try:
        subprocess.run(cmd, cwd=ROOT, check=True, shell=os.name == "nt", capture_output=True, text=True)
    except (OSError, subprocess.CalledProcessError) as error:
        detail = getattr(error, "stderr", "") or error
        raise RuntimeError(f"gltf-transform failed; run the command above from {ROOT}.\n{detail}") from error


def compress(raw, out):
    """Meshopt geometry, keeping the structure the page reads (KEEP_STRUCTURE)."""
    out.parent.mkdir(parents=True, exist_ok=True)
    gltf_transform("optimize", raw, out, "--compress", "meshopt", *KEEP_STRUCTURE)


# --- Build -------------------------------------------------------------------------------------

TOWERS = {
    # name: (seed, modules, lean (about Y, about X), module the break slips at, slip (x, y, tilt), cut below the top)
    "tower_a": (101, 18, (0.05, 0.02), 12, (0.1, 0.03, 0.05), 0.55),
    "tower_b": (202, 15, (-0.11, 0.04), 9, (-0.14, 0.05, -0.08), 0.7),
    "tower_c": (303, 12, (0.14, -0.05), 7, (0.18, -0.06, 0.1), 0.45),
}
ROCKS = {"rock_a": (11, (1.1, 0.9, 0.75)), "rock_b": (12, (0.8, 1.0, 0.9)), "rock_c": (13, (1.3, 0.85, 0.6))}
# The pieces a layout places (src/worlds/flux/place/kit.ts lists the same); each carries `radius`.
PLACED = (*TOWERS, "rack_module", "portal_plinth", "portal_disc", *(f"portal_arc_{q}" for q in range(1, 5)),
          "bridge_deck", "bridge_pier", "bridge_arch", *ROCKS, "coral_a")


def build_pieces(coll):
    """Every piece and its lod1 into `coll`: {name: (full, lod1)}."""
    rack = material("rack", (0.10, 0.12, 0.18), 0.55, 0.6)
    led = material("led", (1.0, 1.0, 1.0), 0.4)
    barnacle = material("barnacle", (0.55, 0.62, 0.7), 0.9)
    coral = material("coral", (0.95, 0.3, 0.55), 0.6)
    rock = material("rock", (0.06, 0.07, 0.10), 0.75)
    disc = material("portal_disc", (0.8, 0.92, 1.0), 0.3)
    inlay = material("portal_inlay", (0.7, 0.9, 1.0), 0.4)
    rack_mats = [rack, led, barnacle, coral]
    built = {}

    def both(name, fn, *args):
        built[name] = (fn(name, coll, *args, 0), fn(name + LOD1, coll, *args, 1))

    for name, (seed, count, lean, brk, slip, cut) in TOWERS.items():
        built[name] = tuple(build_tower(name + sfx, coll, rack_mats, seed, count, lean, brk, slip, cut, d) for d, sfx in ((0, ""), (1, LOD1)))
    both("rack_module", build_rack_module, rack_mats, 404)
    both("portal_plinth", build_plinth, [rack])
    both("portal_disc", build_disc, [disc, rack])
    for q in range(4):
        both(f"portal_arc_{q + 1}", build_arc, [rack, inlay], q)
    both("bridge_deck", build_deck, [rack])
    both("bridge_pier", build_pier, [rack, led, barnacle, coral])
    both("bridge_arch", build_arch, [rack])
    for name, (seed, scale) in ROCKS.items():
        both(name, build_rock, [rock], seed, scale)
    both("coral_a", build_coral, {"coral": coral}, 21)
    # R22: the LED faces become their own nodes, `<piece>_led` and `<piece>_lod1_led`.
    for name in (*TOWERS, "rack_module"):
        full, far = built[name]
        built[name + "_led"] = (split_led(full, coll, led), split_led(far, coll, led))
    # Task 9: each arc's inlay becomes its own node, `portal_arc_<q>_inlay` (full detail only: the
    # lod1 arc has none; its slot goes too).
    for q in range(1, 5):
        full, far = built[f"portal_arc_{q}"]
        built[f"portal_arc_{q}_inlay"] = (split_inlay(full, coll, inlay), None)
        far.data.materials.pop(index=INLAY)
    # Extras the layout test reads (placed pieces only; not the LED nodes).
    for name in PLACED:
        built[name][0]["radius"] = round(radius_xy(built[name][0]), 4)
    built["portal_disc"][0]["ring_centre"] = [0.0, RING_Z, 0.0]  # glTF axes: up is y
    return built


def build(out):
    scene, coll = kit_scene()
    # Everything below evaluates and exports the kit's own scene, whatever scene Blender shows.
    with bpy.context.temp_override(scene=scene, view_layer=scene.view_layers[0]):
        built = build_pieces(coll)
        leds = sum(LED_TALLY.values())
        assert LED_TALLY["amber"] / leds < 0.10, "amber LEDs reach 10%"  # before anything is written
        export(coll)
        raw = RAW.stat().st_size
        compress(RAW, out)
    total = lod = 0
    for name, (full, far) in built.items():
        tf, tl = triangles(full), (triangles(far) if far is not None else 0)
        total += tf
        lod += tl
        lo = Vector((min(v.co[i] for v in full.data.vertices) for i in range(3)))
        hi = Vector((max(v.co[i] for v in full.data.vertices) for i in range(3)))
        print(f"{name}: {tf} triangles, lod1 {tl} ({tl / tf:.0%}); x {lo.x:.2f}..{hi.x:.2f}, y {lo.y:.2f}..{hi.y:.2f}, z {lo.z:.2f}..{hi.z:.2f}")
    print("LEDs: " + ", ".join(f"{k} {v} ({v / leds:.0%})" for k, v in LED_TALLY.items()) + f" of {leds}")
    print(f"kit total: {total} triangles full, {lod} lod1, {total + lod} together")
    print(f"exported {out}: {raw} bytes raw, {out.stat().st_size} bytes compressed")


if __name__ == "__main__":
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    build(Path(args[0]).resolve() if args else DEFAULT_OUT)
