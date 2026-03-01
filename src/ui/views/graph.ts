import cytoscape from "cytoscape";
import dagre from "cytoscape-dagre";
import { buildElements } from "../../core/graph-elements";
import type { ParsedPipeline } from "../../core/parser";
import { showTooltip, hideTooltip } from "../tooltip";

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
      width: 100,
      height: 20,
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
      "curve-style": "bezier",
      "source-endpoint": "50% 0%",
      "target-endpoint": "-50% 0%",
    },
  },
];

export const cy = cytoscape({
  container: document.getElementById("cy"),
  style: GRAPH_STYLE,
});

export function initTooltip(): void {
  cy.on("mousemove", "node", (evt) => {
    const e = evt.originalEvent as MouseEvent;
    showTooltip(evt.target.data("label") as string, e.clientX, e.clientY);
  });
  cy.on("mouseout", "node", () => {
    hideTooltip();
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
  cy.resize();
  cy.layout({
    name: "dagre",
    rankDir: "LR",
    padding: 40,
    rankSep: 120,
    nodeSep: 10,
  } as cytoscape.LayoutOptions).run();
  cy.fit(cy.elements(), 40);
}
