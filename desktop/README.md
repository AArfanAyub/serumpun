# Serumpun desktop wrapper (optional)

This folder is **completely isolated** from the root project. Root `npm install`,
`npm run dev` and `npm run build` never reference it, and Electron is never a root
dependency. It produces a standalone Windows `.exe` for a desktop extension office.

## Run from source

```bash
# 1. From the project root, build the static web app
npm install
npm run build

# 2. From this folder, install Electron separately and launch
cd desktop
npm install
npm start
```

## Build the Windows executables

```bash
# From the project root
npm install
npm run build

cd desktop
npm install
npm run dist                       # prepare:web + electron-builder --win --x64
```

`web/` is a generated copy of `../dist/` and is gitignored. The `prepare-web.cjs`
script recreates it automatically before `start`, `dev` and `dist`, so a fresh clone
can rebuild the executables with no manual copying step.

Outputs land in `serumpun/release/`:

| File | What it is |
|---|---|
| `Serumpun-Portable.exe` | **Single file, no installation.** Double-click and it runs. Best for a USB stick or a shared office PC. |
| `Serumpun-Setup-1.0.0.exe` | Optional NSIS installer with a desktop shortcut and an uninstaller. |

Both are unsigned (no code-signing certificate is required, and none is used — no
payment or account is involved). Windows SmartScreen may show an "unknown publisher"
warning on first run; click **More info → Run anyway**, or use the portable build.

## Why there is a tiny local web server

The Vite build emits `<script type="module">`. Chromium refuses to load ES modules from a
`file://` origin (CORS, origin `null`), so simply pointing `loadFile()` at `index.html`
produces a **blank window**. `main.js` therefore serves the static build from a minimal
Node HTTP server bound to `127.0.0.1` on an OS-assigned ephemeral port, then loads
`http://127.0.0.1:<port>/index.html`.

- Loopback only, no listening on `0.0.0.0`, no external port exposed.
- No backend, no database, no account, no API key, no analytics, no telemetry.
- Path-traversal guarded; unknown paths fall back to the SPA shell.
- External data still comes only from the allowlisted keyless endpoints in
  `src/config/endpoints.ts` (all send `Access-Control-Allow-Origin: *`).
- The static build is bundled inside the executable in `web/`, so the app works fully
  offline from bundled sample data even with no internet at all.

`preload.js` is intentionally empty. The window uses `contextIsolation: true`,
`nodeIntegration: false`, `sandbox: true` and `webSecurity: true`. External links are
handed to the user's default browser rather than opened inside the app window.

## Files

| File | Purpose |
|---|---|
| `main.js` | Electron main process + loopback static server |
| `preload.js` | Empty on purpose (no Node APIs exposed to the page) |
| `web/` | Generated copy of the root `dist/` static build, bundled into the `.exe` (gitignored) |
| `prepare-web.cjs` | Recreates `web/` from `../dist/` before every desktop build |
| `icon.ico` | Windows application icon (generated from `public/icons/icon-512.png`) |
| `package.json` | Own dependencies + electron-builder config |
| `../release/` | Build artifacts (portable exe + installer) |

The web PWA remains the primary platform: it runs on cheap Android phones, needs no
install and no store account. This wrapper is a convenience for desktop users.
