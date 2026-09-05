import { APP_VERSION, ENABLED_SYMBOLS, resolveSymbol } from "./config.js";
import { bindVisibleViewport } from "./viewport.js";
import {
  bootstrapCanonicalStorage,
  exportLocalData,
  getMarketCache,
  getSetting,
  importLocalData,
  setMarketCache,
  setSetting
} from "./storage.js";
import { createChartStorageFacade } from "./storage-adapter.js";
import { createCloudSync } from "./firebase-sync.js";
import { createLiveTitleController } from "./title-price.js";

const rootUrl = new URL("../", import.meta.url);
const bootstrap = document.querySelector("#pwa-bootstrap");
const importInput = document.querySelector("#pwa-import-file");
const storageAdapter = bootstrapCanonicalStorage();
await storageAdapter.loadState();

const platformFacade = createChartStorageFacade(storageAdapter, { baseUrl: rootUrl.href });
platformFacade.runtime.getURL = path => new URL(path, rootUrl).href;
globalThis.chartForgePlatform = platformFacade;

const remembered = await getSetting("lastSymbol");
const symbol = resolveSymbol(location.search, remembered);
const liveTitle = createLiveTitleController(document, symbol);

const nativeFetch = globalThis.fetch.bind(globalThis);
globalThis.fetch = async (input, init) => {
  const raw = typeof input === "string" || input instanceof URL ? String(input) : input?.url;
  if (raw?.startsWith("https://api.binance.com/api/v3/klines")) {
    const replacement = raw.replace("https://api.binance.com", "https://data-api.binance.vision");
    const url = new URL(replacement);
    const cacheKey = `canonical:${url.searchParams.get("symbol")}:${url.searchParams.get("interval")}:${url.searchParams.get("startTime") || ""}:${url.searchParams.get("endTime") || "latest"}`;
    try {
      const response = await nativeFetch(input instanceof Request ? new Request(replacement, input) : replacement, init);
      if (!response.ok) throw new Error(`Binance HTTP ${response.status}`);
      response.clone().json().then(rows => {
        setMarketCache(cacheKey, rows).catch(() => undefined);
        if (url.searchParams.get("symbol") === symbol && rows.length) liveTitle.update(rows.at(-1)?.[4], rows.at(-1)?.[0], url.searchParams.get("interval"));
      }).catch(() => undefined);
      return response;
    } catch (error) {
      const cached = await getMarketCache(cacheKey);
      if (cached.length) {
        if (url.searchParams.get("symbol") === symbol) liveTitle.update(cached.at(-1)?.[4], cached.at(-1)?.[0], url.searchParams.get("interval"));
        return new Response(JSON.stringify(cached), { status: 200, headers: { "content-type": "application/json", "x-chartforge-cache": "offline" } });
      }
      throw error;
    }
  }
  return nativeFetch(input, init);
};

if (globalThis.WebSocket) {
  const NativeWebSocket = globalThis.WebSocket;
  let socketGeneration = 0;
  globalThis.WebSocket = new Proxy(NativeWebSocket, { construct(Target, args) {
    const socket = Reflect.construct(Target, args),generation = ++socketGeneration;
    socket.addEventListener("message", event => {
      try { const payload = JSON.parse(event.data); if (generation === socketGeneration && payload?.k?.s === symbol) liveTitle.update(payload.k.c, payload.k.t, payload.k.i); } catch {}
    });
    return socket;
  }});
}
const initialUrl = new URL(location.href);
initialUrl.searchParams.set("symbol", symbol);
history.replaceState(null, "", initialUrl);

await new Promise((resolve, reject) => {
  const script = document.createElement("script");
  script.src = new URL("js/chart-engine.js", rootUrl).href;
  script.onload = resolve;
  script.onerror = () => reject(new Error("Không tải được ChartForge engine"));
  document.head.append(script);
});

const host = await new Promise((resolve, reject) => {
  let attempts = 0;
  const poll = () => {
    const value = document.querySelector("#binance-rsi-mtf-host");
    if (value?.shadowRoot) resolve(value);
    else if (++attempts > 300) reject(new Error("ChartForge engine không khởi tạo"));
    else requestAnimationFrame(poll);
  };
  poll();
});

