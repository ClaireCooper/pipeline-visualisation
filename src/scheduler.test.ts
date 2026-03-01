import { describe, it, expect } from "vitest";
import { scheduledJobs, criticalPathDuration } from "./scheduler";
import type { Workflow, ParsedPipeline } from "./parser";

const emptyPipeline: ParsedPipeline = { workflows: {} };

describe("scheduledJobs", () => {
  it("schedules parallel jobs both starting at 0", () => {
    const workflow: Workflow = {
      nodes: [
        { id: "a", duration: 10 },
        { id: "b", duration: 20 },
      ],
      edges: [],
    };
    const result = scheduledJobs(workflow, emptyPipeline);
    expect(result.find((j) => j.id === "a")).toEqual({
      id: "a",
      start: 0,
      end: 10,
    });
    expect(result.find((j) => j.id === "b")).toEqual({
      id: "b",
      start: 0,
      end: 20,
    });
  });

  it("schedules a linear chain sequentially", () => {
    const workflow: Workflow = {
      nodes: [
        { id: "a", duration: 10 },
        { id: "b", duration: 20 },
      ],
      edges: [{ source: "a", target: "b" }],
    };
    const result = scheduledJobs(workflow, emptyPipeline);
    expect(result.find((j) => j.id === "a")).toEqual({
      id: "a",
      start: 0,
      end: 10,
    });
    expect(result.find((j) => j.id === "b")).toEqual({
      id: "b",
      start: 10,
      end: 30,
    });
  });

  it("waits for the slowest predecessor (fan-in)", () => {
    const workflow: Workflow = {
      nodes: [
        { id: "a", duration: 10 },
        { id: "b", duration: 20 },
        { id: "c", duration: 5 },
      ],
      edges: [
        { source: "a", target: "c" },
        { source: "b", target: "c" },
      ],
    };
    const result = scheduledJobs(workflow, emptyPipeline);
    expect(result.find((j) => j.id === "c")).toEqual({
      id: "c",
      start: 20,
      end: 25,
    });
  });

  it("derives duration from the referenced workflow for a uses job", () => {
    const pipeline: ParsedPipeline = {
      workflows: {
        sub: {
          nodes: [{ id: "x", duration: 40 }],
          edges: [],
        },
      },
    };
    const workflow: Workflow = {
      nodes: [{ id: "deploy", uses: "sub" }],
      edges: [],
    };
    const result = scheduledJobs(workflow, pipeline);
    expect(result.find((j) => j.id === "deploy")).toEqual({
      id: "deploy",
      start: 0,
      end: 40,
      uses: "sub",
    });
  });
});

describe("criticalPathDuration", () => {
  it("returns total duration of a linear chain", () => {
    const pipeline: ParsedPipeline = {
      workflows: {
        main: {
          nodes: [
            { id: "a", duration: 10 },
            { id: "b", duration: 20 },
          ],
          edges: [{ source: "a", target: "b" }],
        },
      },
    };
    expect(criticalPathDuration("main", pipeline)).toBe(30);
  });

  it("returns the longest of two parallel paths", () => {
    const pipeline: ParsedPipeline = {
      workflows: {
        main: {
          nodes: [
            { id: "a", duration: 10 },
            { id: "b", duration: 20 },
            { id: "c", duration: 5 },
          ],
          edges: [
            { source: "a", target: "c" },
            { source: "b", target: "c" },
          ],
        },
      },
    };
    expect(criticalPathDuration("main", pipeline)).toBe(25);
  });

  it("returns 0 for an unknown workflow", () => {
    expect(criticalPathDuration("missing", emptyPipeline)).toBe(0);
  });
});
