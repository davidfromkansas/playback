"""Builds the stainless steel shelf each Street row of CDs stands on, and exports public/models/shelf.glb.

Run with Blender's Python (bpy):  python blender/shelf.py
1 unit = 100 mm, like the jewel case. Coordinates are written in three.js space (y up, +z toward the
viewer) and converted to Blender's z-up space by `B()`.

Rows have different lengths, so the long parts are 1 unit long along x and the app stretches them:

  Plate    folded steel sheet: flat top (y = 0 is the surface the cases stand on), a rounded front lip
           with a hem underneath, and a short upstand along the back. 1.9 deep (z -0.95..0.95).
  Rail     square steel tube under the back of the plate.
  Bracket  one triangular gusset bracket with a folded flange and two bolts. The app repeats it.

UVs: u runs 0..1 along x, v along the profile, so the app's brushed-steel streaks follow the shelf.
"""
import math
import os

import bpy

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public', 'models', 'shelf.glb')

bpy.ops.wm.read_factory_settings(use_empty=True)
MATS = {}


def mat(name):
    if name not in MATS:
        m = bpy.data.materials.new(name)
        m.metallic = 1.0
        m.roughness = 0.3
        MATS[name] = m
    return MATS[name]


def B(v):
    """three.js (x, y, z) -> Blender (x, -z, y)."""
    x, y, z = v
    return (x, -z, y)


def fillet(points, radii, steps=6):
    """Rounds the corners of a closed (z, y) outline. radii[i] is the radius at points[i] (0 = sharp)."""
    out = []
    n = len(points)
    for i, p in enumerate(points):
        r = radii[i]
        if not r:
            out.append(p)
            continue
        a, c = points[i - 1], points[(i + 1) % n]
        da = _unit(a[0] - p[0], a[1] - p[1])
        dc = _unit(c[0] - p[0], c[1] - p[1])
        half = math.acos(max(-1, min(1, da[0] * dc[0] + da[1] * dc[1]))) / 2
        d = r / math.tan(half)  # how far along each edge the arc starts
        s = (p[0] + da[0] * d, p[1] + da[1] * d)
        e = (p[0] + dc[0] * d, p[1] + dc[1] * d)
        bis = _unit(da[0] + dc[0], da[1] + dc[1])
        ctr = (p[0] + bis[0] * r / math.sin(half), p[1] + bis[1] * r / math.sin(half))
        a0 = math.atan2(s[1] - ctr[1], s[0] - ctr[0])
        a1 = math.atan2(e[1] - ctr[1], e[0] - ctr[0])
        sweep = (a1 - a0 + math.pi) % (2 * math.pi) - math.pi
        for k in range(steps + 1):
            t = a0 + sweep * k / steps
            out.append((ctr[0] + math.cos(t) * r, ctr[1] + math.sin(t) * r))
    return out


def _unit(x, y):
    l = math.hypot(x, y) or 1
    return (x / l, y / l)


def extrude(name, profile, x0, x1, material, cap=True):
    """Sweeps a closed (z, y) outline along x from x0 to x1, with flat end caps."""
    n = len(profile)
    verts = [B((x0, y, z)) for z, y in profile] + [B((x1, y, z)) for z, y in profile]
    faces, uvs = [], []
    dist = [0.0]
    for i in range(1, n + 1):
        a, b = profile[i - 1], profile[i % n]
        dist.append(dist[-1] + math.hypot(b[0] - a[0], b[1] - a[1]))
    total = dist[-1]
    for i in range(n):
        j = (i + 1) % n
        faces.append((i, j, n + j, n + i))
        v0, v1 = dist[i] / total, dist[i + 1] / total
        uvs.append([(0, v0), (0, v1), (1, v1), (1, v0)])
    if cap:
        faces.append(tuple(reversed(range(n))))
        uvs.append([(0, 0)] * n)
        faces.append(tuple(range(n, 2 * n)))
        uvs.append([(1, 0)] * n)
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    uv = me.uv_layers.new(name='UVMap')
    for poly, face_uv in zip(me.polygons, uvs):
        for li, u in zip(poly.loop_indices, face_uv):
            uv.data[li].uv = u
    me.validate()
    _fix_normals(me)
    me.materials.append(mat(material))
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    _smooth_by_angle(o)
    return o


def _fix_normals(me):
    import bmesh

    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()


