# Local preview repair — 2026-09-10

## Cause and evidence

The local Vite server was no longer running. At diagnosis, port 5173 had no listener, the prior command session no longer existed, and requests to the page, scene module, model, and fallback image all failed with connection refused. The embedded tab also showed `ERR_CONNECTION_REFUSED`.

This explains the reported viewer-module failure and broken fallback image: both need the same local server before any WebGL rendering can begin. The GLB and WebP were present at their correct paths. The available evidence does not establish why the earlier process exited; there is no evidence of an embedded-browser-specific rendering defect.

## Fix

- Added `npm run preview:start`, `preview:status`, and `preview:stop`. The launcher starts a hidden, detached Node/Vite process with file-backed logs, independent of the launching terminal. It uses only this project and loopback port 5173.
- Fixed the development port with `strictPort`, preventing a silent move to another port. A development-only health endpoint identifies the process. Preflight checks verify status, content type, and file signatures for the page, scene, GLB, and poster.
- Stop checks the saved PID and a per-launch identity before stopping a process. A timeout retains ownership state unless the process is confirmed absent. Existing foreground previews are identified as unmanaged.
- Preserved the original viewer error object and cause in the console for future diagnosis.
- The stricter Chrome check found an unrelated `/favicon.ico` 404. Added an original SVG favicon matching the page's existing brand mark.

No model or poster path workaround was required. No tool installation, account change, authenticated GitHub action, push, or publishing was performed.

## Actual verification

| Check | Result |
| --- | --- |
| Embedded preview, manual interaction and screenshot inspection | Actual 3D rendering; Chalk, Graphite, Ember, drag rotation, Front, Back, Studio, and Reset build verified; no console warnings/errors after restoration |
| Standalone installed Chrome 152.0.7977.83, **headed** | 8 targeted browser tests passed, 0 failed, approximately 31 seconds |
| Desktop / mobile browser contexts | 1440 × 1000 and Pixel 7 emulation at 412 × 839 CSS pixels; mobile is emulation, not a physical phone |
| Scene module, GLB, and fallback poster | HTTP 200; browser decoded the poster at 1400 × 1000 |
| Active canvas WebGL context | WebGL 2.0, context not lost in both Chrome contexts |
| Complete Chrome interaction flow | All three shells, drag rotation, Back, Front, Studio, Reset build; camera coordinates and rendered pixel changes asserted |
| Actual shell rendering | Graphite and Ember changed about 25.9% of desktop canvas pixels and 19.1% of mobile-emulation pixels versus Chalk; reset restored Chalk within the existing edge tolerance |
| Browser errors during normal flow | 0 console errors, 0 page exceptions, 0 failed requests, 0 HTTP error responses |
| Failure recovery | Simulated unavailable WebGL displays a decoded poster; aborted GLB load retries successfully; aborted scene-module load displays a decoded poster and reloads successfully |
| TypeScript / production build / lint | Passed; existing large Three.js chunk warning remains |
| Configuration unit tests | 24 passed |
| Built application smoke test | Passed in installed Chrome; rendering, shell change, camera, reset, and exclusion of development diagnostics |

The managed preview remained healthy after its launcher returned and after browser-test processes exited. A repeated start reused the same managed PID. The stop/start commands were also exercised locally, followed by an independent health check.

Reviewed screenshots: [desktop](screenshots/repaired-desktop.png), [mobile](screenshots/repaired-mobile.png). Recorded network/WebGL/interaction results: [desktop JSON](screenshots/repaired-desktop.json), [mobile JSON](screenshots/repaired-mobile.json).

This repair run targeted loading and the requested complete interaction flow. The earlier full milestone suite and performance measurements remain documented separately in [verification.md](verification.md).
