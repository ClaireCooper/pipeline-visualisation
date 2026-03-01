import type { Workflow } from "./parser";

export interface ElementData {
  id: string;
  source?: string;
  target?: string;
  label?: string;
  duration?: number;
  uses?: string;
}

export interface CyElement {
  group: "nodes" | "edges";
  data: ElementData;
}

export function buildElements(workflow: Workflow): CyElement[] {
  const nodes: CyElement[] = workflow.nodes.map((node) => ({
    group: "nodes",
    data: {
      id: node.id,
      label: node.id,
      ...(node.duration !== undefined ? { duration: node.duration } : {}),
      ...(node.uses !== undefined ? { uses: node.uses } : {}),
    },
  }));

  const edges: CyElement[] = workflow.edges.map((edge, i) => ({
    group: "edges",
    data: {
      id: `e${i}`,
      source: edge.source,
      target: edge.target,
    },
  }));

  return [...nodes, ...edges];
}
