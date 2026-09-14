# Handheld Studio

Work only in this repository. Do not edit sibling projects.

## Publication identity and approval

- The only approved GitHub account and repository owner is **KareemAl1**.
- Before every authenticated GitHub action, check the active CLI account. Stop the action if it is unavailable or differs; help the user sign in with the approved account. Never select another account as a fallback.
- The intended repository is `KareemAl1/handheld-studio`, public. Vercel's selected workspace is `kareems-projects-bc520863`, project name `handheld-studio`.
- Repository creation, pushing and deployment require explicit user approval. Honor an approval already granted for the same action in the current task; do not ask repeatedly for routine steps within that scope.
- Keep credentials, local Vercel project links, dependencies, build output and caches out of Git. Keep the editable Blender source and reproducible export scripts.

## Verification

Use the committed package scripts. Builds verify third-party notices before TypeScript/Vite. Run `npm run notices:generate` and review the diff after dependency upgrades. Do not invent missing copyright notices or assign a license to the original project without the owner's choice.

Browser tests use installed Chrome. Describe mobile emulation and simulated hidden-tab boundaries accurately; do not claim physical-device results or unmeasured frame rates. Keep historical verification evidence intact when scripts regenerate artifacts.
