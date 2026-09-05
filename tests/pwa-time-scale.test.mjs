import test from "node:test";
import assert from "node:assert/strict";
import { loadCanonicalRuntime } from "./fixtures/canonical-runtime.mjs";

const DAY = 86400000;
const series = (start, count, step) => Array.from({ length: count }, (_, index) => start + index * step);
const labelsOfKind = (ticks, kind) => ticks.filter(tick => tick.kind === kind).map(tick => tick.label);
const configure = (runtime, selected, times, zoomBars = times.length) => Object.assign(runtime.state, {
  selected, times, zoomBars, closes: times.map(() => 1), rows: times.map(time => ({ time, close: 1 }))
});

test("daily ticks reveal calendar days monotonically while retaining month boundaries", async () => {
  const runtime = await loadCanonicalRuntime();
  const times = series(Date.UTC(2026, 7, 1), 80, DAY);
  configure(runtime, "D", times, 62);
  const wideSpan = runtime.timeTicks(0, 434);
  assert.deepEqual(Array.from(labelsOfKind(wideSpan, "day")), []);
  assert.deepEqual(Array.from(wideSpan.filter(tick => tick.major), tick => tick.label), ["Aug", "Sep", "Oct"]);

  const steps = [];
  for (const zoomBars of [42, 32, 22, 12]) {
    runtime.state.zoomBars = zoomBars;
    const ticks = runtime.timeTicks(0, 434);
    const augustDays = ticks.filter(tick => tick.kind === "day" && new Date(runtime.timeAt(tick.index)).getUTCMonth() === 7).map(tick => Number(tick.label));
    steps.push(Math.min(...augustDays.slice(1).map((day, index) => day - augustDays[index])));
    assert.equal(ticks[0].label, "Aug");
  }
  assert.ok(steps.every((step, index) => index === 0 || step <= steps[index - 1]), `day cadence did not refine monotonically: ${steps}`);
  assert.equal(steps.at(-1), 1, `zoomed daily chart should reach one label per day: ${steps}`);
});

test("minor time ticks keep a roomier target without blocking finer zoom tiers", async () => {
  const runtime = await loadCanonicalRuntime();
  const times = series(Date.UTC(2026, 7, 1), 180, DAY);
  configure(runtime, "D", times, 120);
  const mediumDays = runtime.timeTicks(0, 1200).filter(tick => tick.kind === "day" && new Date(runtime.timeAt(tick.index)).getUTCMonth() === 7);
  assert.deepEqual(Array.from(mediumDays, tick => Number(tick.label)), [6, 11, 16, 21, 26]);

  runtime.state.zoomBars = 20;
  const fineDays = runtime.timeTicks(0, 1200).filter(tick => tick.kind === "day");
  assert.ok(fineDays.length >= 18, "deep zoom should still reach daily labels");
});

test("intraday hierarchy reaches hour and 30-minute labels when pixels allow", async () => {
  const runtime = await loadCanonicalRuntime(), start = Date.UTC(2026, 7, 31);
  configure(runtime, "H4", series(start, 80, 4 * 3600000), 40);
  const hourly = runtime.timeTicks(0, 600);
  assert.ok(hourly.some(tick => tick.kind === "hour"));
  assert.ok(hourly.some(tick => tick.kind === "month" && tick.label === "Sep"));

  configure(runtime, "30m", series(start, 80, 30 * 60000), 48);
  const minutes = runtime.timeTicks(0, 2400);
  assert.ok(minutes.some(tick => tick.kind === "minute" && tick.label.endsWith(":30")));
  assert.ok(minutes.some(tick => tick.kind === "hour" || tick.kind === "minute"));
});

test("calendar hierarchy is UTC-safe across leap day and year boundaries", async () => {
  const runtime = await loadCanonicalRuntime();
  configure(runtime, "D", series(Date.UTC(2024, 1, 27), 310, DAY), 8);
  const leap = runtime.timeTicks(0, 500);
  assert.ok(leap.some(tick => tick.kind === "day" && tick.label === "29"));

  configure(runtime, "M", Array.from({ length: 36 }, (_, index) => Date.UTC(2023, index, 1)), 36);
  const years = runtime.timeTicks(0, 700);
  assert.deepEqual(Array.from(years.filter(tick => tick.kind === "year"), tick => tick.label), ["2023", "2024", "2025"]);
});

test("adaptive labels never overlap, duplicate an index, or leave chronological order", async () => {
  const runtime = await loadCanonicalRuntime(), measure = value => String(value).length * 6;
  for (const [selected, step] of [["30m", 30 * 60000], ["H1", 3600000], ["H2", 2 * 3600000], ["H4", 4 * 3600000], ["H8", 8 * 3600000], ["H12", 12 * 3600000], ["D", DAY], ["3D", 3 * DAY], ["1W", 7 * DAY], ["2W", 14 * DAY], ["M", null]]) {
    const times = step ? series(Date.UTC(2025, 10, 15), 180, step) : Array.from({ length: 180 }, (_, index) => Date.UTC(2012, index, 1)); configure(runtime, selected, times, 120);
    const width = 640, ticks = runtime.timeTicks(0, width, measure), boxes = ticks.map(tick => {
      const x = tick.index / (runtime.state.zoomBars - 1) * width, textWidth = measure(tick.label) + 8;
      return tick.align === "left" ? [x, x + textWidth] : tick.align === "right" ? [x - textWidth, x] : [x - textWidth / 2, x + textWidth / 2];
    });
    assert.equal(new Set(ticks.map(tick => tick.index)).size, ticks.length, selected);
    assert.ok(ticks.every((tick, index) => index === 0 || tick.index > ticks[index - 1].index), selected);
    assert.ok(boxes.every((box, index) => index === 0 || box[0] >= boxes[index - 1][1] + 4.9), `${selected}: ${JSON.stringify({ ticks, boxes })}`);
  }
});

test("time-axis drag follows TradingView's distance-from-right scale trajectory", async () => {
  const runtime = await loadCanonicalRuntime(), plotLeft = 40, plotWidth = 1907, startX = 1009, startZoom = 400;
  assert.equal(runtime.timeScaleDragZoom(startZoom, startX, startX, plotLeft, plotWidth), startZoom);
  assert.equal(runtime.timeScaleDragZoom(startZoom, startX, 1326, plotLeft, plotWidth), 604);
  assert.equal(runtime.timeScaleDragZoom(startZoom, startX, 1563, plotLeft, plotWidth), 976);
  assert.equal(runtime.timeScaleDragZoom(startZoom, startX, 1309, plotLeft, plotWidth), 588);
  assert.equal(runtime.timeScaleDragZoom(startZoom, startX, 897, plotLeft, plotWidth), 357);
  assert.equal(runtime.timeScaleDragZoom(startZoom, startX, 694, plotLeft, plotWidth), 300);
});

test("time-axis drag reverses without drift and respects visible-bar limits", async () => {
  const runtime = await loadCanonicalRuntime(), left = 8, width = 1139, right = left + width, startX = 500;
  const outward = runtime.timeScaleDragZoom(120, startX, startX + 300, left, width);
  assert.equal(outward, 223);
  assert.equal(runtime.timeScaleDragZoom(120, startX, startX, left, width), 120);
  assert.equal(runtime.timeScaleDragZoom(120, startX, right - 1, left, width), 1000);
  assert.equal(runtime.timeScaleDragZoom(20, startX, left - 500, left, width), 20);
});
