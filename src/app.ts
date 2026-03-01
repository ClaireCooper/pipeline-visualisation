import "./style.css";

import { cy, renderWorkflow, initTooltip } from "./graph";
import { initEditor } from "./editor";
import { createNavStack, push, pop, current } from "./navigation";
import type { NavStack } from "./navigation";
import type { ParsedPipeline } from "./parser";
import { renderGantt, initGantt } from "./gantt";
import { hasMissingDurations } from "./scheduler";
import { showTooltip, hideTooltip } from "./tooltip";

// DOM elements
const backBtn = document.getElementById("back-btn") as HTMLButtonElement;
const breadcrumbText = document.getElementById(
  "breadcrumb-text",
) as HTMLSpanElement;
const editorPane = document.getElementById("editor-pane") as HTMLDivElement;
const editorToggle = document.getElementById("editor-toggle") as HTMLDivElement;
const toggleBtn = document.getElementById("toggle-btn") as HTMLButtonElement;
const viewToggleBtn = document.getElementById(
  "view-toggle-btn",
) as HTMLButtonElement;
const cyEl = document.getElementById("cy") as HTMLDivElement;
const ganttEl = document.getElementById("gantt") as HTMLDivElement;

// State
let navStack: NavStack | null = null;
let pipeline: ParsedPipeline | null = null;
let view: "graph" | "gantt" = "graph";

function updateBreadcrumb(): void {
  if (!navStack) return;
  breadcrumbText.textContent = navStack.items.join(" › ");
  backBtn.style.display = navStack.items.length > 1 ? "inline-block" : "none";
}

function drillDown(uses: string): void {
  if (!pipeline || !navStack || !(uses in pipeline.workflows)) return;
  navStack = push(navStack, uses);
  render();
  updateBreadcrumb();
}

function updateToggleState(): void {
  if (!pipeline || !navStack) return;
  const wf = pipeline.workflows[current(navStack)];
  if (!wf) return;
  const missing = hasMissingDurations(wf, pipeline);
  if (missing) {
    viewToggleBtn.setAttribute("aria-disabled", "true");
    viewToggleBtn.setAttribute(
      "aria-label",
      "Toggle view (all jobs must have a duration)",
    );
  } else {
    viewToggleBtn.removeAttribute("aria-disabled");
    viewToggleBtn.setAttribute("aria-label", "Toggle view");
  }
  if (missing && view === "gantt") {
    view = "graph";
    viewToggleBtn.setAttribute("aria-checked", "false");
  }
}

function render(): void {
  if (!pipeline || !navStack) return;
  updateToggleState();
  const wf = current(navStack);
  if (view === "graph") {
    ganttEl.style.display = "none";
    cyEl.style.display = "";
    renderWorkflow(wf, pipeline);
  } else {
    cyEl.style.display = "none";
    ganttEl.style.display = "block";
    renderGantt(wf, pipeline, drillDown);
  }
}

function onParsed(newPipeline: ParsedPipeline): void {
  pipeline = newPipeline;
  const firstWorkflow = Object.keys(pipeline.workflows)[0];
  if (!firstWorkflow) return;
  navStack = createNavStack(firstWorkflow);
  render();
  updateBreadcrumb();
  clearError();
}

// Wire up the editor and graph interactions
const { clearError } = initEditor(onParsed);
initTooltip();
initGantt();

// Click a node with `uses` to drill into that workflow
cy.on("tap", "node[uses]", (evt) => {
  drillDown(evt.target.data("uses") as string);
});

// Editor toggle
toggleBtn.addEventListener("click", () => {
  const collapsed = editorPane.classList.toggle("collapsed");
  toggleBtn.textContent = collapsed ? "›" : "‹";
  editorPane.addEventListener(
    "transitionend",
    () => {
      if (view === "graph") {
        cy.resize();
        cy.fit(cy.elements(), 40);
      } else {
        render();
      }
    },
    { once: true },
  );
});

// Editor resize drag
let isDragging = false;
let didDrag = false;
let dragStartX = 0;
let dragStartWidth = 0;

function stopDrag(): void {
  isDragging = false;
  editorPane.style.transition = "";
  document.body.style.userSelect = "";
  document.body.style.cursor = "";
  if (didDrag) {
    if (view === "graph") {
      cy.resize();
      cy.fit(cy.elements(), 40);
    } else {
      render();
    }
  }
}

editorToggle.addEventListener("mousedown", (e) => {
  isDragging = true;
  didDrag = false;
  dragStartX = e.clientX;
  dragStartWidth = editorPane.offsetWidth;
  document.body.style.userSelect = "none";
  document.body.style.cursor = "col-resize";
});

document.addEventListener("mousemove", (e) => {
  if (!isDragging) return;
  if (e.buttons === 0) {
    stopDrag();
    return;
  }
  const delta = e.clientX - dragStartX;
  if (Math.abs(delta) > 4) {
    if (!didDrag) editorPane.style.transition = "none";
    didDrag = true;
  }
  if (!didDrag) return;

  const isCollapsed = editorPane.classList.contains("collapsed");
  if (isCollapsed) {
    if (delta <= 0) return;
    editorPane.classList.remove("collapsed");
    toggleBtn.textContent = "‹";
    dragStartX = e.clientX;
    dragStartWidth = 100;
  }

  const newWidth = Math.max(
    100,
    Math.min(dragStartWidth + delta, window.innerWidth * 0.75),
  );
  editorPane.style.width = `${newWidth}px`;
});

document.addEventListener("mouseup", () => {
  if (!isDragging) return;
  stopDrag();
});

// View toggle (Graph ↔ Gantt)
viewToggleBtn.addEventListener("click", () => {
  if (viewToggleBtn.getAttribute("aria-disabled") === "true") return;
  view = view === "graph" ? "gantt" : "graph";
  viewToggleBtn.setAttribute(
    "aria-checked",
    view === "gantt" ? "true" : "false",
  );
  render();
});

// Toggle tooltip when disabled
viewToggleBtn.addEventListener("mouseenter", (e) => {
  if (viewToggleBtn.getAttribute("aria-disabled") === "true") {
    showTooltip(
      "All jobs must have a duration to view a Gantt chart",
      e.clientX,
      e.clientY,
    );
  }
});
viewToggleBtn.addEventListener("mouseleave", () => hideTooltip());

// Back button
backBtn.addEventListener("click", () => {
  if (!navStack || !pipeline) return;
  navStack = pop(navStack);
  render();
  updateBreadcrumb();
});
