# ChartForge RSI — Codex Instructions

## Project identity

- This repository contains the ChartForge RSI Progressive Web App for Binance Spot market analysis.
- The product is `ChartForge RSI`; do not call it a draft.
- It reads public Binance market data only. Do not add account, order, or API-key access unless explicitly requested.
- The app is hosted as a static site on GitHub Pages. Firebase supplies optional Google sign-in and per-user Firestore sync.

## Agent delegation

- The primary/root agent acts only as coordinator and delegates all execution work to sub-agents.
- Every delegated sub-agent must use `gpt-5.6-sol` with `medium` reasoning effort.

## Product direction

- Match supplied TradingView interactions closely.
- Keep the interface clean, compact, white, and based on thin monochrome SVG icons.
- Treat the topbar, drawing rail, floating drawing menu, chart panes, price scale, time scale, replay bar, and bottom toolbar as reusable regions.
- Prefer small changes to the existing architecture and preserve unrelated user work.

## Chart and data invariants

- The price and RSI panes share one time scale. Their canvases render only inside the flexible chart workspace; fixed top, replay, and bottom bars must never be covered.
- Drawing anchors use time and price coordinates. All timeframes of one symbol share the same drawings.
- Price-scale input must not select drawings underneath. Time zoom preserves the bar under the pointer.
- Loading older candles must preserve the visible group and accumulated history. Maximum time zoom is 1,000 bars.
- Supported timeframes are `30m`, `H1`, `H2`, `H4`, `H8`, `H12`, `D`, `3D`, `1W`, `2W`, and `M`; `2W` aggregates Binance `1w` candles.
- Initial and paged loads request up to 1,000 candles. WebSocket updates are deduplicated by `openTime`.

## Persistence invariants

- IndexedDB is the local source of truth. Signed-in users may sync portable settings and symbol-keyed drawings through Firestore.
- Do not change the IndexedDB or Firestore schema without a migration. Preserve revisions, stable IDs, tombstones, queue retry, and per-UID isolation.
- Replay and Undo/Redo remain session-only RAM state. Market cache remains device-local.
- Text remembers color/font size; Trend Line remembers color/width/style.
- Preserve history behavior for create, delete, drag, anchor edit, text edit, and style changes.

## Drawing tools

- Fibonacci Retracement
- Long Position
- Price Range
- Date Range
- Trend Line, including desktop Shift-lock; mobile has no Snap control
- Text

## Editing and validation

- Main chart source: `web/js/chart-engine.js`.
- Browser/platform adapter: `web/js/app.js`.
- Bump the PWA version for each delivered update and document user-visible behavior.
- Before editing, read `AGENTS.md`, `CODEX_HANDOFF.md`, `README.md`, and relevant files under `web/js/`. Inspect all supplied media that affects behavior or appearance.
- Run:

```bash
node --check web/js/chart-engine.js
node --check web/js/app.js
npm run validate:pwa
npm run test:pwa
```

- Run `npm test` when Java is available for the Firestore Emulator. Run `npm run smoke:pwa` with a local server for browser-level layout/data checks.
- Never add service-account credentials or private Firebase secrets.
