# AI Dream Machine — implemented design

## Overview

A contemplative, single-page generative-art experience. A still, nearly empty dreamspace and one filled Start action introduce the experience. Fine linework, near-black surfaces, and muted violet controls leave most attention to the evolving canvas. The simulation is explicitly identified as local and autonomous.

Vite, TypeScript, native HTML controls, Canvas 2D, and CSS comprise the stack. There is no component framework. Markup/patterns live in `index.html` and `src/style.css`; behavior in `src/main.ts`; procedural art in `src/dream.ts`.

## Colors

`src/style.css:1` defines the canonical UI tokens. Hex neutral/violet primitives feed semantic roles; components should reuse semantic roles.

| Token | Value | Role |
| --- | --- | --- |
| `--color-bg` | `#0c0c10` | Page |
| `--color-surface` | `#111116` | Toolbar, field, dialog |
| `--color-hover` | `#18171e` | Neutral hover/secondary action |
| `--color-border` | `#23212c` | Section boundaries |
| `--color-control-border` | `#35313f` | Control boundaries |
| `--color-text` | `#f1eef6` | Main text |
| `--color-text-secondary` | `#b9b5c3` | Supporting text |
| `--color-text-muted` | `#96929f` | Metadata |
| `--color-accent` | `#7452c4` | Primary action |
| `--color-accent-hover` | `#8060d5` | Primary hover |
| `--color-on-accent` | `#ffffff` | Primary action text |
| `--color-focus` | `#c4acff` | Focus perimeter |
| `--color-status` | `#abd2bf` | Active dot, with a text label |

The canvas base is `#08080e`. Procedural HSLA artwork uses hue triplets in `palettes` (`src/dream.ts`): Ethereal `[270,310,230]`, Lucid `[155,43,180]`, Cosmic `[220,180,280]`. Emotion modifies hue. These are artistic parameters, not status colors. Styles change the artwork, not the page theme; no light theme is implemented.

Measured primary-button contrast: **5.61:1** normal, **4.61:1** hover (`artifacts/contrast-results.json`). Generated-frame text contrast has separate sampled evidence; a single frame does not establish every possible frame.

## Typography

- Local variable **Manrope**, normal style, weights 200–800, in `src/manrope-latin.woff2`; `font-display: swap`. Fallbacks: Segoe UI, Arial, sans-serif. License: `artifacts/Manrope-OFL.txt`.
- Body/UI base `.875rem` (14px), line-height 1.6. Tokens: `--text-caption` `.75rem`, `--text-small` `.8125rem`, `--text-heading` `1rem`.
- Brand 17px/600; page heading responsive 22–34px/400, line-height 1.25, negative tracking. The intentionally prominent canvas empty-state display is 30–49px/300, line-height 1.2.
- Section headings 13px/500. Controls and thought text principally 12–13px/400 or 600. Supplementary metadata is 10–11px; atmospheric overlines 9–11px with positive tracking.
- Final refinements at the end of `src/style.css` override earlier sizes: control labels/style options/input label 12px; seed description/thought items 12px; footer/hint/count/sound label 11px. At ≤46rem style labels are 11px and editable input 16px. At ≤23rem style labels are 10px and the primary button 12px.
- Timers/counts use SFMono-Regular, Consolas, Liberation Mono, monospace with tabular numbers. Headings balance wrapping; descriptions use pretty wrapping; thought text uses `overflow-wrap: anywhere`. Native input values scroll within the field. Useful text remains selectable.

## Layout

`.app-shell` caps width at 1600px with fluid 20–72px inline padding. Header, intro, canvas/toolbar, secondary panels, and footer share alignment edges. The secondary panels use two columns and a 64px gap. Controls remain in normal flow.

Spacing primitives are 4, 8, 12, 16, 24, 32, 40px (`--space-*`); component declarations also use explicit optical values. Toolbar padding is 23px × 24px with 20–48px group gaps.

Desktop canvas height is `clamp(360px, calc(100svh - 360px), 560px)` to keep the transport visible in short desktop windows. Canvas geometry may overlap artistically; its text equivalent lives in the normal-flow thought stream.

