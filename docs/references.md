# References and provenance

Reviewed on 2026-09-09 before implementation. HS–01 geometry, layout, screen graphic, and application code are original. No reference portfolio code or model was copied.

## Orbital Core Showcase — Wang Ruofeng

- [Repository](https://github.com/wangruofeng/orbital-core-showcase)
- [Editable asset](https://github.com/wangruofeng/orbital-core-showcase/blob/main/blender_test.blend)
- [GLB exporter](https://github.com/wangruofeng/orbital-core-showcase/blob/main/export_model.py)
- [Browser scene](https://github.com/wangruofeng/orbital-core-showcase/blob/main/src/main.js)
- [MIT license](https://github.com/wangruofeng/orbital-core-showcase/blob/main/LICENSE), copyright 2026 Wang Ruofeng

Lesson: retain editable Blender source and automate mesh/material export, with browser lighting separate from the asset. The reference's hardcoded output path was not adopted; ours is relative to the project. Source was inspected, but the reference's binary Blender file was not opened.

## Folio 2025 — Bruno Simon

- [Repository and license](https://github.com/brunosimon/folio-2025/blob/main/license.md), MIT, copyright 2025 Bruno Simon
- [Asset compression script](https://github.com/brunosimon/folio-2025/blob/main/scripts/compress.js)
- [Rendering](https://github.com/brunosimon/folio-2025/blob/main/sources/Game/Rendering.js)
- [Inputs](https://github.com/brunosimon/folio-2025/blob/main/sources/Game/Inputs/Inputs.js)
- [Resource loading](https://github.com/brunosimon/folio-2025/blob/main/sources/Game/ResourcesLoader.js)

Lesson: preserve original assets, automate optimized outputs, separate input/render/world concerns, and measure rendering statistics. This small configurator does not reproduce Folio's larger singleton game architecture, compression presets, world, or visual identity.

## Awesome Astra Prompts — TripoGrowthLab

- [Scroll-driven studio entry](https://github.com/TripoGrowthLab/awesome-astra-prompts#scroll-driven-3d-studio-website), credited to ui.debbie
- [Refractive product entry](https://github.com/TripoGrowthLab/awesome-astra-prompts#refractive-bottle-product-story), credited to Himanshu Hingorani
- [License](https://github.com/TripoGrowthLab/awesome-astra-prompts/blob/main/LICENSE) and [rights exclusions](https://github.com/TripoGrowthLab/awesome-astra-prompts/blob/main/RIGHTS.md)

The repository's MIT license covers its original tooling/editorial documentation, not linked third-party prompts, videos, assets, or source. These entries provide descriptions and links rather than implementation source. The descriptions informed the single-product emphasis and restrained motion. Original preview videos could not be visually inspected; no media was reused.

## Runtime and asset tools

The exact dependency tree is in `package-lock.json`; each dependency retains its package license in its distribution. Core tools include React, Three.js, React Three Fiber, Drei, Vite, TypeScript, Vitest, and Playwright. Object lettering uses Blender's bundled font converted to geometry. Interface and boot-screen type use system fonts; no external font files, textures, images, or HDRIs were downloaded.

Useful implementation references: [R3F demand rendering](https://r3f.docs.pmnd.rs/advanced/scaling-performance), [R3F installation/compatibility](https://r3f.docs.pmnd.rs/getting-started/installation), and [Vite runtime requirements](https://vite.dev/guide/). Installed package peer dependencies were checked as well: this tested Fiber release excludes React 19.3, so React is constrained to the supported 19.2 line.
