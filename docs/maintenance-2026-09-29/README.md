# Handheld Studio maintenance verification — 2026-09-29

The existing shipped interactions passed this bounded local review. No source, dependency, geometry, or visual changes were justified. Sona publication remains the priority. This report adds fresh evidence without replacing any historical screenshots or measurements.

Verified source: `dd4ef2c` on the local `improvement/portfolio-polish` branch. No authenticated GitHub action, push, deployment, or profile edit was performed.

## Actual results

| Check | Result |
| --- | --- |
| Existing production build | Passed: third-party notices check, TypeScript, Vite 7.3.6 |
| Notices | Current: 67 packages, 59 distinct texts, 128,485 bytes |
| Existing ESLint check | Passed |
| Existing unit suite | 162 passed across seven files |
| Focused existing Playwright regressions | 10 passed, no failures or skips, 40.9 seconds; two additional desktop failure-recovery cases passed in 5.0 seconds |
| Supplemental Chrome browser review | Two contexts passed; desktop 1440 × 1000 and phone emulation 412 × 839 |
| Additional layout review | 320 × 1000 and 768 × 1000 at 100% page scale; 27 controls per width remained within their panels, with no page overflow |
| Page scale | Fresh browser contexts; `visualViewport.scale === 1`, viewport width matched the requested CSS width |
| Supplemental browser errors | Zero page exceptions, console errors, failed requests, or HTTP error responses |
| Local preview | Existing durable launcher, loopback `http://127.0.0.1:5173/`; page, scene module, GLB and poster returned 200 |

Installed Chrome **154.0.8037.58** ran headless. Phone results use viewport and touch emulation on this Windows PC, not a physical phone. The browser checks used the development preview; the production build passed separately. No new Safari, Firefox, physical-device or production-deployment verification is claimed.

## Interactions checked

The ten existing regression cases covered save/change/restore/reload for all three configuration choices; a versioned share-link round trip with localhost disclosure; clipboard-denial fallback; keyboard and touch movement, pause/resume and reduced-motion framing; and visibility loss with no background simulation or automatic resume. Hidden-tab tests **simulate the browser visibility boundary** because automated Chrome may report background targets as visible. Clipboard success is mocked in the existing regression; the denial path exercises the selectable fallback URL.

The supplemental browser review verified rendered Graphite/Ivory/translucent material state, Front/Back presets, Zoom in/Fit, Explode/Assemble, mouse orbit on desktop and emulated touch orbit on phone. Entering Play locked drag/wheel camera input. Enter started the game, the actual screen reached score 10, the movement button changed lanes, and Pause stopped the session. Resume advanced from the paused time; Escape returned focus to Play. Reset restored Chalk/Charcoal/Solid.

Each context downloaded a real `hs-01-graphite-translucent-ivory.png` during paused gameplay. Decoding confirmed **1600 × 1200**, fully opaque alpha, and an ivory corner pixel of **RGB 241, 238, 231**. The normal boot screen appeared in the exported image, while the live camera and paused game state remained unchanged. The fallback Download PNG link was available.

Raw supplemental results: [browser-verification.json](browser-verification.json).

Two additional existing desktop cases verified failure recovery: simulated unavailable WebGL displayed a decoded fallback poster while configuration controls worked; an aborted GLB request recovered through Retry without losing the chosen Ember shell. These are deliberate failures, separate from the error-free normal browser flows.

The 320px and 768px checks measured bounds for all 27 controls in the configurator, viewer toolbar, assembly panel, detail choices and save/share/export buttons. Ember selection, keyboard Enter on Save, Explode, and Play were exercised. The complete game canvas, Start/Exit controls and movement buttons fit the viewport; Start, Move right and Escape completed successfully. Both contexts recorded zero console errors or page exceptions. Raw layout results: [layout-verification.json](layout-verification.json).

## Visual inspection

Actual browser screenshots were opened and inspected after capture. At 100% page scale, desktop and phone layouts retained the existing hierarchy, complete controls, clear selected states, and no horizontal page overflow. The exploded geometry, paused game and exported PNGs rendered correctly. No cosmetic adjustment was needed for this maintenance scope.

