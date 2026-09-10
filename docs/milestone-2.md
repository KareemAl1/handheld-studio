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
