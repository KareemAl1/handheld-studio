# Milestone 2 — local development record

## Stage 1: camera and framing

Measured before changes on 2026-09-10 in Chrome 152.0.7977.83: 74 draw calls, 36,927 visible triangles, 6 textures, 0 frames during one second at rest. Median active frame interval 4.2ms and p95 4.7ms in both desktop and mobile emulation. These measure this host's render cadence, not GPU execution time or physical-phone performance. Raw baseline reports and screenshots are in `screenshots/milestone-2/before-*`.

Wheel/trackpad input and two-finger pinch now share a clamped, smoothly interpolated zoom ratio. Native HTML Zoom in, Zoom out and Fit controls use the same path. Fit retains orientation; presets and Reset build restore fitted zoom. Input handlers attach only to the canvas, preserving page scrolling elsewhere. No additional dependency was installed.

Framing solves the perspective projection constraints for all eight device bounds corners at the current camera angle. At Fit, this maintains a margin around the handheld as it rotates. Close zoom intentionally permits detail cropping while maintaining a minimum camera distance; Fit restores a complete view. Both rotation and zoom stop rendering at rest. Reduced motion applies zoom targets without easing.

Verification: TypeScript/build and lint passed; 26 unit tests passed, including framing across four aspect ratios and 105 angle combinations each. Five camera browser tests passed, with the desktop copy of the touch-only test intentionally skipped. Checks include wheel limits, button limits, page scrolling outside the viewer, pinch-to-rotation handoff, keyboard zoom, Fit, reset and reduced motion. Actual desktop and mobile screenshots were inspected before proceeding.
