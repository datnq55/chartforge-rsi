import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

const INIT_CALL = "  ignoreFailure(init());";
const TEST_HOOK = `  globalThis.__CFRSI_TEST__ = {
    DEFAULTS, ICONS, state, rebuild, renderPrice, render,
    setShadow(value) { shadow = value; }
  };`;

export async function loadCanonicalRuntime(url = new URL("../../web/js/canonical-content.js", import.meta.url)) {
  const source = await readFile(url, "utf8");
  assert.ok(source.includes(INIT_CALL), "canonical source must retain the extension init call");
  const instrumented = source.replace(INIT_CALL, TEST_HOOK);
  const sandbox = {
    addEventListener() {},
    cancelAnimationFrame() {},
    clearInterval,
    clearTimeout,
    console,
    Date,
    devicePixelRatio: 1,
    document: { addEventListener() {} },
    Event: class Event {},
    innerHeight: 900,
    innerWidth: 1440,
    performance: { now: () => 0 },
    requestAnimationFrame() { return 1; },
    setInterval() { return 1; },
    setTimeout,
    structuredClone,
    URLSearchParams
  };
  sandbox.globalThis = sandbox;
  sandbox.window = sandbox;
  vm.runInNewContext(instrumented, sandbox, { filename: url.pathname });
  return sandbox.__CFRSI_TEST__;
}

const rounded = value => typeof value === "number" ? Math.round(value * 1e6) / 1e6 : value;

export function recordingCanvas(width = 500, height = 240) {
  const operations = [];
  const target = {
    measureText(value) { return { width: String(value).length * 6 }; },
    roundRect(...args) { operations.push(["roundRect", ...args.map(rounded)]); }
  };
  const context = new Proxy(target, {
    get(object, property) {
      if (property in object) return object[property];
      return (...args) => operations.push([String(property), ...args.map(rounded)]);
    },
    set(object, property, value) {
      object[property] = value;
      operations.push(["set", String(property), rounded(value)]);
      return true;
    }
  });
  return {
    canvas: {
      getBoundingClientRect: () => ({ left: 0, top: 0, width, height }),
      getContext: () => context,
      height: 0,
      width: 0
    },
    operations
  };
}

export function functionBody(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `missing function ${name}`);
  const open = source.indexOf("{", start);
  let depth = 0;
  for (let index = open; index < source.length; index++) {
    if (source[index] === "{") depth++;
    if (source[index] === "}" && --depth === 0) return source.slice(open + 1, index);
  }
  assert.fail(`unterminated function ${name}`);
}
