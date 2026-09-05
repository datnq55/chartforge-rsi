import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { functionBody, loadCanonicalRuntime, recordingCanvas } from "./fixtures/canonical-runtime.mjs";
import { createCanonicalStorageAdapter } from "../web/js/storage-adapter.js";

const root = new URL("../", import.meta.url);
const engineUrl = new URL("web/js/chart-engine.js", root);

const compact = value => value.replace(/\s+/g, "");

test("PWA engine exposes the complete SVG icon registry", async () => {
  const canonical = await loadCanonicalRuntime(engineUrl);
  const expected = [
    "fib", "long", "range", "dateRange", "trend", "text", "reset", "cross", "refresh",
    "fullscreen", "collapse", "expand", "close", "trash", "undo", "redo", "grip",
    "replay", "play", "pause", "forward", "calendar", "realtime"
  ];
  assert.deepEqual(Object.keys(canonical.ICONS), expected);
  for (const name of expected) {
    assert.match(canonical.ICONS[name], /^<svg\b[^>]*aria-hidden="true"[^>]*focusable="false"[^>]*>[\s\S]*<\/svg>$/);
  }
});

test("PWA entry shell has no legacy Unicode-glyph buttons", async () => {
  const html = await readFile(new URL("web/index.html", root), "utf8");
  const buttons = [...html.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/gi)];
  for (const [, body] of buttons) {
    const directText = body.replace(/<svg\b[\s\S]*?<\/svg>/gi, "").replace(/<[^>]+>/g, "").trim();
    assert.doesNotMatch(directText, /[\u2190-\u2BFF\u{1F300}-\u{1FAFF}]/u, `Unicode control remains: ${directText}`);
  }
  assert.equal(buttons.length, 0, "bootstrap shell must not duplicate canonical controls");
  assert.doesNotMatch(html, /data-tool=/, "legacy duplicate PWA drawing rail must not remain in index.html");
});

