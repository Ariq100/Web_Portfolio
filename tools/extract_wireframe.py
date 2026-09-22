"""
Extracts an accurate line drawing ("frame model") from a real 3D model with Blender.

  Blender -b [scene.blend] --python tools/extract_wireframe.py -- <out.bin> <preset> [model.fbx]

Rebuild the site's models (Blender = /Applications/Blender.app/Contents/MacOS/Blender):

  Blender -b model-sources/free-1975-porsche-911-930-turbo/source/911_scene.blend \
      --python tools/extract_wireframe.py -- public/models/porsche930.bin porsche
  unzip model-sources/2011-lexus-lfa/source/FINAL_MODEL.zip FINAL_MODEL.fbx -d /tmp/lfa
  Blender -b --python tools/extract_wireframe.py -- public/models/lfa.bin lfa /tmp/lfa/FINAL_MODEL.fbx

For every visible mesh (after modifiers such as Mirror are applied) it keeps:
  * feature edges: open borders, creases sharper than CREASE_DEG, and material borders
    (window outlines, lamp lenses, grille meshes);
  * section lines through the body paint: the real surface sliced by evenly spaced planes
    along the length, height and width, like a draughtsman's wireframe.

Each segment is tagged with a class (body, glass, lamp, trim, wheel, amber, red) so the
site can colour it. Output: 'WF01', uint32 count, float32 bbox min/max, int16 positions
quantised to the bbox (count × 6), uint8 classes (count).
"""
import bpy, sys, math, struct
import numpy as np

args = sys.argv[sys.argv.index("--") + 1:]
out_path, preset = args[0], args[1]
if len(args) > 2:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.fbx(filepath=args[2])

BODY, GLASS, LAMP, TRIM, WHEEL, AMBER, RED = range(7)
CREASE_DEG = 32

PRESETS = {
    "porsche": {
        "skip_obj": ["Plane.015", "Plane.005"],  # ground shadow, air freshener
        "classes": [("paint", BODY), ("coat", BODY), ("glass", GLASS), ("lights", LAMP),
                    ("rim", WHEEL), ("tire", WHEEL), ("chrome", TRIM), ("plastic", TRIM),
                    ("black", TRIM), ("sticker", TRIM), ("plate", TRIM)],
        "slices": (40, 12, 9),
    },
    "lfa": {
        "skip_obj": ["Interior", "Engine", "SeatBelt", "WindowInside"],
        "classes": [("red_glass", RED), ("orange_glass", AMBER), ("window", GLASS), ("paint", BODY),
                    ("coloured", BODY), ("chrome", TRIM), ("mirror", TRIM), ("light", LAMP),
                    ("wheel", WHEEL), ("calliper", WHEEL), ("carbon", TRIM), ("grille", TRIM),
                    ("badge", TRIM), ("plate", TRIM), ("base", TRIM)],
        "slices": (40, 12, 9),
    },
}[preset]


def class_of(mat_name):
    n = (mat_name or "").lower()
    for key, cls in PRESETS["classes"]:
        if key in n:
            return cls
    return TRIM


segments = []  # (N, 6) float arrays
classes = []
body_tris = []

depsgraph = bpy.context.evaluated_depsgraph_get()
for obj in bpy.context.scene.objects:
    if obj.type != "MESH" or not obj.visible_get():
        continue
    if any(s.lower() in obj.name.lower() for s in PRESETS["skip_obj"]):
        continue
    ev = obj.evaluated_get(depsgraph)
    me = ev.to_mesh()
    if not me.polygons:
        ev.to_mesh_clear()
        continue
    M = np.array(obj.matrix_world)
    co = np.empty(len(me.vertices) * 3, dtype=np.float64)
    me.vertices.foreach_get("co", co)
    co = co.reshape(-1, 3) @ M[:3, :3].T + M[:3, 3]

    mats = [class_of(m.name if m else "") for m in me.materials] or [TRIM]
    poly_cls = np.array([mats[min(p.material_index, len(mats) - 1)] for p in me.polygons])
    normals = np.array([p.normal[:] for p in me.polygons]) @ M[:3, :3].T
    normals /= np.linalg.norm(normals, axis=1, keepdims=True) + 1e-12

    edge_faces = {}
    for pi, p in enumerate(me.polygons):
        for ek in p.edge_keys:
            edge_faces.setdefault(ek, []).append(pi)
    cos_limit = math.cos(math.radians(CREASE_DEG))
    keep, keep_cls = [], []
    for (a, b), faces in edge_faces.items():
        f0 = faces[0]
        if len(faces) == 1:
            keep.append((a, b)); keep_cls.append(poly_cls[f0]); continue
        f1 = faces[1]
        if poly_cls[f0] != poly_cls[f1]:
            # Border between materials: take the more specific class (glass/lamp over paint).
            keep.append((a, b)); keep_cls.append(max(poly_cls[f0], poly_cls[f1]) if BODY in (poly_cls[f0], poly_cls[f1]) else poly_cls[f0]); continue
        if float(normals[f0] @ normals[f1]) < cos_limit:
            keep.append((a, b)); keep_cls.append(poly_cls[f0])
    if keep:
        k = np.array(keep)
        segments.append(np.hstack([co[k[:, 0]], co[k[:, 1]]]))
        classes.append(np.array(keep_cls, dtype=np.uint8))

    # Collect body-paint triangles for section lines.
    me.calc_loop_triangles()
    tri = np.array([t.vertices[:] for t in me.loop_triangles if poly_cls[t.polygon_index] == BODY], dtype=np.int64)
    if len(tri):
        body_tris.append(co[tri])
    ev.to_mesh_clear()

