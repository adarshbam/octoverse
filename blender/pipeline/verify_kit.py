"""Checks the pipeline kit glb without Blender or any library: reads the glb's JSON chunk and
exits non-zero if a required node is missing or an LED mesh lacks its attributes.

    python blender/pipeline/verify_kit.py [public/flux/world/kit.glb]

Checks: every required node name exists, with a `_lod1` twin; every primitive of the towers and
the rack module that uses the material named `led` has COLOR_0 and a scalar `_PHASE` with the
same count as POSITION (the LED colour mix is asserted by build_kit.py when it builds); and the
portal disc is visible: looking down -Z from the camera side, the front-most surface at every
sample inside radius 1.7 of the disc's centre uses the `portal_disc` material, not the bezel.
That check needs geometry, and the glb's buffers are meshopt-compressed, so it decodes a copy with
the repo's gltf-transform (`npx --no-install gltf-transform copy`) into a temp directory.
"""
import json
import math
import os
import struct
import subprocess
import sys
import tempfile
from pathlib import Path

DEFAULT = Path(__file__).resolve().parents[2] / "public/flux/world/kit.glb"
REQUIRED = [
    "tower_a", "tower_b", "tower_c", "rack_module",
    "portal_plinth", "portal_disc", "portal_arc_1", "portal_arc_2", "portal_arc_3", "portal_arc_4",
    "bridge_deck", "bridge_pier", "bridge_arch", "rock_a", "rock_b", "rock_c", "coral_a",
]
LED_OWNERS = ["tower_a", "tower_b", "tower_c", "rack_module"]
FLOAT, UBYTE, USHORT = 5126, 5121, 5123


def read_json(path):
    data = path.read_bytes()
    magic, version, _ = struct.unpack_from("<III", data, 0)
    if magic != 0x46546C67 or version != 2:
        raise SystemExit(f"{path}: not a glb 2.0 file")
    length, kind = struct.unpack_from("<II", data, 12)
    if kind != 0x4E4F534A:
        raise SystemExit(f"{path}: first chunk is not JSON")
    return json.loads(data[20:20 + length])


COMPONENT = {5120: ("b", 1, 127.0), 5121: ("B", 1, 255.0), 5122: ("h", 2, 32767.0), 5123: ("H", 2, 65535.0), 5125: ("I", 4, 1.0), 5126: ("f", 4, 1.0)}


def read_glb(path):
    data = path.read_bytes()
    jl = struct.unpack_from("<I", data, 12)[0]
    doc = json.loads(data[20:20 + jl])
    bl = struct.unpack_from("<I", data, 20 + jl)[0]
    return doc, data[28 + jl:28 + jl + bl]


def accessor(doc, blob, index):
    """An accessor's rows as lists (normalized integers are decoded to floats)."""
    a = doc["accessors"][index]
    view = doc["bufferViews"][a["bufferView"]]
    fmt, size, norm = COMPONENT[a["componentType"]]
    width = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}[a["type"]]
    stride = view.get("byteStride") or size * width
    start = view.get("byteOffset", 0) + a.get("byteOffset", 0)
    rows = []
    for i in range(a["count"]):
        row = struct.unpack_from("<" + fmt * width, blob, start + i * stride)
        if a.get("normalized"):
            row = tuple(max(c / norm, -1.0) for c in row)
        rows.append(row)
    return rows


def node_matrix(node):
    """The node's local transform (translation, rotation, scale) as a function on points."""
    t, (qx, qy, qz, qw), sc = node.get("translation", (0, 0, 0)), node.get("rotation", (0, 0, 0, 1)), node.get("scale", (1, 1, 1))

    def apply(p):
        x, y, z = p[0] * sc[0], p[1] * sc[1], p[2] * sc[2]
        # q * v * q^-1
        tx, ty, tz = 2 * (qy * z - qz * y), 2 * (qz * x - qx * z), 2 * (qx * y - qy * x)
        return (x + qw * tx + (qy * tz - qz * ty) + t[0], y + qw * ty + (qz * tx - qx * tz) + t[1], z + qw * tz + (qx * ty - qy * tx) + t[2])
    return apply


