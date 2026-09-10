"""Reproducibly export the editable HS-01 asset with Blender's bundled exporter.

  blender --background --python scripts/export_asset.py

Append -- --poster to render the front fallback image. Append --rear as well
to inspect the rear in that same image path; re-render without it for delivery.
--source, --output, and an optional path after --poster support project-local
staging. --exploded / --translucent only alter the optional diagnostic render,
never the editable source or exported GLB.

Paths derive from this script, so no local machine paths enter the source.
Exported nodes retain part and material names for runtime customization.
"""

from pathlib import Path
import argparse
import json
import sys
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets" / "source" / "hs-01.blend"
OUTPUT = ROOT / "public" / "models" / "hs-01.glb"


def render_poster(target, rear=False, exploded=False, translucent=False):
    """Optional local reference image, without altering the editable scene."""
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 64
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 1400
    scene.render.resolution_y = 1000
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "WEBP"
    scene.render.image_settings.quality = 92
    scene.render.film_transparent = False
    scene.world.use_nodes = True
    scene.world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.8, 0.78, 0.73, 1)
    scene.world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.4
    scene.view_settings.view_transform = "AgX"
    if exploded:
        for name,offset in {"AssemblyFrontShell":-2.0,"AssemblyControls":-2.65,
                            "AssemblyDisplay":-0.95,"AssemblyBoard":0.8,
                            "AssemblyRearShell":2.6}.items():
            bpy.data.objects[name].location.y=offset
    if translucent:
        for name in ("ShellFront","ShellBack"):
            shader=bpy.data.materials[name].node_tree.nodes["Principled BSDF"]
            shader.inputs["Base Color"].default_value=(0.55,0.79,0.71,1)
            shader.inputs["Roughness"].default_value=0.16
            shader.inputs["IOR"].default_value=1.46
            shader.inputs["Transmission Weight"].default_value=0.82
    bpy.ops.object.camera_add(location=(9.0, -11.0, 7.5) if exploded else ((-4.0, 13.0, 7.0) if rear else (4.0, -13.0, 7.0)))
    camera = bpy.context.object
    camera.rotation_euler = (Vector((0, 0, 0.15)) - camera.location).to_track_quat("-Z", "Y").to_euler()
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = 11.7 if exploded else 8.6
    scene.camera = camera
    for name, position, power, size in (("PosterKey",(-4,-6,8),750,7), ("PosterFill",(5,-2,5),450,5), ("PosterRim",(-2,3,6),650,5)):
        bpy.ops.object.light_add(type="AREA", location=position)
        light = bpy.context.object
        light.name = name
        light.data.energy = power
        light.data.shape = "DISK"
        light.data.size = size
        light.rotation_euler = (-light.location).to_track_quat("-Z", "Y").to_euler()
    bpy.ops.mesh.primitive_plane_add(size=200, location=(0,0,-1.92))
    ground = bpy.context.object
    ground.name = "PosterGround"
    mat = bpy.data.materials.new("PosterGround")
    mat.use_nodes = True
    mat.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.78,0.76,0.71,1)
    mat.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.7
    ground.data.materials.append(mat)
    target.parent.mkdir(parents=True, exist_ok=True)
    scene.render.filepath = str(target)
    bpy.ops.render.render(write_still=True)
    print(f"Poster saved: {target}")


def export(source=SOURCE,output=OUTPUT):
    if not source.is_file():
        raise FileNotFoundError(f"Run build_asset.py first: {source}")
    bpy.ops.wm.open_mainfile(filepath=str(source))
    bpy.ops.object.select_all(action="DESELECT")
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    for obj in meshes:
        obj.select_set(True)
    for obj in bpy.context.scene.objects:
        if obj.type == "EMPTY" and obj.get("assembly"):
            obj.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(output),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_materials="EXPORT",
        export_normals=True,
        export_texcoords=True,
        export_extras=True,
        export_cameras=False,
        export_lights=False,
        export_animations=False,
        export_yup=True,
    )
    triangles = 0
    vertices = 0
    for obj in meshes:
        obj.data.calc_loop_triangles()
        triangles += len(obj.data.loop_triangles)
        vertices += len(obj.data.vertices)
    corners=[obj.matrix_world @ Vector(corner) for obj in meshes for corner in obj.bound_box]
    lower=[min(v[i] for v in corners) for i in range(3)]
    upper=[max(v[i] for v in corners) for i in range(3)]
    groups={}
    for obj in meshes:
        key=obj.get("assembly","ungrouped")
        groups[key]=groups.get(key,0)+1
    print(json.dumps({
        "output": str(output), "bytes": output.stat().st_size,
        "mesh_objects": len(meshes), "source_vertices": vertices,
        "triangles": triangles, "shell_width_export_units": 6.4,
        "millimeters_per_export_unit": 25.625,
        "bounds_gltf_min": [lower[0],lower[2],-upper[1]],
        "bounds_gltf_max": [upper[0],upper[2],-lower[1]],
        "assembly_mesh_counts": groups,
        "materials": sorted(mat.name for mat in bpy.data.materials if mat.users),
    }, indent=2))


if __name__ == "__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("--source",default="assets/source/hs-01.blend")
    parser.add_argument("--output",default="public/models/hs-01.glb")
    parser.add_argument("--poster",nargs="?",const="public/images/hs-01-poster.webp")
    parser.add_argument("--rear",action="store_true")
    parser.add_argument("--exploded",action="store_true")
    parser.add_argument("--translucent",action="store_true")
    options=parser.parse_args(sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else [])
    def project_path(value):
        target=(ROOT/value).resolve()
        if not target.is_relative_to(ROOT.resolve()):
            raise ValueError("Asset paths must stay inside the project directory")
        return target
    export(project_path(options.source),project_path(options.output))
    if options.poster:
        render_poster(project_path(options.poster),rear=options.rear,
                      exploded=options.exploded,translucent=options.translucent)
