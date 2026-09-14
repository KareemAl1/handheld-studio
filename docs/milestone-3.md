# Milestone 3 — play, keep, share and export

## Stage 1: Signal Run

Signal Run is an original three-lane collect-and-dodge game drawn into the handheld's actual screen material. A pure deterministic game reducer owns movement, entities, scoring and collisions. A fixed 60-step-per-second simulation schedules canvas updates at most 30 times per second; input and phase changes repaint immediately. React subscribes only to score, phase and lane changes. Paused, ready and finished sessions stop updating. Reduced motion removes decorative lane motion, and the visibility handler pauses rather than advancing through a hidden-tab time gap.

Play assembles the hardware and frames its screen, then enables Start after the camera settles. Orbit and zoom input are disabled during play. Native arrow buttons support touch; Left/Right or A/D move, Enter starts, and Escape exits. Exit restores the original boot material and returns focus to Play. No geometry or Blender source change is required for a new screen texture.

Initial verification: build and lint passed. Four desktop/mobile browser cases passed for actual screen updates, score, game over, restart, movement/dodging, pause/resume, camera locking, reduced-motion framing and exit. Desktop and mobile ready/running screenshots were inspected. Seventeen engine and nine session tests passed. Session tests found and fixed floating-point accumulator drift at an exact tick boundary; equivalent elapsed time now gives the same result across frame delivery rates.

The following stages complete this local milestone. No authenticated GitHub action, publication, push or deployment was performed.

## Stage 2: saved builds and share links

Save stores one validated schema-v2 build under an application-specific localStorage key. A normal reload restores it. An explicit shared URL takes precedence without reading or overwriting storage; Save or Restore clears an older shared query so it cannot unexpectedly override that explicit action on the next reload. Camera, assembly and game state are not part of a saved configuration.

Copy share link creates a canonical versioned URL preserving shell, finish and buttons. Invalid/duplicate/missing/unknown URL fields fall back to saved/default data with a message. Clipboard denial exposes a selected readonly link; the interface explicitly explains that localhost links only work locally until deployment. Storage resolution itself is guarded because even accessing localStorage can throw.

Forty-nine persistence unit tests and all 22 desktop/mobile persistence/share browser cases passed. They cover explicit save/change/restore/reload, URL round-trips, saved/shared precedence, stale query clearing, unavailable getters, quota errors, corrupt JSON, empty storage and denied clipboard access. Build and lint passed after correcting a test-only TypeScript cast. Opening a link never silently saves it.

## Stage 3: clean product images

Export PNG produces an opaque 1600 × 1200 image of the configured, assembled device and original boot screen. A separate scene clone shares imported geometry and lighting textures but owns its materials, render targets and boot/shadow textures. Export restores all live renderer state before encoding, so an exploded view or running game stays intact. A fallback Download PNG link remains available after generation.

Visual inspection caught a gray background caused by applying ACES tone mapping to the intended ivory clear color. Export now tone-maps linear product pixels and composites them onto exact `#f1eee7`. The transparent coverage and separate transmission backdrop preserve soft shadows, antialiased edges and tinted plastic. The actual Chalk solid, Ember solid/translucent, Graphite translucent and production PNGs were inspected.

Ten export browser cases passed across desktop and mobile: actual download/filename, decoded pixels, exact background, fully opaque alpha, clear 30px edge margins, visible color/material differences, identical assembled output from exploded inspection, repeated resource cleanup, paused and active gameplay preservation, and disabled capture without WebGL. After a warm-up export, three additional translucent exports left both contexts at **50 geometries, 8 textures and 14 shader programs**. These are renderer counters, not a byte-level GPU memory measurement.

## Final verification — 2026-09-14

| Check | Actual result |
| --- | --- |
| TypeScript and Vite production build | Passed; Vite 7.3.6, 613 modules |
| ESLint | Passed |
| Unit tests | **162 passed** across 7 files: configuration 79, persistence 49, game engine 17, game session 9, assembly 2, framing 2, real-asset batching 4 |
| Full desktop/mobile browser regression | **79 passed, 5 intentional skips, 0 failures**, 7.0 minutes |
| Focused final game/layout/export run after the viewport fix and added cases | **20 passed, 2 intentional skips, 0 failures**, 1.7 minutes |
| Unique browser cases covered by those final runs | **82 passed**, 6 intentional context/matrix skips; the focused run overlaps the full run |
| Built production flow | Passed in Chrome 152.0.7977.83 in 12.0 seconds; no page/console errors, failed requests or HTTP errors |
| Embedded preview | Manually completed Start, score 10, game over, restart and Exit; fresh console had no errors/warnings |
| Desktop/mobile screenshots | Inspected final configurator, game, and exported product images |

The six intentional skips avoid running mouse-only checks on touch, touch-only checks on desktop, and three viewport/text matrices twice. They are not unresolved failures. The complete suite retains earlier wheel/pinch limits, all 18 customization combinations, interrupted assembly, reset, keyboard operation, model/module failure recovery and repeated WebGL context-restoration checks.

