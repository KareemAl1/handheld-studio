"""Build the original HS-01 editable asset. Run from any working directory:

  blender --background --python scripts/build_asset.py

No downloaded geometry, textures, fonts, or add-ons are required. Dimensions are
authored in millimeters, then mapped to a 6.4-unit export width. Blender uses X
for width, Z for height, and -Y for the front; glTF maps these to X, Y, and +Z.
Use -- --output assets/source/hs-01-stage2.blend to stage a candidate locally.
Five identity parent objects carry the assembly contract for exploded views;
every mesh repeats that contract in its exported "assembly" custom property.
"""

from pathlib import Path
import argparse
import math
import sys
import bpy

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets" / "source" / "hs-01.blend"
SCALE = 6.4 / 164.0


def u(mm):
    return mm * SCALE


def material(name, color, roughness=0.45, metallic=0.0, emission=None):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    if emission:
        bsdf.inputs["Emission Color"].default_value = (*emission, 1)
        bsdf.inputs["Emission Strength"].default_value = 0.3
    return mat


def assign(obj, mat):
    if mat:
        obj.data.materials.append(mat)
    return obj


def apply_modifier(obj, modifier):
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=modifier.name)


def bevel(obj, radius, segments=3):
    mod = obj.modifiers.new("Machined edge radii", "BEVEL")
    mod.width = u(radius)
    mod.segments = segments
    mod.limit_method = "ANGLE"
    apply_modifier(obj, mod)


def finish(obj, smooth=True):
    if smooth:
        for p in obj.data.polygons:
            p.use_smooth = True
        mod = obj.modifiers.new("Weighted surface normals", "WEIGHTED_NORMAL")
        mod.keep_sharp = True
        mod.weight = 50
        apply_modifier(obj, mod)
    return obj


def rounded_outline(width, height, radius, steps=12):
    # Counterclockwise when seen from the front (-Y).
    points = []
    for cx, cz, angle in (
        (width / 2 - radius, height / 2 - radius, 0),
        (-width / 2 + radius, height / 2 - radius, 90),
        (-width / 2 + radius, -height / 2 + radius, 180),
        (width / 2 - radius, -height / 2 + radius, 270),
    ):
        for i in range(steps + 1):
            a = math.radians(angle + 90 * i / steps)
            points.append((cx + radius * math.cos(a), cz + radius * math.sin(a)))
    return points


def prism(name, outline, depth, position, mat=None, edge=0, smooth=True):
    n = len(outline)
    verts = [(u(x), u(y), u(z)) for y in (-depth / 2, depth / 2) for x, z in outline]
    faces = [tuple(range(n - 1, -1, -1)), tuple(range(n, 2 * n))]
    for i in range(n):
        j = (i + 1) % n
        faces.append((i, j, j + n, i + n))
    mesh = bpy.data.meshes.new(name + "Geometry")
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.location = tuple(u(v) for v in position)
    assign(obj, mat)
    # Make all generated surfaces consistently outward-facing before booleans.
    bpy.ops.object.select_all(action="DESELECT")
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode="OBJECT")
    obj.select_set(False)
    if edge:
        bevel(obj, edge)
    return finish(obj, smooth)


def rounded_box(name, width, height, depth, radius, position, mat=None, edge=0, steps=8):
    return prism(name, rounded_outline(width, height, radius, steps), depth, position, mat, edge)


def create_housing(name, front, mat):
    """Loft a softly pillowed face into a straight, precise mating edge.

    Unlike a bevel on both ends of a box, the loft keeps the seam circumference
    at full size. Each shell is hollowed separately below, leaving ~2.1 mm walls.
    """
    sign = -1 if front else 1
    rings = [(0.2 if front else 0.4, 0), (6.3, 0)]
    for i in range(1, 9):
        a = math.pi * i / 16
        rings.append((6.3 + 3.2 * math.sin(a), 3.2 * (1 - math.cos(a))))
    verts = []
    n = len(rounded_outline(164, 88, 16, 20))
    for depth, inset in rings:
        verts.extend((u(x), u(sign * depth), u(z)) for x,z in
                     rounded_outline(164 - inset*2, 88 - inset*2, 16-inset, 20))
    faces = [tuple(range(n-1, -1, -1)), tuple(range((len(rings)-1)*n, len(rings)*n))]
    for r in range(len(rings)-1):
        for i in range(n):
            j = (i+1) % n
            faces.append((r*n+i, r*n+j, (r+1)*n+j, (r+1)*n+i))
    mesh = bpy.data.meshes.new(name + "Geometry")
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    assign(obj, mat)
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.normals_make_consistent(inside=False)
    bpy.ops.object.mode_set(mode="OBJECT")
    obj.select_set(False)
    return finish(obj)