- Opening: [desktop](desktop-opening.png), [phone](phone-opening.png).
- Complete layout: [desktop](desktop-full.png), [phone](phone-full.png).
- Exploded view: [desktop](desktop-exploded.png), [phone](phone-exploded.png).
- Paused game: [desktop](desktop-paused-game.png), [phone](phone-paused-game.png).
- Actual PNG export: [desktop](desktop-export.png), [phone](phone-export.png).
- Narrow 320px: [opening](layout-320-opening.png), [complete page](layout-320-full.png), [game controls](layout-320-game-ready.png).
- Tablet 768px: [opening](layout-768-opening.png), [complete page](layout-768-full.png), [game controls](layout-768-game-ready.png).

The additional narrow and tablet screenshots were also inspected. The 320px toolbar wraps into separate zoom and camera rows; save/share and component buttons wrap their text while staying within the page. The tablet composition gives the object a full-width viewer and groups the configuration controls below it. These are expected responsive arrangements, with no layout repair needed.

## Bundle finding

The fresh build still emits the existing Vite warning for chunks exceeding 500 kB. The Three chunk is **709,793 bytes minified / 183,025 bytes local gzip**. All emitted JavaScript totals **1,272,597 / 364,620 bytes**. These are file-size and local compression measurements, not observed HTTP transfer sizes or runtime performance scores. The measurements match the pre-review build; no size improvement is claimed.

The HTML control interface and heavier 3D scene already load separately. Changing chunk boundaries just to hide the warning would not establish a transfer or runtime benefit, so no optional bundle refactor was made. No frame-rate benchmark ran during this session. Details: [bundle-measurement.json](bundle-measurement.json).

## Interview recap

- **State:** React owns the validated product configuration and visible controls; Three owns presentation. The deterministic game uses a fixed-step external store so texture updates do not require the whole React interface to rerender.
- **Persistence:** One schema-v2 build is saved explicitly per browser origin. Valid shared URLs take precedence without overwriting the saved build; explicit Save/Restore clears stale share parameters. Storage and clipboard failures return actionable feedback.
- **Input ownership:** Inspection owns orbit and zoom. Entering Play assembles the object, fits the screen and disables camera input while the game owns movement keys and buttons. Hidden-tab visibility pauses the session; explicit Resume starts a fresh frame clock. Escape restores focus to Play.
- **Tradeoff:** Original editable geometry, independent assembly layers and a real game require a sizeable 3D runtime. Demand rendering and separate UI/scene loading already address idle work and initial controls. The measured Three chunk warning remains visible rather than being hidden through unmeasured splitting.

## Bounded follow-up list

1. Check a physical iOS/Safari and Android device: actual tab hiding, touch/pinch, screen framing, and PNG support. Record exact device/browser details; retain the existing user-reported Safari feedback separately.
2. Profile loading and interaction on a representative phone before considering model compression or further chunk changes. Require a measured benefit and preserve editable source, visual quality and failure recovery.

## Repeating the bounded checks

Run from the repository with its existing dependencies:

```powershell
npm.cmd run build
npm.cmd run lint
npm.cmd run test
npm.cmd run preview:start
npm.cmd run test:e2e -- tests/milestone3-game.spec.ts tests/milestone3-config.spec.ts --grep "keyboard and touch|visibility loss|save, change, restore and reload|copied text is a versioned|clipboard denial" --reporter=list --output .cache/maintenance-browser-results
npm.cmd run test:e2e -- tests/customization.spec.ts --grep "unavailable WebGL|failed model load" --project desktop --reporter=list --output .cache/maintenance-failure-results
npm.cmd run preview:status
```

Those selected browser cases do not regenerate the historical `docs/screenshots` evidence. The omitted production-verification scripts hardcode port 4173, which Sona uses, and overwrite old screenshot directories; they were deliberately not run. Handheld's durable development preview remains on 5173. Preserve this dated report and its images when recording future runs.
