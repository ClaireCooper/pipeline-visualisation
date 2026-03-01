import "./style.css";

import { cy, renderWorkflow, initTooltip } from "./graph";
import { initEditor } from "./editor";
import { createNavStack, push, pop, current } from "./navigation";
import type { NavStack } from "./navigation";
import type { ParsedPipeline } from "./parser";
import { renderGantt, initGantt } from "./gantt";

// DOM elements
const backBtn = document.getElementById("back-btn") as HTMLButtonElement;
const breadcrumbText = document.getElementById(
  "breadcrumb-text",
) as HTMLSpanElement;
const editorPane = document.getElementById("editor-pane") as HTMLDivElement;
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

function render(): void {
  if (!pipeline || !navStack) return;
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

// View toggle (Graph ↔ Gantt)
viewToggleBtn.addEventListener("click", () => {
  view = view === "graph" ? "gantt" : "graph";
  viewToggleBtn.setAttribute(
    "aria-checked",
    view === "gantt" ? "true" : "false",
  );
  render();
});

// Back button
backBtn.addEventListener("click", () => {
  if (!navStack || !pipeline) return;
  navStack = pop(navStack);
  render();
  updateBreadcrumb();
});
