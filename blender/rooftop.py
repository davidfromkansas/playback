"""Deterministic, material-batched Tokyo rooftop. Run with bpy or Blender -b -P.

Blender Z-up, camera faces +Y. glTF converts to three.js Y-up.
Named faces remain separate for runtime art; Train keeps its own transform.
"""
import json
import math
import os
import random
from collections import defaultdict
import bpy
import bmesh
from mathutils import Vector
from mathutils.bvhtree import BVHTree

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
random.seed(2000)
bpy.ops.wm.read_factory_settings(use_empty=True)
MATS = {}
BATCH = defaultdict(lambda: ([], []))
LAYER = 'Roof'
COLORS = {
    'Concrete': '#e4d5ae', 'Floor': '#d5cbb0', 'Trim': '#ffc629', 'EdgeLight': '#fff0b6', 'Metal': '#263e5a',
    'RoadPaint': '#f3cd31', 'FloorSeam': '#9e9c94', 'RoofCrack': '#6e7180', 'Ink': '#101c31', 'Tank': '#b8ced8', 'Ramp': '#ffffff', 'Red': '#f32946',
    'Blue': '#1459ca', 'BuildingA': '#f2dfb0', 'BuildingB': '#7caaca',
    'BuildingC': '#879cc4', 'Blinds': '#879cc4', 'BuildingD': '#e3c78e', 'Windows': '#146782',
    'WindowsLit': '#ffba43', 'WindowsCool': '#00e4ef', 'NeonGlow': '#ff66aa',
    'VendGlow': '#a0ffff', 'TrainWindow': '#b2e6cb', 'TowerLight': '#ffb257',
    'TowerRed': '#e95d43', 'TowerWhite': '#fff1ce', 'TrainBody': '#d9e1db', 'TrainStripe': '#35b62b',
}
for name, color in COLORS.items():
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*[ (int(color[i:i+2],16)/255)**2.2 for i in (1,3,5)], 1)
    m.use_nodes = True
    m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = m.diffuse_color
    MATS[name] = m


def geo(verts, faces, material, layer=None):
    v, f = BATCH[(layer or LAYER, material)]
    n = len(v)
    v.extend(verts)
    f.extend(tuple(n+i for i in face) for face in faces)


def box(loc, size, material='Concrete', layer=None):
    x,y,z = loc
    a,b,c = [s/2 for s in size]
    geo([(x+dx*a,y+dy*b,z+dz*c) for dx,dy,dz in
        [(-1,-1,-1),(1,-1,-1),(1,1,-1),(-1,1,-1),(-1,-1,1),(1,-1,1),(1,1,1),(-1,1,1)]],
        [(3,2,1,0),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7),(4,5,6,7)],material,layer)


def beam(a,b,r=.08,material='Ink',layer=None, sides=6):
    a,b = Vector(a),Vector(b)
    axis = (b-a).normalized()
    u = axis.cross(Vector((0,0,1)))
    if u.length < .01: u = axis.cross(Vector((0,1,0)))
    u.normalize()
    v = axis.cross(u)
    vertices = [tuple(p+r*(u*math.cos(i*math.tau/sides)+v*math.sin(i*math.tau/sides))) for p in (a,b) for i in range(sides)]
    faces = [tuple(reversed(range(sides))),tuple(range(sides,2*sides))]
    faces += [(i,(i+1)%sides,(i+1)%sides+sides,i+sides) for i in range(sides)]
    geo(vertices,faces,material,layer)


def face(name,x,y,z,w,h,material=None):
    material = material or name
    if material not in MATS:
        MATS[material] = MATS['Concrete'].copy()
        MATS[material].name = material
        MATS[material].diffuse_color = (1,1,1,1)
        MATS[material].node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (1,1,1,1)
    geo([(x-w/2,y,z-h/2),(x+w/2,y,z-h/2),(x+w/2,y,z+h/2),(x-w/2,y,z+h/2)],[(0,1,2,3)],material,name)


def ac(x,y,z,scale=1):
    box((x,y,z+.7*scale),(2.3*scale,1.5*scale,1.4*scale),'Concrete')
    box((x,y-.77*scale,z+.7*scale),(1.9*scale,.06,1*scale),'Ink')
    # Circular fan, guard and compressor slats are visible on the nearest units.
    beam((x-.42*scale,y-.81*scale,z+.7*scale),(x-.42*scale,y-.87*scale,z+.7*scale),.43*scale,'Metal',sides=16)
    for j in range(5):
        box((x+.55*scale,y-.84*scale,z+(.3+j*.19)*scale),(.5*scale,.05,.06),'Metal')
    for dx in (-.7,.7): box((x+dx*scale,y,z+.05*scale),(.18*scale,1.8*scale,.16),'Ink')
    beam((x+1.1*scale,y,z+.4*scale),(x+1.5*scale,y,z+.4*scale),.09,'Blue')
    beam((x+1.5*scale,y,z+.4*scale),(x+1.5*scale,y,z+.05),.09,'Blue')


