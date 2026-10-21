"""Builds a standard CD jewel case and exports public/models/jewelcase.glb.

Run with Blender's Python (bpy):  python blender/jewelcase.py
Real case: 142 x 125 x 10 mm; here 1 unit = 100 mm, so it matches CASE_W x CASE_H in the app.
Coordinates below are written in three.js space (y up, +z = front of the case) and converted
to Blender's z-up space by `B()`.

Objects (the app swaps in its own materials by name):
  BaseShell  clear plastic bottom half          Tray   black disc tray
  Hub        the toothed rosette that holds the disc
  Inlay      paper card behind the tray         SpineL / SpineR  printed spine strips (UV 0..1)
  LidShell   clear lid with hinge ribs and booklet tabs (origin on the hinge)
  Booklet    the cover booklet under the lid (origin on the hinge, UV 0..1 = cover art)
"""
import math
import os

import bpy

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public', 'models', 'jewelcase.glb')

W, H = 1.42, 1.25
HINGE = (-W / 2, 0.0, 0.0)

bpy.ops.wm.read_factory_settings(use_empty=True)
MATS = {}


def mat(name):
    if name not in MATS:
        MATS[name] = bpy.data.materials.new(name)
    return MATS[name]


def B(v):
    """three.js (x, y, z) -> Blender (x, -z, y)."""
    x, y, z = v
    return (x, -z, y)


