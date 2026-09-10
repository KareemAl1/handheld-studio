# Handheld Studio

An original interactive handheld design by Kareem Alwan. React, TypeScript, Vite, React Three Fiber, and an editable Blender asset.

## Local development

Node 22.12+ and npm are required. Run `npm ci`, then `npm run preview:start`. Open [the local studio](http://127.0.0.1:5173).

The launcher keeps Vite running independently of the launching terminal, checks the scene/model/poster URLs, and reuses a healthy preview. `npm run preview:status` checks it again; `npm run preview:stop` stops only the process recorded by this launcher. Logs and process state stay in ignored `.cache/`. After a reboot, run `npm run preview:start` again. For foreground development with terminal output, `npm run dev` remains available; keep that terminal running.

`npm run build`, `npm run lint`, `npm test`, and `npm run test:e2e` provide the verification commands. Browser tests use installed Google Chrome; no bundled browser download is required. After building, `npm run test:production` starts a temporary preview on port 4173, checks the built app in Chrome, and stops that temporary server. `npm run test:performance` records solid, translucent and exploded render cadence and idle activity against the local preview; run it without other browser benchmarks in parallel.

## Ownership

Intended GitHub owner: **KareemAl1**. Before any authenticated GitHub action, verify the active account is KareemAl1. Stop that action if it differs and help switch accounts. Never use the retired kareemcalor account. Remote creation, pushing, and deployment require Kareem's explicit approval.

No remote has been created or configured.

## Current local milestone

Inspect the original HS–01 with drag rotation, smooth wheel/trackpad or pinch zoom, and accessible Zoom/Fit/preset controls. Choose three shell colors, three independent button colors, and solid or tinted translucent plastic. Separate five modeled layers with Explode or the Assembly slider, then select component detail views. Reset restores the entire build, assembly, orientation and zoom. Reduced motion and loading/WebGL recovery are supported.

The screen currently shows an original boot graphic. A tiny game, local saves, URL sharing, and image export are future milestones. Internals are an original illustrative hardware concept.

## Editable assets

Blender 5.2.1 was used. Run `npm run asset:build`, then `npm run asset:export`. The build step regenerates the source from code; export alone preserves manual edits made in Blender. Set `BLENDER_BIN` if Blender is not discoverable. To render the optional Blender poster, use `python scripts/run_blender.py export --poster`.

Keep `assets/source/hs-01.blend`, both authoring/export scripts, and the exported GLB in Git. Dependency folders, build output, caches, reports, Blender backup files, and environment secrets are ignored.

## Design and verification

- [Design direction](docs/design.md)
- [Engineering decisions and interview notes](docs/engineering.md)
- [Reference review and provenance](docs/references.md)
- [Measured verification results](docs/verification.md)
- [Current milestone stages and measured comparison](docs/milestone-2.md)
- [Preview repair and Chrome verification](docs/preview-repair.md)
- [Current desktop](docs/screenshots/milestone-2/final-desktop.png)
- [Current mobile](docs/screenshots/milestone-2/final-mobile.png)
- [Exploded assembly](docs/screenshots/milestone-2/exploded-desktop.png)

Tests use the local Vite development server on port 5173, starting it automatically if needed. Performance diagnostics exist only in development. Mobile tests emulate viewport and touch input in installed Chrome; they are not physical-phone measurements.