def dish(x,y,z,scale=1):
    beam((x,y,z),(x,y,z+1.3*scale),.09,'Metal')
    # Closed shallow paraboloid, tilted toward the skyline.
    verts=[]
    rings=4; segments=16
    for r in range(rings+1):
        radius=.05+r*.26
        for i in range(segments):
            a=i*math.tau/segments
            verts.append((x+math.cos(a)*radius*scale,y+(.32*radius*radius-.3*math.sin(a)*radius)*scale,z+1.8*scale+math.sin(a)*radius*scale))
    faces=[]
    for r in range(rings):
        for i in range(segments): faces.append((r*segments+i,r*segments+(i+1)%segments,(r+1)*segments+(i+1)%segments,(r+1)*segments+i))
    faces += [tuple(reversed(range(segments))),tuple(range(rings*segments,(rings+1)*segments))]
    geo(verts,faces,'Tank')
    beam((x,y,z+1.1*scale),(x,y-.9*scale,z+1.8*scale),.055,'Ink')


def roof_rail(x,y,z,w,d):
    for yy in (y-d/2,y+d/2):
        beam((x-w/2,yy,z+.85),(x+w/2,yy,z+.85),.055,'Metal')
        for j in range(6):
            xx=x-w/2+w*j/5
            beam((xx,yy,z),(xx,yy,z+.85),.045,'Ink')
    for xx in (x-w/2,x+w/2): beam((xx,y-d/2,z+.85),(xx,y+d/2,z+.85),.055,'Metal')


def tank(x,y,z,scale=1):
    for dx in (-.8,.8):
        for dy in (-.8,.8): beam((x+dx*scale,y+dy*scale,z),(x+dx*scale,y+dy*scale,z+2*scale),.08*scale,'Metal')
    beam((x,y,z+2*scale),(x,y,z+4.4*scale),1.4*scale,'Tank',sides=12)
    for h in (2.1,4.2): beam((x,y,z+h*scale),(x,y,z+(h+.12)*scale),1.46*scale,'Ink',sides=12)
    box((x,y,z+4.5*scale),(1.4*scale,1.4*scale,.2),'Metal')

# Roof: foreground kept quieter than the outer corners.
box((0,20,-.6),(90,46,1.2),'Floor')
box((0,42.5,.7),(90,.8,1.4))
box((0,42.5,1.5),(90,1,.2),'Trim')
for x in (-44.5,44.5): box((x,20,.7),(1,46,1.4))
# The adjoining rooftop service block casts the broad diagonal foreground shadow.
box((-22,-4,15),(10,12,30),'BuildingC')
box((-20,-13,15),(10,8,30),'BuildingC')
box((-19,-12,32),(4,5,4),'BuildingC')
box((-19,-3,33),(4,4,6),'BuildingC')
# Expansion joints and patched roof panels keep the ground architectural.
for xx in range(-40,41,10): box((xx,20,.014),(.025,44,.025),'FloorSeam')
for yy in range(2,43,10): box((0,yy,.014),(88,.025,.025),'FloorSeam')
paint=random.Random(713)
for x in (-12,12):
    yy=4
    while yy<38:
        length=paint.uniform(.65,2.1)
        box((x+paint.uniform(-.035,.035),yy+length/2,.025),(paint.uniform(.3,.48),length,.05),'RoadPaint')
        yy+=length+paint.uniform(.08,.3)
for yy in (10,22,36):
    for xx in (-23,-20,-17,15,18,21): box((xx,yy,.025),(1.5,.35,.05),'RoadPaint')
# Sparse branching cracks break up the regular construction joints.
cracks=random.Random(641)
for sx,sy in [(-10,12),(0,2),(10,12),(20,22),(-10,32),(20,32)]:
    x,y=sx,sy
    angle=cracks.uniform(-1.5,1.5)
    for step in range(5):
        angle+=cracks.uniform(-.6,.6)
        length=cracks.uniform(.5,1.3)
        nx,ny=x+math.cos(angle)*length,y+math.sin(angle)*length
        beam((x,y,.035),(nx,ny,.035),.012,'RoofCrack',sides=4)
        if step==2: beam((nx,ny,.035),(nx+.45,ny+.7,.035),.008,'RoofCrack',sides=4)
        x,y=nx,ny
# Recessed drain cover with concentric rim and a slatted grate.
beam((12,9,.02),(12,9,.08),1.35,'Metal',sides=32)
beam((12,9,.08),(12,9,.1),1.18,'Ink',sides=32)
for off in (-.8,-.4,0,.4,.8):
    reach=math.sqrt(1.12**2-off**2)
    beam((12-reach,9+off,.13),(12+reach,9+off,.13),.045,'Metal')