The final layout checks cover 320, 768, 1024 and 1440px widths at normal and 200% root text size. Inspection also found that starting Play from controls below the fold could leave the top of the screen outside the embedded viewport. Play now scrolls after the new layout is committed and fits its height to the viewport. Added checks confirm the complete canvas and movement buttons remain visible after Start at 722 × 894, 900 × 600 and 412 × 839. An earlier 320px/doubled-text failure was fixed by removing padding from the arrow buttons.

The production test initially compared screenshots while the canvas was resizing between inspection and Play. Its stability sampler now treats a size change as an unsettled sample. The final production run verified real screen-pixel changes, collection/game over/restart, saved reload, URL precedence over a deliberately different saved build, and a decoded PNG. Restored and shared configurations matched the reference canvas with **0 differing pixels** under that test's 18/255 comparison threshold. Development diagnostics were absent. See [the production record](screenshots/milestone-3/production-smoke.json).

## Measured runtime behavior

The isolated profile ran after other browser tests finished, using installed Chrome headless on this Windows host. These count canvas texture changes and completed main-viewer callbacks; they are **not GPU timings or a guaranteed display frame rate**.

| Measurement | Desktop 1440 × 1000, DPR 1 | Pixel 7 emulation 412 × 839, DPR 1.75 |
| --- | --- | --- |
| Running sample duration | 2.0028 seconds | 2.0030 seconds |
| Texture updates / viewer frames | 56 / 56 | 55 / 55 |
| Observed texture update cadence | 28.0 updates/second | 27.5 updates/second |
| Paused one-second sample | 0 frames, 0 texture updates, 0 simulation advance | 0 frames, 0 texture updates, 0 simulation advance |
| Exited one-second sample | 0 frames | 0 frames |
| Before Play → running → after Exit textures | 7 → 8 → 7 | 7 → 8 → 7 |
| Geometry / program change after Exit | 0 / 0 | 0 / 0 |

The assembled inspection still uses **26 draw calls and 54,785 rendered triangles**, matching the previous milestone's batching result. Play uses 26 calls on desktop and 25 in the narrower mobile screen framing because of culling. No model geometry, Blender source or dependency change was needed. The GLB remains 1,801,256 bytes. Scene memoization prevents HUD changes from recapturing static lighting; the measured game adds one temporary texture, released on exit. Raw results: [game profile](screenshots/milestone-3/game-performance.json), [desktop repeated-export counters](screenshots/milestone-3/export-memory-desktop.json), [mobile repeated-export counters](screenshots/milestone-3/export-memory-mobile.json).

The final build's Three chunk is 709.79 kB minified / 183.03 kB gzip. Vite's generic 500 kB warning remains visible. The scene chunk is 31.91 kB / 12.47 kB gzip; the HTML interface loads separately. No unmeasured frame-rate claim or blanket performance guarantee is made.

## Reproduce and review

Run `npm run preview:start`, then `npm run lint`, `npm test`, `npm run test:e2e`, `npm run build`, and `npm run test:production`. In the restricted execution environment the unit run used `npm test -- --configLoader runner`. Run `npm run test:performance:game` separately after other browser work finishes. Reports and downloads from the current scripts stay inside this project. Earlier screenshot paths overwritten by the full regression were restored to keep historical reports intact.

- [Final desktop](screenshots/milestone-3/final-desktop.png) and [final mobile](screenshots/milestone-3/final-mobile.png)
- [Running game on desktop](screenshots/milestone-3/game-running-desktop.png) and [mobile](screenshots/milestone-3/game-running-mobile.png)
- [Solid Chalk PNG](screenshots/milestone-3/export-chalk-solid-desktop.png), [tinted Ember PNG](screenshots/milestone-3/export-ember-translucent-desktop.png), and [production PNG with Ivory buttons](screenshots/milestone-3/production-export.png)

Local milestone commits: `56265c8` adds Signal Run; `03de220` adds saved builds and validated share links; the final export/verification commit completes this report. No remote was created or configured, and GitHub authentication was not changed.

## Remaining limits

- Mobile input/layout tests use Chrome emulation, not a physical phone or Safari.
- Automated Chrome reported background pages as visible on this host. The hidden-tab test simulates `document.hidden` and dispatches `visibilitychange` to exercise the real application listener, then verifies no hidden progress or automatic resume. Native tab hiding still needs a manual check in target browsers.
- Clipboard success is checked through an instrumented API, with denial tested separately. PNG tests use actual browser downloads and decode the resulting files.
- Save keeps one build per browser origin. Localhost links work only locally until an approved deployment. Game progress, camera and assembly are intentionally not serialized.
- PNG requires WebGL2 and a float color-buffer extension; unsupported capture produces feedback. It uses a fixed assembled studio view and boot display, including when exported during Play.
- The development preview must be restarted after a reboot with `npm run preview:start`. This session restarted the stopped preview and reloaded the stale embedded tab; the refreshed app rendered successfully.