def box(name, x0, x1, y0, y1, z0, z1, material, bevel=0.0):
    """Axis-aligned box from three.js-space extents."""
    c = ((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)
    bpy.ops.mesh.primitive_cube_add(size=1, location=B(c))
    o = bpy.context.active_object
    o.name = name
    o.scale = (x1 - x0, z1 - z0, y1 - y0)
    bpy.ops.object.transform_apply(scale=True)
    if bevel:
        mod = o.modifiers.new('bevel', 'BEVEL')
        mod.width = bevel
        mod.segments = 3
        mod.limit_method = 'ANGLE'
        bpy.ops.object.modifier_apply(modifier=mod.name)
    o.data.materials.append(mat(material))
    return o


def plane(name, x0, x1, y0, y1, z, material, facing=1):
    """A UV-mapped rectangle at depth z, facing +z (facing=1) or -z (facing=-1)."""
    verts = [B((x0, y0, z)), B((x1, y0, z)), B((x1, y1, z)), B((x0, y1, z))]
    faces = [(0, 1, 2, 3)] if facing > 0 else [(3, 2, 1, 0)]
    return _mesh(name, verts, faces, [(0, 0), (1, 0), (1, 1), (0, 1)], material)


def side_plane(name, x, y0, y1, z0, z1, material, facing):
    """A UV-mapped rectangle in the y/z plane at x, facing +x or -x. V runs bottom to top."""
    verts = [B((x, y0, z1)), B((x, y0, z0)), B((x, y1, z0)), B((x, y1, z1))]
    uvs = [(1, 0), (0, 0), (0, 1), (1, 1)]
    faces = [(0, 1, 2, 3)] if facing < 0 else [(3, 2, 1, 0)]
    return _mesh(name, verts, faces, uvs, material)


def _mesh(name, verts, faces, uvs, material):
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    uv = me.uv_layers.new(name='UVMap')
    for poly in me.polygons:
        for li, vi in zip(poly.loop_indices, poly.vertices):
            uv.data[li].uv = uvs[vi]
    me.materials.append(mat(material))
    o = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(o)
    return o


def join(name, objs):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    o = bpy.context.active_object
    o.name = name
    return o


def set_origin(o, point):
    bpy.context.scene.cursor.location = B(point)
    bpy.ops.object.select_all(action='DESELECT')
    o.select_set(True)
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.origin_set(type='ORIGIN_CURSOR')


# ---- Base: clear bottom shell -------------------------------------------------------
T = 0.012  # wall thickness
BACK, TOP = -0.07, -0.004
base = [
    box('b_back', -W / 2, W / 2, -H / 2, H / 2, BACK, BACK + T, 'Plastic', 0.004),
    box('b_top', -W / 2, W / 2, H / 2 - T, H / 2, BACK, TOP, 'Plastic', 0.004),
    box('b_bot', -W / 2, W / 2, -H / 2, -H / 2 + T, BACK, TOP, 'Plastic', 0.004),
    box('b_right', W / 2 - T, W / 2, -H / 2, H / 2, BACK, TOP, 'Plastic', 0.004),
    box('b_left', -W / 2, -W / 2 + T, -H / 2, H / 2, BACK, TOP - 0.02, 'Plastic', 0.004),
]
join('BaseShell', base)

# Paper inlay card behind the tray, folded up into both spines.
plane('Inlay', -W / 2 + T, W / 2 - T, -H / 2 + T, H / 2 - T, BACK + T + 0.001, 'Paper')
side_plane('SpineL', -W / 2 + T + 0.001, -H / 2 + T, H / 2 - T, BACK + T, TOP - 0.022, 'Spine', -1)
side_plane('SpineR', W / 2 - T - 0.001, -H / 2 + T, H / 2 - T, BACK + T, TOP - 0.008, 'Spine', 1)

# ---- Tray: black insert with a shallow disc well and a toothed hub ------------------
TRAY_TOP = -0.014
TRAY_X0, TRAY_X1 = -W / 2 + 0.05, W / 2 - T
# The hub (and the disc on it) sits in the middle of the tray. Keep in sync with HUB_X in JewelCase.tsx.
HUB_X = (TRAY_X0 + TRAY_X1) / 2
tray = [
    box('t_body', TRAY_X0, TRAY_X1, -H / 2 + T, H / 2 - T, BACK + T + 0.004, TRAY_TOP - 0.004, 'Tray', 0.003),
    # Raised rim around the disc well (four corner pads, like a real tray).
]
for sx in (-1, 1):
    for sy in (-1, 1):
        cx = HUB_X + sx * 0.55
        cy = sy * 0.5
        tray.append(box(f't_pad{sx}{sy}', cx - 0.09, cx + 0.09, cy - 0.09, cy + 0.09, TRAY_TOP - 0.006, TRAY_TOP, 'Tray', 0.004))
# Finger notches on both sides of the well.
for sy in (-1, 1):
    tray.append(box(f't_lip{sy}', HUB_X - 0.28, HUB_X + 0.28, sy * 0.6 - 0.012, sy * 0.6 + 0.012, TRAY_TOP - 0.006, TRAY_TOP, 'Tray', 0.003))
join('Tray', tray)

hub = []
bpy.ops.mesh.primitive_cylinder_add(radius=0.085, depth=0.006, vertices=48, location=B((HUB_X, 0, TRAY_TOP - 0.001)), rotation=(math.pi / 2, 0, 0))
hub.append(bpy.context.active_object)
for i in range(12):
    a = i / 12 * math.tau
    bpy.ops.mesh.primitive_cube_add(size=1, location=B((HUB_X + math.cos(a) * 0.06, math.sin(a) * 0.06, TRAY_TOP + 0.008)))
    t = bpy.context.active_object
    t.scale = (0.028, 0.016, 0.012)
    t.rotation_euler = (0, -a, 0)  # three z-rotation = Blender -y rotation
    hub.append(t)
bpy.ops.object.select_all(action='DESELECT')
for o in hub:
    o.select_set(True)
bpy.context.view_layer.objects.active = hub[0]
bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
h = join('Hub', hub)
h.data.materials.clear()
h.data.materials.append(mat('Hub'))

# ---- Lid: clear plate with lips, hinge knuckle, grip ribs and booklet tabs -----------
PL0, PL1 = 0.016, 0.03
lid = [
    box('l_plate', -W / 2, W / 2, -H / 2, H / 2, PL0, PL1, 'Plastic', 0.005),
    box('l_top', -W / 2 + 0.02, W / 2, H / 2 - 0.01, H / 2, -0.002, PL0, 'Plastic', 0.003),
    box('l_bot', -W / 2 + 0.02, W / 2, -H / 2, -H / 2 + 0.01, -0.002, PL0, 'Plastic', 0.003),
    box('l_right', W / 2 - 0.01, W / 2, -H / 2, H / 2, -0.002, PL0, 'Plastic', 0.003),
]
# Hinge knuckle rolled around the left edge.
bpy.ops.mesh.primitive_cylinder_add(radius=0.02, depth=H, vertices=24, location=B((-W / 2 + 0.012, 0, 0.012)))
lid.append(bpy.context.active_object)
# The ribbed strip next to the hinge.
for i in range(7):
    x = -W / 2 + 0.03 + i * 0.012
    lid.append(box(f'l_rib{i}', x, x + 0.004, -H / 2 + 0.03, H / 2 - 0.03, PL1 - 0.002, PL1 + 0.004, 'Plastic', 0.0015))
# Two tabs on the inside right edge that hold the booklet in.
for sy in (-1, 1):
    lid.append(box(f'l_tab{sy}', W / 2 - 0.045, W / 2 - 0.01, sy * 0.35 - 0.06, sy * 0.35 + 0.06, PL0 - 0.008, PL0, 'Plastic', 0.002))
for o in lid:
    if not o.data.materials:
        o.data.materials.append(mat('Plastic'))
lid_obj = join('LidShell', lid)
set_origin(lid_obj, HINGE)

# The 120 mm square booklet, tucked under the right tabs, leaving the ribbed strip clear.
BX0, BX1 = -0.58, 0.62
book = plane('Booklet', BX0, BX1, -0.6, 0.6, PL0 - 0.0015, 'Cover')
book_back = plane('BookletBack', BX0, BX1, -0.6, 0.6, PL0 - 0.0025, 'BookletInside', facing=-1)
set_origin(book, HINGE)
set_origin(book_back, HINGE)

for o in bpy.data.objects:
    if o.type == 'MESH':
        for p in o.data.polygons:
            p.use_smooth = False

os.makedirs(os.path.dirname(OUT), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_apply=True, export_yup=True,
                          export_materials='EXPORT', export_texcoords=True, export_normals=True)
print('wrote', OUT, os.path.getsize(OUT), 'bytes')
print('booklet x range', BX0, BX1)