# Back fence, rods batched without outline passes.
for x in range(-42,43,7): beam((x,42,1.6),(x,42,4.4),.09,'Metal','Fence')
for z in (1.9,4.3): beam((-43,42,z),(43,42,z),.07,'Metal','Fence')
for direction in (-1,1):
    for i in range(150):
        x=-46+i*.6
        start=max(0,(-43-x)/direction) if direction>0 else max(0,(x-43)/-direction)
        end=min(2.4,(43-x)/direction) if direction>0 else min(2.4,(-43-x)/direction)
        if end>start:
            beam((x+direction*start,42,1.9+start),(x+direction*end,42,1.9+end),.018,'Metal','Fence')

tank(-25,30,0,1.25)
for x,y in [(17,25),(21,25),(28,34)]: ac(x,y,0)
box((21,31,3),(8,7,6))
box((21,31,6.2),(8.6,7.6,.4),'Metal')
box((21,27.17,6.35),(8.4,.025,.045),'EdgeLight')
for xx in (17.03,24.97):
    beam((xx,27.43,.08),(xx,27.43,5.95),.025,'Ink')
box((17.14,27.45,3),(.06,.025,5.8),'EdgeLight')
roof_rail(21,31,6.4,8,7)
dish(23,32,6.5,1.1)
# Exposed service duct and elbow on the stairwell roof.
box((19,31,6.9),(2,3,.8),'Metal')
for yy in (30,31,32): box((19,yy,6.9),(2.08,.08,.86),'Ink')
box((19,32.3,7.6),(2,1.1,1.4),'Metal')
# Raised service panel and fasteners give the duct a readable construction scale.
box((19,29.46,6.9),(1.55,.055,.5),'Tank')
for dx in (-.62,.62):
    for zz in (6.74,7.06): beam((19+dx,29.42,zz),(19+dx,29.38,zz),.035,'Ink',sides=8)
for xx in (18.2,19.8):
    for yy in (29.9,32.1):
        box((xx,yy,6.47),(.32,.4,.1),'Concrete')
        beam((xx,yy,6.52),(xx,yy,6.6),.055,'Metal',sides=8)
for xx in (17.15,24.85):
    for yy in (27.65,34.35):
        box((xx,yy,6.42),(.45,.45,.05),'Tank')
        beam((xx,yy,6.44),(xx,yy,6.51),.055,'Ink',sides=8)
box((19,31.7,7.8),(1.7,.08,.8),'Ink')
for zz in (7.5,7.7,7.9,8.1): box((19,31.64,zz),(1.7,.04,.055),'Concrete')
box((18.1,27.42,2.1),(2.8,.16,4.2),'Ink')
box((18.1,27.31,2.1),(2.4,.1,3.9),'Blue')
box((18.1,27.1,4.4),(2.8,.8,.2),'Metal')
for xx in (17.05,19.15):
    beam((xx,27.4,3.9),(xx,26.8,4.28),.045,'Metal')
    beam((xx,27.38,3.85),(xx,27.3,3.85),.055,'Ink',sides=8)
box((18.1,27.23,2.9),(1.35,.08,.8),'Ink')
box((18.1,27.17,2.9),(1.15,.04,.6),'WindowsCool')
box((19.7,27.22,1.9),(.28,.14,.65),'Metal')
for key_z in (1.75,1.9,2.05): box((19.7,27.13,key_z),(.12,.04,.04),'Ink')
beam((18.8,27.2,1.7),(18.8,27.2,2.3),.065,'Trim')
box((23,27.4,5.7),(2.4,.16,.4),'Ink')
for vent_z in (5.57,5.7,5.83): box((23,27.28,vent_z),(2.25,.08,.065),'Metal')
for i,(x,z) in enumerate([(21.1,3.35),(23.1,3.35)]): face(f'Poster_{i}',x,27.39,z,1.6,3.8)
face('Graffiti_0',-29,41.99,2.75,11,2.3)
face('Graffiti_1',21,27.35,1.05,3.7,1.1)
for i in range(2): face(f'Poster_{i+2}',-16+i*2.1,41.4,3.2,1.8,2.4)
for x,m in [(-14,'Red'),(-11,'Blue')]:
    box((x,30,2.1),(2.5,2.1,4.2),m)
    box((x,28.91,2.65),(2.12,.08,2.5),'Ink')
    face(f'Vend_{x}',x,28.85,2.8,1.88,1.9,'VendGlow')
    box((x,28.85,.65),(1.6,.12,.4),'Ink')
    # Framed glass, selection buttons and a recessed delivery flap.
    for side in (-1,1): box((x+side*1.06,28.78,2.65),(.07,.13,2.5),'Concrete')
    for zz in (1.42,3.88): box((x,28.78,zz),(2.18,.13,.07),'Concrete')
    for bx in (-.75,-.38,0,.38,.75):
        beam((x+bx,28.76,1.5),(x+bx,28.68,1.5),.065,'Concrete',sides=10)
    box((x+.7,28.8,1.13),(.45,.15,.42),'Metal')
    box((x+.7,28.7,1.15),(.32,.03,.07),'Ink')
    box((x+.7,28.68,1.28),(.22,.03,.035),'WindowsCool')
    beam((x+.72,28.77,1.84),(x+.72,28.65,1.84),.12,'Metal',sides=16)
    box((x+.72,28.63,1.84),(.035,.03,.16),'Ink')
    box((x,28.72,.49),(1.7,.24,.08),'Metal')
    box((x,28.76,.75),(1.42,.04,.18),'Windows')
    for xx in (-.75,.75): box((x+xx,30,.1),(.18,1.8,.2),'Ink')
    # Lower service panel differs on each machine instead of repeating the display grid.
    box((x-.55,28.87,1.12),(.6,.04,.23),'Concrete')
    for zz in (.2,.28,.36): box((x+.78,28.84,zz),(.38,.05,.035),'Metal')
