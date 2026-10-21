"""Builds the Street theme's rooftop and city skyline and exports public/models/rooftop.glb.

Run with Blender's Python (bpy):  python blender/rooftop.py
Blender is Z-up; the glTF exporter converts to three.js Y-up. 1 unit = 1 three.js unit.
Materials are named by role; the app swaps them for toon materials at load time.
Objects named Billboard_* get a texture from the user's library in the app.
"""
import math
import os
import random

import bpy

random.seed(7)
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public', 'models', 'rooftop.glb')

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

MATS = {}


def mat(name, rgb):
    if name not in MATS:
        m = bpy.data.materials.new(name)
        m.use_nodes = True
        bsdf = m.node_tree.nodes['Principled BSDF']
        bsdf.inputs['Base Color'].default_value = (*rgb, 1)
        bsdf.inputs['Roughness'].default_value = 0.8
        MATS[name] = m
    return MATS[name]


def hexrgb(h):
    h = h.lstrip('#')
    # Blender wants linear colour; glTF exports it back to sRGB.
    return tuple(((int(h[i:i + 2], 16) / 255) ** 2.2) for i in (0, 2, 4))


def box(name, size, loc, material, rot=(0, 0, 0), bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.active_object
    o.name = name
    o.scale = size
    bpy.ops.object.transform_apply(scale=True)
    if bevel:
        mod = o.modifiers.new('bevel', 'BEVEL')
        mod.width = bevel
        mod.segments = 2
        bpy.ops.object.modifier_apply(modifier=mod.name)
    o.data.materials.append(material)
    return o


def cyl(name, r, h, loc, material, verts=24, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=h, vertices=verts, location=loc, rotation=rot)
    o = bpy.context.active_object
    o.name = name
    o.data.materials.append(material)
    return o


def join(objs, name):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    o = bpy.context.active_object
    o.name = name
    return o


# Palette: JSRF-style saturated colours.
concrete = mat('Concrete', hexrgb('#c9d3e0'))
floor = mat('Floor', hexrgb('#7d8aa3'))
trim = mat('Trim', hexrgb('#ffd21f'))
metal = mat('Metal', hexrgb('#9fb3c8'))
tank = mat('Tank', hexrgb('#ff8a1f'))
pipe = mat('Pipe', hexrgb('#19c3b4'))
ramp = mat('Ramp', hexrgb('#ff3d9a'))
rail = mat('Rail', hexrgb('#2b2b2b'))
bldg = [mat('BuildingA', hexrgb('#8fd3ff')), mat('BuildingB', hexrgb('#b9a6ff')),
        mat('BuildingC', hexrgb('#ffffff')), mat('BuildingD', hexrgb('#9dff8a'))]
window = mat('Windows', hexrgb('#2f7bff'))
window_lit = mat('WindowsLit', hexrgb('#ffe14d'))
frame = mat('BillboardFrame', hexrgb('#2b2b2b'))

# ---- Rooftop (the floor the CD rack stands on). Floor top at z=0, rack front at y=0. ----
roof = []
roof.append(box('RoofSlab', (90, 46, 1), (0, 20, -0.5), floor))
# Painted lines on the roof
for x in (-12, 0, 12):
    roof.append(box('RoofLine', (0.25, 30, 0.02), (x, 16, 0.01), trim))
# Parapet wall along the back edge and sides, with a yellow cap
roof.append(box('ParapetBack', (90, 0.8, 1.6), (0, 42.6, 0.8), concrete))
roof.append(box('ParapetCap', (90.4, 1.1, 0.25), (0, 42.6, 1.7), trim))
for x in (-44.6, 44.6):
    roof.append(box('ParapetSide', (0.8, 46, 1.6), (x, 20, 0.8), concrete))
    roof.append(box('ParapetSideCap', (1.1, 46, 0.25), (x, 20, 1.7), trim))
roof_mesh = join(roof, 'Rooftop')

props = []
# Water tank on stilts (classic rooftop silhouette)
for dx, dy in ((-1.6, -1.6), (1.6, -1.6), (-1.6, 1.6), (1.6, 1.6)):
    props.append(box('TankLeg', (0.3, 0.3, 5), (-20 + dx, 24 + dy, 2.5), metal))
props.append(cyl('Tank', 3, 5, (-20, 24, 7.5), tank, 32))
bpy.ops.mesh.primitive_cone_add(radius1=3.2, depth=1.6, vertices=32, location=(-20, 24, 10.8))
cone = bpy.context.active_object
cone.data.materials.append(tank)
props.append(cone)
# AC units
for i, (x, y) in enumerate(((10, 12), (14, 12), (10, 16), (24, 20))):
    props.append(box('AC', (3, 2.4, 2), (x, y, 1), metal, bevel=0.12))
    props.append(cyl('Fan', 0.9, 0.1, (x, y, 2.05), rail, 20))
# Stairwell hut with a door
props.append(box('Stairwell', (8, 6, 6), (26, 32, 3), concrete, bevel=0.1))
props.append(box('StairwellRoof', (8.6, 6.6, 0.4), (26, 32, 6.2), trim))
props.append(box('Door', (2.2, 0.1, 3.8), (24, 28.95, 1.9), pipe))
# Pipes running along the floor
props.append(cyl('PipeRun', 0.35, 40, (-8, 38, 0.6), pipe, 16, rot=(0, math.pi / 2, 0)))
props.append(cyl('PipeRun2', 0.25, 20, (-30, 30, 0.5), pipe, 16, rot=(math.pi / 2, 0, 0)))
# Antenna mast
props.append(cyl('Mast', 0.15, 16, (34, 38, 8), metal, 8))
for h in (5, 9, 13):
    props.append(box('MastBar', (3, 0.1, 0.1), (34, 38, h), metal))
props_mesh = join(props, 'RooftopProps')

# Quarter-pipe ramp and a grind rail: the roof is a skate park.
mesh = bpy.data.meshes.new('Ramp')
verts = []
faces = []
steps = 12
for i in range(steps + 1):
    a = (math.pi / 2) * i / steps
    y = 4 * math.sin(a)  # forward distance
    z = 4 * (1 - math.cos(a))  # height
    verts.append((-5, 6 + y, z))
    verts.append((5, 6 + y, z))
for i in range(steps):
    a, b, c, d = 2 * i, 2 * i + 1, 2 * i + 3, 2 * i + 2
    faces.append((a, b, c, d))
# back and sides
base = len(verts)
verts += [(-5, 10, 0), (5, 10, 0)]
faces.append((2 * steps, 2 * steps + 1, base + 1, base))
faces.append((0, base, base + 1, 1)[::-1])
mesh.from_pydata(verts, [], faces)
mesh.update()
ramp_obj = bpy.data.objects.new('QuarterPipe', mesh)
bpy.context.collection.objects.link(ramp_obj)
ramp_obj.data.materials.append(ramp)
ramp_obj.location = (-34, 8, 0)
sides = [box('RampSide', (0.3, 4, 4), (-39.15, 16, 2), ramp), box('RampSide', (0.3, 4, 4), (-28.85, 16, 2), ramp),
         box('RampCoping', (10.4, 0.4, 0.4), (-34, 18, 4.1), metal)]
rail_objs = [cyl('GrindRail', 0.18, 18, (8, 6, 1.4), rail, 12, rot=(0, math.pi / 2, 0))]
for x in (0, 8, 16):
    rail_objs.append(box('RailPost', (0.2, 0.2, 1.4), (x, 6, 0.7), rail))
join([ramp_obj, *sides, *rail_objs], 'SkateStuff')

# ---- City skyline behind the roof ----
city = []
lit = []
for i in range(70):
    x = random.uniform(-120, 120)
    y = random.uniform(55, 150)
    w = random.uniform(5, 14)
    d = random.uniform(5, 14)
    h = random.uniform(12, 60) * (1.25 if abs(x) > 30 else 1)
    m = random.choice(bldg)
    b = box('Bldg', (w, d, h), (x, y, h / 2 - 25), m)
    city.append(b)
    # Window bands on the front face
    floors = int(h // 4)
    for f in range(1, floors):
        z = f * 4 - 25
        wm = window_lit if random.random() < 0.12 else window
        band = box('Win', (w * 0.82, 0.2, 1.4), (x, y - d / 2 - 0.05, z), wm)
        (lit if wm is window_lit else city).append(band)
    if random.random() < 0.3:
        city.append(box('RoofBox', (w * 0.4, d * 0.4, 3), (x, y, h - 25 + 1.5), concrete))
join(city + lit, 'City')

# ---- Billboards (their faces get covers from the user's library) ----
for i, (x, y, z, s) in enumerate(((-36, 48, 14, 16), (40, 52, 18, 14), (0, 75, 32, 18))):
    parts = [box('BBFrame', (s + 1.2, 0.8, s * 0.56 + 1.2), (x, y + 0.5, z), frame)]
    for lx in (x - s / 3, x + s / 3):
        bottom = -25 if y > 45 else 0
        parts.append(box('BBLeg', (0.5, 0.5, z - bottom), (lx, y + 1, (z + bottom) / 2), frame))
    join(parts, f'BillboardFrame_{i}')
    # The face is a plane facing the camera (-Y in Blender) just in front of the frame.
    bpy.ops.mesh.primitive_plane_add(size=1, location=(x, y - 0.05, z), rotation=(math.pi / 2, 0, 0))
    face = bpy.context.active_object
    face.name = f'Billboard_{i}'
    face.scale = (s, s * 0.56, 1)
    bpy.ops.object.transform_apply(scale=True, rotation=True)
    face.data.materials.append(mat(f'BillboardFace_{i}', (1, 1, 1)))

# Flat shading everywhere: toon materials read best with hard facets.
for o in bpy.data.objects:
    if o.type == 'MESH':
        for p in o.data.polygons:
            p.use_smooth = False

os.makedirs(os.path.dirname(OUT), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', export_apply=True, export_yup=True,
                          export_materials='EXPORT', export_texcoords=True, export_normals=True)
print('wrote', OUT, os.path.getsize(OUT), 'bytes')
