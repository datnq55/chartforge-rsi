# ChartForge RSI — Codex Instructions

## Project identity

- This repository contains ChartForge RSI, a Chrome Extension Manifest V3 overlay for Binance Spot.
- The current product name is `ChartForge RSI`; do not call it a draft.
- Preserve the public `key` in `manifest.json`. It keeps the Extension ID stable across updates and machines.
- The extension reads public Binance market data only. Do not add account, order, or API-key access unless explicitly requested.

## Agent delegation

- The primary/root agent acts only as the coordinator and delegates all execution work to sub-agents.
- Every delegated sub-agent must use the `gpt-5.6-sol` model with `medium` reasoning effort.

## Product direction

- Match TradingView interaction patterns closely when screenshots or videos are supplied.
- Keep the interface clean, compact, white, and based on thin monochrome SVG icons.
- Treat the topbar, left drawing rail, floating drawing menu, chart panes, price scale, time scale, and bottom toolbar as reusable UI regions.
- New drawing tools should reuse the existing selection, anchor editing, dragging, floating toolbar, deletion, persistence, and Undo/Redo infrastructure.

## Chart behavior

- The price pane and RSI pane share one time scale.
- All timeframes of the same symbol share the same drawings.
- Drawing anchors are stored by time and price, not by screen coordinates.
- Trend Lines may belong to either the price pane or the RSI pane.
- Price-scale pointer events must be intercepted above the canvas and must never select, move, or edit drawings underneath.
- Time zoom must preserve the bar under the pointer as the anchor.
- Horizontal pan at the oldest loaded candle should load older Binance candles without moving the visible candle group.
- Vertical pan should move the chart proportionally to pointer movement at every price zoom level.
- Keep maximum time zoom at 1,000 visible bars unless the user requests another value.

## Timeframes and data

- Supported UI timeframes: `30m`, `H1`, `H2`, `H4`, `H8`, `H12`, `D`, `3D`, `1W`, `2W`, and `M`.
- Binance intervals map directly except `2W`, which is aggregated from `1w` candles.
- Initial loads request up to 1,000 candles.
- Older history is fetched in additional batches using the oldest raw candle's open time as `endTime`.
- Keep websocket updates deduplicated by candle `openTime`.
- Never truncate the accumulated raw history back to the newest 1,000 candles after loading older batches.

## Drawings and persistence

- Drawing collections are keyed by symbol only, not symbol plus timeframe.
- Settings and drawings use `chrome.storage.sync`, with local storage available for offline operation.
- Sync drawing shards use keys shaped like `cfrsi:d:<f|t>:<encoded-symbol>:<index>`.
- Preserve and migrate existing drawing data if the storage schema changes.
- Text should remember its latest color and font size.
- Trend Line should remember its latest color, width, and solid/dash/dot style.
- Undo/Redo history is session-only RAM state. Do not save it to local storage or Chrome Sync.
- Before create, delete, drag, anchor edit, text edit, or style changes, keep the existing history behavior intact.

## Existing drawing tools

- Fibonacci Retracement
- Long Position
- Price Range
- Date Range
- Trend Line, including Shift-lock to horizontal or vertical
- Text

## Editing rules

- Preserve unrelated user changes.
- Prefer small changes to the existing architecture over replacing the chart implementation.
- Use reusable functions and shared actions when behavior applies to multiple drawing tools.
- Avoid external production dependencies unless they are clearly necessary.
- Keep drawing hit-testing and coordinate conversion consistent with the plot width and the right price gutter.
- When changing pane padding, price-scale width, or canvas layout, update rendering, hit-testing, crosshair, pan, zoom, and drawing coordinate calculations together.
- Bump the extension version for every delivered update and update `README.md` with user-visible behavior.

## Required validation

Run these checks after modifying the extension:

```bash
node --check content.js
node --check background.js
node -e "JSON.parse(require('fs').readFileSync('manifest.json', 'utf8'))"
```

When creating a release ZIP:

- Put the extension inside a root folder named `chartforge-rsi`.
- Include `content.js`, `background.js`, `manifest.json`, `README.md`, and `icons/`.
- Run `unzip -t` against the final archive.
- Confirm the packaged manifest still contains the fixed public key and expected version.

## Starting a task

Before editing, read `AGENTS.md`, `CODEX_HANDOFF.md`, `README.md`, `manifest.json`, and the relevant functions in `content.js`. Inspect every supplied screenshot or video that affects interaction or appearance.