| Breakpoint | Adaptation |
| --- | --- |
| Above 70rem | Single-row toolbar |
| ≤70rem | Styles move to a second row; secondary-panel gap becomes 35px |
| ≤46rem | 20px margins; 450px canvas; toolbar splits into transport/sound, intensity, styles; secondary panels and footer stack; input text 16px; redundant intro copy and simulation badge hidden |
| ≤23rem | 14px margins; shorter brand treatment; compact style swatches; transport spacing reduced and primary label kept on one line |

Inspected widths: 1440, 1280, 768, 390, 320px. Native 200% browser zoom, physical-device safe areas, RTL, and translated strings are not certified. English is the implemented locale.

## Elevation & Depth

The canvas and toolbar form a bordered surface, with upper/lower corner radii of 12px. Borders separate controls; a restrained shadow highlights the primary action. Projected dust, layered contours, fog, a vignette, and a soft lower-edge caption shade create the artwork's depth.

The canvas sits in an isolated stage; captions and controls use z-index 2. The native dialog occupies the top layer with a blurred dark backdrop and `0 24px 100px #0008` shadow. The skip link uses z-index 20.

## Shapes

Controls have 6px radii; the thought field 7px; styles 5px with 3px swatches; dialog 16px. Orbital branding and status dots are circular. Inline SVG icons use a consistent 1.5px stroke and `currentColor`; play/pause are filled.

## Components

These are DOM/CSS patterns, not exported framework components.

| Pattern / source hook | Behavior and states |
| --- | --- |
| `.dream-stage`, `DreamRenderer` | Idle, running, paused, manual reduced-motion, fullscreen. Canvas description and visible thought stream. Image saving disabled before Start. |
| `.primary-button`, `#toggle-dream`, `#next-thought` | Start → Pause ↔ Resume. Visible labels; immediate next-thought action. Pause freezes time, events, drawing, input, and audio. Fullscreen has its own transport. |
| `.intensity-control` | Native range, 10–100%, default 50%; changes density, size, glow. Live output/`aria-valuetext`; native keyboard keys. |
| `.style-control`, `.style-option` | Native radio group: Ethereal/Lucid/Cosmic. Selection has fill, border, and checked state. Native arrow-key navigation. |
| `.thought-stream`, `addThought()` | Empty guidance, then three latest timestamped thoughts. Safe `textContent` insertion. Automatic thoughts do not flood a live region. |
| `.thought-field`, `#thought-form` | Persistent label, 120-character limit, Enter/button submit. Disabled with explanation before Start/while paused. Empty submit shows an inline error, focuses input, and announces recovery guidance. |
| `#sound-toggle`, `syncSound()` | Opt-in synthesized ambient tones. Visible on/off state and `aria-pressed`; pause/hidden page suspends sound. |
| `#about-dialog` | Native modal: close, Escape, backdrop dismissal, Tab wrap, inert background, focus return. |
| `:focus-visible`, media queries | 2px perimeter, 5px offset; system Highlight in forced colors. 150ms UI transitions and .96 press scale only without reduced-motion preference. Reduced motion keeps art still and event generation manual. |

Rendering requires no network/loading state. Without Canvas 2D, the thought stream can still run and saving remains disabled. Sound/fullscreen failures are announced. Reloading starts a new temporary session.

## Do’s and Don’ts

- Reuse `.app-shell`, semantic tokens, native controls, and normal-flow content. Stack narrow layouts.
- Keep one filled primary action per normal view. Use neutral secondary buttons.
- Preserve the quiet initial state, explicit Start, and fullscreen pause route.
- Keep art in `dream.ts` and state transitions in `main.ts`; do not replace the simulation with a static image.
- Give important state a text equivalent; artwork color/motion is supplementary.
- Keep assets local and URLs relative. Do not add a key or service requirement.
- For a related informational surface, reuse typography and `.secondary-button`, cap prose width, preserve a keyboard route back to the dream, and test 320px before export.

Review used the pinned Better Interface guide by Jakub Krehel (MIT, commit `267330e1adfc66a718fb65fa6918c1f06d0a689e`). Document organization adapts Impeccable guidance by Paul Bakaus (Apache-2.0, commit `9d715cc4f5564a990ca8345abfdd5df6dc9b41c8`). Attribution/license texts: `artifacts/NOTICE.md`, `artifacts/design-guidance-LICENSE.txt`.
