import { describe, it, expect, beforeEach } from "vitest";
import {
  assignRows,
  getAncestors,
  initGantt,
  renderGantt,
  resetGanttZoom,
  wrapLabel,
} from "./gantt";
import type { ScheduledJob } from "../../core/scheduler";
import type { Edge, ParsedPipeline } from "../../core/parser";

describe("getAncestors", () => {
  it("returns empty set for a node with no incoming edges", () => {
    const edges: Edge[] = [{ source: "a", target: "b" }];
    expect(getAncestors("a", edges)).toEqual(new Set());
  });

  it("returns direct parents", () => {
    const edges: Edge[] = [
      { source: "a", target: "c" },
      { source: "b", target: "c" },
    ];
    expect(getAncestors("c", edges)).toEqual(new Set(["a", "b"]));
  });

  it("returns transitive ancestors", () => {
    const edges: Edge[] = [
      { source: "a", target: "b" },
      { source: "b", target: "c" },
    ];
    expect(getAncestors("c", edges)).toEqual(new Set(["a", "b"]));
  });

  it("handles diamond dependencies without duplicates", () => {
    const edges: Edge[] = [
      { source: "a", target: "b" },
      { source: "a", target: "c" },
      { source: "b", target: "d" },
      { source: "c", target: "d" },
    ];
    expect(getAncestors("d", edges)).toEqual(new Set(["a", "b", "c"]));
  });
});

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
    Object.defineProperty(el, "clientHeight", {
      configurable: true,
      value: 400,
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

  it("resets pan and zoom to initial values", () => {
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
    container.dispatchEvent(
      new MouseEvent("mousedown", { clientX: 100, clientY: 50, bubbles: true }),
    );
    container.dispatchEvent(
      new MouseEvent("mousemove", { clientX: 150, clientY: 80, bubbles: true }),
    );
    container.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));

    const g = document.querySelector("#gantt svg g");
    expect(g?.getAttribute("transform")).not.toBe("translate(12,12) scale(1)");

    resetGanttZoom();

    expect(g?.getAttribute("transform")).toBe("translate(12,12) scale(1)");
  });

  it("uses MAX_ROW_H bars when container has room for one row", () => {
    // clientHeight=400, TOP_PADDING=24, CONTENT_PADDING=12 → contentH=352
    // 1 row → rowH = min(72, 352) = 72 → barH = 72-12 = 60
    renderGantt("build", pipeline, noDrillDown);
    const rect = document.querySelector<SVGRectElement>("#gantt .gantt-bar");
    expect(rect?.getAttribute("height")).toBe("60");
  });
});

// Constants used below match gantt.ts: CHAR_W=7, LABEL_PADDING=8, LINE_H=15, BAR_TEXT_V_PADDING=8
// barW=50 → maxCharsPerLine = floor((50-8)/7) = 6
// barW=100 → maxCharsPerLine = floor((100-8)/7) = 13
// barH=20 → maxLines = max(1, floor((20-8)/15)) = max(1,0) = 1  ← MIN_ROW_H case
// barH=32 → maxLines = max(1, floor((32-8)/15)) = max(1,1) = 1
// barH=72 → maxLines = max(1, floor((72-8)/15)) = max(1,4) = 4

describe("wrapLabel", () => {
  it("returns single line when label fits", () => {
    expect(wrapLabel("abc", 100, 72)).toEqual(["abc"]);
  });

  it("returns single line when label exactly fills the width", () => {
    // 6 chars exactly fills barW=50
    expect(wrapLabel("abcdef", 50, 72)).toEqual(["abcdef"]);
  });

  it("wraps at a hyphen when label is too wide", () => {
    // 'build-test' (10 chars) → break after 'build-' (6 chars = maxCharsPerLine)
    expect(wrapLabel("build-test", 50, 72)).toEqual(["build-", "test"]);
  });

  it("wraps at an underscore when label is too wide", () => {
    expect(wrapLabel("build_test", 50, 72)).toEqual(["build_", "test"]);
  });

  it("wraps mid-character when there are no separators", () => {
    // 'abcdefghij' (10 chars) → 'abcdef', 'ghij'
    expect(wrapLabel("abcdefghij", 50, 72)).toEqual(["abcdef", "ghij"]);
  });

  it("truncates last line with ellipsis when content exceeds maxLines", () => {
    // barH=32 → maxLines=1; 'abcdefghijklmno' wraps to multiple lines → truncate first
    // 'abcdef'.slice(0,5)+'…' = 'abcde…'
    expect(wrapLabel("abcdefghijklmno", 50, 32)).toEqual(["abcde…"]);
  });

  it("truncates a hyphen-wrapped last line with ellipsis", () => {
    // barH=32 → maxLines=1; 'build-test' wraps to ['build-','test'] → truncate
    // 'build-'.slice(0,5)+'…' = 'build…'
    expect(wrapLabel("build-test", 50, 32)).toEqual(["build…"]);
  });

  it("truncates with ellipsis at MIN_ROW_H bar height (barH=20, maxLines clamped to 1)", () => {
    // barH=20 (MIN_ROW_H-12): max(1, floor((20-8)/15)) = 1, not 0
    // 'build-test' wraps to ['build-','test'] → truncate to 'build…'
    expect(wrapLabel("build-test", 50, 20)).toEqual(["build…"]);
  });
});
