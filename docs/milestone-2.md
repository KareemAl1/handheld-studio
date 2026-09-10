# Milestone 2 — local development record

## Stage 1: camera and framing

Measured before changes on 2026-09-10 in Chrome 152.0.7977.83: 74 draw calls, 36,927 visible triangles, 6 textures, 0 frames during one second at rest. Median active frame interval 4.2ms and p95 4.7ms in both desktop and mobile emulation. These measure this host's render cadence, not GPU execution time or physical-phone performance. Raw baseline reports and screenshots are in `screenshots/milestone-2/before-*`.

Wheel/trackpad input and two-finger pinch now share a clamped, smoothly interpolated zoom ratio. Native HTML Zoom in, Zoom out and Fit controls use the same path. Fit retains orientation; presets and Reset build restore fitted zoom. Input handlers attach only to the canvas, preserving page scrolling elsewhere. No additional dependency was installed.

Framing solves the perspective projection constraints for all eight device bounds corners at the current camera angle. At Fit, this maintains a margin around the handheld as it rotates. Close zoom intentionally permits detail cropping while maintaining a minimum camera distance; Fit restores a complete view. Both rotation and zoom stop rendering at rest. Reduced motion applies zoom targets without easing.

Verification: TypeScript/build and lint passed; 26 unit tests passed, including framing across four aspect ratios and 105 angle combinations each. Five camera browser tests passed, with the desktop copy of the touch-only test intentionally skipped. Checks include wheel limits, button limits, page scrolling outside the viewer, pinch-to-rotation handoff, keyboard zoom, Fit, reset and reduced motion. Actual desktop and mobile screenshots were inspected before proceeding.

## Stage 2: authored detail and materials

The Blender source and reproducible export now contain five identity assembly groups with explicit per-mesh assembly metadata. Refined housing bevels, real recessed screw wells and drive shapes, speaker openings/mesh, shoulder grip texture and USB-C shield/contact geometry are original. Internal geometry includes an open frame, PCB traces and component banks, switch domes, a folded display ribbon, battery and leads. The board is an illustrative hardware concept.

Both shells are closed/manifold. Sampled wall thickness is 2.05 mm front / 2.10 mm rear. Small repeated details were batched; the initial detailed candidate was reduced from 115,624 to 78,616 triangles before delivery. Final GLB is 1,801,256 bytes, 130 meshes and 17 materials. Source is 817,197 bytes; poster is 26,468 bytes. Repeat export was byte-identical (SHA256 861a75d88752accb3c7b699a803be6a8629b3aae3519f9cf156bbc9a385f84a3).

Shell finish uses native Three physical transmission, a real hollow housing and tint absorption, retaining opaque electronics and readable shell edges. A deterministic 128px grain texture adds subtle surface variation. Glass, rubber controls, metal and shell have separate material responses. Colors interpolate smoothly and return to an idle demand loop. Button color is independent of shell color and finish.

Configuration schema v2 validates all three independent choices and explicitly migrates strict legacy v1 objects/URLs. Configuration and framing suites total 81 passing unit tests. Both desktop and mobile browser tests exercised all 18 combinations on the refined asset, checked actual renderer materials and settling, then reset. Both passed; solid/translucent screenshots were inspected at each size. Build and lint passed. Translucent tint was adjusted after the first screenshot showed too much saturated base-color filtering of internal detail; volume absorption now carries the chosen hue.

## Stage 3: assembly and purposeful inspection

Five aligned layers animate from a single normalized assembly value. Their poses are computed from immutable origins on every animation step, so interruptions do not accumulate drift. The assembly slider supports native keyboard controls, and Assemble restores the camera's studio view. Component buttons below the configurator describe and focus the shell, controls, screen, board and rear housing. Concept-board selection opens the device. The short opening camera move begins after the model loads and respects reduced motion.

