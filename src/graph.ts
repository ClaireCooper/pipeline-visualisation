import cytoscape from "cytoscape";
import dagre from "cytoscape-dagre";
import { buildElements } from "./elements";
import type { ParsedPipeline } from "./parser";

cytoscape.use(dagre);

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
      "text-max-width": "100px",
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

export const cy = cytoscape({
  container: document.getElementById("cy"),
  style: GRAPH_STYLE,
});

const cyTooltip = document.getElementById("cy-tooltip") as HTMLDivElement;

export function initTooltip(): void {
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
}

export function renderWorkflow(
  workflowName: string,
  pipeline: ParsedPipeline,
): void {
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