def join_meshes(name, objects):
    """Batch small repeated details while retaining their assembly membership."""
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    obj = bpy.context.object
    obj.name = name
    obj.select_set(False)
    return obj


def wire(name, points, radius, mat):
    curve = bpy.data.curves.new(name + "Path", "CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = 8
    curve.bevel_depth = u(radius)
    curve.bevel_resolution = 2
    spline = curve.splines.new("BEZIER")
    spline.bezier_points.add(len(points)-1)
    for point, xyz in zip(spline.bezier_points, points):
        point.co = tuple(u(v) for v in xyz)
        point.handle_left_type = point.handle_right_type = "AUTO"
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    assign(obj, mat)
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.convert(target="MESH")
    obj.select_set(False)
    return obj


def organize_assemblies():
    names = {
        "front-shell": "AssemblyFrontShell", "controls": "AssemblyControls",
        "display": "AssemblyDisplay", "board": "AssemblyBoard",
        "rear-shell": "AssemblyRearShell",
    }
    groups = {}
    for key, name in names.items():
        group = bpy.data.objects.new(name, None)
        bpy.context.collection.objects.link(group)
        group.empty_display_type = "PLAIN_AXES"
        group.empty_display_size = 0.3
        group["assembly"] = key
        groups[key] = group
    for obj in list(bpy.context.scene.objects):
        if obj.type != "MESH":
            continue
        name = obj.name
        if name == "DPadMembrane":
            group = "board"
        elif name.startswith(("Display", "Screen", "Glass")):
            group = "display"
        elif name.startswith(("ShellBack", "Rear", "GripLine", "Screw", "Mount")):
            group = "rear-shell"
        elif name.startswith(("Button", "DPad", "ControlStem", "TriggerLegend", "SmallKeySocket")):
            group = "controls"
        elif name.startswith(("ShellFront", "Seam", "Front", "Legend", "Status", "TriggerSocket")):
            group = "front-shell"
        else:
            group = "board"
        obj.parent = groups[group]  # Parents are identity transforms at the shared origin.
        obj["assembly"] = group
        obj["authorship"] = "Original Handheld Studio geometry by Kareem Alwan / Codex"
    return groups


def cut(obj, cutter):
    mod = obj.modifiers.new("Modeled opening", "BOOLEAN")
    mod.operation = "DIFFERENCE"
    mod.solver = "EXACT"
    mod.object = cutter
    apply_modifier(obj, mod)
    bpy.data.objects.remove(cutter, do_unlink=True)


def cylinder(name, radius, depth, position, mat, edge=0.3, vertices=48):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices, radius=u(radius), depth=u(depth),
        end_fill_type="NGON", location=tuple(u(v) for v in position),
        rotation=(math.pi / 2, 0, 0),
    )
    obj = bpy.context.object
    obj.name = name
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    assign(obj, mat)
    if edge:
        bevel(obj, edge)
    return finish(obj)


def ring(name, width, height, radius, border, depth, position, mat, steps=12):
    outer = rounded_outline(width, height, radius, steps)
    inner = rounded_outline(width - border * 2, height - border * 2, max(radius - border, 0.2), steps)
    n = len(outer)
    verts = []
    for y in (-depth / 2, depth / 2):
        for outline in (outer, inner):
            verts.extend((u(x), u(y), u(z)) for x, z in outline)
    faces = []
    for i in range(n):
        j = (i + 1) % n
        faces.extend(((i, j, n+j, n+i), (2*n+i, 3*n+i, 3*n+j, 2*n+j),
                      (i, 2*n+i, 2*n+j, j), (n+i, n+j, 3*n+j, 3*n+i)))
    mesh = bpy.data.meshes.new(name + "Geometry")
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.location = tuple(u(v) for v in position)
    assign(obj, mat)
    return finish(obj)


