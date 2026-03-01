import type { Workflow, ParsedPipeline } from "./parser";

// --- Types ---

export interface ScheduledJob {
  id: string;
  start: number;
  end: number;
  uses?: string;
}

// --- Scheduling ---

export function criticalPathDuration(
  workflowName: string,
  pipeline: ParsedPipeline,
): number {
  const workflow = pipeline.workflows[workflowName];
  if (!workflow) return 0;
  return scheduledJobs(workflow, pipeline).reduce(
    (max, j) => Math.max(max, j.end),
    0,
  );
}

export function scheduledJobs(
  workflow: Workflow,
  pipeline: ParsedPipeline,
): ScheduledJob[] {
  const { nodes, edges } = workflow;

  // Build adjacency maps for Kahn's topological sort.
  // Edge direction: source → target means "source is a prerequisite of target".
  const prereqs = new Map<string, string[]>();
  const successors = new Map<string, string[]>();
  const inDegree = new Map<string, number>();
  const nodeById = new Map<string, (typeof nodes)[number]>();

  for (const node of nodes) {
    prereqs.set(node.id, []);
    successors.set(node.id, []);
    inDegree.set(node.id, 0);
    nodeById.set(node.id, node);
  }
  for (const edge of edges) {
    const targetPrereqs = prereqs.get(edge.target) ?? [];
    targetPrereqs.push(edge.source);
    prereqs.set(edge.target, targetPrereqs);

    const sourceSuccessors = successors.get(edge.source) ?? [];
    sourceSuccessors.push(edge.target);
    successors.set(edge.source, sourceSuccessors);

    inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
  }

  // BFS from zero-in-degree nodes
  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }

  const finishTime = new Map<string, number>();
  const result: ScheduledJob[] = [];

  while (queue.length > 0) {
    const id = queue.shift();
    if (id === undefined) break;

    const node = nodeById.get(id);
    if (node === undefined) continue;

    const duration =
      node.duration !== undefined
        ? node.duration
        : criticalPathDuration(node.uses ?? "", pipeline);

    const preds = prereqs.get(id) ?? [];
    const start =
      preds.length === 0
        ? 0
        : Math.max(...preds.map((p) => finishTime.get(p) ?? 0));
    const end = start + duration;
    finishTime.set(id, end);

    result.push({
      id,
      start,
      end,
      ...(node.uses !== undefined ? { uses: node.uses } : {}),
    });

    for (const succ of successors.get(id) ?? []) {
      inDegree.set(succ, (inDegree.get(succ) ?? 0) - 1);
      if (inDegree.get(succ) === 0) queue.push(succ);
    }
  }

  return result;
}

// --- Rendering ---

const CHART_W = 800; // natural px width of the bar area
const ROW_H = 32; // px height per job row
const BAR_H = 20; // px height of each bar
// TOP_P must be >= 10 to keep AXIS_LINE_Y and AXIS_LABEL_Y within the SVG viewport
const TOP_P = 24; // px top padding (axis area)
const MIN_BAR_LABEL_W = 30;
const SIDE_P = 16; // px right padding
const BOT_P = 8; // px bottom padding
const AXIS_LINE_Y = TOP_P - 4; // y of the axis tick line, just above the chart area
const AXIS_LABEL_Y = TOP_P - 6; // y of axis text labels, 2px above the tick line

function svgEl<T extends SVGElement>(tag: string): T {
  return document.createElementNS("http://www.w3.org/2000/svg", tag) as T;
}

function buildSvg(
  jobs: ScheduledJob[],
  onDrillDown: (uses: string) => void,
): { svg: SVGSVGElement; w: number; h: number } {
  const rawMax = jobs.reduce((m, j) => Math.max(m, j.end), 0);
  const maxEnd = rawMax > 0 ? rawMax : 1; // floor to 1 to avoid division by zero
  const pxPerUnit = CHART_W / maxEnd;
  const svgW = CHART_W + SIDE_P;
  const svgH = TOP_P + jobs.length * ROW_H + BOT_P;

  const svg = svgEl<SVGSVGElement>("svg");
  svg.setAttribute("viewBox", `0 0 ${svgW} ${svgH}`);
  svg.style.cssText = `width:${svgW}px;height:${svgH}px;display:block;`;

  // Axis line
  const axisLine = svgEl<SVGLineElement>("line");
  axisLine.setAttribute("x1", "0");
  axisLine.setAttribute("x2", String(CHART_W));
  axisLine.setAttribute("y1", String(AXIS_LINE_Y));
  axisLine.setAttribute("y2", String(AXIS_LINE_Y));
  axisLine.setAttribute("class", "gantt-axis-tick");
  svg.appendChild(axisLine);

  // Axis start/end labels
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

  for (const [i, job] of jobs.entries()) {
    const rowY = TOP_P + i * ROW_H;
    const barX = job.start * pxPerUnit;
    const barW = Math.max(2, (job.end - job.start) * pxPerUnit);
    const barY = rowY + (ROW_H - BAR_H) / 2;

    // Bar
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

    // Bar label (only if bar is wide enough)
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
      if (!currentSvg) return;
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

  const jobs = scheduledJobs(workflow, pipeline);
  if (jobs.length === 0) return;

  ganttScale = 1;
  jobs.sort((a, b) => a.start - b.start || a.id.localeCompare(b.id));

  const { svg, w, h } = buildSvg(jobs, onDrillDown);
  naturalW = w;
  naturalH = h;
  currentSvg = svg;
  ganttContainer.replaceChildren(currentSvg);
}