# Closed quarter pipe: the curve falls from left to right, as in the approved frame.
vs=[]
for y in (16,21):
    vs.extend([(-16+6.5*(1-math.cos(i*math.pi/24)),y,4*(1-math.sin(i*math.pi/24))) for i in range(13)])
    vs.append((-16,y,0))
fs=[(i,i+1,i+15,i+14) for i in range(12)]
fs += [(12,13,27,26),(13,0,14,27),tuple(reversed(range(14))),tuple(range(14,28))]
geo(vs,fs,'Ramp')
for i in range(12):
    a=(-16+6.5*(1-math.cos(i*math.pi/24)),15.94,4*(1-math.sin(i*math.pi/24)))
    b=(-16+6.5*(1-math.cos((i+1)*math.pi/24)),15.94,4*(1-math.sin((i+1)*math.pi/24)))
    beam(a,b,.035,'Ink')
    beam((a[0],15.88,a[2]+.025),(b[0],15.88,b[2]+.025),.018,'EdgeLight')
beam((-16,15.8,4.07),(-16,21.2,4.07),.11,'Metal')
beam((-20,12,1.3),(-7,12,1.3),.09,'Red')
for x in (-19,-13,-8): beam((x,12,0),(x,12,1.3),.08,'Ink')
# Floor pipe and hut ladder.
beam((13,37,.5),(31,37,.5),.22,'Blue')
for x in (25.4,26.5): beam((x,30,0),(x,30,7),.07,'Metal')
for z in range(1,8): beam((25.4,30,z),(26.5,30,z),.055,'Metal')