segs = np.vstack(segments)
cls = np.concatenate(classes)

# Section lines: slice body triangles with planes along each axis.
if body_tris:
    T = np.vstack(body_tris)  # (n, 3, 3)
    lo, hi = T.reshape(-1, 3).min(0), T.reshape(-1, 3).max(0)
    counts = PRESETS["slices"]
    axes = np.argsort(-(hi - lo))  # longest axis first
    sec = []
    for axis, n in zip(axes, counts):
        for c in np.linspace(lo[axis], hi[axis], n + 2)[1:-1]:
            d = T[:, :, axis] - c
            s = np.sign(d)
            cross = ~((s[:, 0] == s[:, 1]) & (s[:, 1] == s[:, 2]))
            if not cross.any():
                continue
            Tc, dc = T[cross], d[cross]
            pts = []
            for i, j in ((0, 1), (1, 2), (2, 0)):
                di, dj = dc[:, i], dc[:, j]
                hit = (di * dj) < 0
                t = np.where(hit, di / np.where(hit, di - dj, 1), 0)
                p = Tc[:, i] + (Tc[:, j] - Tc[:, i]) * t[:, None]
                pts.append((hit, p))
            # Each crossing triangle yields the two edge hits as one segment.
            h = np.stack([p[0] for p in pts], 1)
            P = np.stack([p[1] for p in pts], 1)
            ok = h.sum(1) == 2
            idx = np.argsort(~h[ok], axis=1, kind="stable")[:, :2]
            PP = P[ok][np.arange(ok.sum())[:, None], idx]
            sec.append(PP.reshape(-1, 6))
    if sec:
        sec = np.vstack(sec)
        segs = np.vstack([segs, sec])
        cls = np.concatenate([cls, np.full(len(sec), BODY, dtype=np.uint8)])

# Drop degenerate and duplicate segments.
length = np.linalg.norm(segs[:, :3] - segs[:, 3:], axis=1)
good = length > 1e-5
segs, cls = segs[good], cls[good]
key = np.round(np.minimum(segs[:, :3], segs[:, 3:]) * 1e4).astype(np.int64)
key2 = np.round(np.maximum(segs[:, :3], segs[:, 3:]) * 1e4).astype(np.int64)
_, uniq = np.unique(np.hstack([key, key2]), axis=0, return_index=True)
segs, cls = segs[np.sort(uniq)], cls[np.sort(uniq)]

# Blender is Z-up; the site is Y-up. Put the longest horizontal axis on X.
pts = segs.reshape(-1, 3)
ext = pts.max(0) - pts.min(0)
long_axis = 0 if ext[0] >= ext[1] else 1
side_axis = 1 - long_axis
pts = np.stack([pts[:, long_axis], pts[:, 2], pts[:, side_axis]], 1)
mn, mx = pts.min(0), pts.max(0)
q = np.round((pts - (mn + mx) / 2) / ((mx - mn) / 2 + 1e-12) * 32767).astype(np.int16)

with open(out_path, "wb") as f:
    f.write(b"WF01")
    f.write(struct.pack("<I", len(cls)))
    f.write(struct.pack("<6f", *mn, *mx))
    f.write(q.tobytes())
    f.write(cls.astype(np.uint8).tobytes())

print("WROTE", out_path, "segments", len(cls), "by class", np.bincount(cls, minlength=7).tolist(), "extent", (mx - mn).round(3).tolist())
