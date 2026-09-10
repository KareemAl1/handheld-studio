# First milestone verification

This is the historical first-milestone report. See [milestone-2.md](milestone-2.md) for the current camera, material, assembly and performance results.

Verified locally on **2026-09-10**. No remote repository, push, deployment, or authenticated GitHub action was performed during implementation. The preview is served on `http://127.0.0.1:5173/` while its local development process is running.

The subsequent local-server failure, durable preview launcher, and fresh embedded/standalone Chrome checks are documented in [preview-repair.md](preview-repair.md). Use `npm run preview:start` to keep the preview independent of a temporary terminal session.

## Results

| Check | Actual result |
| --- | --- |
| TypeScript + production build | Passed with Vite 7.3.6 |
| ESLint | Passed |
| Configuration unit tests | 24 passed |
| Playwright browser suite | 21 passed, 3 intentional skips, 0 failures; final run about 1.5 minutes |
| Production-browser smoke test | Passed; shell change, camera control, reset, module loading, no development diagnostics, no page errors |
| Production dependency audit | 0 reported vulnerabilities via `npm audit --omit=dev` |
| Blender source/export | Both scripts succeeded with Blender 5.2.1; repeat GLB export byte-identical |
| Optional WebMCP | Actual browser registry exposed the shell action; valid Graphite input changed the visible selection, invalid input was rejected without changing it |

The three skips avoid running the mouse-specific test in the touch project, the touch-specific test in the desktop project, and the responsive matrix twice. They are not unresolved failures.

## Browser coverage

Installed **Chrome 152.0.7977.83** was used for automated desktop and touch-enabled mobile tests. The in-app browser was also inspected and operated manually.

- Desktop: 1440 × 1000 CSS pixels.
- Mobile: Pixel 7 emulation, 412 × 839 CSS pixels, emulated touch input.
- Reflow matrix: 320, 768, 1024, and 1440px widths, each at normal and 200% root text size. Each control's complete bounds were checked against its panel, in addition to checking page overflow.
- Pointer orbit and actual emulated touch drag change the camera and settle. Page scrolling remains available outside the canvas.
- Tab, Enter, Space, and radio-group arrow keys operate the visible controls, with focus indication checked.
- Front-to-back transitions are sampled during motion after an idle period; the camera radius remains outside the device.
- Reduced-motion presets apply immediately and the viewer remains idle afterward.
- WebGL unavailability shows the labeled poster with working configuration controls.
- GLB load failure recovers through Retry while preserving the selected shell. Scene-module failure recovers through Reload page.
- Shell selection changes actual canvas pixels after idle. Reset restores the original appearance within a small decoded-pixel tolerance for fractional mobile DPR edge rasterization.

The first run caught a byte-identical mobile image comparison that was too strict. It was replaced with decoded-pixel comparison: a real shell change must alter more than 8% of canvas pixels, while reset allows under 1.2% to differ by more than 18/255 in a color channel. The camera-path review also found and fixed a path through the device and an idle-clock jump; explicit regression coverage now guards both.

## Inspected screenshots

- [Final production desktop](screenshots/production-desktop.png)
- [Desktop Chalk](screenshots/desktop-chalk.png)
- [Mobile Ember](screenshots/mobile-ember.png)
- [Rear hardware](screenshots/desktop-back.png)
- [320px with doubled text](screenshots/narrow-200-percent-text.png)

Actual browser screenshots informed camera distance, studio angle, rear illumination, text contrast, and mobile spacing. All screenshots above were visually inspected. The enlarged-text layout is intentionally allowed to grow and wrap.

## Measured assets and build

| Asset | Bytes |
| --- | ---: |
| Editable Blender source | 429,725 |
| Complete GLB, including retained internals | 1,037,508 |
| GLB compressed with local gzip measurement | 226,682 |
| WebGL fallback poster | 27,142 |

The export contains 114 mesh objects, 51,647 triangles, and 15 materials. The GLB gzip value is a local compression measurement, not a claim that the development server delivered compressed HTTP bytes.

Production JavaScript totals approximately 1.23 MB minified / 349 kB gzip across the emitted chunks. The largest chunk is Three.js: 704.46 kB minified / 181.58 kB gzip. Vite's generic large-chunk warning remains visible. The React interface is a separate chunk from the heavier 3D code; no external font, HDRI, texture, or analytics request is needed.

## Measured rendering

| Measurement | Desktop | Mobile emulation |
| --- | ---: | ---: |
| Pixel ratio | 1.0 | 1.75 |
| Draw calls at recorded inspection pose | 74 | 74 |
| Triangles at recorded inspection pose | 36,927 | 36,927 |
| Textures | 6 | 6 |
| Active frame-interval samples | 649 | 639 |
| Median active frame interval | 4.2 ms | 4.2 ms |
| 95th-percentile active frame interval | 4.5 ms | 4.5 ms |
| Frames rendered during one second at rest | 0 | 0 |

Raw observations: [desktop](screenshots/desktop-performance.json), [mobile](screenshots/mobile-performance.json), and [production smoke](screenshots/production-smoke.json).

These are **render cadence intervals in development on this Windows host's headless Chrome**, measured during a repeatable scripted orbit. They are not GPU execution timings, guaranteed frame rates, production performance scores, or physical-phone results. Mobile emulation uses the same host graphics system. Physical iOS/Android performance, Safari, and Firefox remain unverified.

## Tooling note

Node 22.12.0 and npm 10.9.0 were already installed. React is locked to 19.2.8 with Fiber 9.7.0 because that Fiber version excludes React 19.3. ESLint 9.36 and typescript-eslint 8.44 were pinned to avoid a transitive requirement for Node 22.13. npm marks this ESLint release as out of support; updating Node and the lint toolchain is a separate future maintenance choice, not a system change made here.