const shadow = host.shadowRoot;
const panel = shadow.querySelector(".panel");
const topbar = shadow.querySelector(".topbar");
const identity = shadow.querySelector(".chart-identity");
const status = shadow.querySelector(".status");
panel.classList.add("fullscreen", "pwa-shell");
const unbindVisibleViewport = bindVisibleViewport(panel);
window.addEventListener("pagehide", unbindVisibleViewport, { once: true });

const platformTheme = document.createElement("style");
platformTheme.textContent = `
  .panel.pwa-shell{left:var(--pwa-viewport-left,0px)!important;top:var(--pwa-viewport-top,0px)!important;width:var(--pwa-viewport-width,100dvw)!important;height:var(--pwa-viewport-height,100dvh)!important;max-width:none!important;max-height:none!important;min-width:0!important;min-height:0!important;border:0!important;box-shadow:none!important}
  .pwa-shell>.resize-handle,.pwa-shell .fullscreen-button,.pwa-shell .collapse,.pwa-shell .close{display:none!important}
  .pwa-symbol-select{position:absolute;inset:-9px -4px;opacity:0;cursor:pointer!important}
  .pwa-shell .chart-identity{position:relative}
  .pwa-auth{height:34px;min-width:34px;max-width:112px;padding:0 9px;display:flex;align-items:center;justify-content:center;gap:6px;flex:none;border:1px solid #d1d5db;border-radius:7px;background:#fff;color:#374151;font:600 11px Arial}
  .pwa-auth:hover{background:#f3f4f6}.pwa-auth img{width:22px;height:22px;border-radius:50%}.pwa-auth-dot{width:7px;height:7px;border-radius:50%;background:#9ca3af;flex:none}.pwa-auth[data-sync=syncing] .pwa-auth-dot{background:#eab308}.pwa-auth[data-sync=synced] .pwa-auth-dot{background:#16a34a}.pwa-auth[data-sync=error] .pwa-auth-dot{background:#dc2626}
  .pwa-shell .topbar .status{margin-left:auto}.pwa-auth{margin-left:4px}
  .pwa-account-menu{position:absolute;z-index:30;display:none;right:8px;top:43px;width:205px;padding:7px;background:#fff;border:1px solid #d1d5db;border-radius:9px;box-shadow:0 8px 24px rgba(0,0,0,.20)}.pwa-account-menu.show{display:grid;gap:3px}.pwa-account-menu button{height:38px;padding:0 10px;text-align:left;border:0;border-radius:6px;background:#fff;color:#111;font:12px Arial}.pwa-account-menu button:hover{background:#f3f4f6}.pwa-account-menu .danger{color:#b42318}
  .pwa-shell .bottom-bar{position:relative;z-index:17;height:calc(42px + env(safe-area-inset-bottom,0px));padding-bottom:env(safe-area-inset-bottom,0px);box-sizing:border-box;flex:none}
  .pwa-shell .drawing-tools,.pwa-shell.fullscreen .drawing-tools{bottom:calc(43px + env(safe-area-inset-bottom,0px))}.pwa-shell.replay-open .drawing-tools,.pwa-shell.fullscreen.replay-open .drawing-tools{bottom:calc(91px + env(safe-area-inset-bottom,0px))}
  .pwa-toast{position:absolute;z-index:40;left:50%;bottom:calc(54px + env(safe-area-inset-bottom,0px));max-width:min(420px,calc(100% - 24px));padding:9px 14px;border-radius:7px;background:#171b26;color:#fff;font:12px Arial;opacity:0;pointer-events:none;transform:translateX(-50%);transition:opacity .18s}.pwa-toast.show{opacity:1}
  .pwa-shell .replay-date-dialog,.pwa-shell .replay-exit-dialog{width:min(330px,calc(100% - 24px))}
  @media(max-width:700px){
    .pwa-shell .topbar{height:96px;position:relative;padding:0 8px 48px;overflow:visible}.pwa-shell .topbar .tabs{position:absolute;left:6px;right:6px;bottom:4px;height:38px;overflow-x:auto}.pwa-shell .topbar-separator{display:none}.pwa-auth{min-width:34px;max-width:40px;padding:0}.pwa-auth-label{display:none}.pwa-shell .topbar .status{min-width:7px;max-width:7px;padding:0;overflow:visible;flex:none;font-size:0}.pwa-shell .topbar .status::before{width:8px;height:8px}.pwa-shell .drawing-tools{top:96px;gap:2px}.pwa-shell .drawing-tool{height:30px}.pwa-shell .tool-separator{margin:2px 0}.pwa-shell .replay-bar{overflow-x:auto;justify-content:flex-start;padding-left:54px}.pwa-account-menu{top:43px}.pwa-shell .bottom-bar{overflow-x:auto}.pwa-shell .values{flex:none}
  }
`;
shadow.append(platformTheme);

