# Engineering decisions

## React owns configuration; Three owns presentation

`src/config/config.ts` is a pure TypeScript module. Schema v2 accepts only known shell colors, button colors and finishes. The reducer never mutates previous state, and invalid restoration leaves the current valid build intact. Serialization is deterministic (`v=2&s=chalk&b=charcoal&f=solid`), with input bounds and rejection of duplicate, missing or extra keys. Strict v1 values migrate to default buttons and solid finish.

Camera state is separate from product configuration: moving the camera does not change what a saved build means. Native radio inputs provide keyboard arrow-key behavior, checked state, and accessible labels without recreating those semantics in a canvas.

`persistence.ts` validates both stored JSON and URL input. A valid shared query takes precedence over localStorage without reading or changing it. Otherwise a validated saved build wins, then defaults. Storage getters, JSON parsing and writes can all fail independently; each boundary has a user-facing result. Explicit Save/Restore clears an older shared query so the next reload honors that action. Clipboard denial exposes a selected readonly link. Saving is explicit and stores one configuration, without camera or game state.

## Original, editable geometry

`scripts/build_asset.py` authors the model in Blender and saves `assets/source/hs-01.blend`. `scripts/export_asset.py` exports the edited source to `public/models/hs-01.glb`, preserving named mesh parts and material names while excluding lights, cameras, and animations. Both derive paths from their own location. `scripts/run_blender.py` finds Blender through `BLENDER_BIN`, PATH, or its normal Windows installation directory; it installs nothing.

The shell represents 164 × 88 × 19 mm. It exports at 6.4 units wide with X as width, Y as height, and +Z as the front. Five aligned parent groups carry the front shell, controls, display, board and rear shell; per-mesh assembly metadata survives export. The shell walls are actually hollow. Solid assembled mode hides interior details except visible port/speaker parts; translucency and explosion reveal them. Internal components are an original layout study, not a verified electronics design.

## Resource ownership

The GLTF loader caches original geometry. Each console owns its scene and material copies, procedural screen/grain textures and derived geometry; shared imported geometry stays cached. Cleanup disposes only owned resources. `Screen` stays a separate UV-mapped material: Play temporarily binds an owned canvas texture and restores the original boot texture on exit.

At load time, compatible static meshes sharing a material and visibility policy are combined within each assembly group. This reduces assembled draw calls from 92 to 26 without flattening the five movable layers or changing the editable Blender source. Transform baking preserves world-space shape, normals and UVs; conditional internals remain separate from visible port details. Tests load the real exported GLB and check bounds, triangles, transforms, independent visibility and disposal without mutating cached source buffers.

## Rendering at rest

The canvas renders on demand until camera, material and assembly transitions settle. Static environment lighting is generated locally once; no remote HDRI or texture service is required. Contact shadows refresh when an assembly transition settles and are cached during ordinary orbit. This avoids repeatedly rendering the device into a shadow map while only the camera moves.

The scene component is memoized so score/lane changes in the HTML HUD do not recapture environment lighting. Game texture updates explicitly invalidate the demand loop; ready, paused and finished games stop publishing frames.

Pixel ratio is capped at 1.75. Visible internals are disabled for solid shells. Heavy Three/R3F code loads separately from the React control interface. The Three chunk still exceeds Vite's generic 500 kB warning threshold; it remains an explicit measured cost, not a suppressed warning. A geometry/texture decoder is deferred until it produces a measured transfer or runtime benefit over this small self-contained model.

## Camera motion

Preset transitions interpolate the shortest spherical-angle path around the target. Framing projects the eight corners of the assembly's conservative bounds into the camera basis, including depth and current orientation. Zoom is a bounded ratio of that fitted distance, and a separate clearance bound keeps the eye outside the full assembly even at close inspection. Fit recenters the object while retaining orientation; Reset restores assembly and camera defaults.

