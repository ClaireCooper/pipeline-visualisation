import cytoscape from "cytoscape";
import dagre from "cytoscape-dagre";

cytoscape.use(dagre);

import { parse } from "./parser";
import { buildElements } from "./elements";
import { createNavStack, push, pop, current } from "./navigation";
import type { NavStack } from "./navigation";
import type { ParsedPipeline } from "./parser";

// DOM elements
const yamlInput = document.getElementById("yaml-input") as HTMLTextAreaElement;
const fileInput = document.getElementById("file-input") as HTMLInputElement;
const errorMsg = document.getElementById("error-msg") as HTMLDivElement;
const backBtn = document.getElementById("back-btn") as HTMLButtonElement;
const breadcrumbText = document.getElementById(
  "breadcrumb-text",
) as HTMLSpanElement;

// State
let navStack: NavStack | null = null;
let pipeline: ParsedPipeline | null = null;

// Cytoscape instance
const cy = cytoscape({
  container: document.getElementById("cy"),
  style: [
    {
      selector: "node",
      style: {
        label: "data(label)",
        "text-valign": "center",
        "text-halign": "center",
        "background-color": "#4a90d9",
        color: "#fff",
        "font-size": "13px",
        width: 120,
        height: 40,
        shape: "round-rectangle",
      },
    },
    {
      selector: "node[uses]",
      style: {
        "border-width": 3,
        "border-color": "#1a5fa8",
        "border-style": "double",
      },
    },
    {
      selector: "edge",
      style: {
        width: 2,
        "line-color": "#aaa",
        "target-arrow-color": "#aaa",
        "target-arrow-shape": "triangle",
        "curve-style": "bezier",
      },
    },
  ],
});

function renderWorkflow(workflowName: string): void {
  if (!pipeline) return;
  const workflow = pipeline.workflows[workflowName];
  if (!workflow) return;

  cy.elements().remove();
  cy.add(buildElements(workflow));
  cy.layout({
    name: "dagre",
    rankDir: "LR",
    padding: 40,
  } as cytoscape.LayoutOptions).run();
}

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
  renderWorkflow(firstWorkflow);
  updateBreadcrumb();
  errorMsg.textContent = "";
}

// Click a node with `uses` to drill into that workflow
cy.on("tap", "node[uses]", (evt) => {
  const uses: string = evt.target.data("uses");
  if (!pipeline || !navStack || !(uses in pipeline.workflows)) return;
  navStack = push(navStack, uses);
  renderWorkflow(uses);
  updateBreadcrumb();
});

// Back button
backBtn.addEventListener("click", () => {
  if (!navStack) return;
  navStack = pop(navStack);
  renderWorkflow(current(navStack));
  updateBreadcrumb();
});

// Debounced parse on textarea input
let debounceTimer: ReturnType<typeof setTimeout>;
yamlInput.addEventListener("input", () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    const result = parse(yamlInput.value);
    if (result.ok) {
      onParsed(result.pipeline);
    } else {
      errorMsg.textContent = result.error;
    }
  }, 300);
});

// File upload — read into textarea, then trigger parse
fileInput.addEventListener("change", () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const text = e.target?.result;
    if (typeof text !== "string") return;
    yamlInput.value = text;
    yamlInput.dispatchEvent(new Event("input"));
  };
  reader.readAsText(file);
});