test("mobile adapter does not emulate a keyboard Shift/Snap control",async()=>{
  const source=await readFile(new URL("web/js/app.js",root),"utf8");
  assert.doesNotMatch(source,/pwa-snap|touchSnap|new KeyboardEvent/);
  assert.match(source,/new PointerEvent\("pointercancel"/);
  assert.match(source,/clientX: pinchCenter\.x, clientY: pinchCenter\.y/);
  assert.match(source,/activeDrawingTouches\.size/);
});

test("Pages validates the PWA source and runtime cache excludes retired modules",async()=>{
  const [workflow,sw]=await Promise.all([readFile(new URL(".github/workflows/pages.yml",root),"utf8"),readFile(new URL("web/sw.js",root),"utf8")]);
  assert.match(workflow,/"web\/\*\*"/);
  assert.match(workflow,/"scripts\/\*\*"/);
  assert.doesNotMatch(workflow,/git diff --exit-code/);
  assert.doesNotMatch(sw,/"\.\/js\/(?:math|binance)\.js"/);
});

test("PWA keeps market status before account control at the right edge",async()=>{
  const source=await readFile(new URL("web/js/app.js",root),"utf8");
  assert.match(source,/\.topbar \.status\{margin-left:auto\}\.pwa-auth\{margin-left:4px\}/);
  assert.match(source,/topbar\.append\(authButton\)/);
  assert.doesNotMatch(source,/insertBefore\(authButton, status\)/);
});

test("Firestore rules accept the canonical settings and drawing style ranges",async()=>{
  const rules=await readFile(new URL("web/firestore.rules",root),"utf8");
  for(const setting of ["priceShift","priceScale","crossMode"])assert.match(rules,new RegExp(`data\\.values\\.${setting}`));
  assert.match(rules,/pricePercent\.value >= 20/);
  assert.match(rules,/lineWidth <= 8/);
  assert.doesNotMatch(rules,/data\.text\.size\(\) <= 2000/);
});

test("chart engine keeps the established Shadow DOM structure, dimensions, and palette", async () => {
  const source = await readFile(engineUrl, "utf8");
  for (const token of [
    'class="panel"', 'topbar.className = "topbar"', 'topbarLogo.className = "topbar-logo"', 'class="chart-identity"',
    'class="tabs"', 'replayButton.className = "replay-button"', 'pricePane.className = "price-chart"', 'priceScaleHitbox.className = "price-scale-hitbox"',
    'splitter.className = "splitter"', 'rsiCanvas.className = "rsi-canvas"', 'bottomBar.classList.add("bottom-bar")', 'className = "drawing-tools"',
    'className = "drawing-menu"', 'className = "replay-menu"'
  ]) assert.ok(source.includes(token), `canonical Shadow DOM misses ${token}`);

  const css = compact(source);
  for (const rule of [
    ".topbar{height:48px", ".topbar-logo{width:24px;height:24px", ".topbar-separator{width:1px;height:26px;margin:07px;background:#d1d5db",
    ".topbar.tab{min-width:38px;height:34px", ".replay-button{height:34px", ".price-scale-hitbox{position:absolute;z-index:16;top:7px;right:5px;bottom:2px;width:74px",
    ".drawing-tools{left:0;top:48px;bottom:43px;width:50px", ".drawing-tool{width:38px;height:36px", ".drawing-toolsvg{width:24px!important;height:24px!important",
    ".drawing-tools.drawing-toolsvg{stroke-width:1}", ".replay-bar{height:48px", ".panel,.price-chart,.chart{background:#fff}",
    ".topbar.tab.active{background:#e8f0ff;color:#2962ff;border-color:#b7c8ff}", ".replay-button.active,.replay-button.active:hover{background:#171b26;color:#fff;border-color:#171b26}"
  ]) assert.ok(css.includes(compact(rule)), `canonical CSS contract changed: ${rule}`);
});

test("canonical chart panes are isolated from fixed bars", async () => {
  const source = await readFile(engineUrl, "utf8");
  for (const token of [
    'chartWorkspace.className = "chart-workspace"',
    "chartWorkspace.append(pricePane, splitter, rsiPane)",
    ".chart-workspace{display:flex;flex:1 1 auto;flex-direction:column;min-height:0;overflow:hidden}",
    "applyPaneSplit(pricePane, rsiPane)"
  ]) assert.ok(source.includes(token), `fixed-bar layout contract misses ${token}`);
  assert.doesNotMatch(source, /\.price-chart\{flex:none;min-height:90px/);
  assert.doesNotMatch(source, /\.chart\{flex:1;min-height:90px/);
});

test("drawing rail owns history, trash, and the compact candle countdown in visual order",async()=>{
  const source=await readFile(engineUrl,"utf8"),compactSource=compact(source);
  const ordered=["text-tool","history-separator","undo-drawing","redo-drawing","clear-drawings","countdown-separator"];
  const toolbarStart=source.indexOf('drawingToolbar.innerHTML = `');let previous=toolbarStart;
  assert.ok(toolbarStart>=0,"drawing toolbar template missing");
  for(const token of ordered){const index=source.indexOf(token,previous+1);assert.ok(index>previous,`${token} is out of drawing-rail order`);previous=index}
  assert.match(source,/drawingToolbar\.appendChild\(candleCountdown\)/);
  assert.doesNotMatch(source,/Đóng nến sau/);
  assert.match(source,/countdown\.classList\.toggle\("hidden", hidden\)/);
  assert.match(source,/\.countdown-separator"\)\?\.classList\.toggle\("hidden", hidden\)/);
  assert.ok(compactSource.includes(compact(".tool-separator{width:34px;height:1px;flex:none;margin:3px 0")));
});

test("Trash reuses the accessible Replay confirmation instead of window.confirm",async()=>{
  const source=await readFile(engineUrl,"utf8");
  assert.doesNotMatch(source,/\bconfirm\s*\(/,"chart engine must not invoke the browser confirmation UI");
  assert.equal((source.match(/const confirmDialog = document\.createElement\("div"\)/g)||[]).length,1,"confirmation UI must be a single shared component");
  assert.match(source,/confirmationController\?\.open\(\{ title: "Thoát Bar Replay\?"/);
  assert.match(source,/openConfirmation\(\{ title: "Xóa tất cả drawing\?"/);
  assert.match(source,/cancelLabel: "Hủy", confirmLabel: "Xóa tất cả", onConfirm: clearAllDrawings/);
  assert.match(source,/confirmDialog\.setAttribute\("aria-modal", "true"\)/);
  assert.match(source,/e\.key === "Escape"[\s\S]*closeConfirmation\(\)/);
  assert.match(source,/e\.key !== "Tab"[\s\S]*shadow\.activeElement/);
  const clearBody=functionBody(source,"clearAllDrawings");
  assert.match(clearBody,/pushDrawingHistory\(\)/,"confirmed bulk delete must remain undoable");
  assert.match(clearBody,/storeSet\(\{ fibDrawings: state\.fibDrawings, toolDrawings: state\.toolDrawings \}\)/);
  assert.doesNotMatch(clearBody,/confirm|openConfirmation/);
  assert.match(source,/drawingMenu\.querySelector\("\.drawing-delete"\)\.onclick = \(\) =>/,"single-drawing delete remains direct");
});

test("RSI EMA and WMA values stay at the left edge of the bottom bar",async()=>{
  const source=await readFile(engineUrl,"utf8"),css=compact(source);
  assert.match(source,/shadow\.querySelector\("\.values"\)\.innerHTML = `<b class="rsi">RSI /);
  assert.match(source,/<b class="fast">EMA /);
  assert.match(source,/<b class="slow">WMA /);
  assert.ok(css.includes(compact(".bottom-bar .values{margin-left:0;margin-right:auto;padding-left:8px}")));
  assert.doesNotMatch(source,/bottomBar\.prepend\(candleCountdown\)/);
});

test("bottom bar separator spans the shell and the price legend wraps inside the plot",async()=>{
  const source=await readFile(engineUrl,"utf8"),css=compact(source);
  assert.match(source,/class="price-legend" role="group" aria-label="Giá nến hiện tại" hidden/);
  assert.match(source,/function updatePriceLegend\(\)/);
  assert.match(source,/element\.replaceChildren\(\)/);
  assert.ok(css.includes(compact(".bottom-bar{border-top:1px solid #e5e7eb;box-sizing:border-box}")));
  assert.ok(css.includes(compact(".price-legend{position:absolute;z-index:14;top:12px;left:69px;right:79px;display:flex;flex-wrap:wrap")));
  assert.ok(css.includes(compact("pointer-events:none;user-select:none")));
  assert.doesNotMatch(source,/ctx\.fillText\(legend\.delta/);
});

test("canonical price renderer is deterministic for a fixed OHLC fixture", async () => {
  const runtime = await loadCanonicalRuntime();
  const rows = [
    { time: 1, open: 100, high: 112, low: 96, close: 110, volume: 5, closeTime: 2 },
    { time: 2, open: 110, high: 114, low: 102, close: 104, volume: 7, closeTime: 3 },
    { time: 3, open: 104, high: 109, low: 101, close: 108, volume: 6, closeTime: 4 }
  ];
  Object.assign(runtime.state, {
    symbol: "BTCUSDT", selected: "D", zoomBars: 20, priceScale: 1, priceShift: 0,
    raw: structuredClone(rows), rows: structuredClone(rows), closes: rows.map(row => row.close),
    times: rows.map(row => row.time), fibDrawings: {}, toolDrawings: {}, hoverIndex: null,
    hoverPane: null, hoverYRatio: null, selectedDrawing: null, fibDraft: null, toolDraft: null
  });
  const renderOnce = () => {
    const fixture = recordingCanvas();
    runtime.setShadow({ querySelector: selector => selector === ".price-canvas" ? fixture.canvas : null });
    runtime.renderPrice(0, 3);
    return fixture.operations;
  };
  const first = renderOnce();
  const second = renderOnce();
  assert.deepEqual(second, first);
  assert.ok(first.some(op => op[0] === "fillRect" && op[1] === 426 && op[2] === 0 && op[3] === 74 && op[4] === 240), "opaque 74px price gutter was not rendered");
  assert.ok(first.some(op => op[0] === "set" && op[1] === "fillStyle" && op[2] === "#fff"), "up-candle white fill missing");
  assert.ok(first.some(op => op[0] === "set" && op[1] === "fillStyle" && op[2] === "#000"), "down-candle black fill missing");
});

test("replay cutoff hides the selected candle and Forward reveals exactly it", async () => {
  const runtime = await loadCanonicalRuntime();
  const rows = [1, 2, 3, 4].map(time => ({ time, open: time, high: time + 1, low: time - 1, close: time, volume: 1 }));
  Object.assign(runtime.state, { selected: "D", raw: rows, replay: { ...runtime.state.replay, active: true, time: 2 } });
  runtime.rebuild();
  assert.deepEqual(Array.from(runtime.state.rows, row => row.time), [1, 2]);
  runtime.state.replay.time = 3;
  runtime.rebuild();
  assert.deepEqual(Array.from(runtime.state.rows, row => row.time), [1, 2, 3]);
});

test("Replay remains RAM-only and is absent from persistence writes", async () => {
  const source = await readFile(engineUrl, "utf8");
  const runtime = await loadCanonicalRuntime();
  assert.equal(Object.hasOwn(runtime.DEFAULTS, "replay"), false, "replay must not enter Object.keys(DEFAULTS) storage restore");
  assert.match(source, /storeGet\(\[\.\.\.Object\.keys\(DEFAULTS\),\s*"uiDefaultsVersion"\]\)/);
  for (const name of [
    "updateReplayUI", "setReplayPlaying", "startReplayAt", "stepReplay", "beginReplayBarSelection",
    "requestExitReplay", "openReplay", "exitReplay"
  ]) {
    const body = functionBody(source, name);
    assert.doesNotMatch(body, /\b(?:storeSet|storageSet|localStorage|indexedDB)\s*\(/, `${name} persists replay state`);
  }
  for (const match of source.matchAll(/storeSet\s*\(\s*\{([^}]*)\}/g)) {
    assert.doesNotMatch(match[1], /\breplay\b|\bplaying\b|\bspeed\b|\bselecting\b|\bexhaustedFuture\b/);
  }
});

test("storage adapter rejects session-only replay and Undo/Redo fields", async () => {
  const settingWrites = [];
  const repository = {
    listSettingRows: async () => [],
    listDrawings: async () => [],
    replaceDrawings: async () => [],
    setSetting: async (...args) => settingWrites.push(args)
  };
  const adapter = createCanonicalStorageAdapter(repository, { makeId: () => "fixture-id" });
  await adapter.saveState({
    replay: { active: true, time: 3, playing: true, speed: 10 },
    historyPast: [{ fixture: true }],
    historyFuture: [{ fixture: true }],
    raw: [{ time: 1 }],
    closes: [1],
    times: [1],
    socket: { readyState: 1 },
    replayTime: 3,
    replaySpeed: 10
  });
  assert.deepEqual(settingWrites, []);
});