def _smooth_by_angle(o, angle=40):
    """Rounded folds shade smoothly; flat faces and end caps keep crisp edges."""
    import bmesh

    me = o.data
    bm = bmesh.new()
    bm.from_mesh(me)
    for f in bm.faces:
        f.smooth = True
    for e in bm.edges:
        if len(e.link_faces) == 2 and e.calc_face_angle(0) > math.radians(angle):
            e.smooth = False
    bm.to_mesh(me)
    bm.free()
    me.update()


def join(name, objs):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    o = bpy.context.active_object
    o.name = name
    return o


# ---- Plate: one folded sheet, outline in (z, y) going round the cross-section ----------------
T = 0.025  # sheet thickness
D = 0.95  # half depth
LIP = 0.13  # front lip drop
HEM = 0.06  # hem folded back under the lip
UP = 0.12  # back upstand height
outline = [
    (-D, UP),  # top of the back upstand, outside
    (-D, -T),  # back, underneath
    (D - T, -T),  # underside meets the inside of the front lip
    (D - T, -LIP + T),
    (D - T - HEM, -LIP + T),  # hem, top
    (D - T - HEM, -LIP),
    (D, -LIP),  # bottom of the front lip, outside
    (D, 0),  # front top edge
    (-D + T, 0),  # top surface, back to the upstand
    (-D + T, UP),
]
radii = [0.012, 0.03, 0.008, 0.006, 0.008, 0.008, 0.02, 0.035, 0.008, 0.012]
extrude('Plate', fillet(outline, radii), -0.5, 0.5, 'Steel')

# ---- Rail: square tube under the back ----------------------------------------------------
R, RZ, RY = 0.045, -D + 0.16, -T - 0.045
tube = [(RZ - R, RY - R), (RZ + R, RY - R), (RZ + R, RY + R), (RZ - R, RY + R)]
extrude('Rail', fillet(tube, [0.012] * 4), -0.5, 0.5, 'SteelDark')

# ---- Bracket: triangular gusset hanging from the rail, holding up the plate -----------------
BT = 0.018  # plate thickness (along x)
drop, reach = 0.42, 1.55
tri = [(RZ - R, -T), (RZ - R + reach, -T), (RZ - R, -T - drop)]
gusset = extrude('b_gusset', fillet(tri, [0.03, 0.02, 0.03]), -BT / 2, BT / 2, 'SteelDark')
# A lightening hole would need booleans; a pressed rib on each face reads the same from a distance.
rib = [(RZ - R + 0.09, -T - 0.07), (RZ - R + reach - 0.45, -T - 0.07), (RZ - R + 0.09, -T - drop + 0.12)]
ribs = [
    extrude('b_rib_a', fillet(rib, [0.03, 0.03, 0.03]), BT / 2, BT / 2 + 0.008, 'SteelDark'),
    extrude('b_rib_b', fillet(rib, [0.03, 0.03, 0.03]), -BT / 2 - 0.008, -BT / 2, 'SteelDark'),
]
# Folded flange along the sloping edge, so the bracket looks pressed from sheet steel.
flange_w = 0.05
p0, p1 = (RZ - R + reach, -T), (RZ - R, -T - drop)
dz, dy = _unit(p1[0] - p0[0], p1[1] - p0[1])
nz, ny = dy, -dz  # pointing away from the triangle
if nz * (RZ - p0[0]) + ny * (-0.2 - p0[1]) > 0:
    nz, ny = -nz, -ny
edge = [
    (p0[0], p0[1]),
    (p1[0], p1[1]),
    (p1[0] + nz * 0.012, p1[1] + ny * 0.012),
    (p0[0] + nz * 0.012, p0[1] + ny * 0.012),
]
flange = extrude('b_flange', edge, -flange_w / 2, flange_w / 2, 'SteelDark')
# Bolts through the gusset into the rail: hex heads on both faces.
bolts = []
for side in (1, -1):
    bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=0.022, depth=0.016, location=B((side * (BT / 2 + 0.016), RY, RZ)),
                                        rotation=(0, math.pi / 2, 0))
    o = bpy.context.active_object
    o.data.materials.append(mat('SteelDark'))
    bolts.append(o)
join('Bracket', [gusset, flange, *ribs, *bolts])

bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_apply=True, export_yup=True,
                          export_materials='EXPORT', export_texcoords=True, export_normals=True)
print('wrote', os.path.abspath(OUT))