Controls and supporting copy were enlarged, with 44px minimum primary touch targets, tactile pressed states, and layouts that wrap. Camera, assembly and configuration state remain separate. Contact shadows update at the settled assembly pose and then remain cached during camera-only movement.

Review caught and corrected four interaction details: symmetric pinch must not retain OrbitControls' old rotate state; changing the motion preference must not replay a zoom command; assembly needs a refreshed shadow; keyboard detail selection must move focus into the newly shown viewer. Regression checks cover these behaviors.

The original front/back test assumed a constant camera radius. Orientation-aware framing now changes distance to fit the object, so that assertion was replaced with the actual safety invariant: every sampled camera position remains outside the device, and the path includes intermediate angles after an idle period.

Final review also reproduced two edge cases before fixing them: Fit during a preset tween kept rotating, and an idle viewer stayed blank after WebGL context restoration. Fit now cancels the tween and clears component selection. Context restoration refreshes demand rendering and the one-shot lighting/shadow captures while preserving the build. Both fixes pass desktop and mobile regression checks, including two context-loss cycles with canvas-pixel comparison.

## Final verification — 2026-09-10

| Check | Actual result |
| --- | --- |
| TypeScript and production build | Passed; Vite 7.3.6 |
| ESLint | Passed |
| Unit tests | 87 passed: configuration/migration/serialization, framing, assembly, actual-GLB batching and resource ownership |
| Complete desktop/mobile suite | 36 passed, 4 intentional skips, 0 failures, 4.5 minutes |
| Final camera/recovery regression run | 9 passed, 1 intentional skip, 0 failures; includes 4 additional context/Fit cases |
| Visible standalone Chrome | Camera/zoom/reset check passed after correcting scaled test input; repeated assembly transition check passed |
| Production smoke | Passed; actual canvas pixels change for shell, buttons, finish, assembly, camera and zoom; Fit/reset pixel difference 0 |
| Production network/console | No failed requests, HTTP errors, console errors or page errors; development diagnostics excluded |

Across the full and final targeted runs, 40 distinct browser cases passed. Intentional skips cover mouse-only versus touch-only input and avoid duplicating the reflow matrix. All 18 combinations (3 shells × 3 buttons × 2 finishes) were exercised both assembled and exploded on desktop and mobile. Tests also cover rapid interrupted assembly changes, slider keyboard input, all component views, wheel/trackpad/pinch limits, page scrolling outside the viewer, keyboard focus, reduced motion and preference changes, reset, actual material interpolation after idle, asset/module recovery and WebGL fallback.

Desktop uses 1440 × 1000 CSS pixels. Mobile uses Pixel 7 viewport/touch emulation (412 × 839) on installed Chrome 152.0.7977.83. The reflow matrix checks 320/768/1024/1440px at normal and doubled root text size, including assembly and detail controls. Actual desktop and mobile screenshots were inspected after each stage. The embedded preview was also operated and visually inspected with independent colors, translucent rear view, explosion, component focus, Fit and reset.

A visible standalone-Chrome check exposed a test-input assumption: the requested Ctrl+wheel delta of −35 arrived as −52.5 on this Windows display and correctly hit the minimum zoom. Captured wheel events confirmed the scaling; a small −5 input arrived as −7.5 and produced zoom 0.91393 with page scale still 1. The test now uses that smaller gesture to check fractional zoom independently from the existing limit checks. No product behavior was relaxed for the test.

The final embedded-preview reload completed color/finish/button, assembly, zoom/Fit and reset operations with no new warning or error entries. Earlier hot-reload errors remain historical entries in the browser log; they were excluded by the fresh reload's timestamp rather than described as current failures.

## Performance and asset cost

The detailed candidate increased assembled draw calls from 74 to 92. Runtime batching of compatible meshes within each assembly layer reduced that to **26** (65% below milestone 1; 72% below the unbatched detailed model), with unchanged geometry. Each batch preserves material and internal-visibility boundaries; source meshes remain independently editable in Blender. The full model remains 78,616 triangles / 1,801,256 bytes; the solid assembled view renders 54,785 triangles including scene surfaces. Procedural grain brings texture count from 6 to 7. Translucency needs an additional scene pass, so its render counters exceed the unique asset geometry.