const symbolSelect = document.createElement("select");
symbolSelect.className = "pwa-symbol-select";
symbolSelect.setAttribute("aria-label", "Chọn cặp giao dịch");
for (const item of ENABLED_SYMBOLS) symbolSelect.add(new Option(item, item));
symbolSelect.value = symbol;
symbolSelect.addEventListener("change", async () => {
  const url = new URL(location.href);
  url.searchParams.set("symbol", symbolSelect.value);
  await setSetting("lastSymbol", symbolSelect.value);
  location.replace(url);
});
identity.append(symbolSelect);

const authButton = document.createElement("button");
authButton.className = "pwa-auth";
authButton.type = "button";
authButton.dataset.sync = "idle";
authButton.innerHTML = '<span class="pwa-auth-label">Đăng nhập</span><i class="pwa-auth-dot"></i>';
topbar.append(authButton);

const accountMenu = document.createElement("div");
accountMenu.className = "pwa-account-menu";
accountMenu.innerHTML = '<button type="button" data-action="auth">Đăng nhập Google để đồng bộ</button><button type="button" data-action="export">Xuất dữ liệu JSON</button><button type="button" data-action="import">Nhập dữ liệu JSON</button>';
panel.append(accountMenu);

const toast = document.createElement("div");
toast.className = "pwa-toast";
panel.append(toast);
let toastTimer;
const showToast = message => {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
};

const activeDrawingTouches = new Set();
shadow.addEventListener("pointerdown", event => {
  if (event.pointerType === "mouse" || !event.target.closest?.(".price-canvas,.rsi-canvas") || !shadow.querySelector(".drawing-tool.active")) return;
  if (activeDrawingTouches.size) { event.preventDefault(); event.stopPropagation(); }
  activeDrawingTouches.add(event.pointerId);
}, true);
const releaseDrawingTouch = event => activeDrawingTouches.delete(event.pointerId);
shadow.addEventListener("pointerup", releaseDrawingTouch, true);
shadow.addEventListener("pointercancel", releaseDrawingTouch, true);

