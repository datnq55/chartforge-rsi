# ChartForge RSI — Codex Handoff

## Current release

- Version: `3.10.8`
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

### Date Range

- Measures bar count, elapsed time, and summed Binance base-asset volume between two time/price anchors.
- Uses an orange measurement region, a directional blue arrow, and a two-line blue result label like the supplied TradingView reference.
- Selected/draft drawings show blue endpoint date/time labels on the shared time scale.
- Stored as a symbol-level `toolDrawings` item and uses the shared create/select/anchor-edit/drag/delete/persistence/Undo/Redo path.

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

## Version 3.8.0 changes

- Added a TradingView-style Bar Replay entry point and bottom replay control bar.
- Added starting-point selection by chart bar, exact date/time, or the first Binance candle available for the current symbol and timeframe.
- Added Play/Pause, one-bar Forward, adjustable 0.25x–10x speed, and exit-to-realtime controls.
- Replay keeps one timestamp when switching among the supported chart timeframes and fetches a fresh data window for the selected interval.
- Historical replay windows are requested directly with Binance `startTime`/`endTime`, allowing dates such as 2023 without sequentially loading every newer candle first.
- Replay state and timers remain session-only and do not alter the drawing sync schema or Undo/Redo persistence behavior.

## Version 3.8.1 changes

- Select Bar remains the default replay mode and includes the clicked candle as the final visible candle.
- The chart preserves the clicked candle's screen position, then eases it into the replay position instead of jumping immediately.
- Enlarged the topbar and replay controls, placed Replay directly after the timeframe group with a separator, added menu icons, and removed the selector chevron.
- The replay mode menu closes on outside click, and leaving replay now requires confirmation.
- Replay remains session-only RAM state and is never written to Chrome local or sync storage; manifest key and drawing sync schema are unchanged.

## Version 3.8.2 changes

- Slowed the replay positioning animation to 650 ms and changed it to cubic ease-in-out motion.
- Removed the native arrow from the replay speed selector.
- Select Bar uses the current pointer index, keeps its label after selection, and can be invoked repeatedly to choose an older candle without leaving replay.
- Clicking the topbar Replay button during a replay starts another Select Bar operation; leaving replay remains exclusive to the confirmed realtime/close controls.

## Version 3.8.3 changes

- Corrected TradingView-style cutoff semantics: the selected hover candle is hidden immediately, and the first Forward/Play step reveals that exact candle.
- Rounded the complete pointer-to-bar calculation so fractional animated pan positions cannot produce a fractional hover index.

## Version 3.8.4 changes

- Selecting a Trend Line in the price pane now draws horizontal guides and color-matched price-scale labels for both endpoints, consistent with Long Position selection feedback.
- Trend Lines in the RSI pane remain unchanged and never render price-scale guides.

## Version 3.9.0 changes

- Added the Date Range drawing tool with two-click or drag-to-create interaction, editable time/price anchors, whole-object dragging, deletion, persistence, and session Undo/Redo.
- Date Range displays bar count, elapsed time, summed Binance volume, a TradingView-style orange range region and blue directional arrow, plus selected endpoint labels on the shared time scale.
- Added a code-native thin-line Date Range SVG matching the supplied reference and reduced the stroke weight of all left-rail drawing icons for a more consistent TradingView appearance.
- The manifest public key and drawing sync shard schema are unchanged.

## Version 3.9.1 changes

- While dragging a Date Range or either endpoint, the shared vertical crosshair and its time label now track the current pointer bar in real time instead of remaining at the initial pointer-down bar until release.
- The fix lives in the shared drawing-edit pointer path, preserving Date Range selection, anchor editing, persistence, and session Undo/Redo behavior without changing the manifest key or sync schema.

## Version 3.9.2 changes

- Redrew the Date Range rail icon to match the supplied TradingView geometry: one right-facing measurement arrow, asymmetric vertical markers, and hollow anchors at the lower-left and upper-right endpoints.
- Corrected the drawing-icon CSS cascade. The generic `.panel button svg` rule previously won over `.drawing-tool svg` by specificity and kept rail icons at `1.8`; the rail now has a more-specific 1px rule while other control icons remain unchanged.

## Version 3.9.3 changes

- During the initial pointer drag that creates a Date Range, the shared vertical crosshair and dark hover-time label now follow the live B endpoint before pointerup instead of remaining at anchor A.
- The creation and saved-drawing edit paths now reuse the same drawing-pointer hover updater; two-click creation, persistence, session Undo/Redo, the manifest key, and sync schema are unchanged.

## Version 3.9.4 changes

- Reduced right price-scale drag sensitivity from an exponential coefficient of `0.012` to `0.0075` per pixel, while preserving the price beneath the initial pointer as the zoom anchor.
- Reduced bottom time-scale drag sensitivity from one visible bar per 3 horizontal pixels to one bar per 5 pixels, while preserving the pointer-anchored time zoom and the 20–1,000 visible-bar limits.
- Wheel zoom, chart panning, the manifest key, and the drawing sync schema are unchanged.