FRONTS={}
# Modular architecture. Distant kit omits individual window recesses and balconies.
for layer,y,xs in [('Far',133,range(-110,111,13)),('Mid',91,range(-90,91,13)),('Near',61,[-67,-53,-39,-25,-10,5,20,35,50,65])]:
    LAYER=layer
    for i,x in enumerate(xs):
        before = {key:len(value[0]) for key,value in BATCH.items()}
        x += random.uniform(-1,1)
        w=random.uniform(8,11)
        depth=random.uniform(8,12)
        top=random.uniform(10,26) if abs(x)>25 else random.uniform(6,14)
        if layer=='Far': top=random.uniform(10,30)
        if layer=='Near' and abs(x)>40: top+=8
        if layer=='Near' and i==3: top=4
        if layer=='Near' and i==4: top=19
        if layer=='Near' and i==5: top=10
        if layer=='Near' and i==2: top=29
        if layer=='Near' and i==6: top=22
        if layer=='Near' and i==7: top=32
        if layer=='Mid' and -35<x<-15: top=8
        if layer=='Mid' and i==4: top=20
        if layer=='Mid' and -3<x<4: top=30
        if layer=='Mid' and 12<x<17: top=23
        bottom=-24
        front=y-depth/2
        if layer=='Near': FRONTS[i]=(x,front,top,w)
        material=['BuildingA','BuildingB','BuildingC','BuildingD'][i%4]
        box((x,y,(top+bottom)/2),(w,depth,top-bottom),material)
        # Cornice and setback roof volume.
        box((x,y,top+.12),(w+.5,depth+.5,.24),'Metal')
        box((x-.7,y+1,top+1.2),(w*.55,depth*.55,2.1),material)
        for z in range(-20,int(top)-1,4):
            box((x,front-.14,z-1.15),(w+.12,.3,.22),'Metal')
            for col in range(3):
                wx=x+(col-1)*w*.28
                mat=random.choices(['Windows','WindowsLit','WindowsCool'],[.48,.34,.18])[0]
                # Window quads sit in front of separate recess strips; no coplanar surfaces.
                face(f'{layer}Windows',wx,front-.19,z,w*.2,1.8,mat)
                if layer=='Near':
                    # Window casings, inset glass, mullions and projecting lintels.
                    for dx in (-w*.105,w*.105): box((wx+dx,front-.29,z),(.1,.18,1.95),'Concrete')
                    box((wx,front-.29,z+.97),(w*.22,.2,.12),'Concrete')
                    window_style=(i*13+int(z)*3+col*7)%11
                    if window_style<7: box((wx,front-.31,z),(.055,.12,1.8),'Metal')
                    box((wx,front-.27,z-1),(w*.22,.5,.18),'Concrete')
                    if random.random()<.18: box((wx,front-.22,z+.5),(w*.2,.04,.3),'Metal')
                    if window_style in (0,3):
                        # Partly lowered blinds retain the warm glass below them at night.
                        for blind in range(5):
                            box((wx,front-.34,z+.73-blind*.14),(w*.19,.045,.09),'Blinds')
                    elif window_style==5:
                        # Deeper surrounds and an offset transom break up the window kit.
                        for dx in (-w*.115,w*.115): box((wx+dx,front-.44,z),(.14,.42,2.05),'Concrete')
                        box((wx,front-.48,z+.36),(w*.22,.07,.065),'Metal')
            if layer=='Near' and i%3==0:
                box((x-w*.42,front-.8,z-1.3),(1.5,1.5,.22),'Concrete')
                box((x-w*.42,front-1.5,z-.7),(1.5,.08,1),'Metal')
        if layer!='Far':
            roof_rail(x,y,top+.3,w,depth)
            if i%3==1: dish(x-2,y+1,top+2.3,.85)
            # Raised sign supports and rooftop utility enclosures break the silhouette.
            if i%4==2:
                for xx in (x-2,x+2): beam((xx,y+2,top+1),(xx,y+2,top+5),.1,'Ink')
                box((x,y+2,top+4),(5,.45,2.4),'Blue')
                for xx in (x-2,x+2): beam((xx,y+2,top+3),(xx,y+4,top+.4),.08,'Metal')
            ac(x,y,top+.3,.8)
            if i%2==0: tank(x+1,y+2,top+.3,.7)
            beam((x-2,y,top+2),(x-2,y,top+6),.06,'Ink')
            for z in (top+4,top+5.2): beam((x-3,y,z),(x-1,y,z),.05,'Ink')
        if layer=='Mid' and i==4:
            # Articulated facade beside the tower: recesses, ledges and a narrow setback.
            box((x+w*.2,y+1,top+2),(w*.5,depth*.55,4),material)
            for zz in range(-4,19,4):
                box((x,front-.08,zz),(w*.76,.14,2.15),'Metal')
                box((x,front-.55,zz-1.2),(w*.82,1.1,.28),'Concrete')
                for dx in (-w*.38,w*.38): box((x+dx,front-.3,zz),(.18,.5,2.4),'Concrete')
                beam((x-w*.4,front-1.08,zz-.4),(x+w*.4,front-1.08,zz-.4),.04,'Metal')
        if layer=='Near':
            # Visible side elevations have their own windows and masonry bands.
            side=x+(w/2+.03)*(1 if x<0 else -1)
            for zz in range(-16,int(top)-1,4):
                for yy in (y-depth*.25,y,y+depth*.25):
                    box((side,yy,zz),(.08,1.5,1.8),'Windows')
                    box((side,yy,zz-1),(.22,1.7,.15),'Concrete')
            if i%3==1:
                # Exterior fire stair with landings, treads and diagonal handrails.
                sx=x+w*.52
                for zz in range(-8,int(top)-4,5):
                    box((sx,front-.9,zz),(2.2,1.8,.16),'Metal')
                    for step in range(10): box((sx-1+step*.22,front-.9,zz+step*.5),(.25,1.4,.12),'Metal')
                    beam((sx-1,front-1.65,zz+1),(sx+1,front-1.65,zz+5.5),.06,'Ink')
            for z in range(-16,int(top)-2,8):
                box((x+w*.31,front-.55,z),(1.8,.9,2.5),'BuildingB')
                box((x+w*.31,front-1.04,z+.1),(1.4,.06,1.7),'Windows')
            if i%2==0:
                for balcony_z in range(0,int(top)-1,5):
                    box((x-w*.32,front-.9,balcony_z),(2.8,1.8,.22),'Metal')
                    beam((x-w*.32-1.4,front-1.7,balcony_z+1),(x-w*.32+1.4,front-1.7,balcony_z+1),.055,'Ink')
                    for rail_x in (-1.3,0,1.3): beam((x-w*.32+rail_x,front-1.7,balcony_z),(x-w*.32+rail_x,front-1.7,balcony_z+1),.045,'Metal')
                box((x+w*.32,y+1,top+2.6),(2.5,3.5,5),'BuildingC')
                box((x+w*.32,y+1,top+5.2),(2.8,3.8,.25),'Metal')
            # Structural corner columns and pipe down the façade.
            for dx in (-w/2+.15,w/2-.15): box((x+dx,front-.15,(top-24)/2),(.22,.3,top+24),'Metal')
            beam((x+w*.35,front-.4,-22),(x+w*.35,front-.4,top),.08,'Blue')
            if i in (2,7):
                n=0 if i==2 else 1
                sz=12 if i==2 else 14
                x+=5 if i==2 else -3
                box((x,front-1.5,sz),(15.8,1,12.8),'Ink')
                face(f'Billboard_{n}',x,front-2.04,sz,15,12)

        # Angle selected frontages to reveal side elevations and break the flat street wall.
        if layer=='Near' and i in (1,2,4,6,7,8):
            angle=math.radians(-16 if i<=4 else 16)
            cx=x+(-5 if i==2 else 3 if i==7 else 0)
            for key,(vertices,_) in BATCH.items():
                for vi in range(before.get(key,0),len(vertices)):
                    vx,vy,vz=vertices[vi]
                    dx,dy=vx-cx,vy-y
                    vertices[vi]=(cx+dx*math.cos(angle)-dy*math.sin(angle),y+dx*math.sin(angle)+dy*math.cos(angle),vz)

        if layer=='Mid' and i==4:
            # Leave the sun visible beside the tower instead of behind this facade.
            for key,(vertices,_) in BATCH.items():
                for vi in range(before.get(key,0),len(vertices)):
                    vx,vy,vz=vertices[vi]
                    vertices[vi]=(vx-7,vy,vz)

