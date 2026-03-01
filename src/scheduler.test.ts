import { describe, it, expect } from "vitest";
import {
  calculateScheduledJobs,
  criticalPathDuration,
  hasMissingDurations,
} from "./scheduler";
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
    const result = calculateScheduledJobs(workflow, emptyPipeline);
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
    const result = calculateScheduledJobs(workflow, emptyPipeline);
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
    const result = calculateScheduledJobs(workflow, emptyPipeline);
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
    const result = calculateScheduledJobs(workflow, pipeline);
    expect(result.find((j) => j.id === "deploy")).toEqual({
      id: "deploy",
      start: 0,
      end: 40,
      uses: "sub",
    });
  });
});

describe("hasMissingDurations", () => {
  it("returns false when a job has an explicit duration of 0", () => {
    const workflow: Workflow = {
      nodes: [{ id: "a", duration: 0 }],
      edges: [],
    };
    expect(hasMissingDurations(workflow, emptyPipeline)).toBe(false);
  });

  it("returns false when all jobs have explicit durations", () => {
    const workflow: Workflow = {
      nodes: [
        { id: "a", duration: 10 },
        { id: "b", duration: 20 },
      ],
      edges: [],
    };
    expect(hasMissingDurations(workflow, emptyPipeline)).toBe(false);
  });

  it("returns true when a job has no duration and no uses", () => {
    const workflow: Workflow = {
      nodes: [{ id: "a", duration: 10 }, { id: "b" }],
      edges: [],
    };
    expect(hasMissingDurations(workflow, emptyPipeline)).toBe(true);
  });

  it("returns false when a uses job references a workflow with durations", () => {
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
    expect(hasMissingDurations(workflow, pipeline)).toBe(false);
  });

  it("returns false for an empty workflow", () => {
    const workflow: Workflow = { nodes: [], edges: [] };
    expect(hasMissingDurations(workflow, emptyPipeline)).toBe(false);
  });

  it("returns true when a uses job transitively references a workflow with no durations", () => {
    const pipeline: ParsedPipeline = {
      workflows: {
        mid: {
          nodes: [{ id: "b", uses: "base" }],
          edges: [],
        },
        base: {
          nodes: [{ id: "c" }],
          edges: [],
        },
      },
    };
    const workflow: Workflow = {
      nodes: [{ id: "a", uses: "mid" }],
      edges: [],
    };
    expect(hasMissingDurations(workflow, pipeline)).toBe(true);
  });

  it("returns true when a uses job references a workflow with no durations", () => {
    const pipeline: ParsedPipeline = {
      workflows: {
        sub: {
          nodes: [{ id: "x" }],
          edges: [],
        },
      },
    };
    const workflow: Workflow = {
      nodes: [{ id: "deploy", uses: "sub" }],
      edges: [],
    };
    expect(hasMissingDurations(workflow, pipeline)).toBe(true);
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
