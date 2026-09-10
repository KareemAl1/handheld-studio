# Engineering decisions

## React owns configuration; Three owns presentation

`src/config/config.ts` is a pure TypeScript module. Its versioned allowlist accepts only known shell names. The reducer never mutates previous state, and invalid restoration leaves the current valid build intact. Serialization is a small, deterministic `v=1&s=chalk` format with bounds on input length and rejection of duplicate, missing, or extra keys. Local persistence and URL loading are intentionally not wired in this milestone.

Camera state is separate from product configuration: moving the camera does not change what a future saved build means. Native radio inputs provide keyboard arrow-key behavior, checked state, and accessible labels without recreating those semantics in a canvas.

## Original, editable geometry

`scripts/build_asset.py` authors the model in Blender and saves `assets/source/hs-01.blend`. `scripts/export_asset.py` exports the edited source to `public/models/hs-01.glb`, preserving named mesh parts and material names while excluding lights, cameras, and animations. Both derive paths from their own location. `scripts/run_blender.py` finds Blender through `BLENDER_BIN`, PATH, or its normal Windows installation directory; it installs nothing.

The shell represents 164 × 88 × 19 mm. It exports at 6.4 units wide with X as width, Y as height, and +Z as the front. Separate shell halves, glass, screen, buttons, PCB, battery, shoulders, hardware, and port elements make future exploded and translucent states practical. The solid mode hides interior meshes but keeps them in the asset. Changing shell materials does not require re-exporting geometry.

## Resource ownership

The GLTF loader caches the original geometry. Each displayed console clones its scene and materials, so changing a shell cannot mutate the cached asset or another instance. The component disposes its owned material copies and generated screen texture; shared imported geometry stays cached. `Screen` is a separate UV-mapped material, ready for a later game texture.

## Rendering at rest

The canvas renders on demand. Shell changes explicitly request a render, and OrbitControls requests frames while movement/damping is active. Static environment lighting is generated locally once; no remote HDRI or texture service is required. The contact shadow is cached once because the device geometry stays assembled and stationary in this milestone. Exploded animation will need to invalidate that shadow as geometry moves.

Pixel ratio is capped at 1.75. Visible internals are disabled for solid shells. Heavy Three/R3F code loads separately from the React control interface. The Three chunk still exceeds Vite's generic 500 kB warning threshold; it remains an explicit measured cost, not a suppressed warning. A geometry/texture decoder is deferred until it produces a measured transfer or runtime benefit over this small self-contained model.

## Camera motion

Preset transitions interpolate spherical angles and radius around the device, never a straight line through it. A transition-local clock avoids the large first delta that can follow an idle demand loop. The path uses the shortest angular route. Reduced motion applies presets immediately and disables inertia; manual inspection still works.

## Failures and progressive loading

An unavailable WebGL2 context gets a labeled static Chalk poster while the HTML shell controls stay usable. An asset failure offers Retry, which clears the rejected GLTF cache entry and remounts the viewer. A failed JavaScript scene module instead offers Reload page because the browser and React cache rejected module imports. These are distinct recovery paths and are exercised in browser tests.

The optional, feature-detected WebMCP shell action uses the same reducer and validates its input. Unsupported browsers do not need it. Its valid and invalid paths were exercised through the actual in-app browser tool registry.

## What performance numbers mean

Development-only diagnostics count completed main-canvas frame loops and expose draw calls, triangles, and texture counts. Active measurements report intervals between frames, not GPU execution time. Idle time is measured separately, never averaged into a claimed frame rate. Headless Chrome and a mobile viewport on this Windows host do not establish physical-phone performance. Diagnostics are excluded from production builds.
