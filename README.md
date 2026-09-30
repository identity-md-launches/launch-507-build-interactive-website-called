# AI Dream Machine

A quiet, interactive dream world that forms from simulated thoughts. Start the machine and watch luminous contours, floating words, recurring structures, and unexpected connections emerge. Everything runs locally in the browser; no AI service, API key, wallet, or backend is required.

## Use the dream

- **Start dreaming** begins the simulation. **Pause dream** freezes the world, time, new events, and ambient sound. Resume continues the same session.
- **Dream intensity** changes particle density, size, and glow. **Ethereal**, **Lucid**, and **Cosmic** change color and geometry.
- Add a word or idea in **Your thought**. Repeated concepts grow structures; emotional words influence the atmosphere. The next-thought button generates an immediate event.
- Sound is optional and initially off. The camera saves the current canvas as PNG; fullscreen includes pause/resume and next-thought controls.
- With a reduced-motion preference, the world stays still and thoughts advance manually. Hidden tabs suspend animation and audio. Sessions are temporary and reset on reload.

The simulation generates a thought every 5–8 active seconds. It retains 18 recent events and at most 64 remembered concepts, and displays the latest three thoughts. It is a procedural simulation, not a connection to a live language model.

## Install and develop

Use Node.js **22.12 or newer** and npm. From the repository root:

```sh
npm ci
npm run dev
```

Open the URL printed by Vite. The source is TypeScript, native HTML/CSS, and Canvas 2D. The small DOM and procedural renderer do not need a component framework.

## Rebuild and preview

```sh
npm run typecheck
npm run build
npm run preview
```

`dist/index.html`, `dist/favicon.svg`, and `dist/assets/` are the complete production site. Serve them over HTTP; directly opening an HTML file is not the supported module-loading path. The font and all runtime assets are local. There are no remote runtime requests.

## Publish

Publish the **contents of `dist/`**, preserving `assets/` and its filenames. The export is included alongside the source and lockfile so a static publisher does not need to rebuild it. Vite's `base: './'` produces relative URLs, suitable for a gateway subpath or an ENS-hosted static directory. There are no server routes or rewrite rules. Rebuild and replace the whole export after changing source; avoid mixing old and new hashed assets.

Keep source, `package.json`, `package-lock.json`, `vite.config.ts`, `tsconfig.json`, documentation, and the complete `dist/` in the submission. Dependency directories, package archives, caches, and `test/scratch/` are not deliverables. No ignore file or Git metadata was changed for this assignment.

## Validate

```sh
npm run test:model
npx playwright install chromium
npm run test:browser
python3 scripts/check-delivery.py
```

The browser script starts its own temporary HTTP server, serves the actual export under `/preview/`, checks interactions/layout/accessibility, saves evidence in `artifacts/`, and closes its server/browser. It includes a 65-second unattended run. Tests require a completed `npm run build`. The model test compiles into disposable `test/scratch/model/`.

The assignment environment had Node outside PATH, and the supplied browser tool lacked `/opt/google/chrome/chrome`. Worker checks used an isolated npm toolchain in disposable scratch space and an existing local Chromium runtime. The actual setup/check commands were:

```sh
# Node's bin directory was added to PATH:
export PATH=/home/debian/.nvm/versions/node/v24.21.0/bin:$PATH

# Copy package.json into test/scratch/toolchain first; dependencies remain disposable.
npm install --prefix test/scratch/toolchain --cache /tmp/ai-dream-machine-npm-cache --no-audit --no-fund
# Its generated lockfile was copied to the repository root.
export PATH="$PWD/test/scratch/toolchain/node_modules/.bin:$PATH"
npm run typecheck
npm run build
npm run test:model

DREAM_TOOLCHAIN="$PWD/test/scratch/toolchain" \
DREAM_BROWSER=/tmp/identitymd-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell \
FONTCONFIG_FILE="$PWD/test/scratch/fonts.conf" \
LD_LIBRARY_PATH=/tmp/identitymd-browser-libs/usr/lib/x86_64-linux-gnu \
npm run test:browser
```

Those absolute runtime paths are specific to the worker. Normal installations use `npm ci`, `npx playwright install chromium`, and the scripts without environment overrides. The temporary fontconfig file pointed to available system fonts; it is not a runtime asset of the website.

**Final worker results (2026-09-30):** typecheck and production build passed; 3,006-event model test passed; all 25 browser checks passed, including a 65-second unattended run. Both axe scans report zero automated violations with canvas-contrast manual-review items documented. The complete production export is 68,239 bytes.

Actual outcomes, repaired failures, six-domain Better Interface coverage, screenshots, and limitations are recorded in [artifacts/validation.md](artifacts/validation.md). Machine-readable browser results are in [artifacts/interaction-results.json](artifacts/interaction-results.json). Passing these checks is worker evidence, not independent certification.

## Source and design

- `index.html`: semantic page, controls, explanation dialog.
- `src/main.ts`: state, input, timing, sound, fullscreen, PNG export.
- `src/dream.ts`: bounded event model and procedural renderer.
- `src/style.css`: tokens, type, controls, layout, motion preferences.
- `scripts/`: reproducible model and browser checks.
- [DESIGN.md](DESIGN.md): implemented design system and responsive behavior.
- [artifacts/NOTICE.md](artifacts/NOTICE.md): design-guidance and local-font attribution.

Known validation limits include screen-reader use, audible sound quality, Safari/Firefox, physical mobile devices, native 200% browser zoom, long-duration device performance, and every possible generated contrast combination. The automatic simulation can be paused at any time.
