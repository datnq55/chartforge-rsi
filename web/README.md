# ChartForge RSI PWA 0.4.1

This directory is a dependency-free static PWA. Its chart UI and behavior are not an independent rewrite: `js/canonical-content.js` is generated directly from the unchanged extension `content.js`. The PWA adapter changes only the platform boundary: fixed symbol selection, IndexedDB/Firebase, full-page/mobile layout, asset URLs, Binance's browser-safe public endpoint and touch controls.

## Local preview

Serve this directory over HTTP; do not open `index.html` using `file://`:

```bash
npx --yes http-server web -p 4173 -c-1
```

Open `http://localhost:4173/?symbol=BTCUSDT`. Available symbols are defined once in `js/config.js`.

## GitHub Pages

`.github/workflows/pages.yml` validates and uploads this directory as the Pages artifact. Relative manifest, module and service-worker paths make the deployed app available at `https://datnq55.github.io/chartforge-rsi/`.

## Firebase sync

The real public Web config for Firebase project `chartforge-rsi` lives in `firebase-config.js`. This metadata is intentionally trackable; it is not a private key. Never add a service-account JSON or Admin SDK secret to this static app.

The app works without signing in and always commits mutations to IndexedDB first. Google sign-in enables per-UID Firestore sync. Popup auth is preferred because it works from a direct tap in mobile Safari/installed PWAs; blocked/unsupported popups fall back to redirect handling.

Synced data:

- settings: last symbol, timeframe, visible bars, price/RSI pane ratio, price shift/scale, crosshair mode and Trend/Text drawing defaults;
- drawings: complete symbol-level objects and deletion tombstones.

Never synced: Binance market cache, Replay state/timers, Undo/Redo history. Offline mutations stay queued and flush on reconnect. Conflict order is `revision`, then client `updatedAt`, then stable `deviceId`; Firestore server timestamps are retained for audit.

The first Google account claims the existing anonymous local data. If a different Google account is later selected on the same browser profile, synchronized local settings/drawings and its pending queue are cleared before the new UID subscribes; the previous account's cloud copy is not exposed or uploaded across UIDs.

Before sign-in can work in production, verify these items in Firebase Console:

1. Authentication → Sign-in method → enable **Google**.
2. Firestore Database → create a database (production mode is fine because this repository supplies rules).
3. Authentication → Settings → Authorized domains → add `datnq55.github.io`, `localhost`, and `127.0.0.1` if absent. New Firebase projects may not add localhost automatically.
4. The PWA 0.4.1 `firestore.rules` compiled and was deployed to project `chartforge-rsi` on 2026-09-05. After a future rules change, deploy it with `npx firebase-tools deploy --only firestore:rules --project chartforge-rsi` from the repository root. Deployment is intentionally not automated by the Pages workflow.

Stay on Spark; do not enable billing, Cloud Functions, account/order APIs or Firebase Hosting.

## Canonical engine boundary

The extension renderer, complete Shadow DOM regions, CSS, SVG registry, chart scales/ticks/labels, RSI bands, all six drawings and Bar Replay are copied into the generated PWA engine without simplification. `npm test` regenerates that file and fails if it differs from `content.js` after the one generated-file banner. The old independent `js/chart.js` renderer has been removed.

`js/storage-adapter.js` translates the canonical symbol-keyed drawing maps to the existing per-ID IndexedDB/Firestore model. It preserves stable IDs, revisions, array order and tombstones, migrates the old `priceRange` name to canonical `range`, and rejects Replay, Undo/Redo, market rows, drafts and other session-only state. A real Google account sign-in and cross-device cloud-sync acceptance check still requires an interactive user session.

Mobile uses direct touch gestures without a synthetic Shift/Snap control. Pinch cancels any pending one-finger chart pan before zooming and keeps its initial midpoint as the zoom anchor. Desktop physical-Shift behavior remains entirely canonical.
