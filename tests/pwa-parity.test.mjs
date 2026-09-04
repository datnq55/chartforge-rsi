import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { functionBody, loadCanonicalRuntime, recordingCanvas } from "./fixtures/canonical-runtime.mjs";
import { createCanonicalStorageAdapter } from "../web/js/storage-adapter.js";

const root = new URL("../", import.meta.url);
const extensionUrl = new URL("content.js", root);
const canonicalUrl = new URL("web/js/canonical-content.js", root);
const banner = "// GENERATED from ../../content.js by scripts/build-pwa-canonical.mjs. Do not edit.\n";

const compact = value => value.replace(/\s+/g, "");

test("generated PWA implementation is the exact extension source after one banner", async () => {
  const [extension, generated] = await Promise.all([
    readFile(extensionUrl, "utf8"),
    readFile(canonicalUrl, "utf8")
  ]);
  assert.ok(generated.startsWith(banner), "generated source must have the canonical banner exactly once");
  assert.equal(generated.slice(banner.length), extension);
});

test("canonical PWA exposes the exact extension SVG icon registry", async () => {
  const [extension, canonical] = await Promise.all([
    loadCanonicalRuntime(extensionUrl),
    loadCanonicalRuntime(canonicalUrl)
  ]);
  const expected = [
    "fib", "long", "range", "dateRange", "trend", "text", "reset", "cross", "refresh",
    "fullscreen", "collapse", "expand", "close", "trash", "undo", "redo", "grip",
    "replay", "play", "pause", "forward", "calendar", "realtime"
  ];
  assert.deepEqual(Object.keys(canonical.ICONS), expected);
  for (const name of expected) {
    assert.equal(canonical.ICONS[name], extension.ICONS[name], `${name} SVG differs from extension`);
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

test("Pages rebuilds canonical source and runtime cache excludes retired modules",async()=>{
  const [workflow,sw]=await Promise.all([readFile(new URL(".github/workflows/pages.yml",root),"utf8"),readFile(new URL("web/sw.js",root),"utf8")]);
  assert.match(workflow,/"content\.js"/);
  assert.match(workflow,/"scripts\/\*\*"/);
  assert.match(workflow,/git diff --exit-code -- web\/js\/canonical-content\.js/);
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

test("canonical Shadow DOM keeps extension structure, dimensions, and palette", async () => {
  const source = await readFile(canonicalUrl, "utf8");
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
  const source = await readFile(canonicalUrl, "utf8");
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