# Sign stacks match the approved concept's large color blocks.
LAYER='Near'
for n,parent,sx,sz,w,h in [
    (0,4,-10,17.7,3.8,5),(1,4,-10,11.8,3.8,6.5),
    (2,5,10.8,13.8,4.1,8.5),(3,6,15.5,15.2,2.8,5),(4,6,15.5,10.9,4,2.8),
    (5,7,23.5,16,3.3,5),(6,7,23.5,11.3,3.3,4.2),(7,7,19.5,10.8,3.2,3.5)]:
    px,front,top,pw=FRONTS[parent]
    sy=front-2.5
    box((sx,sy,sz),(w+.45,.7,h+.45),'Ink')
    for zz in (sz-h*.35,sz+h*.35): beam((sx,front,zz),(sx,sy-.4,zz),.13,'Metal')
    face(f'Sign_{n}',sx,sy-.38,sz,w,h,'NeonGlow')
# Steel pedestrian connector in the right-side sky gap.
for zz in (14,17): beam((25,54,zz),(32,54,zz),.18,'Metal')
for xx in range(25,31,2):
    beam((xx,54,14),(xx+2,54,17),.12,'Ink')
    beam((xx,54,17),(xx+2,54,14),.12,'Ink')
box((28.5,55,13.8),(7,3,.35),'Metal')

# Elevated railway: behind the parapet, in front of the city.
LAYER='Transit'
box((0,48,2.4),(160,5,1.2),'Concrete')
for x in range(-75,76,12): box((x,48,-10),(1.5,3,24),'Concrete')
for y in (46.6,49.4): beam((-80,y,3.2),(80,y,3.2),.12,'Ink')
for x in range(-75,76,15):
    beam((x,50,3),(x,50,11),.1,'Metal')
    beam((x,50,10.5),(x,46,10.5),.08,'Metal')
beam((-80,48,10),(80,48,10),.045,'Ink','Wires')
LAYER='Train'
for x in (-18,-9,0):
    box((x,48,5.7),(8.7,3.4,3.4),'TrainBody')
    box((x,46.27,5.1),(8.7,.08,.65),'TrainStripe')
    box((x,46.21,5.15),(8.7,.07,.42),'TrainStripe')
    for wx in (-3,-1.5,0,1.5,3):
        box((x+wx,46.23,6.15),(1.1,.1,1.3),'Ink')
        face('TrainWindows',x+wx,46.16,6.15,.88,1.1,'TrainWindow')
    box((x,48,7.6),(3,2,.4),'Metal')
    for dx in (-3.7,3.7):
        box((x+dx,46.17,5.6),(.65,.08,2.6),'Metal')
        face('TrainWindows',x+dx,46.1,6.1,.4,.8,'TrainWindow')
        beam((x+dx,46.08,4.4),(x+dx,46.08,6.9),.02,'Ink')
    for dx in (-2.7,2.7): beam((x+dx,46.4,3.9),(x+dx,49.6,3.9),.55,'Ink',sides=8)

# Diamond pantograph and rain gutters make the train read as a rail vehicle.
for a,b in [((-2,48,7.8),(0,48,9.2)),((0,48,9.2),(2,48,7.8)),((-2,48,7.8),(0,48,7.3)),((0,48,7.3),(2,48,7.8))]: beam(a,b,.065,'Ink')
beam((-1,47.2,9.2),(1,48.8,9.2),.07,'Metal')
for car_x in (-18,-9,0):
    beam((car_x-4.2,46.2,7.3),(car_x+4.2,46.2,7.3),.065,'Metal')
    box((car_x,46.14,4.55),(8.5,.06,.12),'Metal')
box((4.3,48,5.6),(1.5,3.2,3.1),'TrainBody')
box((4.3,46.35,6.1),(1.1,.12,1.4),'Windows')
box((4.3,46.24,5),(1.5,.1,.6),'TrainStripe')
box((4.8,46.18,4.6),(.3,.12,.3),'TrainWindow')

