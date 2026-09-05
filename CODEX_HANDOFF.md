# ChartForge RSI — Codex Handoff

## Current release

- Version: `0.4.15`
- Platform: installable static PWA
- Live URL: `https://datnq55.github.io/chartforge-rsi/`
- Main chart engine: `web/js/chart-engine.js`
- Browser adapter: `web/js/app.js`
- Local persistence: versioned IndexedDB
- Optional cloud sync: Google Auth and per-UID Firestore

## Architecture

`web/js/chart-engine.js` owns the Shadow DOM, CSS, SVG registry, Canvas rendering, chart interactions, drawings, Undo/Redo, and Bar Replay. `web/js/app.js` provides full-page/mobile layout, symbol selection, asset URLs, Binance browser-safe REST access, WebSocket title updates, touch/pinch behavior, account controls, and import/export. `web/js/storage-adapter.js` bridges engine state to IndexedDB and Firestore without changing drawing semantics.

The panel layout is ordered as fixed topbar, flexible `chart-workspace`, optional fixed replay bar, and fixed bottom toolbar. The workspace alone contains the price pane, splitter, and RSI pane. Pane sizes use complementary flex weights, so dragging the splitter cannot overflow or hide the bottom toolbar. The mobile shell follows `visualViewport` and safe-area insets so dynamic browser bars do not crop controls.

The left drawing rail keeps its actions in one compact sequence: drawing tools, separator, Undo, Redo, Trash, separator, then the live candle countdown. The countdown displays only the duration and is hidden during Replay. RSI, EMA, and WMA live values occupy the left edge of the bottom toolbar while the remaining controls stay on the right.

The bottom toolbar has a full-width one-pixel top separator matching the topbar. The price OHLC/change legend is a non-interactive DOM overlay constrained to the plot area; it stays on one line on desktop and wraps naturally on narrow mobile screens without entering the price gutter.

## Product behavior

- Symbols: `BTCUSDT`, `ETHUSDT`, `DOGEUSDT`.
- Timeframes: `30m`, `H1`, `H2`, `H4`, `H8`, `H12`, `D`, `3D`, `1W`, `2W`, `M`.
- Binance public REST/WebSocket supplies history and live candles; `2W` is aggregated from `1w`.
- Price and RSI panes share pan, zoom, crosshair, calendar ticks, and history paging.
- Time-scale labels adapt by visible pixel density: UTC year/month boundaries stay prominent, medium daily density follows calendar-aligned five-day cadence, and day/hour/minute ticks continue progressively down to one-day detail as zoom creates room.
- Dragging the time axis scales bar spacing by the ratio of the pointer's distance from the right plot edge, matching TradingView's right-edge pivot. It preserves `panBars`/future right offset, reverses from the gesture's immutable start state without drift, and is shared by mouse and touch.
- RSI is Wilder/RMA 14 with EMA 9 and WMA 45 overlays.
- Browser title follows the latest REST/WebSocket price and selected symbol.
- Topbar places market status immediately before the account control at the right edge.
- Timeframe buttons use an explicit centered flex line box so every short and long label remains optically centered on mobile and fractional-DPR displays.
- Axis-aligned canvas primitives use the real rounded backing-store scale to align candle wicks/bodies, grids, crosshairs, and scale dividers to physical pixels at integer and fractional DPR. Sloped drawing geometry remains unsnapped.

Drawing tools are Fibonacci Retracement, Long Position, Price Range, Date Range, Trend Line, and Text. They share selection, anchor editing, whole-object dragging, floating styles, delete, persistence, and session Undo/Redo. Desktop Shift locks a Trend Line anchor horizontally or vertically; touch devices have no Snap control.

The drawing-rail Trash action uses the same accessible in-app confirmation dialog as Replay exit. Cancel leaves drawings and history untouched; confirming clears the current symbol once and remains undoable.

The app identity uses one hand-authored geometric datum mark across the topbar, collapsed control, browser favicon, Apple touch icon, and installable PWA icons. Two opposing charcoal precision frames align around a restrained violet datum, with no letterform, chart motif, gradient, or decorative effect; raster install assets are deterministically rendered from `web/assets/icon.svg`.

Bar Replay supports Select Bar, Select Date, first available candle, Play/Pause, Forward, speed selection, timeframe changes, lazy future loading, and confirmed exit. Replay and Undo/Redo are RAM-only.

## Persistence and sync

- IndexedDB stores settings, drawings, sync queue, market cache, and metadata.
- Drawings are keyed by symbol and retain stable IDs, order, revisions, and tombstones.
- Portable settings and drawings sync below the authenticated user's Firestore path.
- Local writes commit first and queue idempotent remote mutations. Remote listeners resolve conflicts by revision, timestamp, then device ID.
- Market cache, Replay, Undo/Redo, drafts, and transient hover/socket state never sync.
- Do not modify Firestore rules or data shapes without migration and Emulator coverage.
- Current deployed Firestore ruleset: `2ddf9680-e7da-4114-bae6-63aa07af27fb`.

## Deployment and validation

GitHub Actions validates and publishes `web/` from `main`. Firebase Hosting is not used. Firestore Rules deploy separately only when `web/firestore.rules` changes.

```bash
npm ci
npm test
npx --yes http-server web -p 4173 -c-1
npm run smoke:pwa
```

Before handoff, also run `git diff --check` and inspect `git status --short`. Do not push or deploy unless the user asks.
