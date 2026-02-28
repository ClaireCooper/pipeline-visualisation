import "./style.css";

import { cy, renderWorkflow, initTooltip } from "./graph";
import { initEditor } from "./editor";
import { createNavStack, push, pop, current } from "./navigation";
import type { NavStack } from "./navigation";
import type { ParsedPipeline } from "./parser";

// DOM elements
const backBtn = document.getElementById("back-btn") as HTMLButtonElement;
const breadcrumbText = document.getElementById(
  "breadcrumb-text",
) as HTMLSpanElement;
const editorPane = document.getElementById("editor-pane") as HTMLDivElement;
const toggleBtn = document.getElementById("toggle-btn") as HTMLButtonElement;

// State
let navStack: NavStack | null = null;
let pipeline: ParsedPipeline | null = null;

function updateBreadcrumb(): void {
  if (!navStack) return;
  breadcrumbText.textContent = navStack.items.join(" › ");
  backBtn.style.display = navStack.items.length > 1 ? "inline-block" : "none";
}

function onParsed(newPipeline: ParsedPipeline): void {
  pipeline = newPipeline;
  const firstWorkflow = Object.keys(pipeline.workflows)[0];
  if (!firstWorkflow) return;

  navStack = createNavStack(firstWorkflow);
  renderWorkflow(firstWorkflow, pipeline);
  updateBreadcrumb();
  clearError();
}

// Wire up the editor and graph interactions
const { clearError } = initEditor(onParsed);
initTooltip();

// Click a node with `uses` to drill into that workflow
cy.on("tap", "node[uses]", (evt) => {
  const uses: string = evt.target.data("uses");
  if (!pipeline || !navStack || !(uses in pipeline.workflows)) return;
  navStack = push(navStack, uses);
  renderWorkflow(uses, pipeline);
  updateBreadcrumb();
});

// Editor toggle
toggleBtn.addEventListener("click", () => {
  const collapsed = editorPane.classList.toggle("collapsed");
  toggleBtn.textContent = collapsed ? "›" : "‹";
  editorPane.addEventListener(
    "transitionend",
    () => {
      cy.resize();
      cy.fit(cy.elements(), 40);
    },
    { once: true },
  );
});

// Back button
backBtn.addEventListener("click", () => {
  if (!navStack || !pipeline) return;
  navStack = pop(navStack);
  renderWorkflow(current(navStack), pipeline);
  updateBreadcrumb();
});
