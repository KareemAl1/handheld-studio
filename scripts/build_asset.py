"""Build the original HS-01 editable asset. Run from any working directory:

  blender --background --python scripts/build_asset.py

No downloaded geometry, textures, fonts, or add-ons are required. Dimensions are
authored in millimeters, then mapped to a 6.4-unit export width. Blender uses X
for width, Z for height, and -Y for the front; glTF maps these to X, Y, and +Z.
"""

from pathlib import Path
import math
import bpy
from mathutils import Vector

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


def rounded_box(name, width, height, depth, radius, position, mat=None, edge=0, steps=12):
    return prism(name, rounded_outline(width, height, radius, steps), depth, position, mat, edge)


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


def build():
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

    # Hollow halves retain actual walls for future translucent material options.
    front = rounded_box("ShellFront", 164, 88, 9.3, 16, (0, -4.85, 0), shell_front, 2.8, 16)
    cavity = rounded_box("FrontCavityCut", 158.8, 82.8, 18, 13.4, (0, 3.25, 0), None, 1.4)
    cut(front, cavity)
    back = rounded_box("ShellBack", 164, 88, 9.1, 16, (0, 4.95, 0), shell_back, 3.0, 16)
    cavity = rounded_box("BackCavityCut", 158.8, 82.8, 18, 13.4, (0, -3.0, 0), None, 1.4)
    cut(back, cavity)

    ring("Seam", 162.5, 86.5, 15.4, 2.0, 0.65, (0, 0.12, 0), seam, 16)
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
    cylinder("DPadCenter", 2.3, 0.08, (dx, -12.08, dz), controls, 0.01, 32)
    for name, px, pz, rotation in (("Up",0,8.2,0),("Down",0,-8.2,math.pi),("Left",-8.2,0,math.pi/2),("Right",8.2,0,-math.pi/2)):
        tri = [(-0.8,-0.45),(0.8,-0.45),(0,0.75)]
        points = [(x*math.cos(rotation)-z*math.sin(rotation), x*math.sin(rotation)+z*math.cos(rotation)) for x,z in tri]
        prism("DPadMark" + name, points, 0.045, (dx+px,-12.065,dz+pz), key_ink, 0, False)

    for key, x, z in (("X",63.2,15.1),("Y",52.9,4.8),("A",73.5,4.8),("B",63.2,-5.5)):
        cut(front, cylinder("ActionOpeningCut", 5.65, 18, (x,-5,z), None,0))
        cylinder("ButtonSocket" + key,5.6,0.9,(x,-9.5,z),bezel,0.15)
        cylinder("Button" + key,4.65,3.1,(x,-10.6,z),controls,0.65)
        label("ButtonLegend" + key,key,(x,-12.18,z),2.6,key_ink)

    for key, x in (("Select",-11.7),("Start",11.7)):
        cut(front,rounded_box("SmallKeyOpeningCut",9.8,3.2,18,1.6,(x,-5,-33.1),None))
        rounded_box("SmallKeySocket" + key,9.6,3.0,0.8,1.49,(x,-9.6,-33.1),bezel,0.1)
        rounded_box("Button" + key,8.7,2.4,2.0,1.2,(x,-10.1,-33.1),controls,0.24)
        label("Legend" + key,key.upper(),(x,-9.53,-38),1.75,ink)

    # Speaker slots are modeled openings with an inner grille surface.
    rounded_box("SpeakerGrille",24,13,1.0,4,(61,-6.0,-26.8),chips,0.25)
    for i in range(5):
        x = 53 + i * 4.0
        cut(front,rounded_box("SpeakerOpeningCut",1.45,7.0,18,0.72,(x,-5,-26.8),None))

    # Top shoulder bars, power key, and a recessed USB-C aperture.
    for suffix,x in (("L",-62.5),("R",62.5)):
        rounded_box("TriggerSocket" + suffix,26,7.2,7.8,3.4,(x,1.7,41.0),seam,0.7)
        rounded_box("ButtonTrigger" + suffix,23.0,5.5,6.6,2.7,(x,1.1,42.7),controls,0.9)
        label("TriggerLegend" + suffix,suffix,(x,-2.25,43.0),2.2,key_ink)
    power=rounded_box("ButtonPower",11.8,3.5,3.0,1.7,(-18,2.0,43.1),accent,0.5)
    port_cut=rounded_box("USBOpeningCut",12.3,4.8,8.0,2.2,(20,1.8,43),None)
    port_cut.rotation_euler.x=math.pi/2
    cut(back,port_cut)
    port_cut=rounded_box("USBOpeningCut",12.3,4.8,8.0,2.2,(20,1.8,43),None)
    port_cut.rotation_euler.x=math.pi/2
    cut(front,port_cut)
    port=rounded_box("USBInner",11.9,4.4,2.0,2.0,(20,1.8,42.6),bezel,0.2)
    port.rotation_euler.x=math.pi/2
    rim=ring("USBMetal",12.0,4.5,2.1,0.42,0.6,(20,1.8,43.15),metal,12)
    rim.rotation_euler.x=math.pi/2
    tongue=rounded_box("USBTongue",7.7,0.7,1.5,0.34,(20,1.8,42.9),chips,0.1)
    tongue.rotation_euler.x=math.pi/2

    # Recessed rear fasteners and shallow grip lines give the back a finished face.
    for i,(x,z) in enumerate(((-64,30),(64,30),(-64,-30),(64,-30))):
        cylinder("ScrewRecess" + str(i),2.6,0.1,(x,9.54,z),seam,0.02,32)
        cylinder("Screw" + str(i),1.65,0.22,(x,9.68,z),metal,0.15,32)
        slot=rounded_box("ScrewSlot" + str(i),2.15,0.40,0.05,0.19,(x,9.805,z),chips)
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

    # A deliberately simplified but visible internal assembly; no hidden textures.
    rounded_box("InternalFrame",151,75,2.1,11.5,(0,0.2,0),chips,0.55)
    rounded_box("CircuitBoard",144,68,1.2,9.5,(0,-1.7,0),pcb,0.15)
    rounded_box("Battery",62,43,4.0,3.8,(-18,4,0),battery,0.75)
    label("BatteryLabel","HS  /  2400",(-18,6.05,0),3.0,ink,rear=True)
    for i,(x,z,w,h) in enumerate(((48,18,16,13),(44,-9,13,13),(-55,17,9,10),(-55,-18,11,8),(12,17,10,9))):
        rounded_box("Chip"+str(i),w,h,1.5,0.5,(x,-3,z),chips,0.15)
        for k in range(5):
            rounded_box("Contact"+str(i)+"_"+str(k),1.1,2.1,0.3,0.25,(x-w/2+2+k*(w-4)/4,-2.5,z+h/2+1),gold)
    for i,(x,z) in enumerate(((-70,27),(70,27),(-70,-27),(70,-27))):
        cylinder("MountPost"+str(i),2.5,10.5,(x,0,z),shell_back,0.2,24)
        cylinder("MountInsert"+str(i),1.3,0.5,(x,-5.5,z),metal,0.1,24)

    # Boolean openings create new cap polygons: keep those broad coplanar faces
    # flat-shaded so triangulation cannot introduce pinched highlight artifacts.
    for housing in (front, back):
        for polygon in housing.data.polygons:
            polygon.use_smooth = abs(polygon.normal.y) < 0.999
        mod = housing.modifiers.new("Final housing normals", "WEIGHTED_NORMAL")
        mod.keep_sharp = True
        apply_modifier(housing, mod)

    # Helpful source metadata survives in .blend and glTF node extras.
    for obj in bpy.context.scene.objects:
        if obj.type == "MESH":
            obj["authorship"] = "Original Handheld Studio geometry by Kareem Alwan / Codex"
    front["part"] = "front_shell"
    back["part"] = "rear_shell"
    bpy.context.scene["asset"] = "HS-01"
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
    SOURCE.parent.mkdir(parents=True, exist_ok=True)
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE), check_existing=False)
    print(f"HS-01 source saved: {SOURCE}")
    print(f"Meshes: {sum(o.type == 'MESH' for o in bpy.context.scene.objects)}")


if __name__ == "__main__":
    build()