def disc_front_check(path, problems):
    """For portal_disc and portal_disc_lod1: the highest-z surface under each sample ray, inside
    radius 1.7 of the disc's centre, must be the `portal_disc` material. Returns report lines."""
    root = Path(__file__).resolve().parents[2]
    out = []
    with tempfile.TemporaryDirectory() as tmp:
        dec = Path(tmp) / "decoded.glb"
        cmd = ["npx", "--no-install", "gltf-transform", "copy", str(path), str(dec)]
        try:
            subprocess.run(cmd, cwd=root, check=True, shell=os.name == "nt", capture_output=True, text=True)
        except (OSError, subprocess.CalledProcessError) as error:
            problems.append(f"disc check: could not decode the glb with gltf-transform: {getattr(error, 'stderr', error)}")
            return out
        doc, blob = read_glb(dec)
    nodes = {n.get("name"): n for n in doc["nodes"]}
    for name in ("portal_disc", "portal_disc_lod1"):
        node = nodes.get(name)
        if node is None or "mesh" not in node:
            continue
        to_world = node_matrix(node)
        tris = []  # (material name, three points)
        for prim in doc["meshes"][node["mesh"]]["primitives"]:
            mat = doc["materials"][prim["material"]]["name"]
            pos = [to_world(p) for p in accessor(doc, blob, prim["attributes"]["POSITION"])]
            idx = [r[0] for r in accessor(doc, blob, prim["indices"])]
            tris += [(mat, (pos[idx[i]], pos[idx[i + 1]], pos[idx[i + 2]])) for i in range(0, len(idx), 3)]
        xs = [p[0] for _, t in tris for p in t]
        ys = [p[1] for _, t in tris for p in t]
        cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
        bad, seen = [], set()
        for r in (0.0, 0.5, 1.0, 1.4, 1.65):
            for k in range(1 if r == 0 else 12):
                a = 2 * math.pi * (k + 0.5 * (r > 1.0)) / 12
                x, y = cx + r * math.cos(a), cy + r * math.sin(a)
                best = None  # (z, material)
                for mat, (p, q, w) in tris:
                    det = (q[1] - w[1]) * (p[0] - w[0]) + (w[0] - q[0]) * (p[1] - w[1])
                    if abs(det) < 1e-12:
                        continue
                    l1 = ((q[1] - w[1]) * (x - w[0]) + (w[0] - q[0]) * (y - w[1])) / det
                    l2 = ((w[1] - p[1]) * (x - w[0]) + (p[0] - w[0]) * (y - w[1])) / det
                    l3 = 1 - l1 - l2
                    if min(l1, l2, l3) < -1e-9:
                        continue
                    z = l1 * p[2] + l2 * q[2] + l3 * w[2]
                    if best is None or z > best[0] + 1e-6:
                        best = (z, mat)
                if best is None or best[1] != "portal_disc":
                    bad.append(f"r={r} a={a:.2f}: {best}")
                seen.add(best[1] if best else None)
        out.append(f"{name}: front-most surface within r<1.7 is {sorted(map(str, seen))}")
        if bad:
            problems.append(f"{name}: the disc is occluded; front-most is not `portal_disc` at {bad[:3]}")
    if not out:
        problems.append("disc check: no portal_disc node with a mesh")
    return out


def main(path):
    doc = read_json(path)
    nodes = {n.get("name"): n for n in doc["nodes"]}
    problems = []
    for name in REQUIRED:
        for node in (name, name + "_lod1"):
            if node not in nodes:
                problems.append(f"missing node {node}")
    mats = doc.get("materials", [])
    acc = doc["accessors"]
    report = []
    for owner in LED_OWNERS:
        for node in (owner, owner + "_lod1"):
            if node not in nodes or "mesh" not in nodes[node]:
                continue
            led_prims = 0
            for prim in doc["meshes"][nodes[node]["mesh"]]["primitives"]:
                mat = mats[prim["material"]]["name"] if "material" in prim else None
                if mat != "led":
                    continue
                led_prims += 1
                attrs = prim["attributes"]
                for need in ("COLOR_0", "_PHASE"):
                    if need not in attrs:
                        problems.append(f"{node}: led primitive lacks {need}")
                if "_PHASE" in attrs and "POSITION" in attrs:
                    a, p = acc[attrs["_PHASE"]], acc[attrs["POSITION"]]
                    if a["type"] != "SCALAR" or a["count"] != p["count"]:
                        problems.append(f"{node}: _PHASE is {a['type']} x{a['count']}, POSITION x{p['count']}")
                    report.append(f"{node}: led prim with {p['count']} verts, _PHASE componentType {a['componentType']} normalized={a.get('normalized', False)}")
            if led_prims == 0:
                problems.append(f"{node}: no primitive uses the `led` material")
    report += disc_front_check(path, problems)
    for line in report:
        print(line)
    names = sorted(n for n in nodes if n)
    print(f"{len(names)} nodes; required {len(REQUIRED)} (+ lod1 twins)")
    if problems:
        print("FAIL:")
        for item in problems:
            print("  " + item)
        sys.exit(1)
    print("OK")


if __name__ == "__main__":
    main(Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT)
