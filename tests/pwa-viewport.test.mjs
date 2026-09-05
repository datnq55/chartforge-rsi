import assert from "node:assert/strict";
import test from "node:test";
import { bindVisibleViewport, visibleViewportRect } from "../web/js/viewport.js";

test("visible viewport prefers Chrome's dynamic visual viewport", () => {
  assert.deepEqual(
    visibleViewportRect({ offsetLeft: 2, offsetTop: 74, width: 591, height: 905 }, { innerWidth: 591, innerHeight: 1279 }),
    { left: 2, top: 74, width: 591, height: 905 }
  );
});

test("visible viewport falls back to the layout viewport", () => {
  assert.deepEqual(visibleViewportRect(null, { innerWidth: 320, innerHeight: 480 }), { left: 0, top: 0, width: 320, height: 480 });
});

test("viewport binding coalesces updates and removes every listener", () => {
  const listeners = new Map();
  const viewportListeners = new Map();
  const style = new Map();
  let nextFrame = 0;
  const visualViewport = {
    offsetLeft: 0, offsetTop: 0, width: 591, height: 905,
    addEventListener: (type, listener) => viewportListeners.set(type, listener),
    removeEventListener: (type, listener) => { if (viewportListeners.get(type) === listener) viewportListeners.delete(type); }
  };
  const windowObject = {
    visualViewport, innerWidth: 591, innerHeight: 1279,
    addEventListener: (type, listener) => listeners.set(type, listener),
    removeEventListener: (type, listener) => { if (listeners.get(type) === listener) listeners.delete(type); },
    requestAnimationFrame: callback => { nextFrame += 1; callback(); return nextFrame; },
    cancelAnimationFrame: () => {}
  };
  const cleanup = bindVisibleViewport({ style: { setProperty: (name, value) => style.set(name, value) } }, windowObject);
  assert.equal(style.get("--pwa-viewport-height"), "905px");
  visualViewport.height = 840;
  viewportListeners.get("resize")();
  assert.equal(style.get("--pwa-viewport-height"), "840px");
  cleanup();
  assert.equal(listeners.size, 0);
  assert.equal(viewportListeners.size, 0);
});