## Version 3.10.0 changes

- Moved the `RSI · <symbol>` identity to the left of the timeframe group in the topbar and moved live/loading/replay/error status text to the far right.
- Added a once-per-second current-candle close countdown to the vacated left side of the bottom toolbar. It uses Binance close times with calendar-aware monthly boundaries and the Monday-anchored 14-day aggregation boundary for `2W`, and is hidden throughout Bar Replay.
- Reduced right price-scale drag sensitivity again, from an exponential coefficient of `0.0075` to `0.0045` per pixel. Time-scale drag remains at 5 pixels per visible bar.
- Countdown/replay state remains session-only; the manifest public key and drawing sync schema are unchanged.

## Version 3.10.1 changes

- Selecting a price-pane Trend Line keeps both color-matched endpoint price labels on the right price scale but no longer draws the two horizontal dashed guides across the chart.
- Long Position and Price Range selection guides remain unchanged; RSI-pane Trend Lines still do not render price labels or guides.
- The manifest public key and drawing sync schema are unchanged.

## Version 3.10.2 changes

- Removed the drawing-rail inset from the topbar identity. The identity, timeframe group, separator, and Replay button now remain one ordered left-side sequence; only the status occupies the far-right slot.
- Added a bold semantic status indicator: green for an open LIVE websocket, yellow while loading or connecting, and red for replay, selection, errors, missing symbols, or disconnected state.
- Hardened Chrome Storage get/set/remove bridges against both synchronous context-invalidated throws and callback-time `runtime.lastError`, preventing unhandled promise rejections in Binance tabs left open during an unpacked-extension reload.
- The manifest public key, sync shard schema, and session-only replay state are unchanged.

## Version 3.10.3 changes

- Price-scale dragging now scales around the latest visible/current candle close instead of the price beneath the pointer-down position, matching TradingView's fixed current-price behavior.
- The current-price line and right-side label retain their original screen Y throughout price-scale dragging while candles and grid prices expand or contract around them. Replay uses the close of its latest revealed candle as the same anchor.
- Price-scale sensitivity remains `0.0045` per pixel, time-scale behavior remains unchanged at 5 pixels per visible bar, and the manifest key and sync schema are unchanged.

## Version 3.10.4 changes

- Price-scale dragging now applies one uniform affine scale around its fixed close-price anchor, preserving equal pixel magnification for equal price distances above and below the anchor even after vertical panning.
- The live/current close remains the anchor while its candle is visible. After horizontal panning hides the live candle, the latest visible candle close becomes the anchor instead of an off-screen live price that made the viewport appear to stretch predominantly in one direction.
- Price-scale sensitivity remains `0.0045` per pixel and time-scale behavior is unchanged. The manifest key and drawing sync schema remain unchanged.

## Version 3.10.5 changes

- Price-scale dragging now anchors the exact price underneath the pointer-down position, freezing that price at its original screen Y while all other price levels scale around it.
- The interaction uses the pointer-down viewport snapshot plus the absolute vertical drag delta, so a zero-delta move cannot jump and subsequent moves cannot accumulate drift. It no longer uses the live/current or latest-visible close as its pivot.
- Chrome Storage areas are now resolved through a context-safe accessor, storage sync queues recover from rejected work, and every fire-and-forget async path has a terminal rejection handler so extension reload invalidation cannot surface as an unhandled promise rejection.
- Price-scale sensitivity remains `0.0045` per pixel, vertical pan and time-scale behavior are unchanged, and the manifest key and drawing sync schema remain unchanged.

## Version 3.10.6 changes

- Reduced price-scale drag sensitivity from an exponential coefficient of `0.0045` to `0.003` per pixel. A 60px drag now changes scale by about `1.20x` and an 80px drag by about `1.27x`, while the pointer-down price remains fixed at its original screen Y.
- Time-scale behavior remains unchanged. The manifest public key and drawing sync shard schema are unchanged.
- Re-tested unpacked-extension reload lifecycle in a real Chrome/Binance tab. The current context-safe storage bridge produced zero `Extension context invalidated` exceptions after reload and forced storage activity; the two records whose viewer highlights the current `content.js:43` are retained errors created by the pre-fix content script and mapped against the newer source file.

## Version 3.10.7 changes

- The inactive Replay topbar button now uses the same light-gray hover feedback as ordinary controls. Its black background and white text are reserved for the active replay state and remain selected while hovered.
- The manifest public key, drawing sync schema, and replay behavior are unchanged.

## Version 3.10.8 changes

- Date Range elapsed time now uses the anchors' absolute timestamp difference and decomposes it into days, hours, and minutes; `D` is the largest unit, so week-length spans remain expressed as total days.
- Zero components are omitted while minute precision is retained (for example `9D`, `1D 1h`, and `8D 9h 30m`); reversed anchors produce the same positive duration and a zero-length range displays `0m`.
- Bar count and summed Binance volume labels are unchanged. The manifest public key and drawing sync schema are unchanged.

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
