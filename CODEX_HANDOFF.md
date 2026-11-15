# Handoff to Codex

## What it is

Form is a minimalist local editor of animated materials for logos. Vanilla JavaScript, Vite 8.3.5, @paper-design/shaders 0.0.82, Mediabunny 1.65.0. The current working version was packaged on November 2, 2026.

## Entry points

- index.html — interface markup.
- style.css — dark interface, compact panel without scrolling on desktop.
- main.js — image loading, separate material and preset settings, controls, Paper ShaderMount rendering, export.
- frosted-glass.js — the active glass mode: light refraction through a smoothed shape field, soft bevels, color blending and atmosphere. This is an artistic shader approximation, not 3D ray tracing.
- loop-export.js — periodic shader versions and frame-by-frame WebM export via WebCodecs / Mediabunny. The encoding library is loaded only on export.
- public/ — local font and licenses.
- examples/ — small SVGs for manual testing.
- dist/ — a ready build of the current sources.

## Agreed behavior

- Dark theme only.
- The default is Heatmap, Spectrum, with these values: speed 1.5, scale .65, innerGlow .41, outerGlow .49, contour .46, angle 306.
- Values and selected presets are independent for the three materials within a session.
- For Glass, Motion 0 stops the movement; Motion 1.5 in the preview corresponds to triple the earlier speed.
- The outline of the uploaded logo is preserved: do not round N into a capsule, do not bring back the experimental 3D reconstruction.
- The glass has no chips, cracks or thin glowing outer outline; a wide pale inner edge is kept.
- Light sources are distorted inside the glass; outside there is a faint atmosphere, with no distinct direct ring.
- The user adjusts each material color separately.
- There is no global shape deformation: the corresponding slider was removed on request.
- 2K and 4K are the real canvas resolution; PNG and video use it.
- WebM must be seamless: 6 seconds, 180 frames at 30 fps. In loopShader all time components must stay periodic; this must not be replaced by an ordinary six-second screen recording.

## Checks after changes

```sh
npm ci
npm run build
npm run dev
```

Check loading of SVG/PNG, switching all materials, colors, Motion 0 and the maximum, absence of scrolling at 1280×720 / 1366×768 / 1504×939, PNG and WebM. If you change the motion or a shader, compare phases 0 and 2π and the transition from the last frame to the first in the decoded video. The phases previously matched within 1/255; the ready videos were checked: 180 frames and exactly 6 seconds.

No secrets, API keys, external models, accounts or source reference videos are needed. The default logo is generated in main.js. All required resources are inside the package, except the npm dependencies that are installed separately.

## Example task

"Read README.md and CODEX_HANDOFF.md, install dependencies with npm ci, run the project. Change [task description], keep the seamless export and the original logo silhouette."