def label(name, text, position, size, mat, align="CENTER", rear=False):
    curve = bpy.data.curves.new(name + "Typography", "FONT")
    curve.body = text
    curve.size = u(size)
    curve.align_x = align
    curve.align_y = "CENTER"
    curve.space_character = 1.18
    curve.resolution_u = 4
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    obj.location = tuple(u(v) for v in position)
    obj.rotation_euler = (math.pi / 2, 0, math.pi if rear else 0)
    assign(obj, mat)
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.convert(target="MESH")
    obj.select_set(False)
    return obj


def build(source=SOURCE):
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for block in list(bpy.data.materials):
        bpy.data.materials.remove(block)

    shell_front = material("ShellFront", (0.66, 0.64, 0.57), 0.37)
    shell_back = material("ShellBack", (0.61, 0.59, 0.52), 0.43)
    controls = material("Controls", (0.085, 0.096, 0.095), 0.42)
    seam = material("Seam", (0.11, 0.12, 0.115), 0.6)
    bezel = material("Bezel", (0.012, 0.018, 0.020), 0.25)
    screen = material("Screen", (0.017, 0.034, 0.034), 0.25, emission=(0.017, 0.034, 0.034))
    glass = material("Glass", (0.08, 0.11, 0.11), 0.14)
    glass.diffuse_color = (0.08, 0.11, 0.11, 0.10)
    glass.node_tree.nodes.get("Principled BSDF").inputs["Alpha"].default_value = 0.10
    glass.surface_render_method = "DITHERED"
    metal = material("Metal", (0.40, 0.44, 0.44), 0.29, 0.88)
    pcb = material("CircuitBoard", (0.045, 0.16, 0.125), 0.6)
    chips = material("Components", (0.055, 0.061, 0.057), 0.61)
    battery = material("Battery", (0.24, 0.255, 0.25), 0.56, 0.35)
    accent = material("Accent", (0.94, 0.22, 0.055), 0.40)
    ink = material("Ink", (0.11, 0.13, 0.12), 0.7)
    key_ink = material("KeyInk", (0.66, 0.70, 0.67), 0.7)
    gold = material("Contacts", (0.55, 0.33, 0.11), 0.4, 0.8)
    silicone = material("Silicone", (0.20, 0.25, 0.23), 0.78)
    ribbon = material("Ribbon", (0.42, 0.18, 0.042), 0.5, 0.25)

    # Hollow halves retain actual walls for future translucent material options.
    front = create_housing("ShellFront", True, shell_front)
    cavity = rounded_box("FrontCavityCut", 159.8, 83.8, 18, 13.9, (0, 1.55, 0), None, 0.8)
    cut(front, cavity)
    back = create_housing("ShellBack", False, shell_back)
    cavity = rounded_box("BackCavityCut", 159.8, 83.8, 18, 13.9, (0, -1.6, 0), None, 0.8)
    cut(back, cavity)

    ring("Seam", 163.4, 87.4, 15.7, 1.2, 0.50, (0, 0.10, 0), seam, 20)
    screen_hole = rounded_box("ScreenOpeningCut", 94, 63.5, 18, 5.4, (0, -6, 4.0), None)
    cut(front, screen_hole)
    rounded_box("DisplayChassis", 96.0, 65.5, 3.3, 5.8, (0, -5.95, 4.0), chips, 0.7)
    rounded_box("DisplayBezel", 94.0, 63.5, 1.6, 5.4, (0, -9.05, 4.0), bezel, 0.38)
    # The display face is a UV-mapped plane-like solid, separate from its glass.
    display = rounded_box("Screen", 87.2, 54.5, 0.20, 2.8, (0, -10.0, 4.0), screen, 0, 12)
    # Explicit X/Z projection supplies stable 0..1 UVs for the canvas game.
    uv = display.data.uv_layers.new(name="ScreenUV")
    for polygon in display.data.polygons:
        for li in polygon.loop_indices:
            co = display.data.vertices[display.data.loops[li].vertex_index].co
            uv.data[li].uv = (co.x / u(87.2) + 0.5, co.z / u(54.5) + 0.5)
    rounded_box("Glass", 92.4, 61.9, 0.12, 4.8, (0, -10.18, 4.0), glass, 0, 12)

    # D-pad: low cruciform rocker inside a recessed circular well.
    dx, dz = -63.2, 3.6
    cut(front, cylinder("DPadOpeningCut", 12.9, 18, (dx, -5, dz), None, 0))
    cylinder("DPadSocket", 12.7, 1.1, (dx, -9.4, dz), bezel, 0.25)
    a, b = 11.4, 4.0
    cross = [(-b,a),(b,a),(b,b),(a,b),(a,-b),(b,-b),(b,-a),(-b,-a),(-b,-b),(-a,-b),(-a,b),(-b,b)]
    prism("ButtonDPad", cross, 2.9, (dx, -10.6, dz), controls, 0.75)
    cylinder("ControlStemDPad", 3.2, 5.8, (dx,-6.25,dz),controls,0.3,32)
    cylinder("DPadCenter", 2.3, 0.08, (dx, -12.08, dz), controls, 0.01, 32)
    for name, px, pz, rotation in (("Up",0,8.2,0),("Down",0,-8.2,math.pi),("Left",-8.2,0,math.pi/2),("Right",8.2,0,-math.pi/2)):
        tri = [(-0.8,-0.45),(0.8,-0.45),(0,0.75)]
        points = [(x*math.cos(rotation)-z*math.sin(rotation), x*math.sin(rotation)+z*math.cos(rotation)) for x,z in tri]
        prism("DPadMark" + name, points, 0.045, (dx+px,-12.065,dz+pz), key_ink, 0, False)

    for key, x, z in (("X",63.2,15.1),("Y",52.9,4.8),("A",73.5,4.8),("B",63.2,-5.5)):
        cut(front, cylinder("ActionOpeningCut", 5.65, 18, (x,-5,z), None,0))
        cylinder("ButtonSocket" + key,5.6,0.9,(x,-9.5,z),bezel,0.15)
        cylinder("Button" + key,4.65,3.1,(x,-10.6,z),controls,0.65)
        cylinder("ControlStem" + key,2.7,5.7,(x,-6.2,z),controls,0.25,32)
        label("ButtonLegend" + key,key,(x,-12.18,z),2.6,key_ink)

    for key, x in (("Select",-11.7),("Start",11.7)):
        cut(front,rounded_box("SmallKeyOpeningCut",9.8,3.2,18,1.6,(x,-5,-33.1),None))
        rounded_box("SmallKeySocket" + key,9.6,3.0,0.8,1.49,(x,-9.6,-33.1),bezel,0.1)
        rounded_box("Button" + key,8.7,2.4,2.0,1.2,(x,-10.1,-33.1),controls,0.24)
        label("Legend" + key,key.upper(),(x,-9.53,-38),1.75,ink)

    # Speaker slots are modeled openings with an inner grille surface.
    cylinder("SpeakerBasket",11.2,1.6,(61,-3.9,-26.8),metal,0.25,48)
    cylinder("SpeakerCone",9.7,0.6,(61,-4.9,-26.8),silicone,0.20,48)
    cylinder("SpeakerDustCap",3.7,0.7,(61,-5.25,-26.8),chips,0.30,32)
    grille = []
    for i in range(9):
        grille.append(rounded_box("GrilleStrand",21.5,0.27,0.15,0.13,(61,-6.15,-31.6+i*1.2),chips,0,4))
    join_meshes("SpeakerGrille",grille)
    for i in range(5):
        x = 53 + i * 4.0
        cut(front,rounded_box("SpeakerOpeningCut",1.45,7.0,18,0.72,(x,-5,-26.8),None))

    # Top shoulder bars, power key, and a recessed USB-C aperture.
    for suffix,x in (("L",-62.5),("R",62.5)):
        rounded_box("TriggerSocket" + suffix,26,7.2,7.8,3.4,(x,1.7,41.0),seam,0.7)
        rounded_box("ButtonTrigger" + suffix,23.0,5.5,6.6,2.7,(x,1.1,42.7),controls,0.95,12)
        label("TriggerLegend" + suffix,suffix,(x,-2.25,43.0),2.2,key_ink)
        texture = []
        for i in range(6):
            # Fine raised ridges sit on the upper shoulder face.
            texture.append(rounded_box("ShoulderRidge",0.33,0.20,3.9,0.10,(x-4.5+i*1.8,1.1,45.45),controls,0,3))
        join_meshes("ButtonTriggerTexture"+suffix,texture)
    power=rounded_box("ButtonPower",11.8,3.5,3.0,1.7,(-18,2.0,43.1),accent,0.5)
    port_cut=rounded_box("USBOpeningCut",12.3,4.8,8.0,2.2,(20,1.8,43),None)
    port_cut.rotation_euler.x=math.pi/2
    cut(back,port_cut)
    port_cut=rounded_box("USBOpeningCut",12.3,4.8,8.0,2.2,(20,1.8,43),None)
    port_cut.rotation_euler.x=math.pi/2
    cut(front,port_cut)
    port=rounded_box("USBInner",11.0,3.5,0.20,1.7,(20,1.8,39.4),bezel,0.05)
    port.rotation_euler.x=math.pi/2
    rim=ring("USBMetal",12.0,4.5,2.1,0.42,4.0,(20,1.8,41.4),metal,12)
    rim.rotation_euler.x=math.pi/2
    tongue=rounded_box("USBTongue",7.7,0.7,3.4,0.34,(20,1.8,41.1),chips,0.1)
    tongue.rotation_euler.x=math.pi/2
    contacts=[]
    for i in range(10):
        contact=rounded_box("USBPin",0.24,0.04,2.0,0.015,(17.1+i*0.64,1.43,41.7),gold,0,3)
        contact.rotation_euler.x=math.pi/2
        contacts.append(contact)
    join_meshes("USBContacts",contacts)
    rounded_box("USBBoardTab",17.0,10.5,1.0,2.0,(20,1.0,37.2),pcb,0.2)
    rounded_box("USBCarrier",13.2,6.2,4.6,1.0,(20,1.8,38.1),metal,0.3)

    # Recessed rear fasteners and shallow grip lines give the back a finished face.
    for i,(x,z) in enumerate(((-64,30),(64,30),(-64,-30),(64,-30))):
        cut(back,cylinder("ScrewWellCut",2.65,3.4,(x,9.8,z),None,0.18,40))
        cylinder("ScrewRecess" + str(i),2.45,0.1,(x,8.17,z),seam,0.02,40)
        screw=cylinder("Screw" + str(i),1.65,0.35,(x,8.42,z),metal,0.11,40)
        torx=[((0.83 if k%2==0 else 0.60)*math.cos(math.pi*k/6),
               (0.83 if k%2==0 else 0.60)*math.sin(math.pi*k/6)) for k in range(12)]
        cut(screw,prism("ScrewDriveCut",torx,0.6,(x,8.71,z),None,0.025))
        prism("ScrewDrive"+str(i),torx,0.03,(x,8.395,z),chips,0,False)
    for side in (-1,1):
        for i in range(5):
            rounded_box("GripLine" + str(side) + "_" + str(i),0.65,16,0.10,0.3,(side*(58+i*2.7),9.53,-1),seam)
    label("RearBrand","HANDHELD STUDIO",(0,9.54,10),3.9,ink,rear=True)
    label("RearModel","HS-01  /  DESIGNED BY KAREEM ALWAN",(0,9.54,3),1.65,ink,rear=True)
    label("RearMicrotype","PORTABLE PLAY. PERSONAL BY DESIGN.",(0,9.54,-3),1.5,ink,rear=True)
    label("FrontBrand","HANDHELD",(-44,-9.51,39.3),2.0,ink,align="LEFT")
    label("FrontModel","HS-01",(72,-9.51,-38),1.8,ink)
    cylinder("StatusLEDSocket",1.15,0.08,(-66,-9.54,-29.5),seam,0.02,24)
    cylinder("StatusLED",0.65,0.10,(-66,-9.61,-29.5),accent,0.04,24)

    # The chassis is an open frame rather than a plate covering the electronics.
    # Everything below is authored geometry so it remains useful in a clear shell
    # and when the five physical assembly groups are separated.
    ring("InternalFrame",156.5,77,11.5,2.2,1.8,(0,0.2,0),chips,16)
    board=rounded_box("CircuitBoard",155,74,1.0,9.5,(0,-1.2,0),pcb,0.15,16)
    for x,z in ((-64,30),(64,30),(-64,-30),(64,-30)):
        cut(board,cylinder("BoardMountCut",3.0,5.0,(x,-1.2,z),None,0,32))
    rounded_box("Battery",62,43,4.0,3.8,(-18,4,0),battery,0.75)
    ring("BatteryWrap",60.5,41.5,3.3,0.65,0.08,(-18,6.04,0),chips,8)
    label("BatteryLabel","HS  /  2400",(-18,6.05,0),3.0,ink,rear=True)
    label("BatteryRating","3.7 V   /   8.88 Wh",(-18,6.06,-7),1.6,ink,rear=True)
    contacts=[]
    silkscreen=[]
    for i,(x,z,w,h) in enumerate(((46,20,13,10),(43,-10,12,12),(-55,19,8,9),(-53,-18,9,7),(9,18,14,14))):
        rounded_box("Chip"+str(i),w,h,1.2,0.5,(x,-2.3,z),chips,0.15)
        silkscreen.append(label("ChipMark"+str(i),"HS "+str(i+1),(x,-2.915,z),1.25,key_ink))
        for side in (-1,1):
            for k in range(6):
                contacts.append(rounded_box("ChipPin",0.6,1.5,0.22,0.18,
                    (x-w/2+1.5+k*(w-3)/5,-1.82,z+side*(h/2+0.6)),gold,0,2))
    join_meshes("PCBContacts",contacts)
    silkscreen.extend((label("BoardMark","HS-01 MAIN / REV 02",(0,-1.73,29),1.9,key_ink),
                      label("BoardMark","L",(-65,-1.73,23),1.8,key_ink),
                      label("BoardMark","R",(65,-1.73,23),1.8,key_ink)))
    join_meshes("PCBSilkscreen",silkscreen)

    # Sparse routed traces and component banks read clearly without dense meshes.
    trace_meshes=[]
    routes=[[(12,27),(31,27),(36,22),(39,22)],[(14,21),(28,21),(28,11),(45,11)],
            [(-48,23),(-38,23),(-33,18),(-1,18)],[(-49,-17),(-31,-17),(-26,-12),(35,-12)],
            [(43,-19),(35,-19),(29,-25),(12,-25)],[(-57,14),(-43,14),(-38,9),(-13,9)],
            [(55,18),(66,18),(66,25)],[(48,-11),(56,-11),(61,-16)],
            [(-2,11),(-2,-3),(10,-3),(18,-11)],[(20,29),(20,32),(33,32)]]
    for route in routes:
        for (x1,z1),(x2,z2) in zip(route,route[1:]):
            length=math.hypot(x2-x1,z2-z1)
            seg=prism("Trace",[(-length/2,-0.09),(length/2,-0.09),(length/2,0.09),(-length/2,0.09)],
                      0.026,((x1+x2)/2,-1.724,(z1+z2)/2),gold,0,False)
            seg.rotation_euler.y=-math.atan2(z2-z1,x2-x1)
            trace_meshes.append(seg)
    join_meshes("PCBTraces",trace_meshes)
    smd=[]
    solder=[]
    for i in range(16):
        x=-33+(i%8)*5.0
        z=24 if i<8 else -23
        smd.append(rounded_box("SMD",2.0,0.9,0.65,0.18,(x,-2.03,z),chips,0,3))
        for side in (-1,1):
            solder.append(rounded_box("Solder",0.5,1.0,0.45,0.18,(x+side*1.05,-1.93,z),metal,0,3))
    join_meshes("SMDComponents",smd)
    join_meshes("SMDSolder",solder)

    # Silicone actuator domes make the button-to-board relationship legible.
    cylinder("DPadMembrane",11.6,1.0,(dx,-2.3,dz),silicone,0.25,48)
    for suffix,x,z in (("X",63.2,15.1),("Y",52.9,4.8),("A",73.5,4.8),("B",63.2,-5.5)):
        cylinder("SwitchDome"+suffix,3.8,1.9,(x,-2.8,z),silicone,0.60,32)
        cylinder("SwitchContact"+suffix,2.0,0.08,(x,-3.80,z),chips,0.02,24)
    for key,x in (("Select",-11.7),("Start",11.7)):
        rounded_box("Switch"+key,9,3,1.4,1.2,(x,-2.4,-33.1),silicone,0.3)

    # Folded display flex and two battery leads use low-resolution source curves.
    path=[(-4.25,-24),(-4.15,-27.7),(-3.2,-30),(-1.82,-28),(-1.72,-25.5)]
    verts=[(u(x),u(y),u(z)) for y,z in path for x in (0,10)]
    faces=[(2*i,2*i+1,2*i+3,2*i+2) for i in range(len(path)-1)]
    flex_mesh=bpy.data.meshes.new("DisplayRibbonGeometry")
    flex_mesh.from_pydata(verts,[],faces)
    flex_mesh.update()
    flex=bpy.data.objects.new("DisplayRibbon",flex_mesh)
    bpy.context.collection.objects.link(flex)
    assign(flex,ribbon)
    mod=flex.modifiers.new("Flexible laminate thickness","SOLIDIFY")
    mod.thickness=u(0.15)
    apply_modifier(flex,mod)
    bevel(flex,0.18,3)
    rounded_box("RibbonConnector",12,3,1.5,0.6,(5,-2.42,-25.5),chips,0.15)
    wire("BatteryWirePositive",[(13,4.7,-9),(20,5.1,-12),(28,3.5,-14),(31,1.8,-16)],0.34,accent)
    wire("BatteryWireNegative",[(13,4.7,-11),(20,5.2,-15),(29,3.5,-17),(31,1.8,-18)],0.34,chips)
    rounded_box("BatteryConnector",5.4,5.3,2.2,0.7,(32,1.3,-17),silicone,0.3)
    wire("SpeakerLead",[(51,-3.7,-28),(45,-2.9,-28),(39,-2.2,-23)],0.22,accent)

    # Screw bosses are aligned with the actual recessed screws and move with the
    # rear shell; small ribs tie those bosses to its inside wall.
    for i,(x,z) in enumerate(((-64,30),(64,30),(-64,-30),(64,-30))):
        post=cylinder("MountPost"+str(i),2.7,7.8,(x,3.4,z),shell_back,0.2,32)
        cut(post,cylinder("MountBoreCut",1.1,12.0,(x,3.4,z),None,0,24))
        insert=ring("MountInsert"+str(i),2.9,2.9,1.45,0.43,0.6,(x,-0.55,z),metal,8)
        rounded_box("RearRib"+str(i),1.3,8.2,2.8,0.5,(x,6.0,z+(4.3 if z>0 else -4.3)),shell_back,0.25)

    # Boolean openings create new cap polygons: keep those broad coplanar faces
    # flat-shaded so triangulation cannot introduce pinched highlight artifacts.
    for housing in (front, back):
        bevel(housing,0.13,2)
        for polygon in housing.data.polygons:
            polygon.use_smooth = abs(polygon.normal.y) < 0.999
        mod = housing.modifiers.new("Final housing normals", "WEIGHTED_NORMAL")
        mod.keep_sharp = True
        apply_modifier(housing, mod)

    # Helpful source metadata survives in .blend and glTF node extras.
    organize_assemblies()
    front["part"] = "front_shell"
    back["part"] = "rear_shell"
    bpy.context.scene["asset"] = "HS-01"
    bpy.context.scene["asset_revision"] = 2
    bpy.context.scene["nominal_wall_thickness_mm"] = 2.1
    bpy.context.scene["millimeters_per_export_unit"] = 164 / 6.4
    bpy.context.scene["coordinate_convention"] = "Blender X width, Z height, -Y front; glTF X width, Y height, +Z front"
    bpy.context.scene.unit_settings.system = "NONE"
    bpy.context.scene.world.color = (0.8,0.8,0.8)
    bpy.ops.object.select_all(action="DESELECT")
    front.select_set(True)
    bpy.context.view_layer.objects.active = front
    for area in bpy.context.screen.areas if bpy.context.screen else []:
        if area.type == "VIEW_3D":
            area.spaces.active.region_3d.view_distance = 10
            area.spaces.active.region_3d.view_location = (0,0,0)
    source.parent.mkdir(parents=True, exist_ok=True)
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(source), check_existing=False)
    print(f"HS-01 source saved: {source}")
    print(f"Meshes: {sum(o.type == 'MESH' for o in bpy.context.scene.objects)}")


if __name__ == "__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("--output",default="assets/source/hs-01.blend")
    options=parser.parse_args(sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else [])
    target=(ROOT / options.output).resolve()
    if not target.is_relative_to(ROOT.resolve()):
        raise ValueError("Asset output must stay inside the project directory")
    build(target)
