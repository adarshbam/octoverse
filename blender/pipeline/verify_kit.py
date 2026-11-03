"""Checks the pipeline kit glb without Blender or any library: reads the glb's JSON chunk and
exits non-zero if a required node is missing or an LED mesh lacks its attributes.

    python blender/pipeline/verify_kit.py [public/flux/world/kit.glb]

Checks: every required node name exists, with a `_lod1` twin; every primitive of the towers and
the rack module that uses the material named `led` has COLOR_0 and a scalar `_PHASE` with the
same count as POSITION (the glb's buffers are meshopt-compressed, so values are not read here;
build_kit.py asserts the LED colour mix when it builds).
"""
import json
import struct
import sys
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