for (const canvas of shadow.querySelectorAll(".price-canvas,.rsi-canvas")) {
  const pointers = new Map();
  let pinchDistance = null;
  let pinchCenter = null;
  let longPress = null;
  const clearLongPress = () => {
    if (longPress?.timer) clearTimeout(longPress.timer);
    longPress = null;
  };
  canvas.addEventListener("pointerdown", event => {
    if (event.pointerType === "mouse") return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const drawingActive = shadow.querySelector(".drawing-tool.active");
    if (drawingActive) return;
    if (pointers.size === 1 && !drawingActive && !shadow.querySelector(".replay-button.active")) {
      const press = { id: event.pointerId, x: event.clientX, y: event.clientY, active: false, timer: null };
      press.timer = setTimeout(() => {
        if (longPress !== press || pointers.size !== 1) return;
        press.active = true;
        canvas.dispatchEvent(new MouseEvent("mousemove", { clientX: press.x, clientY: press.y, bubbles: true }));
      }, 420);
      longPress = press;
    }
    if (pointers.size < 2) return;
    clearLongPress();
    const [firstId, firstPoint] = pointers.entries().next().value;
    canvas.dispatchEvent(new PointerEvent("pointercancel", { pointerId: firstId, pointerType: "touch", clientX: firstPoint.x, clientY: firstPoint.y, bubbles: true }));
    canvas.setPointerCapture(event.pointerId);
    const [a, b] = [...pointers.values()];
    pinchDistance = Math.hypot(a.x - b.x, a.y - b.y);
    pinchCenter = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);
  canvas.addEventListener("pointermove", event => {
    if (!pointers.has(event.pointerId)) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (longPress?.id === event.pointerId) {
      const moved = Math.hypot(event.clientX - longPress.x, event.clientY - longPress.y);
      if (!longPress.active && moved > 6) clearLongPress();
      else if (longPress.active) {
        canvas.dispatchEvent(new MouseEvent("mousemove", { clientX: event.clientX, clientY: event.clientY, bubbles: true }));
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
    }
    if (pointers.size < 2 || pinchDistance == null) return;
    const [a, b] = [...pointers.values()], distance = Math.hypot(a.x - b.x, a.y - b.y), delta = distance - pinchDistance;
    if (Math.abs(delta) >= 8) {
      canvas.dispatchEvent(new WheelEvent("wheel", { clientX: pinchCenter.x, clientY: pinchCenter.y, deltaY: delta > 0 ? -1 : 1, bubbles: true, cancelable: true }));
      pinchDistance = distance;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);
  const release = event => {
    if (!event.isTrusted) return;
    if (longPress?.id === event.pointerId) {
      const wasActive = longPress.active;
      clearLongPress();
      if (wasActive) canvas.dispatchEvent(new MouseEvent("mouseleave", { bubbles: true }));
    }
    pointers.delete(event.pointerId);
    if (pointers.size < 2) { pinchDistance = null; pinchCenter = null; }
  };
  canvas.addEventListener("pointerup", release, true);
  canvas.addEventListener("pointercancel", release, true);
}

let cloud = null;
let authUser = null;
let remoteSettingsReload;
const authAction = accountMenu.querySelector('[data-action="auth"]');
const setAuthUser = user => {
  authUser = user;
  authAction.textContent = user ? `Đăng xuất ${user.email || "Google"}` : "Đăng nhập Google để đồng bộ";
  authButton.querySelector("img")?.remove();
  if (user?.photoURL) {
    const avatar = document.createElement("img");
    avatar.src = user.photoURL;
    avatar.alt = "";
    authButton.prepend(avatar);
  }
  authButton.querySelector(".pwa-auth-label").textContent = user?.displayName?.split(" ")[0] || "Đăng nhập";
};
const setSyncStatus = (kind, error) => {
  authButton.dataset.sync = kind;
  authButton.title = kind === "synced" ? "Đã đồng bộ" : kind === "syncing" ? "Đang đồng bộ" : kind === "error" ? `Lỗi đồng bộ: ${error?.message || "không xác định"}` : "Tài khoản và đồng bộ";
};

authButton.addEventListener("click", event => {
  event.stopPropagation();
  accountMenu.classList.toggle("show");
});
panel.addEventListener("pointerdown", event => {
  if (!event.target.closest(".pwa-auth,.pwa-account-menu")) accountMenu.classList.remove("show");
}, true);
authAction.addEventListener("click", async () => {
  try {
    if (!cloud) return;
    if (authUser) {
      if (confirm("Đăng xuất khỏi đồng bộ ChartForge RSI?")) await cloud.signOut();
    } else await cloud.signIn();
    accountMenu.classList.remove("show");
  } catch (error) {
    showToast(error.code === "auth/unauthorized-domain" ? "Domain này chưa được cho phép trong Firebase." : error.message);
  }
});
accountMenu.querySelector('[data-action="export"]').addEventListener("click", async () => {
  const data = await exportLocalData();
  if (!data) return;
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `chartforge-rsi-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  accountMenu.classList.remove("show");
});
accountMenu.querySelector('[data-action="import"]').addEventListener("click", () => importInput.click());
importInput.addEventListener("change", async () => {
  const file = importInput.files?.[0];
  if (!file) return;
  try {
    const result = await importLocalData(JSON.parse(await file.text()));
    await storageAdapter.reload("sync");
    showToast(`Đã nhập ${result.drawings} drawing`);
  } catch (error) {
    showToast(error.message);
  } finally {
    importInput.value = "";
    accountMenu.classList.remove("show");
  }
});

createCloudSync({
  onAuth: setAuthUser,
  onStatus: setSyncStatus,
  onData: kind => {
    void storageAdapter.refreshFromRemote();
    if (kind === "setting" || kind === "reset") {
      clearTimeout(remoteSettingsReload);
      remoteSettingsReload = setTimeout(() => location.reload(), 180);
    }
  }
}).then(value => {
  cloud = value;
}).catch(error => setSyncStatus("error", error));

bootstrap.hidden = true;
if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(console.warn);
console.info(`ChartForge RSI PWA ${APP_VERSION}`);
