import type { ParsedPipeline } from "../../core/parser";
import {
  calculateScheduledJobs,
  type ScheduledJob,
} from "../../core/scheduler";
import { showTooltip, hideTooltip } from "../tooltip";

const ROW_H = 32;
const BAR_H = 20;
// TOP_PADDING must be >= 10 to keep AXIS_TICK_LINE_Y and AXIS_LABEL_Y within the SVG viewport
const TOP_PADDING = 24; // px top padding (axis area)
const MIN_BAR_LABEL_W = 30;
const RIGHT_PADDING = 3; // px right padding
const LABEL_PADDING = 8; // px horizontal padding inside bar (4px each side)
const CHAR_W = 6; // approximate px per char for monospace 10px
const AXIS_TICK_LINE_Y = TOP_PADDING - 4;
const AXIS_LABEL_Y = TOP_PADDING - 6;
const CONTENT_PADDING = 12; // px padding around chart content

export function assignRows(jobs: ScheduledJob[]): Map<string, number> {
  const sorted = [...jobs].sort((a, b) => b.end - b.start - (a.end - a.start));
  const rows: [number, number][][] = [];
  const result = new Map<string, number>();

  for (const job of sorted) {
    let placed = false;
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      const overlaps = row.some(([s, e]) => job.start < e && s < job.end);
      if (!overlaps) {
        row.push([job.start, job.end]);
        result.set(job.id, r);
        placed = true;
        break;
      }
    }
    if (!placed) {
      rows.push([[job.start, job.end]]);
      result.set(job.id, rows.length - 1);
    }
  }

  return result;
}

function svgEl<T extends SVGElement>(tag: string): T {
  return document.createElementNS("http://www.w3.org/2000/svg", tag) as T;
}

function truncateLabel(text: string, barW: number): string {
  const maxChars = Math.floor((barW - LABEL_PADDING) / CHAR_W);
  if (text.length <= maxChars) return text;
  return text.slice(0, Math.max(1, maxChars - 1)) + "…";
}

function formatDuration(seconds: number, includeHours: boolean): string {
  const s = Math.round(seconds);
  const sec = String(s % 60).padStart(2, "0");
  if (includeHours) {
    const h = Math.floor(s / 3600);
    const m = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
    return `${h}:${m}:${sec}`;
  }
  return `${Math.floor(s / 60)}:${sec}`;
}

const NICE_INTERVALS = [
  1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600, 7200, 14400, 28800,
  86400,
];

function niceTickInterval(rawMax: number): number {
  const rough = rawMax / 5;
  return (
    NICE_INTERVALS.find((i) => i >= rough) ??
    NICE_INTERVALS[NICE_INTERVALS.length - 1]
  );
}

function buildAxis(
  parent: Element,
  chartW: number,
  rawMax: number,
  pxPerUnit: number,
): void {
  const axisLine = svgEl<SVGLineElement>("line");
  axisLine.setAttribute("x1", "0");
  axisLine.setAttribute("x2", String(chartW));
  axisLine.setAttribute("y1", String(AXIS_TICK_LINE_Y));
  axisLine.setAttribute("y2", String(AXIS_TICK_LINE_Y));
  axisLine.setAttribute("class", "gantt-axis-tick");
  parent.appendChild(axisLine);

  const interval = niceTickInterval(rawMax);
  const count = Math.floor(rawMax / interval);
  const ticks: number[] = [];
  for (let i = 0; i <= count; i++) ticks.push(i * interval);
  if (ticks[ticks.length - 1] !== rawMax) {
    if (rawMax - ticks[ticks.length - 1] < interval / 2) {
      ticks[ticks.length - 1] = rawMax;
    } else {
      ticks.push(rawMax);
    }
  }

  const includeHours = rawMax >= 3600;
  for (const val of ticks) {
    const x = val * pxPerUnit;

    const tick = svgEl<SVGLineElement>("line");
    tick.setAttribute("x1", String(x));
    tick.setAttribute("x2", String(x));
    tick.setAttribute("y1", String(AXIS_TICK_LINE_Y));
    tick.setAttribute("y2", String(AXIS_TICK_LINE_Y + 5));
    tick.setAttribute("class", "gantt-axis-tick");
    parent.appendChild(tick);

    const anchor = val === 0 ? "start" : val === rawMax ? "end" : "middle";
    const t = svgEl<SVGTextElement>("text");
    t.setAttribute("x", String(x));
    t.setAttribute("y", String(AXIS_LABEL_Y));
    t.setAttribute("text-anchor", anchor);
    t.setAttribute("class", "gantt-axis-label");
    t.textContent = formatDuration(val, includeHours);
    parent.appendChild(t);
  }
}