# Tower silhouette: four tapered legs, horizontal decks and crossed bracing.
LAYER='Tower'
tx,ty=-30,105
levels=[(-24,7),(0,4.8),(17,2.8),(23,1.6),(30,.5),(33,.12)]
for j in range(len(levels)-1):
    z0,r0=levels[j]; z1,r1=levels[j+1]
    m='TowerWhite' if j==3 else 'TowerRed'
    for sx,sy in [(-1,-1),(1,-1),(1,1),(-1,1)]:
        beam((tx+sx*r0,ty+sy*r0,z0),(tx+sx*r1,ty+sy*r1,z1),.22,m)
    for sy in (-1,1):
        beam((tx-r0,ty+sy*r0,z0),(tx+r1,ty+sy*r1,z1),.12,m)
        beam((tx+r0,ty+sy*r0,z0),(tx-r1,ty+sy*r1,z1),.12,m)
    for sx in (-1,1):
        beam((tx+sx*r0,ty-r0,z0),(tx+sx*r1,ty+r1,z1),.12,m)
        beam((tx+sx*r0,ty+r0,z0),(tx+sx*r1,ty-r1,z1),.12,m)
for z,w in [(17,8),(27,4)]:
    box((tx,ty,z),(w,w,1.7),'TowerWhite')
    for yy in (ty-w/2-.06,ty+w/2+.06): box((tx,yy,z),(w-.4,.1,.75),'TowerLight')
    for xx in (tx-w/2-.06,tx+w/2+.06): box((xx,ty,z),(.1,w-.4,.75),'TowerLight')
    for xx in range(-3,4):
        if abs(xx)<w/2: box((tx+xx,ty-w/2-.13,z),(.08,.12,.9),'TowerWhite')
    roof_rail(tx,ty,z+.9,w,w)
beam((tx,ty,33),(tx,ty,35),.12,'TowerRed')
box((tx,ty,35),(.5,.5,.5),'TowerLight')

# Street utility poles and hanging cable segments.
LAYER='Poles'
for x,y in [(-28,46),(29,43),(46,62)]:
    beam((x,y,-24),(x,y,23),.23,'Metal')
    for z in (20,22):
        beam((x-3,y,z),(x+3,y,z),.13,'Ink')
        for dx in (-2,0,2): beam((x+dx,y,z),(x+dx,y,z+.5),.16,'Concrete')
for z in (20.5,22.5):
    for offset in (-1,1):
        points=[(-28+57*t/12,45+offset, z-3*math.sin(math.pi*t/12)) for t in range(13)]
        for a,b in zip(points,points[1:]): beam(a,b,.045,'Ink','Wires')

# Keep the train and railway on one diagonal plane, behind the roof fence.
for (layer,material),(vertices,faces) in BATCH.items():
    if layer.startswith(('Train','Transit')):
        for vi,(vx,vy,vz) in enumerate(vertices): vertices[vi]=(vx,vy+vx*.11,vz+.5+vx*.065)

# Build a small set of material batches instead of one draw per window or prop.
train=bpy.data.objects.new('Train',None)
bpy.context.collection.objects.link(train)
solids=[]
for (layer,material),(verts,faces) in BATCH.items():
    mesh=bpy.data.meshes.new(layer+'_'+material)
    mesh.from_pydata(verts,[],faces)
    mesh.update()
    o=bpy.data.objects.new(layer if layer.startswith(('Sign_','Billboard_','Poster_','Vend_','Graffiti_')) else layer+'_'+material,mesh)
    bpy.context.collection.objects.link(o)
    mesh.materials.append(MATS[material])
    is_face=all(len(f)==4 for f in faces) and (layer.endswith('Windows') or layer.startswith(('Sign_','Billboard_','Poster_','Vend_','Graffiti_')))
    if layer.startswith('Train'): o.parent=train
    if not is_face:
        # Recalculate consistently outward before beveling; batch consists of closed kit parts.
        bm=bmesh.new(); bm.from_mesh(mesh)
        bmesh.ops.recalc_face_normals(bm,faces=bm.faces)
        bm.to_mesh(mesh); bm.free()
        if layer in ('Roof','Near','Train') and material in ('BuildingA','BuildingB','BuildingC','BuildingD','Concrete','Metal','Red','Blue','TrainBody'):
            bevel=o.modifiers.new('Edge highlights','BEVEL'); bevel.width=.18 if material=='TrainBody' else .09 if layer=='Roof' else .055; bevel.segments=3
            bevel.affect='EDGES'
            bpy.context.view_layer.objects.active=o
            bpy.ops.object.modifier_apply(modifier=bevel.name)
        bm=bmesh.new(); bm.from_mesh(o.data)
        bmesh.ops.dissolve_degenerate(bm,dist=.00001,edges=list(bm.edges))
        bm.to_mesh(o.data); bm.free()
        # Extra samples on broad surfaces let baked contact shading reach their interiors.
        if layer=='Roof' and material in ('Concrete','Metal','Floor'):
            bm=bmesh.new(); bm.from_mesh(o.data)
            edges={e for f in bm.faces if f.calc_area()>9 for e in f.edges}
            if edges: bmesh.ops.subdivide_edges(bm,edges=list(edges),cuts=6,use_grid_fill=True)
            bm.to_mesh(o.data); bm.free()
        solids.append(o)
    else:
        uv=mesh.uv_layers.new(name='UVMap')
        if layer.endswith('Windows'):
            colors=mesh.color_attributes.new(name='WindowVariation',type='BYTE_COLOR',domain='CORNER')
            for poly in mesh.polygons:
                shade=random.uniform(.68,1)
                for li in poly.loop_indices: colors.data[li].color=(shade,shade,shade,1)
            mesh.color_attributes.active_color=colors
        for poly in mesh.polygons:
            for j,li in enumerate(poly.loop_indices): uv.data[li].uv=[(0,0),(1,0),(1,1),(0,1)][j]
    o['surface']='face' if is_face else 'solid'
    o['layer']=layer

