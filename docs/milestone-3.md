# Milestone 3 — play, keep, share and export

## Stage 1: Signal Run

Signal Run is an original three-lane collect-and-dodge game drawn into the handheld's actual screen material. A pure deterministic game reducer owns movement, entities, scoring and collisions. A fixed 60-step simulation publishes canvas changes at up to 30 updates per second; React subscribes only to score, phase and lane changes. Paused, ready and finished sessions stop updating. Reduced motion removes decorative lane motion, and the visibility handler pauses rather than advancing through a hidden-tab time gap.

Play assembles the hardware and frames its screen, then enables Start after the camera settles. Orbit and zoom input are disabled during play. Native arrow buttons support touch; Left/Right or A/D move, Enter starts, and Escape exits. Exit restores the original boot material and returns focus to Play. No geometry or Blender source change is required for a new screen texture.

Initial verification: build and lint passed. Four desktop/mobile browser cases passed for actual screen updates, score, game over, restart, movement/dodging, pause/resume, camera locking, reduced-motion framing and exit. Desktop and mobile ready/running screenshots were inspected. Seventeen engine and nine session tests passed. Session tests found and fixed floating-point accumulator drift at an exact tick boundary; equivalent elapsed time now gives the same result across frame delivery rates.

Further persistence/export and final regression results follow in this record. No authenticated GitHub action, publication, push or deployment is part of this milestone.

## Stage 2: saved builds and share links

Save stores one validated schema-v2 build under an application-specific localStorage key. A normal reload restores it. An explicit shared URL takes precedence without reading or overwriting storage; Save or Restore clears an older shared query so it cannot unexpectedly override that explicit action on the next reload. Camera, assembly and game state are not part of a saved configuration.

Copy share link creates a canonical versioned URL preserving shell, finish and buttons. Invalid/duplicate/missing/unknown URL fields fall back to saved/default data with a message. Clipboard denial exposes a selected readonly link; the interface explicitly explains that localhost links only work locally until deployment. Storage resolution itself is guarded because even accessing localStorage can throw.

Forty-nine persistence unit tests and all 22 desktop/mobile persistence/share browser cases passed. They cover explicit save/change/restore/reload, URL round-trips, saved/shared precedence, stale query clearing, unavailable getters, quota errors, corrupt JSON, empty storage and denied clipboard access. Build and lint passed after correcting a test-only TypeScript cast. Opening a link never silently saves it.