| Mode | Draw calls | Rendered triangles | Desktop median / p95 | Mobile median / p95 | Idle frames / 1 second |
| --- | ---: | ---: | ---: | ---: | ---: |
| Milestone 1, original baseline | 74 | 36,927 | 4.2 / 4.7 ms | 4.2 / 4.7 ms | 0 |
| Final solid | 26 | 54,785 | 4.2 / 5.8 ms | 4.2 / 5.5 ms | 0 |
| Final translucent | 69 | 136,570 | 4.2 / 5.1 ms | 4.2 / 5.0 ms | 0 |
| Final exploded, solid | 37 | 78,618 | 4.2 / 5.7 ms | 4.2 / 6.5 ms | 0 |

These are main-canvas frame **intervals**, not GPU execution times or guaranteed FPS. Repeated runs varied: one final solid run measured 16.4ms median / 17.6ms p95 on desktop. Rechecking the unchanged first milestone from commit `fd2e14c` in an isolated project-local cache also changed to 8.6 / 17.5ms desktop and 9.0 / 18.5ms mobile. The final paired follow-up returned to the values in the table. This host scheduling variability prevents a precise timing-speedup claim; the draw-call reduction, retained detail and zero idle frames are consistent. Physical iOS/Android GPUs, Safari and Firefox remain unverified.

Raw reports: [original desktop](screenshots/milestone-2/before-desktop.json), [original mobile](screenshots/milestone-2/before-mobile.json), [unbatched desktop](screenshots/milestone-2/pre-optimization-desktop.json), [unbatched mobile](screenshots/milestone-2/pre-optimization-mobile.json), [baseline recheck desktop](screenshots/milestone-2/baseline-recheck-desktop.json), [baseline recheck mobile](screenshots/milestone-2/baseline-recheck-mobile.json), [final desktop](screenshots/milestone-2/after-desktop.json), [final mobile](screenshots/milestone-2/after-mobile.json), [production smoke](screenshots/milestone-2/production-smoke.json).

Run `npm run test:performance` with the local preview running and no concurrent browser benchmarks. Optional `STUDIO_PROFILE_URL` and `STUDIO_PROFILE_BASELINE=1` allow the same solid-mode orbit against the original milestone. The temporary baseline server is stopped after measurement. No project dependency was added for batching or profiling.

Production JavaScript totals 1,247.78 kB minified / 355.89 kB gzip across emitted chunks. The largest Three chunk remains 708.25 kB / 182.57 kB gzip; Vite's warning remains visible. This milestone increases the model transfer from 1.04 MB to 1.80 MB for the authored hollow shells and complete internals. Further compression needs a measured benefit before adding a decoder.

## Screenshots and local delivery

- [Finished desktop](screenshots/milestone-2/final-desktop.png)
- [Assembled viewer](screenshots/milestone-2/viewer-assembled.png)
- [Exploded viewer](screenshots/milestone-2/viewer-exploded.png)
- [Finished mobile](screenshots/milestone-2/final-mobile.png)
- [Exploded desktop](screenshots/milestone-2/exploded-desktop.png)
- [Exploded mobile](screenshots/milestone-2/exploded-mobile.png)
- [Translucent rear housing](screenshots/milestone-2/material-translucent-desktop.png)
- [Built production app](screenshots/milestone-2/production-desktop.png)

Local stage commits: `f9472e4 feat: add smooth zoom and orientation-aware framing`; `9d7934e feat: refine original hardware and customizable materials`; final stage `feat: add animated assembly and component inspection` includes batching, recovery checks and this report. The studio remains available at http://127.0.0.1:5173/ through the durable local launcher. No remote creation, push, deployment, publication or GitHub authentication change was performed.