function buildJobRow(
  parent: Element,
  job: ScheduledJob,
  rowIndex: number,
  pxPerUnit: number,
  onDrillDown: (uses: string) => void,
): void {
  const rowY = TOP_PADDING + rowIndex * ROW_H;
  const barX = job.start * pxPerUnit;
  const barW = Math.max(2, (job.end - job.start) * pxPerUnit);
  const barY = rowY + (ROW_H - BAR_H) / 2;

  const rect = svgEl<SVGRectElement>("rect");
  rect.setAttribute("x", String(barX));
  rect.setAttribute("y", String(barY));
  rect.setAttribute("width", String(barW));
  rect.setAttribute("height", String(BAR_H));
  rect.setAttribute(
    "class",
    job.uses ? "gantt-bar gantt-bar--uses" : "gantt-bar",
  );
  if (job.uses) {
    const uses = job.uses;
    rect.addEventListener("click", () => onDrillDown(uses));
  }
  rect.addEventListener("mousemove", (e) => {
    const duration = job.end - job.start;
    showTooltip(
      `${job.id} (${formatDuration(duration, duration >= 3600)})`,
      e.clientX,
      e.clientY,
    );
  });
  rect.addEventListener("mouseout", () => {
    hideTooltip();
  });
  parent.appendChild(rect);

  if (barW > MIN_BAR_LABEL_W) {
    const barLabel = svgEl<SVGTextElement>("text");
    barLabel.setAttribute("x", String(barX + 4));
    barLabel.setAttribute("y", String(barY + BAR_H / 2));
    barLabel.setAttribute("dominant-baseline", "middle");
    barLabel.setAttribute("class", "gantt-label");
    barLabel.textContent = truncateLabel(job.id, barW);
    parent.appendChild(barLabel);
  }
}

function buildSvg(
  jobs: ScheduledJob[],
  onDrillDown: (uses: string) => void,
  contentW: number,
): { svg: SVGSVGElement; g: SVGGElement } {
  const svg = svgEl<SVGSVGElement>("svg");
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", "100%");

  const g = svgEl<SVGGElement>("g");
  svg.appendChild(g);

  const rowMap = assignRows(jobs);
  const rawMax = jobs.reduce((m, j) => Math.max(m, j.end), 0);
  const chartW = contentW - RIGHT_PADDING;
  const pxPerUnit = chartW / (rawMax > 0 ? rawMax : 1);

  buildAxis(g, chartW, rawMax, pxPerUnit);
  for (const job of jobs) {
    buildJobRow(g, job, rowMap.get(job.id) ?? 0, pxPerUnit, onDrillDown);
  }

  return { svg, g };
}

// Module-level render state — written by renderGantt, read by event listeners in initGantt
let ganttContainer: HTMLDivElement | null = null;
let contentGroup: SVGGElement | null = null;
let panX = 0;
let panY = 0;
let ganttScale = 1;

function updateTransform(): void {
  if (!contentGroup) return;
  contentGroup.setAttribute(
    "transform",
    `translate(${panX},${panY}) scale(${ganttScale})`,
  );
}

export function resetGanttZoom(): void {
  panX = CONTENT_PADDING;
  panY = CONTENT_PADDING;
  ganttScale = 1;
  updateTransform();
}

export function initGantt(): void {
  const el = document.getElementById("gantt");
  if (!el) throw new Error("#gantt element not found");
  ganttContainer = el as HTMLDivElement;
  const container = ganttContainer;

  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  container.addEventListener("mousedown", (e) => {
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    container.style.cursor = "grabbing";
    hideTooltip();
    e.preventDefault();
  });

  container.addEventListener("mousemove", (e) => {
    if (!dragging || !contentGroup) return;
    panX += e.clientX - lastX;
    panY += e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    updateTransform();
  });

  container.addEventListener("mouseup", () => {
    if (!dragging) return;
    dragging = false;
    container.style.cursor = "";
  });

  container.addEventListener("mouseleave", () => {
    if (!dragging) return;
    dragging = false;
    container.style.cursor = "";
  });

  container.addEventListener(
    "wheel",
    (e) => {
      if (!contentGroup) return;
      e.preventDefault();
      const f = e.deltaY < 0 ? 1.1 : 0.9;
      const newScale = Math.min(10, Math.max(0.1, ganttScale * f));
      const actualF = newScale / ganttScale;
      const rect = container.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      panX = cx - (cx - panX) * actualF;
      panY = cy - (cy - panY) * actualF;
      ganttScale = newScale;
      updateTransform();
    },
    { passive: false },
  );
}

export function renderGantt(
  workflowName: string,
  pipeline: ParsedPipeline,
  onDrillDown: (uses: string) => void,
): void {
  if (!ganttContainer) throw new Error("renderGantt called before initGantt");

  const workflow = pipeline.workflows[workflowName];
  if (!workflow) return;

  const jobs = calculateScheduledJobs(workflow, pipeline);
  if (jobs.length === 0) return;

  jobs.sort((a, b) => a.start - b.start || a.id.localeCompare(b.id));

  const contentW = ganttContainer.clientWidth - CONTENT_PADDING * 2;
  const { svg, g } = buildSvg(jobs, onDrillDown, contentW);
  contentGroup = g;
  panX = CONTENT_PADDING;
  panY = CONTENT_PADDING;
  ganttScale = 1;
  updateTransform();
  ganttContainer.replaceChildren(svg);
}
