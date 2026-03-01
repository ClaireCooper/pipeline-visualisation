import { describe, it, expect, beforeEach } from "vitest";
import { assignRows, initGantt, renderGantt } from "./gantt";
import type { ScheduledJob } from "./scheduler";
import type { ParsedPipeline } from "./parser";

describe("assignRows", () => {
  it("places non-overlapping jobs in the same row", () => {
    const jobs: ScheduledJob[] = [
      { id: "a", start: 0, end: 10 },
      { id: "b", start: 10, end: 20 },
    ];
    const rows = assignRows(jobs);
    expect(rows.get("a")).toBe(0);
    expect(rows.get("b")).toBe(0);
  });

  it("places overlapping jobs in different rows", () => {
    const jobs: ScheduledJob[] = [
      { id: "a", start: 0, end: 20 },
      { id: "b", start: 10, end: 30 },
    ];
    const rows = assignRows(jobs);
    expect(rows.get("a")).not.toBe(rows.get("b"));
  });

  it("places the longer of two overlapping jobs in the top row", () => {
    const jobs: ScheduledJob[] = [
      { id: "short", start: 0, end: 5 },
      { id: "long", start: 0, end: 20 },
    ];
    const rows = assignRows(jobs);
    expect(rows.get("long")).toBe(0);
    expect(rows.get("short")).toBe(1);
  });

  it("places equal-duration overlapping jobs in input order (first in row 0)", () => {
    const jobs: ScheduledJob[] = [
      { id: "first", start: 0, end: 10 },
      { id: "second", start: 0, end: 10 },
    ];
    const rows = assignRows(jobs);
    expect(rows.get("first")).toBe(0);
    expect(rows.get("second")).toBe(1);
  });

  it("fills a gap in an earlier row rather than opening a new one", () => {
    // long spans [0,30]; left and right each overlap long but not each other
    // gap spans [35,40] — fits in row 0 after long ends
    const jobs: ScheduledJob[] = [
      { id: "long", start: 0, end: 30 },
      { id: "left", start: 0, end: 15 },
      { id: "right", start: 15, end: 30 },
      { id: "gap", start: 35, end: 40 },
    ];
    const rows = assignRows(jobs);
    // long → row 0; left and right overlap long so they spill to rows 1+
    // gap does not overlap long (35 >= 30) so it fits back in row 0
    expect(rows.get("long")).toBe(0);
    expect(rows.get("gap")).toBe(0);
    expect(rows.get("left")).not.toBe(0);
    expect(rows.get("right")).not.toBe(0);
  });
});

describe("renderGantt pan/zoom", () => {
  const pipeline: ParsedPipeline = {
    workflows: {
      build: { nodes: [{ id: "job-a", duration: 60 }], edges: [] },
    },
  };

  const noDrillDown = (): void => undefined;

  beforeEach(() => {
    document.body.innerHTML = '<div id="gantt"></div>';
    const el = document.getElementById("gantt");
    if (!el) throw new Error("no #gantt element");
    Object.defineProperty(el, "clientWidth", {
      configurable: true,
      value: 600,
    });
    initGantt();
  });

  it("wraps chart content in a <g> with initial translate(12,12) scale(1)", () => {
    renderGantt("build", pipeline, noDrillDown);
    const g = document.querySelector("#gantt svg g");
    expect(g?.getAttribute("transform")).toBe("translate(12,12) scale(1)");
  });

  it("zooms in (scale > 1) when the wheel scrolls up", () => {
    renderGantt("build", pipeline, noDrillDown);
    const container = document.getElementById("gantt");
    if (!container) throw new Error("no #gantt element");
    container.dispatchEvent(
      new WheelEvent("wheel", {
        deltaY: -100,
        clientX: 0,
        clientY: 0,
        bubbles: true,
        cancelable: true,
      }),
    );
    const transform =
      document.querySelector("#gantt svg g")?.getAttribute("transform") ?? "";
    const scaleStr = /scale\(([\d.]+)\)/.exec(transform)?.[1];
    expect(scaleStr).not.toBeUndefined();
    expect(Number(scaleStr)).toBeGreaterThan(1);
  });

  it("pans by the drag distance", () => {
    renderGantt("build", pipeline, noDrillDown);
    const container = document.getElementById("gantt");
    if (!container) throw new Error("no #gantt element");
    container.dispatchEvent(
      new MouseEvent("mousedown", { clientX: 100, clientY: 50, bubbles: true }),
    );
    container.dispatchEvent(
      new MouseEvent("mousemove", { clientX: 150, clientY: 80, bubbles: true }),
    );
    container.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
    const g = document.querySelector("#gantt svg g");
    expect(g?.getAttribute("transform")).toBe("translate(62,42) scale(1)");
  });
});