# Bake ambient occlusion into vertex colors with deterministic hemisphere rays.
# This avoids a runtime AO pass and keeps the city shading independent of the CDs.
verts=[]; polys=[]
for o in solids:
    n=len(verts); verts.extend(v.co[:] for v in o.data.vertices)
    polys.extend(tuple(n+i for i in p.vertices) for p in o.data.polygons)
bvh=BVHTree.FromPolygons(verts,polys)
for o in solids:
    mesh=o.data
    colors=mesh.color_attributes.new(name='AO',type='BYTE_COLOR',domain='CORNER')
    for p in mesh.polygons:
        normal=p.normal
        tangent=normal.cross(Vector((0,0,1)))
        if tangent.length<.01: tangent=normal.cross(Vector((0,1,0)))
        tangent.normalize(); bitangent=normal.cross(tangent)
        for li in p.loop_indices:
            origin=mesh.vertices[mesh.loops[li].vertex_index].co+normal*.06
            hits=0
            for i in range(16):
                a=i*2.399963229728653
                radius=math.sqrt((i+.5)/16)
                direction=(normal*math.sqrt(1-radius*radius)+tangent*math.cos(a)*radius+bitangent*math.sin(a)*radius).normalized()
                if bvh.ray_cast(origin,direction,2.5)[0] is not None: hits+=1
            shade=1-hits*(.34/16)
            colors.data[li].color=(shade,shade,shade,1)
    mesh.color_attributes.active_color=colors

# Geometry verification is reproducible and fails the build for malformed solid components.
errors=[]
for o in solids:
    bm=bmesh.new(); bm.from_mesh(o.data)
    if any(not e.is_manifold for e in bm.edges): errors.append(o.name+': non-manifold')
    if any(f.calc_area()<1e-8 for f in bm.faces): errors.append(o.name+': zero area')
    if any(not e.is_contiguous for e in bm.edges): errors.append(o.name+': inconsistent normals')
    bm.free()
if errors: raise RuntimeError(errors)
triangles=sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in bpy.data.objects if o.type=='MESH')
# Art quality takes priority; record geometry cost for a later optimization pass.
OUT=os.path.join(ROOT,'public/models/rooftop.glb')
bpy.ops.export_scene.gltf(filepath=OUT,export_format='GLB',export_apply=True,export_yup=True,
    export_materials='EXPORT',export_texcoords=True,export_normals=True,export_attributes=True,
    export_extras=True,export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=6)
report={'triangles':triangles,'mesh_batches':len(BATCH),'bytes':os.path.getsize(OUT),
    'manifold_solids':len(solids),'geometry_errors':errors,'ao':'sixteen stratified hemisphere rays per face corner',
    'seed':2000,'note':'Open art/window quads excluded from manifold checks. Intersecting structural kit parts are intentional.'}
os.makedirs(os.path.join(ROOT,'output/tokyo-verification'),exist_ok=True)
with open(os.path.join(ROOT,'output/tokyo-verification/model.json'),'w') as f: json.dump(report,f,indent=2)
print(json.dumps(report))
# Optional fixed-camera workbench blockout render.
if os.getenv('TOKYO_RENDER'):
    bpy.ops.object.camera_add(location=(0,-6.6,5.1))
    camera=bpy.context.object
    camera.rotation_euler=(Vector((0,0,4.2))-camera.location).to_track_quat('-Z','Y').to_euler()
    camera.data.type='PERSP'; camera.data.sensor_fit='VERTICAL'; camera.data.sensor_height=32; camera.data.lens=32/(2*math.tan(math.radians(23)))
    scene=bpy.context.scene; scene.camera=camera
    scene.render.engine='BLENDER_WORKBENCH'
    scene.display.shading.light='STUDIO'; scene.display.shading.color_type='MATERIAL'
    scene.display.shading.show_cavity=True
    scene.render.resolution_x=1280; scene.render.resolution_y=760; scene.render.resolution_percentage=100
    scene.render.filepath=os.path.join(ROOT,'output/tokyo-verification/blender.png')
    bpy.ops.render.render(write_still=True)
