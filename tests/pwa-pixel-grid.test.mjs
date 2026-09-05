import test from "node:test";
import assert from "node:assert/strict";
import { loadCanonicalRuntime } from "./fixtures/canonical-runtime.mjs";

const EPSILON = 1e-9;
const isInteger = value => Math.abs(value - Math.round(value)) < EPSILON;

test("axis-aligned strokes occupy whole device pixels at common DPR values", async () => {
  const runtime = await loadCanonicalRuntime();
  for (const dpr of [1, 1.25, 1.5, 2]) {
    for (const coordinate of [8, 17.2, 103.777]) {
      const stroke = runtime.alignedStroke(coordinate, 1, dpr);
      const center = stroke.value * dpr, width = stroke.lineWidth * dpr;
      assert.ok(isInteger(width), `DPR ${dpr}: physical stroke width must be integral`);
      assert.ok(isInteger(center - width / 2), `DPR ${dpr}: first stroke bound must be integral`);
      assert.ok(isInteger(center + width / 2), `DPR ${dpr}: second stroke bound must be integral`);
      assert.ok(Math.abs(stroke.value - coordinate) <= .5 / dpr + EPSILON, `DPR ${dpr}: snapping moved too far`);
    }
  }
});

test("candle wick and body stay centered, symmetric and device aligned", async () => {
  const runtime = await loadCanonicalRuntime();
  for (const dpr of [1, 1.25, 1.5, 2]) {
    const geometry = runtime.candlePixelGeometry(37.23, 5.7, 20.31, 43.82, { x: dpr, y: dpr });
    const center = geometry.wick.value * dpr, left = geometry.left * dpr, right = geometry.right * dpr;
    assert.ok(isInteger(left) && isInteger(right), `DPR ${dpr}: body bounds must land on device pixels`);
    assert.ok(isInteger(geometry.top * dpr) && isInteger(geometry.bottom * dpr), `DPR ${dpr}: price bounds must land on device pixels`);
    assert.ok(Math.abs((left + right) / 2 - center) < EPSILON, `DPR ${dpr}: body must share the wick center`);
    assert.ok(isInteger(center - geometry.wick.pixels / 2) && isInteger(center + geometry.wick.pixels / 2), `DPR ${dpr}: wick must have crisp bounds`);
  }
});

test("canvas grid uses the actual rounded backing-store scale", async () => {
  for (const dpr of [1, 1.25, 1.5, 2]) {
    const runtime = await loadCanonicalRuntime(undefined, { devicePixelRatio: dpr });
    const canvas = { width: 0, height: 0 }, rect = { width: 591.3, height: 237.7 };
    const grid = runtime.canvasPixelGrid(canvas, rect);
    assert.equal(canvas.width, Math.round(rect.width * dpr));
    assert.equal(canvas.height, Math.round(rect.height * dpr));
    assert.equal(grid.x, canvas.width / rect.width);
    assert.equal(grid.y, canvas.height / rect.height);
  }
});
