(() => {
  "use strict";
  if (window.__binanceRsiMtfLoaded) return;
  window.__binanceRsiMtfLoaded = true;

  const TFS = [
    ["30m", "30m"], ["H1", "1h"], ["H2", "2h"], ["H4", "4h"], ["H8", "8h"], ["H12", "12h"],
    ["D", "1d"], ["3D", "3d"], ["1W", "1w"], ["2W", "1w", true], ["M", "1M"]
  ].map(([label, interval, biweekly = false]) => ({ label, interval, biweekly }));
  const DEFAULTS = { visible: true, collapsed: false, selected: "D", zoomBars: 120, panBars: 0, priceShift: 0, priceScale: 1, left: 8, top: 70, width: null, height: 560, pricePercent: 64, crossMode: true, fibDrawings: {}, toolDrawings: {}, toolDefaults: { text: { color: "#111111", fontSize: 14 }, trend: { color: "#f23645", lineWidth: 4, dash: "solid" } } };
  const PRICE_SCALE_DRAG_EXP_PER_PX = .003;
  const RESET_ZOOM_BARS = 240;
  const UI_DEFAULTS_VERSION = 2;
  const state = { ...DEFAULTS, symbol: null, socket: null, raw: [], closes: [], times: [], rows: [], countdownTimeframe: null, hoverIndex: null, hoverPane: null, hoverYRatio: null, drawingTool: null, fibDraft: null, toolDraft: null, selectedDrawing: null, drawingHitAreas: [], menuPosition: null, fullscreen: false, restoreGeometry: null, historyPast: [], historyFuture: [], loadingOlder: false, historyExhausted: false, loadGeneration: 0, replay: { open: false, selecting: null, active: false, time: null, playing: false, speed: 1, loading: false, exhaustedFuture: false } };
  let shadow, resizeTimer, syncReloadTimer, replayTimer, replayPanFrame, countdownTimer, confirmationController, activeDrawingEdit = null, drawingShiftPressed = false, syncWriteQueue = Promise.resolve();
  const isShiftKey = (e) => e.key === "Shift" || e.code === "ShiftLeft" || e.code === "ShiftRight";
  const setDrawingShiftPressed = (pressed) => {
    if (drawingShiftPressed === pressed) return;
    drawingShiftPressed = pressed;
    activeDrawingEdit?.applyShift?.(pressed);
  };
  const updateDrawingShiftFromKey = (e) => { if (isShiftKey(e)) setDrawingShiftPressed(e.type === "keydown"); };
  addEventListener("keydown", updateDrawingShiftFromKey, true);
  addEventListener("keyup", updateDrawingShiftFromKey, true);
  document.addEventListener("keydown", updateDrawingShiftFromKey, true);
  document.addEventListener("keyup", updateDrawingShiftFromKey, true);
  addEventListener("blur", () => setDrawingShiftPressed(false), true);
  const svg = (body) => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${body}</svg>`;
  const runtimeUrl = (path) => { try { return chartForgePlatform.runtime.getURL(path); } catch { return ""; } };
  const collapseContent = (collapsed) => collapsed ? `<img src="${runtimeUrl("assets/icon.svg")}" alt="" draggable="false">` : ICONS.collapse;
  const ICONS = {
    fib: svg('<path d="M4 5h16M4 12h13M7 19h13"/><circle cx="19" cy="12" r="2"/><circle cx="5" cy="19" r="2"/>'),
    long: svg('<path d="M7 5h13M12 8v4h8M7 19h13"/><circle cx="5" cy="5" r="2"/><circle cx="5" cy="19" r="2"/>'),
    range: svg('<path d="M4 5h13M12 8v11M7 19h13M9.5 10.5 12 8l2.5 2.5"/><circle cx="19" cy="5" r="2"/><circle cx="5" cy="19" r="2"/>'),
    dateRange: '<svg class="date-range-icon" viewBox="0 0 28 28" aria-hidden="true" focusable="false"><g fill="currentColor"><path d="M6 14h14v1H6z"/><path d="M20 12v5l3-2.5z"/><path d="M24 8.5h1V25h-1zM4 4h1v16.5H4z"/><path fill-rule="evenodd" d="M4.5 20a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zm0 1a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM24.5 4a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zm0 1a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z"/></g></svg>',
    trend: svg('<path d="m5.5 18.5 13-13"/><circle cx="5.5" cy="18.5" r="2"/><circle cx="18.5" cy="5.5" r="2"/>'),
    text: svg('<path d="M5 5h14M12 5v14M8.5 19h7"/><path d="M7 5v2M17 5v2"/>'),
    reset: svg('<path d="M4 12a8 8 0 1 0 2.3-5.7L4 9M4 4v5h5"/>'),
    cross: svg('<path d="M12 3v18M3 12h18"/><circle cx="12" cy="12" r="3"/>'),
    refresh: svg('<path d="M20 6v5h-5M4 18v-5h5M18.5 10A7 7 0 0 0 6 6.5L4 9M5.5 14A7 7 0 0 0 18 17.5l2-2.5"/>'),
    fullscreen: svg('<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"/>'),
    collapse: svg('<path d="m6 9 6 6 6-6"/>'),
    expand: svg('<path d="m6 15 6-6 6 6"/>'),
    close: svg('<path d="M6 6l12 12M18 6 6 18"/>'),
    trash: svg('<path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 10v7M14 10v7"/>'),
    undo: svg('<path d="m9 7-5 5 5 5M5 12h8a6 6 0 0 1 6 6"/>'),
    redo: svg('<path d="m15 7 5 5-5 5M19 12h-8a6 6 0 0 0-6 6"/>'),
    grip: svg('<circle cx="8" cy="8" r="1"/><circle cx="8" cy="12" r="1"/><circle cx="8" cy="16" r="1"/><circle cx="12" cy="8" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="16" r="1"/>'),
    replay: svg('<path d="M9 7 4 12l5 5V7Zm6 0-5 5 5 5V7Z"/>'),
    play: svg('<path d="m9 6 9 6-9 6V6Z"/>'),
    pause: svg('<path d="M8 6v12M16 6v12"/>'),
    forward: svg('<path d="m7 6 8 6-8 6V6Zm10 0v12"/>'),
    calendar: svg('<path d="M5 4v3M19 4v3M4 9h16M5 6h14v14H5V6Z"/>'),
    realtime: svg('<path d="M4 12a8 8 0 1 0 2.3-5.7L4 9M4 4v5h5"/><path d="M12 8v5l3 2"/>')
  };
  const storageArea = (name) => { try { return chartForgePlatform?.storage?.[name] || null; } catch { return null; } };
  function storageCall(area, method, args, fallback, successValue) {
    return new Promise((resolve) => {
      let settled = false;
      const finish = (value) => { if (!settled) { settled = true; resolve(value); } };
      try {
        if (!area || typeof area[method] !== "function") return finish(fallback);
        area[method](...args, (value) => {
          let failed = false;
          try { failed = Boolean(chartForgePlatform?.runtime?.lastError); } catch { failed = true; }
          finish(failed ? fallback : successValue(value));
        });
      } catch { finish(fallback); }
    });
  }
  const storageGet = (area, keys) => storageCall(area, "get", [keys], {}, (value) => value || {});
  const storageSet = (area, data) => storageCall(area, "set", [data], false, () => true);
  const storageRemove = (area, keys) => !keys.length ? Promise.resolve(true) : storageCall(area, "remove", [keys], false, () => true);
  const ignoreFailure = (promise) => Promise.resolve(promise).catch(() => undefined);
  function setStatus(text) {
    const status = shadow?.querySelector(".status"); if (!status) return;
    const normalized = String(text || ""), lower = normalized.toLocaleLowerCase("vi");
    const kind = normalized.toUpperCase().startsWith("LIVE") ? "live" : lower.startsWith("đang ") || lower.includes("loading") ? "loading" : "offline";
    status.textContent = normalized; status.dataset.state = kind;
    const meaning = kind === "live" ? "Đang kết nối dữ liệu trực tiếp" : kind === "loading" ? "Đang tải dữ liệu" : "Không ở chế độ trực tiếp";
    status.title = `${meaning}${normalized ? `: ${normalized}` : ""}`; status.setAttribute("aria-label", status.title);
  }
  const DRAWING_SYNC_PREFIX = "cfrsi:d:";
  const drawingSyncKey = (kind, symbol, index) => `${DRAWING_SYNC_PREFIX}${kind}:${encodeURIComponent(symbol)}:${index}`;
  function drawingsFromShards(items) {
    const grouped = { fibDrawings: {}, toolDrawings: {} };
    for (const [key, drawing] of Object.entries(items || {})) {
      if (!key.startsWith(DRAWING_SYNC_PREFIX)) continue;
      const match = key.slice(DRAWING_SYNC_PREFIX.length).match(/^(f|t):(.+):(\d+)$/); if (!match) continue;
      const [, kind, encodedSymbol, indexText] = match, symbol = decodeURIComponent(encodedSymbol), target = kind === "f" ? grouped.fibDrawings : grouped.toolDrawings;
      (target[symbol] ||= []).push({ index: Number(indexText), drawing });
    }
    for (const map of [grouped.fibDrawings, grouped.toolDrawings]) for (const symbol of Object.keys(map)) map[symbol] = map[symbol].sort((a, b) => a.index - b.index).map((item) => item.drawing);
    return grouped;
  }
  async function syncDrawingMaps(fibDrawings, toolDrawings) {
    const current = await storageGet(storageArea("sync"), null), desired = {};
    for (const [symbol, drawings] of Object.entries(fibDrawings || {})) drawings.forEach((drawing, index) => { desired[drawingSyncKey("f", symbol, index)] = drawing; });
    for (const [symbol, drawings] of Object.entries(toolDrawings || {})) drawings.forEach((drawing, index) => { desired[drawingSyncKey("t", symbol, index)] = drawing; });
    const stale = Object.keys(current).filter((key) => key.startsWith(DRAWING_SYNC_PREFIX) && !(key in desired));
    await storageRemove(storageArea("sync"), stale); if (Object.keys(desired).length) await storageSet(storageArea("sync"), desired);
    await storageRemove(storageArea("sync"), ["fibDrawings", "toolDrawings"]);
  }
  async function storeGet(keys) {
    const [local, allSynced] = await Promise.all([storageGet(storageArea("local"), keys), storageGet(storageArea("sync"), null)]), synced = {};
    for (const key of keys) if (key in allSynced) synced[key] = allSynced[key];
    const shards = drawingsFromShards(allSynced), merged = { ...local, ...synced };
    merged.fibDrawings = { ...(local.fibDrawings || {}), ...(synced.fibDrawings || {}), ...shards.fibDrawings };
    merged.toolDrawings = { ...(local.toolDrawings || {}), ...(synced.toolDrawings || {}), ...shards.toolDrawings };
    const settings = Object.fromEntries(Object.entries(local).filter(([key]) => key !== "fibDrawings" && key !== "toolDrawings" && !(key in synced)));
    if (Object.keys(settings).length) ignoreFailure(storageSet(storageArea("sync"), settings));
    ignoreFailure(storageSet(storageArea("local"), merged));
    if ("fibDrawings" in allSynced || "toolDrawings" in allSynced || (!Object.keys(shards.fibDrawings).length && !Object.keys(shards.toolDrawings).length)) syncWriteQueue = syncWriteQueue.catch(() => undefined).then(() => syncDrawingMaps(merged.fibDrawings, merged.toolDrawings)).catch(() => undefined);
    return merged;
  }
  function storeSet(data) {
    ignoreFailure(storageSet(storageArea("local"), data));
    const settings = Object.fromEntries(Object.entries(data).filter(([key]) => key !== "fibDrawings" && key !== "toolDrawings"));
    if (Object.keys(settings).length) ignoreFailure(storageSet(storageArea("sync"), settings));
    if ("fibDrawings" in data || "toolDrawings" in data) syncWriteQueue = syncWriteQueue.catch(() => undefined).then(() => syncDrawingMaps(state.fibDrawings, state.toolDrawings)).catch(() => undefined);
    return syncWriteQueue;
  }
  const tf = () => TFS.find((x) => x.label === state.selected) || TFS.find((x) => x.label === "D");

  function symbolFromUrl() {
    const m = decodeURIComponent(location.pathname).toUpperCase().match(/\/TRADE\/([A-Z0-9]+)[_\-]([A-Z0-9]+)/);
    if (m) return m[1] + m[2];
    return (new URLSearchParams(location.search).get("symbol") || "").toUpperCase().replace(/[^A-Z0-9]/g, "") || null;
  }
  function rsi(v, n = 14) {
    const out = Array(v.length).fill(null); if (v.length <= n) return out;
    let gain = 0, loss = 0;
    for (let i = 1; i <= n; i++) { const d = v[i] - v[i - 1]; gain += Math.max(d, 0); loss += Math.max(-d, 0); }
    let ag = gain / n, al = loss / n; out[n] = al === 0 ? 100 : 100 - 100 / (1 + ag / al);
    for (let i = n + 1; i < v.length; i++) {
      const d = v[i] - v[i - 1]; ag = (ag * (n - 1) + Math.max(d, 0)) / n; al = (al * (n - 1) + Math.max(-d, 0)) / n;
      out[i] = al === 0 ? 100 : 100 - 100 / (1 + ag / al);
    }
    return out;
  }
  function ema(v, n) {
    const out = Array(v.length).fill(null), a = 2 / (n + 1); let prev = null;
    v.forEach((x, i) => { if (x != null) { prev = prev == null ? x : a * x + (1 - a) * prev; out[i] = prev; } }); return out;
  }
  function wma(v, n) {
    const out = Array(v.length).fill(null), den = n * (n + 1) / 2;
    for (let i = n - 1; i < v.length; i++) { let sum = 0, ok = true; for (let j = 0; j < n; j++) { const x = v[i - n + 1 + j]; if (x == null) { ok = false; break; } sum += x * (j + 1); } if (ok) out[i] = sum / den; }
    return out;
  }
  const latest = (v) => { for (let i = v.length - 1; i >= 0; i--) if (v[i] != null) return v[i]; return null; };
  const fmt = (v) => v == null ? "--" : v.toFixed(2);

  function rowsForTimeframe(source) {
    let rows = source;
    if (!tf().biweekly) return rows;
    const span = 14 * 86400000, monday1970 = Date.UTC(1970, 0, 5), buckets = new Map();
    for (const row of rows) {
      const key = Math.floor((row.time - monday1970) / span), candle = buckets.get(key);
      if (!candle) buckets.set(key, { ...row, closeTime: monday1970 + (key + 1) * span - 1 });
      else { candle.high = Math.max(candle.high, row.high); candle.low = Math.min(candle.low, row.low); candle.close = row.close; candle.closeTime = monday1970 + (key + 1) * span - 1; candle.volume = (candle.volume || 0) + (row.volume || 0); }
    }
    return [...buckets.values()];
  }
  function rebuild() {
    const unique = new Map();
    for (const row of state.raw) {
      if (Number.isFinite(row.time) && row.time <= Date.now() + 60000) unique.set(row.time, row);
    }
    state.raw = [...unique.values()].sort((a, b) => a.time - b.time);
    const visibleRaw = state.replay.active && Number.isFinite(state.replay.time) ? state.raw.filter((row) => row.time <= state.replay.time) : state.raw;
    const rows = rowsForTimeframe(visibleRaw);
    state.rows = rows; state.closes = rows.map((x) => x.close); state.times = rows.map((x) => x.time);
  }
  function candleCloseBoundary(row, current = tf()) {
    if (!row || !Number.isFinite(row.time)) return null;
    if (current.biweekly) {
      const span = 14 * 86400000, monday1970 = Date.UTC(1970, 0, 5), bucket = Math.floor((row.time - monday1970) / span);
      return monday1970 + (bucket + 1) * span;
    }
    if (current.label === "M") {
      const open = new Date(row.time);
      return Date.UTC(open.getUTCFullYear(), open.getUTCMonth() + 1, 1);
    }
    if (Number.isFinite(row.closeTime)) return row.closeTime + 1;
    const spans = { "30m": 1800000, H1: 3600000, H2: 7200000, H4: 14400000, H8: 28800000, H12: 43200000, D: 86400000, "3D": 259200000, "1W": 604800000 };
    return row.time + (spans[current.label] || 0);
  }
  function formatCandleCountdown(milliseconds) {
    const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000)), days = Math.floor(totalSeconds / 86400), hours = Math.floor(totalSeconds % 86400 / 3600), minutes = Math.floor(totalSeconds % 3600 / 60), seconds = totalSeconds % 60, pad = (value) => String(value).padStart(2, "0");
    return `${days ? `${days}d ` : ""}${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
  function updateCandleCountdown(now = Date.now()) {
    if (!shadow) return; const countdown = shadow.querySelector(".candle-countdown"); if (!countdown) return;
    const hidden = !state.visible || state.collapsed || state.replay.open; countdown.classList.toggle("hidden", hidden); shadow.querySelector(".countdown-separator")?.classList.toggle("hidden", hidden); if (hidden) return;
    const boundary = state.countdownTimeframe === tf().label ? candleCloseBoundary(state.rows.at(-1)) : null;
    countdown.textContent = Number.isFinite(boundary) ? formatCandleCountdown(boundary - now) : "--:--:--";
  }
  function canvasPixelGrid(canvas, rect) {
    const ratio = Math.max(1, Number(devicePixelRatio) || 1);
    canvas.width = Math.max(1, Math.round(rect.width * ratio)); canvas.height = Math.max(1, Math.round(rect.height * ratio));
    return { x: canvas.width / Math.max(1e-12, rect.width), y: canvas.height / Math.max(1e-12, rect.height) };
  }
  function alignedStroke(value, lineWidth, scale) {
    const pixels = Math.max(1, Math.round(Math.max(0, lineWidth) * scale));
    return { value: (Math.round(value * scale - pixels / 2) + pixels / 2) / scale, lineWidth: pixels / scale, pixels };
  }
  function alignedFillRange(from, to, scale, minimumPixels = 1) {
    let first = Math.round(Math.min(from, to) * scale), last = Math.round(Math.max(from, to) * scale);
    if (last - first < minimumPixels) { const center = (from + to) * scale / 2; first = Math.round(center - minimumPixels / 2); last = first + minimumPixels; }
    return { from: first / scale, to: last / scale, pixels: last - first };
  }
  function contextScale(ctx, axis) {
    const transform = ctx.getTransform(); return Math.max(1e-12, Math.abs(axis === "x" ? transform.a : transform.d));
  }
  function candlePixelGeometry(center, bodyWidth, top, bottom, grid) {
    const wick = alignedStroke(center, 1, grid.x), desiredBodyPixels = Math.max(1, Math.round(bodyWidth * grid.x)), parity = wick.pixels % 2;
    let bodyPixels = desiredBodyPixels;
    if (bodyPixels % 2 !== parity) bodyPixels += 1;
    const centerPixels = wick.value * grid.x, leftPixels = Math.round(centerPixels - bodyPixels / 2), vertical = alignedFillRange(top, bottom, grid.y);
    return { wick, left: leftPixels / grid.x, right: (leftPixels + bodyPixels) / grid.x, top: vertical.from, bottom: vertical.to };
  }
  function fillAndStrokeAlignedRect(ctx, geometry, grid, fillStyle, strokeStyle) {
    const { left, right, top, bottom } = geometry, verticalWidth = 1 / grid.x, horizontalWidth = 1 / grid.y;
    ctx.fillStyle = fillStyle; ctx.fillRect(left, top, right - left, bottom - top);
    ctx.strokeStyle = strokeStyle; ctx.setLineDash([]);
    if ((right - left) * grid.x > 1) {
      ctx.lineWidth = verticalWidth; ctx.beginPath(); ctx.moveTo(left + verticalWidth / 2, top); ctx.lineTo(left + verticalWidth / 2, bottom); ctx.moveTo(right - verticalWidth / 2, top); ctx.lineTo(right - verticalWidth / 2, bottom); ctx.stroke();
    }
    ctx.lineWidth = horizontalWidth; ctx.beginPath(); ctx.moveTo(left, top + horizontalWidth / 2); ctx.lineTo(right, top + horizontalWidth / 2); if ((bottom - top) * grid.y > 1) { ctx.moveTo(left, bottom - horizontalWidth / 2); ctx.lineTo(right, bottom - horizontalWidth / 2); } ctx.stroke();
  }
  function syncCandleCountdownTimer() {
    clearInterval(countdownTimer); countdownTimer = null; updateCandleCountdown();
    if (state.visible && !state.collapsed && !state.replay.open) countdownTimer = setInterval(updateCandleCountdown, 1000);
  }
  function plot(ctx, values, color, width, start, x, y, w, h) {
    ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = width; let begun = false;
    for (let i = start; i < values.length; i++) {
      if (values[i] == null) continue;
      const px = x + (i - start) / Math.max(1, state.zoomBars - 1) * w, py = y + h - values[i] / 100 * h;
      if (!begun) { ctx.moveTo(px, py); begun = true; } else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
  function formatTime(timestamp) {
    const d = new Date(timestamp), pad = (n) => String(n).padStart(2, "0"), label = tf().label;
    if (label === "30m" || label.startsWith("H")) return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    if (label === "M") return `${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${String(d.getFullYear()).slice(-2)}`;
  }
  function formatHoverTime(timestamp) {
    const d = new Date(timestamp), days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"], months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"], pad = (n) => String(n).padStart(2, "0");
    return `${days[d.getDay()]} ${pad(d.getDate())} ${months[d.getMonth()]} '${String(d.getFullYear()).slice(-2)}  ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  function formatDateRangeTime(timestamp) {
    const d = new Date(timestamp), days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"], months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"], pad = (n) => String(n).padStart(2, "0"), date = `${days[d.getDay()]} ${pad(d.getDate())} ${months[d.getMonth()]} '${String(d.getFullYear()).slice(-2)}`;
    return tf().label === "30m" || tf().label.startsWith("H") ? `${date} ${pad(d.getHours())}:${pad(d.getMinutes())}` : date;
  }
  function timeAt(index) {
    if (state.times[index] != null) return state.times[index];
    if (!state.times.length) return Date.now();
    const last = state.times.length - 1;
    if (tf().label === "M") { const d = new Date(state.times[last]); d.setUTCMonth(d.getUTCMonth() + index - last); return d.getTime(); }
    const fixedSteps = { "30m": 1800000, H1: 3600000, H2: 7200000, H4: 14400000, H8: 28800000, H12: 43200000, D: 86400000, "3D": 259200000, "1W": 604800000, "2W": 1209600000 }, step = fixedSteps[tf().label] || (last > 0 ? state.times[last] - state.times[last - 1] : 3600000);
    return state.times[last] + (index - last) * step;
  }
  const TIME_MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const TIME_TICK_TARGET_PX = 42;
  const TIME_TICK_FINE_DAY_PX = 38;
  const TIME_TICK_LABEL_GAP_PX = 7;
  const niceStep = (minimum, choices) => choices.find((value) => value >= minimum) || choices.at(-1);
  function timeTickBox(tick, start, width, measure) {
    const px = (tick.index - start) / Math.max(1, state.zoomBars - 1) * width, textWidth = measure(tick.label) + 8;
    if (px - textWidth / 2 < 0) return { left: px, right: px + textWidth, align: "left" };
    if (px + textWidth / 2 > width) return { left: px - textWidth, right: px, align: "right" };
    return { left: px - textWidth / 2, right: px + textWidth / 2, align: "center" };
  }
  function timeTicks(start, width, measureText = (value) => String(value).length * 6) {
    const endSlot = start + state.zoomBars - 1, label = tf().label, slotPx = width / Math.max(1, state.zoomBars - 1), candidates = [], byIndex = new Map();
    const add = (index, text, priority, kind, major = false) => {
      if (!text || index < start || index > endSlot) return;
      const existing = byIndex.get(index);
      if (existing && existing.priority >= priority) return;
      if (existing) candidates.splice(candidates.indexOf(existing), 1);
      const tick = { index, label: text, priority, kind, major }; candidates.push(tick); byIndex.set(index, tick);
    };
    const before = new Date(timeAt(start - 1)); let previousYear = before.getUTCFullYear(), previousMonth = before.getUTCMonth();
    const times = [];
    for (let index = start; index <= endSlot; index++) {
      const stamp = timeAt(index), date = new Date(stamp), year = date.getUTCFullYear(), month = date.getUTCMonth(); times.push(stamp);
      if (year !== previousYear) add(index, String(year), 4, "year", true);
      else if (month !== previousMonth) add(index, TIME_MONTHS[month], 3, "month", true);
      previousYear = year; previousMonth = month;
    }
    const medianBarMs = (() => { const spans = times.slice(1).map((value, index) => value - times[index]).filter((value) => value > 0).sort((a, b) => a - b); return spans.length ? spans[Math.floor(spans.length / 2)] : 86400000; })();
    const addCalendarDays = (stepDays, priority = 2) => {
      let prior = new Date(timeAt(start - 1)), priorKey = `${prior.getUTCFullYear()}-${prior.getUTCMonth()}-${prior.getUTCDate()}`;
      for (let index = start; index <= endSlot; index++) {
        const date = new Date(timeAt(index)), key = `${date.getUTCFullYear()}-${date.getUTCMonth()}-${date.getUTCDate()}`;
        if (key !== priorKey && (date.getUTCDate() - 1) % stepDays === 0) add(index, String(date.getUTCDate()), priority, "day");
        priorKey = key;
      }
    };
    if (label === "M") {
      if (slotPx >= 13) for (let index = start; index <= endSlot; index++) { const date = new Date(timeAt(index)); if (date.getUTCMonth() % niceStep(TIME_TICK_TARGET_PX / slotPx, [1,2,3,4,6]) === 0) add(index, TIME_MONTHS[date.getUTCMonth()], 2, "month"); }
    } else if (label === "1W" || label === "2W") {
      if (slotPx >= 13) { const stepBars = niceStep(TIME_TICK_TARGET_PX / slotPx, [1,2,3,4,6,8,13]); for (let index = start; index <= endSlot; index++) { const stamp = timeAt(index), ordinal = Math.floor(stamp / medianBarMs); if (ordinal % stepBars === 0) add(index, String(new Date(stamp).getUTCDate()), 1, "day"); } }
    } else if (label === "D" || label === "3D") {
      const pixelsPerDay = slotPx * 86400000 / Math.max(86400000, medianBarMs);
      if (pixelsPerDay >= 7.5) {
        const stepDays = pixelsPerDay >= TIME_TICK_FINE_DAY_PX ? 1 : niceStep(TIME_TICK_TARGET_PX / pixelsPerDay, [1,2,3,4,5,7,10,14]);
        if (label === "D") addCalendarDays(stepDays);
        else { const stepBars = niceStep(TIME_TICK_TARGET_PX / slotPx, [1,2,3,4,5,7,10]); for (let index = start; index <= endSlot; index++) { const stamp = timeAt(index), ordinal = Math.floor(stamp / medianBarMs); if (ordinal % stepBars === 0) add(index, String(new Date(stamp).getUTCDate()), 2, "day"); } }
      }
    } else {
      const pixelsPerHour = slotPx * 3600000 / medianBarMs;
      addCalendarDays(niceStep(TIME_TICK_TARGET_PX / Math.max(.01, slotPx * 86400000 / medianBarMs), [1,2,3,5,7,10,14,21,31]));
      if (pixelsPerHour >= 2.5) {
        const minimumHours = Math.max(medianBarMs / 3600000, TIME_TICK_TARGET_PX / pixelsPerHour), stepHours = niceStep(minimumHours, [.5,1,2,3,4,6,8,12,24]);
        for (let index = start; index <= endSlot; index++) {
          const date = new Date(timeAt(index)), minuteOfDay = date.getUTCHours() * 60 + date.getUTCMinutes(), stepMinutes = stepHours * 60;
          if (minuteOfDay > 0 && minuteOfDay % stepMinutes === 0) add(index, `${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}`, 1, stepMinutes < 60 ? "minute" : "hour");
        }
      }
    }
    const accepted = [], gap = TIME_TICK_LABEL_GAP_PX;
    for (const tick of candidates.sort((a, b) => b.priority - a.priority || a.index - b.index)) {
      const box = timeTickBox(tick, start, width, measureText);
      if (box.right < 0 || box.left > width || accepted.some((item) => box.left < item.box.right + gap && box.right > item.box.left - gap)) continue;
      accepted.push({ tick: { ...tick, align: box.align }, box });
    }
    return accepted.map((item) => item.tick).sort((a, b) => a.index - b.index);
  }
  function viewRange(length = state.closes.length) {
    const start = length - state.zoomBars - state.panBars;
    return { start, end: start + state.zoomBars, future: Math.max(0, -state.panBars) };
  }
  const clampPan = (value, zoom = state.zoomBars) => Math.max(-Math.max(0, zoom - 10), Math.min(Math.max(0, state.closes.length - zoom), value));
  function timeScaleDragZoom(startZoom, startPointerX, pointerX, plotLeft, plotWidth) {
    // Time-axis scaling pivots at the plot's right edge: bar spacing changes with the pointer's distance from that edge.
    const right = plotLeft + Math.max(1, plotWidth), fromStart = Math.max(0, Math.min(plotWidth, right - startPointerX)), fromPointer = Math.max(0, Math.min(plotWidth, right - pointerX));
    if (fromStart === 0 || fromPointer === 0) return Math.max(20, Math.min(1000, Math.round(startZoom)));
    return Math.max(20, Math.min(1000, Math.round(1 + (startZoom - 1) * fromStart / fromPointer)));
  }
  const fibKey = () => state.symbol || "UNKNOWN";
  const fibs = () => state.fibDrawings[fibKey()] || [];
  const toolDrawings = () => state.toolDrawings[fibKey()] || [];
  function mergeTimeframeDrawingKeys(source) {
    const merged = {}, timeframeNames = new Set([...TFS.map((item) => item.label), "1D", "1M"]); let migrated = false;
    for (const [storedKey, drawings] of Object.entries(source || {})) {
      const separator = storedKey.lastIndexOf(":"), suffix = separator >= 0 ? storedKey.slice(separator + 1) : "", symbolKey = timeframeNames.has(suffix) ? storedKey.slice(0, separator) : storedKey;
      if (symbolKey !== storedKey) migrated = true;
      const target = merged[symbolKey] || [], seen = new Set(target.map((drawing) => JSON.stringify(drawing)));
      for (const drawing of Array.isArray(drawings) ? drawings : []) { const signature = JSON.stringify(drawing); if (!seen.has(signature)) { target.push(drawing); seen.add(signature); } }
      merged[symbolKey] = target;
    }
    return { drawings: merged, migrated };
  }
  function nearestIndex(timestamp) {
    if (!state.times.length) return 0;
    const last = state.times.length - 1, step = last > 0 ? state.times[last] - state.times[last - 1] : 3600000;
    if (timestamp > state.times[last]) return last + Math.round((timestamp - state.times[last]) / Math.max(1, step));
    if (timestamp < state.times[0]) return Math.round((timestamp - state.times[0]) / Math.max(1, step));
    let lo = 0, hi = state.times.length - 1;
    while (lo < hi) { const mid = Math.floor((lo + hi) / 2); if (state.times[mid] < timestamp) lo = mid + 1; else hi = mid; }
    return lo > 0 && Math.abs(state.times[lo - 1] - timestamp) < Math.abs(state.times[lo] - timestamp) ? lo - 1 : lo;
  }
  function drawFibonacci(ctx, fib, start, x, y, w, h, low, high, preview = false, selected = false) {
    if (!fib?.a || !fib?.b) return;
    const ax = x + (nearestIndex(fib.a.time) - start) / Math.max(1, state.zoomBars - 1) * w, bx = x + (nearestIndex(fib.b.time) - start) / Math.max(1, state.zoomBars - 1) * w;
    const py = (price) => y + h - (price - low) / Math.max(1e-12, high - low) * h, ay = py(fib.a.price), by = py(fib.b.price), left = Math.min(ax, bx), right = Math.max(ax, bx), levels = [0, .236, .382, .5, .618, .786, 1];
    if (right - left < 1) return;
    for (let i = 0; i < levels.length - 1; i++) {
      const p1 = fib.b.price + (fib.a.price - fib.b.price) * levels[i], p2 = fib.b.price + (fib.a.price - fib.b.price) * levels[i + 1], top = Math.min(py(p1), py(p2)), bottom = Math.max(py(p1), py(p2));
      ctx.fillStyle = levels[i] === .382 ? "rgba(255,82,145,.10)" : i % 2 ? "rgba(107,114,128,.10)" : "rgba(107,114,128,.16)"; ctx.fillRect(left, top, right - left, bottom - top);
    }
    ctx.font = "10px Arial"; ctx.textBaseline = "bottom"; ctx.textAlign = "right";
    for (const level of levels) {
      const price = fib.b.price + (fib.a.price - fib.b.price) * level, ly = py(price), pink = level === .5; ctx.strokeStyle = pink ? "#ff5c9a" : "#666"; ctx.lineWidth = pink ? 1.4 : 1; ctx.setLineDash([]); ctx.beginPath(); ctx.moveTo(left, ly); ctx.lineTo(right, ly); ctx.stroke(); ctx.fillStyle = pink ? "#ff5c9a" : "#666"; ctx.fillText(`${level} (${price.toLocaleString(undefined, { maximumFractionDigits: 6 })})`, left - 7, ly - 2);
    }
    ctx.setLineDash([8, 7]); ctx.strokeStyle = "#858585"; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke(); ctx.setLineDash([]);
    if (preview || selected) for (const [px, py2] of [[ax, ay], [bx, by]]) { ctx.fillStyle = "#fff"; ctx.strokeStyle = "#2962ff"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(px, py2, 4.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
    return { left: left - 8, right: right + 8, top: Math.min(ay, by) - 8, bottom: Math.max(ay, by) + 8, anchors: [{ name: "a", x: ax, y: ay }, { name: "b", x: bx, y: by }] };
  }
  function labelBox(ctx, text, cx, top, color) {
    ctx.font = "bold 10px Arial"; const pad = 6, width = ctx.measureText(text).width + pad * 2, height = 19, left = cx - width / 2; ctx.fillStyle = color;
    if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(left, top, width, height, 4); ctx.fill(); } else ctx.fillRect(left, top, width, height);
    ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(text, cx, top + height / 2); return { left, right: left + width, top, bottom: top + height };
  }
  function dateRangeDuration(aTime, bTime) {
    let minutes = Math.round(Math.abs(Number(bTime) - Number(aTime)) / 60000);
    if (!Number.isFinite(minutes) || minutes <= 0) return "0m";
    const days = Math.floor(minutes / 1440); minutes %= 1440;
    const hours = Math.floor(minutes / 60); minutes %= 60;
    return [days ? `${days}D` : "", hours ? `${hours}h` : "", minutes ? `${minutes}m` : ""].filter(Boolean).join(" ") || "0m";
  }
  function compactVolume(value) {
    const amount = Math.abs(Number(value) || 0), units = [[1e12, "T"], [1e9, "B"], [1e6, "M"], [1e3, "K"]], unit = units.find(([size]) => amount >= size);
    if (!unit) return amount.toLocaleString(undefined, { maximumFractionDigits: 2 });
    const scaled = amount / unit[0]; return `${scaled.toLocaleString(undefined, { minimumFractionDigits: scaled < 10 ? 2 : 0, maximumFractionDigits: 2 })}${unit[1]}`;
  }
  function priceGuide(ctx, fromX, plotRight, py, price, color) {
    const line = alignedStroke(py, 1, contextScale(ctx, "y")); ctx.setLineDash([4, 4]); ctx.strokeStyle = color; ctx.lineWidth = line.lineWidth; ctx.beginPath(); ctx.moveTo(fromX, line.value); ctx.lineTo(plotRight, line.value); ctx.stroke(); ctx.setLineDash([]); priceScaleLabel(ctx, plotRight, line.value, price, color);
  }
  function priceScaleLabel(ctx, plotRight, py, price, color) {
    const label = price.toLocaleString(undefined, { maximumFractionDigits: 6 }), transformScale = Math.max(1, ctx.getTransform().a || 1), logicalCanvasWidth = ctx.canvas.width / transformScale, available = Math.max(1, logicalCanvasWidth - plotRight); let fontSize = 10;
    ctx.font = `bold ${fontSize}px Arial`; let measured = ctx.measureText(label).width;
    if (measured + 8 > available) { fontSize = Math.max(7, Math.floor(fontSize * (available - 8) / Math.max(1, measured))); ctx.font = `bold ${fontSize}px Arial`; measured = ctx.measureText(label).width; }
    const width = Math.min(available, Math.max(44, measured + 9)); ctx.fillStyle = color; ctx.fillRect(plotRight, py - 9, width, 18); ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(label, plotRight + width / 2, py);
  }
  function drawToolDrawing(ctx, drawing, start, x, y, w, h, low, high, selected = false, preview = false) {
    if (!drawing?.a) return; const toX = (p) => x + (nearestIndex(p.time) - start) / Math.max(1, state.zoomBars - 1) * w, toY = (p) => y + h - (p.price - low) / Math.max(1e-12, high - low) * h, ax = toX(drawing.a), ay = toY(drawing.a);
    if (drawing.type === "text") { const style = drawing.style || {}, fontSize = Math.max(8, Math.min(48, Number(style.fontSize) || 14)), lines = String(drawing.text || "Text").split("\n"); ctx.font = `${fontSize}px Arial`; ctx.textAlign = "left"; ctx.textBaseline = "top"; const width = Math.max(...lines.map((line) => ctx.measureText(line || " ").width), 8), lineHeight = fontSize * 1.25, height = lines.length * lineHeight; ctx.fillStyle = style.color || "#111111"; lines.forEach((line, index) => ctx.fillText(line, ax, ay + index * lineHeight)); if (selected) { ctx.setLineDash([4, 3]); ctx.strokeStyle = "#2962ff"; ctx.lineWidth = 1; ctx.strokeRect(ax - 4, ay - 4, width + 8, height + 8); ctx.setLineDash([]); ctx.fillStyle = "#fff"; ctx.strokeStyle = "#2962ff"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(ax, ay, 4.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); } return { left: ax - 7, right: ax + width + 7, top: ay - 7, bottom: ay + height + 7, anchors: [{ name: "a", x: ax, y: ay }] }; }
    if (!drawing.b) return; const bx = toX(drawing.b), by = toY(drawing.b), left = Math.min(ax, bx), right = Math.max(ax, bx), top = Math.min(ay, by), bottom = Math.max(ay, by), value = (n) => Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 6 }); let longStopY = null;
    ctx.setLineDash([]);
    if (drawing.type === "trend") { const style = drawing.style || {}, color = style.color || "#f23645", dash = style.dash || "solid"; ctx.strokeStyle = color; ctx.lineWidth = Math.max(1, Math.min(8, Number(style.lineWidth) || 4)); ctx.setLineDash(dash === "dash" ? [10, 7] : dash === "dot" ? [2, 5] : []); ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke(); ctx.setLineDash([]); }
    if (drawing.type === "dateRange") {
      const firstIndex = nearestIndex(drawing.a.time), secondIndex = nearestIndex(drawing.b.time), fromIndex = Math.min(firstIndex, secondIndex), toIndex = Math.max(firstIndex, secondIndex), bars = Math.abs(secondIndex - firstIndex), volume = state.rows.slice(Math.max(0, fromIndex), Math.min(state.rows.length, toIndex + 1)).reduce((sum, row) => sum + (row.volume || 0), 0), centerX = (ax + bx) / 2, centerY = (ay + by) / 2, boxTop = Math.min(ay, by), boxBottom = Math.max(ay, by), boxHeight = Math.max(14, boxBottom - boxTop), fillTop = boxBottom - boxTop < 14 ? centerY - 7 : boxTop, direction = bx >= ax ? 1 : -1, arrowSize = 7;
      ctx.fillStyle = "rgba(255,152,0,.48)"; ctx.fillRect(left, fillTop, Math.max(1, right - left), boxHeight);
      ctx.strokeStyle = "#2962ff"; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(ax, centerY); ctx.lineTo(bx, centerY); ctx.moveTo(bx - direction * arrowSize, centerY - arrowSize); ctx.lineTo(bx, centerY); ctx.lineTo(bx - direction * arrowSize, centerY + arrowSize); ctx.stroke();
      const line1 = `${bars} bars, ${dateRangeDuration(drawing.a.time, drawing.b.time)}`, line2 = `Vol ${compactVolume(volume)}`; ctx.font = "bold 10px Arial"; const labelWidth = Math.max(ctx.measureText(line1).width, ctx.measureText(line2).width) + 14, labelHeight = 35, labelLeft = centerX - labelWidth / 2, labelTop = fillTop - labelHeight - 5; ctx.fillStyle = "#2962ff";
      if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(labelLeft, labelTop, labelWidth, labelHeight, 4); ctx.fill(); } else ctx.fillRect(labelLeft, labelTop, labelWidth, labelHeight);
      ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(line1, centerX, labelTop + 10.5); ctx.fillText(line2, centerX, labelTop + 25);
    }
    if (drawing.type === "range") { const boxLeft = Math.min(ax, bx) - 6, boxRight = Math.max(ax, bx) + 6, delta = drawing.b.price - drawing.a.price, percent = drawing.a.price ? delta / drawing.a.price * 100 : 0, arrowX = (boxLeft + boxRight) / 2, direction = by > ay ? 1 : -1, signed = (n, digits = 6) => `${n > 0 ? "+" : ""}${n.toLocaleString(undefined, { maximumFractionDigits: digits })}`, text = `${signed(delta)} (${signed(percent, 2)}%)`, labelTop = direction < 0 ? by - 23 : by + 5; ctx.fillStyle = "rgba(41,98,255,.20)"; ctx.fillRect(boxLeft, top, Math.max(12, boxRight - boxLeft), Math.max(1, bottom - top)); ctx.strokeStyle = "#2962ff"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(boxLeft, ay); ctx.lineTo(boxRight, ay); ctx.moveTo(boxLeft, by); ctx.lineTo(boxRight, by); ctx.moveTo(arrowX, ay); ctx.lineTo(arrowX, by); ctx.moveTo(arrowX - 7, by - direction * 8); ctx.lineTo(arrowX, by); ctx.lineTo(arrowX + 7, by - direction * 8); ctx.stroke(); labelBox(ctx, text, arrowX, labelTop, "#f8fafc"); ctx.fillStyle = "#111"; ctx.fillText(text, arrowX, labelTop + 9.5); if (selected) { priceGuide(ctx, boxRight, x + w, ay, drawing.a.price, "#2962ff"); priceGuide(ctx, boxRight, x + w, by, drawing.b.price, "#2962ff"); } }
    if (drawing.type === "long") { const entry = drawing.a.price, target = drawing.b.price >= entry ? drawing.b.price : entry + Math.abs(drawing.b.price - entry), risk = Math.max(Math.abs(target - entry), Math.abs(entry) * .001), stop = drawing.c?.price ?? entry - risk, ey = toY({ price: entry }), ty = toY({ price: target }), sy = toY({ price: stop }), boxLeft = Math.min(ax, bx), boxRight = Math.max(ax, bx), width = Math.max(24, boxRight - boxLeft), rr = Math.abs((target - entry) / Math.max(1e-12, entry - stop)), percentTarget = entry ? (target - entry) / entry * 100 : 0, percentStop = entry ? (entry - stop) / entry * 100 : 0; longStopY = sy; ctx.fillStyle = "rgba(8,153,129,.20)"; ctx.fillRect(boxLeft, Math.min(ty, ey), width, Math.abs(ey - ty)); ctx.fillStyle = "rgba(242,54,69,.18)"; ctx.fillRect(boxLeft, Math.min(ey, sy), width, Math.abs(sy - ey)); ctx.strokeStyle = "#089981"; ctx.lineWidth = 1.2; ctx.strokeRect(boxLeft, Math.min(ty, ey), width, Math.abs(ey - ty)); ctx.strokeStyle = "#f23645"; ctx.strokeRect(boxLeft, Math.min(ey, sy), width, Math.abs(sy - ey)); if (selected || preview) { labelBox(ctx, `Target: ${value(target - entry)} (${percentTarget.toFixed(2)}%)`, boxLeft + width / 2, Math.min(ty, ey) - 23, "#089981"); labelBox(ctx, `Risk/reward ratio: ${rr.toFixed(2)}`, boxLeft + width / 2, ey - 10, "#f23645"); labelBox(ctx, `Stop: ${value(entry - stop)} (${percentStop.toFixed(2)}%)`, boxLeft + width / 2, Math.max(ey, sy) + 4, "#f23645"); } if (selected) { priceGuide(ctx, boxLeft + width, x + w, ty, target, "#089981"); priceGuide(ctx, boxLeft + width, x + w, ey, entry, "#6b7280"); priceGuide(ctx, boxLeft + width, x + w, sy, stop, "#f23645"); } }
    const anchors = drawing.type === "long" ? [{ name: "a", x: ax, y: ay }, { name: "b", x: bx, y: by }, { name: "c", x: ax, y: longStopY }] : [{ name: "a", x: ax, y: ay }, { name: "b", x: bx, y: by }];
    if (selected || preview) for (const anchor of anchors) { if (!Number.isFinite(anchor.y)) continue; ctx.fillStyle = "#fff"; ctx.strokeStyle = "#2962ff"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(anchor.x, anchor.y, 4.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
    const extraBottom = drawing.type === "long" && Number.isFinite(longStopY) ? longStopY : bottom, topPadding = drawing.type === "dateRange" ? 50 : 28; return { left: left - 10, right: Math.max(right, left + 24) + 10, top: Math.min(top, extraBottom) - topPadding, bottom: Math.max(bottom, extraBottom) + 28, anchors, ...(drawing.type === "trend" ? { line: true, ax, ay, bx, by } : {}) };
  }
  function drawReplaySelection(ctx, start, x, y, w, h) {
    if (state.replay.selecting !== "bar" || state.hoverIndex == null) return;
    const px = x + (state.hoverIndex - start) / Math.max(1, state.zoomBars - 1) * w;
    if (px < x || px > x + w) return;
    const line = alignedStroke(px, 1.5, contextScale(ctx, "x")), fill = alignedFillRange(line.value, x + w, contextScale(ctx, "x"));
    ctx.fillStyle = "rgba(255,255,255,.68)"; ctx.fillRect(fill.from, y, fill.to - fill.from, h);
    ctx.strokeStyle = "#2962ff"; ctx.lineWidth = line.lineWidth; ctx.setLineDash([]); ctx.beginPath(); ctx.moveTo(line.value, y); ctx.lineTo(line.value, y + h); ctx.stroke();
    ctx.fillStyle = "#2962ff"; ctx.font = "16px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillText("✂", line.value, y + 6);
  }
  function priceLegendRow() {
    const hovered = state.hoverPane === "price" && Number.isInteger(state.hoverIndex) ? state.rows[state.hoverIndex] : null;
    return hovered || state.rows.at(-1) || null;
  }
  function priceLegendData() {
    const row = priceLegendRow(); if (!row) return null;
    const change = row.close - row.open, percent = row.open ? change / row.open * 100 : 0, value = (number) => number.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 });
    return { candleColor: row.close >= row.open ? "#089981" : "#f23645", changeColor: change >= 0 ? "#089981" : "#f23645", parts: [`O${value(row.open)}`, `H${value(row.high)}`, `L${value(row.low)}`, `C${value(row.close)}`], delta: `${change >= 0 ? "+" : ""}${value(change)} (${percent >= 0 ? "+" : ""}${percent.toFixed(2)}%)` };
  }
  function updatePriceLegend() {
    const element = shadow?.querySelector(".price-legend"), legend = priceLegendData();
    if (!element) return;
    element.replaceChildren();
    element.hidden = !legend;
    if (!legend) return;
    const lead = document.createElement("span"); lead.className = "price-legend-lead";
    const dot = document.createElement("i"); dot.className = "price-legend-dot"; dot.style.backgroundColor = legend.candleColor;
    lead.append(dot, document.createTextNode(legend.parts[0])); element.appendChild(lead);
    for (const value of legend.parts.slice(1)) { const part = document.createElement("span"); part.textContent = value; element.appendChild(part); }
    const delta = document.createElement("span"); delta.className = "price-legend-delta"; delta.style.color = legend.changeColor; delta.textContent = legend.delta; element.appendChild(delta);
  }
  function renderPrice(start, end) {
    const canvas = shadow.querySelector(".price-canvas"); updatePriceLegend(); if (!canvas || !state.rows?.length) return;
    const rect = canvas.getBoundingClientRect();
    const grid = canvasPixelGrid(canvas, rect);
    const ctx = canvas.getContext("2d"); ctx.setTransform(grid.x, 0, 0, grid.y, 0, 0); ctx.clearRect(0, 0, rect.width, rect.height);
    if (rect.width < 40 || rect.height < 40) { state.lastPriceView = null; return; }
    const x = 8, y = 8, w = rect.width - 82, h = rect.height - 16, dataStart = Math.max(0, start), dataEnd = Math.min(state.rows.length, end), rows = state.rows.slice(dataStart, dataEnd);
    let rawLow = Math.min(...rows.map((r) => r.low)), rawHigh = Math.max(...rows.map((r) => r.high)); const baseRange = Math.max(rawHigh - rawLow, rawHigh * .001) * 1.12, baseMid = (rawHigh + rawLow) / 2, range = baseRange / Math.max(.15, state.priceScale), mid = baseMid + state.priceShift * baseRange, low = mid - range / 2, high = mid + range / 2; state.lastPriceView = { low, high, mid, range, baseRange, baseMid, dataStart, dataEnd };
    const py = (price) => y + h - (price - low) / Math.max(1e-12, high - low) * h;
    ctx.font = "10px Arial";
    for (const tick of timeTicks(start, w, (value) => ctx.measureText(value).width)) { const px = alignedStroke(x + (tick.index - start) / Math.max(1, state.zoomBars - 1) * w, 1, grid.x); ctx.strokeStyle = tick.major ? "rgba(0,0,0,.14)" : "rgba(0,0,0,.075)"; ctx.lineWidth = px.lineWidth; ctx.beginPath(); ctx.moveTo(px.value, y); ctx.lineTo(px.value, y + h); ctx.stroke(); }
    for (let g = 0; g <= 4; g++) { const line = alignedStroke(y + g / 4 * h, 1, grid.y), gy = line.value, price = high - g / 4 * (high - low); ctx.strokeStyle = "rgba(0,0,0,.09)"; ctx.lineWidth = line.lineWidth; ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x + w, gy); ctx.stroke(); ctx.fillStyle = "#111"; ctx.font = "10px Arial"; ctx.textAlign = "left"; ctx.fillText(price.toLocaleString(undefined, { maximumFractionDigits: 6 }), x + w + 5, gy + 3); }
    const slot = w / Math.max(1, state.zoomBars - 1), bodyWidth = Math.max(2, Math.min(12, slot * .68));
    rows.forEach((row, j) => { const px = x + (dataStart + j - start) / Math.max(1, state.zoomBars - 1) * w, up = row.close >= row.open, body = candlePixelGeometry(px, bodyWidth, py(Math.max(row.open, row.close)), py(Math.min(row.open, row.close)), grid); ctx.strokeStyle = "#000"; ctx.lineWidth = body.wick.lineWidth; ctx.beginPath(); ctx.moveTo(body.wick.value, py(row.high)); ctx.lineTo(body.wick.value, py(row.low)); ctx.stroke(); fillAndStrokeAlignedRect(ctx, body, grid, up ? "#fff" : "#000", "#000"); });
    const liveIndex = state.rows.length - 1, liveColor = state.replay.active ? "#2962ff" : "#171b26";
    if (liveIndex >= start && liveIndex < end) { const livePrice = state.rows[liveIndex].close, line = alignedStroke(py(livePrice), 1, grid.y), liveY = line.value, liveLabel = livePrice.toLocaleString(undefined, { maximumFractionDigits: 6 }); ctx.setLineDash([2, 3]); ctx.strokeStyle = liveColor; ctx.lineWidth = line.lineWidth; ctx.beginPath(); ctx.moveTo(x, liveY); ctx.lineTo(x + w, liveY); ctx.stroke(); ctx.setLineDash([]); ctx.font = "bold 10px Arial"; ctx.fillStyle = liveColor; ctx.fillRect(x + w, liveY - 9, 58, 18); ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(liveLabel, x + w + 29, liveY); }
    state.drawingHitAreas = [];
    fibs().forEach((fib, index) => { const selected = state.selectedDrawing?.type === "fib" && state.selectedDrawing.key === fibKey() && state.selectedDrawing.index === index, bounds = drawFibonacci(ctx, fib, start, x, y, w, h, low, high, false, selected); if (bounds) state.drawingHitAreas.push({ type: "fib", pane: "price", key: fibKey(), index, ...bounds }); });
    toolDrawings().forEach((drawing, index) => { if (drawing.pane === "rsi") return; const selected = state.selectedDrawing?.type === drawing.type && state.selectedDrawing.key === fibKey() && state.selectedDrawing.index === index, bounds = drawToolDrawing(ctx, drawing, start, x, y, w, h, low, high, selected); if (bounds) state.drawingHitAreas.push({ type: drawing.type, pane: "price", key: fibKey(), index, ...bounds }); });
    if (state.fibDraft) drawFibonacci(ctx, state.fibDraft, start, x, y, w, h, low, high, true);
    if (state.toolDraft?.pane !== "rsi") drawToolDrawing(ctx, state.toolDraft, start, x, y, w, h, low, high, false, true);
    drawReplaySelection(ctx, start, x, y, w, h);
    if (state.replay.active) { ctx.fillStyle = "rgba(17,24,39,.10)"; ctx.font = "bold 30px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("◀◀ Replay", x + w / 2, y + h / 2); }
    const plotRight = x + w;
    ctx.fillStyle = "#fff"; ctx.fillRect(plotRight, 0, Math.max(0, rect.width - plotRight), rect.height);
    const priceDivider = alignedStroke(plotRight, 1, grid.x); ctx.strokeStyle = "rgba(0,0,0,.12)"; ctx.lineWidth = priceDivider.lineWidth; ctx.beginPath(); ctx.moveTo(priceDivider.value, 0); ctx.lineTo(priceDivider.value, rect.height); ctx.stroke();
    for (let g = 0; g <= 4; g++) { const gy = y + g / 4 * h, price = high - g / 4 * (high - low); ctx.fillStyle = "#111"; ctx.font = "10px Arial"; ctx.textAlign = "left"; ctx.textBaseline = "alphabetic"; ctx.fillText(price.toLocaleString(undefined, { maximumFractionDigits: 6 }), plotRight + 5, gy + 3); }
    const selectedPriceDrawing = state.selectedDrawing?.pane !== "rsi" ? selectedDrawingObject() : null;
    if (selectedPriceDrawing?.type === "range") { priceScaleLabel(ctx, plotRight, py(selectedPriceDrawing.a.price), selectedPriceDrawing.a.price, "#2962ff"); priceScaleLabel(ctx, plotRight, py(selectedPriceDrawing.b.price), selectedPriceDrawing.b.price, "#2962ff"); }
    if (selectedPriceDrawing?.type === "long") { const entry = selectedPriceDrawing.a.price, target = selectedPriceDrawing.b.price, stop = selectedPriceDrawing.c?.price ?? entry - Math.max(Math.abs(target - entry), Math.abs(entry) * .001); priceScaleLabel(ctx, plotRight, py(target), target, "#089981"); priceScaleLabel(ctx, plotRight, py(entry), entry, "#6b7280"); priceScaleLabel(ctx, plotRight, py(stop), stop, "#f23645"); }
    if (selectedPriceDrawing?.type === "trend") { const color = selectedPriceDrawing.style?.color || "#f23645"; priceScaleLabel(ctx, plotRight, py(selectedPriceDrawing.a.price), selectedPriceDrawing.a.price, color); priceScaleLabel(ctx, plotRight, py(selectedPriceDrawing.b.price), selectedPriceDrawing.b.price, color); }
    if (liveIndex >= start && liveIndex < end) { const livePrice = state.rows[liveIndex].close; priceScaleLabel(ctx, plotRight, py(livePrice), livePrice, liveColor); }
    if (state.hoverIndex != null && state.hoverIndex >= start && state.hoverIndex < start + state.zoomBars) { const px = alignedStroke(x + (state.hoverIndex - start) / Math.max(1, state.zoomBars - 1) * w, 1, grid.x); ctx.setLineDash([6,5]); ctx.strokeStyle = "rgba(55,65,81,.75)"; ctx.lineWidth = px.lineWidth; ctx.beginPath(); ctx.moveTo(px.value, y); ctx.lineTo(px.value, y + h); ctx.stroke(); ctx.setLineDash([]); }
    if (state.hoverPane === "price" && state.hoverYRatio != null) { const line = alignedStroke(y + state.hoverYRatio * h, 1, grid.y), hy = line.value, price = high - state.hoverYRatio * (high - low); ctx.setLineDash([3,3]); ctx.strokeStyle = "#111"; ctx.lineWidth = line.lineWidth; ctx.beginPath(); ctx.moveTo(x, hy); ctx.lineTo(plotRight, hy); ctx.stroke(); ctx.setLineDash([]); priceScaleLabel(ctx, plotRight, hy, price, "#171b26"); }
  }
  function render() {
    const canvas = shadow.querySelector(".rsi-canvas"); if (!canvas || !state.closes.length) return;
    const rect = canvas.getBoundingClientRect();
    const grid = canvasPixelGrid(canvas, rect);
    const ctx = canvas.getContext("2d"); ctx.setTransform(grid.x, 0, 0, grid.y, 0, 0); ctx.clearRect(0, 0, rect.width, rect.height);
    const main = rsi(state.closes), fast = ema(main, 9), slow = wma(main, 45);
    const { start, end } = viewRange(main.length);
    renderPrice(start, end);
    if (rect.width < 40 || rect.height < 40) return;
    const x = 8, y = 8, w = rect.width - 82, h = rect.height - 34;
    const visibleCount = Math.max(1, state.zoomBars), barWidth = w / visibleCount;
    [[90,80,"rgba(200,230,201,.40)"],[80,60,"rgba(126,87,194,.20)"],[60,40,"rgba(126,87,194,.10)"],[40,20,"rgba(126,87,194,.20)"],[20,10,"rgba(255,224,178,.20)"]].forEach(([hi,lo,color]) => {
      ctx.fillStyle = color; ctx.fillRect(x, y + h * (1 - hi / 100), w, h * (hi - lo) / 100);
    });
    for (let i = start; i < end; i++) {
      if (main[i] > 80 || main[i] < 20) {
        ctx.fillStyle = main[i] > 80 ? "rgba(76,175,80,.50)" : "rgba(255,152,0,.50)";
        const band = alignedFillRange(x + (i - start) * barWidth, x + (i - start) * barWidth + Math.ceil(barWidth) + 1, grid.x); ctx.fillRect(band.from, y, band.to - band.from, h);
      }
    }
    for (const level of [10,20,30,40,50,60,70,80,90]) {
      const major = level === 30 || level === 70, line = alignedStroke(y + h * (1 - level / 100), major ? 1.6 : .7, grid.y), py = line.value;
      ctx.strokeStyle = major ? "rgba(255,255,255,.82)" : "rgba(255,255,255,.38)"; ctx.lineWidth = line.lineWidth; ctx.setLineDash(major ? [] : [4,4]);
      ctx.beginPath(); ctx.moveTo(x, py); ctx.lineTo(x + w, py); ctx.stroke(); ctx.fillStyle = "#555"; ctx.font = "10px Arial"; ctx.textAlign = "left"; ctx.fillText(level, x + w + 6, py + 3);
    }
    ctx.setLineDash([]);
    plot(ctx, main.slice(0, end), "#ab47bc", 2.2, start, x, y, w, h); plot(ctx, fast.slice(0, end), "#66bb6a", 1.4, start, x, y, w, h); plot(ctx, slow.slice(0, end), "#5e9cf6", 1.4, start, x, y, w, h);
    toolDrawings().forEach((drawing, index) => { if (drawing.pane !== "rsi" || drawing.type !== "trend") return; const selected = state.selectedDrawing?.type === "trend" && state.selectedDrawing.key === fibKey() && state.selectedDrawing.index === index, bounds = drawToolDrawing(ctx, drawing, start, x, y, w, h, 0, 100, selected); if (bounds) state.drawingHitAreas.push({ type: "trend", pane: "rsi", key: fibKey(), index, ...bounds }); });
    if (state.toolDraft?.pane === "rsi" && state.toolDraft.type === "trend") drawToolDrawing(ctx, state.toolDraft, start, x, y, w, h, 0, 100, false, true);
    drawReplaySelection(ctx, start, x, y, w, h);
    const axisLine = alignedStroke(y + h, 1, grid.y); ctx.strokeStyle = "rgba(255,255,255,.55)"; ctx.lineWidth = axisLine.lineWidth; ctx.beginPath(); ctx.moveTo(x, axisLine.value); ctx.lineTo(x + w, axisLine.value); ctx.stroke();
    ctx.font = "10px Arial"; ctx.fillStyle = "#111"; ctx.textAlign = "center"; ctx.textBaseline = "top";
    const ticks = timeTicks(start, w, (value) => ctx.measureText(value).width);
    for (let t = 0; t < ticks.length; t++) {
      const tick = ticks[t], line = alignedStroke(x + (tick.index - start) / Math.max(1, state.zoomBars - 1) * w, 1, grid.x), px = line.value;
      ctx.strokeStyle = tick.major ? "rgba(0,0,0,.14)" : "rgba(0,0,0,.075)"; ctx.lineWidth = line.lineWidth; ctx.beginPath(); ctx.moveTo(px, y); ctx.lineTo(px, y + h); ctx.stroke();
      ctx.fillStyle = "#111"; ctx.textAlign = tick.align; ctx.font = tick.major ? "bold 10px Arial" : "10px Arial"; ctx.fillText(tick.label, px, y + h + 6);
    }
    const selectedDateRange = state.selectedDrawing?.type === "dateRange" ? selectedDrawingObject() : null, dateRangeForAxis = state.toolDraft?.type === "dateRange" ? state.toolDraft : selectedDateRange;
    if (dateRangeForAxis?.a && dateRangeForAxis?.b) {
      for (const anchor of [dateRangeForAxis.a, dateRangeForAxis.b]) {
        const px = x + (nearestIndex(anchor.time) - start) / Math.max(1, state.zoomBars - 1) * w, label = formatDateRangeTime(anchor.time); ctx.font = "bold 10px Arial"; const labelWidth = ctx.measureText(label).width + 12, labelHeight = 21, labelX = Math.max(x, Math.min(x + w - labelWidth, px - labelWidth / 2)), labelY = y + h + 3; ctx.fillStyle = "#2962ff";
        if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(labelX, labelY, labelWidth, labelHeight, 3); ctx.fill(); } else ctx.fillRect(labelX, labelY, labelWidth, labelHeight);
        ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(label, labelX + labelWidth / 2, labelY + labelHeight / 2);
      }
    }
    if (state.hoverIndex != null && state.hoverIndex >= start && state.hoverIndex < start + state.zoomBars) {
      const hoverLine = alignedStroke(x + (state.hoverIndex - start) / Math.max(1, state.zoomBars - 1) * w, 1, grid.x), px = hoverLine.value;
      ctx.setLineDash([6, 5]); ctx.strokeStyle = "rgba(55,65,81,.75)"; ctx.lineWidth = hoverLine.lineWidth;
      ctx.beginPath(); ctx.moveTo(px, y); ctx.lineTo(px, y + h); ctx.stroke(); ctx.setLineDash([]);
      const label = formatHoverTime(timeAt(state.hoverIndex)), padding = 9; ctx.font = "bold 11px Arial";
      const labelWidth = ctx.measureText(label).width + padding * 2, labelHeight = 22;
      const labelX = Math.max(x, Math.min(x + w - labelWidth, px - labelWidth / 2)), labelY = y + h + 3;
      ctx.fillStyle = "#171b26";
      if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(labelX, labelY, labelWidth, labelHeight, 3); ctx.fill(); } else ctx.fillRect(labelX, labelY, labelWidth, labelHeight);
      ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(label, labelX + labelWidth / 2, labelY + labelHeight / 2);
    }
    const visibleLast = Math.min(main.length, end) - 1, current = main[visibleLast]; shadow.querySelector(".values").innerHTML = `<b class="rsi">RSI ${fmt(current)}</b><b class="fast">EMA ${fmt(fast[visibleLast])}</b><b class="slow">WMA ${fmt(slow[visibleLast])}</b>`;
    updateDrawingMenu();
  }

  const mapKlines = (payload) => payload.map((k) => ({ time: Number(k[0]), open: Number(k[1]), high: Number(k[2]), low: Number(k[3]), close: Number(k[4]), volume: Number(k[5]) || 0, closeTime: Number(k[6]) }));
  function mergeRaw(...groups) {
    const unique = new Map(); for (const row of groups.flat()) if (Number.isFinite(row?.time)) unique.set(row.time, row);
    return [...unique.values()].sort((a, b) => a.time - b.time);
  }
  async function fetchKlines(current, params) {
    const query = new URLSearchParams({ symbol: state.symbol, interval: current.interval, ...params });
    const response = await fetch(`https://api.binance.com/api/v3/klines?${query}`); if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return mapKlines(await response.json());
  }
  function stopReplayTimer() { clearTimeout(replayTimer); replayTimer = null; }
  function stopReplayPanAnimation() { cancelAnimationFrame(replayPanFrame); replayPanFrame = null; }
  function animateReplayPan(targetPan, duration = 650) {
    stopReplayPanAnimation(); const from = state.panBars, started = performance.now(), distance = targetPan - from;
    if (Math.abs(distance) < .01) { state.panBars = targetPan; render(); return; }
    const frame = (now) => {
      const progress = Math.min(1, (now - started) / duration), eased = progress < .5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;
      state.panBars = clampPan(from + distance * eased); render();
      if (progress < 1 && state.replay.active) replayPanFrame = requestAnimationFrame(frame); else replayPanFrame = null;
    };
    replayPanFrame = requestAnimationFrame(frame);
  }
  function formatReplayDate(timestamp) {
    if (!Number.isFinite(timestamp)) return "Select bar";
    const d = new Date(timestamp), pad = (n) => String(n).padStart(2, "0"); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  function updateReplayUI() {
    if (!shadow) return; const panel = shadow.querySelector(".panel"), replayButton = shadow.querySelector(".replay-button"), bar = shadow.querySelector(".replay-bar");
    panel?.classList.toggle("replay-open", state.replay.open); replayButton?.classList.toggle("active", state.replay.open);
    if (!bar) return; bar.querySelector(".replay-goto-label").textContent = "Select bar";
    const play = bar.querySelector(".replay-play"), forward = bar.querySelector(".replay-forward"), speed = bar.querySelector(".replay-speed"), interval = bar.querySelector(".replay-interval");
    play.innerHTML = state.replay.playing ? ICONS.pause : ICONS.play; play.title = state.replay.playing ? "Tạm dừng" : "Phát replay"; play.disabled = !state.replay.active || state.replay.loading || Boolean(state.replay.selecting);
    forward.disabled = !state.replay.active || state.replay.loading || Boolean(state.replay.selecting); speed.disabled = !state.replay.active || state.replay.loading || Boolean(state.replay.selecting); speed.value = String(state.replay.speed); interval.textContent = tf().label;
    bar.classList.toggle("loading", state.replay.loading); syncCandleCountdownTimer();
  }
  function setReplayPlaying(playing) {
    state.replay.playing = Boolean(playing && state.replay.active && !state.replay.loading); stopReplayTimer(); updateReplayUI();
    if (!state.replay.playing) return;
    replayTimer = setTimeout(() => { ignoreFailure(stepReplay().then(() => { if (state.replay.playing) setReplayPlaying(true); })); }, Math.max(80, 1000 / state.replay.speed));
  }
  async function startReplayAt(targetTime, refetch = true, focusStart = null, cutSelectedBar = false) {
    if (!state.symbol || !Number.isFinite(targetTime)) return; setReplayPlaying(false); stopReplayPanAnimation(); const current = tf(), symbol = state.symbol, generation = ++state.loadGeneration;
    state.replay.open = true; state.replay.selecting = null; state.replay.loading = true; state.replay.active = false; state.replay.exhaustedFuture = false; updateReplayUI();
    if (state.socket) { state.socket.onclose = null; state.socket.close(); state.socket = null; }
    setStatus("Đang tải replay…");
    try {
      if (refetch) {
        const [before, after] = await Promise.all([fetchKlines(current, { endTime: String(Math.floor(targetTime)), limit: "600" }), fetchKlines(current, { startTime: String(Math.floor(targetTime + 1)), limit: "1000" })]);
        if (generation !== state.loadGeneration || symbol !== state.symbol || current.label !== tf().label) return;
        state.raw = mergeRaw(before, after);
      }
      const available = rowsForTimeframe(state.raw), selected = available.reduce((nearest, row) => !nearest || Math.abs(row.time - targetTime) < Math.abs(nearest.time - targetTime) ? row : nearest, null);
      if (!selected) throw new Error("Không có dữ liệu tại thời điểm đã chọn");
      const selectedIndex = available.findIndex((row) => row.time === selected.time), cutoff = cutSelectedBar ? available[selectedIndex - 1] : selected;
      if (!cutoff) throw new Error("Cần có ít nhất một nến trước điểm bắt đầu replay");
      state.replay.time = cutoff.time; state.replay.active = true; state.replay.loading = false;
      rebuild(); const targetPan = -Math.min(30, Math.max(10, Math.round(state.zoomBars * .2)));
      state.panBars = Number.isFinite(focusStart) ? clampPan(state.closes.length - state.zoomBars - focusStart) : targetPan;
      setStatus(`REPLAY · ${formatReplayDate(state.replay.time)}`); updateReplayUI(); render();
      if (Number.isFinite(focusStart)) animateReplayPan(targetPan);
    } catch (e) { if (generation === state.loadGeneration) { state.replay.loading = false; state.replay.active = false; setStatus(`Lỗi replay: ${e.message}`); updateReplayUI(); render(); } }
  }
  async function stepReplay() {
    if (!state.replay.active || state.replay.loading) return false;
    let available = rowsForTimeframe(state.raw), next = available.find((row) => row.time > state.replay.time);
    if (!next && !state.replay.exhaustedFuture) {
      const current = tf(), generation = state.loadGeneration, symbol = state.symbol, lastTime = state.raw.at(-1)?.time;
      state.replay.loading = true; updateReplayUI();
      try {
        const newer = await fetchKlines(current, { startTime: String(Math.floor(lastTime + 1)), limit: "1000" });
        if (generation !== state.loadGeneration || symbol !== state.symbol || current.label !== tf().label) return false;
        state.replay.exhaustedFuture = newer.length < 1000; state.raw = mergeRaw(state.raw, newer); available = rowsForTimeframe(state.raw); next = available.find((row) => row.time > state.replay.time);
      } catch (e) { setStatus(`Lỗi replay: ${e.message}`); }
      finally { state.replay.loading = false; updateReplayUI(); }
    }
    if (!next) { setReplayPlaying(false); state.replay.exhaustedFuture = true; setStatus("REPLAY · đã tới hiện tại"); updateReplayUI(); return false; }
    state.replay.time = next.time; rebuild(); setStatus(`REPLAY · ${formatReplayDate(state.replay.time)}`); updateReplayUI(); render(); return true;
  }
  function beginReplayBarSelection() {
    setReplayPlaying(false); stopReplayPanAnimation(); state.replay.open = true; state.replay.selecting = "bar"; rebuild(); setStatus(state.replay.active ? "Chọn lại một nến cũ hơn" : "Chọn nến bắt đầu replay"); updateReplayUI(); render();
  }
  function requestExitReplay() {
    if (!state.replay.open) return; setReplayPlaying(false); stopReplayPanAnimation(); shadow?.querySelector(".replay-menu")?.classList.remove("show"); shadow?.querySelector(".replay-date-dialog")?.classList.remove("show");
    confirmationController?.open({ title: "Thoát Bar Replay?", message: "Chart sẽ trở về dữ liệu realtime và kết thúc phiên replay hiện tại.", cancelLabel: "Ở lại", confirmLabel: "Thoát replay", onConfirm: exitReplay, returnFocus: shadow?.activeElement });
  }
  function openReplay() { beginReplayBarSelection(); }
  function exitReplay() {
    setReplayPlaying(false); stopReplayPanAnimation(); state.replay.open = false; state.replay.selecting = null; state.replay.active = false; state.replay.time = null; state.replay.loading = false; state.replay.exhaustedFuture = false;
    shadow?.querySelector(".replay-menu")?.classList.remove("show"); shadow?.querySelector(".replay-date-dialog")?.classList.remove("show"); confirmationController?.close(false); updateReplayUI(); ignoreFailure(load());
  }

  async function load() {
    if (!state.symbol) return; if (state.socket) { state.socket.onclose = null; state.socket.close(); state.socket = null; }
    const current = tf(), generation = ++state.loadGeneration; state.loadingOlder = false; state.historyExhausted = false; state.countdownTimeframe = null; updateCandleCountdown(); setStatus("Đang tải…");
    try {
      const limit = 1000, url = `https://api.binance.com/api/v3/klines?symbol=${state.symbol}&interval=${current.interval}&limit=${limit}`;
      const response = await fetch(url); if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json(); if (generation !== state.loadGeneration) return; state.raw = mapKlines(payload); state.historyExhausted = payload.length < limit; state.panBars = 0; rebuild(); state.countdownTimeframe = current.label; updateCandleCountdown(); render(); setStatus(state.replay.open ? "Chọn điểm bắt đầu replay" : "Đang kết nối…"); if (!state.replay.open) connect();
    } catch (e) { setStatus(`Lỗi: ${e.message}`); }
  }
  async function maybeLoadOlder() {
    if (state.loadingOlder || state.historyExhausted || !state.raw.length || !state.symbol) return;
    const oldestVisible = viewRange().start; if (oldestVisible > 24) return;
    const current = tf(), generation = state.loadGeneration, symbol = state.symbol, endTime = state.raw[0].time - 1; state.loadingOlder = true; setStatus("Đang tải lịch sử…");
    try {
      const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${current.interval}&endTime=${endTime}&limit=1000`, response = await fetch(url); if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json(); if (generation !== state.loadGeneration || symbol !== state.symbol || current.label !== tf().label) return;
      const older = mapKlines(payload); if (!older.length) state.historyExhausted = true; else { state.raw = [...older, ...state.raw]; state.historyExhausted = older.length < 1000; rebuild(); render(); }
      setStatus(state.replay.active ? `REPLAY · ${formatReplayDate(state.replay.time)}` : state.historyExhausted ? "LIVE · hết lịch sử" : "LIVE");
    } catch (e) { if (generation === state.loadGeneration) setStatus(`Lỗi lịch sử: ${e.message}`); }
    finally { if (generation === state.loadGeneration) state.loadingOlder = false; }
  }
  function connect() {
    if (state.replay.open) return;
    const current = tf(); let socket;
    try { socket = new WebSocket(`wss://stream.binance.com:9443/ws/${state.symbol.toLowerCase()}@kline_${current.interval}`); } catch { setStatus("Mất kết nối"); return; }
    state.socket = socket; setStatus("Đang kết nối…");
    socket.onopen = () => { if (state.socket === socket && !state.replay.open) setStatus("LIVE"); };
    socket.onmessage = (event) => {
      const payload = JSON.parse(event.data), k = payload.data?.k || payload.k; if (!k) return;
      const next = { time: Number(k.t), open: Number(k.o), high: Number(k.h), low: Number(k.l), close: Number(k.c), volume: Number(k.v) || 0, closeTime: Number(k.T) };
      if (!Number.isFinite(next.time) || next.time > Date.now() + 60000) return;
      const existing = state.raw.findIndex((row) => row.time === next.time), lastTime = state.raw.at(-1)?.time ?? -Infinity;
      if (existing >= 0) Object.assign(state.raw[existing], next);
      else if (next.time > lastTime) { state.raw.push(next); if (state.panBars > 0) state.panBars += 1; }
      else return;
      rebuild(); render();
    };
    socket.onclose = () => { if (state.visible && !state.replay.open && state.socket === socket) { setStatus("Mất kết nối · đang thử lại…"); setTimeout(connect, 2500); } };
  }
  function select(label) {
    if (state.selected === label && state.closes.length) return; state.selected = label; state.panBars = 0;
    state.selectedDrawing = null; state.fibDraft = null; state.toolDraft = null; state.drawingTool = null; shadow.querySelectorAll(".drawing-tool").forEach((b) => b.classList.remove("active")); updateDrawingMenu();
    shadow.querySelectorAll(".tab").forEach((b) => b.classList.toggle("active", b.dataset.tf === label)); storeSet({ selected: label });
    if (state.replay.active && Number.isFinite(state.replay.time)) ignoreFailure(startReplayAt(state.replay.time, true)); else ignoreFailure(load());
  }
  function geometry() {
    const p = shadow.querySelector(".panel"); p.style.left = `${Math.max(0, state.left)}px`; p.style.top = `${Math.max(0, state.top)}px`;
    p.style.width = `${state.width || Math.max(500, innerWidth - 16)}px`; p.style.height = `${state.height}px`;
  }
  function positionOnly(panel) {
    panel.style.left = `${Math.max(0, state.left)}px`; panel.style.top = `${Math.max(0, state.top)}px`;
  }
  function drag(handle, panel) {
    let d;
    handle.addEventListener("pointerdown", (e) => { if (e.target.closest("button,input")) return; const r = panel.getBoundingClientRect(); d = { x: e.clientX - r.left, y: e.clientY - r.top }; handle.setPointerCapture(e.pointerId); });
    handle.addEventListener("pointermove", (e) => { if (!d) return; state.left = Math.max(0, Math.min(innerWidth - 90, e.clientX - d.x)); state.top = Math.max(0, Math.min(innerHeight - 40, e.clientY - d.y)); positionOnly(panel); });
    handle.addEventListener("pointerup", () => { if (d) { d = null; storeSet({ left: state.left, top: state.top }); } });
  }
  function selectedDrawingObject(selection = state.selectedDrawing) { if (!selection) return null; return selection.type === "fib" ? state.fibDrawings[selection.key]?.[selection.index] : state.toolDrawings[selection.key]?.[selection.index]; }
  const drawingSnapshot = () => structuredClone({ fibDrawings: state.fibDrawings, toolDrawings: state.toolDrawings });
  function updateHistoryButtons() {
    const undoButton = shadow?.querySelector(".undo-drawing"), redoButton = shadow?.querySelector(".redo-drawing");
    if (undoButton) undoButton.disabled = !state.historyPast.length;
    if (redoButton) redoButton.disabled = !state.historyFuture.length;
  }
  function pushDrawingHistory() {
    state.historyPast.push(drawingSnapshot()); if (state.historyPast.length > 100) state.historyPast.shift(); state.historyFuture = []; updateHistoryButtons();
  }
  function restoreDrawingSnapshot(snapshot) {
    state.fibDrawings = snapshot.fibDrawings; state.toolDrawings = snapshot.toolDrawings; state.selectedDrawing = null; state.fibDraft = null; state.toolDraft = null; state.drawingTool = null;
    shadow?.querySelectorAll(".drawing-tool.active").forEach((button) => button.classList.remove("active")); storeSet({ fibDrawings: state.fibDrawings, toolDrawings: state.toolDrawings }); updateDrawingMenu(); updateHistoryButtons(); render();
  }
  function undoDrawing() { if (!state.historyPast.length) return; state.historyFuture.push(drawingSnapshot()); restoreDrawingSnapshot(state.historyPast.pop()); }
  function redoDrawing() { if (!state.historyFuture.length) return; state.historyPast.push(drawingSnapshot()); restoreDrawingSnapshot(state.historyFuture.pop()); }
  function replaceSelectedDrawing(drawing, selection = state.selectedDrawing) { if (!selection) return; if (selection.type === "fib") { const list = [...(state.fibDrawings[selection.key] || [])]; list[selection.index] = drawing; state.fibDrawings = { ...state.fibDrawings, [selection.key]: list }; } else { const list = [...(state.toolDrawings[selection.key] || [])]; list[selection.index] = drawing; state.toolDrawings = { ...state.toolDrawings, [selection.key]: list }; } }
  function updateSelectedStyle(patch) {
    const drawing = selectedDrawingObject(), type = state.selectedDrawing?.type; if (!drawing) return; pushDrawingHistory();
    replaceSelectedDrawing({ ...drawing, style: { ...(drawing.style || {}), ...patch } });
    if (type === "text" || type === "trend") state.toolDefaults = { ...state.toolDefaults, [type]: { ...(state.toolDefaults[type] || {}), ...patch } };
    storeSet({ toolDrawings: state.toolDrawings, toolDefaults: state.toolDefaults }); render();
  }
  const DRAWING_ACTIONS = {
    fib: {
      title: "Fibonacci Retracement",
      remove(selection) {
        pushDrawingHistory();
        const list = [...(state.fibDrawings[selection.key] || [])]; list.splice(selection.index, 1); state.fibDrawings = { ...state.fibDrawings, [selection.key]: list }; storeSet({ fibDrawings: state.fibDrawings });
      }
    },
    trend: { title: "Trend Line", remove: removeToolDrawing },
    range: { title: "Price Range", remove: removeToolDrawing },
    dateRange: { title: "Date Range", remove: removeToolDrawing },
    long: { title: "Long Position", remove: removeToolDrawing },
    text: { title: "Text", remove: removeToolDrawing }
  };
  function removeToolDrawing(selection) { pushDrawingHistory(); const list = [...(state.toolDrawings[selection.key] || [])]; list.splice(selection.index, 1); state.toolDrawings = { ...state.toolDrawings, [selection.key]: list }; storeSet({ toolDrawings: state.toolDrawings }); }
  function updateDrawingMenu() {
    const menu = shadow?.querySelector(".drawing-menu"), selection = state.selectedDrawing; if (!menu) return;
    if (!selection || !DRAWING_ACTIONS[selection.type]) { menu.classList.remove("show"); return; }
    const hit = state.drawingHitAreas.find((x) => x.type === selection.type && x.key === selection.key && x.index === selection.index); if (!hit) { menu.classList.remove("show"); return; }
    const panel = shadow.querySelector(".panel"), canvasRect = shadow.querySelector(hit.pane === "rsi" ? ".rsi-canvas" : ".price-canvas").getBoundingClientRect(), panelRect = panel.getBoundingClientRect(), center = canvasRect.left - panelRect.left + (hit.left + hit.right) / 2, top = canvasRect.top - panelRect.top + hit.top;
    const drawing = selectedDrawingObject(selection), style = drawing?.style || {}; menu.querySelector(".drawing-name").textContent = DRAWING_ACTIONS[selection.type].title; menu.dataset.type = selection.type; menu.querySelector(".text-color").value = style.color || "#111111"; menu.querySelector(".text-size").value = String(style.fontSize || 14); menu.querySelector(".trend-color").value = style.color || "#f23645"; menu.querySelector(".trend-width").value = String(style.lineWidth || 4); menu.querySelector(".trend-dash").value = style.dash || "solid"; const autoLeft = Math.max(48, Math.min(panel.clientWidth - 360, center - 140)), autoTop = Math.max(8, top - 38), position = state.menuPosition || { left: autoLeft, top: autoTop }; menu.style.left = `${Math.max(4, Math.min(panel.clientWidth - 80, position.left))}px`; menu.style.top = `${Math.max(4, Math.min(panel.clientHeight - 36, position.top))}px`; menu.classList.add("show");
  }
  function enableDrawingMenuDrag(menu, panel) {
    const handle = menu.querySelector(".drawing-menu-handle"); let dragState = null;
    handle.addEventListener("pointerdown", (e) => { const menuRect = menu.getBoundingClientRect(), panelRect = panel.getBoundingClientRect(); dragState = { x: e.clientX, y: e.clientY, left: menuRect.left - panelRect.left, top: menuRect.top - panelRect.top }; handle.setPointerCapture(e.pointerId); e.preventDefault(); e.stopPropagation(); });
    handle.addEventListener("pointermove", (e) => { if (!dragState) return; state.menuPosition = { left: dragState.left + e.clientX - dragState.x, top: dragState.top + e.clientY - dragState.y }; updateDrawingMenu(); });
    handle.addEventListener("pointerup", () => { dragState = null; });
  }
  function updateDrawingPointerHover(canvas, pane, e, index) {
    const rect = canvas.getBoundingClientRect(); state.hoverPane = pane; state.hoverIndex = index;
    if (pane === "price") state.hoverYRatio = Math.max(0, Math.min(1, (e.clientY - rect.top - 8) / Math.max(1, rect.height - 16)));
  }
  function snapTrendPoint(point, stationary, stationaryClient, shift) {
    if (!shift || !stationary || !stationaryClient) return { ...point };
    const dx = Math.abs(point.clientX - stationaryClient.clientX), dy = Math.abs(point.clientY - stationaryClient.clientY);
    return dx >= dy ? { ...point, price: stationary.price, clientY: stationaryClient.clientY } : { ...point, time: stationary.time, clientX: stationaryClient.clientX };
  }
  function enableDrawingSelection(canvas, pane = "price") {
    let edit = null;
    const pointFromEvent = (e) => { const rect = canvas.getBoundingClientRect(), x = 8, y = 8, w = rect.width - 82, h = pane === "rsi" ? rect.height - 34 : rect.height - 16, ratioX = Math.max(0, Math.min(1, (e.clientX - rect.left - x) / Math.max(1, w))), ratioY = Math.max(0, Math.min(1, (e.clientY - rect.top - y) / Math.max(1, h))), index = Math.round(viewRange().start + ratioX * (state.zoomBars - 1)), view = state.lastPriceView; return { index, time: timeAt(index), price: pane === "rsi" ? 100 * (1 - ratioY) : view ? view.high - ratioY * view.range : 0, clientX: e.clientX, clientY: e.clientY }; };
    const getDrawing = (selection) => selection.type === "fib" ? state.fibDrawings[selection.key]?.[selection.index] : state.toolDrawings[selection.key]?.[selection.index];
    const setDrawing = (selection, drawing) => { if (selection.type === "fib") { const list = [...(state.fibDrawings[selection.key] || [])]; list[selection.index] = drawing; state.fibDrawings = { ...state.fibDrawings, [selection.key]: list }; } else { const list = [...(state.toolDrawings[selection.key] || [])]; list[selection.index] = drawing; state.toolDrawings = { ...state.toolDrawings, [selection.key]: list }; } };
    canvas.addEventListener("pointerdown", (e) => {
      if (state.replay.selecting) return;
      if (state.drawingTool) return; const rect = canvas.getBoundingClientRect(), px = e.clientX - rect.left, py = e.clientY - rect.top, paneAreas = [...state.drawingHitAreas].reverse().filter((area) => area.pane === pane), selectedFirst = (area) => state.selectedDrawing && area.type === state.selectedDrawing.type && area.key === state.selectedDrawing.key && area.index === state.selectedDrawing.index, anchorCandidates = paneAreas.flatMap((area) => (area.anchors || []).map((anchor) => ({ area, anchor, distance: Math.hypot(px - anchor.x, py - anchor.y) }))).filter((candidate) => candidate.distance <= 18).sort((a, b) => Number(selectedFirst(b.area)) - Number(selectedFirst(a.area)) || a.distance - b.distance), anchorHit = anchorCandidates[0] || null, hitTest = (area) => { if (!area.line) return px >= area.left && px <= area.right && py >= area.top && py <= area.bottom; const dx = area.bx - area.ax, dy = area.by - area.ay, length2 = dx * dx + dy * dy, t = length2 ? Math.max(0, Math.min(1, ((px - area.ax) * dx + (py - area.ay) * dy) / length2)) : 0, lx = area.ax + t * dx, ly = area.ay + t * dy; return Math.hypot(px - lx, py - ly) <= 9; }, hit = anchorHit?.area || paneAreas.find(hitTest);
      if (!hit) { if (state.selectedDrawing) { state.selectedDrawing = null; updateDrawingMenu(); render(); } return; }
      e.preventDefault(); e.stopImmediatePropagation(); const nextSelection = { type: hit.type, pane, key: hit.key, index: hit.index }, changed = !state.selectedDrawing || state.selectedDrawing.type !== hit.type || state.selectedDrawing.key !== hit.key || state.selectedDrawing.index !== hit.index; state.selectedDrawing = nextSelection; if (changed) state.menuPosition = null;
      const anchor = anchorHit?.area === hit ? anchorHit.anchor : hit.anchors?.find((a) => Math.hypot(px - a.x, py - a.y) <= 18), original = structuredClone(getDrawing(nextSelection)), otherAnchorName = original?.type === "trend" && anchor?.name === "a" ? "b" : original?.type === "trend" && anchor?.name === "b" ? "a" : null, otherAnchor = otherAnchorName ? hit.anchors?.find((a) => a.name === otherAnchorName) : null, session = Symbol("drawing-edit"); edit = { session, selection: nextSelection, original, anchor: anchor?.name || null, startPoint: pointFromEvent(e), rawPoint: pointFromEvent(e), stationaryName: otherAnchorName, stationaryClient: otherAnchor ? { clientX: rect.left + otherAnchor.x, clientY: rect.top + otherAnchor.y } : null, moved: false }; if (e.shiftKey || e.getModifierState?.("Shift")) setDrawingShiftPressed(true); activeDrawingEdit = { session, owner: canvas, applyShift: (pressed) => { if (edit?.session === session && edit.moved && edit.original?.type === "trend" && edit.anchor && edit.rawPoint) applyEditPoint(edit.rawPoint, pressed); } }; canvas.setPointerCapture(e.pointerId); render(); requestAnimationFrame(updateDrawingMenu);
    }, true);
    const applyEditPoint = (current, shift) => {
      if (!edit) return; const drawing = structuredClone(edit.original);
      if (edit.anchor) { const point = drawing.type === "trend" && edit.stationaryName ? snapTrendPoint(current, drawing[edit.stationaryName], edit.stationaryClient, shift) : current; let price = point.price; const epsilon = Math.max(Math.abs(drawing.a.price) * .0001, 1e-8); if (drawing.type === "long" && edit.anchor === "b") price = Math.max(drawing.a.price + epsilon, price); if (drawing.type === "long" && edit.anchor === "c") price = Math.min(drawing.a.price - epsilon, price); drawing[edit.anchor] = { ...(drawing[edit.anchor] || drawing.a), time: edit.anchor === "c" ? drawing.a.time : point.time, price }; }
      else { const deltaBars = nearestIndex(current.time) - nearestIndex(edit.startPoint.time), deltaPrice = current.price - edit.startPoint.price; for (const name of ["a", "b", "c"]) if (drawing[name]) drawing[name] = { ...drawing[name], time: timeAt(nearestIndex(drawing[name].time) + deltaBars), price: drawing[name].price + deltaPrice }; }
      setDrawing(edit.selection, drawing); render();
    };
    canvas.addEventListener("pointermove", (e) => { if (!edit) return; const current = pointFromEvent(e); edit.rawPoint = current; if (e.shiftKey || e.getModifierState?.("Shift")) setDrawingShiftPressed(true); updateDrawingPointerHover(canvas, pane, e, current.index); if (!edit.moved) pushDrawingHistory(); edit.moved = true; applyEditPoint(current, drawingShiftPressed || e.shiftKey || e.getModifierState?.("Shift")); });
    const stopEdit = () => { if (!edit) return; if (edit.moved) storeSet(edit.selection.type === "fib" ? { fibDrawings: state.fibDrawings } : { toolDrawings: state.toolDrawings }); const session = edit.session; edit = null; if (activeDrawingEdit?.session === session) activeDrawingEdit = null; updateDrawingMenu(); };
    canvas.addEventListener("pointerup", stopEdit); canvas.addEventListener("pointercancel", stopEdit); canvas.addEventListener("lostpointercapture", stopEdit);
  }
  function enableFibTool(canvas, button) {
    let dragStart = null;
    const pointFromEvent = (e) => {
      const rect = canvas.getBoundingClientRect(), x = 8, y = 8, w = rect.width - 82, h = rect.height - 16, ratioX = Math.max(0, Math.min(1, (e.clientX - rect.left - x) / Math.max(1, w))), ratioY = Math.max(0, Math.min(1, (e.clientY - rect.top - y) / Math.max(1, h))), index = Math.round(viewRange().start + ratioX * (state.zoomBars - 1)), view = state.lastPriceView;
      return { time: timeAt(index), price: view ? view.high - ratioY * view.range : 0, clientX: e.clientX, clientY: e.clientY };
    };
    const finish = () => {
      if (!state.fibDraft) return; const key = fibKey(), drawing = { a: state.fibDraft.a, b: state.fibDraft.b };
      pushDrawingHistory();
      state.fibDrawings = { ...state.fibDrawings, [key]: [...fibs(), drawing] }; state.selectedDrawing = { type: "fib", key, index: state.fibDrawings[key].length - 1 }; state.fibDraft = null; state.drawingTool = null; button.classList.remove("active"); storeSet({ fibDrawings: state.fibDrawings }); render(); requestAnimationFrame(updateDrawingMenu);
    };
    button.onclick = () => { const wasActive = state.drawingTool === "fib"; shadow.querySelectorAll(".drawing-tool").forEach((b) => b.classList.remove("active")); state.drawingTool = wasActive ? null : "fib"; state.fibDraft = null; state.toolDraft = null; button.classList.toggle("active", state.drawingTool === "fib"); canvas.focus(); render(); };
    canvas.addEventListener("pointerdown", (e) => {
      if (state.drawingTool !== "fib") return; e.preventDefault(); e.stopImmediatePropagation(); const point = pointFromEvent(e);
      if (state.fibDraft) { state.fibDraft.b = point; finish(); return; }
      state.fibDraft = { a: point, b: point }; dragStart = point; canvas.setPointerCapture(e.pointerId); render();
    }, true);
    canvas.addEventListener("pointermove", (e) => { if (state.drawingTool !== "fib" || !state.fibDraft) return; state.fibDraft.b = pointFromEvent(e); render(); });
    canvas.addEventListener("pointerup", (e) => { if (!dragStart || !state.fibDraft) return; const distance = Math.hypot(e.clientX - dragStart.clientX, e.clientY - dragStart.clientY); dragStart = null; if (distance > 5) finish(); });
    addEventListener("keydown", (e) => { if (e.key === "Escape" && state.drawingTool === "fib") { state.drawingTool = null; state.fibDraft = null; button.classList.remove("active"); render(); } });
  }
  function enableTextTool(canvas, button, editor, panel) {
    let pending = null, editingSelection = null, closing = false;
    const pointFromEvent = (e) => { const rect = canvas.getBoundingClientRect(), x = 8, y = 8, w = rect.width - 82, h = rect.height - 16, ratioX = Math.max(0, Math.min(1, (e.clientX - rect.left - x) / Math.max(1, w))), ratioY = Math.max(0, Math.min(1, (e.clientY - rect.top - y) / Math.max(1, h))), index = Math.round(viewRange().start + ratioX * (state.zoomBars - 1)), view = state.lastPriceView; return { time: timeAt(index), price: view ? view.high - ratioY * view.range : 0 }; };
    const openEditor = (point, value, e, selection = null) => { pending = point; editingSelection = selection; const panelRect = panel.getBoundingClientRect(); editor.style.left = `${Math.max(48, Math.min(panel.clientWidth - 170, e.clientX - panelRect.left))}px`; editor.style.top = `${Math.max(4, Math.min(panel.clientHeight - 48, e.clientY - panelRect.top))}px`; editor.value = value; editor.classList.add("show"); requestAnimationFrame(() => { editor.focus(); editor.select(); }); };
    const closeEditor = (save) => {
      if (closing || !pending) return; closing = true; const text = editor.value.trim(), point = pending, selection = editingSelection; pending = null; editingSelection = null; editor.classList.remove("show");
      if (save && text) { pushDrawingHistory(); const key = fibKey(); if (selection) { const previous = selectedDrawingObject(selection); if (previous) { replaceSelectedDrawing({ ...previous, text }, selection); state.selectedDrawing = selection; } } else { const drawing = { type: "text", a: point, text, style: { ...state.toolDefaults.text } }, list = [...toolDrawings(), drawing]; state.toolDrawings = { ...state.toolDrawings, [key]: list }; state.selectedDrawing = { type: "text", key, index: list.length - 1 }; } state.menuPosition = null; storeSet({ toolDrawings: state.toolDrawings }); }
      state.drawingTool = null; button.classList.remove("active"); render(); requestAnimationFrame(() => { updateDrawingMenu(); closing = false; });
    };
    button.onclick = () => { const wasActive = state.drawingTool === "text"; shadow.querySelectorAll(".drawing-tool").forEach((b) => b.classList.remove("active")); state.drawingTool = wasActive ? null : "text"; state.fibDraft = null; state.toolDraft = null; button.classList.toggle("active", state.drawingTool === "text"); if (wasActive && pending) closeEditor(false); };
    canvas.addEventListener("pointerdown", (e) => { if (state.drawingTool !== "text") return; e.preventDefault(); e.stopImmediatePropagation(); if (pending) { closeEditor(true); return; } openEditor(pointFromEvent(e), "", e); }, true);
    canvas.addEventListener("dblclick", (e) => { const rect = canvas.getBoundingClientRect(), px = e.clientX - rect.left, py = e.clientY - rect.top, hit = [...state.drawingHitAreas].reverse().find((area) => area.pane === "price" && area.type === "text" && px >= area.left && px <= area.right && py >= area.top && py <= area.bottom); if (!hit) return; e.preventDefault(); e.stopImmediatePropagation(); const selection = { type: "text", pane: "price", key: hit.key, index: hit.index }, drawing = selectedDrawingObject(selection); if (!drawing) return; state.selectedDrawing = selection; state.drawingTool = "text"; button.classList.add("active"); openEditor(drawing.a, drawing.text || "", e, selection); }, true);
    editor.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.preventDefault(); closeEditor(false); } else if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); closeEditor(true); } });
    editor.addEventListener("blur", () => { if (pending) closeEditor(true); });
  }
  function enableTwoPointTool(canvas, button, type, pane = "price", bindButton = true) {
    let dragStart = null;
    const pointFromEvent = (e) => { const rect = canvas.getBoundingClientRect(), x = 8, y = 8, w = rect.width - 82, h = pane === "rsi" ? rect.height - 34 : rect.height - 16, ratioX = Math.max(0, Math.min(1, (e.clientX - rect.left - x) / Math.max(1, w))), ratioY = Math.max(0, Math.min(1, (e.clientY - rect.top - y) / Math.max(1, h))), index = Math.round(viewRange().start + ratioX * (state.zoomBars - 1)), view = state.lastPriceView; return { index, time: timeAt(index), price: pane === "rsi" ? 100 * (1 - ratioY) : view ? view.high - ratioY * view.range : 0, clientX: e.clientX, clientY: e.clientY }; };
    const snapped = (point, shift) => type === "trend" && state.toolDraft ? snapTrendPoint(point, state.toolDraft.a, state.toolDraft.a, shift) : point;
    const finish = () => { if (!state.toolDraft) return; pushDrawingHistory(); const key = fibKey(), a = state.toolDraft.a, b = state.toolDraft.b, targetPrice = type === "long" && b.price < a.price ? a.price + Math.abs(b.price - a.price) : b.price, drawing = { type, pane, a: { time: a.time, price: a.price }, b: { time: b.time, price: targetPrice }, ...(type === "trend" ? { style: { ...(state.toolDraft.style || state.toolDefaults.trend) } } : {}), ...(type === "long" ? { c: { time: a.time, price: a.price - Math.max(Math.abs(targetPrice - a.price), Math.abs(a.price) * .001) } } : {}) }, list = [...toolDrawings(), drawing]; state.toolDrawings = { ...state.toolDrawings, [key]: list }; state.selectedDrawing = { type, key, index: list.length - 1, pane }; state.menuPosition = null; state.toolDraft = null; state.drawingTool = null; button.classList.remove("active"); storeSet({ toolDrawings: state.toolDrawings }); render(); requestAnimationFrame(updateDrawingMenu); };
    if (bindButton) button.onclick = () => { shadow.querySelectorAll(".drawing-tool").forEach((b) => b.classList.remove("active")); state.drawingTool = state.drawingTool === type ? null : type; state.fibDraft = null; state.toolDraft = null; button.classList.toggle("active", state.drawingTool === type); render(); };
    canvas.addEventListener("pointerdown", (e) => { if (state.drawingTool !== type || (state.toolDraft && state.toolDraft.pane !== pane)) return; e.preventDefault(); e.stopImmediatePropagation(); const rawPoint = pointFromEvent(e), point = snapped(rawPoint, e.shiftKey); updateDrawingPointerHover(canvas, pane, e, rawPoint.index); if (state.toolDraft) { state.toolDraft.rawB = rawPoint; state.toolDraft.b = point; finish(); return; } state.toolDraft = { type, pane, a: point, b: point, ...(type === "trend" ? { rawB: rawPoint, style: { ...state.toolDefaults.trend } } : {}) }; dragStart = point; canvas.setPointerCapture(e.pointerId); render(); }, true);
    canvas.addEventListener("pointermove", (e) => { if (state.drawingTool !== type || !state.toolDraft || state.toolDraft.pane !== pane) return; const rawPoint = pointFromEvent(e); if (type === "trend") state.toolDraft.rawB = rawPoint; state.toolDraft.b = snapped(rawPoint, e.shiftKey); updateDrawingPointerHover(canvas, pane, e, rawPoint.index); render(); });
    canvas.addEventListener("pointerup", (e) => { if (!dragStart || !state.toolDraft) return; const distance = Math.hypot(e.clientX - dragStart.clientX, e.clientY - dragStart.clientY); dragStart = null; if (distance > 5) finish(); });
    addEventListener("keydown", (e) => { if (e.key === "Escape" && state.drawingTool === type) { state.drawingTool = null; state.toolDraft = null; button.classList.remove("active"); render(); return; } if (e.key === "Shift" && type === "trend" && state.drawingTool === type && state.toolDraft?.pane === pane && state.toolDraft.rawB) { state.toolDraft.b = snapped(state.toolDraft.rawB, true); render(); } });
    addEventListener("keyup", (e) => { if (e.key === "Shift" && type === "trend" && state.drawingTool === type && state.toolDraft?.pane === pane && state.toolDraft.rawB) { state.toolDraft.b = { ...state.toolDraft.rawB }; render(); } });
  }
  function enablePriceScaleZoom(hitbox) {
    let startY = null, startScale = 1, anchorPrice = 0, anchorRatio = .5, anchorView = null;
    const hover = (e) => { const rect = hitbox.getBoundingClientRect(); state.hoverPane = "price"; state.hoverIndex = null; state.hoverYRatio = Math.max(0, Math.min(1, (e.clientY - rect.top) / Math.max(1, rect.height))); render(); };
    hitbox.addEventListener("pointerdown", (e) => { const view = state.lastPriceView, canvasRect = shadow.querySelector(".price-canvas")?.getBoundingClientRect(), plotTop = (canvasRect?.top ?? hitbox.getBoundingClientRect().top) + 8, plotHeight = Math.max(1, (canvasRect?.height ?? hitbox.getBoundingClientRect().height) - 16); e.preventDefault(); e.stopPropagation(); state.hoverIndex = null; startY = e.clientY; startScale = state.priceScale; anchorView = view ? { ...view } : null; anchorRatio = Math.max(0, Math.min(1, (e.clientY - plotTop) / plotHeight)); anchorPrice = view ? view.high - anchorRatio * view.range : 0; hitbox.setPointerCapture(e.pointerId); hitbox.classList.add("dragging"); });
    hitbox.addEventListener("pointermove", (e) => { hover(e); if (startY == null || !anchorView) return; e.preventDefault(); e.stopPropagation(); const nextScale = Math.max(.15, Math.min(20, startScale * Math.exp((startY - e.clientY) * PRICE_SCALE_DRAG_EXP_PER_PX))), newRange = anchorView.baseRange / nextScale, desiredMid = anchorPrice + (anchorRatio - .5) * newRange; state.priceScale = nextScale; state.priceShift = (desiredMid - anchorView.baseMid) / anchorView.baseRange; render(); });
    const stop = (e) => { if (startY == null) return; e?.stopPropagation(); startY = null; hitbox.classList.remove("dragging"); storeSet({ priceShift: state.priceShift, priceScale: state.priceScale }); };
    hitbox.addEventListener("pointerup", stop); hitbox.addEventListener("pointercancel", stop); hitbox.addEventListener("mouseleave", () => { if (startY == null) { state.hoverPane = null; state.hoverYRatio = null; render(); } });
  }
  function enablePan(canvas) {
    let startX = null, startY = null, startPan = 0, startShift = 0, startZoom = 0, mode = "pan";
    canvas.addEventListener("pointerdown", (e) => {
      if (state.drawingTool || state.replay.selecting) return;
      const rect = canvas.getBoundingClientRect(); startX = e.clientX; startY = e.clientY; startPan = state.panBars; startShift = state.priceShift;
      mode = canvas.classList.contains("rsi-canvas") && e.clientY - rect.top > rect.height - 30 ? "timeZoom" : state.crossMode && canvas.classList.contains("price-canvas") ? "crossPan" : "pan";
      if (mode === "timeZoom") startZoom = state.zoomBars;
      canvas.classList.add("dragging"); canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener("pointermove", (e) => {
      if (startX == null) return;
      const rect = canvas.getBoundingClientRect();
      if (mode === "timeZoom") { const x = rect.left + 8, w = rect.width - 82, nextZoom = timeScaleDragZoom(startZoom, startX, e.clientX, x, w); state.zoomBars = nextZoom; state.panBars = clampPan(startPan, nextZoom); const slider = shadow.querySelector(".zoom input"); slider.value = state.zoomBars; shadow.querySelector(".zoom output").value = state.zoomBars; }
      else if (mode === "crossPan") { const pixelsPerBar = Math.max(2, rect.width / state.zoomBars), delta = Math.round((e.clientX - startX) / pixelsPerBar), plotHeight = Math.max(1, rect.height - 16); state.panBars = clampPan(startPan + delta); state.priceShift = startShift + (e.clientY - startY) / plotHeight / Math.max(.15, state.priceScale); }
      else { const pixelsPerBar = Math.max(2, rect.width / state.zoomBars), delta = Math.round((e.clientX - startX) / pixelsPerBar); state.panBars = clampPan(startPan + delta); }
      render(); if (mode === "pan" || mode === "crossPan") ignoreFailure(maybeLoadOlder());
    });
    const stop = () => { if (startX != null) { storeSet({ zoomBars: state.zoomBars, priceShift: state.priceShift, priceScale: state.priceScale, panBars: state.panBars }); ignoreFailure(maybeLoadOlder()); } startX = null; canvas.classList.remove("dragging"); };
    canvas.addEventListener("pointerup", stop); canvas.addEventListener("pointercancel", stop);
    canvas.addEventListener("dblclick", () => { state.panBars = 0; render(); });
  }
  function enableCrosshair(canvas) {
    canvas.addEventListener("mousemove", (e) => {
      if (!state.closes.length) return;
      const hoverRect = canvas.getBoundingClientRect(); canvas.classList.toggle("time-scale", canvas.classList.contains("rsi-canvas") && e.clientY - hoverRect.top > hoverRect.height - 30); state.hoverPane = canvas.classList.contains("price-canvas") ? "price" : "rsi"; state.hoverYRatio = Math.max(0, Math.min(1, (e.clientY - hoverRect.top - 8) / Math.max(1, hoverRect.height - 16)));
      const rect = canvas.getBoundingClientRect(), x = 8, w = rect.width - 82, pointerX = e.clientX - rect.left, { start } = viewRange();
      const ratio = Math.max(0, Math.min(1, (pointerX - x) / Math.max(1, w)));
      state.hoverIndex = pointerX >= x && pointerX <= x + w ? Math.round(start + ratio * Math.max(0, state.zoomBars - 1)) : null; render();
    });
    canvas.addEventListener("mouseleave", () => { canvas.classList.remove("time-scale", "price-scale"); state.hoverIndex = null; state.hoverPane = null; state.hoverYRatio = null; render(); });
  }
  function enableWheelZoom(canvas) {
    canvas.addEventListener("wheel", (e) => {
      e.preventDefault(); const rect = canvas.getBoundingClientRect(), x = 8, w = rect.width - 82, ratio = Math.max(0, Math.min(1, (e.clientX - rect.left - x) / Math.max(1, w))), anchor = viewRange().start + ratio * (state.zoomBars - 1), nextZoom = Math.max(20, Math.min(1000, state.zoomBars + (e.deltaY > 0 ? 10 : -10))), nextStart = Math.round(anchor - ratio * (nextZoom - 1)); state.zoomBars = nextZoom; state.panBars = clampPan(state.closes.length - nextZoom - nextStart, nextZoom);
      const slider = shadow.querySelector(".zoom input"); slider.value = state.zoomBars; shadow.querySelector(".zoom output").value = state.zoomBars; render(); storeSet({ zoomBars: state.zoomBars });
    }, { passive: false });
  }
  function enableSplitter(splitter, pricePane, rsiPane) {
    let startY = null, startPercent = 0;
    splitter.addEventListener("pointerdown", (e) => { startY = e.clientY; startPercent = state.pricePercent; splitter.setPointerCapture(e.pointerId); });
    splitter.addEventListener("pointermove", (e) => {
      if (startY == null) return; const total = pricePane.getBoundingClientRect().height + rsiPane.getBoundingClientRect().height;
      state.pricePercent = Math.max(20, Math.min(80, startPercent + (e.clientY - startY) / Math.max(1, total) * 100)); applyPaneSplit(pricePane, rsiPane); render();
    });
    splitter.addEventListener("pointerup", () => { if (startY != null) storeSet({ pricePercent: state.pricePercent }); startY = null; });
  }
  function applyPaneSplit(pricePane, rsiPane) {
    const priceWeight = Math.max(20, Math.min(80, Number(state.pricePercent) || 64));
    pricePane.style.flex = `${priceWeight} 1 0px`;
    rsiPane.style.flex = `${100 - priceWeight} 1 0px`;
  }
  function enableBorderResize(panel, handles) {
    for (const handle of handles) {
      let start = null;
      handle.addEventListener("pointerdown", (e) => { const r = panel.getBoundingClientRect(); start = { x: e.clientX, y: e.clientY, left: r.left, top: r.top, width: r.width, height: r.height }; handle.setPointerCapture(e.pointerId); e.stopPropagation(); });
      handle.addEventListener("pointermove", (e) => {
        if (!start) return; const dir = handle.dataset.dir, dx = e.clientX - start.x, dy = e.clientY - start.y; let left = start.left, top = start.top, width = start.width, height = start.height;
        if (dir.includes("e")) width = Math.max(500, Math.min(innerWidth - left, start.width + dx));
        if (dir.includes("s")) height = Math.max(240, Math.min(innerHeight - top, start.height + dy));
        if (dir.includes("w")) { width = Math.max(500, Math.min(start.left + start.width, start.width - dx)); left = start.left + start.width - width; }
        if (dir.includes("n")) { height = Math.max(240, Math.min(start.top + start.height, start.height - dy)); top = start.top + start.height - height; }
        state.left = Math.max(0, left); state.top = Math.max(0, top); state.width = Math.round(width); state.height = Math.round(height); panel.style.left = `${state.left}px`; panel.style.top = `${state.top}px`; panel.style.width = `${state.width}px`; panel.style.height = `${state.height}px`; render();
      });
      handle.addEventListener("pointerup", () => { if (start) storeSet({ left: state.left, top: state.top, width: state.width, height: state.height }); start = null; });
    }
  }
  function toggle(force) {
    state.visible = force ?? !state.visible; shadow.querySelector(".panel").classList.toggle("hidden", !state.visible); storeSet({ visible: state.visible });
    if (state.visible) { if (state.replay.open && symbolFromUrl() === state.symbol) { updateReplayUI(); render(); } else refreshSymbol(true); } else { setReplayPlaying(false); if (state.socket) { state.socket.onclose = null; state.socket.close(); state.socket = null; } }
    syncCandleCountdownTimer();
  }
  function refreshSymbol(force = false) {
    const next = symbolFromUrl(); if (!next) { shadow.querySelector(".symbol").textContent = "Mở trang Spot /trade/…"; setStatus("Không có symbol Spot"); return; }
    if (!force && next === state.symbol) return;
    if (state.replay.open && next !== state.symbol) { setReplayPlaying(false); state.replay.open = false; state.replay.selecting = null; state.replay.active = false; state.replay.time = null; state.replay.loading = false; updateReplayUI(); }
    state.symbol = next; shadow.querySelector(".symbol").textContent = next; ignoreFailure(load());
  }
  function mount() {
    const host = document.createElement("div"); host.id = "binance-rsi-mtf-host"; document.documentElement.appendChild(host); shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = `<style>:host{all:initial}.panel,.panel *{cursor:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='18' height='24' viewBox='0 0 18 24'%3E%3Cpath d='M1 1v17l5-5 3 8 3-1-3-8h7z' fill='black'/%3E%3C/svg%3E") 1 1,default!important}.panel{position:fixed;z-index:2147483646;min-width:500px;min-height:240px;max-width:100vw;max-height:100vh;resize:both;overflow:hidden;display:flex;flex-direction:column;background:transparent;border:1px solid rgba(255,255,255,.25);border-radius:8px;color:#111;font:12px Arial,sans-serif;box-shadow:none}.hidden{display:none}.chart{flex:1;min-height:0;padding:7px 5px 2px;background:transparent}.chart canvas{width:100%;height:100%;display:block;touch-action:none}header{height:42px;flex:none;display:flex;flex-wrap:nowrap;align-items:center;gap:7px;padding:0 8px;background:rgba(255,255,255,.18);border-top:1px solid rgba(255,255,255,.28);user-select:none;overflow-x:auto;overflow-y:hidden;white-space:nowrap}.symbol{color:#111}.status{color:#087a55;font-size:10px}.tabs{display:flex;align-items:center;gap:3px}.values{display:flex;align-items:center;gap:8px;margin-left:auto}.values small{color:#222}.rsi{color:#8e24aa}.fast{color:#2e7d32}.slow{color:#245eae}.zoom{display:flex;align-items:center;gap:4px;color:#111}.zoom input{width:95px;accent-color:#c99b00}.zoom output{width:27px;text-align:right;color:#111}button{border:0;background:rgba(255,255,255,.28);color:#111}.tab{padding:5px 9px;border-radius:4px;font-weight:700}.tab:hover,.refresh:hover,.collapse:hover{background:rgba(255,255,255,.55)}.tab.active{background:#f0b90b;color:#111}.refresh,.collapse{padding:5px 8px;border:1px solid rgba(255,255,255,.35);border-radius:4px;font-weight:700}.close{font-size:19px;background:transparent}.panel.collapsed{width:42px!important;height:38px!important;min-width:42px;min-height:38px;resize:none}.collapsed .chart,.collapsed header>*:not(.collapse){display:none}.collapsed header{height:38px;padding:0;justify-content:center;border:0;background:rgba(255,255,255,.28);overflow:hidden}.collapsed .collapse{display:block;width:100%;height:100%;border:0}</style><div class="panel"><main class="chart"><canvas title="Kéo ngang để xem quá khứ; nhấp đúp để về hiện tại"></canvas></main><header><strong class="chart-identity">RSI · <span class="symbol">--</span></strong><span class="status" role="status" aria-live="polite" data-state="loading"></span><nav class="tabs">${TFS.map((x) => `<button class="tab" data-tf="${x.label}">${x.label}</button>`).join("")}</nav><span class="values"></span><label class="zoom">Zoom <input type="range" min="40" max="240" step="10"><output></output></label><button class="refresh" title="Tải lại và về giá hiện tại">↻</button><button class="collapse" title="Thu gọn/mở rộng">▾</button><button class="close" title="Ẩn">×</button></header></div>`;
    const rsiPane = shadow.querySelector(".chart"), rsiCanvas = rsiPane.querySelector("canvas"), bottomBar = shadow.querySelector("header"); rsiCanvas.className = "rsi-canvas"; bottomBar.classList.add("bottom-bar");
    const topbar = document.createElement("div"); topbar.className = "topbar"; const topbarLogo = document.createElement("img"); topbarLogo.className = "topbar-logo"; topbarLogo.src = runtimeUrl("assets/icon.svg"); topbarLogo.alt = ""; topbarLogo.draggable = false; const identitySeparator = document.createElement("span"); identitySeparator.className = "topbar-separator"; identitySeparator.setAttribute("aria-hidden", "true"); topbar.append(topbarLogo, shadow.querySelector(".chart-identity"), identitySeparator, shadow.querySelector(".tabs")); const topbarSeparator = identitySeparator.cloneNode(); topbar.appendChild(topbarSeparator); const replayButton = document.createElement("button"); replayButton.className = "replay-button"; replayButton.title = "Bar Replay"; replayButton.innerHTML = `${ICONS.replay}<span>Replay</span>`; topbar.appendChild(replayButton); topbar.appendChild(shadow.querySelector(".status")); rsiPane.before(topbar);
    const candleCountdown = document.createElement("span"); candleCountdown.className = "candle-countdown"; candleCountdown.setAttribute("aria-label", "Thời gian còn lại đến khi đóng nến"); candleCountdown.setAttribute("aria-live", "off");
    const pricePane = document.createElement("main"); pricePane.className = "price-chart"; pricePane.innerHTML = '<canvas class="price-canvas" title="Chart giá dùng chung time scale với RSI"></canvas><div class="price-legend" role="group" aria-label="Giá nến hiện tại" hidden></div>'; rsiPane.before(pricePane);
    const priceScaleHitbox = document.createElement("div"); priceScaleHitbox.className = "price-scale-hitbox"; priceScaleHitbox.title = "Kéo dọc để zoom trục giá"; pricePane.appendChild(priceScaleHitbox);
    const splitter = document.createElement("div"); splitter.className = "splitter"; splitter.innerHTML = '<button tabindex="-1" aria-label="Kéo để thay đổi chiều cao hai pane" title="Kéo để thay đổi chiều cao hai pane">↕</button>'; pricePane.after(splitter);
    const chartWorkspace = document.createElement("section"); chartWorkspace.className = "chart-workspace"; chartWorkspace.setAttribute("aria-label", "Biểu đồ giá và RSI"); topbar.after(chartWorkspace); chartWorkspace.append(pricePane, splitter, rsiPane);
    const replayBar = document.createElement("div"); replayBar.className = "replay-bar"; replayBar.innerHTML = `<button class="replay-goto" title="Chọn điểm bắt đầu">${ICONS.calendar}<span class="replay-goto-label">Select bar</span></button><button class="replay-play" title="Phát replay">${ICONS.play}</button><button class="replay-forward" title="Tiến một nến">${ICONS.forward}</button><label class="replay-speed-wrap" title="Tốc độ replay"><select class="replay-speed"><option value="0.25">0.25x</option><option value="0.5">0.5x</option><option value="1" selected>1x</option><option value="2">2x</option><option value="3">3x</option><option value="5">5x</option><option value="10">10x</option></select></label><span class="replay-interval">${tf().label}</span><button class="replay-realtime" title="Về biểu đồ realtime">${ICONS.realtime}</button><button class="replay-close" title="Thoát Bar Replay">${ICONS.close}</button>`; bottomBar.before(replayBar);
    const splitterButton = splitter.querySelector("button"); splitterButton.addEventListener("pointerdown", (e) => { e.preventDefault(); splitterButton.blur(); });
    const theme = document.createElement("style");
    theme.textContent = ".panel,.price-chart,.chart{background:#fff}.panel{resize:none;border:2px solid rgba(17,24,39,.58);box-shadow:0 6px 24px rgba(0,0,0,.16)}.chart-workspace{display:flex;flex:1 1 auto;flex-direction:column;min-height:0;overflow:hidden}.price-chart{min-height:0;padding:7px 5px 2px;border-bottom:0;box-sizing:border-box}.price-chart canvas{display:block;width:100%;height:100%;touch-action:none}.chart{min-height:0;box-sizing:border-box}.splitter{height:11px;flex:none;display:flex;align-items:center;justify-content:center;background:#fff;border-top:1px solid #d1d5db;border-bottom:1px solid #d1d5db;cursor:ns-resize!important;user-select:none;-webkit-user-select:none}.splitter button{width:34px;height:15px;line-height:12px;border:1px solid #9ca3af;border-radius:5px;background:#fff;color:#111;cursor:ns-resize!important;user-select:none;-webkit-user-select:none;caret-color:transparent;outline:none}.splitter button:focus,.splitter button:focus-visible{outline:none;box-shadow:none}.rsi-canvas.time-scale{cursor:ew-resize!important}.price-canvas.price-scale{cursor:ns-resize!important}header{background:#fff}.tab{font-size:10px;padding:4px 6px}.tabs{gap:2px}.resize-handle{position:absolute;z-index:20}.resize-handle[data-dir=n]{top:0;left:10px;right:10px;height:7px;cursor:ns-resize!important}.resize-handle[data-dir=s]{bottom:0;left:10px;right:10px;height:7px;cursor:ns-resize!important}.resize-handle[data-dir=e]{right:0;top:10px;bottom:10px;width:7px;cursor:ew-resize!important}.resize-handle[data-dir=w]{left:0;top:10px;bottom:10px;width:7px;cursor:ew-resize!important}.resize-handle[data-dir=ne]{top:0;right:0;width:12px;height:12px;cursor:nesw-resize!important}.resize-handle[data-dir=sw]{bottom:0;left:0;width:12px;height:12px;cursor:nesw-resize!important}.resize-handle[data-dir=nw]{top:0;left:0;width:12px;height:12px;cursor:nwse-resize!important}.resize-handle[data-dir=se]{right:0;bottom:0;width:12px;height:12px;cursor:nwse-resize!important}.panel.collapsed{width:66px!important;height:50px!important;min-width:66px;min-height:50px;border-color:rgba(240,185,11,.75);border-radius:9px;box-shadow:0 5px 18px rgba(0,0,0,.34)}.collapsed .price-chart,.collapsed .splitter,.collapsed .resize-handle{display:none}.collapsed header{height:50px;background:rgba(240,185,11,.90)}.collapsed .collapse{font-size:12px;font-weight:800;color:#111}.tool-active{background:#f0b90b!important}";
    theme.textContent += ".price-chart,.chart{padding-left:44px}.drawing-tools{position:absolute;z-index:15;left:6px;top:10px;width:32px;padding:4px 3px;display:flex;flex-direction:column;align-items:center;gap:4px;background:rgba(255,255,255,.96);border:1px solid #d1d5db;border-radius:6px;box-shadow:0 2px 7px rgba(0,0,0,.10)}.drawing-tool{width:26px;height:27px;border-radius:4px;background:#fff;border:1px solid transparent;font-size:14px;font-weight:700;user-select:none;-webkit-user-select:none;caret-color:transparent;outline:none}.drawing-tool:hover{background:#f3f4f6}.drawing-tool.active{color:#2962ff;background:#edf2ff;border-color:#9db5ff}.drawing-menu{position:absolute;z-index:18;display:none;height:31px;align-items:center;gap:7px;padding:0 7px;background:#fff;border:1px solid #e5e7eb;border-radius:6px;box-shadow:0 3px 12px rgba(0,0,0,.18);user-select:none;-webkit-user-select:none}.drawing-menu.show{display:flex}.drawing-name{font-size:10px;color:#555;white-space:nowrap}.drawing-delete{width:27px;height:25px;border-radius:4px;background:#fff;font-size:16px;outline:none}.drawing-delete:hover{background:#fee2e2;color:#b91c1c}.collapsed .drawing-tools,.collapsed .drawing-menu{display:none}";
    theme.textContent += ".panel button svg,.drawing-menu svg{width:17px;height:17px;display:block;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.drawing-tool{display:grid;place-items:center;color:#374151}.drawing-tools{border-color:#e5e7eb;box-shadow:0 5px 16px rgba(15,23,42,.13)}.drawing-menu{height:36px;border-radius:8px;padding:0 8px 0 4px;gap:5px}.drawing-menu-handle{width:25px;height:30px;display:grid;place-items:center;color:#9ca3af;cursor:move!important}.drawing-menu-handle svg{width:20px;height:20px}.drawing-delete{display:grid;place-items:center;color:#4b5563}.drawing-delete svg{width:18px;height:18px}.zoom{display:none!important}header>button{display:grid;place-items:center;min-width:28px;height:28px;padding:0;border:1px solid #e5e7eb;border-radius:6px;background:#fff;color:#374151}header>button:hover{background:#f3f4f6;color:#111}.panel.fullscreen{left:0!important;top:0!important;width:100vw!important;height:100vh!important;border-radius:0!important}.fullscreen .resize-handle{display:none}.fullscreen-button.active{background:#eef2ff;color:#2962ff;border-color:#a5b4fc}.collapsed .collapse{display:grid!important;place-items:center}.collapsed .collapse svg{width:24px;height:24px}";
    theme.textContent += ".tool-settings{display:none;align-items:center;gap:4px;padding-left:5px;border-left:1px solid #e5e7eb}.drawing-menu[data-type=text] .text-settings,.drawing-menu[data-type=trend] .trend-settings{display:flex}.tool-settings input[type=color]{width:27px;height:25px;padding:2px;border:1px solid #d1d5db;border-radius:5px;background:#fff}.tool-settings select{height:25px;border:1px solid #d1d5db;border-radius:5px;background:#fff;color:#111;font:11px Arial;padding:0 4px;outline:none}.text-editor{position:absolute;z-index:19;display:none;min-width:150px;min-height:34px;padding:6px 8px;border:1px solid #2962ff;border-radius:5px;background:rgba(255,255,255,.96);color:#111;font:14px Arial;resize:both;outline:none;box-shadow:0 3px 12px rgba(0,0,0,.15)}.text-editor.show{display:block}";
    theme.textContent += ".topbar{height:48px;flex:none;display:flex;align-items:center;gap:4px;padding:0 12px 0 8px;background:#fff;border-bottom:1px solid #e5e7eb;box-sizing:border-box;user-select:none;overflow:hidden}.topbar-logo{width:24px;height:24px;display:block;object-fit:contain;flex:none;pointer-events:none;user-select:none;-webkit-user-drag:none}.chart-identity{flex:none;color:#8a6900;font-size:12px}.topbar .tabs{gap:4px;min-width:0;flex:0 1 auto;overflow-x:auto;overflow-y:hidden}.topbar .tab{min-width:38px;height:34px;padding:0 10px;border:1px solid transparent;border-radius:7px;background:#fff;font-size:12px}.topbar .tab:hover{background:#f3f4f6;border-color:#e5e7eb}.topbar .tab.active{background:#e8f0ff;color:#2962ff;border-color:#b7c8ff}.topbar .status{min-width:54px;max-width:180px;margin-left:auto;padding-left:12px;display:flex;align-items:center;justify-content:flex-end;gap:6px;overflow:hidden;flex:0 1 180px;color:#b42318;font-size:10px;font-weight:700;text-align:right;text-overflow:ellipsis;white-space:nowrap}.topbar .status::before{content:\"\";width:7px;height:7px;border-radius:50%;background:#dc2626;flex:none}.topbar .status[data-state=live]{color:#087a55}.topbar .status[data-state=live]::before{background:#16a34a}.topbar .status[data-state=loading]{color:#8a6200}.topbar .status[data-state=loading]::before{background:#eab308}.topbar-separator{width:1px;height:26px;margin:0 7px;background:#d1d5db;flex:none}.candle-countdown{width:38px;color:#4b5563;font-size:9px;line-height:12px;font-variant-numeric:tabular-nums;text-align:center;white-space:nowrap}.price-chart{position:relative}.price-legend{position:absolute;z-index:14;top:12px;left:69px;right:79px;display:flex;flex-wrap:wrap;align-items:center;gap:3px 9px;min-width:0;color:#111;font:12px/14px Arial,sans-serif;font-variant-numeric:tabular-nums;pointer-events:none;user-select:none}.price-legend[hidden]{display:none}.price-legend>span{flex:none;white-space:nowrap}.price-legend-lead{display:inline-flex;align-items:center;gap:7px}.price-legend-dot{width:8px;height:8px;border-radius:50%;flex:none}.price-scale-hitbox{position:absolute;z-index:16;top:7px;right:5px;bottom:2px;width:74px;background:transparent;cursor:ns-resize!important;touch-action:none}.price-chart,.chart{padding-left:54px}.drawing-tools{left:0;top:48px;bottom:43px;width:50px;height:auto;padding:7px 6px;gap:4px;border-width:0 1px 0 0;border-radius:0;box-shadow:none;box-sizing:border-box;overflow-y:auto;overflow-x:hidden;scrollbar-width:none}.drawing-tools::-webkit-scrollbar{display:none}.drawing-tool{width:38px;height:36px;padding:0;display:grid;place-items:center;flex:none}.drawing-tool svg{width:24px!important;height:24px!important;margin:auto;stroke-width:1.1}.drawing-tools{box-shadow:none!important}.tool-separator{width:34px;height:1px;flex:none;margin:3px 0;background:#e5e7eb}.drawing-tool:disabled{opacity:.28;pointer-events:none}.clear-drawings:hover{color:#b91c1c;background:#fee2e2}.bottom-bar{border-top:1px solid #e5e7eb;box-sizing:border-box}.bottom-bar .values{margin-left:0;margin-right:auto;padding-left:8px}.bottom-bar button{transition:background-color .14s ease,border-color .14s ease,color .14s ease}.bottom-bar button:not(:disabled):hover{background:#f3f4f6!important;border-color:#d1d5db!important;color:#111!important}.panel.fullscreen .drawing-tools{bottom:43px}.panel.collapsed{border-color:rgba(32,36,43,.38);box-shadow:none}.collapsed .topbar{display:none}.collapsed .collapse img{width:34px;height:34px;display:block;object-fit:contain;pointer-events:none;user-select:none}.collapsed .collapse{background:rgba(255,255,255,.94)!important}";
    theme.textContent += ".drawing-tools .drawing-tool svg{stroke-width:1}.drawing-tools .date-range-tool svg{fill:currentColor;stroke:none}";
    theme.textContent += ".topbar .tab{display:inline-flex;align-items:center;justify-content:center;box-sizing:border-box;line-height:1}";
    theme.textContent += ".replay-button{height:34px;padding:0 12px;display:flex;align-items:center;gap:7px;flex:none;border:1px solid #d1d5db;border-radius:7px;background:#fff;color:#111;font:600 12px Arial}.replay-button:not(.active):hover{background:#f3f4f6;color:#111;border-color:#d1d5db}.replay-button.active,.replay-button.active:hover{background:#171b26;color:#fff;border-color:#171b26}.replay-button:disabled{opacity:.35}.replay-button svg{width:20px!important;height:20px!important;fill:none;stroke:currentColor}.replay-bar{height:48px;flex:none;display:none;align-items:center;justify-content:center;gap:6px;padding:0 10px;background:#fff;border-top:1px solid #d1d5db;box-sizing:border-box;user-select:none}.replay-open .replay-bar{display:flex}.replay-open .drawing-tools,.panel.fullscreen.replay-open .drawing-tools{bottom:91px}.replay-bar button{height:36px;min-width:38px;padding:0 9px;display:flex;align-items:center;justify-content:center;gap:7px;border:1px solid transparent;border-radius:7px;background:#fff;color:#374151}.replay-bar button:hover{background:#f3f4f6;border-color:#e5e7eb}.replay-bar button:disabled{opacity:.35}.replay-bar svg{width:21px!important;height:21px!important;fill:none;stroke:currentColor;stroke-width:1.75}.replay-goto{min-width:126px!important}.replay-goto-label{max-width:152px;overflow:hidden;text-overflow:ellipsis;font:600 12px Arial;white-space:nowrap}.replay-speed{height:35px;padding:0 8px;border:1px solid #d1d5db;border-radius:7px;background:#fff;background-image:none;color:#111;font:12px Arial;appearance:none;-webkit-appearance:none}.replay-speed::-ms-expand{display:none}.replay-interval{min-width:32px;padding:8px 9px;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb;text-align:center;font-weight:700}.replay-menu{position:absolute;z-index:24;display:none;left:50%;bottom:91px;width:226px;padding:7px;background:#fff;border:1px solid #d1d5db;border-radius:9px;box-shadow:0 8px 24px rgba(0,0,0,.20);transform:translateX(-50%)}.replay-menu.show{display:grid;gap:2px}.replay-menu button{height:42px;padding:0 11px;display:flex;align-items:center;gap:10px;text-align:left;border:0;border-radius:6px;background:#fff;color:#111;font:12px Arial}.replay-menu button svg{width:20px!important;height:20px!important;flex:none}.replay-menu button:hover{background:#f3f4f6}.replay-date-dialog,.replay-exit-dialog{position:absolute;z-index:25;display:none;left:50%;top:50%;width:330px;padding:16px;background:#fff;border:1px solid #d1d5db;border-radius:10px;box-shadow:0 12px 36px rgba(0,0,0,.24);transform:translate(-50%,-50%);box-sizing:border-box}.replay-date-dialog.show,.replay-exit-dialog.show{display:block}.replay-date-title{display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;font:bold 15px Arial}.replay-date-title button{width:32px;height:32px;border-radius:6px;background:#fff}.replay-date-dialog input{width:100%;height:38px;padding:0 9px;border:1px solid #9ca3af;border-radius:6px;box-sizing:border-box;font:12px Arial}.replay-date-first{width:100%;height:38px;margin-top:10px;border:0;border-radius:6px;background:#f3f4f6;font:12px Arial}.replay-date-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:17px}.replay-date-actions button{height:34px;padding:0 14px;border:1px solid #9ca3af;border-radius:6px;background:#fff}.replay-date-actions .replay-date-confirm,.replay-exit-confirm{background:#171b26!important;color:#fff!important;border-color:#171b26!important}.replay-exit-title{font:bold 16px Arial}.replay-exit-message{margin-top:9px;color:#4b5563;line-height:1.45}.collapsed .replay-bar,.collapsed .replay-menu,.collapsed .replay-date-dialog,.collapsed .replay-exit-dialog{display:none!important}";
    shadow.appendChild(theme);
    const panel = shadow.querySelector(".panel");
    const replayMenu = document.createElement("div"); replayMenu.className = "replay-menu"; replayMenu.innerHTML = `<button data-replay-action="bar">${ICONS.replay}<span>Select bar</span></button><button data-replay-action="date">${ICONS.calendar}<span>Select date…</span></button><button data-replay-action="first">${ICONS.realtime}<span>Select the first available day</span></button>`; panel.appendChild(replayMenu);
    const replayDateDialog = document.createElement("div"); replayDateDialog.className = "replay-date-dialog"; replayDateDialog.innerHTML = `<div class="replay-date-title"><span>Select date</span><button class="replay-date-x" aria-label="Đóng">${ICONS.close}</button></div><input class="replay-date-input" type="datetime-local"><button class="replay-date-first">Select the first available day</button><div class="replay-date-actions"><button class="replay-date-cancel">Cancel</button><button class="replay-date-confirm">Select</button></div>`; panel.appendChild(replayDateDialog);
    const confirmDialog = document.createElement("div"); confirmDialog.className = "replay-exit-dialog confirm-dialog"; confirmDialog.setAttribute("role", "dialog"); confirmDialog.setAttribute("aria-modal", "true"); confirmDialog.setAttribute("aria-labelledby", "cfrsi-confirm-title"); confirmDialog.setAttribute("aria-describedby", "cfrsi-confirm-message"); confirmDialog.innerHTML = '<div class="replay-exit-title confirm-dialog-title" id="cfrsi-confirm-title"></div><div class="replay-exit-message confirm-dialog-message" id="cfrsi-confirm-message"></div><div class="replay-date-actions"><button class="replay-exit-cancel confirm-dialog-cancel"></button><button class="replay-exit-confirm confirm-dialog-confirm"></button></div>'; panel.appendChild(confirmDialog);
    const confirmCancel = confirmDialog.querySelector(".confirm-dialog-cancel"), confirmAction = confirmDialog.querySelector(".confirm-dialog-confirm"); let pendingConfirmation = null, confirmBusy = false;
    const closeConfirmation = (restoreFocus = true) => { if (!confirmDialog.classList.contains("show")) return; const target = pendingConfirmation?.returnFocus; confirmDialog.classList.remove("show"); pendingConfirmation = null; confirmBusy = false; if (restoreFocus && target?.isConnected) requestAnimationFrame(() => target.focus()); };
    const openConfirmation = (options) => { if (confirmDialog.classList.contains("show")) return false; pendingConfirmation = options; confirmDialog.querySelector(".confirm-dialog-title").textContent = options.title; confirmDialog.querySelector(".confirm-dialog-message").textContent = options.message; confirmCancel.textContent = options.cancelLabel; confirmAction.textContent = options.confirmLabel; confirmDialog.classList.add("show"); requestAnimationFrame(() => confirmCancel.focus()); return true; };
    const acceptConfirmation = () => { if (!pendingConfirmation || confirmBusy) return; confirmBusy = true; const action = pendingConfirmation.onConfirm, target = pendingConfirmation.returnFocus; confirmDialog.classList.remove("show"); pendingConfirmation = null; requestAnimationFrame(() => target?.isConnected && target.focus()); try { action(); } finally { confirmBusy = false; } };
    confirmationController = { open: openConfirmation, close: closeConfirmation };
    confirmCancel.onclick = () => closeConfirmation(); confirmAction.onclick = acceptConfirmation;
    confirmDialog.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); closeConfirmation(); return; } if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); acceptConfirmation(); return; } if (e.key !== "Tab") return; const first = confirmCancel, last = confirmAction; if (e.shiftKey && shadow.activeElement === first) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && shadow.activeElement === last) { e.preventDefault(); first.focus(); } });
    const replayDateInput = replayDateDialog.querySelector(".replay-date-input"), localInputValue = (timestamp) => { const d = new Date(timestamp - new Date(timestamp).getTimezoneOffset() * 60000); return d.toISOString().slice(0, 16); };
    const showReplayDateDialog = () => { setReplayPlaying(false); replayMenu.classList.remove("show"); replayDateInput.value = localInputValue(state.replay.time || Date.now()); replayDateDialog.classList.add("show"); };
    const hideReplayDateDialog = () => replayDateDialog.classList.remove("show");
    const selectFirstReplayDay = async () => {
      if (!state.symbol || state.replay.loading) return; const current = tf(), symbol = state.symbol, generation = ++state.loadGeneration; state.replay.open = true; state.replay.loading = true; replayMenu.classList.remove("show"); hideReplayDateDialog(); updateReplayUI(); setStatus("Đang tìm dữ liệu đầu tiên…");
      try { const first = await fetchKlines(current, { startTime: "0", limit: "1" }); if (generation !== state.loadGeneration || symbol !== state.symbol || current.label !== tf().label) return; if (!first.length) throw new Error("Không tìm thấy dữ liệu"); await startReplayAt(first[0].time, true); }
      catch (e) { if (generation === state.loadGeneration) { state.replay.loading = false; setStatus(`Lỗi replay: ${e.message}`); updateReplayUI(); } }
    };
    replayButton.onclick = openReplay;
    replayBar.querySelector(".replay-goto").onclick = () => replayMenu.classList.toggle("show");
    panel.addEventListener("pointerdown", (e) => { if (!e.target.closest(".replay-goto,.replay-menu")) replayMenu.classList.remove("show"); }, true);
    replayMenu.addEventListener("click", (e) => { const action = e.target.closest("button")?.dataset.replayAction; if (action === "bar") { replayMenu.classList.remove("show"); beginReplayBarSelection(); } else if (action === "date") showReplayDateDialog(); else if (action === "first") ignoreFailure(selectFirstReplayDay()); });
    replayDateDialog.querySelector(".replay-date-x").onclick = hideReplayDateDialog; replayDateDialog.querySelector(".replay-date-cancel").onclick = hideReplayDateDialog; replayDateDialog.querySelector(".replay-date-first").onclick = () => ignoreFailure(selectFirstReplayDay());
    replayDateDialog.querySelector(".replay-date-confirm").onclick = () => { const timestamp = new Date(replayDateInput.value).getTime(); if (!Number.isFinite(timestamp)) return; hideReplayDateDialog(); ignoreFailure(startReplayAt(timestamp, true)); };
    replayBar.querySelector(".replay-play").onclick = () => setReplayPlaying(!state.replay.playing); replayBar.querySelector(".replay-forward").onclick = () => { setReplayPlaying(false); ignoreFailure(stepReplay()); };
    replayBar.querySelector(".replay-speed").onchange = (e) => { state.replay.speed = Number(e.target.value) || 1; if (state.replay.playing) setReplayPlaying(true); else updateReplayUI(); };
    replayBar.querySelector(".replay-realtime").onclick = requestExitReplay; replayBar.querySelector(".replay-close").onclick = requestExitReplay;
    const drawingToolbar = document.createElement("aside"); drawingToolbar.className = "drawing-tools"; drawingToolbar.innerHTML = `<button class="drawing-tool fib-tool" tabindex="-1" title="Fibonacci Retracement" aria-label="Fibonacci Retracement">${ICONS.fib}</button><button class="drawing-tool long-tool" tabindex="-1" title="Long Position" aria-label="Long Position">${ICONS.long}</button><button class="drawing-tool range-tool" tabindex="-1" title="Price Range" aria-label="Price Range">${ICONS.range}</button><button class="drawing-tool date-range-tool" tabindex="-1" title="Date Range" aria-label="Date Range">${ICONS.dateRange}</button><button class="drawing-tool trend-tool" tabindex="-1" title="Trend Line (giữ Shift để khóa ngang/dọc)" aria-label="Trend Line">${ICONS.trend}</button><button class="drawing-tool text-tool" tabindex="-1" title="Text" aria-label="Text">${ICONS.text}</button><span class="tool-separator history-separator" aria-hidden="true"></span><button class="drawing-tool undo-drawing" tabindex="-1" title="Undo (Ctrl/Cmd+Z)" aria-label="Undo">${ICONS.undo}</button><button class="drawing-tool redo-drawing" tabindex="-1" title="Redo (Ctrl/Cmd+Shift+Z hoặc Ctrl+Y)" aria-label="Redo">${ICONS.redo}</button><button class="drawing-tool clear-drawings" tabindex="-1" title="Xóa tất cả drawing của symbol hiện tại" aria-label="Xóa tất cả drawing">${ICONS.trash}</button><span class="tool-separator countdown-separator" aria-hidden="true"></span>`; drawingToolbar.appendChild(candleCountdown); panel.appendChild(drawingToolbar);
    drawingToolbar.querySelector(".undo-drawing").onclick = undoDrawing; drawingToolbar.querySelector(".redo-drawing").onclick = redoDrawing; updateHistoryButtons();
    const clearDrawingsButton = drawingToolbar.querySelector(".clear-drawings");
    function clearAllDrawings() {
      const key = fibKey();
      if (![...(state.fibDrawings[key] || []), ...(state.toolDrawings[key] || [])].length) return;
      pushDrawingHistory();
      const { [key]: _oldFibs, ...nextFibs } = state.fibDrawings, { [key]: _oldTools, ...nextTools } = state.toolDrawings;
      state.fibDrawings = nextFibs; state.toolDrawings = nextTools; state.selectedDrawing = null; state.fibDraft = null; state.toolDraft = null; state.drawingTool = null;
      drawingToolbar.querySelectorAll(".drawing-tool.active").forEach((button) => button.classList.remove("active"));
      storeSet({ fibDrawings: state.fibDrawings, toolDrawings: state.toolDrawings }); updateDrawingMenu(); render();
    }
    clearDrawingsButton.onclick = () => {
      const key = fibKey();
      if (![...(state.fibDrawings[key] || []), ...(state.toolDrawings[key] || [])].length) return;
      openConfirmation({ title: "Xóa tất cả drawing?", message: `Tất cả drawing của ${state.symbol || "chart"} trên mọi khung thời gian sẽ bị xóa.`, cancelLabel: "Hủy", confirmLabel: "Xóa tất cả", onConfirm: clearAllDrawings, returnFocus: clearDrawingsButton });
    };
    const drawingMenu = document.createElement("div"); drawingMenu.className = "drawing-menu"; drawingMenu.innerHTML = `<span class="drawing-menu-handle" title="Kéo toolbar">${ICONS.grip}</span><span class="drawing-name"></span><span class="tool-settings text-settings"><input class="text-color" type="color" title="Màu chữ"><select class="text-size" title="Cỡ chữ"><option>10</option><option>12</option><option selected>14</option><option>16</option><option>18</option><option>20</option><option>24</option><option>32</option><option>40</option><option>48</option></select></span><span class="tool-settings trend-settings"><input class="trend-color" type="color" title="Màu đường"><select class="trend-width" title="Độ dày"><option>1</option><option>2</option><option>3</option><option selected>4</option><option>5</option><option>6</option><option>8</option></select><select class="trend-dash" title="Kiểu đường"><option value="solid">Solid</option><option value="dash">Dash</option><option value="dot">Dot</option></select></span><button class="drawing-delete" tabindex="-1" title="Xóa hình vẽ" aria-label="Xóa hình vẽ">${ICONS.trash}</button>`; panel.appendChild(drawingMenu); enableDrawingMenuDrag(drawingMenu, panel);
    for (const [selector, property, numeric] of [[".text-color", "color", false], [".text-size", "fontSize", true], [".trend-color", "color", false], [".trend-width", "lineWidth", true], [".trend-dash", "dash", false]]) drawingMenu.querySelector(selector).addEventListener("input", (e) => updateSelectedStyle({ [property]: numeric ? Number(e.target.value) : e.target.value }));
    const textEditor = document.createElement("textarea"); textEditor.className = "text-editor"; textEditor.placeholder = "Nhập nội dung…"; panel.appendChild(textEditor);
    drawingMenu.querySelector(".drawing-delete").onclick = () => { const selection = state.selectedDrawing, action = selection && DRAWING_ACTIONS[selection.type]; if (!action) return; action.remove(selection); state.selectedDrawing = null; updateDrawingMenu(); render(); };
    const resizeHandles = ["n", "s", "e", "w", "ne", "nw", "se", "sw"].map((dir) => {
      const handle = document.createElement("div");
      handle.className = "resize-handle";
      handle.dataset.dir = dir;
      panel.appendChild(handle);
      return handle;
    });
    enableBorderResize(panel, resizeHandles);
    geometry(); panel.classList.toggle("hidden", !state.visible); panel.classList.toggle("collapsed", state.collapsed); const collapseButton = shadow.querySelector(".collapse"); collapseButton.innerHTML = collapseContent(state.collapsed); collapseButton.setAttribute("aria-label", state.collapsed ? "Mở ChartForge RSI" : "Thu gọn ChartForge RSI"); const closeButton = shadow.querySelector(".close"); closeButton.innerHTML = ICONS.close;
    shadow.querySelectorAll(".tab").forEach((b) => { b.classList.toggle("active", b.dataset.tf === state.selected); b.onclick = () => select(b.dataset.tf); });
    applyPaneSplit(pricePane, rsiPane); const zoom = shadow.querySelector(".zoom input"), output = shadow.querySelector(".zoom output"); zoom.min = 20; zoom.max = 1000; zoom.value = state.zoomBars; output.value = state.zoomBars;
    zoom.oninput = () => { state.zoomBars = Number(zoom.value); state.panBars = clampPan(state.panBars); output.value = state.zoomBars; render(); }; zoom.onchange = () => storeSet({ zoomBars: state.zoomBars, panBars: state.panBars });
    const crossButton = document.createElement("button"); crossButton.title = "Chế độ kéo dọc chart giá"; crossButton.innerHTML = ICONS.cross; shadow.querySelector(".refresh").before(crossButton);
    const updateCross = () => crossButton.classList.toggle("tool-active", state.crossMode); updateCross(); crossButton.onclick = () => { state.crossMode = !state.crossMode; updateCross(); storeSet({ crossMode: state.crossMode }); };
    const resetButton = document.createElement("button"); resetButton.title = "Reset chart view"; resetButton.innerHTML = ICONS.reset; shadow.querySelector(".refresh").before(resetButton);
    resetButton.onclick = () => { state.panBars = 0; state.zoomBars = RESET_ZOOM_BARS; state.priceShift = 0; state.priceScale = 1; state.pricePercent = 64; applyPaneSplit(pricePane, rsiPane); zoom.value = RESET_ZOOM_BARS; output.value = RESET_ZOOM_BARS; render(); storeSet({ panBars: 0, zoomBars: RESET_ZOOM_BARS, priceShift: 0, priceScale: 1, pricePercent: 64 }); };
    const refreshButton = shadow.querySelector(".refresh"); refreshButton.innerHTML = ICONS.refresh; refreshButton.onclick = () => { state.panBars = 0; if (state.replay.open) requestExitReplay(); else ignoreFailure(load()); };
    const fullscreenButton = document.createElement("button"); fullscreenButton.className = "fullscreen-button"; fullscreenButton.title = "Toàn màn hình"; fullscreenButton.innerHTML = ICONS.fullscreen; refreshButton.before(fullscreenButton);
    fullscreenButton.onclick = () => { if (!state.fullscreen) { const r = panel.getBoundingClientRect(); state.restoreGeometry = { left: r.left, top: r.top, width: r.width, height: r.height }; state.fullscreen = true; panel.classList.add("fullscreen"); } else { state.fullscreen = false; panel.classList.remove("fullscreen"); const g = state.restoreGeometry; if (g) { state.left = g.left; state.top = g.top; state.width = g.width; state.height = g.height; geometry(); } } fullscreenButton.classList.toggle("active", state.fullscreen); requestAnimationFrame(render); };
    let collapsedDrag = null, suppressCollapseClick = false;
    collapseButton.addEventListener("pointerdown", (e) => { if (!state.collapsed) return; collapsedDrag = { x: e.clientX, y: e.clientY, left: state.left, top: state.top, moved: false }; collapseButton.setPointerCapture(e.pointerId); e.preventDefault(); });
    collapseButton.addEventListener("pointermove", (e) => { if (!collapsedDrag) return; const dx = e.clientX - collapsedDrag.x, dy = e.clientY - collapsedDrag.y; if (Math.hypot(dx, dy) > 3) collapsedDrag.moved = true; state.left = Math.max(0, Math.min(innerWidth - 66, collapsedDrag.left + dx)); state.top = Math.max(0, Math.min(innerHeight - 50, collapsedDrag.top + dy)); positionOnly(panel); });
    collapseButton.addEventListener("pointerup", () => { if (!collapsedDrag) return; suppressCollapseClick = collapsedDrag.moved; collapsedDrag = null; storeSet({ left: state.left, top: state.top }); });
    collapseButton.addEventListener("pointercancel", () => { collapsedDrag = null; });
    collapseButton.onclick = () => {
      if (suppressCollapseClick) { suppressCollapseClick = false; return; }
      if (!state.collapsed) { const r = panel.getBoundingClientRect(); state.width = Math.round(r.width); state.height = Math.round(r.height); }
      state.collapsed = !state.collapsed; panel.classList.toggle("collapsed", state.collapsed); collapseButton.innerHTML = collapseContent(state.collapsed); collapseButton.setAttribute("aria-label", state.collapsed ? "Mở ChartForge RSI" : "Thu gọn ChartForge RSI");
      if (!state.collapsed) { geometry(); requestAnimationFrame(render); } syncCandleCountdownTimer(); storeSet({ collapsed: state.collapsed, width: state.width, height: state.height });
    };
    closeButton.onclick = () => toggle(false); drag(shadow.querySelector("header"), panel); drag(topbar, panel);
    const priceCanvas = pricePane.querySelector("canvas"), trendButton = drawingToolbar.querySelector(".trend-tool"); enableFibTool(priceCanvas, drawingToolbar.querySelector(".fib-tool")); enableTwoPointTool(priceCanvas, drawingToolbar.querySelector(".long-tool"), "long"); enableTwoPointTool(priceCanvas, drawingToolbar.querySelector(".range-tool"), "range"); enableTwoPointTool(priceCanvas, drawingToolbar.querySelector(".date-range-tool"), "dateRange"); enableTwoPointTool(priceCanvas, trendButton, "trend", "price", true); enableTwoPointTool(rsiCanvas, trendButton, "trend", "rsi", false); enableTextTool(priceCanvas, drawingToolbar.querySelector(".text-tool"), textEditor, panel); enableDrawingSelection(priceCanvas, "price"); enableDrawingSelection(rsiCanvas, "rsi");
    for (const canvas of [priceCanvas, rsiCanvas]) canvas.addEventListener("pointerdown", (e) => { if (state.replay.selecting !== "bar") return; const rect = canvas.getBoundingClientRect(), x = 8, w = rect.width - 82, ratio = Math.max(0, Math.min(1, (e.clientX - rect.left - x) / Math.max(1, w))), range = viewRange(), index = Math.round(range.start + ratio * (state.zoomBars - 1)), row = state.rows[index]; if (!row) return; state.hoverIndex = index; e.preventDefault(); e.stopImmediatePropagation(); ignoreFailure(startReplayAt(row.time, false, range.start, true)); }, true);
    addEventListener("keydown", (e) => {
      if (e.key === "Escape") { if (confirmDialog.classList.contains("show")) closeConfirmation(); else if (replayDateDialog.classList.contains("show")) hideReplayDateDialog(); else replayMenu.classList.remove("show"); return; }
      const target = e.composedPath?.()[0] || e.target, editing = target?.matches?.("input,textarea,select,[contenteditable=true]"); if (editing || !(e.ctrlKey || e.metaKey) || e.altKey) return;
      const key = e.key.toLowerCase(), redo = key === "y" || (key === "z" && e.shiftKey), undo = key === "z" && !e.shiftKey;
      if ((undo && state.historyPast.length) || (redo && state.historyFuture.length)) { e.preventDefault(); if (redo) redoDrawing(); else undoDrawing(); }
    });
    [rsiCanvas, priceCanvas].forEach((canvas) => { enablePan(canvas); enableCrosshair(canvas); enableWheelZoom(canvas); }); enablePriceScaleZoom(priceScaleHitbox);
    enableSplitter(splitter, pricePane, rsiPane);
    updateReplayUI();
    new ResizeObserver(() => { if (state.collapsed || state.fullscreen) return; render(); clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { const r = panel.getBoundingClientRect(); state.width = Math.round(r.width); state.height = Math.round(r.height); storeSet({ width: state.width, height: state.height }); }, 300); }).observe(panel);
  }
  async function init() {
    const saved = await storeGet([...Object.keys(DEFAULTS), "uiDefaultsVersion"]);
    Object.assign(state, saved);
    state.toolDefaults = { text: { ...DEFAULTS.toolDefaults.text, ...(saved.toolDefaults?.text || {}) }, trend: { ...DEFAULTS.toolDefaults.trend, ...(saved.toolDefaults?.trend || {}) } };
    const fibMigration = mergeTimeframeDrawingKeys(state.fibDrawings), toolMigration = mergeTimeframeDrawingKeys(state.toolDrawings);
    state.fibDrawings = fibMigration.drawings; state.toolDrawings = toolMigration.drawings;
    if (fibMigration.migrated || toolMigration.migrated) storeSet({ fibDrawings: state.fibDrawings, toolDrawings: state.toolDrawings });
    if (saved.uiDefaultsVersion !== UI_DEFAULTS_VERSION) {
      state.crossMode = true;
      storeSet({ crossMode: true, uiDefaultsVersion: UI_DEFAULTS_VERSION });
    }
    if (state.selected === "1D") state.selected = "D"; if (state.selected === "1M") state.selected = "M";
    mount(); if (state.visible) refreshSymbol(true);
    setInterval(() => state.visible && refreshSymbol(), 1500); addEventListener("resize", () => { geometry(); render(); });
    try { chartForgePlatform.storage.onChanged.addListener((changes, area) => {
      if (area !== "sync") return;
      let drawingsChanged = false;
      for (const key of ["fibDrawings", "toolDrawings", "toolDefaults"]) if (changes[key]?.newValue !== undefined) { state[key] = changes[key].newValue; drawingsChanged = true; }
      if (drawingsChanged && shadow) { state.selectedDrawing = null; updateDrawingMenu(); render(); }
      if (Object.keys(changes).some((key) => key.startsWith(DRAWING_SYNC_PREFIX))) {
        clearTimeout(syncReloadTimer); syncReloadTimer = setTimeout(() => ignoreFailure((async () => {
          const shards = drawingsFromShards(await storageGet(storageArea("sync"), null));
          state.fibDrawings = shards.fibDrawings; state.toolDrawings = shards.toolDrawings; state.selectedDrawing = null;
          await storageSet(storageArea("local"), { fibDrawings: state.fibDrawings, toolDrawings: state.toolDrawings });
          if (shadow) { updateDrawingMenu(); render(); }
        })()), 180);
      }
    }); } catch { /* Storage events are optional in constrained browser contexts. */ }
  }
  ignoreFailure(init());
})();
