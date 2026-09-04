# ChartForge RSI — Codex Handoff

## Current release

- Version: `3.7.0`
- Platform: Chrome Extension, Manifest V3
- Target page: Binance Spot trade pages
- Main implementation: `content.js`
- Background action handler: `background.js`
- Extension metadata: `manifest.json`
- Product documentation: `README.md`

## Current architecture

The extension injects a fixed Shadow DOM panel containing:

1. A topbar containing timeframe buttons.
2. A price-candle pane with a solid white price scale rendered above drawings.
3. A draggable splitter.
4. An RSI pane sharing the price pane's time scale.
5. A bottom toolbar for chart controls.
6. A full-height drawing toolbar on the left.
7. A reusable floating menu for the selected drawing.

Both canvases use the same `zoomBars` and `panBars`. Drawings are stored with time/price anchors and are rendered into either the price pane or RSI pane.

## Implemented chart behavior

- Binance OHLC candles with realtime websocket updates.
- RSI 14 using Wilder/RMA behavior.
- EMA 9 and WMA 45 overlays on RSI.
- Shared crosshair and time scale.
- Price hover label and OHLC information.
- Horizontal pan and pointer-anchored time zoom.
- Vertical price pan enabled by default.
- Drag-to-zoom price scale with its own DOM hitbox above the canvas.
- Maximum visible zoom of 1,000 bars.
- Resizable, draggable, collapsible, and fullscreen panel.
- Calendar-aware time labels for daily, weekly, biweekly, and monthly views.

## Timeframes

The topbar currently provides:

`30m`, `H1`, `H2`, `H4`, `H8`, `H12`, `D`, `3D`, `1W`, `2W`, `M`

`2W` is generated from Binance `1w` candles. Small timeframes load the newest 1,000 candles first. When the viewport reaches the oldest loaded area, `maybeLoadOlder()` requests an older batch with `endTime`, prepends it to `state.raw`, rebuilds indicators, and preserves the visible time range.

## Implemented drawing tools

### Fibonacci Retracement

- Levels: 0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.
- Gray styling except for the pink 0.5 region.
- Two editable anchors.

### Long Position

- Entry, target, and stop anchors.
- Green target region and red stop region.
- Price guides and labels while selected.
- Labels and anchors hidden when not selected.

### Price Range

- Preserves A-to-B direction.
- Positive/up or negative/down measurement and centered directional arrow.
- Measurement text remains visible when not selected; anchors are hidden.

### Trend Line

- Works on both price and RSI panes.
- Shift locks the second point horizontally or vertically.
- Adjustable color, line width, and solid/dash/dot style.

### Text

- Inline textarea editor.
- Enter saves, Shift+Enter inserts a line break, Escape cancels.
- Clicking away saves and closes the active editor.
- Double-clicking an existing text drawing reopens it for editing.
- Adjustable color and font size.

All tools support selection, dragging, editable anchors, deletion, Undo/Redo, and the shared floating drawing menu where applicable.

## Persistence model

- All timeframes share drawings for the same symbol.
- Full local copies live in `chrome.storage.local`.
- Settings and drawings are synchronized through `chrome.storage.sync`.
- Drawing sync uses per-item keys: `cfrsi:d:<f|t>:<encoded-symbol>:<index>`.
- The fixed manifest public key must remain unchanged so installations keep the same Extension ID.
- Tool defaults for Text and Trend Line are persisted.
- Undo/Redo stacks are limited to 100 steps and remain only in memory for the current session.

## Version 3.7.0 changes

- Added the `30m` timeframe.
- Moved timeframe buttons from the bottom toolbar into a dedicated topbar.
- Added paginated historical loading when panning to the oldest loaded candles.
- Added an independent price-scale interaction layer so price zoom cannot drag drawings underneath.
- Enlarged and redrew the left drawing-tool icons to match the supplied TradingView references more closely.
- Added consistent hover feedback to bottom-toolbar buttons.

## Important invariants

- Do not remove or regenerate the manifest public key.
- Do not key drawings by timeframe.
- Do not persist Undo/Redo history.
- Do not allow price-scale, toolbar, splitter, dialog border, or floating-menu pointer events to leak into drawing canvases.
- Keep the right price scale opaque and visually above chart drawings.
- Keep price labels fully inside the right gutter at every device-pixel ratio.
- When adding historical candles, do not shift the candle group currently visible to the user.

## Suggested first prompt in VS Code

```text
Read AGENTS.md, CODEX_HANDOFF.md, README.md, and manifest.json first.
Inspect the relevant code in content.js before making changes.
Continue developing ChartForge RSI from version 3.7.0.
Preserve the manifest key, symbol-level shared drawings, Chrome Sync schema,
and session-only Undo/Redo behavior. Inspect any supplied screenshots or videos
before implementing UI or interaction changes.
```

