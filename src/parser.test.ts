import { describe, it, expect } from "vitest";
import { parse } from "./parser";

describe("parse", () => {
  it("parses a single workflow with no dependencies", () => {
    const yaml = `
workflows:
  build:
    jobs:
      compile:
        duration: 30
      lint:
        duration: 10
`;
    const result = parse(yaml);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const workflow = result.pipeline.workflows["build"];
    expect(workflow).toBeDefined();
    expect(workflow.nodes).toEqual([
      { id: "compile", duration: 30 },
      { id: "lint", duration: 10 },
    ]);
    expect(workflow.edges).toEqual([]);
  });

  it("produces edges from needs declarations", () => {
    const yaml = `
workflows:
  pipeline:
    jobs:
      build:
        duration: 60
      test:
        duration: 30
      deploy:
        needs:
          - build
          - test
`;
    const result = parse(yaml);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const { edges } = result.pipeline.workflows["pipeline"];
    expect(edges).toContainEqual({ source: "build", target: "deploy" });
    expect(edges).toContainEqual({ source: "test", target: "deploy" });
    expect(edges).toHaveLength(2);
  });

  it("preserves the uses field on a node", () => {
    const yaml = `
workflows:
  main:
    jobs:
      deploy:
        uses: deploy-workflow
  deploy-workflow:
    jobs:
      upload:
        duration: 60
`;
    const result = parse(yaml);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const deployNode = result.pipeline.workflows["main"].nodes.find(
      (n) => n.id === "deploy",
    );
    expect(deployNode?.uses).toBe("deploy-workflow");
  });

  it("returns an error when uses references a non-existent workflow", () => {
    const yaml = `
workflows:
  main:
    jobs:
      deploy:
        uses: missing-workflow
`;
    const result = parse(yaml);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/missing-workflow/);
  });

  it("returns an error for invalid YAML", () => {
    const result = parse("}{invalid yaml{{");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/Invalid YAML/);
  });

  it("returns an error when top level is not an object", () => {
    const result = parse("- just\n- a\n- list");
    expect(result.ok).toBe(false);
  });

  it("returns an error when workflows key is missing", () => {
    const result = parse("something: else");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/workflows/);
  });
});
