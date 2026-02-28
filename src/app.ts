import "./style.css";
import { EditorView, basicSetup } from "codemirror";
import { yaml } from "@codemirror/lang-yaml";
import { oneDark } from "@codemirror/theme-one-dark";
import cytoscape from "cytoscape";
import dagre from "cytoscape-dagre";

cytoscape.use(dagre);
import { parse } from "./parser";
import { buildElements } from "./elements";
import { createNavStack, push, pop, current } from "./navigation";
import type { NavStack } from "./navigation";
import type { ParsedPipeline } from "./parser";

// DOM elements
const fileInput = document.getElementById("file-input") as HTMLInputElement;
const errorMsg = document.getElementById("error-msg") as HTMLDivElement;
const backBtn = document.getElementById("back-btn") as HTMLButtonElement;
const breadcrumbText = document.getElementById(
  "breadcrumb-text",
) as HTMLSpanElement;
const editorPane = document.getElementById("editor-pane") as HTMLDivElement;
const toggleBtn = document.getElementById("toggle-btn") as HTMLButtonElement;
const cyTooltip = document.getElementById("cy-tooltip") as HTMLDivElement;

// State
let navStack: NavStack | null = null;
let pipeline: ParsedPipeline | null = null;

const GRAPH_STYLE: cytoscape.StylesheetStyle[] = [
  {
    selector: "node",
    style: {
      label: "data(label)",
      "text-valign": "center",
      "text-halign": "center",
      "background-color": "#1e1e1e",
      "border-width": 1,
      "border-color": "#c586c0",
      color: "#c586c0",
      "font-size": "10px",
      "font-family": "monospace",
      "text-wrap": "ellipsis",
      "text-max-width": 100,
      width: 120,
      height: 36,
      shape: "round-rectangle",
    },
  },
  {
    selector: "node[uses]",
    style: {
      "border-width": 2,
      "border-style": "double",
    },
  },
  {
    selector: "edge",
    style: {
      width: 1.5,
      "line-color": "#ce9178",
      "target-arrow-shape": "none",
      "curve-style": "taxi",
      "taxi-direction": "rightward",
    },
  },
];

// Cytoscape instance
const cy = cytoscape({
  container: document.getElementById("cy"),
  style: GRAPH_STYLE,
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

// Node tooltip
cy.on("mouseover", "node", (evt) => {
  cyTooltip.textContent = evt.target.data("label");
  cyTooltip.style.display = "block";
});
cy.on("mousemove", "node", (evt) => {
  const e = evt.originalEvent as MouseEvent;
  cyTooltip.style.left = `${e.clientX + 12}px`;
  cyTooltip.style.top = `${e.clientY - 8}px`;
});
cy.on("mouseout", "node", () => {
  cyTooltip.style.display = "none";
});

// Click a node with `uses` to drill into that workflow
cy.on("tap", "node[uses]", (evt) => {
  const uses: string = evt.target.data("uses");
  if (!pipeline || !navStack || !(uses in pipeline.workflows)) return;
  navStack = push(navStack, uses);
  renderWorkflow(uses);
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
  if (!navStack) return;
  navStack = pop(navStack);
  renderWorkflow(current(navStack));
  updateBreadcrumb();
});

// CodeMirror editor with debounced parse on change
let debounceTimer: ReturnType<typeof setTimeout>;
const editor = new EditorView({
  extensions: [
    basicSetup,
    yaml(),
    oneDark,
    EditorView.updateListener.of((update) => {
      if (!update.docChanged) return;
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        const result = parse(editor.state.doc.toString());
        if (result.ok) {
          onParsed(result.pipeline);
        } else {
          errorMsg.textContent = result.error;
        }
      }, 300);
    }),
  ],
  parent: document.getElementById("yaml-input")!,
});

// File upload — load into editor, parse fires via updateListener
fileInput.addEventListener("change", () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const text = e.target?.result;
    if (typeof text !== "string") return;
    editor.dispatch({
      changes: { from: 0, to: editor.state.doc.length, insert: text },
    });
  };
  reader.readAsText(file);
});
