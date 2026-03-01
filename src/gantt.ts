import type { ParsedPipeline } from "./parser";
import { calculateScheduledJobs, type ScheduledJob } from "./scheduler";

const ROW_H = 32;
const BAR_H = 20;
// TOP_PADDING must be >= 10 to keep AXIS_TICK_LINE_Y and AXIS_LABEL_Y within the SVG viewport
const TOP_PADDING = 24; // px top padding (axis area)
const MIN_BAR_LABEL_W = 30;
const RIGHT_PADDING = 1; // px right padding
const BOTTOM_PADDING = 8; // px bottom padding
const AXIS_TICK_LINE_Y = TOP_PADDING - 4;
const AXIS_LABEL_Y = TOP_PADDING - 6;

function svgEl<T extends SVGElement>(tag: string): T {
  return document.createElementNS("http://www.w3.org/2000/svg", tag) as T;
}

function buildAxis(
  svg: SVGSVGElement,
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
  svg.appendChild(axisLine);

  for (const [val, anchor] of [
    [0, "start"],
    [rawMax, "end"],
  ] as [number, string][]) {
    const t = svgEl<SVGTextElement>("text");
    t.setAttribute("x", String(val * pxPerUnit));
    t.setAttribute("y", String(AXIS_LABEL_Y));
    t.setAttribute("text-anchor", anchor);
    t.setAttribute("class", "gantt-axis-label");
    t.textContent = String(val);
    svg.appendChild(t);
  }
}

function buildJobRow(
  svg: SVGSVGElement,
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
  svg.appendChild(rect);

  if (barW > MIN_BAR_LABEL_W) {
    const barLabel = svgEl<SVGTextElement>("text");
    barLabel.setAttribute("x", String(barX + 4));
    barLabel.setAttribute("y", String(barY + BAR_H / 2));
    barLabel.setAttribute("dominant-baseline", "middle");
    barLabel.setAttribute("class", "gantt-label");
    barLabel.textContent = job.id;
    svg.appendChild(barLabel);
  }
}

function buildSvg(
  jobs: ScheduledJob[],
  onDrillDown: (uses: string) => void,
  contentW: number,
): { svg: SVGSVGElement; w: number; h: number } {
  const svg = svgEl<SVGSVGElement>("svg");

  const svgW = contentW;
  const svgH = TOP_PADDING + jobs.length * ROW_H + BOTTOM_PADDING;

  svg.setAttribute("viewBox", `0 0 ${svgW} ${svgH}`);
  svg.style.cssText = `width:${svgW}px;height:${svgH}px;display:block;`;

  const rawMax = jobs.reduce((m, j) => Math.max(m, j.end), 0);
  const chartW = contentW - RIGHT_PADDING;
  const pxPerUnit = chartW / (rawMax > 0 ? rawMax : 1);

  buildAxis(svg, chartW, rawMax, pxPerUnit);
  for (const [i, job] of jobs.entries()) {
    buildJobRow(svg, job, i, pxPerUnit, onDrillDown);
  }

  return { svg, w: svgW, h: svgH };
}

// Module-level render state — written by renderGantt, read by the wheel listener in initGantt
let ganttContainer: HTMLDivElement | null = null;
let ganttScale = 1;
let currentSvg: SVGSVGElement | null = null;
let naturalW = 0;
let naturalH = 0;

export function initGantt(): void {
  const el = document.getElementById("gantt");
  if (!el) throw new Error("#gantt element not found");
  ganttContainer = el as HTMLDivElement;
  ganttContainer.addEventListener(
    "wheel",
    (e) => {
      if (!currentSvg || !ganttContainer) return;
      e.preventDefault();
      ganttScale = Math.min(
        4,
        Math.max(0.25, ganttScale * (e.deltaY < 0 ? 1.1 : 0.9)),
      );
      currentSvg.style.width = `${ganttScale * naturalW}px`;
      currentSvg.style.height = `${ganttScale * naturalH}px`;
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

  ganttScale = 1;
  jobs.sort((a, b) => a.start - b.start || a.id.localeCompare(b.id));

  // #gantt has padding: 12px on each side; subtract to get the drawable content width
  const contentW = ganttContainer.clientWidth - 24;
  const { svg, w, h } = buildSvg(jobs, onDrillDown, contentW);
  naturalW = w;
  naturalH = h;
  currentSvg = svg;
  ganttContainer.replaceChildren(currentSvg);
}
