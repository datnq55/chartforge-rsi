# ChartForge RSI PWA 0.3.0

This directory is a dependency-free static PWA. It is the first migration phase and does not replace or mutate the Chrome extension.

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

- settings: last symbol, timeframe, visible bars, price/RSI pane ratio, Trend/Text drawing defaults;
- drawings: complete symbol-level objects and deletion tombstones.

Never synced: Binance market cache, Replay state/timers, Undo/Redo history. Offline mutations stay queued and flush on reconnect. Conflict order is `revision`, then client `updatedAt`, then stable `deviceId`; Firestore server timestamps are retained for audit.

The first Google account claims the existing anonymous local data. If a different Google account is later selected on the same browser profile, synchronized local settings/drawings and its pending queue are cleared before the new UID subscribes; the previous account's cloud copy is not exposed or uploaded across UIDs.

Before sign-in can work in production, verify these items in Firebase Console:

1. Authentication → Sign-in method → enable **Google**.
2. Firestore Database → create a database (production mode is fine because this repository supplies rules).
3. Authentication → Settings → Authorized domains → add `datnq55.github.io`, `localhost`, and `127.0.0.1` if absent. New Firebase projects may not add localhost automatically.
4. `firestore.rules` was compiled and deployed to project `chartforge-rsi` on 2026-09-05. After any future rules change, review it and run `npx firebase-tools deploy --only firestore:rules --project chartforge-rsi` from the repository root. Deployment is intentionally not automated by the Pages workflow.

Stay on Spark; do not enable billing, Cloud Functions, account/order APIs or Firebase Hosting.

## Current parity boundary

The market chart, all configured timeframes, indicators, local persistence, touch pan/pinch and the six extension drawing types are functional. Drawings can be selected, moved, anchor-edited, styled where applicable, deleted, undone/redone and restored by symbol. Price-scale pointer anchoring and Bar Replay's repeated Select Bar, date/first-date selection, animation, speed, forward loading and timeframe timestamp preservation are implemented. Firebase Google Auth, Firestore and authorized domains are configured and the repository rules are deployed; a real account sign-in and two-device cloud-sync acceptance test remain manual user checks.
