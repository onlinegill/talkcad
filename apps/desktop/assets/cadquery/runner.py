#!/usr/bin/env python3
import argparse
import json
import sys

try:
    import cadquery as cq
except Exception as exc:
    print(json.dumps({"success": False, "error": f"CadQuery is not installed: {exc}"}))
    sys.exit(2)


def build(spec):
    primitive = spec.get("primitive", "box")
    if primitive == "box":
        width = float(spec.get("width", 60))
        depth = float(spec.get("depth", 40))
        height = float(spec.get("height", 20))
        result = cq.Workplane("XY").box(width, depth, height)
    elif primitive == "cylinder":
        diameter = float(spec.get("diameter", 40))
        height = float(spec.get("height", 20))
        result = cq.Workplane("XY").cylinder(height, diameter / 2.0)
    elif primitive == "sphere":
        diameter = float(spec.get("diameter", 40))
        result = cq.Workplane("XY").sphere(diameter / 2.0)
    else:
        raise ValueError(f"Unsupported primitive: {primitive}")

    for feature in spec.get("features", []):
        kind = feature.get("kind")
        if kind == "hole":
            diameter = float(feature.get("diameter", 4))
            x = float(feature.get("x", 0))
            y = float(feature.get("y", 0))
            depth = feature.get("depth")
            work = result.faces(">Z").workplane().center(x, y)
            result = work.hole(diameter, float(depth)) if depth else work.hole(diameter)
        elif kind == "fillet":
            radius = float(feature.get("radius", 1))
            selector = feature.get("selector", "|Z")
            result = result.edges(selector).fillet(radius)
        elif kind == "chamfer":
            length = float(feature.get("length", 1))
            selector = feature.get("selector", "|Z")
            result = result.edges(selector).chamfer(length)
        elif kind == "translate":
            result = result.translate((
                float(feature.get("x", 0)),
                float(feature.get("y", 0)),
                float(feature.get("z", 0)),
            ))
        elif kind == "rotate":
            axis = feature.get("axis", "z").lower()
            angle = float(feature.get("angle", 0))
            end = {"x": (1,0,0), "y": (0,1,0), "z": (0,0,1)}.get(axis, (0,0,1))
            result = result.rotate((0,0,0), end, angle)
        else:
            raise ValueError(f"Unsupported feature: {kind}")

    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--spec", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--format", choices=["step", "stl"], required=True)
    args = parser.parse_args()

    try:
        with open(args.spec, "r", encoding="utf-8") as handle:
            spec = json.load(handle)
        result = build(spec)
        if args.format == "step":
            result.export(args.output)
        else:
            cq.exporters.export(result, args.output)
        print(json.dumps({"success": True, "output": args.output}))
    except Exception as exc:
        print(json.dumps({"success": False, "error": str(exc)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
