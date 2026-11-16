"""Render one continuous, vertical 3D turntable. Run with Blender in background."""
import argparse
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector


def point_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


def material(name, rgb, roughness):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*rgb, 1)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*rgb, 1)
    shader.inputs["Roughness"].default_value = roughness
    return mat


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--frames-dir", type=Path, required=True)
    parser.add_argument("--seconds", type=int, choices=range(1, 16), default=15)
    args = parser.parse_args(sys.argv[sys.argv.index("--") + 1:])
    args.frames_dir.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.world = bpy.data.worlds.new("Estúdio")
    scene.world.color = (0.14, 0.14, 0.14)
    fabric = material("Tecido preto", (0.018, 0.020, 0.023), 0.72)
    stage = material("Palco", (0.12, 0.14, 0.16), 0.78)

    # Cross-sections of a closed-back sample dress, from hem to collar.
    rings = [(0.30, 0.72, 0.36), (0.75, 0.57, 0.31), (1.17, 0.44, 0.27),
             (1.40, 0.37, 0.23), (1.65, 0.48, 0.30), (1.86, 0.51, 0.26),
             (1.99, 0.29, 0.18), (2.03, 0.22, 0.16)]
    sides = 64
    vertices = []
    for z, width, depth in rings:
        for i in range(sides):
            angle = math.tau * i / sides
            folds = 1 + 0.035 * math.cos(10 * angle) * max(0, 1.4 - z)
            neckline = 0.15 * max(0, math.sin(angle)) ** 3 if z == rings[-1][0] else 0
            vertices.append((width * math.cos(angle) * folds,
                             depth * math.sin(angle) * folds, z - neckline))
    faces = [(r * sides + i, r * sides + (i + 1) % sides,
              (r + 1) * sides + (i + 1) % sides, (r + 1) * sides + i)
             for r in range(len(rings) - 1) for i in range(sides)]
    mesh = bpy.data.meshes.new("Malha do vestido")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    dress = bpy.data.objects.new("Vestido de demonstração", mesh)
    scene.collection.objects.link(dress)
    dress.data.materials.append(fabric)
    for face in dress.data.polygons:
        face.use_smooth = True
    dress.modifiers.new("Suavização", "SUBSURF").levels = 1
    dress.modifiers.new("Espessura", "SOLIDIFY").thickness = 0.025

    bpy.ops.mesh.primitive_cylinder_add(vertices=64, radius=1.0, depth=0.16, location=(0, 0, 0.21))
    platform = bpy.context.object
    platform.data.materials.append(stage)
    bevel = platform.modifiers.new("Borda", "BEVEL")
    bevel.width = 0.035
    bevel.segments = 3
    bpy.ops.mesh.primitive_plane_add(size=200)
    bpy.context.object.data.materials.append(stage)

    bpy.ops.object.camera_add(location=(0, 5, 2.42))
    scene.camera = bpy.context.object
    scene.camera.data.type = "ORTHO"
    scene.camera.data.ortho_scale = 3.55
    point_at(scene.camera, (0, 0, 1.21))
    for position, power, size in [((3, 3, 4), 630, 3), ((-3, 1, 3), 410, 3), ((0, -3, 4), 760, 2)]:
        bpy.ops.object.light_add(type="AREA", location=position)
        lamp = bpy.context.object
        lamp.data.energy = power
        lamp.data.shape = "DISK"
        lamp.data.size = size
        point_at(lamp, (0, 0, 1.1))

    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 4
    scene.cycles.use_denoising = False
    scene.render.resolution_x = 270
    scene.render.resolution_y = 480
    scene.render.resolution_percentage = 100
    scene.render.fps = 12
    scene.frame_end = scene.render.fps * args.seconds
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = str(args.frames_dir.resolve() / "frame-")
    dress.keyframe_insert(data_path="rotation_euler", frame=1)
    dress.rotation_euler.z = math.tau
    dress.keyframe_insert(data_path="rotation_euler", frame=scene.frame_end + 1)
    for curve in dress.animation_data.action.fcurves:
        for point in curve.keyframe_points:
            point.interpolation = "LINEAR"
    bpy.ops.render.render(animation=True)


main()
