# Milestone 3 — play, keep, share and export

## Stage 1: Signal Run

Signal Run is an original three-lane collect-and-dodge game drawn into the handheld's actual screen material. A pure deterministic game reducer owns movement, entities, scoring and collisions. A fixed 60-step simulation publishes canvas changes at up to 30 updates per second; React subscribes only to score, phase and lane changes. Paused, ready and finished sessions stop updating. Reduced motion removes decorative lane motion, and the visibility handler pauses rather than advancing through a hidden-tab time gap.

Play assembles the hardware and frames its screen, then enables Start after the camera settles. Orbit and zoom input are disabled during play. Native arrow buttons support touch; Left/Right or A/D move, Enter starts, and Escape exits. Exit restores the original boot material and returns focus to Play. No geometry or Blender source change is required for a new screen texture.

Initial verification: build and lint passed. Four desktop/mobile browser cases passed for actual screen updates, score, game over, restart, movement/dodging, pause/resume, camera locking, reduced-motion framing and exit. Desktop and mobile ready/running screenshots were inspected. Seventeen engine and nine session tests passed. Session tests found and fixed floating-point accumulator drift at an exact tick boundary; equivalent elapsed time now gives the same result across frame delivery rates.

Further persistence/export and final regression results follow in this record. No authenticated GitHub action, publication, push or deployment is part of this milestone.
