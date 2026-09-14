# Deployment and live verification

Published with the owner's explicit approval on **2026-09-14**.

- **Website:** [handheld-studio.vercel.app](https://handheld-studio.vercel.app)
- **Public repository:** [KareemAl1/handheld-studio](https://github.com/KareemAl1/handheld-studio)
- **Vercel workspace / project:** `kareems-projects-bc520863` / `handheld-studio`
- **Production branch:** `main`, connected through Vercel's GitHub integration.

GitHub's active CLI account was checked before authenticated GitHub actions and matched **KareemAl1**. Vercel identified the account as `kareemal1`, with access to the selected workspace. No authentication settings, existing projects, commit authors or timestamps were changed.

## Deployment configuration

The project uses Vite, Node 22.x, `npm ci`, `npm run build` and output directory `dist`. The same framework and Node version are set on the Vercel project. There are no required environment variables, functions or backend services. The deployment builds and serves the original model at `/models/hs-01.glb`; configuration links use query parameters on `/`.

The initial production build completed successfully on Vercel: dependency notices, TypeScript and Vite all passed, with 613 modules transformed. The Three.js chunk warning remains visible at **709.79 kB minified / 183.03 kB gzip**. No bundle size or frame-rate improvement is claimed for publication.

Automatic deployment was verified after pushing commit [`74abad3`](https://github.com/KareemAl1/handheld-studio/commit/74abad3ca7d2eafc0d3798301a6c81c9796e79b3): Vercel reported source `git`, branch `main`, target `production`, status `READY`, Node `22.x`, framework `vite`, and the `handheld-studio.vercel.app` alias. This confirms the GitHub connection actually builds and publishes a push.

All **11 served build files** then returned HTTP 200 and matched the verified local production build byte-for-byte by SHA-256, including the page, JavaScript, model, poster and notices.

Only this project's new repository and Vercel project were created. The editable Blender source remains in Git; dependencies, build output, local caches and the local `.vercel/` link remain ignored. [The preparation audit](publication.md) records the file, secret-pattern and license review.

## Live HTTPS verification

Run with `HS_LIVE_URL=https://handheld-studio.vercel.app` using [scripts/verify-live.mjs](../scripts/verify-live.mjs) (`npm run test:live`). This is a live-site smoke check using isolated, project-local profiles in installed **Chrome 152.0.7977.83**. It does not deploy, change accounts or use development diagnostics.

The run at **2026-09-14 18:11 UTC** passed both **desktop (1440 × 1000)** and **Pixel 7 emulation** in **39.660 seconds total**.

| Check | Actual result in both contexts |
| --- | --- |
| Public document, JavaScript and original GLB | HTTP 200 on first load; model rendered, no sign-in needed |
| All three shell colors | Changed actual canvas pixels; Graphite and Ember each changed more than 16% of desktop and 20% of mobile pixels compared with Chalk |
| Signal Run on the actual device screen | Start, collect to score 10, game over, restart, left/right controls, pause/resume and Exit passed |
| Play from exploded view | Device assembled; Exit left assembly at 0% |
| Input | Desktop Enter/arrows/D and mobile touch buttons exercised |
| Save and restore | Save, reload and explicit Restore retained Ember / Translucent / Ivory with feedback |
| Public share URL | Native clipboard write **and read** passed with granted permissions, without API mocks |
| URL round-trip | Preserved all three choices without overwriting a different saved build |
| Invalid URLs | Duplicate shell fields and unsupported version safely restored the saved default with feedback |
| Rendered persistence | Reload and shared views had **0 changed pixels** under the settled-canvas comparison's 18-level RGB threshold |
| PNG download | Both decoded to **1600 × 1200**, **997,385 bytes**, fully opaque, background RGB **241, 238, 231**, with clear 30-pixel edges |
| Errors and overflow | **0** page errors, console errors, failed requests and HTTP errors; no horizontal overflow |

The exported PNG and desktop/mobile configurator and game captures were visually inspected. Device materials, screen content, controls and export margins were intact. The live device was also visually inspected in the embedded browser.

- [Machine-readable results](screenshots/live/verification.json)
- [Desktop studio](screenshots/live/site-desktop.png) · [Desktop game](screenshots/live/game-desktop.png)
- [Mobile studio](screenshots/live/site-mobile.png) · [Mobile game](screenshots/live/game-mobile.png)
- [Actual exported PNG](screenshots/live/export-desktop.png)

The identical mobile export is regenerated locally and ignored rather than committed twice. Earlier milestone screenshots and measurement records remain intact. ESLint and dependency-notice checks also passed after adding the live verifier.

## Remaining limits

- Mobile evidence is Chrome viewport/touch emulation, not a physical phone or Safari. The live smoke check is focused; it does not repeat the entire 18-combination regression matrix.
- Reduced motion was enabled for deterministic settled-pixel comparisons. This check does not measure GPU time or frame rate.
- Live tests exercised pause/resume but did not verify native background-tab visibility. The earlier automated suite simulates the visibility boundary and invokes the actual pause listener; a native target-browser check remains outstanding.
- Native clipboard success was verified with permissions granted inside isolated Chrome profiles. Denied-access handling was covered locally; other browsers may require a permission prompt or the selectable-link fallback.
- PNG export needs WebGL2 and float color-buffer support. It intentionally exports an assembled studio view with the idle display, even during Play.
- Saved configurations stay in the current browser origin. Localhost saves do not automatically transfer to the deployed site.
- No project-wide license has been selected for the original work. Dependency notices are included separately.
