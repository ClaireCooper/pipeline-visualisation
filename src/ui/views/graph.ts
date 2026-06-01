import cytoscape from "cytoscape";
import dagre from "cytoscape-dagre";
import cytoscapeSvg from "cytoscape-svg";
import { buildElements } from "../../core/graph-elements";
import type { ParsedPipeline } from "../../core/parser";
import { showTooltip, hideTooltip } from "../tooltip";

cytoscape.use(dagre);
cytoscape.use(cytoscapeSvg);

const GRAPH_STYLE: cytoscape.StylesheetStyle[] = [
  {
    selector: "node",
    style: {
      label: "data(displayLabel)",
      "text-valign": "center",
      "text-halign": "center",
      "background-color": "#1e1e1e",
      "border-width": 1,
      "border-color": "#c586c0",
      color: "#c586c0",
      "font-size": "14px",
      "font-family": "monospace",
      "line-height": 1.6,
      "text-wrap": "wrap",
      "text-max-width": "100px",
      width: 128,
      height: 32,
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
    selector: "node.dependency-highlight",
    style: {
      "border-color": "#47cbbc",
      "border-width": 2,
    },
  },
  {
    selector: "edge",
    style: {
      width: 1.5,
      "line-color": "#f9b062",
      "target-arrow-shape": "none",
      "curve-style": "bezier",
      "source-endpoint": "50% 0%",
      "target-endpoint": "-50% 0%",
    },
  },
  {
    selector: "edge.dependency-highlight",
    style: {
      "line-color": "#47cbbc",
    },
  },
];

const TARGET_FONT_SIZE = 14;
const LINE_HEIGHT_RATIO = 1.6;
const VERTICAL_PADDING_PX = 9;
const TEXT_MAX_WIDTH = 100; // model units, matches text-max-width style
const CHAR_WIDTH_PX = 8.5; // approx px per char at TARGET_FONT_SIZE monospace

const MAX_LINES = 3;

function wrapLabel(id: string, maxChars: number): string {
  if (id.length <= maxChars) return id;
  const parts = id.split(/(?<=[-_])/);
  const lines: string[] = [];
  let current = "";
  for (const part of parts) {
    if (current.length + part.length > maxChars && current.length > 0) {
      lines.push(current);
      current = part;
    } else {
      current += part;
    }
  }
  if (current) lines.push(current);
  if (lines.length > MAX_LINES) {
    const truncated = lines.slice(0, MAX_LINES);
    truncated[MAX_LINES - 1] =
      truncated[MAX_LINES - 1].replace(/[-_]$/, "") + "…";
    return truncated.join("\n");
  }
  return lines.join("\n");
}

export const cy = cytoscape({
  container: document.getElementById("cy"),
  style: GRAPH_STYLE,
});

function updateNodeStyles(): void {
  const zoom = cy.zoom();
  const fontSizeModel = TARGET_FONT_SIZE / zoom;
  const lineHeightModel = fontSizeModel * LINE_HEIGHT_RATIO;
  const vertPadModel = VERTICAL_PADDING_PX / zoom;
  const charsPerLine = Math.floor((TEXT_MAX_WIDTH * zoom) / CHAR_WIDTH_PX);
  cy.nodes().forEach((node) => {
    const id = node.data("label") as string;
    const displayLabel = wrapLabel(id, charsPerLine);
    node.data("displayLabel", displayLabel);
    const lines = displayLabel.split("\n").length;
    node.style({
      "font-size": `${fontSizeModel}px`,
      height: lines * lineHeightModel + vertPadModel * 2,
    });
  });
}

let activeNodeId: string | null = null;

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
  selectedJobId: string | null = null,
): void {
  const workflow = pipeline.workflows[workflowName];
  if (!workflow) return;

  cy.elements().remove();
  cy.add(buildElements(workflow));
  updateNodeStyles();
  cy.layout({
    name: "dagre",
    rankDir: "LR",
    padding: 40,
    rankSep: 120,
    nodeSep: 10,
  } as cytoscape.LayoutOptions).run();
  cy.resize();
  cy.fit(cy.elements(), 40);

  activeNodeId = selectedJobId;
  if (selectedJobId) {
    const selected = cy.$(`#${selectedJobId}`);
    selected.predecessors().addClass("dependency-highlight");
    selected.addClass("dependency-highlight");
  }
}

export function initDependencyHighlight(
  onSelect: (id: string | null) => void,
): void {
  cy.on("tap", "node", (evt) => {
    const node = evt.target as cytoscape.NodeSingular;
    const nodeId = node.id();
    cy.elements().removeClass("dependency-highlight");
    if (nodeId === activeNodeId) {
      activeNodeId = null;
      onSelect(null);
    } else {
      node.predecessors().addClass("dependency-highlight");
      node.addClass("dependency-highlight");
      activeNodeId = nodeId;
      onSelect(nodeId);
    }
  });
  cy.on("tap", (evt) => {
    if (evt.target === cy) {
      cy.elements().removeClass("dependency-highlight");
      activeNodeId = null;
      onSelect(null);
    }
  });
}

export function exportGraphSvg(): string {
  return cy.svg({ full: true, bg: "#1e1e1e" });
}
