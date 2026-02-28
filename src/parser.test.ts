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
});
