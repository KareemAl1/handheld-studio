# Handheld Studio

An original interactive handheld design by Kareem Alwan. React, TypeScript, Vite, React Three Fiber, and an editable Blender asset.

## Local development

Node 22.12+ and npm are required. Run `npm ci`, then `npm run preview:start`. Open [the local studio](http://127.0.0.1:5173).

The launcher keeps Vite running independently of the launching terminal, checks the scene/model/poster URLs, and reuses a healthy preview. `npm run preview:status` checks it again; `npm run preview:stop` stops only the process recorded by this launcher. Logs and process state stay in ignored `.cache/`. After a reboot, run `npm run preview:start` again. For foreground development with terminal output, `npm run dev` remains available; keep that terminal running.

`npm run build`, `npm run lint`, `npm test`, and `npm run test:e2e` provide the verification commands. Browser tests use installed Google Chrome; no bundled browser download is required. After building, `npm run test:production` starts a temporary preview on port 4173, checks the built game/save/share/export flows in Chrome, and stops that temporary server. `npm run test:performance:game` records game texture updates, viewer frames, idle activity and resource counts. The earlier `npm run test:performance` measures orbit/assembly scenarios and writes to the milestone-2 report directory. Run performance scripts without other browser benchmarks in parallel.

## Ownership

Intended GitHub owner: **KareemAl1**. Before any authenticated GitHub action, verify the active account is KareemAl1. Stop that action if it differs and help switch accounts. Never use the retired kareemcalor account. Remote creation, pushing, and deployment require Kareem's explicit approval.

No remote has been created or configured.

## Current local milestone

Inspect the original HS–01 with drag rotation, smooth wheel/trackpad or pinch zoom, and accessible Zoom/Fit/preset controls. Choose three shell colors, three independent button colors, and solid or tinted translucent plastic. Separate five modeled layers with Explode or the Assembly slider, then select component detail views. Reset restores the entire build, assembly, orientation and zoom. Reduced motion and loading/WebGL recovery are supported.

Play **Signal Run**, an original collect-and-dodge game rendered on the device's actual screen. Play assembles the device, frames the screen and locks the camera. Use Left/Right or A/D, or the touch arrow buttons. Enter starts; Space pauses/resumes when the viewer has focus; Escape or Exit Play returns to inspection. A hidden tab pauses the game and requires an explicit resume. Reduced motion removes decorative scrolling.

Save one build locally, restore it, or copy a validated versioned link containing shell, finish and button choices. A shared URL takes precedence over a saved build without overwriting it. Clipboard/storage failures have visible fallbacks. Localhost links only work locally until deployment.

Export a 1600 × 1200 PNG with an assembled device, idle boot screen, clean framing and warm ivory background. Export preserves the interactive camera, assembly and game. A Download PNG link remains available if the automatic download is blocked. Internals are an original illustrative hardware concept.

## Editable assets

Blender 5.2.1 was used. Run `npm run asset:build`, then `npm run asset:export`. The build step regenerates the source from code; export alone preserves manual edits made in Blender. Set `BLENDER_BIN` if Blender is not discoverable. To render the optional Blender poster, use `python scripts/run_blender.py export --poster`.

Keep `assets/source/hs-01.blend`, both authoring/export scripts, and the exported GLB in Git. Dependency folders, build output, caches, reports, Blender backup files, and environment secrets are ignored.

## Design and verification

- [Design direction](docs/design.md)
- [Engineering decisions and interview notes](docs/engineering.md)
- [Reference review and provenance](docs/references.md)
- [Measured verification results](docs/verification.md)
- [Current milestone: game, saves, sharing and PNG verification](docs/milestone-3.md)
- [Previous milestone: camera, material and assembly measurements](docs/milestone-2.md)
- [Preview repair and Chrome verification](docs/preview-repair.md)
- [Current desktop](docs/screenshots/milestone-3/final-desktop.png)
- [Current mobile](docs/screenshots/milestone-3/final-mobile.png)
- [Playable screen](docs/screenshots/milestone-3/game-running-desktop.png)
- [Exported product PNG](docs/screenshots/milestone-3/export-ember-translucent-desktop.png)
- [Exploded assembly](docs/screenshots/milestone-2/exploded-desktop.png)

Tests use the local Vite development server on port 5173, starting it automatically if needed. Performance diagnostics exist only in development. Mobile tests emulate viewport and touch input in installed Chrome; they are not physical-phone measurements.
