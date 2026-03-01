import { describe, it, expect } from "vitest";
import { buildElements } from "./graph-elements";
import type { Workflow } from "./parser";

describe("buildElements", () => {
  it("converts nodes and edges to Cytoscape element format", () => {
    const workflow: Workflow = {
      nodes: [
        { id: "build", duration: 60 },
        { id: "test", duration: 30 },
        { id: "deploy" },
      ],
      edges: [
        { source: "build", target: "deploy" },
        { source: "test", target: "deploy" },
      ],
    };

    const elements = buildElements(workflow);

    const nodeIds = elements
      .filter((e) => e.group === "nodes")
      .map((e) => e.data.id);
    expect(nodeIds).toEqual(["build", "test", "deploy"]);

    const edges = elements.filter((e) => e.group === "edges");
    expect(edges).toHaveLength(2);
    expect(edges[0].data).toMatchObject({ source: "build", target: "deploy" });
    expect(edges[1].data).toMatchObject({ source: "test", target: "deploy" });
  });

  it("marks nodes with a uses field", () => {
    const workflow: Workflow = {
      nodes: [{ id: "deploy", uses: "deploy-workflow" }],
      edges: [],
    };

    const elements = buildElements(workflow);
    const node = elements.find((e) => e.data.id === "deploy");
    expect(node?.data.uses).toBe("deploy-workflow");
  });
});