Wheel, trackpad pinch and two-touch pinch use one smoothed zoom path. OrbitControls handles rotation; its built-in radial zoom is disabled because its damping does not smooth radius. Native rotation is suspended during a pinch. A transition-local clock avoids the large first delta after idle. Reduced motion applies targets immediately; changing the preference does not replay the last command.

## Assembly and materials

One normalized assembly value drives absolute Z offsets from immutable group origins. No incremental translations or queued animation clips accumulate, so interrupted and repeated transitions return to the same geometry. Camera bounds follow the displayed assembly value, not just the slider target. Keyboard detail selection moves focus into the viewer; native controls remain next in tab order.

Solid plastic, rubber controls, metal and glass use separate responses to the same studio lights. Translucency uses native physical transmission through closed shell geometry with opaque internals. Surface color is lightened for the translucent variant while volume attenuation carries the selected tint; fully saturated diffuse tint would filter the board colors twice. A deterministic 128px texture supplies fine plastic grain. Material changes ease to their targets without mutating the shared GLTF.

## Failures and progressive loading

An unavailable WebGL2 context gets a labeled static Chalk poster while the HTML shell controls stay usable. An asset failure offers Retry, which clears the rejected GLTF cache entry and remounts the viewer. A failed JavaScript scene module instead offers Reload page because the browser and React cache rejected module imports. These are distinct recovery paths and are exercised in browser tests.

After a temporary WebGL context loss, Three rebuilds its GPU resources. The studio explicitly invalidates its demand loop and recaptures the environment and contact shadow on restoration. This preserves configuration, assembly and camera state. A regression test forces two loss/restore cycles and compares the restored canvas pixels to the original lit scene.

The optional, feature-detected WebMCP shell action uses the same reducer and validates its input. Unsupported browsers do not need it. Its valid and invalid paths were exercised through the actual in-app browser tool registry.

## A game that is separate from its screen

`game/engine.ts` is a deterministic pure reducer for a seeded three-lane collect-and-dodge game. `GameSession` owns a fixed 1/60-second accumulator and separate subscriptions for canvas painting and the small React HUD. A bounded elapsed step avoids jumping through hazards after a stalled frame. The animation hook schedules simulation/texture updates at most 30 times per second; input and phase changes repaint immediately. This is a budget on scheduled updates, not a measured GPU frame-rate promise.

Entering Play assembles the device and moves to a screen-specific camera fit. Start is enabled only after assembly and camera settle. Camera listeners ignore play input, while HTML buttons and keyboard shortcuts feed the same game actions. Visibility loss and WebGL context loss pause the session. Returning to the tab requires Resume and starts a fresh animation clock. Reduced motion removes decorative lane scrolling while preserving movement needed to play.

## Export without disturbing inspection

PNG export clones the assembled model and its materials into a separate scene, retaining source-owned geometry and lighting textures. It applies the exact selected configuration, restores the boot display, and creates a bounded 1600 × 1200 render target using the existing renderer. It does not resize the live canvas, move the interactive camera, or alter a game session.

Three r180 offscreen targets omit the main canvas's display transform. Export therefore captures linear half-float color, unpremultiplies edge/shadow coverage, applies ACES tone mapping and sRGB conversion, and composites onto exact ivory `#f1eee7`. The isolated transmission pass gets an opaque ivory backdrop so tinted shells retain convincing internals. Pixel tests guard background color, opacity, framing, configuration differences and repeatability.

GPU work and renderer-state restoration finish synchronously before asynchronous PNG encoding. A `finally` block releases export-owned textures, materials, geometry and render targets, including Three's private per-scene transmission target. The export requires a supported float color buffer; a failure produces an actionable message. The browser receives a Blob URL download with a persistent fallback link; replaced URLs are revoked.

## What performance numbers mean

Development-only diagnostics count completed main-canvas frame loops and expose draw calls, triangles, and texture counts. Active measurements report intervals between frames, not GPU execution time. Idle time is measured separately, never averaged into a claimed frame rate. Headless Chrome and a mobile viewport on this Windows host do not establish physical-phone performance. Diagnostics are excluded from production builds.
